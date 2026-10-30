-- Rôles, pages des portails et motifs de blocage (partie 3 du plan de migration, lot 2).
--
-- Les rôles existent depuis la partie 1 (lus par l'administration, gérés par les comptes à accès
-- complet) : ils sont désormais journalisés. S'y ajoutent les pages des portails Étudiant et
-- Professeur que l'établissement ouvre ou ferme (Sécurité › Portails), et les motifs de blocage
-- d'un étudiant (Paramètres généraux), que l'on assignera aux dossiers à la partie 4.

-- ——— 1. Rôles : journal ————————————————————————————————————————————————————————————————————

create trigger roles_journal after insert or update or delete on public.roles
  for each row execute function private.journaliser_modification();

-- ——— 2. Pages des portails ——————————————————————————————————————————————————————————————————
-- Une ligne par page du menu des portails (identifiants de portalFeaturesStore.ts). Une page
-- absente est ouverte. La page d'accueil d'un portail ne se ferme jamais.
create table public.pages_portails (
  id text primary key check (id ~ '^(student|teacher)-[a-z0-9-]+$'),
  portail text not null check (portail in ('etudiant', 'enseignant')),
  active boolean not null default true,
  constraint pages_portails_portail_coherent
    check ((portail = 'etudiant') = (id like 'student-%')),
  constraint pages_portails_accueil_toujours_ouvert
    check (active or id not in ('student-dashboard', 'teacher-dashboard'))
);
comment on table public.pages_portails is 'Pages des portails Étudiant et Professeur ouvertes ou fermées par l''établissement.';

create trigger pages_portails_journal after insert or update or delete on public.pages_portails
  for each row execute function private.journaliser_modification();

-- ——— 3. Motifs de blocage ———————————————————————————————————————————————————————————————————
create table public.motifs_blocage (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null check (length(trim(intitule)) > 0),
  -- Actions refusées à l'étudiant bloqué (identifiants de motifBlocageStore.ts).
  actions_interdites text[] not null default '{}'
    check (actions_interdites <@ array['portail_etudiant', 'impression_attestation_inscription',
      'impression_attestation_reussite', 'impression_certificat_scolarite', 'impression_bulletin']),
  cree_le timestamptz not null default now()
);
comment on table public.motifs_blocage is 'Motifs de blocage d''un étudiant (impayé, dossier incomplet…) et actions qu''ils interdisent.';
-- Comme dans l'application : un code n'existe qu'une fois, majuscules ou non.
create unique index motifs_blocage_code_unique on public.motifs_blocage (lower(code));

create trigger motifs_blocage_journal after insert or update or delete on public.motifs_blocage
  for each row execute function private.journaliser_modification();

-- ——— 4. Droits et règles d'accès ——————————————————————————————————————————————————————————

alter table public.pages_portails enable row level security;
alter table public.motifs_blocage enable row level security;

grant select, insert, update, delete on public.pages_portails, public.motifs_blocage to authenticated;
grant select, insert, update, delete on public.pages_portails, public.motifs_blocage to service_role;

-- Lues par tout compte connecté actif : chaque portail en a besoin (menu, accès d'un étudiant).
create policy pages_portails_lecture on public.pages_portails for select to authenticated
  using ((select private.type_compte_courant()) is not null);
create policy pages_portails_creation on public.pages_portails for insert to authenticated
  with check ((select private.a_acces_page('sec-portails')));
create policy pages_portails_modification on public.pages_portails for update to authenticated
  using ((select private.a_acces_page('sec-portails'))) with check ((select private.a_acces_page('sec-portails')));
create policy pages_portails_suppression on public.pages_portails for delete to authenticated
  using ((select private.a_acces_page('sec-portails')));

create policy motifs_blocage_lecture on public.motifs_blocage for select to authenticated
  using ((select private.type_compte_courant()) is not null);
create policy motifs_blocage_creation on public.motifs_blocage for insert to authenticated
  with check ((select private.a_acces_page('sec-settings')));
create policy motifs_blocage_modification on public.motifs_blocage for update to authenticated
  using ((select private.a_acces_page('sec-settings'))) with check ((select private.a_acces_page('sec-settings')));
create policy motifs_blocage_suppression on public.motifs_blocage for delete to authenticated
  using ((select private.a_acces_page('sec-settings')));
