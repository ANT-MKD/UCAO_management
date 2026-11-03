-- Structure académique (partie 3 du plan de migration, lot 1).
--
-- Cycles, entités et catégories de cours (« Paramétrage académique ») ; filières, niveaux,
-- semestres, salles, classes, UE et EC. Les colonnes reprennent les fiches de l'application
-- (libellés compris, pour que les écrans restent identiques) ; les liens sont tenus par la base :
-- on ne supprime plus une filière qui a des niveaux, un niveau qui a des semestres ou des classes,
-- une salle qui sert de salle par défaut, une année qui a des classes. Les liens vers les
-- étudiants, notes et séances arrivent avec leurs tables (parties 4 à 6).
--
-- Lecture : tout compte connecté (les trois portails affichent filières, classes, UE…).
-- Écriture : les pages du menu qui gèrent chaque élément. Chaque création, modification ou
-- suppression est inscrite au journal par la base elle-même.

-- ——— 1. Outils communs ——————————————————————————————————————————————————————————————————

-- L'une de ces pages du menu est-elle ouverte au compte connecté ?
create function private.a_acces_une_page(p_pages text[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from unnest(p_pages) as p where private.acces_page_de((select auth.uid()), p))
$$;
revoke execute on function private.a_acces_une_page(text[]) from public, anon;
grant execute on function private.a_acces_une_page(text[]) to authenticated, service_role;

-- Journal automatique : qui a créé, modifié ou supprimé quoi (la ligne est identifiée par son id,
-- avec son code ou son nom quand elle en a un).
create function private.journaliser_modification()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ligne jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return null;
  end if;
  insert into public.journal_audit (acteur, action, cible_type, cible_id, details)
  values (
    (select auth.uid()),
    lower(tg_op) || '_' || tg_table_name,
    tg_table_name,
    coalesce(v_ligne ->> 'id', ''),
    coalesce(v_ligne ->> 'code', v_ligne ->> 'nom', v_ligne ->> 'libelle', v_ligne ->> 'intitule')
  );
  return null;
end;
$$;
revoke execute on function private.journaliser_modification() from public, anon, authenticated;

-- ——— 2. Paramétrage académique ——————————————————————————————————————————————————————————

create table public.cycles (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null,
  ordre integer not null default 0
);
comment on table public.cycles is 'Cycles d''études (BTS, Licence, Master…).';

create table public.entites (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null
);
comment on table public.entites is 'Entités (facultés, instituts) qui portent les filières.';

create table public.categories_cours (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null
);
comment on table public.categories_cours is 'Catégories des UE (obligatoire, optionnelle…).';

-- ——— 3. Filières, niveaux, semestres ————————————————————————————————————————————————————

create table public.filieres (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  nom text not null check (length(trim(nom)) > 0),
  responsable text not null default '',
  -- Fiche enseignant (la clé étrangère arrive avec les enseignants, partie 4).
  responsable_id text,
  statut text not null default 'actif' check (statut in ('actif', 'inactif')),
  cycle_id text references public.cycles (id) on delete restrict,
  cycle text,
  entite_id text references public.entites (id) on delete restrict,
  entite text,
  type_programme text check (type_programme in ('semestriel', 'annuel')),
  annees_actives text[],
  specialite text,
  informations_complementaires text
);
comment on table public.filieres is 'Filières (ex. LPIG, Licence en informatique de gestion).';
create index filieres_cycle_id_idx on public.filieres (cycle_id);
create index filieres_entite_id_idx on public.filieres (entite_id);

create table public.niveaux (
  id text primary key default gen_random_uuid()::text,
  nom text not null check (length(trim(nom)) > 0),
  alias text not null check (length(trim(alias)) > 0),
  cycle text not null default '',
  cycle_id text references public.cycles (id) on delete restrict,
  filiere text not null default '',
  filiere_id text not null references public.filieres (id) on delete restrict,
  passage_conditionnel_autorise boolean,
  credit_dette_min numeric check (credit_dette_min >= 0),
  credits_requis_entree numeric check (credits_requis_entree >= 0)
);
comment on table public.niveaux is 'Niveaux d''une filière (L1, L2, M1…).';
create index niveaux_filiere_id_idx on public.niveaux (filiere_id);
create index niveaux_cycle_id_idx on public.niveaux (cycle_id);

create table public.semestres (
  id text primary key default gen_random_uuid()::text,
  nom text not null check (length(trim(nom)) > 0),
  alias text not null check (length(trim(alias)) > 0),
  niveau text not null default '',
  niveau_id text not null references public.niveaux (id) on delete restrict,
  filiere text not null default '',
  statut text not null default 'actif' check (statut in ('actif', 'futur', 'clos'))
);
comment on table public.semestres is 'Semestres d''un niveau (S1, S2…).';
create index semestres_niveau_id_idx on public.semestres (niveau_id);

-- ——— 4. Salles et classes ——————————————————————————————————————————————————————————————

create table public.salles (
  id text primary key default gen_random_uuid()::text,
  nom text not null check (length(trim(nom)) > 0),
  type text not null default '',
  capacite integer not null default 0 check (capacite >= 0),
  batiment text not null default '',
  etage text not null default '',
  equipements text[] not null default '{}',
  statut text not null default 'actif' check (statut in ('actif', 'en_maintenance', 'inactif'))
);
comment on table public.salles is 'Salles physiques (locaux).';

create table public.classes (
  id text primary key default gen_random_uuid()::text,
  nom text not null check (length(trim(nom)) > 0),
  filiere text not null default '',
  filiere_id text not null references public.filieres (id) on delete restrict,
  niveau text not null default '',
  niveau_id text not null references public.niveaux (id) on delete restrict,
  max integer not null check (max between 1 and 200),
  delegue text not null default '',
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  salle_par_defaut_id text references public.salles (id) on delete restrict,
  cloturee boolean,
  date_cloture text,
  cloturee_par text,
  observation_cloture text
);
comment on table public.classes is 'Classes pédagogiques (groupe d''étudiants d''un niveau, une année).';
create index classes_filiere_id_idx on public.classes (filiere_id);
create index classes_niveau_id_idx on public.classes (niveau_id);
create index classes_annee_idx on public.classes (annee);
create index classes_salle_par_defaut_id_idx on public.classes (salle_par_defaut_id);

-- ——— 5. UE et EC ————————————————————————————————————————————————————————————————————————

create table public.ues (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  libelle text not null check (length(trim(libelle)) > 0),
  credits numeric not null check (credits >= 0),
  filiere text not null default '',
  filiere_id text not null references public.filieres (id) on delete restrict,
  -- Niveau et semestre par leur alias (L1, S1), comme dans les maquettes importées.
  niveau text not null default '',
  semestre text not null default '',
  type text not null default '',
  obligatoire boolean not null default true,
  description text
);
comment on table public.ues is 'Unités d''enseignement de la maquette.';
create index ues_filiere_id_idx on public.ues (filiere_id);

create table public.ecs (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  libelle text not null check (length(trim(libelle)) > 0),
  abrege text,
  ue text not null default '',
  -- Une UE supprimée part avec ses EC ; un EC qui a des notes ou des séances (parties 5 et 6) la
  -- retiendra.
  ue_id text not null references public.ues (id) on delete cascade,
  credits numeric not null check (credits >= 0),
  vol_cm numeric not null default 0 check (vol_cm >= 0),
  vol_td numeric not null default 0 check (vol_td >= 0),
  vol_tp numeric not null default 0 check (vol_tp >= 0),
  vol_tpe numeric not null default 0 check (vol_tpe >= 0),
  vht numeric not null default 0 check (vht >= 0),
  responsable text not null default '',
  responsable_id text
);
comment on table public.ecs is 'Éléments constitutifs des UE.';
create index ecs_ue_id_idx on public.ecs (ue_id);

-- ——— 6. Journal automatique ——————————————————————————————————————————————————————————————

create trigger cycles_journal after insert or update or delete on public.cycles
  for each row execute function private.journaliser_modification();
create trigger entites_journal after insert or update or delete on public.entites
  for each row execute function private.journaliser_modification();
create trigger categories_cours_journal after insert or update or delete on public.categories_cours
  for each row execute function private.journaliser_modification();
create trigger filieres_journal after insert or update or delete on public.filieres
  for each row execute function private.journaliser_modification();
create trigger niveaux_journal after insert or update or delete on public.niveaux
  for each row execute function private.journaliser_modification();
create trigger semestres_journal after insert or update or delete on public.semestres
  for each row execute function private.journaliser_modification();
create trigger salles_journal after insert or update or delete on public.salles
  for each row execute function private.journaliser_modification();
create trigger classes_journal after insert or update or delete on public.classes
  for each row execute function private.journaliser_modification();
create trigger ues_journal after insert or update or delete on public.ues
  for each row execute function private.journaliser_modification();
create trigger ecs_journal after insert or update or delete on public.ecs
  for each row execute function private.journaliser_modification();
create trigger annees_academiques_journal after insert or update or delete on public.annees_academiques
  for each row execute function private.journaliser_modification();

-- ——— 7. Droits et règles d'accès ——————————————————————————————————————————————————————————

alter table public.cycles enable row level security;
alter table public.entites enable row level security;
alter table public.categories_cours enable row level security;
alter table public.filieres enable row level security;
alter table public.niveaux enable row level security;
alter table public.semestres enable row level security;
alter table public.salles enable row level security;
alter table public.classes enable row level security;
alter table public.ues enable row level security;
alter table public.ecs enable row level security;

grant select, insert, update, delete on
  public.cycles, public.entites, public.categories_cours, public.filieres, public.niveaux,
  public.semestres, public.salles, public.classes, public.ues, public.ecs
  to authenticated;
grant select, insert, update, delete on
  public.cycles, public.entites, public.categories_cours, public.filieres, public.niveaux,
  public.semestres, public.salles, public.classes, public.ues, public.ecs
  to service_role;

-- Une règle de lecture et une d'écriture par table : lecture pour tout compte connecté actif,
-- écriture pour qui a l'une des pages qui gèrent la table.
do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('cycles', array['acad-parametrage']),
      ('entites', array['acad-parametrage']),
      ('categories_cours', array['acad-parametrage']),
      ('filieres', array['acad-filieres']),
      ('niveaux', array['acad-niveaux']),
      ('semestres', array['acad-semestres']),
      ('salles', array['acad-salles']),
      -- Classes : aussi créées à l'ouverture de l'année suivante et à la bascule, et clôturées en
      -- fin d'année.
      ('classes', array['acad-classes', 'acad-annees', 'scol-classes-bascule', 'scol-classes-cloture']),
      -- La maquette s'importe d'un bloc (UE et EC) depuis l'une ou l'autre page.
      ('ues', array['acad-ues', 'acad-ecs']),
      ('ecs', array['acad-ues', 'acad-ecs'])
    ) as t(nom, pages)
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.type_compte_courant()) is not null)',
      v.nom || '_lecture', v.nom);
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
