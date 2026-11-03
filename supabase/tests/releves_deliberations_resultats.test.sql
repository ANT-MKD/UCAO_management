-- Tests de la partie 6, lot 2 : relevés, générations de bulletins, délibérations, repêchages,
-- résultats figés, délibérations de l'année et dettes de crédit.
-- Comptes d'essai : la génération des bulletins (G), la délibération (D), la délibération annuelle
-- (A), la saisie des notes (S), le professeur Mamadou KANE (K), les étudiants Awa SECK (W) et
-- Ousmane DIALLO (O) en L1, Fatou SOW (T) en L2.
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set G '''00000000-0000-4000-8000-000000000081'''
\set D '''00000000-0000-4000-8000-000000000082'''
\set A '''00000000-0000-4000-8000-000000000083'''
\set S '''00000000-0000-4000-8000-000000000071'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
\set T '''00000000-0000-4000-8000-000000000031'''
begin;

insert into auth.users (id, email) values
  (:G, 'generation.g@comptes.edumanage.invalid'), (:D, 'deliberation.d@comptes.edumanage.invalid'), (:A, 'annuelle.a@comptes.edumanage.invalid'),
  (:S, 'saisie.s@comptes.edumanage.invalid'), (:K, 'kane.k@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid'),
  (:O, 'ousmane.o@comptes.edumanage.invalid'), (:T, 'fatou.t@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-generation', 'ROLE_GENERATION', array['bul-generation']),
  ('role-deliberation', 'ROLE_DELIBERATION', array['bul-deliberation']),
  ('role-annuelle', 'ROLE_ANNUELLE', array['bul-deliberation-annuelle']),
  ('role-saisie', 'ROLE_SAISIE', array['scol-notes-saisie']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle, cloturee) values
  ('annee-2025', '2025-2026', '2025-11-03', '2026-07-31', false, false),
  ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true, false);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse'), ('niv-l2', 'Licence 2', 'L2', 'fil-qhse');
insert into public.semestres (id, nom, alias, niveau, niveau_id) values ('sem-s1', 'Semestre 1', 'S1', 'L1', 'niv-l1'), ('sem-s3', 'Semestre 3', 'S3', 'L2', 'niv-l2');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values
  ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027'),
  ('cl-l2', 'LQHSE2-26/27', 'fil-qhse', 'niv-l2', 'L2', 40, '2026-2027'),
  ('cl-l1-25', 'LQHSE1-25/26', 'fil-qhse', 'niv-l1', 'L1', 40, '2025-2026');
update public.annees_academiques set cloturee = true where id = 'annee-2025';
insert into public.ues (id, code, libelle, credits, filiere_id, niveau, semestre) values ('ue-l1', 'UE11', 'Fondamentaux QHSE', 6, 'fil-qhse', 'L1', 'S1');
insert into public.ecs (id, code, libelle, ue_id, credits, vht) values ('ec-qualite', 'QHSE111', 'Qualité', 'ue-l1', 3, 30);
insert into public.enseignants (id, prenom, nom, matricule, grade) values ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-fatou', '2026-LQHSE-0003', 'Fatou', 'SOW', 'fil-qhse', 'cl-l2', 'L2', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:G, 'administration', 'GENERATION-1', 'Génération des bulletins', null, 'role-generation', false),
  (:D, 'administration', 'DELIB-1', 'Délibération', null, 'role-deliberation', false),
  (:A, 'administration', 'ANNUELLE-1', 'Délibération annuelle', null, 'role-annuelle', false),
  (:S, 'administration', 'SAISIE-1', 'Saisie des notes', null, 'role-saisie', false),
  (:K, 'enseignant', 'ENS-2026-100', 'Mamadou KANE', 'en-kane', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false),
  (:T, 'etudiant', '2026-LQHSE-0003', 'Fatou SOW', 'et-fatou', null, false);
-- Note publiée d'Awa et demande de correction de KANE en attente (lot 1).
insert into public.evaluations (id, annee, classe_id, semestre_id, ec_id, professeur_id, professeur, type, poids) values
  ('ev-examen', '2026-2027', 'cl-l1', 'sem-s1', 'ec-qualite', 'en-kane', 'Mamadou KANE', 'examen', 60);
insert into public.notes (id, etudiant, etudiant_id, ec, ec_id, type, note, statut, classe_id, annee, evaluation_id) values
  ('no-awa-ef', 'Awa SECK', 'et-awa', 'Qualité', 'ec-qualite', 'EF', 9, 'publie', 'cl-l1', '2026-2027', 'ev-examen');
insert into public.demandes_correction (id, note_id, etudiant_id, ec_id, classe_id, ancienne_note, nouvelle_note, motif, demande_par_id, statut) values
  ('cor-1', 'no-awa-ef', 'et-awa', 'ec-qualite', 'cl-l1', 9, 11, 'Erreur de report', :K, 'en_attente');

-- ——— Génération des bulletins et relevés ———
select tests.connecter(:G);
insert into public.bulletin_generations (id, numero, filiere_id, annee, classe_id, classe, semestre_id, semestre, statut, nb_succes, nb_echec, etudiants_concernes) values
  ('gen-1', 'GB-PROVISOIRE', 'fil-qhse', '2026-2027', 'cl-l1', 'LQHSE1-26/27', 'sem-s1', 'Semestre 1 (S1)', 'partiel', 1, 1,
   '[{"etudiantId": "et-awa", "etudiant": "Awa SECK", "statut": "succes"}, {"etudiantId": "et-ousmane", "etudiant": "Ousmane DIALLO", "statut": "echec"}]'),
  ('gen-2', 'GB-PROVISOIRE', 'fil-qhse', '2026-2027', 'cl-l1', 'LQHSE1-26/27', 'sem-s1', 'Semestre 1 (S1)', 'echec', 0, 2, '[]');
select tests.verifier((select array_agg(numero order by id) = array['GB-' || to_char(now(), 'YYYY') || '-001', 'GB-' || to_char(now(), 'YYYY') || '-002']
  from public.bulletin_generations), 'la base numérote les générations, sans doublon');
select tests.verifier(tests.lignes('update public.bulletin_generations set statut = ''succes'' where id = ''gen-1''') = 0
  and tests.lignes('delete from public.bulletin_generations where id = ''gen-1''') = 0, 'une génération est une trace : ni modifiée ni supprimée');
insert into public.releves (id, etudiant_id, etudiant, classe, semestre, statut, semestre_id, annee) values
  ('rel-awa-s1', 'et-awa', 'Awa SECK', 'LQHSE1-26/27', 'Semestre 1 (S1)', 'genere', 'sem-s1', '2026-2027'),
  ('rel-ousmane-s1', 'et-ousmane', 'Ousmane DIALLO', 'LQHSE1-26/27', 'Semestre 1 (S1)', 'genere', 'sem-s1', '2026-2027');
select tests.echoue('insert into public.releves (id, etudiant_id, statut, semestre_id, annee) values (''rel-doublon'', ''et-awa'', ''genere'', ''sem-s1'', ''2026-2027'')',
  'releves_semestre_unique', 'un seul relevé par étudiant, semestre et année');
select tests.connecter(:W);
select tests.verifier(exists (select 1 from public.notifications
  where message = 'Votre relevé de notes Semestre 1 (S1) (2026-2027) est disponible dans « Relevés & bulletins ».'), 'Awa est prévenue de son relevé');
select tests.verifier((select array_agg(id) = array['rel-awa-s1'] from public.releves) and not exists (select 1 from public.bulletin_generations),
  'Awa ne lit que son relevé, pas les générations');
select tests.connecter(:O);
select tests.verifier(not exists (select 1 from public.notifications), 'Ousmane, sans relevé (notes insuffisantes), n''est pas prévenu');

-- ——— Délibération du semestre ———
select tests.connecter(:D);
insert into public.deliberations (id, filiere_id, annee, classe_id, classe, semestre_id, semestre, statut) values
  ('delib-s1', 'fil-qhse', '2026-2027', 'cl-l1', 'LQHSE1-26/27', 'sem-s1', 'Semestre 1 (S1)', 'en_cours');
insert into public.deliberations_lignes (id, deliberation_id, etudiant_id, etudiant, ordre, moyenne, credits_obtenus, credits_total, decision_auto, decision_finale) values
  ('delib-s1:et-awa', 'delib-s1', 'et-awa', 'Awa SECK', 0, 12.4, 30, 30, 'admis', 'admis'),
  ('delib-s1:et-ousmane', 'delib-s1', 'et-ousmane', 'Ousmane DIALLO', 1, 8.1, 18, 30, 'rattrapage', 'rattrapage');
select tests.echoue('insert into public.deliberations (id, annee, classe_id, semestre_id, statut) values (''delib-bis'', ''2026-2027'', ''cl-l1'', ''sem-s1'', ''en_cours'')',
  'deliberations_classe_semestre', 'une seule délibération par classe et par semestre');
select tests.echoue('insert into public.deliberations (id, annee, classe_id, semestre_id, statut) values (''delib-25'', ''2025-2026'', ''cl-l1-25'', ''sem-s1'', ''en_cours'')',
  'clôturée', 'pas de délibération dans une année clôturée');
insert into public.repechages_ue (id, etudiant_id, classe_id, ue_id, ue_libelle, semestre_alias, moyenne, absences, motif, decide_par) values
  ('rep-1', 'et-ousmane', 'cl-l1', 'ue-l1', 'Fondamentaux QHSE', 'S1', 9.6, 0, 'Assiduité exemplaire', 'Jury');
select tests.echoue('insert into public.repechages_ue (id, etudiant_id, classe_id, ue_id, motif) values (''rep-2'', ''et-ousmane'', ''cl-l1'', ''ue-l1'', ''Encore'')',
  'repechages_ue_unique', 'une UE ne se repêche qu''une fois');
select tests.connecter(:W);
select tests.verifier((select count(*) = 1 from public.deliberations) and (select array_agg(id) = array['delib-s1:et-awa'] from public.deliberations_lignes),
  'Awa lit sa délibération et sa seule ligne, pas celle d''Ousmane');
select tests.verifier(not exists (select 1 from public.repechages_ue), 'ni le repêchage d''Ousmane');
select tests.connecter(:O);
select tests.verifier((select count(*) = 1 from public.repechages_ue), 'Ousmane lit son repêchage (il compte dans son bulletin)');
select tests.connecter(:T);
select tests.verifier(not exists (select 1 from public.deliberations) and not exists (select 1 from public.deliberations_lignes),
  'Fatou, d''une autre classe, ne lit rien de cette délibération');
select tests.connecter(:K);
select tests.verifier(not exists (select 1 from public.deliberations_lignes), 'KANE non plus');

-- ——— Clôture : tout se fige ———
select tests.connecter(:D);
select tests.echoue('insert into public.resultats_figes (id, deliberation_id, classe_id, semestre_alias, etudiant_id, bulletin) values (''cl-l1|S1|et-awa'', ''delib-s1'', ''cl-l1'', ''S1'', ''et-awa'', ''{"moyenneSession": 12.4}'')',
  'qu''à la clôture', 'les résultats ne se figent qu''à la clôture');
update public.deliberations set statut = 'cloturee' where id = 'delib-s1';
insert into public.resultats_figes (id, deliberation_id, classe_id, semestre_alias, etudiant_id, bulletin) values
  ('cl-l1|S1|et-awa', 'delib-s1', 'cl-l1', 'S1', 'et-awa', '{"moyenneSession": 12.4}'),
  ('cl-l1|S1|et-ousmane', 'delib-s1', 'cl-l1', 'S1', 'et-ousmane', '{"moyenneSession": 8.1}');
select tests.echoue('update public.deliberations_lignes set decision_finale = ''admis'' where id = ''delib-s1:et-ousmane''', 'rouvrez-la',
  'clôturée, une décision ne change plus');
select tests.echoue('update public.deliberations set seuil_override = 9 where id = ''delib-s1''', 'rouvrez-la', 'ni le seuil de la session');
select tests.echoue('delete from public.deliberations where id = ''delib-s1''', 'ne se supprime pas', 'une délibération clôturée ne se supprime pas');
select tests.verifier(tests.lignes('update public.resultats_figes set bulletin = ''{"moyenneSession": 15}'' where id = ''cl-l1|S1|et-awa''') = 0,
  'un résultat figé ne se modifie pas depuis l''application');
select tests.deconnecter();
select tests.echoue('update public.resultats_figes set bulletin = ''{"moyenneSession": 15}'' where id = ''cl-l1|S1|et-awa''', 'ne se modifie pas',
  'ni même directement dans la base');
select tests.connecter(:D);
select tests.echoue('delete from public.resultats_figes where id = ''cl-l1|S1|et-awa''', 'restent figés', 'ni ne se retire tant que le jury est clôturé');
select tests.connecter(:W);
select tests.verifier((select array_agg(etudiant_id) = array['et-awa'] from public.resultats_figes), 'Awa lit son seul bulletin figé');
select tests.connecter(:S);
select tests.echoue('update public.demandes_correction set statut = ''acceptee'', traitee_le = now() where id = ''cor-1''', 'jury de ce semestre est clôturé',
  'jury clôturé : la correction n''est pas acceptée');

-- ——— Réouverture ———
select tests.connecter(:D);
update public.deliberations set statut = 'reouverte' where id = 'delib-s1';
delete from public.resultats_figes where deliberation_id = 'delib-s1';
update public.deliberations_lignes set decision_finale = 'admis', override_raison = 'Repêché en UE11', override_modifie_par = 'Jury' where id = 'delib-s1:et-ousmane';
select tests.verifier((select decision_finale = 'admis' from public.deliberations_lignes where id = 'delib-s1:et-ousmane') and not exists (select 1 from public.resultats_figes),
  'rouverte : le jury corrige, les résultats sont libérés');
select tests.connecter(:S);
update public.demandes_correction set statut = 'acceptee', traitee_le = now() where id = 'cor-1';
select tests.verifier((select note = 11 from public.notes where id = 'no-awa-ef'), 'jury rouvert : la correction est acceptée et appliquée');

-- ——— Délibération de l'année, dettes de crédit ———
select tests.connecter(:A);
insert into public.deliberations_annuelles (id, filiere_id, annee, niveau_id, niveau, classe_id, classe, statut) values
  ('delib-an-l1', 'fil-qhse', '2026-2027', 'niv-l1', 'L1', 'cl-l1', 'LQHSE1-26/27', 'en_cours');
insert into public.deliberations_annuelles_lignes (id, deliberation_id, etudiant_id, etudiant, ordre, credits_obtenus, credits_total, ues_non_validees, decision_auto, decision_finale) values
  ('delib-an-l1:et-awa', 'delib-an-l1', 'et-awa', 'Awa SECK', 0, 60, 60, '[]', 'admis', 'admis'),
  ('delib-an-l1:et-ousmane', 'delib-an-l1', 'et-ousmane', 'Ousmane DIALLO', 1, 48, 60, '[{"ueId": "ue-l1", "ueCode": "UE11"}]', 'admis_avec_dette', 'admis_avec_dette');
update public.deliberations_annuelles set statut = 'cloturee' where id = 'delib-an-l1';
insert into public.credits_dette (id, etudiant_id, etudiant, ue_id, ue_code, ue_credits, filiere_id, niveau_origine, semestre_origine, annee, statut) values
  ('dette-1', 'et-ousmane', 'Ousmane DIALLO', 'ue-l1', 'UE11', 6, 'fil-qhse', 'L1', 'S1', '2026-2027', 'en_cours');
select tests.echoue('insert into public.credits_dette (id, etudiant_id, ue_id, annee, statut) values (''dette-2'', ''et-ousmane'', ''ue-l1'', ''2026-2027'', ''en_cours'')',
  'credits_dette_une_en_cours', 'une seule dette en cours par UE');
select tests.echoue('update public.deliberations_annuelles_lignes set decision_finale = ''admis'' where id = ''delib-an-l1:et-ousmane''', 'rouvrez-la',
  'clôturée, une décision de l''année ne change plus');
select tests.connecter(:D);
select tests.verifier(tests.lignes('update public.deliberations_annuelles set statut = ''reouverte'' where id = ''delib-an-l1''') = 0,
  'la page Délibération (semestre) ne touche pas à la délibération de l''année');
select tests.connecter(:O);
select tests.verifier((select array_agg(id) = array['dette-1'] from public.credits_dette)
  and (select array_agg(decision_finale) = array['admis_avec_dette'] from public.deliberations_annuelles_lignes),
  'Ousmane lit sa décision de l''année et sa dette');
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.credits_dette) and (select array_agg(etudiant_id) = array['et-awa'] from public.deliberations_annuelles_lignes),
  'Awa ne lit ni la dette ni la décision d''Ousmane');

rollback;
