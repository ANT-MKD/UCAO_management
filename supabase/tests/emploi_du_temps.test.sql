-- Tests de la partie 5, lot 1 : emploi du temps (séances et événements) et classes des professeurs.
-- Comptes d'essai : l'administrateur principal (A), la planification (E : page Emploi du temps),
-- la caisse (F), les professeurs Mamadou KANE (K) et Ibrahima FALL (L), les étudiants Awa SECK (W,
-- L1), Ousmane DIALLO (O, L2) et Fatou SOW (T, autre classe de L2).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-00000000000a'''
\set E '''00000000-0000-4000-8000-000000000001'''
\set F '''00000000-0000-4000-8000-000000000022'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set L '''00000000-0000-4000-8000-000000000013'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
\set T '''00000000-0000-4000-8000-000000000031'''
begin;

insert into auth.users (id, email) values
  (:A, 'adm.a@comptes.edumanage.invalid'), (:E, 'edt.e@comptes.edumanage.invalid'), (:F, 'caisse.f@comptes.edumanage.invalid'),
  (:K, 'kane.k@comptes.edumanage.invalid'), (:L, 'fall.l@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid'),
  (:O, 'ousmane.o@comptes.edumanage.invalid'), (:T, 'fatou.t@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-planification', 'ROLE_PLANIFICATION', array['edt-grille']),
  ('role-caisse', 'ROLE_CAISSE', array['fin-quittance-nouvelle']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle, cloturee) values
  ('annee-2025', '2025-2026', '2025-11-03', '2026-07-31', false, false),
  ('annee-2026', '2026-2027', '2026-11-02', '2027-07-31', true, false);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse'), ('niv-l2', 'Licence 2', 'L2', 'fil-qhse');
insert into public.salles (id, nom) values ('salle-a1', 'RDC 1A'), ('salle-a2', 'RDC 2A');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values
  ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027'),
  ('cl-l2', 'LQHSE2-26/27', 'fil-qhse', 'niv-l2', 'L2', 40, '2026-2027'),
  ('cl-l2b', 'LQHSE2B-26/27', 'fil-qhse', 'niv-l2', 'L2', 40, '2026-2027'),
  ('cl-l1-25', 'LQHSE1-25/26', 'fil-qhse', 'niv-l1', 'L1', 40, '2025-2026'),
  ('cl-l1b', 'LQHSE1B-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027');
update public.annees_academiques set cloturee = true where id = 'annee-2025';
insert into public.ues (id, code, libelle, credits, filiere_id, niveau, semestre) values
  ('ue-l1', 'UE11', 'Fondamentaux QHSE', 6, 'fil-qhse', 'L1', 'S1'),
  ('ue-l2', 'UE21', 'Management', 6, 'fil-qhse', 'L2', 'S3');
insert into public.enseignants (id, prenom, nom, matricule, grade) values
  ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire'), ('en-fall', 'Ibrahima', 'FALL', 'ENS-2026-101', 'Permanent');
insert into public.ecs (id, code, libelle, ue_id, credits, vht, responsable, responsable_id) values
  ('ec-qualite', 'QHSE111', 'Qualité', 'ue-l1', 3, 30, '', null),
  ('ec-mgt', 'QHSE211', 'Management de projet', 'ue-l2', 3, 30, 'Ibrahima FALL', 'en-fall');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l2', 'L2', 'inscrit', '2026-2027'),
  ('et-fatou', '2026-LQHSE-0003', 'Fatou', 'SOW', 'fil-qhse', 'cl-l2b', 'L2', 'inscrit', '2026-2027');
insert into public.etudiants_dossiers (id, telephone) values ('et-awa', '770000001'), ('et-ousmane', '770000002'), ('et-fatou', '770000003');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM-PRINCIPAL', 'Fatou DIOP', null, null, false),
  (:E, 'administration', 'PLANIF-1', 'Planification', null, 'role-planification', false),
  (:F, 'administration', 'CAISSE-1', 'Caisse', null, 'role-caisse', false),
  (:K, 'enseignant', 'ENS-2026-100', 'Mamadou KANE', 'en-kane', null, false),
  (:L, 'enseignant', 'ENS-2026-101', 'Ibrahima FALL', 'en-fall', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false),
  (:T, 'etudiant', '2026-LQHSE-0003', 'Fatou SOW', 'et-fatou', null, false);

-- ——— La planification construit la semaine du lundi 2 novembre 2026 ———
select tests.connecter(:E);
insert into public.seances (id, ec, ec_id, classe, classe_id, jour, semaine_du, heure_debut, heure_fin, salle, salle_id, prof, prof_id, type, annee) values
  ('se-kane-1', 'Qualité', 'ec-qualite', 'LQHSE1-26/27', 'cl-l1', 1, '2026-11-02', '08:00', '10:00', 'RDC 1A', 'salle-a1', 'Mamadou KANE', 'en-kane', 'CM', '2026-2027'),
  ('se-fall-1', 'Management de projet', 'ec-mgt', 'LQHSE2-26/27', 'cl-l2', 2, '2026-11-02', '10:00', '12:00', 'RDC 2A', 'salle-a2', 'Ibrahima FALL', 'en-fall', 'TD', '2026-2027');
select tests.verifier((select count(*) = 2 from public.seances), 'la planification crée les séances de KANE et de FALL');
select tests.echoue('insert into public.seances (ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, annee) values (''ec-qualite'', ''cl-l1'', 2, ''2026-11-03'', ''08:00'', ''10:00'', ''2026-2027'')',
  'seances_semaine_du_check', 'une semaine commence un lundi');
select tests.echoue('insert into public.seances (ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, annee) values (''ec-qualite'', ''cl-l1'', 1, ''2026-11-09'', ''10:00'', ''08:00'', ''2026-2027'')',
  'seances_horaire', 'une séance finit après son début');
select tests.echoue('insert into public.seances (ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, annee) values (''ec-qualite'', ''cl-l1'', 1, ''2026-11-09'', ''8h'', ''10h'', ''2026-2027'')',
  'check constraint', 'les heures s''écrivent 08:00');
select tests.echoue('insert into public.seances (ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, prof_id, annee) values (''ec-qualite'', ''cl-l1'', 1, ''2026-11-09'', ''08:00'', ''10:00'', ''en-fantome'', ''2026-2027'')',
  'foreign key', 'une séance est confiée à un professeur qui existe');
select tests.echoue('insert into public.seances (ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, annee) values (''ec-qualite'', ''cl-l1-25'', 1, ''2025-11-03'', ''08:00'', ''10:00'', ''2025-2026'')',
  'clôturée', 'pas de séance ajoutée à une année clôturée');
update public.seances set jour = 3, heure_debut = '14:00', heure_fin = '16:00' where id = 'se-kane-1';
select tests.verifier((select jour = 3 and heure_debut = '14:00' from public.seances where id = 'se-kane-1'), 'la planification déplace la séance de KANE au mercredi');
insert into public.evenements (id, objet, date, type_id, type, classe_id, classe, salle_id, salle, heure_debut, heure_fin, surveillant) values
  ('ev-soutenance', 'Soutenances de stage', '2026-11-06', 'ts-seed-4', 'Examen', 'cl-l2', 'LQHSE2-26/27', 'salle-a2', 'RDC 2A', '08:00', '12:00', 'Ibrahima FALL');
select tests.echoue('insert into public.evenements (objet, date, type_id, heure_debut, heure_fin) values (''Réunion'', ''2026-11-06'', ''ts-inconnu'', ''08:00'', ''09:00'')',
  'foreign key', 'un événement a un type qui existe');

-- ——— Chacun ne lit que ce qui le concerne ———
select tests.connecter(:K);
select tests.verifier((select array_agg(id) = array['se-kane-1'] from public.seances), 'KANE ne lit que sa séance');
select tests.echoue('insert into public.seances (ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, prof_id, annee) values (''ec-qualite'', ''cl-l1'', 4, ''2026-11-02'', ''08:00'', ''10:00'', ''en-kane'', ''2026-2027'')',
  'row-level security', 'KANE ne se donne pas de séance');
with u as (update public.seances set heure_debut = '07:00' returning 1)
select tests.verifier((select count(*) from u) = 0, 'KANE ne déplace pas sa séance lui-même');
select tests.verifier((select array_agg(id order by id) = array['et-awa'] from public.etudiants), 'KANE lit la fiche d''Awa, de sa classe, et d''elle seule');
select tests.verifier(not exists (select 1 from public.etudiants_dossiers), 'KANE ne lit toujours aucun dossier personnel');
select tests.connecter(:L);
select tests.verifier((select array_agg(id) = array['se-fall-1'] from public.seances), 'FALL ne voit rien des cours de KANE');
select tests.verifier((select array_agg(id order by id) = array['et-fatou', 'et-ousmane'] from public.etudiants),
  'FALL lit Ousmane (sa séance) et Fatou (classe de L2 qui suit le cours dont il est responsable), pas Awa');
select tests.verifier((select count(*) = 1 from public.evenements), 'FALL voit les soutenances qu''il surveille');
select tests.connecter(:W);
select tests.verifier((select array_agg(id) = array['se-kane-1'] from public.seances), 'Awa lit l''emploi du temps de sa classe, pas celui des L2');
select tests.verifier((select count(*) = 1 from public.evenements), 'Awa voit les événements de l''établissement');
select tests.echoue('insert into public.evenements (objet, date, type_id, heure_debut, heure_fin) values (''Fête'', ''2026-11-06'', ''ts-seed-4'', ''08:00'', ''09:00'')',
  'row-level security', 'Awa ne crée pas d''événement');
select tests.connecter(:O);
select tests.verifier((select array_agg(id) = array['se-fall-1'] from public.seances), 'Ousmane lit l''emploi du temps de sa classe');
select tests.connecter(:T);
select tests.verifier(not exists (select 1 from public.seances), 'Fatou n''a pas encore de séance dans sa classe');
select tests.connecter(:F);
select tests.verifier((select count(*) = 2 from public.seances), 'l''administration (la caisse) lit toutes les séances, pour les décomptes');
with u as (update public.seances set salle_id = 'salle-a2' returning 1)
select tests.verifier((select count(*) from u) = 0, 'la caisse ne modifie pas l''emploi du temps');

-- ——— Ce qui a des séances ne se supprime plus ———
select tests.connecter(:A);
insert into public.seances (id, ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, annee) values ('se-l1b', 'ec-qualite', 'cl-l1b', 5, '2026-11-02', '08:00', '10:00', '2026-2027');
select tests.echoue('delete from public.classes where id = ''cl-l1b''', 'seances_classe_id_fkey', 'une classe qui a des séances ne se supprime pas, même sans étudiant');
delete from public.seances where id = 'se-l1b';
select tests.echoue('delete from public.ecs where id = ''ec-qualite''', 'foreign key', 'un cours qui a des séances ne se supprime pas');
select tests.echoue('delete from public.ues where id = ''ue-l1''', 'foreign key', 'une UE dont un cours a des séances ne se supprime pas');
select tests.echoue('delete from public.salles where id = ''salle-a1''', 'foreign key', 'une salle qui a des séances ne se supprime pas');
select tests.echoue('delete from public.enseignants where id = ''en-kane''', 'foreign key', 'un professeur qui a des séances ne se supprime pas');
select tests.echoue('delete from public.types_seance where id = ''ts-seed-4''', 'foreign key', 'un type utilisé par un événement ne se supprime pas');
delete from public.seances where id = 'se-kane-1';
select tests.connecter(:K);
select tests.verifier(not exists (select 1 from public.seances) and not exists (select 1 from public.etudiants),
  'séance retirée : KANE ne lit plus la fiche d''Awa');

-- ——— Journal et visiteurs ———
select tests.deconnecter();
select tests.verifier((select count(*) >= 3 from public.journal_audit where acteur = :E and cible_type = 'seances'),
  'les séances créées et déplacées sont journalisées au nom de la planification');
select tests.anonyme();
select tests.echoue('select * from public.seances', 'permission denied', 'un visiteur ne lit pas l''emploi du temps');
select tests.echoue('select * from public.evenements', 'permission denied', 'un visiteur ne lit pas les événements');
select tests.deconnecter();

rollback;
