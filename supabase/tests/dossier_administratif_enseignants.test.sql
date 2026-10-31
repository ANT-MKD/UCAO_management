-- Tests de la partie 5, lot 3 : dossier administratif des enseignants.
-- Comptes d'essai : les absences des professeurs (B : nouveau constat et absence/retard), le
-- traitement des rallonges (R), les contrats (C), la gestion des cours (G : V.H, taux, statut), les
-- vacations (V), la caisse (F), les professeurs Mamadou KANE (K) et Ibrahima FALL (L), l'étudiante
-- Awa SECK (W).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set B '''00000000-0000-4000-8000-000000000051'''
\set R '''00000000-0000-4000-8000-000000000052'''
\set C '''00000000-0000-4000-8000-000000000053'''
\set G '''00000000-0000-4000-8000-000000000054'''
\set V '''00000000-0000-4000-8000-000000000055'''
\set F '''00000000-0000-4000-8000-000000000022'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set L '''00000000-0000-4000-8000-000000000013'''
\set W '''00000000-0000-4000-8000-00000000000e'''
begin;

insert into auth.users (id, email) values
  (:B, 'absences.b@comptes.edumanage.invalid'), (:R, 'rallonges.r@comptes.edumanage.invalid'), (:C, 'contrats.c@comptes.edumanage.invalid'),
  (:G, 'cours.g@comptes.edumanage.invalid'), (:V, 'vacations.v@comptes.edumanage.invalid'), (:F, 'caisse.f@comptes.edumanage.invalid'),
  (:K, 'kane.k@comptes.edumanage.invalid'), (:L, 'fall.l@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-absences', 'ROLE_ABSENCES', array['prof-absence-nouveau', 'prof-absence-retard']),
  ('role-rallonges', 'ROLE_RALLONGES', array['prof-rallonge-traitement']),
  ('role-contrats', 'ROLE_CONTRATS', array['prof-contrat']),
  ('role-cours', 'ROLE_COURS', array['prof-vh', 'prof-taux', 'prof-statut-cours']),
  ('role-vacations', 'ROLE_VACATIONS', array['prof-vacations']),
  ('role-caisse', 'ROLE_CAISSE', array['fin-quittance-nouvelle']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle, cloturee) values
  ('annee-2025', '2025-2026', '2025-11-03', '2026-07-31', false, false),
  ('annee-2026', '2026-2027', '2026-11-02', '2027-07-31', true, false);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values
  ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027'), ('cl-l1-25', 'LQHSE1-25/26', 'fil-qhse', 'niv-l1', 'L1', 40, '2025-2026');
update public.annees_academiques set cloturee = true where id = 'annee-2025';
insert into public.ues (id, code, libelle, credits, filiere_id, niveau, semestre) values ('ue-l1', 'UE11', 'Fondamentaux QHSE', 6, 'fil-qhse', 'L1', 'S1');
insert into public.ecs (id, code, libelle, ue_id, credits, vht) values ('ec-qualite', 'QHSE111', 'Qualité', 'ue-l1', 3, 30);
insert into public.enseignants (id, prenom, nom, matricule, grade) values
  ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire'), ('en-fall', 'Ibrahima', 'FALL', 'ENS-2026-101', 'Permanent');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:B, 'administration', 'ABSENCES-1', 'Absences des professeurs', null, 'role-absences', false),
  (:R, 'administration', 'RALLONGES-1', 'Rallonges', null, 'role-rallonges', false),
  (:C, 'administration', 'CONTRATS-1', 'Contrats', null, 'role-contrats', false),
  (:G, 'administration', 'COURS-1', 'Gestion des cours', null, 'role-cours', false),
  (:V, 'administration', 'VACATIONS-1', 'Vacations', null, 'role-vacations', false),
  (:F, 'administration', 'CAISSE-1', 'Caisse', null, 'role-caisse', false),
  (:K, 'enseignant', 'ENS-2026-100', 'Mamadou KANE', 'en-kane', null, false),
  (:L, 'enseignant', 'ENS-2026-101', 'Ibrahima FALL', 'en-fall', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false);

-- ——— Absence constatée, justificatif, décision ———
select tests.connecter(:B);
insert into public.absences_enseignants (id, teacher_id, ec_id, classe_id, annee, date, type, motif, cree_par) values
  ('abs-kane', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', '2026-11-03', 'absence', 'Non présenté', 'ABSENCES-1');
select tests.connecter(:K);
select tests.verifier((select message = 'Une absence a été constatée le 03/11/2026 en Qualité — motif : Non présenté. Consultez « Mes absences ».' from public.notifications),
  'KANE est prévenu du constat');
select tests.echoue('insert into public.absences_enseignants (teacher_id, annee, date, type) values (''en-fall'', ''2026-2027'', ''2026-11-03'', ''absence'')', 'row-level security',
  'KANE ne constate pas l''absence d''un collègue');
insert into storage.objects (bucket_id, name) values ('justificatifs', 'en-kane/abs-kane/certificat.pdf');
update public.absences_enseignants set justificatif_motif = 'Rendez-vous médical', justificatif_piece_nom = 'certificat.pdf',
  justificatif_piece = 'en-kane/abs-kane/certificat.pdf', justificatif_envoye_le = now() where id = 'abs-kane';
select tests.echoue('update public.absences_enseignants set justifie = true where id = ''abs-kane''', 'qu''envoyer un justificatif', 'KANE ne se déclare pas justifié');
select tests.echoue('update public.absences_enseignants set justificatif_motif = ''Autre raison'' where id = ''abs-kane''', 'déjà en attente',
  'un seul justificatif en attente à la fois');
select tests.connecter(:B);
select tests.verifier((select message = 'Justificatif reçu de Mamadou KANE pour son absence du 03/11/2026 : Rendez-vous médical.' from public.notifications),
  'les absences des professeurs reçoivent le justificatif');
select tests.verifier(exists (select 1 from storage.objects where bucket_id = 'justificatifs'), 'et peuvent ouvrir la pièce');
select tests.connecter(:F);
select tests.verifier(exists (select 1 from public.absences_enseignants) and not exists (select 1 from storage.objects where bucket_id = 'justificatifs'),
  'la caisse voit le constat (décomptes) mais pas la pièce médicale');
select tests.connecter(:L);
select tests.verifier(not exists (select 1 from public.absences_enseignants) and not exists (select 1 from storage.objects where bucket_id = 'justificatifs'),
  'FALL ne voit rien des absences de KANE');
select tests.connecter(:B);
update public.absences_enseignants set justificatif_motif = null, justificatif_piece_nom = null, justificatif_piece = null, justificatif_envoye_le = null,
  refus_motif = 'Rendez-vous médical', refus_motif_refus = 'Pièce illisible', refus_le = now() where id = 'abs-kane';
select tests.connecter(:K);
select tests.verifier(exists (select 1 from public.notifications
  where message = 'Justificatif refusé pour votre absence du 03/11/2026 — motif : Pièce illisible. Vous pouvez en envoyer un autre depuis « Mes absences ».'),
  'KANE apprend le refus et son motif');
update public.absences_enseignants set justificatif_motif = 'Rendez-vous médical (pièce lisible)', justificatif_envoye_le = now() where id = 'abs-kane';
select tests.connecter(:B);
update public.absences_enseignants set justifie = true, refus_motif = null, refus_motif_refus = null, refus_le = null where id = 'abs-kane';
select tests.connecter(:K);
select tests.verifier(exists (select 1 from public.notifications where message = 'Justificatif accepté : votre absence du 03/11/2026 est justifié(e).'),
  'KANE apprend que son absence est justifiée');

-- ——— Rallonges ———
insert into public.rallonges (id, teacher_id, ec_id, classe_id, annee, vh_actuel, vh_supplementaire, motif, statut, origine) values
  ('rlg-1', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', 30, 4, 'Travaux pratiques supplémentaires', 'soumis', 'prof');
select tests.echoue('insert into public.rallonges (teacher_id, ec_id, classe_id, annee, vh_supplementaire, statut, origine) values (''en-kane'', ''ec-qualite'', ''cl-l1'', ''2026-2027'', 2, ''soumis'', ''prof'')',
  'rallonges_une_en_attente', 'une seule demande en attente par cours');
select tests.echoue('insert into public.rallonges (teacher_id, ec_id, classe_id, annee, vh_supplementaire, statut, origine) values (''en-kane'', ''ec-qualite'', ''cl-l1'', ''2026-2027'', 2, ''valide'', ''prof'')',
  'seule l''administration', 'KANE ne s''accorde pas de rallonge');
select tests.echoue('insert into public.rallonges (teacher_id, ec_id, classe_id, annee, vh_supplementaire, statut, origine) values (''en-fall'', ''ec-qualite'', ''cl-l1'', ''2026-2027'', 2, ''soumis'', ''prof'')',
  'row-level security', 'KANE ne demande pas pour FALL');
select tests.connecter(:R);
update public.rallonges set statut = 'valide', date_traitement = now() where id = 'rlg-1';
select tests.verifier((select nouveau_vh = 34 from public.volumes_enseignants where id = 'en-kane:2026-2027:ec-qualite:cl-l1'),
  'rallonge validée : le cours de qualité passe de 30 h à 34 h, calculé par la base');
insert into public.rallonges (id, teacher_id, ec_id, classe_id, annee, vh_actuel, vh_supplementaire, motif, statut, origine) values
  ('rlg-2', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', 30, 2, 'Rattrapage', 'soumis', 'admin');
update public.rallonges set statut = 'valide' where id = 'rlg-2';
select tests.verifier((select nouveau_vh = 36 from public.volumes_enseignants where id = 'en-kane:2026-2027:ec-qualite:cl-l1'),
  'une seconde rallonge s''ajoute au volume déjà rallongé (36 h)');
select tests.connecter(:K);
select tests.verifier(exists (select 1 from public.notifications where message = 'Votre demande de rallonge (+4h) a été validée.'), 'KANE apprend que sa rallonge est validée');

-- ——— Contrats ———
select tests.connecter(:C);
select tests.verifier((select public.attribuer_numero_contrat() = 'CTR-0001'), 'premier contrat : CTR-0001, numéroté par la base');
insert into public.contrats_enseignants (id, teacher_id, annee, date_debut, date_fin, lignes) values
  ('CTR-0001', 'en-kane', '2026-2027', '2026-11-02', '2027-07-31', '[{"ecId": "ec-qualite", "classeId": "cl-l1", "modePaiement": "forfait", "montant": 150000}]');
select tests.verifier((select public.attribuer_numero_contrat() = 'CTR-0002'), 'le suivant : CTR-0002, jamais deux fois le même');
update public.contrats_enseignants set date_fin = '2027-06-30',
  avenants = '[{"numero": 1, "motif": "Réduction du volume", "dateFinAvant": "2027-07-31", "dateFinApres": "2027-06-30"}]' where id = 'CTR-0001';
update public.contrats_enseignants set resilie = true, date_resiliation = '2027-03-01', motif_resiliation = 'Départ' where id = 'CTR-0001';
select tests.connecter(:K);
select tests.verifier(exists (select 1 from public.notifications
  where message = 'Nouveau contrat CTR-0001 (2026-2027) du 02/11/2026 au 31/07/2027 — 150' || chr(8239) || '000 F CFA. Consultez « Mon contrat ».'),
  'KANE est prévenu de son contrat, avec le montant écrit comme dans l''application');
select tests.verifier(exists (select 1 from public.notifications where message = 'Avenant n° 1 à votre contrat CTR-0001 : fin au 30/06/2027 — Réduction du volume.'),
  'puis de l''avenant');
select tests.verifier(exists (select 1 from public.notifications where message = 'Votre contrat CTR-0001 a été résilié : Départ.'), 'puis de la résiliation');
select tests.verifier((select count(*) = 1 from public.contrats_enseignants), 'KANE lit son contrat');
select tests.echoue('select public.attribuer_numero_contrat()', 'pas accès', 'KANE ne réserve pas de numéro de contrat');
select tests.connecter(:L);
select tests.verifier(not exists (select 1 from public.contrats_enseignants) and not exists (select 1 from public.rallonges)
  and not exists (select 1 from public.volumes_enseignants), 'FALL ne voit ni le contrat, ni les rallonges, ni les volumes de KANE');

-- ——— Taux, statut des cours, vacations ———
select tests.connecter(:G);
insert into public.taux_enseignants (id, teacher_id, ec_id, classe_id, annee, mode_paiement, montant, taux_abatt) values
  ('en-kane:2026-2027:ec-qualite:cl-l1', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', 'taux_horaire', 10000, 5);
insert into public.statuts_cours_enseignants (id, teacher_id, ec_id, classe_id, annee, type_comptabilisation) values
  ('en-kane:2026-2027:ec-qualite:cl-l1', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', 'normal');
select tests.echoue('insert into public.taux_enseignants (id, teacher_id, ec_id, classe_id, annee) values (''x'', ''en-fall'', ''ec-qualite'', ''cl-l1'', ''2026-2027'')',
  'taux_enseignants_id', 'un taux est rangé sous son professeur, son année et son cours');
select tests.echoue('insert into public.taux_enseignants (id, teacher_id, ec_id, classe_id, annee) values (''en-fall:2025-2026:ec-qualite:cl-l1-25'', ''en-fall'', ''ec-qualite'', ''cl-l1-25'', ''2025-2026'')',
  'clôturée', 'pas de taux ajouté à une année clôturée');
select tests.connecter(:K);
select tests.verifier((select montant = 10000 from public.taux_enseignants), 'KANE lit son taux');
with u as (update public.taux_enseignants set montant = 50000 returning 1)
select tests.verifier((select count(*) from u) = 0, 'KANE ne change pas son taux');
select tests.connecter(:V);
select tests.echoue('insert into public.vacations (mois, enseignant_id, heures_cm, heures_td, taux_horaire, montant_total, statut) values (''Novembre 2026'', ''en-kane'', 20, 4, 10000, 999999, ''valide'')',
  'vacations_montant', 'le montant d''une vacation est celui des heures × le taux');
insert into public.vacations (id, mois, enseignant, enseignant_id, modules, heures_cm, heures_td, taux_horaire, montant_total, statut) values
  ('va-kane-11', 'Novembre 2026', 'Mamadou KANE', 'en-kane', array['Qualité'], 20, 4, 10000, 240000, 'valide');
update public.vacations set statut = 'paye', moyen = 'Virement' where id = 'va-kane-11';
select tests.connecter(:K);
select tests.verifier(exists (select 1 from public.notifications where message = 'Votre vacation de Novembre 2026 a été payée (240' || chr(8239) || '000 FCFA, Virement)'),
  'KANE apprend le paiement de sa vacation');
select tests.connecter(:L);
select tests.verifier(not exists (select 1 from public.vacations) and not exists (select 1 from public.taux_enseignants), 'FALL ne voit ni la vacation ni le taux de KANE');
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.vacations) and not exists (select 1 from public.absences_enseignants) and not exists (select 1 from public.contrats_enseignants),
  'Awa ne voit rien du dossier administratif de ses professeurs');

-- ——— Journal et visiteurs ———
select tests.deconnecter();
select tests.verifier((select count(*) >= 1 from public.journal_audit where cible_type = 'volumes_enseignants' and acteur = :R),
  'le volume rallongé est journalisé au nom du traitement des rallonges');
select tests.anonyme();
select tests.echoue('select * from public.contrats_enseignants', 'permission denied', 'un visiteur ne lit pas les contrats');
select tests.echoue('select * from public.vacations', 'permission denied', 'un visiteur ne lit pas les vacations');
select tests.deconnecter();

rollback;
