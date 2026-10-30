-- Tests de la partie 3, lot 1 (structure académique) : qui lit et qui écrit, liens que la base
-- refuse de casser, journal automatique.
-- Comptes d'essai : l'administrateur principal (A), la scolarité limitée à filières et niveaux
-- (S), le professeur Mamadou KANE (K), l'étudiante Awa SECK (W).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-00000000000a'''
\set S '''00000000-0000-4000-8000-00000000000b'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set W '''00000000-0000-4000-8000-00000000000e'''
begin;

insert into auth.users (id, email) values
  (:A, 'adm.a@comptes.edumanage.invalid'), (:S, 'scol.s@comptes.edumanage.invalid'),
  (:K, 'kane.k@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values ('role-scolarite', 'ROLE_SCOLARITE', array['acad-filieres', 'acad-niveaux']);
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM-PRINCIPAL', 'Fatou DIOP', null, null, false),
  (:S, 'administration', 'SCOL-1', 'Scolarité', null, 'role-scolarite', false),
  (:K, 'enseignant', 'PROF-KANE', 'Mamadou KANE', 'en-kane', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false);
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values
  ('annee-2026', '2026-2027', '2026-11-02', '2027-07-31', true);

-- ——— Structure ———
select tests.verifier(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind = 'r' and not c.relrowsecurity
), 'règles d''accès (RLS) actives sur toutes les tables, dont la structure académique');
select tests.verifier(not exists (
  select 1 from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.contype = 'f' and c.connamespace in ('public'::regnamespace)
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and a.attnum = any (i.indkey))
), 'chaque clé étrangère a son index');
select tests.verifier((select count(*) = 11 from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where t.tgname like '%\_journal' and not t.tgisinternal and c.relname in ('cycles', 'entites', 'categories_cours',
      'filieres', 'niveaux', 'semestres', 'salles', 'classes', 'ues', 'ecs', 'annees_academiques')),
  'les onze tables de la structure (années comprises) sont journalisées');

-- ——— L'administrateur principal construit la structure ———
select tests.connecter(:A);
insert into public.cycles (id, code, intitule, ordre) values ('cy-lic', 'LICENCE', 'Licence', 1);
insert into public.entites (id, code, intitule) values ('ent-isae', 'ISAE', 'Institut supérieur');
insert into public.categories_cours (id, code, intitule) values ('cat-obl', 'OBL', 'Obligatoire');
insert into public.filieres (id, code, nom, cycle_id, cycle, entite_id, entite, annees_actives)
  values ('fil-qhse', 'LQHSE', 'Licence QHSE', 'cy-lic', 'Licence', 'ent-isae', 'Institut supérieur', array['2026-2027']);
insert into public.niveaux (id, nom, alias, cycle, cycle_id, filiere, filiere_id)
  values ('niv-l1', 'Licence 1', 'L1', 'Licence', 'cy-lic', 'LQHSE', 'fil-qhse');
insert into public.semestres (id, nom, alias, niveau, niveau_id, filiere) values ('sem-s1', 'Semestre 1', 'S1', 'L1', 'niv-l1', 'LQHSE');
insert into public.salles (id, nom, type, capacite, equipements) values ('salle-a1', 'RDC 1A', 'Salle de cours', 40, array['Vidéoprojecteur']);
insert into public.classes (id, nom, filiere, filiere_id, niveau, niveau_id, max, annee, salle_par_defaut_id)
  values ('cl-l1', 'LQHSE1-26/27', 'LQHSE', 'fil-qhse', 'L1', 'niv-l1', 40, '2026-2027', 'salle-a1');
insert into public.ues (id, code, libelle, credits, filiere, filiere_id, niveau, semestre, type)
  values ('ue-mgt', 'UE-MGT', 'Management de la qualité', 6, 'LQHSE', 'fil-qhse', 'L1', 'S1', 'Obligatoire');
insert into public.ecs (id, code, libelle, ue, ue_id, credits, vol_cm, vol_td, vht, responsable)
  values ('ec-smq', 'SMQ', 'Système de management', 'UE-MGT', 'ue-mgt', 3, 20, 10, 45, 'Mamadou KANE');
select tests.verifier((select count(*) = 1 from public.classes), 'l''administrateur principal crée filière, niveau, semestre, salle, classe, UE et EC');
select tests.deconnecter();
select tests.verifier((select count(*) >= 10 from public.journal_audit where acteur = :A and action like 'insert\_%'),
  'chaque création est inscrite au journal au nom de l''administrateur');
select tests.verifier((select details = 'LQHSE' from public.journal_audit where action = 'insert_filieres'),
  'le journal retient le code de la filière créée');

-- ——— Liens que la base refuse de casser ———
select tests.connecter(:A);
select tests.echoue('delete from public.filieres where id = ''fil-qhse''', 'foreign key', 'une filière qui a des niveaux ne se supprime pas');
select tests.echoue('delete from public.niveaux where id = ''niv-l1''', 'foreign key', 'un niveau qui a des semestres et des classes ne se supprime pas');
select tests.echoue('delete from public.salles where id = ''salle-a1''', 'foreign key', 'une salle par défaut d''une classe ne se supprime pas');
select tests.echoue('delete from public.cycles where id = ''cy-lic''', 'foreign key', 'un cycle utilisé ne se supprime pas');
select tests.echoue('insert into public.classes (nom, filiere_id, niveau_id, max, annee) values (''X'', ''fil-qhse'', ''niv-l1'', 30, ''2030-2031'')',
  'foreign key', 'une classe ne se crée pas dans une année qui n''existe pas');
select tests.echoue('insert into public.niveaux (nom, alias, filiere_id) values (''Licence 2'', ''L2'', ''fil-inconnue'')',
  'foreign key', 'un niveau se rattache à une filière qui existe');
select tests.echoue('insert into public.classes (nom, filiere_id, niveau_id, max, annee) values (''X'', ''fil-qhse'', ''niv-l1'', 500, ''2026-2027'')',
  'check constraint', 'une classe compte entre 1 et 200 places');
select tests.echoue('update public.salles set statut = ''detruite''', 'check constraint', 'le statut d''une salle reste dans la liste');
select tests.deconnecter();
select tests.echoue('delete from public.annees_academiques where libelle = ''2026-2027''', 'foreign key', 'une année qui a des classes ne se supprime pas');
select tests.connecter(:A);
delete from public.ues where id = 'ue-mgt';
select tests.verifier(not exists (select 1 from public.ecs where id = 'ec-smq'), 'une UE inutilisée part avec ses EC');
delete from public.classes where id = 'cl-l1';
delete from public.semestres where id = 'sem-s1';
delete from public.niveaux where id = 'niv-l1';
select tests.verifier(not exists (select 1 from public.niveaux), 'une fois vidé, un niveau se supprime');
select tests.deconnecter();
select tests.verifier((select count(*) = 5 from public.journal_audit where action like 'delete\_%' and acteur = :A)
    and exists (select 1 from public.journal_audit where action = 'delete_ecs' and details = 'SMQ'),
  'chaque suppression est journalisée (classe, semestre, niveau, UE), y compris l''EC parti avec son UE');
select tests.connecter(:A);
insert into public.niveaux (id, nom, alias, cycle, filiere, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'Licence', 'LQHSE', 'fil-qhse');
insert into public.classes (id, nom, filiere, filiere_id, niveau, niveau_id, max, annee) values ('cl-l1', 'LQHSE1-26/27', 'LQHSE', 'fil-qhse', 'L1', 'niv-l1', 40, '2026-2027');
update public.classes set cloturee = true, date_cloture = '2027-07-31' where id = 'cl-l1';
select tests.deconnecter();
update public.annees_academiques set libelle = '2026-2027' where libelle = '2026-2027';

-- ——— Qui lit, qui écrit ———
select tests.connecter(:W);
select tests.verifier((select count(*) = 1 from public.filieres) and (select count(*) = 1 from public.classes) and (select count(*) = 1 from public.salles),
  'Awa lit les filières, les classes et les salles');
select tests.echoue('insert into public.filieres (code, nom) values (''X'', ''Pirate'')', 'row-level security', 'Awa ne crée pas de filière');
with u as (update public.classes set max = 200 returning 1)
select tests.verifier((select count(*) from u) = 0, 'Awa ne modifie pas une classe');
with d as (delete from public.salles returning 1)
select tests.verifier((select count(*) from d) = 0, 'Awa ne supprime pas de salle');
select tests.connecter(:K);
select tests.verifier((select count(*) = 1 from public.niveaux), 'KANE lit les niveaux');
select tests.echoue('insert into public.ues (code, libelle, credits, filiere_id) values (''UE-X'', ''X'', 3, ''fil-qhse'')', 'row-level security',
  'KANE ne modifie pas la maquette');
select tests.connecter(:S);
insert into public.filieres (id, code, nom) values ('fil-gl', 'LGL', 'Licence Génie logiciel');
update public.niveaux set credits_requis_entree = 0 where id = 'niv-l1';
select tests.verifier((select count(*) = 2 from public.filieres) and (select credits_requis_entree = 0 from public.niveaux where id = 'niv-l1'),
  'la scolarité (filières et niveaux) crée une filière et règle un niveau');
select tests.echoue('insert into public.salles (nom) values (''Amphi'')', 'row-level security', 'sans la page « Salles », la scolarité ne crée pas de salle');
with u as (update public.classes set max = 10 returning 1)
select tests.verifier((select count(*) from u) = 0, 'sans la page « Classes », la scolarité ne modifie pas une classe');
select tests.anonyme();
select tests.echoue('select * from public.filieres', 'permission denied', 'un visiteur ne lit pas la structure');
select tests.deconnecter();

-- ——— Compte désactivé, portail fermé ———
update public.comptes set actif = false where id = :K;
update public.portails set ouvert = false where type_compte = 'etudiant';
select tests.connecter(:K);
select tests.verifier(not exists (select 1 from public.filieres), 'KANE désactivé ne lit plus rien');
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.classes), 'portail Étudiants fermé : Awa ne lit plus rien');
select tests.deconnecter();

rollback;
