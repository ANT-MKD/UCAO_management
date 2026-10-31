-- Tests de la partie 6, lot 1 : évaluations, notes, demandes de correction.
-- Comptes d'essai : la saisie des notes (S), les évaluations (V), la caisse (F), les professeurs
-- Mamadou KANE (K, cours de Qualité en L1) et Ibrahima FALL (L, cours de Management en L2), les
-- étudiants Awa SECK (W) et Ousmane DIALLO (O) en L1, Fatou SOW (T) en L2.
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set S '''00000000-0000-4000-8000-000000000071'''
\set V '''00000000-0000-4000-8000-000000000072'''
\set F '''00000000-0000-4000-8000-000000000022'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set L '''00000000-0000-4000-8000-000000000013'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
\set T '''00000000-0000-4000-8000-000000000031'''
begin;

insert into auth.users (id, email) values
  (:S, 'saisie.s@comptes.edumanage.invalid'), (:V, 'evaluations.v@comptes.edumanage.invalid'), (:F, 'caisse.f@comptes.edumanage.invalid'),
  (:K, 'kane.k@comptes.edumanage.invalid'), (:L, 'fall.l@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid'),
  (:O, 'ousmane.o@comptes.edumanage.invalid'), (:T, 'fatou.t@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-saisie', 'ROLE_SAISIE', array['scol-notes-saisie']),
  ('role-evaluations', 'ROLE_EVALUATIONS', array['scol-eval-nouvelle']),
  ('role-caisse', 'ROLE_CAISSE', array['fin-quittance-nouvelle']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle, cloturee) values
  ('annee-2025', '2025-2026', '2025-11-03', '2026-07-31', false, false),
  ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true, false);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse'), ('niv-l2', 'Licence 2', 'L2', 'fil-qhse');
insert into public.semestres (id, nom, alias, niveau, niveau_id) values ('sem-s1', 'Semestre 1', 'S1', 'L1', 'niv-l1'), ('sem-s3', 'Semestre 3', 'S3', 'L2', 'niv-l2');
insert into public.salles (id, nom) values ('salle-a1', 'RDC 1A');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values
  ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027'),
  ('cl-l2', 'LQHSE2-26/27', 'fil-qhse', 'niv-l2', 'L2', 40, '2026-2027'),
  ('cl-l1-25', 'LQHSE1-25/26', 'fil-qhse', 'niv-l1', 'L1', 40, '2025-2026');
update public.annees_academiques set cloturee = true where id = 'annee-2025';
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
  ('se-kane', 'Qualité', 'ec-qualite', 'LQHSE1-26/27', 'cl-l1', 1, '2026-11-02', '08:00', '10:00', 'RDC 1A', 'salle-a1', 'Mamadou KANE', 'en-kane', 'CM', '2026-2027'),
  ('se-fall', 'Management de projet', 'ec-mgt', 'LQHSE2-26/27', 'cl-l2', 2, '2026-11-02', '08:00', '10:00', 'RDC 1A', 'salle-a1', 'Ibrahima FALL', 'en-fall', 'TD', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:S, 'administration', 'SAISIE-1', 'Saisie des notes', null, 'role-saisie', false),
  (:V, 'administration', 'EVAL-1', 'Évaluations', null, 'role-evaluations', false),
  (:F, 'administration', 'CAISSE-1', 'Caisse', null, 'role-caisse', false),
  (:K, 'enseignant', 'ENS-2026-100', 'Mamadou KANE', 'en-kane', null, false),
  (:L, 'enseignant', 'ENS-2026-101', 'Ibrahima FALL', 'en-fall', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false),
  (:T, 'etudiant', '2026-LQHSE-0003', 'Fatou SOW', 'et-fatou', null, false);

-- ——— Évaluations ———
select tests.connecter(:V);
insert into public.evaluations (id, code, filiere_id, filiere, annee, niveau_id, niveau, classe_id, classe, semestre_id, semestre, ec_id, cours,
  professeur_id, professeur, type, poids) values
  ('ev-devoir', '100000001', 'fil-qhse', 'LQHSE', '2026-2027', 'niv-l1', 'L1', 'cl-l1', 'LQHSE1-26/27', 'sem-s1', 'S1', 'ec-qualite', 'QHSE111 — Qualité',
   'en-kane', 'Mamadou KANE', 'devoir', 40),
  ('ev-examen', '200000001', 'fil-qhse', 'LQHSE', '2026-2027', 'niv-l1', 'L1', 'cl-l1', 'LQHSE1-26/27', 'sem-s1', 'S1', 'ec-qualite', 'QHSE111 — Qualité',
   null, '', 'examen', 60);
select tests.echoue('insert into public.evaluations (annee, classe_id, ec_id, type, poids) values (''2025-2026'', ''cl-l1-25'', ''ec-qualite'', ''devoir'', 40)',
  'clôturée', 'pas d''évaluation dans une année clôturée');
select tests.echoue('insert into public.evaluations (annee, classe_id, ec_id, type, poids, session) values (''2026-2027'', ''cl-l1'', ''ec-qualite'', ''devoir'', 40, ''rattrapage'')',
  'evaluations_rattrapage', 'un rattrapage reprend un examen, jamais un devoir');
select tests.connecter(:K);
select tests.echoue('insert into public.evaluations (annee, classe_id, ec_id, type, poids) values (''2026-2027'', ''cl-l1'', ''ec-qualite'', ''devoir'', 40)',
  'row-level security', 'KANE ne crée pas d''évaluation');
select tests.verifier((select count(*) = 2 from public.evaluations) and (select private.evaluations_enseignant()) @> array['ev-devoir', 'ev-examen'],
  'KANE voit les évaluations de son cours, celle qui le désigne et celle sans professeur');
select tests.connecter(:L);
select tests.verifier(not exists (select 1 from public.evaluations), 'FALL ne voit pas les évaluations du cours de KANE');
select tests.connecter(:W);
select tests.verifier((select count(*) = 2 from public.evaluations), 'Awa voit les évaluations de sa classe (poids des moyennes)');
select tests.connecter(:T);
select tests.verifier(not exists (select 1 from public.evaluations), 'Fatou, en L2, ne les voit pas');

-- ——— Saisie et soumission par KANE ———
select tests.connecter(:K);
insert into public.notes (id, etudiant, etudiant_id, matricule, ec, ec_id, type, note, absent, statut, classe_id, annee, evaluation_id) values
  ('no-awa-cc', 'Awa SECK', 'et-awa', '2026-LQHSE-0001', 'Qualité', 'ec-qualite', 'CC', 12.5, false, 'brouillon_prof', 'cl-l1', '2026-2027', 'ev-devoir'),
  ('no-ousmane-cc', 'Ousmane DIALLO', 'et-ousmane', '2026-LQHSE-0002', 'Qualité', 'ec-qualite', 'CC', 0, true, 'brouillon_prof', 'cl-l1', '2026-2027', 'ev-devoir');
select tests.echoue('insert into public.notes (etudiant_id, ec_id, type, note, statut, classe_id, annee, evaluation_id) values (''et-awa'', ''ec-qualite'', ''EF'', 21, ''brouillon_prof'', ''cl-l1'', ''2026-2027'', ''ev-examen'')',
  'entre 0 et 20', 'une note au-dessus du barème est refusée');
select tests.echoue('insert into public.notes (etudiant_id, ec_id, type, note, absent, statut, classe_id, annee, evaluation_id) values (''et-awa'', ''ec-qualite'', ''EF'', 5, true, ''brouillon_prof'', ''cl-l1'', ''2026-2027'', ''ev-examen'')',
  'notes_absent', 'un absent compte 0');
select tests.echoue('insert into public.notes (etudiant_id, ec_id, type, note, statut, classe_id, annee, evaluation_id) values (''et-awa'', ''ec-qualite'', ''EF'', 15, ''publie'', ''cl-l1'', ''2026-2027'', ''ev-examen'')',
  'row-level security', 'KANE ne publie pas lui-même');
select tests.echoue('insert into public.notes (etudiant_id, ec_id, type, note, statut, classe_id, annee, evaluation_id) values (''et-awa'', ''ec-qualite'', ''CC'', 15, ''brouillon_prof'', ''cl-l1'', ''2026-2027'', ''ev-devoir'')',
  'notes_evaluation_unique', 'une seule note par étudiant et par évaluation');
select tests.connecter(:L);
select tests.echoue('insert into public.notes (etudiant_id, ec_id, type, note, statut, classe_id, annee, evaluation_id) values (''et-awa'', ''ec-qualite'', ''EF'', 15, ''brouillon_prof'', ''cl-l1'', ''2026-2027'', ''ev-examen'')',
  'row-level security', 'FALL ne note pas dans le cours de KANE');
select tests.verifier(not exists (select 1 from public.notes), 'FALL ne voit pas les notes du cours de KANE');
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.notes), 'Awa ne voit pas une note en brouillon');
select tests.connecter(:K);
update public.notes set statut = 'soumis_admin' where evaluation_id = 'ev-devoir';
select tests.connecter(:S);
select tests.verifier((select message from public.notifications) = '2 nouvelles notes attendent validation.',
  'la saisie des notes est prévenue, une seule notification qui compte les notes soumises');
select tests.connecter(:F);
select tests.verifier(not exists (select 1 from public.notifications), 'la caisse n''est pas prévenue');

-- ——— Validation, publication ———
select tests.connecter(:S);
update public.notes set statut = 'valide_admin' where evaluation_id = 'ev-devoir';
select tests.connecter(:K);
select tests.verifier(tests.lignes('update public.notes set note = 13 where id = ''no-awa-cc''') = 0, 'validée, la note n''est plus modifiable par KANE');
select tests.verifier(tests.lignes('delete from public.notes where id = ''no-awa-cc''') = 0, 'ni supprimable par lui');
select tests.connecter(:S);
update public.notes set statut = 'publie' where evaluation_id = 'ev-devoir';
select tests.connecter(:W);
select tests.verifier((select array_agg(note) = array[12.5] from public.notes), 'Awa voit sa note publiée, et seulement la sienne');
select tests.verifier((select message from public.notifications) = 'Nouvelle note publiée — Qualité', 'Awa est prévenue de la publication');

-- ——— Une note publiée ne change que par une correction acceptée ———
select tests.connecter(:S);
select tests.echoue('update public.notes set note = 14 where id = ''no-awa-cc''', 'demande de correction acceptée',
  'même la scolarité ne réécrit pas une note publiée');
select tests.echoue('update public.notes set statut = ''brouillon_prof'' where id = ''no-awa-cc''', 'ne revient plus en arrière',
  'une note publiée ne repasse pas en brouillon');
select tests.echoue('update public.notes set etudiant_id = ''et-ousmane'' where id = ''no-awa-cc''', 'reste attachée',
  'ni ne change d''étudiant');
select tests.connecter(:K);
insert into public.demandes_correction (id, note_id, etudiant_id, etudiant, matricule, ec_id, ec, classe_id, type_label, ancienne_note, nouvelle_note,
  motif, demande_par_id, demande_par, statut) values
  ('cor-1', 'no-awa-cc', 'et-awa', 'Awa SECK', '2026-LQHSE-0001', 'ec-qualite', 'Qualité', 'cl-l1', 'Contrôle continu', 0, 14,
   'Erreur de report : 14 sur la copie', :K, 'Mamadou KANE', 'en_attente');
select tests.verifier((select ancienne_note = 12.5 from public.demandes_correction), 'la note actuelle est prise en base, pas sur le poste');
select tests.echoue(format('insert into public.demandes_correction (note_id, etudiant_id, ec_id, classe_id, ancienne_note, nouvelle_note, motif, demande_par_id, statut) values (''no-awa-cc'', ''et-awa'', ''ec-qualite'', ''cl-l1'', 12.5, 15, ''Autre'', %L, ''en_attente'')', :K),
  'demandes_correction_une_en_attente', 'une seule demande en attente par note');
select tests.echoue(format('insert into public.demandes_correction (note_id, etudiant_id, ec_id, classe_id, ancienne_note, nouvelle_note, nouvel_absent, motif, demande_par_id, statut) values (''no-ousmane-cc'', ''et-ousmane'', ''ec-qualite'', ''cl-l1'', 0, 0, true, ''Absent'', %L, ''en_attente'')', :K),
  'identique', 'une correction change la note');
select tests.connecter(:L);
select tests.echoue(format('insert into public.demandes_correction (note_id, etudiant_id, ec_id, classe_id, ancienne_note, nouvelle_note, motif, demande_par_id, statut) values (''no-ousmane-cc'', ''et-ousmane'', ''ec-qualite'', ''cl-l1'', 0, 10, ''Copie retrouvée'', %L, ''en_attente'')', :L),
  'row-level security', 'FALL ne demande pas de correction dans le cours de KANE');
select tests.verifier(not exists (select 1 from public.demandes_correction), 'ni ne voit la demande de KANE');
select tests.connecter(:S);
select tests.verifier(exists (select 1 from public.notifications
  where message = 'Correction de note demandée par Mamadou KANE : Awa SECK — Qualité (Contrôle continu) 12,50 → 14,00.'),
  'la saisie des notes est prévenue de la demande');
select tests.echoue('update public.demandes_correction set statut = ''refusee'' where id = ''cor-1''', 'demandes_correction_refus',
  'un refus est motivé');
select tests.echoue('update public.demandes_correction set nouvelle_note = 18 where id = ''cor-1''', 'Seule la décision',
  'la scolarité ne change pas la demande du professeur');
update public.demandes_correction set statut = 'acceptee', traitee_le = now(), traitee_par = 'Saisie des notes' where id = 'cor-1';
select tests.verifier((select note = 14 from public.notes where id = 'no-awa-cc'), 'acceptée : la base corrige la note');
select tests.echoue('update public.demandes_correction set statut = ''refusee'', motif_refus = ''Finalement non'' where id = ''cor-1''', 'déjà été traitée',
  'une décision ne se reprend pas');
select tests.connecter(:K);
select tests.verifier(exists (select 1 from public.notifications
  where message = 'Votre demande de correction a été acceptée : Awa SECK — Qualité (Contrôle continu) 12,50 → 14,00.'), 'KANE apprend la décision');
select tests.connecter(:W);
select tests.verifier(exists (select 1 from public.notifications where message = 'Note corrigée — Qualité (Contrôle continu) : 12,5 → 14.')
  and (select note = 14 from public.notes), 'Awa voit sa note corrigée, avec l''ancienne et la nouvelle valeur');
select tests.verifier(not exists (select 1 from public.demandes_correction), 'Awa ne voit pas les demandes de correction');

-- ——— Refus, suppression ———
select tests.connecter(:K);
insert into public.demandes_correction (id, note_id, etudiant_id, ec_id, classe_id, ancienne_note, nouvelle_note, motif, demande_par_id, demande_par, statut,
  etudiant, ec, type_label) values
  ('cor-2', 'no-ousmane-cc', 'et-ousmane', 'ec-qualite', 'cl-l1', 0, 11, 'Copie retrouvée', :K, 'Mamadou KANE', 'en_attente', 'Ousmane DIALLO', 'Qualité', 'Contrôle continu');
select tests.connecter(:S);
update public.demandes_correction set statut = 'refusee', motif_refus = 'Absence constatée au procès-verbal', traitee_le = now() where id = 'cor-2';
select tests.verifier((select absent from public.notes where id = 'no-ousmane-cc'), 'refusée : la note ne change pas');
select tests.connecter(:K);
select tests.verifier(exists (select 1 from public.notifications
  where message = 'Votre demande de correction a été refusée : Ousmane DIALLO — Qualité (Contrôle continu) — motif : Absence constatée au procès-verbal.'),
  'KANE apprend le refus et son motif');
insert into public.notes (id, etudiant_id, etudiant, ec_id, ec, type, note, statut, classe_id, annee, evaluation_id) values
  ('no-awa-ef', 'et-awa', 'Awa SECK', 'ec-qualite', 'Qualité', 'EF', 11, 'brouillon_prof', 'cl-l1', '2026-2027', 'ev-examen');
select tests.verifier(tests.lignes('delete from public.notes where id = ''no-awa-ef''') = 1, 'KANE retire une note encore en brouillon');
select tests.connecter(:V);
select tests.verifier(tests.lignes('delete from public.evaluations where id = ''ev-devoir''') = 0, 'la page Nouvelle évaluation ne supprime pas');
select tests.connecter(:S);
select tests.verifier(tests.lignes('delete from public.evaluations where id = ''ev-devoir''') = 0, 'ni la saisie des notes');
select tests.deconnecter();
select tests.echoue('delete from public.evaluations where id = ''ev-devoir''', 'notes_evaluation_id_fkey', 'une évaluation qui a des notes ne se supprime pas');
select tests.connecter(:S);
delete from public.notes where id = 'no-awa-cc';
select tests.verifier(not exists (select 1 from public.notes where id = 'no-awa-cc') and not exists (select 1 from public.demandes_correction where id = 'cor-1'),
  'une note publiée se retire par la scolarité (avec un motif dans l''application, trace au journal), avec ses demandes');
select tests.deconnecter();
select tests.verifier(exists (select 1 from public.journal_audit where action = 'delete_notes' and cible_id = 'no-awa-cc' and acteur = :S),
  'la suppression est au journal, avec son auteur');

rollback;
