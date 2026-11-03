-- Tests de la partie 7, lot 4 : décomptes des enseignants, paiements et exports comptables.
-- L'exemple de KANE : 3 séances de 2 h validées en Qualité, au taux de 10 000 F l'heure avec
-- 5 % d'abattement : 60 000 F bruts, 57 000 F nets, quel que soit ce que le poste envoie.
-- Comptes d'essai : les décomptes (D), les paiements (P), les exports (X), Mamadou KANE (K) et
-- Ibrahima FALL (L). Tout se passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set D '''00000000-0000-4000-8000-000000000024'''
\set P '''00000000-0000-4000-8000-000000000025'''
\set X '''00000000-0000-4000-8000-000000000026'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set L '''00000000-0000-4000-8000-000000000013'''
begin;

insert into auth.users (id, email) values
  (:D, 'decomptes.d@comptes.edumanage.invalid'), (:P, 'paiements.p@comptes.edumanage.invalid'), (:X, 'exports.x@comptes.edumanage.invalid'),
  (:K, 'kane.k@comptes.edumanage.invalid'), (:L, 'fall.l@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-decomptes', 'ROLE_DECOMPTES', array['fin-decompte-taux', 'fin-decompte-forfait', 'fin-decompte-terme', 'fin-decompte-liste']),
  ('role-paiements', 'ROLE_PAIEMENTS', array['fin-paiement-prof-nouveau', 'fin-paiement-prof-liste']),
  ('role-exports', 'ROLE_EXPORTS', array['fin-export']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027');
insert into public.ues (id, code, libelle, credits, filiere_id, niveau, semestre) values ('ue-l1', 'UE11', 'Fondamentaux QHSE', 6, 'fil-qhse', 'L1', 'S1');
insert into public.ecs (id, code, libelle, ue_id, credits, vht) values
  ('ec-qualite', 'QHSE111', 'Qualité', 'ue-l1', 3, 30), ('ec-securite', 'QHSE112', 'Sécurité', 'ue-l1', 3, 30), ('ec-env', 'QHSE113', 'Environnement', 'ue-l1', 3, 30);
insert into public.enseignants (id, prenom, nom, matricule, grade) values
  ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire'), ('en-fall', 'Ibrahima', 'FALL', 'ENS-2026-101', 'Permanent');
insert into public.enseignants_dossiers (id, taux_horaire) values ('en-kane', 8000), ('en-fall', 9000);
insert into public.taux_enseignants (id, teacher_id, ec_id, classe_id, annee, mode_paiement, montant, taux_abatt) values
  ('en-kane:2026-2027:ec-qualite:cl-l1', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', 'taux_horaire', 10000, 5),
  ('en-kane:2026-2027:ec-env:cl-l1', 'en-kane', 'ec-env', 'cl-l1', '2026-2027', 'forfait', 150000, 10);
insert into public.pointages (id, teacher_id, ec_id, classe_id, annee, date, heure_debut, heure_fin, type, volume_pointe, statut) values
  ('pt-1', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', '2026-11-02', '08:00', '10:00', 'CM', 2, 'valide'),
  ('pt-2', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', '2026-11-09', '08:00', '10:00', 'CM', 2, 'valide'),
  ('pt-3', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', '2026-11-16', '08:00', '10:00', 'CM', 2, 'valide'),
  ('pt-soumis', 'en-kane', 'ec-qualite', 'cl-l1', '2026-2027', '2026-11-23', '08:00', '10:00', 'CM', 2, 'soumis'),
  ('pt-fiche', 'en-kane', 'ec-securite', 'cl-l1', '2026-2027', '2026-11-03', '10:00', '12:00', 'TD', 2, 'valide'),
  ('pt-fall', 'en-fall', 'ec-qualite', 'cl-l1', '2026-2027', '2026-11-04', '14:00', '16:00', 'TD', 2, 'valide');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:D, 'administration', 'DECOMPTES-1', 'Décomptes', null, 'role-decomptes', false),
  (:P, 'administration', 'PAIEMENTS-1', 'Paiements professeurs', null, 'role-paiements', false),
  (:X, 'administration', 'EXPORTS-1', 'Comptabilité', null, 'role-exports', false),
  (:K, 'enseignant', 'KANE', 'Mamadou KANE', 'en-kane', null, false),
  (:L, 'enseignant', 'FALL', 'Ibrahima FALL', 'en-fall', null, false);

-- ——— L'exemple de KANE : 57 000 F, quoi que le poste envoie ———
select tests.connecter(:D);
insert into public.decomptes (id, reference, date, teacher_id, professeur, type, annee, montant_decompte, net_a_payer, montant_paye, statut, lignes)
  values ('dc-kane', 'DC-2026-777', '2026-11-30', 'en-kane', 'Mamadou KANE', 'taux_horaire', '2026-2027', 1, 1, 99, 'emis',
    '[{"pointageId": "pt-1", "coursLabel": "Qualité", "montantBrut": 1, "montantNet": 1},
      {"pointageId": "pt-2", "coursLabel": "Qualité", "montantBrut": 1, "montantNet": 1},
      {"pointageId": "pt-3", "coursLabel": "Qualité", "montantBrut": 1, "montantNet": 1}]');
select tests.verifier((select reference = 'DC-2026-001' and montant_decompte = 60000 and net_a_payer = 57000 and montant_paye = 0 from public.decomptes where id = 'dc-kane'),
  'décompte de KANE : 3 × 2 h × 10 000 F = 60 000 F bruts, 57 000 F nets après 5 % d''abattement — recalculé par la base');
select tests.verifier((select bool_and((l ->> 'montantNet')::numeric = 19000 and (l ->> 'abattementPct')::numeric = 5) from public.decomptes d, jsonb_array_elements(d.lignes) l where d.id = 'dc-kane'),
  'chaque ligne : 20 000 F bruts, 19 000 F nets');
select tests.echoue('insert into public.decomptes (id, reference, date, teacher_id, type, annee, statut, lignes) values (''dc-double'', ''x'', ''2026-11-30'', ''en-kane'', ''taux_horaire'', ''2026-2027'', ''emis'', ''[{"pointageId": "pt-2"}]'')',
  'déjà dans un décompte en cours', 'un pointage n''entre que dans un seul décompte en cours');
select tests.echoue('insert into public.decomptes (id, reference, date, teacher_id, type, annee, statut, lignes) values (''dc-soumis'', ''x'', ''2026-11-30'', ''en-kane'', ''taux_horaire'', ''2026-2027'', ''emis'', ''[{"pointageId": "pt-soumis"}]'')',
  'pas un pointage validé', 'un pointage pas encore validé ne se décompte pas');
select tests.echoue('insert into public.decomptes (id, reference, date, teacher_id, type, annee, statut, lignes) values (''dc-fall'', ''x'', ''2026-11-30'', ''en-kane'', ''taux_horaire'', ''2026-2027'', ''emis'', ''[{"pointageId": "pt-fall"}]'')',
  'pas un pointage validé de ce professeur', 'le pointage de FALL n''entre pas dans le décompte de KANE');
insert into public.decomptes (id, reference, date, teacher_id, type, annee, statut, lignes)
  values ('dc-fiche', 'x', '2026-11-30', 'en-kane', 'taux_horaire', '2026-2027', 'emis', '[{"pointageId": "pt-fiche"}]');
select tests.verifier((select montant_decompte = 16000 and net_a_payer = 15200 from public.decomptes where id = 'dc-fiche'),
  'cours sans taux : taux de la fiche (8 000 F) et abattement par défaut de 5 %');
insert into public.decomptes (id, reference, date, teacher_id, type, annee, statut, lignes)
  values ('dc-forfait', 'x', '2026-11-30', 'en-kane', 'forfait', '2026-2027', 'emis',
          '[{"pointageId": "en-kane:2026-2027:ec-env:cl-l1", "ecId": "ec-env", "classeId": "cl-l1", "montantBrut": 1}]');
select tests.verifier((select montant_decompte = 150000 and net_a_payer = 135000 from public.decomptes where id = 'dc-forfait'), 'forfait du cours : 150 000 F, 10 % d''abattement');
select tests.echoue('insert into public.decomptes (id, reference, date, teacher_id, type, annee, statut, lignes) values (''dc-forfait-2'', ''x'', ''2026-11-30'', ''en-kane'', ''forfait'', ''2026-2027'', ''emis'', ''[{"pointageId": "en-kane:2026-2027:ec-env:cl-l1", "ecId": "ec-env", "classeId": "cl-l1"}]'')',
  'déjà dans un décompte en cours', 'un forfait ne se décompte qu''une fois');

-- ——— Paiements ———
select tests.connecter(:P);
insert into public.paiements_decomptes (id, reference, date, decompte_id, teacher_id, professeur, montant, moyen, paye_par)
  values ('pp-1', 'PP-2026-777', '2026-12-05', 'dc-kane', 'en-kane', 'Mamadou KANE', 30000, 'Virement', 'Comptabilité');
select tests.verifier((select reference = 'PP-2026-001' and decompte_reference = 'DC-2026-001' from public.paiements_decomptes where id = 'pp-1')
    and (select montant_paye = 30000 from public.decomptes where id = 'dc-kane'),
  'paiement : numéro donné par la base ; payé sur le décompte 30 000 F');
select tests.echoue('insert into public.paiements_decomptes (id, reference, date, decompte_id, teacher_id, montant) values (''pp-trop'', ''x'', ''2026-12-06'', ''dc-kane'', ''en-kane'', 30000)',
  'dépasse le reste à payer', 'jamais au-delà du reste à payer (27 000 F)');
update public.decomptes set montant_paye = 57000 where id = 'dc-kane';
select tests.verifier((select montant_paye = 30000 from public.decomptes where id = 'dc-kane'), 'le payé envoyé par un poste est ignoré');
select tests.connecter(:D);
select tests.echoue('update public.decomptes set statut = ''annule'' where id = ''dc-kane''', 'déjà un paiement', 'un décompte payé ne s''annule pas');
select tests.connecter(:P);
update public.paiements_decomptes set annulee = true where id = 'pp-1';
select tests.verifier((select montant_paye = 0 from public.decomptes where id = 'dc-kane'), 'paiement annulé : plus rien de payé sur le décompte');
select tests.connecter(:D);
update public.decomptes set statut = 'annule' where id = 'dc-kane';
select tests.echoue('update public.decomptes set statut = ''emis'' where id = ''dc-kane''', 'il le reste', 'un décompte annulé le reste');
insert into public.decomptes (id, reference, date, teacher_id, type, annee, statut, lignes)
  values ('dc-kane-2', 'x', '2026-12-10', 'en-kane', 'taux_horaire', '2026-2027', 'emis',
          '[{"pointageId": "pt-1"}, {"pointageId": "pt-2"}, {"pointageId": "pt-3"}]');
select tests.verifier((select net_a_payer = 57000 from public.decomptes where id = 'dc-kane-2'), 'décompte annulé : ses pointages se décomptent à nouveau, toujours 57 000 F');

-- ——— Exports ———
select tests.connecter(:X);
insert into public.exports_comptables (id, reference, generee_par, periode_debut, periode_fin, categories, total_recettes, total_depenses, solde_net, nb_lignes)
  values ('exp-1', 'x', 'Comptabilité', '2026-11-01', '2026-11-30', array['encaissements', 'paiements_professeurs'], 400000, 57000, 343000, 12);
update public.exports_comptables set total_recettes = 1 where id = 'exp-1';
select tests.verifier((select reference = 'EXP-' || to_char(current_date, 'YYYY') || '-001' and total_recettes = 400000 from public.exports_comptables where id = 'exp-1'),
  'export : numéro donné par la base, puis inchangé');

-- ——— Qui lit ———
select tests.connecter(:K);
select tests.verifier((select count(*) = 4 from public.decomptes) and (select count(*) = 1 from public.paiements_decomptes), 'KANE lit ses décomptes et son paiement');
select tests.verifier(exists (select 1 from public.notifications where message like 'Nouveau décompte disponible : DC-2026-001 (57%FCFA net à payer)'),
  'KANE est prévenu de son décompte, avec son numéro définitif');
select tests.verifier(not exists (select 1 from public.exports_comptables), 'KANE ne lit pas les exports');
select tests.echoue('insert into public.decomptes (id, reference, date, teacher_id, type, annee, statut, lignes) values (''dc-k'', ''x'', ''2026-12-10'', ''en-kane'', ''taux_horaire'', ''2026-2027'', ''emis'', ''[{"pointageId": "pt-fiche"}]'')',
  'déjà dans un décompte', 'KANE ne génère pas de décompte (et ses pointages sont déjà décomptés)');
select tests.connecter(:L);
select tests.verifier(not exists (select 1 from public.decomptes) and not exists (select 1 from public.paiements_decomptes), 'FALL ne lit rien des décomptes de KANE');

rollback;
