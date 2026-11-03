-- Tests de la partie 5, lot 2 : cahiers de séance, présences, pointages, absences par période,
-- portefeuille de cours.
-- Comptes d'essai : le cahier de textes (C), la nouvelle assiduité (N), le traitement des
-- pointages (P), les demandes (D), la mise à jour des cours étudiants (M), les absences par
-- période (Q), la planification (E), les professeurs Mamadou KANE (K) et Ibrahima FALL (L), les
-- étudiants Awa SECK (W) et Ousmane DIALLO (O) en L1, Fatou SOW (T) en L2.
-- Séances : celle de KANE lundi dernier (déjà tenue), celle de FALL mardi dernier, et une de KANE
-- lundi prochain.
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set C '''00000000-0000-4000-8000-000000000041'''
\set N '''00000000-0000-4000-8000-000000000042'''
\set P '''00000000-0000-4000-8000-000000000043'''
\set D '''00000000-0000-4000-8000-000000000044'''
\set M '''00000000-0000-4000-8000-000000000045'''
\set Q '''00000000-0000-4000-8000-000000000046'''
\set E '''00000000-0000-4000-8000-000000000001'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set L '''00000000-0000-4000-8000-000000000013'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
\set T '''00000000-0000-4000-8000-000000000031'''
begin;

insert into auth.users (id, email) values
  (:C, 'cahiers.c@comptes.edumanage.invalid'), (:N, 'assiduite.n@comptes.edumanage.invalid'), (:P, 'pointage.p@comptes.edumanage.invalid'),
  (:D, 'demandes.d@comptes.edumanage.invalid'), (:M, 'cours.m@comptes.edumanage.invalid'), (:Q, 'periodes.q@comptes.edumanage.invalid'),
  (:E, 'edt.e@comptes.edumanage.invalid'), (:K, 'kane.k@comptes.edumanage.invalid'), (:L, 'fall.l@comptes.edumanage.invalid'),
  (:W, 'awa.w@comptes.edumanage.invalid'), (:O, 'ousmane.o@comptes.edumanage.invalid'), (:T, 'fatou.t@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-cahiers', 'ROLE_CAHIERS', array['scol-ass-cahier']),
  ('role-assiduite', 'ROLE_ASSIDUITE', array['scol-ass-nouvelle']),
  ('role-pointage', 'ROLE_POINTAGE', array['prof-pointage-traitement']),
  ('role-demandes', 'ROLE_DEMANDES', array['com-demandes']),
  ('role-cours', 'ROLE_COURS', array['scol-maj-cours-etu']),
  ('role-periodes', 'ROLE_PERIODES', array['scol-ass-periode']),
  ('role-planification', 'ROLE_PLANIFICATION', array['edt-grille']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse'), ('niv-l2', 'Licence 2', 'L2', 'fil-qhse');
insert into public.salles (id, nom) values ('salle-a1', 'RDC 1A');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values
  ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027'),
  ('cl-l2', 'LQHSE2-26/27', 'fil-qhse', 'niv-l2', 'L2', 40, '2026-2027');
insert into public.ues (id, code, libelle, credits, filiere_id, niveau, semestre) values
  ('ue-l1', 'UE11', 'Fondamentaux QHSE', 6, 'fil-qhse', 'L1', 'S1'), ('ue-l2', 'UE21', 'Management', 6, 'fil-qhse', 'L2', 'S3');
insert into public.ecs (id, code, libelle, ue_id, credits, vht) values ('ec-qualite', 'QHSE111', 'Qualité', 'ue-l1', 3, 30), ('ec-mgt', 'QHSE211', 'Management de projet', 'ue-l2', 3, 30);
insert into public.enseignants (id, prenom, nom, matricule, grade) values
  ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire'), ('en-fall', 'Ibrahima', 'FALL', 'ENS-2026-101', 'Permanent');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-fatou', '2026-LQHSE-0003', 'Fatou', 'SOW', 'fil-qhse', 'cl-l2', 'L2', 'inscrit', '2026-2027');
insert into public.seances (id, ec, ec_id, classe, classe_id, jour, semaine_du, heure_debut, heure_fin, salle, salle_id, prof, prof_id, type, annee) values
  ('se-kane', 'Qualité', 'ec-qualite', 'LQHSE1-26/27', 'cl-l1', 1, date_trunc('week', current_date)::date - 7, '08:00', '10:00', 'RDC 1A', 'salle-a1', 'Mamadou KANE', 'en-kane', 'CM', '2026-2027'),
  ('se-fall', 'Management de projet', 'ec-mgt', 'LQHSE2-26/27', 'cl-l2', 2, date_trunc('week', current_date)::date - 7, '08:00', '10:00', 'RDC 1A', 'salle-a1', 'Ibrahima FALL', 'en-fall', 'TD', '2026-2027'),
  ('se-kane-futur', 'Qualité', 'ec-qualite', 'LQHSE1-26/27', 'cl-l1', 1, date_trunc('week', current_date)::date + 7, '08:00', '10:00', 'RDC 1A', 'salle-a1', 'Mamadou KANE', 'en-kane', 'CM', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:C, 'administration', 'CAHIERS-1', 'Cahier de textes', null, 'role-cahiers', false),
  (:N, 'administration', 'ASSIDUITE-1', 'Assiduité', null, 'role-assiduite', false),
  (:P, 'administration', 'POINTAGE-1', 'Pointage', null, 'role-pointage', false),
  (:D, 'administration', 'DEMANDES-1', 'Demandes', null, 'role-demandes', false),
  (:M, 'administration', 'COURS-1', 'Cours étudiants', null, 'role-cours', false),
  (:Q, 'administration', 'PERIODES-1', 'Absences par période', null, 'role-periodes', false),
  (:E, 'administration', 'PLANIF-1', 'Planification', null, 'role-planification', false),
  (:K, 'enseignant', 'ENS-2026-100', 'Mamadou KANE', 'en-kane', null, false),
  (:L, 'enseignant', 'ENS-2026-101', 'Ibrahima FALL', 'en-fall', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false),
  (:T, 'etudiant', '2026-LQHSE-0003', 'Fatou SOW', 'et-fatou', null, false);

-- ——— KANE tient le cahier de sa séance de lundi dernier ———
select tests.connecter(:K);
insert into public.cahiers (id, seance_id, annee, ec, ec_id, classe_id, classe, prof, prof_id, salle, salle_id, date, heure_debut, heure_fin, type_seance,
  sujet, resume, etat_seance, statut) values
  ('cah-kane', 'se-kane', '2026-2027', 'Qualité', 'ec-qualite', 'cl-l1', 'LQHSE1-26/27', 'Mamadou KANE', 'en-kane', 'RDC 1A', 'salle-a1',
   date_trunc('week', current_date)::date - 7, '08:00', '10:00', 'CM', 'Norme ISO 9001', 'Principes du management de la qualité', 'realisee', 'brouillon');
insert into public.presences (id, cahier_id, etudiant_id, nom, statut, ordre) values
  ('cah-kane:et-awa', 'cah-kane', 'et-awa', 'Awa SECK', 'absent', 1), ('cah-kane:et-ousmane', 'cah-kane', 'et-ousmane', 'Ousmane DIALLO', 'present', 2);
select tests.verifier((select count(*) = 1 from public.cahiers) and (select count(*) = 2 from public.presences), 'KANE enregistre son cahier en brouillon, avec l''appel');
select tests.echoue('insert into public.cahiers (seance_id, annee, ec_id, classe_id, prof_id, date, heure_debut, heure_fin, etat_seance, statut) values (''se-fall'', ''2026-2027'', ''ec-mgt'', ''cl-l2'', ''en-kane'', date_trunc(''week'', current_date)::date - 6, ''08:00'', ''10:00'', ''realisee'', ''soumis'')',
  'pas le vôtre', 'KANE n''écrit pas le cahier d''une séance de FALL');
select tests.echoue('insert into public.cahiers (seance_id, annee, ec_id, classe_id, prof_id, date, heure_debut, heure_fin, etat_seance, statut) values (''se-kane'', ''2026-2027'', ''ec-qualite'', ''cl-l1'', ''en-kane'', current_date - 30, ''08:00'', ''10:00'', ''realisee'', ''brouillon'')',
  'décrit sa séance', 'un cahier porte la date de sa séance');
select tests.echoue('insert into public.cahiers (seance_id, annee, ec_id, classe_id, prof_id, date, heure_debut, heure_fin, etat_seance, statut) values (''se-kane-futur'', ''2026-2027'', ''ec-qualite'', ''cl-l1'', ''en-kane'', date_trunc(''week'', current_date)::date + 7, ''08:00'', ''10:00'', ''realisee'', ''soumis'')',
  'pas encore eu lieu', 'une séance de lundi prochain n''est pas déclarée réalisée à l''avance');
insert into public.cahiers (id, seance_id, annee, ec_id, classe_id, prof_id, date, heure_debut, heure_fin, etat_seance, statut) values
  ('cah-kane-futur', 'se-kane-futur', '2026-2027', 'ec-qualite', 'cl-l1', 'en-kane', date_trunc('week', current_date)::date + 7, '08:00', '10:00', 'preparee', 'soumis');
select tests.verifier(exists (select 1 from public.cahiers where id = 'cah-kane-futur'), 'mais elle peut être préparée');
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.cahiers where id = 'cah-kane') and not exists (select 1 from public.presences),
  'Awa ne voit ni le brouillon de KANE ni l''appel qu''il contient');

select tests.connecter(:K);
update public.cahiers set statut = 'soumis' where id = 'cah-kane';
select tests.echoue('update public.cahiers set statut = ''valide'' where id = ''cah-kane''', 'Seule l''administration', 'KANE ne valide pas son propre cahier');
insert into storage.objects (bucket_id, name) values ('cahiers', 'cah-kane/tableau-1.jpg');
insert into public.cahiers_fichiers (id, cahier_id, genre, ordre, nom, type, chemin) values ('cah-kane:photo:0', 'cah-kane', 'photo', 0, 'Tableau', 'image/jpeg', 'cah-kane/tableau-1.jpg');
select tests.echoue('insert into storage.objects (bucket_id, name) values (''cahiers'', ''cah-fall/intrus.jpg'')', 'row-level security',
  'KANE ne range rien dans le cahier d''un autre');

-- ——— Qui voit quoi ———
select tests.connecter(:C);
select tests.verifier((select count(*) = 1 and min(nombre) = 2
  and min(message) = format('2 cahiers de texte soumis — dernier : Qualité — LQHSE1-26/27 (%s)', to_char(date_trunc('week', current_date)::date - 7, 'DD/MM/YYYY'))
  from public.notifications), 'le cahier de textes est prévenu des cahiers soumis, en une notification');
select tests.connecter(:W);
select tests.verifier((select count(*) = 2 from public.cahiers), 'Awa lit les cahiers soumis de sa classe');
select tests.verifier((select array_agg(id) = array['cah-kane:et-awa'] and min(statut) = 'absent' from public.presences),
  'Awa lit sa seule présence (absente), pas celle d''Ousmane');
select tests.verifier((select message = format('Absence constatée en Qualité le %s', to_char(date_trunc('week', current_date)::date - 7, 'DD/MM/YYYY')) from public.notifications),
  'Awa est prévenue de son absence');
select tests.verifier(exists (select 1 from storage.objects where bucket_id = 'cahiers' and name = 'cah-kane/tableau-1.jpg')
  and exists (select 1 from public.cahiers_fichiers), 'Awa voit la photo du tableau');
select tests.connecter(:O);
select tests.verifier(not exists (select 1 from public.notifications), 'Ousmane, présent, n''est pas prévenu');
select tests.connecter(:T);
select tests.verifier(not exists (select 1 from public.cahiers) and not exists (select 1 from storage.objects where bucket_id = 'cahiers'),
  'Fatou, en L2, ne voit pas les cahiers des L1');
select tests.connecter(:L);
select tests.verifier(not exists (select 1 from public.cahiers) and not exists (select 1 from public.presences) and not exists (select 1 from public.cahiers_fichiers)
  and not exists (select 1 from storage.objects where bucket_id = 'cahiers'), 'FALL ne voit rien des cahiers de KANE');

-- ——— Validation : le cahier validé crée son pointage ———
select tests.connecter(:C);
update public.cahiers set statut = 'valide', valide_par = 'CAHIERS-1' where id = 'cah-kane';
select tests.verifier((select count(*) = 1 from public.pointages where cahier_id = 'cah-kane' and teacher_id = 'en-kane' and statut = 'soumis'
  and volume_pointe = 2 and type = 'CM' and date = date_trunc('week', current_date)::date - 7), 'un cahier validé crée son pointage : 2 h de CM pour KANE, à confirmer');
update public.cahiers set statut = 'rejete' where id = 'cah-kane';
update public.cahiers set statut = 'valide' where id = 'cah-kane';
select tests.verifier((select count(*) = 1 from public.pointages), 'valider à nouveau ne pointe pas deux fois');
select tests.connecter(:K);
select tests.verifier(exists (select 1 from public.notifications where message = format('Cahier Qualité du %s validé — 2 h transmises au pointage', to_char(date_trunc('week', current_date)::date - 7, 'DD/MM/YYYY'))),
  'KANE apprend que 2 h sont transmises au pointage');
select tests.verifier((select count(*) = 1 from public.pointages), 'KANE lit son pointage');
select tests.echoue('update public.cahiers set resume = ''Réécrit après validation'' where id = ''cah-kane''', 'il ne change plus', 'KANE ne réécrit pas un cahier validé');
with u as (update public.presences set statut = 'present' where id = 'cah-kane:et-awa' returning 1)
select tests.verifier((select count(*) from u) = 0, 'ni l''appel d''un cahier validé');
with u as (update public.pointages set volume_pointe = 10 returning 1)
select tests.verifier((select count(*) from u) = 0, 'KANE ne change pas son pointage');
select tests.connecter(:L);
select tests.verifier(not exists (select 1 from public.pointages), 'FALL ne voit rien des pointages de KANE');
select tests.connecter(:P);
update public.pointages set statut = 'valide' where cahier_id = 'cah-kane';
select tests.echoue(format('insert into public.pointages (teacher_id, ec_id, classe_id, annee, date, heure_debut, heure_fin, type, volume_pointe, statut) values (''en-kane'', ''ec-qualite'', ''cl-l1'', ''2026-2027'', %L, ''08:00'', ''10:00'', ''CM'', 2, ''soumis'')',
  date_trunc('week', current_date)::date - 7), 'pointages_creneau_unique', 'un créneau n''est pointé qu''une fois, même depuis un autre poste');

-- ——— Justification, cahier de secours ———
select tests.connecter(:D);
update public.presences set justification = 'Certificat médical' where id = 'cah-kane:et-awa';
select tests.verifier((select justification = 'Certificat médical' from public.presences where id = 'cah-kane:et-awa'), 'les demandes justifient l''absence d''Awa');
select tests.connecter(:N);
insert into public.cahiers (id, seance_id, annee, ec, ec_id, classe_id, classe, prof, prof_id, date, heure_debut, heure_fin, etat_seance, statut, resume) values
  ('cah-secours', 'se-fall', '2026-2027', 'Management de projet', 'ec-mgt', 'cl-l2', 'LQHSE2-26/27', 'Ibrahima FALL', 'en-fall', date_trunc('week', current_date)::date - 6,
   '08:00', '10:00', 'realisee', 'soumis', 'Assiduité saisie par l''administration (Assiduité) — aucun cahier de textes soumis par l''enseignant pour cette séance.');
insert into public.presences (id, cahier_id, etudiant_id, nom, statut) values ('cah-secours:et-fatou', 'cah-secours', 'et-fatou', 'Fatou SOW', 'absent');
select tests.connecter(:T);
select tests.verifier(exists (select 1 from public.notifications where message like 'Absence constatée en Management de projet%'),
  'cahier de secours de l''assiduité : Fatou est prévenue de son absence');

-- ——— Absences par période, portefeuille de cours ———
select tests.connecter(:Q);
insert into public.absences_periodes (id, etudiant_id, etudiant, matricule, classe_id, classe, annee, date_debut, date_fin, motif, justifie) values
  ('absp-awa', 'et-awa', 'Awa SECK', '2026-LQHSE-0001', 'cl-l1', 'LQHSE1-26/27', '2026-2027', current_date, current_date + 10, 'Hospitalisation', true);
select tests.echoue('insert into public.absences_periodes (etudiant_id, annee, date_debut, date_fin) values (''et-awa'', ''2026-2027'', current_date, current_date - 1)',
  'absences_periodes_dates', 'une période finit après son début');
select tests.connecter(:K);
select tests.verifier((select count(*) = 1 from public.absences_periodes), 'KANE voit l''absence déclarée d''Awa pour faire l''appel');
select tests.connecter(:L);
select tests.verifier(not exists (select 1 from public.absences_periodes), 'FALL ne la voit pas (pas sa classe)');
select tests.connecter(:O);
select tests.verifier(not exists (select 1 from public.absences_periodes), 'Ousmane ne voit pas celle d''Awa');
select tests.connecter(:K);
select tests.verifier(not exists (select 1 from public.etudiants where id = 'et-fatou'), 'KANE ne lit pas la fiche de Fatou, en L2');
select tests.connecter(:M);
insert into public.portefeuille_cours (id, etudiant_id, etudiant, matricule, classe_id, classe, ec_id, ec, action, date_action) values
  ('pf-fatou-1', 'et-fatou', 'Fatou SOW', '2026-LQHSE-0003', 'cl-l1', 'LQHSE1-26/27', 'ec-qualite', 'Qualité', 'ajout', current_date - 2);
select tests.connecter(:K);
select tests.verifier(exists (select 1 from public.etudiants where id = 'et-fatou') and exists (select 1 from public.portefeuille_cours),
  'Fatou ajoutée à son cours de qualité : KANE lit sa fiche pour l''appel');
select tests.connecter(:M);
insert into public.portefeuille_cours (id, etudiant_id, classe_id, ec_id, action, date_action) values ('pf-fatou-2', 'et-fatou', 'cl-l1', 'ec-qualite', 'retrait', current_date);
select tests.connecter(:K);
select tests.verifier(not exists (select 1 from public.etudiants where id = 'et-fatou'), 'retirée ensuite : KANE ne lit plus sa fiche');
select tests.echoue('insert into public.portefeuille_cours (etudiant_id, classe_id, ec_id, action) values (''et-awa'', ''cl-l1'', ''ec-qualite'', ''retrait'')', 'row-level security',
  'KANE ne retire pas lui-même un étudiant de son cours');

-- ——— Ce qui a un cahier ne se supprime plus ; journal et visiteurs ———
select tests.connecter(:E);
select tests.echoue('delete from public.seances where id = ''se-kane''', 'foreign key', 'une séance qui a un cahier ne s''annule plus');
select tests.deconnecter();
select tests.verifier((select count(*) >= 1 from public.journal_audit where cible_type = 'pointages' and acteur = :C),
  'le pointage créé à la validation est journalisé au nom du cahier de textes');
select tests.anonyme();
select tests.echoue('select * from public.cahiers', 'permission denied', 'un visiteur ne lit pas les cahiers');
select tests.echoue('select * from public.pointages', 'permission denied', 'un visiteur ne lit pas les pointages');
select tests.deconnecter();

rollback;
