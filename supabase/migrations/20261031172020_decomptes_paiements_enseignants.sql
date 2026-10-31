-- Finances (partie 7 du plan de migration, lot 4) : décomptes des enseignants, leurs paiements et
-- les exports comptables.
--
-- Le décompte d'un professeur est recalculé par la base, ligne par ligne, à partir de ses
-- pointages validés et de ses taux (taux horaire du cours, ou de sa fiche avec l'abattement par
-- défaut ; forfait du cours) : quel que soit le poste qui le génère, le décompte de KANE donne
-- toujours le même montant. Un pointage ou un forfait n'entre que dans un seul décompte en cours ;
-- deux décomptes simultanés du même professeur passent l'un après l'autre. Ce qui est payé sur un
-- décompte est recalculé à partir de ses paiements, jamais au-delà du net à payer ; un décompte
-- payé ne s'annule pas. Numéros donnés par la base (DC-, PP-, EXP-). Le professeur lit ses
-- décomptes et ses paiements, et la base l'en prévient.

-- ——— 1. Tables ———————————————————————————————————————————————————————————————————————————

create table public.decomptes (
  id text primary key,
  reference text not null unique check (reference ~ '^DC-[0-9]{4}-[0-9]{3,}$'),
  date date not null,
  teacher_id text not null references public.enseignants (id) on delete restrict,
  professeur text not null default '',
  type text not null check (type in ('taux_horaire', 'forfait', 'a_terme')),
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  -- Montants recalculés par la base à partir des lignes.
  montant_decompte numeric not null default 0,
  net_a_payer numeric not null default 0,
  montant_paye numeric not null default 0,
  statut text not null check (statut in ('emis', 'annule')),
  ajoutee_par text not null default '',
  lignes jsonb not null check (jsonb_typeof(lignes) = 'array' and jsonb_array_length(lignes) > 0)
);
comment on table public.decomptes is 'Décomptes des enseignants, recalculés par la base à partir des pointages validés et des taux.';
create index decomptes_teacher_id_idx on public.decomptes (teacher_id);
create index decomptes_annee_idx on public.decomptes (annee);

create table public.paiements_decomptes (
  id text primary key,
  reference text not null unique check (reference ~ '^PP-[0-9]{4}-[0-9]{3,}$'),
  date date not null,
  decompte_id text not null references public.decomptes (id) on delete restrict,
  decompte_reference text not null default '',
  decompte_date_emission date,
  montant_decompte_total numeric not null default 0,
  abattement_montant numeric not null default 0,
  teacher_id text not null references public.enseignants (id) on delete restrict,
  professeur text not null default '',
  montant numeric not null check (montant > 0),
  moyen text not null default '',
  reference_bancaire text,
  paye_par text not null default '',
  annulee boolean not null default false,
  lignes jsonb not null default '[]' check (jsonb_typeof(lignes) = 'array')
);
comment on table public.paiements_decomptes is 'Paiements des enseignants sur leurs décomptes.';
create index paiements_decomptes_decompte_id_idx on public.paiements_decomptes (decompte_id);
create index paiements_decomptes_teacher_id_idx on public.paiements_decomptes (teacher_id);

create table public.exports_comptables (
  id text primary key,
  reference text not null unique check (reference ~ '^EXP-[0-9]{4}-[0-9]{3,}$'),
  date date not null default current_date,
  generee_par text not null default '',
  periode_debut date not null,
  periode_fin date not null,
  categories text[] not null default '{}',
  par_categorie jsonb not null default '[]' check (jsonb_typeof(par_categorie) = 'array'),
  total_recettes numeric not null default 0,
  total_depenses numeric not null default 0,
  total_ajustements numeric not null default 0,
  solde_net numeric not null default 0,
  nb_lignes integer not null default 0 check (nb_lignes >= 0),
  constraint exports_comptables_periode check (periode_fin >= periode_debut)
);
comment on table public.exports_comptables is 'Exports comptables générés (période, catégories et totaux), tels qu''ils ont été remis.';

-- ——— 2. Numéros ————————————————————————————————————————————————————————————————————————————

create trigger decomptes_a_numero before insert on public.decomptes
  for each row execute function private.numeroter_piece('reference', 'DC', 'date');
create trigger paiements_decomptes_a_numero before insert on public.paiements_decomptes
  for each row execute function private.numeroter_piece('reference', 'PP', 'date');
create trigger exports_comptables_a_numero before insert on public.exports_comptables
  for each row execute function private.numeroter_piece('reference', 'EXP', 'date');

-- ——— 3. Calcul des décomptes —————————————————————————————————————————————————————————————————

-- Une ligne de décompte recalculée : un pointage validé du professeur, au taux horaire du cours
-- (ou de sa fiche, abattement par défaut 5 %), ou le forfait d'un cours.
create function private.calculer_ligne_decompte(p_teacher text, p_annee text, p_ligne jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_source text := p_ligne ->> 'pointageId';
  v_pointage public.pointages;
  v_taux public.taux_enseignants;
  v_montant numeric;
  v_pct numeric;
  v_brut numeric;
  v_fiche numeric;
begin
  select * into v_pointage from public.pointages p where p.id = v_source;
  if v_pointage.id is not null then
    if v_pointage.teacher_id <> p_teacher or v_pointage.statut <> 'valide' or v_pointage.annee <> p_annee then
      raise exception 'Le pointage du % n''est pas un pointage validé de ce professeur pour %.', to_char(v_pointage.date, 'DD/MM/YYYY'), p_annee
        using errcode = 'check_violation';
    end if;
    select * into v_taux from public.taux_enseignants t
      where t.id = p_teacher || ':' || p_annee || ':' || v_pointage.ec_id || ':' || v_pointage.classe_id;
    if v_taux.mode_paiement = 'taux_horaire' and v_taux.montant is not null then
      v_montant := v_taux.montant;
      v_pct := v_taux.taux_abatt;
    elsif v_taux.mode_paiement = 'forfait' then
      raise exception 'Ce cours est payé au forfait : décompte « Forfait ».' using errcode = 'check_violation';
    else
      select d.taux_horaire into v_fiche from public.enseignants_dossiers d where d.id = p_teacher;
      if coalesce(v_fiche, 0) <= 0 then
        raise exception 'Aucun taux horaire pour ce cours ni sur la fiche du professeur.' using errcode = 'check_violation';
      end if;
      v_montant := v_fiche;
      v_pct := coalesce(v_taux.taux_abatt, 5);
    end if;
    v_brut := v_pointage.volume_pointe * v_montant;
    return p_ligne || jsonb_build_object('ecId', v_pointage.ec_id, 'classeId', v_pointage.classe_id, 'duree', v_pointage.volume_pointe,
      'date', v_pointage.date, 'montantBrut', v_brut, 'abattementPct', v_pct, 'abattementMontant', v_brut * v_pct / 100,
      'montantNet', v_brut - v_brut * v_pct / 100);
  end if;
  select * into v_taux from public.taux_enseignants t
    where t.id = p_teacher || ':' || p_annee || ':' || (p_ligne ->> 'ecId') || ':' || (p_ligne ->> 'classeId');
  if v_taux.mode_paiement <> 'forfait' or v_taux.montant is null then
    raise exception 'Aucun forfait pour ce cours de ce professeur.' using errcode = 'check_violation';
  end if;
  return p_ligne || jsonb_build_object('montantBrut', v_taux.montant, 'abattementPct', v_taux.taux_abatt,
    'abattementMontant', v_taux.montant * v_taux.taux_abatt / 100, 'montantNet', v_taux.montant - v_taux.montant * v_taux.taux_abatt / 100);
end;
$$;
revoke execute on function private.calculer_ligne_decompte(text, text, jsonb) from public, anon, authenticated;

-- Payé sur un décompte : ses paiements non annulés.
create function private.paye_decompte(p_decompte text)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(p.montant), 0) from public.paiements_decomptes p where p.decompte_id = p_decompte and not p.annulee
$$;
revoke execute on function private.paye_decompte(text) from public, anon, authenticated;

-- Nouveau décompte : lignes recalculées, chaque pointage ou forfait dans un seul décompte en cours,
-- totaux de la base. Ensuite, seule l'annulation (sans paiement) se note ; le payé est recalculé.
create function private.controler_decompte()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ligne jsonb;
  v_lignes jsonb := '[]';
  v_statut text;
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.decomptes d where d.id = new.id) then
      return new;
    end if;
    perform pg_advisory_xact_lock(hashtext('decompte:' || new.teacher_id));
    for v_ligne in select l from jsonb_array_elements(new.lignes) l loop
      if exists (select 1 from public.decomptes d, jsonb_array_elements(d.lignes) x
                 where d.statut = 'emis' and x ->> 'pointageId' = v_ligne ->> 'pointageId') then
        raise exception 'Le cours % du % est déjà dans un décompte en cours.', coalesce(v_ligne ->> 'coursLabel', ''), coalesce(v_ligne ->> 'date', '')
          using errcode = 'check_violation';
      end if;
      v_lignes := v_lignes || jsonb_build_array(private.calculer_ligne_decompte(new.teacher_id, new.annee, v_ligne));
    end loop;
    if (select count(distinct l ->> 'pointageId') from jsonb_array_elements(v_lignes) l) <> jsonb_array_length(v_lignes) then
      raise exception 'Un même cours figure deux fois dans ce décompte.' using errcode = 'check_violation';
    end if;
    new.lignes := v_lignes;
    new.montant_decompte := (select sum((l ->> 'montantBrut')::numeric) from jsonb_array_elements(v_lignes) l);
    new.net_a_payer := (select sum((l ->> 'montantNet')::numeric) from jsonb_array_elements(v_lignes) l);
    new.montant_paye := 0;
    new.statut := 'emis';
    return new;
  end if;
  v_statut := new.statut;
  new := old;
  new.montant_paye := private.paye_decompte(old.id);
  if v_statut = 'annule' and old.statut = 'emis' then
    if new.montant_paye > 0 then
      raise exception 'Le décompte % a déjà un paiement enregistré : il ne s''annule pas.', old.reference using errcode = 'check_violation';
    end if;
    new.statut := 'annule';
  elsif v_statut <> old.statut then
    raise exception 'Le décompte % est annulé : il le reste.', old.reference using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_decompte() from public, anon, authenticated;
create trigger decomptes_controle before insert or update on public.decomptes
  for each row execute function private.controler_decompte();

-- Paiement : sur un décompte en cours du même professeur, jamais au-delà du reste à payer (deux
-- paiements simultanés passent l'un après l'autre). Ensuite, seule son annulation se note.
create function private.controler_paiement_decompte()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_decompte public.decomptes;
  v_paye numeric;
begin
  if exists (select 1 from public.paiements_decomptes p where p.id = new.id) then
    return new;
  end if;
  select * into v_decompte from public.decomptes d where d.id = new.decompte_id for no key update;
  if v_decompte.statut is distinct from 'emis' or v_decompte.teacher_id <> new.teacher_id then
    raise exception 'Décompte introuvable ou annulé.' using errcode = 'check_violation';
  end if;
  v_paye := private.paye_decompte(v_decompte.id);
  if new.montant > v_decompte.net_a_payer - v_paye then
    raise exception 'Montant invalide : il dépasse le reste à payer sur ce décompte (% F).', private.montant_fr(v_decompte.net_a_payer - v_paye)
      using errcode = 'check_violation';
  end if;
  new.decompte_reference := v_decompte.reference;
  new.decompte_date_emission := v_decompte.date;
  new.montant_decompte_total := v_decompte.montant_decompte;
  new.abattement_montant := v_decompte.montant_decompte - v_decompte.net_a_payer;
  return new;
end;
$$;
revoke execute on function private.controler_paiement_decompte() from public, anon, authenticated;
create trigger paiements_decomptes_controle before insert on public.paiements_decomptes
  for each row execute function private.controler_paiement_decompte();
create trigger paiements_decomptes_annulation before update on public.paiements_decomptes
  for each row execute function private.garder_piece_annulable();

create function private.recalculer_paye_decompte()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.decomptes d set montant_paye = 0 where d.id = new.decompte_id;
  return null;
end;
$$;
revoke execute on function private.recalculer_paye_decompte() from public, anon, authenticated;
create trigger paiements_decomptes_versement after insert or update on public.paiements_decomptes
  for each row execute function private.recalculer_paye_decompte();

-- Un export remis ne change plus.
create trigger exports_comptables_controle before update on public.exports_comptables
  for each row execute function private.garder_tel_quel();

-- Le professeur est prévenu de chaque décompte et de chaque paiement.
create function private.suivre_decompte()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'decomptes' then
    perform private.notifier_enseignant(new.teacher_id,
      format('Nouveau décompte disponible : %s (%s FCFA net à payer)', new.reference, private.montant_fr(new.net_a_payer)));
  else
    perform private.notifier_enseignant(new.teacher_id,
      format('Paiement enregistré sur votre décompte %s : %s FCFA', new.decompte_reference, private.montant_fr(new.montant)));
  end if;
  return null;
end;
$$;
revoke execute on function private.suivre_decompte() from public, anon, authenticated;
create trigger decomptes_suivi after insert on public.decomptes
  for each row execute function private.suivre_decompte();
create trigger paiements_decomptes_suivi after insert on public.paiements_decomptes
  for each row execute function private.suivre_decompte();

-- ——— 4. Journal, compteurs de changements et droits ————————————————————————————————————————

do $$
declare
  v_table text;
begin
  foreach v_table in array array['decomptes', 'paiements_decomptes', 'exports_comptables'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.journaliser_modification()',
      v_table || '_journal', v_table);
    perform private.suivre_table(v_table);
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end
$$;

grant select, insert, update on public.decomptes, public.paiements_decomptes, public.exports_comptables to authenticated, service_role;

create policy decomptes_lecture on public.decomptes for select to authenticated
  using ((select private.est_administration()) or teacher_id = (select private.enseignant_courant()));
create policy decomptes_creation on public.decomptes for insert to authenticated
  with check ((select private.a_acces_une_page(array['fin-decompte-taux', 'fin-decompte-forfait', 'fin-decompte-terme', 'fin-decompte-liste'])));
create policy decomptes_modification on public.decomptes for update to authenticated
  using ((select private.a_acces_une_page(array['fin-decompte-taux', 'fin-decompte-forfait', 'fin-decompte-terme', 'fin-decompte-liste',
    'fin-paiement-prof-nouveau', 'fin-paiement-prof-liste'])))
  with check ((select private.a_acces_une_page(array['fin-decompte-taux', 'fin-decompte-forfait', 'fin-decompte-terme', 'fin-decompte-liste',
    'fin-paiement-prof-nouveau', 'fin-paiement-prof-liste'])));

create policy paiements_decomptes_lecture on public.paiements_decomptes for select to authenticated
  using ((select private.est_administration()) or teacher_id = (select private.enseignant_courant()));
create policy paiements_decomptes_creation on public.paiements_decomptes for insert to authenticated
  with check ((select private.a_acces_une_page(array['fin-paiement-prof-nouveau', 'fin-paiement-prof-liste'])));
create policy paiements_decomptes_modification on public.paiements_decomptes for update to authenticated
  using ((select private.a_acces_une_page(array['fin-paiement-prof-nouveau', 'fin-paiement-prof-liste'])))
  with check ((select private.a_acces_une_page(array['fin-paiement-prof-nouveau', 'fin-paiement-prof-liste'])));

create policy exports_comptables_lecture on public.exports_comptables for select to authenticated using ((select private.est_administration()));
create policy exports_comptables_creation on public.exports_comptables for insert to authenticated with check ((select private.a_acces_page('fin-export')));
create policy exports_comptables_modification on public.exports_comptables for update to authenticated
  using ((select private.a_acces_page('fin-export'))) with check ((select private.a_acces_page('fin-export')));
