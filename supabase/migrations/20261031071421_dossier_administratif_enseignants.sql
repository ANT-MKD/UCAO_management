-- Dossier administratif des enseignants (partie 5 du plan de migration, lot 3).
--
-- Absences et retards constatés (et leurs justificatifs), demandes de rallonge, contrats et
-- avenants, volumes horaires, taux et statut de chaque cours, vacations. Chaque table est lue par
-- l'administration et par le professeur concerné, et lui seul : FALL ne voit rien de ce qui
-- concerne KANE. Les pages « Professeurs » qui en ont la charge les modifient ; le professeur ne
-- fait que justifier ses absences (avec une pièce dans l'espace de fichiers « justificatifs ») et
-- demander une rallonge.
-- La base fait elle-même :
--   - le numéro des contrats (CTR-0001…), jamais deux fois le même, même depuis deux postes ;
--   - l'ajout d'une rallonge validée au volume horaire du cours ;
--   - les notifications : absence constatée, justificatif reçu, accepté ou refusé, rallonge
--     validée ou rejetée, contrat, avenant, résiliation, vacation payée.

-- ——— 1. Absences et retards constatés ————————————————————————————————————————————————————————

create table public.absences_enseignants (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.enseignants (id) on delete restrict,
  ec_id text references public.ecs (id) on delete restrict,
  classe_id text references public.classes (id) on delete restrict,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  seance_id text references public.seances (id) on delete restrict,
  date date not null,
  type text not null check (type in ('absence', 'retard')),
  duree_minutes integer check (duree_minutes is null or duree_minutes >= 0),
  motif text not null default '',
  justifie boolean not null default false,
  cree_par text,
  cree_le timestamptz not null default now(),
  -- Justificatif envoyé par le professeur, en attente de décision.
  justificatif_motif text,
  justificatif_piece_nom text,
  justificatif_piece text,
  justificatif_envoye_le timestamptz,
  -- Dernier justificatif refusé, avec le motif du refus.
  refus_motif text,
  refus_motif_refus text,
  refus_le timestamptz,
  constraint absences_enseignants_piece check (justificatif_piece is null or starts_with(justificatif_piece, teacher_id || '/' || id || '/'))
);
comment on table public.absences_enseignants is 'Absences et retards des enseignants constatés par l''administration, et leurs justificatifs.';
create index absences_enseignants_teacher_id_idx on public.absences_enseignants (teacher_id);
create index absences_enseignants_ec_id_idx on public.absences_enseignants (ec_id);
create index absences_enseignants_classe_id_idx on public.absences_enseignants (classe_id);
create index absences_enseignants_annee_idx on public.absences_enseignants (annee);
create index absences_enseignants_seance_id_idx on public.absences_enseignants (seance_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('justificatifs', 'justificatifs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);

-- ——— 2. Rallonges ——————————————————————————————————————————————————————————————————————————

create table public.rallonges (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.enseignants (id) on delete restrict,
  ec_id text not null references public.ecs (id) on delete restrict,
  classe_id text not null references public.classes (id) on delete restrict,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  vh_actuel numeric not null default 0 check (vh_actuel >= 0),
  vh_supplementaire numeric not null check (vh_supplementaire > 0),
  motif text not null default '',
  statut text not null check (statut in ('soumis', 'valide', 'rejete')),
  motif_rejet text,
  origine text not null check (origine in ('prof', 'admin')),
  cree_le timestamptz not null default now(),
  date_traitement timestamptz
);
comment on table public.rallonges is 'Demandes de rallonge du volume horaire d''un cours.';
create index rallonges_teacher_id_idx on public.rallonges (teacher_id);
create index rallonges_ec_id_idx on public.rallonges (ec_id);
create index rallonges_classe_id_idx on public.rallonges (classe_id);
create index rallonges_annee_idx on public.rallonges (annee);
-- Une seule demande en attente par cours, même depuis deux postes.
create unique index rallonges_une_en_attente on public.rallonges (teacher_id, ec_id, classe_id, annee) where statut = 'soumis';

-- ——— 3. Contrats ——————————————————————————————————————————————————————————————————————————

create table public.contrats_enseignants (
  -- Numéro du contrat (CTR-0001), attribué par la base.
  id text primary key,
  teacher_id text not null references public.enseignants (id) on delete restrict,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  date_debut date not null,
  date_fin date not null,
  cree_le timestamptz not null default now(),
  lignes jsonb not null default '[]' check (jsonb_typeof(lignes) = 'array'),
  avenants jsonb not null default '[]' check (jsonb_typeof(avenants) = 'array'),
  resilie boolean not null default false,
  date_resiliation date,
  motif_resiliation text,
  constraint contrats_enseignants_dates check (date_fin >= date_debut)
);
comment on table public.contrats_enseignants is 'Contrats des enseignants, leurs lignes (cours valorisés) et leurs avenants.';
create index contrats_enseignants_teacher_id_idx on public.contrats_enseignants (teacher_id);
create index contrats_enseignants_annee_idx on public.contrats_enseignants (annee);

-- Prochain numéro de contrat, jamais deux fois le même (un numéro déjà pris est sauté).
create function public.attribuer_numero_contrat()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_numero text;
begin
  if not private.a_acces_page('prof-contrat') then
    raise exception 'Vous n''avez pas accès aux contrats des professeurs.' using errcode = 'insufficient_privilege';
  end if;
  loop
    v_numero := 'CTR-' || lpad(private.prochain_numero('contrat')::text, 4, '0');
    exit when not exists (select 1 from public.contrats_enseignants c where c.id = v_numero);
  end loop;
  return v_numero;
end;
$$;
comment on function public.attribuer_numero_contrat() is 'Réserve le prochain numéro de contrat professeur.';
revoke execute on function public.attribuer_numero_contrat() from public, anon;
grant execute on function public.attribuer_numero_contrat() to authenticated, service_role;

-- ——— 4. Volume, taux et statut de chaque cours ——————————————————————————————————————————————
-- Une ligne par cours d'un professeur une année : <professeur>:<année>:<EC>:<classe>.

create table public.volumes_enseignants (
  id text primary key,
  teacher_id text not null references public.enseignants (id) on delete restrict,
  ec_id text not null references public.ecs (id) on delete restrict,
  classe_id text not null references public.classes (id) on delete restrict,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  nouveau_vh numeric not null check (nouveau_vh >= 0),
  constraint volumes_enseignants_id check (id = teacher_id || ':' || annee || ':' || ec_id || ':' || classe_id)
);
comment on table public.volumes_enseignants is 'Volume horaire mis à jour d''un cours d''un professeur (rallonges comprises).';

create table public.taux_enseignants (
  id text primary key,
  teacher_id text not null references public.enseignants (id) on delete restrict,
  ec_id text not null references public.ecs (id) on delete restrict,
  classe_id text not null references public.classes (id) on delete restrict,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  mode_paiement text not null default '' check (mode_paiement in ('', 'taux_horaire', 'forfait')),
  montant numeric check (montant is null or montant >= 0),
  taux_abatt numeric not null default 0 check (taux_abatt between 0 and 100),
  constraint taux_enseignants_id check (id = teacher_id || ':' || annee || ':' || ec_id || ':' || classe_id)
);
comment on table public.taux_enseignants is 'Taux horaire ou forfait de chaque cours d''un professeur.';

create table public.statuts_cours_enseignants (
  id text primary key,
  teacher_id text not null references public.enseignants (id) on delete restrict,
  ec_id text not null references public.ecs (id) on delete restrict,
  classe_id text not null references public.classes (id) on delete restrict,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  type_comptabilisation text not null default '' check (type_comptabilisation in ('', 'normal', 'a_terme')),
  constraint statuts_cours_enseignants_id check (id = teacher_id || ':' || annee || ':' || ec_id || ':' || classe_id)
);
comment on table public.statuts_cours_enseignants is 'Comptabilisation de chaque cours d''un professeur (normal ou à terme).';

do $$
declare
  v_table text;
begin
  foreach v_table in array array['volumes_enseignants', 'taux_enseignants', 'statuts_cours_enseignants']
  loop
    execute format('create index %I on public.%I (teacher_id)', v_table || '_teacher_id_idx', v_table);
    execute format('create index %I on public.%I (ec_id)', v_table || '_ec_id_idx', v_table);
    execute format('create index %I on public.%I (classe_id)', v_table || '_classe_id_idx', v_table);
    execute format('create index %I on public.%I (annee)', v_table || '_annee_idx', v_table);
  end loop;
end
$$;

-- ——— 5. Vacations ——————————————————————————————————————————————————————————————————————————

create table public.vacations (
  id text primary key default gen_random_uuid()::text,
  mois text not null check (length(trim(mois)) > 0),
  enseignant text not null default '',
  enseignant_id text not null references public.enseignants (id) on delete restrict,
  modules text[] not null default '{}',
  heures_cm numeric not null default 0 check (heures_cm >= 0),
  heures_td numeric not null default 0 check (heures_td >= 0),
  taux_horaire numeric not null default 0 check (taux_horaire >= 0),
  montant_total numeric not null check (montant_total >= 0),
  statut text not null check (statut in ('brouillon', 'valide', 'paye')),
  moyen text not null default '',
  observations text,
  constraint vacations_montant check (montant_total = (heures_cm + heures_td) * taux_horaire)
);
comment on table public.vacations is 'Vacations mensuelles des enseignants (heures × taux), jusqu''au paiement.';
create index vacations_enseignant_id_idx on public.vacations (enseignant_id);

-- ——— 6. Garde-fous du professeur ————————————————————————————————————————————————————————————

-- Le professeur ne fait que justifier : un justificatif à la fois, sur un constat pas encore
-- justifié, sans toucher au reste du constat.
create function private.controler_absence_enseignant()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_justificatif text[] := array['justificatif_motif', 'justificatif_piece_nom', 'justificatif_piece', 'justificatif_envoye_le'];
begin
  if (select private.type_compte_courant()) = 'enseignant' then
    if to_jsonb(new) - v_justificatif is distinct from to_jsonb(old) - v_justificatif then
      raise exception 'Vous ne pouvez qu''envoyer un justificatif.' using errcode = 'insufficient_privilege';
    end if;
    if old.justifie then
      raise exception 'Ce constat est déjà justifié.' using errcode = 'check_violation';
    end if;
    if old.justificatif_motif is not null then
      raise exception 'Un justificatif est déjà en attente de décision pour ce constat.' using errcode = 'check_violation';
    end if;
    if length(trim(coalesce(new.justificatif_motif, ''))) = 0 then
      raise exception 'Expliquez la raison de l''absence ou du retard.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_absence_enseignant() from public, anon, authenticated;
create trigger absences_enseignants_controle before update on public.absences_enseignants
  for each row execute function private.controler_absence_enseignant();

-- Le professeur demande une rallonge (en attente, à son nom) ; seule l'administration la traite.
create function private.controler_rallonge()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select private.type_compte_courant()) = 'enseignant'
     and (new.origine <> 'prof' or new.statut <> 'soumis' or new.motif_rejet is not null or new.date_traitement is not null) then
    raise exception 'Vous demandez une rallonge ; seule l''administration la valide ou la rejette.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_rallonge() from public, anon, authenticated;
create trigger rallonges_controle before insert on public.rallonges
  for each row execute function private.controler_rallonge();

-- ——— 7. Ce que fait la base : volume des rallonges validées, notifications ——————————————————

-- « 150 000 » (séparateur de milliers comme dans l'application).
create function private.montant_fr(p_montant numeric)
returns text
language sql immutable set search_path = ''
as $$
  select regexp_replace(round(p_montant)::text, '(\d)(?=(\d{3})+$)', '\1' || chr(8239), 'g')
$$;
revoke execute on function private.montant_fr(numeric) from public, anon, authenticated;

-- Prévient le compte du professeur.
create function private.notifier_enseignant(p_teacher text, p_message text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_compte uuid;
begin
  for v_compte in
    select c.id from public.comptes c where c.type_compte = 'enseignant' and c.actif and c.lien_id = p_teacher
  loop
    perform private.envoyer_notification(v_compte, p_message);
  end loop;
end;
$$;
revoke execute on function private.notifier_enseignant(text, text) from public, anon, authenticated;

create function private.suivre_absence_enseignant()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_date text := to_char(new.date, 'DD/MM/YYYY');
  v_quoi text := case when new.type = 'retard' then 'retard' else 'absence' end;
  v_ec text := (select e.libelle from public.ecs e where e.id = new.ec_id);
  v_auteur text;
  v_compte uuid;
begin
  if tg_op = 'INSERT' then
    perform private.notifier_enseignant(new.teacher_id,
      case when new.type = 'retard'
        then 'Un retard' || coalesce(' de ' || nullif(new.duree_minutes, 0) || ' min', '') || ' a été constaté'
        else 'Une absence a été constatée' end
      || ' le ' || v_date || coalesce(' en ' || v_ec, '')
      || case when trim(new.motif) <> '' then ' — motif : ' || trim(new.motif) else '' end
      || '. Consultez « Mes absences ».');
    return null;
  end if;
  if new.justificatif_motif is not null and old.justificatif_motif is null then
    select c.nom_affiche into v_auteur from public.comptes c
    where c.type_compte = 'enseignant' and c.lien_id = new.teacher_id limit 1;
    for v_compte in
      select c.id from public.comptes c
      where c.type_compte = 'administration' and c.actif and private.acces_page_de(c.id, 'prof-absence-retard')
    loop
      perform private.envoyer_notification(v_compte,
        format('Justificatif reçu de %s pour son %s du %s : %s.', coalesce(v_auteur, 'un professeur'), v_quoi, v_date, new.justificatif_motif));
    end loop;
  end if;
  if new.justifie and not old.justifie then
    perform private.notifier_enseignant(new.teacher_id, format('Justificatif accepté : votre %s du %s est justifié(e).', v_quoi, v_date));
  elsif new.refus_le is not null and new.refus_le is distinct from old.refus_le then
    perform private.notifier_enseignant(new.teacher_id,
      format('Justificatif refusé pour votre %s du %s — motif : %s. Vous pouvez en envoyer un autre depuis « Mes absences ».', v_quoi, v_date, new.refus_motif_refus));
  end if;
  return null;
end;
$$;

-- Rallonge validée : ses heures s'ajoutent au volume horaire du cours ; le professeur est prévenu.
create function private.suivre_rallonge()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.statut = old.statut then
    return null;
  end if;
  if new.statut = 'valide' then
    insert into public.volumes_enseignants as v (id, teacher_id, ec_id, classe_id, annee, nouveau_vh)
    values (new.teacher_id || ':' || new.annee || ':' || new.ec_id || ':' || new.classe_id, new.teacher_id, new.ec_id, new.classe_id, new.annee,
            new.vh_actuel + new.vh_supplementaire)
    on conflict (id) do update set nouveau_vh = v.nouveau_vh + new.vh_supplementaire;
    perform private.notifier_enseignant(new.teacher_id, format('Votre demande de rallonge (+%sh) a été validée.', trim_scale(new.vh_supplementaire)));
  elsif new.statut = 'rejete' then
    perform private.notifier_enseignant(new.teacher_id,
      'Votre demande de rallonge a été rejetée' || coalesce(' — ' || nullif(trim(new.motif_rejet), ''), '') || '.');
  end if;
  return null;
end;
$$;

create function private.suivre_contrat_enseignant()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_avenant jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.notifier_enseignant(new.teacher_id, format('Nouveau contrat %s (%s) du %s au %s — %s F CFA. Consultez « Mon contrat ».',
      new.id, new.annee, to_char(new.date_debut, 'DD/MM/YYYY'), to_char(new.date_fin, 'DD/MM/YYYY'),
      private.montant_fr(coalesce((select sum((l ->> 'montant')::numeric) from jsonb_array_elements(new.lignes) l), 0))));
    return null;
  end if;
  if jsonb_array_length(new.avenants) > jsonb_array_length(old.avenants) then
    v_avenant := new.avenants -> (jsonb_array_length(new.avenants) - 1);
    perform private.notifier_enseignant(new.teacher_id, format('Avenant n° %s à votre contrat %s : fin au %s — %s.',
      v_avenant ->> 'numero', new.id, to_char(new.date_fin, 'DD/MM/YYYY'), v_avenant ->> 'motif'));
  end if;
  if new.resilie and not old.resilie then
    perform private.notifier_enseignant(new.teacher_id, 'Votre contrat ' || new.id || ' a été résilié'
      || case when trim(coalesce(new.motif_resiliation, '')) <> '' then ' : ' || trim(new.motif_resiliation) else '' end || '.');
  end if;
  return null;
end;
$$;

create function private.suivre_vacation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.statut = 'paye' and old.statut is distinct from 'paye' then
    perform private.notifier_enseignant(new.enseignant_id,
      format('Votre vacation de %s a été payée (%s FCFA, %s)', new.mois, private.montant_fr(new.montant_total), new.moyen));
  end if;
  return null;
end;
$$;

revoke execute on function private.suivre_absence_enseignant(), private.suivre_rallonge(), private.suivre_contrat_enseignant(),
  private.suivre_vacation() from public, anon, authenticated;
create trigger absences_enseignants_suivi after insert or update on public.absences_enseignants
  for each row execute function private.suivre_absence_enseignant();
create trigger rallonges_suivi after update of statut on public.rallonges
  for each row execute function private.suivre_rallonge();
create trigger contrats_enseignants_suivi after insert or update on public.contrats_enseignants
  for each row execute function private.suivre_contrat_enseignant();
create trigger vacations_suivi after update of statut on public.vacations
  for each row execute function private.suivre_vacation();

-- ——— 8. Année clôturée, journal ————————————————————————————————————————————————————————————

do $$
declare
  v_table text;
begin
  foreach v_table in array array['absences_enseignants', 'rallonges', 'contrats_enseignants', 'volumes_enseignants', 'taux_enseignants',
    'statuts_cours_enseignants']
  loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function private.refuser_annee_cloturee()',
      v_table || '_annee_cloturee', v_table);
  end loop;
  foreach v_table in array array['absences_enseignants', 'rallonges', 'contrats_enseignants', 'volumes_enseignants', 'taux_enseignants',
    'statuts_cours_enseignants', 'vacations']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.journaliser_modification()',
      v_table || '_journal', v_table);
  end loop;
end
$$;

-- ——— 9. Droits et règles d'accès ——————————————————————————————————————————————————————————
-- Lecture : l'administration et le professeur concerné. Écriture : les pages qui en ont la charge.

do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('absences_enseignants', 'teacher_id', array['prof-absence-nouveau', 'prof-absence-retard']),
      ('rallonges', 'teacher_id', array['prof-rallonge-nouvelle', 'prof-rallonge-traitement']),
      ('contrats_enseignants', 'teacher_id', array['prof-contrat']),
      ('volumes_enseignants', 'teacher_id', array['prof-vh']),
      ('taux_enseignants', 'teacher_id', array['prof-taux']),
      ('statuts_cours_enseignants', 'teacher_id', array['prof-statut-cours']),
      ('vacations', 'enseignant_id', array['prof-vacations'])
    ) as t(nom, colonne, pages)
  loop
    execute format('alter table public.%I enable row level security', v.nom);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', v.nom);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.est_administration()) or %I = (select private.enseignant_courant()))',
      v.nom || '_lecture', v.nom, v.colonne);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.a_acces_une_page(%L)))',
      v.nom || '_creation', v.nom, v.pages);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.a_acces_une_page(%L))) with check ((select private.a_acces_une_page(%L)))',
      v.nom || '_modification', v.nom, v.pages, v.pages);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.a_acces_une_page(%L)))',
      v.nom || '_suppression', v.nom, v.pages);
  end loop;
end
$$;

-- Le professeur justifie ses propres constats et demande des rallonges pour lui-même.
create policy absences_enseignants_justification on public.absences_enseignants for update to authenticated
  using (teacher_id = (select private.enseignant_courant())) with check (teacher_id = (select private.enseignant_courant()));
create policy rallonges_demande on public.rallonges for insert to authenticated
  with check (teacher_id = (select private.enseignant_courant()));

-- Justificatifs : <professeur>/<constat>/<fichier>, déposés par le professeur, lus par lui et par
-- les pages des absences des professeurs.
create policy edumanage_justificatifs_lecture on storage.objects for select to authenticated
  using (bucket_id = 'justificatifs' and array_length(storage.foldername(name), 1) = 2
         and ((storage.foldername(name))[1] = (select private.enseignant_courant())
              or (select private.a_acces_une_page(array['prof-absence-nouveau', 'prof-absence-retard']))));
create policy edumanage_justificatifs_depot on storage.objects for insert to authenticated
  with check (bucket_id = 'justificatifs' and array_length(storage.foldername(name), 1) = 2
              and (storage.foldername(name))[1] = (select private.enseignant_courant()));
create policy edumanage_justificatifs_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'justificatifs' and (select private.a_acces_une_page(array['prof-absence-nouveau', 'prof-absence-retard'])));
