-- Paramétrage de la scolarité et des bulletins (partie 3 du plan de migration, lot 3).
--
-- Tout ce qui décide des résultats d'un étudiant : barème, seuils et règles de calcul de chaque
-- filière (Paramétrage scolarité), règlements de calcul par année et leur historique (Règlements
-- de calcul), méthodes de calcul des moyennes, mentions, règles de validation, types
-- d'évaluation, regroupements devoir / examen et déclassement (Paramétrage bulletins).
-- Les portails Étudiant et Professeur calculent les bulletins avec ces réglages : tout compte
-- connecté actif les lit ; seuls les comptes qui ont la page correspondante les modifient.

-- ——— 1. Paramétrage scolarité ——————————————————————————————————————————————————————————————

-- Valeurs par défaut de l'établissement, données à chaque nouvelle filière (une seule ligne).
create table public.scolarite_valeurs_defaut (
  id text primary key default 'etablissement' check (id = 'etablissement'),
  note_bareme numeric not null check (note_bareme > 0),
  cumul_credit boolean not null,
  moyenne_passage numeric not null check (moyenne_passage >= 0),
  moyenne_eliminatoire numeric not null check (moyenne_eliminatoire >= 0),
  modifie_par text,
  modifie_le timestamptz
);
comment on table public.scolarite_valeurs_defaut is 'Valeurs par défaut du paramétrage scolarité d''une nouvelle filière.';

-- Une configuration par filière. Les règles de calcul (seuils, rattrapage, compensation…) sont
-- rangées telles que l'application les nomme ; une clé inconnue est refusée.
create table public.scolarite_configs (
  id text primary key,
  filiere_id text not null unique references public.filieres (id) on delete cascade,
  filiere text not null default '',
  note_bareme numeric not null check (note_bareme > 0),
  cumul_credit boolean not null,
  moyenne_passage numeric not null check (moyenne_passage >= 0),
  moyenne_eliminatoire numeric not null check (moyenne_eliminatoire >= 0),
  -- Méthodes de calcul choisies dans Paramétrage bulletins (catalogue methodes_calcul ; une méthode
  -- absente ou désactivée fait revenir l'application au calcul par défaut).
  methode_calcul_moy_ue_id text,
  methode_calcul_moy_session_id text,
  methode_calcul_moy_annee_id text,
  methode_calcul_moy_programme_id text,
  calcul_grade boolean,
  regles_calcul jsonb check (regles_calcul is null or (jsonb_typeof(regles_calcul) = 'object'
    and regles_calcul - array['seuilValidationEc', 'seuilValidationUe', 'noteEliminatoireEc',
      'creditsParCompensation', 'poidsDevoirDefaut', 'regleRattrapage', 'plafondRattrapage',
      'heuresAbsenceExclusion', 'margeRattrapage', 'creditsPassageAvecDette'] = '{}'::jsonb)),
  -- Formules d'avant les règlements par année (reprises une fois dans un règlement).
  formules_calcul jsonb check (formules_calcul is null or (jsonb_typeof(formules_calcul) = 'object'
    and formules_calcul - array['noteEc', 'moyenneUe', 'creditsUe', 'moyenneSemestre',
      'decisionSemestre', 'decisionAnnee'] = '{}'::jsonb)),
  formules_modifiees_par text,
  formules_modifiees_le timestamptz,
  modifie_par text,
  modifie_le timestamptz
);
comment on table public.scolarite_configs is 'Paramétrage scolarité de chaque filière : barème, seuils, règles et méthodes de calcul.';

-- ——— 2. Règlements de calcul et leur historique —————————————————————————————————————————————

-- Un règlement : des formules, pour une année et une ou plusieurs filières (au plus un règlement
-- par filière et par année).
create table public.reglements_calcul (
  id text primary key default gen_random_uuid()::text,
  nom text not null check (length(trim(nom)) > 0),
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  filiere_ids text[] not null check (cardinality(filiere_ids) > 0),
  formules jsonb not null default '{}' check (jsonb_typeof(formules) = 'object'
    and formules - array['noteEc', 'moyenneUe', 'creditsUe', 'moyenneSemestre',
      'decisionSemestre', 'decisionAnnee'] = '{}'::jsonb),
  cree_par text not null default '',
  cree_le timestamptz not null default now(),
  modifie_par text,
  modifie_le timestamptz,
  -- Renseigné quand l'enregistrement revient au contenu d'une ancienne version.
  depuis_version integer check (depuis_version > 0)
);
comment on table public.reglements_calcul is 'Règlements de calcul : formules d''une année pour une ou plusieurs filières.';
create index reglements_calcul_annee_idx on public.reglements_calcul (annee);

-- Historique : une version par création, modification, retour en arrière ou suppression, écrite
-- par la base elle-même (aucun compte n'y écrit, ne la modifie ni ne l'efface).
create table public.reglements_calcul_versions (
  id text primary key,
  reglement_id text not null,
  numero integer not null check (numero > 0),
  action text not null check (action in ('creation', 'modification', 'retour', 'suppression', 'reprise')),
  nom text not null,
  annee text not null,
  filiere_ids text[] not null,
  formules jsonb not null,
  par text not null,
  le timestamptz not null default now(),
  depuis_version integer,
  unique (reglement_id, numero)
);
comment on table public.reglements_calcul_versions is 'Historique des règlements de calcul, conservé même après suppression d''un règlement.';

-- Contrôles d'un règlement : ses filières existent, et aucune n'a déjà un règlement cette année-là
-- (même si deux postes enregistrent en même temps).
create function private.controler_reglement_calcul()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_filiere text;
  v_autre text;
begin
  select f into v_filiere from unnest(new.filiere_ids) as f
  where not exists (select 1 from public.filieres x where x.id = f)
  limit 1;
  if found then
    raise exception 'La filière % n''existe pas.', v_filiere using errcode = 'foreign_key_violation';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('reglements_calcul:' || new.annee, 0));
  select coalesce(x.nom, f), r.nom into v_filiere, v_autre
  from public.reglements_calcul r
  cross join lateral unnest(r.filiere_ids) as f
  left join public.filieres x on x.id = f
  where r.annee = new.annee and r.id <> new.id and f = any (new.filiere_ids)
  limit 1;
  if found then
    raise exception '% a déjà le règlement « % » pour %.', v_filiere, v_autre, new.annee
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_reglement_calcul() from public, anon, authenticated;

-- Version ajoutée après chaque changement réel (un enregistrement sans changement n'en ajoute
-- pas), au nom du compte connecté.
create function private.versionner_reglement_calcul()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ligne public.reglements_calcul;
  v_action text;
  v_auteur text;
  v_numero integer;
begin
  if tg_op = 'DELETE' then
    v_ligne := old;
    v_action := 'suppression';
  else
    v_ligne := new;
    if tg_op = 'UPDATE' then
      if old.nom = new.nom and old.formules = new.formules
        and (select array_agg(f order by f) from unnest(old.filiere_ids) as f)
          = (select array_agg(f order by f) from unnest(new.filiere_ids) as f) then
        return null;
      end if;
    end if;
    v_action := case when new.depuis_version is not null then 'retour'
      when tg_op = 'INSERT' then 'creation' else 'modification' end;
    v_auteur := nullif(coalesce(new.modifie_par, new.cree_par), '');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('reglements_calcul_versions:' || v_ligne.id, 0));
  select coalesce(max(v.numero), 0) + 1 into v_numero
  from public.reglements_calcul_versions v where v.reglement_id = v_ligne.id;
  insert into public.reglements_calcul_versions
    (id, reglement_id, numero, action, nom, annee, filiere_ids, formules, par, depuis_version)
  values (
    'version-' || v_ligne.id || '-' || v_numero, v_ligne.id, v_numero, v_action, v_ligne.nom,
    v_ligne.annee, v_ligne.filiere_ids, v_ligne.formules,
    coalesce((select c.nom_affiche from public.comptes c where c.id = (select auth.uid())), v_auteur, 'Administration'),
    case when v_action = 'retour' then v_ligne.depuis_version end
  );
  return null;
end;
$$;
revoke execute on function private.versionner_reglement_calcul() from public, anon, authenticated;

create trigger reglements_calcul_annee_cloturee before insert or update or delete on public.reglements_calcul
  for each row execute function private.refuser_annee_cloturee();
create trigger reglements_calcul_controle before insert or update on public.reglements_calcul
  for each row execute function private.controler_reglement_calcul();
create trigger reglements_calcul_version after insert or update or delete on public.reglements_calcul
  for each row execute function private.versionner_reglement_calcul();

-- ——— 3. Paramétrage bulletins ——————————————————————————————————————————————————————————————

-- Méthodes de calcul des moyennes : le code désigne une fonction de l'application ; l'intitulé,
-- la description et l'activation se règlent ici.
create table public.methodes_calcul (
  id text primary key,
  code text not null check (code ~ '^[A-Za-z]+$'),
  intitule text not null check (length(trim(intitule)) > 0),
  niveau text not null check (niveau in ('moyenneUe', 'moyenneSession', 'moyenneAnnee', 'moyenneProgramme')),
  description text,
  actif boolean not null default true,
  unique (niveau, code)
);
comment on table public.methodes_calcul is 'Méthodes de calcul des moyennes (UE, session, année, programme) proposées aux filières.';

create table public.mentions (
  id text primary key default gen_random_uuid()::text,
  niveau text not null check (niveau in ('moyenneUe', 'moyenneSession', 'moyenneAnnee', 'moyenneProgramme')),
  valeur_min numeric not null check (valeur_min >= 0),
  valeur_max numeric not null,
  mention text not null check (length(trim(mention)) > 0),
  appreciation_succes text,
  appreciation_echec text,
  actif boolean not null default true,
  constraint mentions_tranche_ordonnee check (valeur_min <= valeur_max)
);
comment on table public.mentions is 'Mentions et appréciations imprimées sur les bulletins, par tranche de moyenne.';

-- Règles de validation d'un semestre, d'une année ou d'un programme (par crédits et / ou par
-- moyenne). Paramétrage scolarité y reporte ses seuils de passage.
create table public.regles_validation (
  id text primary key default gen_random_uuid()::text,
  filiere_id text not null references public.filieres (id) on delete cascade,
  filiere text not null default '',
  type text not null check (type in ('semestre', 'annee', 'programme')),
  validation_par_credit boolean not null,
  validation_par_moyenne boolean not null,
  credit_passage numeric not null check (credit_passage >= 0),
  moyenne_passage numeric not null check (moyenne_passage >= 0),
  moyenne_eliminatoire numeric not null check (moyenne_eliminatoire >= 0),
  modifie_par text,
  modifie_le timestamptz
);
comment on table public.regles_validation is 'Règles de validation (semestre, année, programme) de chaque filière.';
create index regles_validation_filiere_id_idx on public.regles_validation (filiere_id);

create table public.types_evaluation (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null check (length(trim(intitule)) > 0),
  actif boolean not null default true
);
comment on table public.types_evaluation is 'Types d''évaluation (devoir, partiel, examen…).';
create unique index types_evaluation_code_unique on public.types_evaluation (lower(code));

-- Regroupements : quels types d'évaluation comptent comme devoir (contrôle continu) ou comme examen.
create table public.regroupements_devoir (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null check (length(trim(intitule)) > 0),
  role text not null check (role in ('devoir', 'examen')),
  type_evaluation_ids text[] not null default '{}'
);
comment on table public.regroupements_devoir is 'Regroupements des types d''évaluation en devoir ou examen pour le calcul d''un EC.';

-- Déclassement : nombre de notes requises par type d'évaluation, pour une filière, un niveau et
-- une année.
create table public.declassement_parametres (
  id text primary key default gen_random_uuid()::text,
  filiere_id text not null references public.filieres (id) on delete cascade,
  filiere text not null default '',
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  niveau text not null,
  niveau_label text not null default '',
  type_evaluation_id text not null,
  type_evaluation_label text not null default '',
  nb_notes_requis integer not null check (nb_notes_requis >= 0)
);
comment on table public.declassement_parametres is 'Paramètres de déclassement : notes requises par type d''évaluation.';
create index declassement_parametres_filiere_id_idx on public.declassement_parametres (filiere_id);
create index declassement_parametres_annee_idx on public.declassement_parametres (annee);

create trigger declassement_parametres_annee_cloturee before insert or update or delete on public.declassement_parametres
  for each row execute function private.refuser_annee_cloturee();

-- ——— 4. Journal ————————————————————————————————————————————————————————————————————————————

do $$
declare
  v_table text;
begin
  foreach v_table in array array['scolarite_valeurs_defaut', 'scolarite_configs', 'reglements_calcul',
    'methodes_calcul', 'mentions', 'regles_validation', 'types_evaluation', 'regroupements_devoir',
    'declassement_parametres']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.journaliser_modification()',
      v_table || '_journal', v_table);
  end loop;
end
$$;

-- ——— 5. Droits et règles d'accès ——————————————————————————————————————————————————————————

alter table public.scolarite_valeurs_defaut enable row level security;
alter table public.scolarite_configs enable row level security;
alter table public.reglements_calcul enable row level security;
alter table public.reglements_calcul_versions enable row level security;
alter table public.methodes_calcul enable row level security;
alter table public.mentions enable row level security;
alter table public.regles_validation enable row level security;
alter table public.types_evaluation enable row level security;
alter table public.regroupements_devoir enable row level security;
alter table public.declassement_parametres enable row level security;

grant select, insert, update, delete on
  public.scolarite_valeurs_defaut, public.scolarite_configs, public.reglements_calcul,
  public.methodes_calcul, public.mentions, public.regles_validation, public.types_evaluation,
  public.regroupements_devoir, public.declassement_parametres
  to authenticated, service_role;
-- L'historique ne se lit que : la base seule y écrit.
grant select on public.reglements_calcul_versions to authenticated, service_role;

-- Historique des règlements : lu par l'administration.
create policy reglements_calcul_versions_lecture on public.reglements_calcul_versions for select to authenticated
  using ((select private.est_administration()));

-- Lecture pour tout compte connecté actif ; écriture pour qui a l'une des pages qui gèrent la table.
do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('scolarite_valeurs_defaut', array['scol-param']),
      -- Paramétrage bulletins y choisit les méthodes de calcul de chaque filière.
      ('scolarite_configs', array['scol-param', 'bul-param']),
      ('reglements_calcul', array['scol-formules']),
      ('methodes_calcul', array['bul-param']),
      ('mentions', array['bul-param']),
      -- Paramétrage scolarité y reporte ses moyennes de passage et éliminatoires.
      ('regles_validation', array['bul-param', 'scol-param']),
      ('types_evaluation', array['bul-param']),
      ('regroupements_devoir', array['bul-param']),
      ('declassement_parametres', array['bul-param'])
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
