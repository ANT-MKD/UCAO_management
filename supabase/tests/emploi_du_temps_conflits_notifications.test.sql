-- Tests de la partie 5, lot 1 bis : conflits refusés par la base, notifications de l'emploi du
-- temps envoyées par la base.
-- Comptes d'essai : la planification (E), les professeurs Mamadou KANE (K) et Ibrahima FALL (L),
-- les étudiants Awa SECK (W, L1) et Ousmane DIALLO (O, L2).
-- Les règles de conflit entre séances sont vérifiées en fin d'enregistrement ; ici, tout de suite.
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set E '''00000000-0000-4000-8000-000000000001'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set L '''00000000-0000-4000-8000-000000000013'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
begin;
set constraints all immediate;

insert into auth.users (id, email) values
  (:E, 'edt.e@comptes.edumanage.invalid'), (:K, 'kane.k@comptes.edumanage.invalid'), (:L, 'fall.l@comptes.edumanage.invalid'),
  (:W, 'awa.w@comptes.edumanage.invalid'), (:O, 'ousmane.o@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values ('role-planification', 'ROLE_PLANIFICATION', array['edt-grille']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-11-02', '2027-07-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse'), ('niv-l2', 'Licence 2', 'L2', 'fil-qhse');
insert into public.salles (id, nom) values ('salle-a1', 'RDC 1A'), ('salle-a2', 'RDC 2A'), ('salle-a3', 'RDC 3A');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values
  ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027'),
  ('cl-l2', 'LQHSE2-26/27', 'fil-qhse', 'niv-l2', 'L2', 40, '2026-2027');
insert into public.ues (id, code, libelle, credits, filiere_id, niveau, semestre) values ('ue-l1', 'UE11', 'Fondamentaux QHSE', 6, 'fil-qhse', 'L1', 'S1');
insert into public.ecs (id, code, libelle, ue_id, credits, vht) values ('ec-qualite', 'QHSE111', 'Qualité', 'ue-l1', 3, 30), ('ec-securite', 'QHSE112', 'Sécurité', 'ue-l1', 3, 30);
insert into public.enseignants (id, prenom, nom, matricule, grade) values
  ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire'), ('en-fall', 'Ibrahima', 'FALL', 'ENS-2026-101', 'Permanent');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l2', 'L2', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:E, 'administration', 'PLANIF-1', 'Planification', null, 'role-planification', false),
  (:K, 'enseignant', 'ENS-2026-100', 'Mamadou KANE', 'en-kane', null, false),
  (:L, 'enseignant', 'ENS-2026-101', 'Ibrahima FALL', 'en-fall', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false);

-- ——— Conflits ———
select tests.connecter(:E);
insert into public.seances (id, ec, ec_id, classe, classe_id, jour, semaine_du, heure_debut, heure_fin, salle, salle_id, prof, prof_id, type, annee) values
  ('se-kane-1', 'Qualité', 'ec-qualite', 'LQHSE1-26/27', 'cl-l1', 1, '2026-11-02', '08:00', '10:00', 'RDC 1A', 'salle-a1', 'Mamadou KANE', 'en-kane', 'CM', '2026-2027');
select tests.echoue('insert into public.seances (ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, salle_id, prof_id, annee) values (''ec-securite'', ''cl-l2'', 1, ''2026-11-02'', ''09:00'', ''11:00'', ''salle-a1'', ''en-fall'', ''2026-2027'')',
  'seances_salle_libre', 'la salle RDC 1A n''accueille pas deux cours en même temps');
select tests.echoue('insert into public.seances (ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, salle_id, prof_id, annee) values (''ec-securite'', ''cl-l2'', 1, ''2026-11-02'', ''09:30'', ''10:30'', ''salle-a2'', ''en-kane'', ''2026-2027'')',
  'seances_professeur_libre', 'KANE n''a pas deux cours en même temps');
select tests.echoue('insert into public.seances (ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, salle_id, prof_id, annee) values (''ec-securite'', ''cl-l1'', 1, ''2026-11-02'', ''07:00'', ''08:30'', ''salle-a2'', ''en-fall'', ''2026-2027'')',
  'seances_classe_libre', 'la classe d''Awa n''a pas deux cours en même temps');
insert into public.seances (id, ec, ec_id, classe, classe_id, jour, semaine_du, heure_debut, heure_fin, salle, salle_id, prof, prof_id, type, annee) values
  ('se-fall-1', 'Sécurité', 'ec-securite', 'LQHSE2-26/27', 'cl-l2', 1, '2026-11-02', '10:00', '12:00', 'RDC 1A', 'salle-a1', 'Ibrahima FALL', 'en-fall', 'TD', '2026-2027'),
  ('se-kane-s2', 'Qualité', 'ec-qualite', 'LQHSE1-26/27', 'cl-l1', 1, '2026-11-09', '08:00', '10:00', 'RDC 1A', 'salle-a1', 'Mamadou KANE', 'en-kane', 'CM', '2026-2027');
select tests.verifier((select count(*) = 3 from public.seances), 'un cours qui commence à la fin du précédent, ou le même créneau une autre semaine, passe');
insert into public.evenements (id, objet, date, type_id, type, salle_id, salle, heure_debut, heure_fin) values
  ('ev-jury', 'Jury de soutenance', '2026-11-04', 'ts-seed-4', 'Examen', 'salle-a2', 'RDC 2A', '14:00', '17:00');
select tests.echoue('insert into public.evenements (objet, date, type_id, salle_id, heure_debut, heure_fin) values (''Réunion'', ''2026-11-02'', ''ts-seed-4'', ''salle-a1'', ''09:00'', ''10:00'')',
  'déjà occupée par une séance', 'un événement ne prend pas une salle où il y a cours');
select tests.echoue('insert into public.seances (ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, salle, salle_id, annee) values (''ec-securite'', ''cl-l2'', 3, ''2026-11-02'', ''14:30'', ''16:00'', ''RDC 2A'', ''salle-a2'', ''2026-2027'')',
  'déjà occupée par un événement', 'un cours ne prend pas une salle réservée pour un jury');
select tests.echoue('insert into public.evenements (objet, date, type_id, salle_id, heure_debut, heure_fin) values (''Autre jury'', ''2026-11-04'', ''ts-seed-4'', ''salle-a2'', ''16:00'', ''18:00'')',
  'evenements_salle_libre', 'deux événements ne prennent pas la même salle en même temps');
select tests.echoue('update public.seances set heure_debut = ''09:00'', heure_fin = ''11:00'' where id = ''se-fall-1''',
  'seances_salle_libre', 'un déplacement aussi est refusé s''il crée un conflit');

-- ——— Notifications ———
select tests.connecter(:W);
select tests.verifier((select count(*) = 1 and min(nombre) = 2 and min(message) = 'Emploi du temps : 2 nouveaux créneaux ajoutés — dernier : Qualité le lundi 09/11 à 08:00' from public.notifications),
  'Awa est prévenue des deux créneaux de sa classe, en une notification : « 2 nouveaux créneaux ajoutés »');
update public.notifications set lue = true;
select tests.connecter(:O);
select tests.verifier((select count(*) = 1 and min(message) = 'Emploi du temps : Sécurité le lundi 02/11 à 10:00 — RDC 1A' from public.notifications),
  'Ousmane n''est prévenu que du cours de sa classe');
select tests.connecter(:K);
select tests.verifier((select count(*) = 1 and min(nombre) = 2 and min(message) = '2 nouveaux créneaux à votre emploi du temps — dernier : Qualité — LQHSE1-26/27 — lundi 09/11 à 08:00' from public.notifications),
  'KANE est prévenu de ses nouveaux créneaux, et seulement des siens');
select tests.connecter(:E);
update public.seances set jour = 3, heure_debut = '08:00', heure_fin = '10:00', salle_id = 'salle-a3', salle = 'RDC 3A' where id = 'se-kane-1';
select tests.connecter(:W);
select tests.verifier((select message = 'Cours modifié : Qualité — lundi 02/11 à 08:00–10:00 → mercredi 04/11 à 08:00–10:00 ; salle RDC 1A → RDC 3A'
  from public.notifications where not lue),
  'Awa apprend que son cours de qualité passe au mercredi, en salle RDC 3A');
select tests.connecter(:E);
update public.seances set prof_id = 'en-fall', prof = 'Ibrahima FALL' where id = 'se-kane-1';
select tests.connecter(:K);
select tests.verifier(exists (select 1 from public.notifications where message = 'Séance modifiée : Qualité — LQHSE1-26/27 — professeur Mamadou KANE → Ibrahima FALL'),
  'KANE apprend que la séance est confiée à FALL');
select tests.connecter(:L);
select tests.verifier(exists (select 1 from public.notifications where message = 'Séance modifiée : Qualité — LQHSE1-26/27 — professeur Mamadou KANE → Ibrahima FALL'),
  'FALL aussi');
select tests.connecter(:E);
delete from public.seances where id = 'se-kane-1';
select tests.connecter(:W);
select tests.verifier(exists (select 1 from public.notifications where message = 'Cours annulé : Qualité du mercredi 04/11 à 08:00 — RDC 3A.'),
  'Awa est prévenue de l''annulation');
select tests.deconnecter();
insert into public.notifications_evenementielles (id, code, description, actif, envoyer_etudiant, envoyer_professeur)
  values ('notif-evt-edt', 'NOTIFICATION_UPDATE_EDT', 'Envoi notification après la mise à jour d''un emploi du temps', true, true, false);
select tests.connecter(:E);
insert into public.seances (id, ec, ec_id, classe, classe_id, jour, semaine_du, heure_debut, heure_fin, prof, prof_id, annee) values
  ('se-kane-2', 'Qualité', 'ec-qualite', 'LQHSE1-26/27', 'cl-l1', 2, '2026-11-02', '08:00', '10:00', 'Mamadou KANE', 'en-kane', '2026-2027');
select tests.connecter(:K);
select tests.verifier(not exists (select 1 from public.notifications where message like '%mardi 03/11%'), 'réglage « professeurs » décoché : KANE n''est pas prévenu');
select tests.connecter(:W);
select tests.verifier(exists (select 1 from public.notifications where message like '%mardi 03/11%'), 'mais Awa l''est');
select tests.deconnecter();
update public.notifications_evenementielles set actif = false where code = 'NOTIFICATION_UPDATE_EDT';
select tests.connecter(:E);
delete from public.seances where id = 'se-kane-2';
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.notifications where message like 'Cours annulé : Qualité du mardi%'), 'notification désactivée : personne n''est prévenu');
select tests.echoue('select private.envoyer_notification(''00000000-0000-4000-8000-00000000000e'', ''Faux message'')', 'permission denied',
  'un compte n''écrit pas de notification par la fonction de la base');
select tests.deconnecter();

rollback;
