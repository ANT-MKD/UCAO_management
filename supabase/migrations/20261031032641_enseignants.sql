-- Enseignants (partie 4 du plan de migration, lot 1).
--
-- Deux tables pour une fiche :
--   - la fiche publique (nom, matricule, grade, spécialités), lue par tout compte connecté : les
--     portails affichent l'enseignant d'un cours ;
--   - le dossier personnel (contacts, état civil, pièce d'identité, RIB, diplômes, taux), lu par
--     les pages Professeurs qui en ont besoin et par l'enseignant lui-même.
-- La photo rejoindra l'espace de fichiers (lot 3).

create table public.enseignants (
  id text primary key default gen_random_uuid()::text,
  prenom text not null check (length(trim(prenom)) > 0),
  nom text not null check (length(trim(nom)) > 0),
  matricule text not null check (length(trim(matricule)) > 0),
  sexe text check (sexe in ('M', 'F')),
  grade text not null check (grade in ('Permanent', 'Vacataire', 'Contractuel')),
  specialite text not null default '',
  specialites text[] not null default '{}'
);
comment on table public.enseignants is 'Fiche publique des enseignants (nom, matricule, grade, spécialités).';
-- Le matricule est aussi l'identifiant de connexion du professeur : un seul par enseignant.
create unique index enseignants_matricule_unique on public.enseignants (lower(matricule));

create table public.enseignants_dossiers (
  id text primary key references public.enseignants (id) on delete cascade,
  telephone text not null default '',
  email text,
  -- Dates saisies telles quelles (le formulaire accepte une date vide).
  date_naissance text,
  pays_naissance text,
  lieu_naissance text,
  nationalite text,
  cni text,
  adresse text,
  niveau_etude text,
  rib text,
  diplomes text[] not null default '{}',
  taux_horaire numeric not null default 0 check (taux_horaire >= 0)
);
comment on table public.enseignants_dossiers is 'Dossier personnel des enseignants (contacts, état civil, RIB, diplômes, taux).';

create trigger enseignants_journal after insert or update or delete on public.enseignants
  for each row execute function private.journaliser_modification();
create trigger enseignants_dossiers_journal after insert or update or delete on public.enseignants_dossiers
  for each row execute function private.journaliser_modification();

-- ——— Droits et règles d'accès ——————————————————————————————————————————————————————————————

alter table public.enseignants enable row level security;
alter table public.enseignants_dossiers enable row level security;
grant select, insert, update, delete on public.enseignants, public.enseignants_dossiers to authenticated, service_role;

-- Fiche : lue par tout compte connecté actif, gérée depuis « Liste professeurs » et « Ajouter
-- professeurs ».
create policy enseignants_lecture on public.enseignants for select to authenticated
  using ((select private.type_compte_courant()) is not null);
create policy enseignants_creation on public.enseignants for insert to authenticated
  with check ((select private.a_acces_une_page(array['prof-liste', 'prof-ajouter'])));
create policy enseignants_modification on public.enseignants for update to authenticated
  using ((select private.a_acces_une_page(array['prof-liste', 'prof-ajouter'])))
  with check ((select private.a_acces_une_page(array['prof-liste', 'prof-ajouter'])));
create policy enseignants_suppression on public.enseignants for delete to authenticated
  using ((select private.a_acces_une_page(array['prof-liste', 'prof-ajouter'])));

-- Dossier : lu aussi par les pages des taux, vacations et contrats, et par l'enseignant lui-même ;
-- modifié par les mêmes pages que la fiche (l'enseignant ne modifie pas son RIB ni son taux).
create policy enseignants_dossiers_lecture on public.enseignants_dossiers for select to authenticated
  using (
    (select private.a_acces_une_page(array['prof-liste', 'prof-ajouter', 'prof-taux', 'prof-vacations', 'prof-contrat']))
    or id = (select private.lien_courant())
  );
create policy enseignants_dossiers_creation on public.enseignants_dossiers for insert to authenticated
  with check ((select private.a_acces_une_page(array['prof-liste', 'prof-ajouter'])));
create policy enseignants_dossiers_modification on public.enseignants_dossiers for update to authenticated
  using ((select private.a_acces_une_page(array['prof-liste', 'prof-ajouter'])))
  with check ((select private.a_acces_une_page(array['prof-liste', 'prof-ajouter'])));
create policy enseignants_dossiers_suppression on public.enseignants_dossiers for delete to authenticated
  using ((select private.a_acces_une_page(array['prof-liste', 'prof-ajouter'])));
