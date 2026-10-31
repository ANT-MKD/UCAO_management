-- Notes et résultats (partie 6 du plan de migration, lot 3) : attestations numérotées.
--
-- Certificats de scolarité, attestations d'inscription et de réussite. Le numéro (ATT-2026-001…)
-- est réservé auprès de la base juste avant l'émission : jamais deux fois le même, même depuis
-- deux postes, et jamais un numéro inventé au-delà des numéros réservés. Une attestation de
-- réussite n'est délivrée qu'à un étudiant admis par un jury clôturé : la moyenne et la décision
-- inscrites sont celles de la délibération, relues par la base. Une attestation émise ne change
-- plus (seul son envoi se note) et ne se supprime pas ; l'étudiant la lit et en est prévenu.

create table public.attestations (
  id text primary key,
  numero text not null unique check (numero ~ '^ATT-[0-9]{4}-[0-9]{3,}$'),
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  etudiant text not null default '',
  matricule text not null default '',
  classe_id text references public.classes (id) on delete restrict,
  classe text not null default '',
  filiere_id text references public.filieres (id) on delete restrict,
  filiere text not null default '',
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  type text not null check (type in ('scolarite', 'inscription', 'reussite')),
  type_label text not null default '',
  semestre_id text references public.semestres (id) on delete restrict,
  semestre_label text,
  moyenne_constatee numeric,
  decision_constatee text check (decision_constatee in ('admis', 'ajourne', 'rattrapage', 'exclu', 'a_declasser')),
  -- Solde dû constaté à l'émission (trace) : il n'empêche jamais l'émission.
  solde_du_constate numeric not null default 0,
  statut text not null check (statut in ('genere', 'envoyee')),
  date_generation date not null default current_date,
  effectue_par text not null default '',
  constraint attestations_reussite check (type <> 'reussite' or semestre_id is not null)
);
comment on table public.attestations is 'Attestations et certificats délivrés aux étudiants, numérotés par la base.';
create index attestations_etudiant_id_idx on public.attestations (etudiant_id);
create index attestations_classe_id_idx on public.attestations (classe_id);
create index attestations_filiere_id_idx on public.attestations (filiere_id);
create index attestations_annee_idx on public.attestations (annee);
create index attestations_semestre_id_idx on public.attestations (semestre_id);

-- Prochain numéro d'attestation de l'année (un numéro déjà pris est sauté).
create function public.attribuer_numero_attestation()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_annee text := to_char(now(), 'YYYY');
  v_numero text;
begin
  if not private.a_acces_une_page(array['bul-attestations', 'com-demandes']) then
    raise exception 'Vous n''avez pas accès aux attestations.' using errcode = 'insufficient_privilege';
  end if;
  loop
    v_numero := 'ATT-' || v_annee || '-' || lpad(private.prochain_numero('attestation:' || v_annee)::text, 3, '0');
    exit when not exists (select 1 from public.attestations a where a.numero = v_numero);
  end loop;
  return v_numero;
end;
$$;
comment on function public.attribuer_numero_attestation() is 'Réserve le prochain numéro d''attestation.';
revoke execute on function public.attribuer_numero_attestation() from public, anon;
grant execute on function public.attribuer_numero_attestation() to authenticated, service_role;

-- Numéro réservé (pas au-delà du compteur de son année) ; réussite vérifiée sur la délibération
-- clôturée, moyenne et décision relues ; une attestation émise ne change plus que par son envoi.
create function private.controler_attestation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ligne public.deliberations_lignes;
  v_statut text;
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'statut') <> (to_jsonb(old) - 'statut') or (old.statut = 'envoyee' and new.statut <> 'envoyee') then
      raise exception 'L''attestation % est émise : elle ne change plus (seul son envoi se note).', old.numero using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if split_part(new.numero, '-', 3)::bigint > coalesce((select c.valeur from private.compteurs c
                                                         where c.cle = 'attestation:' || split_part(new.numero, '-', 2)), 0) then
    raise exception 'Le numéro % n''a pas été réservé : demandez un numéro à la base.', new.numero using errcode = 'check_violation';
  end if;
  if new.statut <> 'genere' then
    raise exception 'Une attestation est d''abord émise, puis envoyée.' using errcode = 'check_violation';
  end if;
  if new.type = 'reussite' then
    select d.statut into v_statut from public.deliberations d where d.classe_id = new.classe_id and d.semestre_id = new.semestre_id;
    if v_statut is null then
      raise exception 'Aucune délibération n''a encore eu lieu pour ce semestre — impossible de certifier une réussite.' using errcode = 'check_violation';
    end if;
    if v_statut <> 'cloturee' then
      raise exception 'La délibération de ce semestre n''est pas clôturée — ses décisions sont encore provisoires.' using errcode = 'check_violation';
    end if;
    select l.* into v_ligne from public.deliberations_lignes l
    join public.deliberations d on d.id = l.deliberation_id
    where d.classe_id = new.classe_id and d.semestre_id = new.semestre_id and l.etudiant_id = new.etudiant_id;
    if v_ligne.id is null then
      raise exception 'Cet étudiant n''apparaît pas dans la délibération de ce semestre.' using errcode = 'check_violation';
    end if;
    if v_ligne.decision_finale <> 'admis' then
      raise exception 'Décision du jury pour ce semestre : l''étudiant n''est pas admis, aucune attestation de réussite ne peut être délivrée.'
        using errcode = 'check_violation';
    end if;
    new.moyenne_constatee := v_ligne.moyenne;
    new.decision_constatee := v_ligne.decision_finale;
  else
    new.moyenne_constatee := null;
    new.decision_constatee := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_attestation() from public, anon, authenticated;
create trigger attestations_controle before insert or update on public.attestations
  for each row execute function private.controler_attestation();

-- Attestation émise : l'étudiant est prévenu.
create function private.suivre_attestation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_compte uuid;
begin
  for v_compte in
    select c.id from public.comptes c where c.type_compte = 'etudiant' and c.actif and c.lien_id = new.etudiant_id
  loop
    perform private.envoyer_notification(v_compte, format('Nouveau document disponible : %s (%s)', new.type_label, new.numero));
  end loop;
  return null;
end;
$$;
revoke execute on function private.suivre_attestation() from public, anon, authenticated;
create trigger attestations_suivi after insert on public.attestations
  for each row execute function private.suivre_attestation();

create trigger attestations_journal after insert or update or delete on public.attestations
  for each row execute function private.journaliser_modification();
select private.suivre_table('attestations');

-- Lues par l'administration et par l'étudiant concerné ; émises et marquées envoyées par les pages
-- Attestations et Demandes ; jamais supprimées.
alter table public.attestations enable row level security;
grant select, insert, update on public.attestations to authenticated, service_role;
create policy attestations_lecture on public.attestations for select to authenticated
  using ((select private.est_administration()) or etudiant_id = (select private.etudiant_courant()));
create policy attestations_emission on public.attestations for insert to authenticated
  with check ((select private.a_acces_une_page(array['bul-attestations', 'com-demandes'])));
create policy attestations_envoi on public.attestations for update to authenticated
  using ((select private.a_acces_une_page(array['bul-attestations', 'com-demandes'])))
  with check ((select private.a_acces_une_page(array['bul-attestations', 'com-demandes'])));
