-- Tests de la partie 4, lot 1 : fiche publique et dossier personnel des enseignants.
-- Comptes d'essai : l'administrateur principal (A), le service des professeurs (P : liste et
-- ajout), la comptabilité des vacations (V), les professeurs Mamadou KANE (K) et Ibrahima FALL
-- (L), l'étudiante Awa SECK (W).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-00000000000a'''
\set P '''00000000-0000-4000-8000-000000000011'''
\set V '''00000000-0000-4000-8000-000000000012'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set L '''00000000-0000-4000-8000-000000000013'''
\set W '''00000000-0000-4000-8000-00000000000e'''
begin;

insert into auth.users (id, email) values
  (:A, 'adm.a@comptes.edumanage.invalid'), (:P, 'prof.p@comptes.edumanage.invalid'), (:V, 'vac.v@comptes.edumanage.invalid'),
  (:K, 'kane.k@comptes.edumanage.invalid'), (:L, 'fall.l@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-professeurs', 'ROLE_PROFESSEURS', array['prof-liste', 'prof-ajouter']),
  ('role-vacations', 'ROLE_VACATIONS', array['prof-vacations']);
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM-PRINCIPAL', 'Fatou DIOP', null, null, false),
  (:P, 'administration', 'PROF-SERVICE', 'Service des professeurs', null, 'role-professeurs', false),
  (:V, 'administration', 'VAC-1', 'Vacations', null, 'role-vacations', false),
  (:K, 'enseignant', 'ENS-2026-100', 'Mamadou KANE', 'en-kane', null, false),
  (:L, 'enseignant', 'ENS-2026-101', 'Ibrahima FALL', 'en-fall', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false);

-- ——— Le service des professeurs crée les fiches ———
select tests.connecter(:P);
insert into public.enseignants (id, prenom, nom, matricule, sexe, grade, specialite, specialites) values
  ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'M', 'Vacataire', 'QHSE', array['QHSE', 'Management']),
  ('en-fall', 'Ibrahima', 'FALL', 'ENS-2026-101', 'M', 'Permanent', 'Génie logiciel', array['Génie logiciel']);
insert into public.enseignants_dossiers (id, telephone, email, cni, rib, diplomes, taux_horaire) values
  ('en-kane', '77 000 00 01', 'm.kane@ucao.edu', '1 234 1980 00012', 'SN012 01201 000000000001 01', array['Master QHSE'], 10000),
  ('en-fall', '77 000 00 03', 'i.fall@ucao.edu', '1 765 1975 00034', 'SN012 01201 000000000003 03', array['Doctorat'], 0);
select tests.echoue('insert into public.enseignants (prenom, nom, matricule, grade) values (''Awa'', ''DIOP'', ''ens-2026-100'', ''Vacataire'')', 'duplicate key',
  'un matricule d''enseignant n''existe qu''une fois (c''est son identifiant de connexion)');
select tests.echoue('insert into public.enseignants (prenom, nom, matricule, grade) values (''X'', ''Y'', ''ENS-2026-199'', ''Bénévole'')', 'check constraint',
  'le grade reste permanent, vacataire ou contractuel');
select tests.echoue('insert into public.enseignants_dossiers (id) values (''en-fantome'')', 'foreign key',
  'un dossier appartient à une fiche qui existe');
select tests.echoue('update public.enseignants_dossiers set taux_horaire = -1 where id = ''en-kane''', 'check constraint',
  'un taux horaire n''est jamais négatif');

-- ——— Qui lit quoi ———
select tests.connecter(:W);
select tests.verifier((select count(*) = 2 from public.enseignants), 'Awa lit les noms de ses professeurs');
select tests.verifier(not exists (select 1 from public.enseignants_dossiers), 'Awa ne lit aucun dossier de professeur (téléphone, CNI, RIB)');
select tests.connecter(:K);
select tests.verifier((select array_agg(id) = array['en-kane'] from public.enseignants_dossiers), 'KANE lit son propre dossier, pas celui de FALL');
select tests.echoue('update public.enseignants_dossiers set rib = ''SN000 PIRATE''', 'votre photo', 'KANE ne change pas lui-même son RIB');
with u as (update public.enseignants set grade = 'Permanent' returning 1)
select tests.verifier((select count(*) from u) = 0, 'KANE ne se donne pas un autre grade');
select tests.connecter(:V);
select tests.verifier((select taux_horaire = 10000 from public.enseignants_dossiers where id = 'en-kane'), 'les vacations lisent le taux de KANE');
with u as (update public.enseignants_dossiers set taux_horaire = 50000 returning 1)
select tests.verifier((select count(*) from u) = 0, 'les vacations ne modifient pas un dossier');
select tests.connecter(:L);
select tests.echoue('insert into public.enseignants (prenom, nom, matricule, grade) values (''Faux'', ''PROF'', ''ENS-2026-150'', ''Vacataire'')', 'row-level security',
  'un professeur ne crée pas de fiche');

-- ——— Journal, suppression, visiteurs ———
select tests.connecter(:A);
insert into public.enseignants (id, prenom, nom, matricule, grade) values ('en-tmp', 'Essai', 'TEMPORAIRE', 'ENS-2026-190', 'Contractuel');
insert into public.enseignants_dossiers (id, rib) values ('en-tmp', 'SN000');
delete from public.enseignants where id = 'en-tmp';
select tests.verifier(not exists (select 1 from public.enseignants_dossiers where id = 'en-tmp'), 'une fiche supprimée emporte son dossier');
select tests.deconnecter();
select tests.verifier((select count(*) = 4 from public.journal_audit where acteur = :P and cible_type in ('enseignants', 'enseignants_dossiers')),
  'chaque fiche et chaque dossier créés sont journalisés au nom du service des professeurs');
select tests.anonyme();
select tests.echoue('select * from public.enseignants', 'permission denied', 'un visiteur ne lit pas les enseignants');
select tests.deconnecter();

rollback;
