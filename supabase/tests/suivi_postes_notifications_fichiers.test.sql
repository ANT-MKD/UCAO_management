-- Tests des corrections des limites des parties 4 et 5 : compteurs de changements, notifications
-- écrites par la base (pièces, blocage, pointages, absence validée), fichiers orphelins.
-- Comptes d'essai : la direction, accès complet (A), le secrétariat qui vérifie les pièces (S), la
-- caisse (F), le traitement des pointages (P), les absences des professeurs (B), la planification
-- (E), les professeurs Mamadou KANE (K) et Ibrahima FALL (L), les étudiants Awa SECK (W) et
-- Ousmane DIALLO (O).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-00000000000a'''
\set S '''00000000-0000-4000-8000-000000000061'''
\set F '''00000000-0000-4000-8000-000000000022'''
\set P '''00000000-0000-4000-8000-000000000043'''
\set B '''00000000-0000-4000-8000-000000000051'''
\set E '''00000000-0000-4000-8000-000000000001'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set L '''00000000-0000-4000-8000-000000000013'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
begin;
-- Sur Supabase, un fichier ne se retire directement en SQL qu'avec ce réglage (le temps du test).
select set_config('storage.allow_delete_query', 'true', true);

insert into auth.users (id, email) values
  (:A, 'direction.a@comptes.edumanage.invalid'), (:S, 'pieces.s@comptes.edumanage.invalid'), (:F, 'caisse.f@comptes.edumanage.invalid'),
  (:P, 'pointage.p@comptes.edumanage.invalid'), (:B, 'absences.b@comptes.edumanage.invalid'), (:E, 'edt.e@comptes.edumanage.invalid'),
  (:K, 'kane.k@comptes.edumanage.invalid'), (:L, 'fall.l@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid'),
  (:O, 'ousmane.o@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-pieces', 'ROLE_PIECES', array['etudiants-liste']),
  ('role-caisse', 'ROLE_CAISSE', array['fin-quittance-nouvelle']),
  ('role-pointage', 'ROLE_POINTAGE', array['prof-pointage-traitement']),
  ('role-absences', 'ROLE_ABSENCES', array['prof-absence-nouveau', 'prof-absence-retard']),
  ('role-planification', 'ROLE_PLANIFICATION', array['edt-grille']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse');
insert into public.salles (id, nom) values ('salle-a1', 'RDC 1A');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027');
insert into public.ues (id, code, libelle, credits, filiere_id, niveau, semestre) values ('ue-l1', 'UE11', 'Fondamentaux QHSE', 6, 'fil-qhse', 'L1', 'S1');
insert into public.ecs (id, code, libelle, ue_id, credits, vht) values ('ec-qualite', 'QHSE111', 'Qualité', 'ue-l1', 3, 30);
insert into public.enseignants (id, prenom, nom, matricule, grade) values
  ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire'), ('en-fall', 'Ibrahima', 'FALL', 'ENS-2026-101', 'Permanent');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027');
insert into public.etudiants_dossiers (id) values ('et-awa'), ('et-ousmane');
insert into public.motifs_blocage (id, code, intitule) values ('mb-frais', 'FRAIS', 'Frais de scolarité impayés');
insert into public.seances (id, ec, ec_id, classe, classe_id, jour, semaine_du, heure_debut, heure_fin, salle, salle_id, prof, prof_id, type, annee) values
  ('se-kane', 'Qualité', 'ec-qualite', 'LQHSE1-26/27', 'cl-l1', 1, date_trunc('week', current_date)::date - 7, '08:00', '10:00', 'RDC 1A', 'salle-a1', 'Mamadou KANE', 'en-kane', 'CM', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'DIRECTION-1', 'Direction', null, null, false),
  (:S, 'administration', 'PIECES-1', 'Secrétariat', null, 'role-pieces', false),
  (:F, 'administration', 'CAISSE-1', 'Caisse', null, 'role-caisse', false),
  (:P, 'administration', 'POINTAGE-1', 'Pointage', null, 'role-pointage', false),
  (:B, 'administration', 'ABSENCES-1', 'Absences des professeurs', null, 'role-absences', false),
  (:E, 'administration', 'PLANIF-1', 'Planification', null, 'role-planification', false),
  (:K, 'enseignant', 'ENS-2026-100', 'Mamadou KANE', 'en-kane', null, false),
  (:L, 'enseignant', 'ENS-2026-101', 'Ibrahima FALL', 'en-fall', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false);

-- ——— Compteurs de changements ———
select tests.anonyme();
select tests.echoue('select public.versions_donnees()', 'permission denied', 'un visiteur non connecté ne lit pas les compteurs');
select tests.connecter(:L);
select tests.verifier((select count(*) from jsonb_object_keys(public.versions_donnees()))
  = (select count(*) from pg_catalog.pg_tables where schemaname = 'public'), 'chaque table de l''application a son compteur');
select set_config('essai.avant', public.versions_donnees()::text, true);
select tests.connecter(:P);
insert into public.pointages (id, teacher_id, ec_id, classe_id, annee, date, heure_debut, heure_fin, type, volume_pointe, statut) values
  ('ptg-1', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', '2026-11-02', '08:00', '10:00', 'CM', 2, 'soumis'),
  ('ptg-2', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', '2026-11-02', '10:00', '12:00', 'TD', 2, 'soumis');
select tests.connecter(:L);
select tests.verifier((public.versions_donnees() ->> 'pointages')::bigint > (current_setting('essai.avant')::jsonb ->> 'pointages')::bigint
  and (public.versions_donnees() ->> 'seances') = (current_setting('essai.avant')::jsonb ->> 'seances'),
  'un pointage saisi sur un autre poste change le compteur des pointages, pas celui des séances');
select tests.verifier(not exists (select 1 from public.pointages), 'le compteur ne montre rien des lignes : FALL ne lit toujours pas les pointages de KANE');

-- ——— Pointage validé ou rejeté : le professeur l'apprend ———
select tests.connecter(:P);
update public.pointages set statut = 'valide' where id = 'ptg-1';
update public.pointages set statut = 'rejete', motif_rejet = 'Séance non tenue' where id = 'ptg-2';
select tests.connecter(:K);
select tests.verifier(exists (select 1 from public.notifications where message = 'Pointage du 02/11/2026 (08:00–10:00, 2 h) validé.')
  and exists (select 1 from public.notifications where message = 'Pointage du 02/11/2026 (10:00–12:00) rejeté : Séance non tenue.'),
  'KANE apprend que son pointage est validé, et l''autre rejeté avec le motif');
select tests.connecter(:L);
select tests.verifier(not exists (select 1 from public.notifications), 'FALL ne reçoit rien des pointages de KANE');

-- ——— Pièces : dépôt, vérification ———
select tests.connecter(:W);
insert into storage.objects (bucket_id, name, owner_id) values ('pieces', 'et-awa/cni/cni-1.pdf', :W);
insert into public.pieces_etudiants (id, etudiant_id, piece, en_verification, depose_le) values ('et-awa:cni', 'et-awa', 'cni', 'et-awa/cni/cni-1.pdf', now());
select tests.connecter(:S);
select tests.verifier((select message from public.notifications) = 'Pièce à vérifier : Awa SECK (2026-LQHSE-0001) a déposé « CNI / Passeport ».',
  'le secrétariat est prévenu de la pièce déposée par Awa');
select tests.connecter(:O);
insert into storage.objects (bucket_id, name, owner_id) values ('pieces', 'et-ousmane/releveBac/releve-1.pdf', :O);
insert into public.pieces_etudiants (id, etudiant_id, piece, en_verification, depose_le) values
  ('et-ousmane:releveBac', 'et-ousmane', 'releveBac', 'et-ousmane/releveBac/releve-1.pdf', now());
select tests.connecter(:S);
select tests.verifier((select count(*) = 1 from public.notifications)
  and (select message from public.notifications) = '2 pièces à vérifier — dernière : Ousmane DIALLO (2026-LQHSE-0002), « Relevé de notes BAC ».',
  'deux dépôts tant qu''il n''a pas lu : une seule notification qui les compte');
select tests.connecter(:F);
select tests.verifier(not exists (select 1 from public.notifications), 'la caisse, qui ne vérifie pas les pièces, n''est pas prévenue');
select tests.connecter(:S);
update public.pieces_etudiants set fichier = en_verification, en_verification = null where id = 'et-awa:cni';
update public.pieces_etudiants set en_verification = null, motif_refus = 'Relevé illisible', refuse_le = now() where id = 'et-ousmane:releveBac';
select tests.connecter(:W);
select tests.verifier((select message from public.notifications)
  = 'Votre pièce « CNI / Passeport » a été acceptée : elle figure désormais comme fournie à votre dossier.', 'Awa apprend que sa CNI est acceptée');
select tests.connecter(:O);
select tests.verifier((select message from public.notifications)
  = 'Votre pièce « Relevé de notes BAC » a été refusée — motif : Relevé illisible. Vous pouvez en déposer une nouvelle depuis Mes documents.',
  'Ousmane apprend le refus et son motif');

-- ——— Fichiers orphelins : pièces ———
-- Ousmane redépose, puis remplace son relevé avant qu'il soit vérifié : l'avant-dernier n'est plus
-- désigné par rien.
insert into storage.objects (bucket_id, name, owner_id) values ('pieces', 'et-ousmane/releveBac/releve-2.pdf', :O), ('pieces', 'et-ousmane/releveBac/releve-3.pdf', :O);
update public.pieces_etudiants set en_verification = 'et-ousmane/releveBac/releve-2.pdf', motif_refus = null, refuse_le = null, depose_le = now() where id = 'et-ousmane:releveBac';
update public.pieces_etudiants set en_verification = 'et-ousmane/releveBac/releve-3.pdf' where id = 'et-ousmane:releveBac';
select tests.verifier(tests.lignes('delete from storage.objects where bucket_id = ''pieces'' and name = ''et-ousmane/releveBac/releve-2.pdf''') = 1, 'Ousmane retire le relevé qu''il a remplacé');
select tests.verifier(tests.lignes('delete from storage.objects where bucket_id = ''pieces'' and name = ''et-ousmane/releveBac/releve-3.pdf''') = 0, 'mais pas celui qui attend sa vérification');
select tests.verifier(tests.lignes('delete from storage.objects where bucket_id = ''pieces'' and name = ''et-ousmane/releveBac/releve-1.pdf''') = 1,
  'ni désigné ni vérifié, son premier relevé refusé se retire aussi');
select tests.connecter(:W);
select tests.verifier(tests.lignes('delete from storage.objects where bucket_id = ''pieces'' and name = ''et-awa/cni/cni-1.pdf''') = 0, 'Awa ne retire pas sa CNI acceptée');
select tests.connecter(:S);
select tests.verifier((select array_agg(name) = array['et-ousmane/releveBac/releve-3.pdf'] from storage.objects where bucket_id = 'pieces' and name like 'et-ousmane/%'),
  'il ne reste à Ousmane que le relevé en vérification');

-- ——— Fichiers orphelins : brouillon d'une séance annulée ———
select tests.connecter(:K);
insert into public.cahiers (id, seance_id, annee, ec, ec_id, classe_id, classe, prof, prof_id, salle, salle_id, date, heure_debut, heure_fin, type_seance,
  sujet, resume, etat_seance, statut) values
  ('cah-brouillon', 'se-kane', '2026-2027', 'Qualité', 'ec-qualite', 'cl-l1', 'LQHSE1-26/27', 'Mamadou KANE', 'en-kane', 'RDC 1A', 'salle-a1',
   date_trunc('week', current_date)::date - 7, '08:00', '10:00', 'CM', 'Norme ISO 9001', '', 'realisee', 'brouillon');
insert into storage.objects (bucket_id, name, owner_id) values ('cahiers', 'cah-brouillon/tableau-1.jpg', :K);
insert into public.cahiers_fichiers (id, cahier_id, genre, ordre, nom, type, chemin) values
  ('cah-brouillon:photo:0', 'cah-brouillon', 'photo', 0, 'Tableau', 'image/jpeg', 'cah-brouillon/tableau-1.jpg');
select tests.connecter(:E);
select tests.verifier(tests.lignes('delete from storage.objects where bucket_id = ''cahiers''') = 0,
  'tant que le brouillon existe, la planification ne retire pas sa photo');
delete from public.cahiers where id = 'cah-brouillon';
select tests.connecter(:L);
select tests.verifier(tests.lignes('delete from storage.objects where bucket_id = ''cahiers''') = 0,
  'FALL ne retire pas la photo de KANE');
select tests.connecter(:E);
select tests.verifier(tests.lignes('delete from storage.objects where bucket_id = ''cahiers'' and name = ''cah-brouillon/tableau-1.jpg''') = 1, 'séance annulée : la planification retire la photo du brouillon supprimé');

-- ——— Blocage d'un étudiant ———
select tests.connecter(:A);
update public.etudiants_dossiers set motif_blocage_id = 'mb-frais' where id = 'et-awa';
update public.etudiants_dossiers set motif_blocage_id = null where id = 'et-awa';
insert into public.notifications_evenementielles (code, description, actif, envoyer_etudiant) values
  ('NOTIFICATION_BLOCAGE_ETUDIANT', 'Envoi notification après le blocage d''un étudiant', false, true);
update public.etudiants_dossiers set motif_blocage_id = 'mb-frais' where id = 'et-ousmane';
select tests.connecter(:W);
select tests.verifier(exists (select 1 from public.notifications where message = 'Un blocage a été appliqué à votre dossier. Contactez l''administration.')
  and exists (select 1 from public.notifications where message = 'Le blocage sur votre dossier a été levé.'), 'Awa apprend son blocage puis son déblocage');
select tests.connecter(:O);
select tests.verifier(not exists (select 1 from public.notifications where message like 'Un blocage%'),
  'notification de blocage désactivée dans la communication : Ousmane n''est pas prévenu');

-- ——— Absence d'un professeur validée ———
select tests.connecter(:B);
insert into public.absences_enseignants (id, teacher_id, ec_id, classe_id, annee, date, type, duree_minutes, motif, cree_par) values
  ('abs-1', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', '2026-11-03', 'retard', 15, 'Embouteillage', 'ABSENCES-1'),
  ('abs-2', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', '2026-11-04', 'absence', null, 'Non présenté', 'ABSENCES-1');
update public.absences_enseignants set justifie = true where id = 'abs-1';
select tests.connecter(:A);
insert into public.notifications_evenementielles (code, description, actif, envoyer_professeur) values
  ('NOTIFICATION_VALIDATION_ABSENCE_PROF', 'Envoi notification après la validation de l''absence d''un professeur', true, false);
select tests.connecter(:B);
update public.absences_enseignants set justifie = true where id = 'abs-2';
select tests.connecter(:K);
select tests.verifier(exists (select 1 from public.notifications where message = 'Votre retard du 03/11/2026 a été validé(e).'),
  'KANE apprend que son retard est validé');
select tests.verifier(not exists (select 1 from public.notifications where message like 'Votre absence du 04/11/2026%'),
  'réglage sans envoi au professeur : la validation suivante ne le prévient pas');

rollback;
