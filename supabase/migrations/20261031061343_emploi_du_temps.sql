-- Emploi du temps (partie 5 du plan de migration, lot 1).
--
-- Les séances de l'emploi du temps (une par créneau d'une semaine) et les événements ponctuels
-- (soutenances, examens…). Seule la page « Emploi du temps » les modifie. Chacun ne lit que ce
-- qui le concerne :
--   - l'administration lit toutes les séances (plannings, pointages, décomptes) ;
--   - un professeur ne lit que ses séances : FALL ne voit rien des cours de KANE ;
--   - un étudiant lit les séances de sa classe.
-- Les événements, sans professeur, sont lus par tout compte connecté.
-- Un professeur lit désormais les fiches scolaires (pas les dossiers personnels) des étudiants de
-- ses classes : celles où il a une séance et celles qui suivent un cours dont il est responsable.

-- ——— 1. Séances ————————————————————————————————————————————————————————————————————————————

create table public.seances (
  id text primary key default gen_random_uuid()::text,
  ec text not null default '',
  -- Un cours, une classe, une salle ou un professeur qui ont des séances ne se suppriment plus.
  ec_id text not null references public.ecs (id) on delete restrict,
  classe text not null default '',
  classe_id text not null references public.classes (id) on delete restrict,
  -- 1 = lundi … 7 = dimanche, dans la semaine qui commence le lundi semaine_du.
  jour smallint not null check (jour between 1 and 7),
  semaine_du date not null check (extract(isodow from semaine_du) = 1),
  heure_debut text not null check (heure_debut ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  heure_fin text not null check (heure_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  salle text not null default '',
  salle_id text references public.salles (id) on delete restrict,
  prof text not null default '',
  prof_id text references public.enseignants (id) on delete restrict,
  type text not null default '',
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  constraint seances_horaire check (heure_fin > heure_debut)
);
comment on table public.seances is 'Séances de l''emploi du temps, semaine par semaine.';
create index seances_ec_id_idx on public.seances (ec_id);
create index seances_classe_id_idx on public.seances (classe_id);
create index seances_salle_id_idx on public.seances (salle_id);
create index seances_prof_id_idx on public.seances (prof_id);
create index seances_annee_idx on public.seances (annee);
create index seances_semaine_du_idx on public.seances (semaine_du);

create trigger seances_annee_cloturee before insert or update or delete on public.seances
  for each row execute function private.refuser_annee_cloturee();

-- ——— 2. Événements ———————————————————————————————————————————————————————————————————————————

create table public.evenements (
  id text primary key default gen_random_uuid()::text,
  objet text not null check (length(trim(objet)) > 0),
  date date not null,
  type_id text not null references public.types_seance (id) on delete restrict,
  type text not null default '',
  classe_id text references public.classes (id) on delete restrict,
  classe text,
  salle_id text references public.salles (id) on delete restrict,
  salle text,
  heure_debut text not null check (heure_debut ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  heure_fin text not null check (heure_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  surveillant text,
  remarque text,
  cree_le timestamptz not null default now(),
  constraint evenements_horaire check (heure_fin > heure_debut)
);
comment on table public.evenements is 'Événements ponctuels de l''emploi du temps (soutenances, examens…).';
create index evenements_type_id_idx on public.evenements (type_id);
create index evenements_classe_id_idx on public.evenements (classe_id);
create index evenements_salle_id_idx on public.evenements (salle_id);
create index evenements_date_idx on public.evenements (date);

create trigger seances_journal after insert or update or delete on public.seances
  for each row execute function private.journaliser_modification();
create trigger evenements_journal after insert or update or delete on public.evenements
  for each row execute function private.journaliser_modification();

-- ——— 3. Qui enseigne où, qui étudie où ————————————————————————————————————————————————————

-- Classes du professeur connecté : celles où il a une séance, et celles qui suivent (même filière,
-- même niveau) un cours dont il est responsable.
create function private.classes_enseignant()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct x.id), '{}')
  from (
    select s.classe_id as id from public.seances s where s.prof_id = private.enseignant_courant()
    union
    select c.id
    from public.ecs e
    join public.ues u on u.id = e.ue_id
    join public.classes c on c.filiere_id = u.filiere_id and c.niveau = u.niveau
    where e.responsable_id = private.enseignant_courant()
  ) x
$$;

-- Classe de l'étudiant connecté.
create function private.classe_etudiant()
returns text
language sql stable security definer set search_path = ''
as $$
  select e.classe_id from public.etudiants e where e.id = private.etudiant_courant()
$$;

revoke execute on function private.classes_enseignant(), private.classe_etudiant() from public, anon;
grant execute on function private.classes_enseignant(), private.classe_etudiant() to authenticated, service_role;

-- ——— 4. Droits et règles d'accès ——————————————————————————————————————————————————————————

alter table public.seances enable row level security;
alter table public.evenements enable row level security;
grant select, insert, update, delete on public.seances, public.evenements to authenticated, service_role;

create policy seances_lecture on public.seances for select to authenticated
  using (
    (select private.est_administration())
    or prof_id = (select private.enseignant_courant())
    or classe_id = (select private.classe_etudiant())
  );
create policy seances_creation on public.seances for insert to authenticated
  with check ((select private.a_acces_page('edt-grille')));
create policy seances_modification on public.seances for update to authenticated
  using ((select private.a_acces_page('edt-grille'))) with check ((select private.a_acces_page('edt-grille')));
create policy seances_suppression on public.seances for delete to authenticated
  using ((select private.a_acces_page('edt-grille')));

create policy evenements_lecture on public.evenements for select to authenticated
  using ((select private.type_compte_courant()) is not null);
create policy evenements_creation on public.evenements for insert to authenticated
  with check ((select private.a_acces_page('edt-grille')));
create policy evenements_modification on public.evenements for update to authenticated
  using ((select private.a_acces_page('edt-grille'))) with check ((select private.a_acces_page('edt-grille')));
create policy evenements_suppression on public.evenements for delete to authenticated
  using ((select private.a_acces_page('edt-grille')));

-- Le professeur lit les fiches des étudiants de ses classes (listes, cahiers de séance).
alter policy etudiants_lecture on public.etudiants
  using (
    (select private.est_administration())
    or id = (select private.etudiant_courant())
    or classe_id = any ((select private.classes_enseignant())::text[])
  );
