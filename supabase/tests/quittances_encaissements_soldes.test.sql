-- Tests de la partie 7, lot 1 : quittances, encaissements, frais des étudiants et soldes.
-- Comptes d'essai : la caisse (F), le secrétariat de scolarité sans page Finances (S), Mamadou
-- KANE (K, professeur), les étudiants Awa SECK (W) et Ousmane DIALLO (O).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set F '''00000000-0000-4000-8000-000000000022'''
\set S '''00000000-0000-4000-8000-000000000071'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
begin;

insert into auth.users (id, email) values
  (:F, 'caisse.f@comptes.edumanage.invalid'), (:S, 'saisie.s@comptes.edumanage.invalid'), (:K, 'kane.k@comptes.edumanage.invalid'),
  (:W, 'awa.w@comptes.edumanage.invalid'), (:O, 'ousmane.o@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-caisse', 'ROLE_CAISSE', array['fin-quittance-nouvelle']),
  ('role-saisie', 'ROLE_SAISIE', array['scol-notes-saisie']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027');
insert into public.types_frais (id, code, intitule) values ('tf-ape', 'APE', 'Association des Parents d''Étudiants (APE)');
insert into public.enseignants (id, prenom, nom, matricule, grade) values ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:F, 'administration', 'CAISSE-1', 'Caisse', null, 'role-caisse', false),
  (:S, 'administration', 'SAISIE-1', 'Scolarité', null, 'role-saisie', false),
  (:K, 'enseignant', 'KANE', 'Mamadou KANE', 'en-kane', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false);

-- ——— Numéros donnés par la base ———
select tests.connecter(:F);
insert into public.quittances (id, numero_recu, date, etudiant_id, etudiant, classe, rubrique, lignes, montant, reference, statut)
  values ('q-awa', 'RECU-2026-999', '2026-10-15', 'et-awa', 'Awa SECK', 'LQHSE1-26/27', 'Facture unique (2 rubriques)',
          '[{"label": "Scolarité", "montant": 90000}, {"label": "APE", "montant": 10000}]', 50000, 'RECU-2026-999', 'paye');
select tests.verifier((select numero_recu = 'RECU-2026-001' and reference = 'RECU-2026-001' from public.quittances where id = 'q-awa'),
  'quittance : numéro donné par la base, la référence qui reprenait le provisoire reprend le définitif');
select tests.verifier((select montant = 0 from public.quittances where id = 'q-awa'), 'le montant réglé envoyé par le poste est ignoré : il arrive par un mouvement');
insert into public.quittances (id, numero_recu, date, etudiant_id, lignes, reference, statut)
  values ('q-ousmane', 'RECU-2026-999', '2026-10-16', 'et-ousmane', '[{"label": "Scolarité", "montant": 90000}]', 'Virement 4521', 'paye');
select tests.verifier((select numero_recu = 'RECU-2026-002' and reference = 'Virement 4521' from public.quittances where id = 'q-ousmane'),
  'numéro suivant, sans doublon ; une référence saisie est gardée');
insert into public.quittances (id, numero_recu, date, etudiant_id, lignes, reference, statut, date_limite)
  values ('q-awa', 'RECU-2026-999', '2026-10-15', 'et-awa', '[{"label": "Autre", "montant": 1}]', 'RECU-2026-999', 'paye', '2026-12-15')
  on conflict (id) do update set numero_recu = excluded.numero_recu, lignes = excluded.lignes, reference = excluded.reference,
    date_limite = excluded.date_limite, montant = excluded.montant;
select tests.verifier((select numero_recu = 'RECU-2026-001' and reference = 'RECU-2026-001' and date_limite = '2026-12-15'
    and jsonb_array_length(lignes) = 2 from public.quittances where id = 'q-awa'),
  'renvoyée par un poste avec son numéro provisoire : numéro, référence et rubriques gardés, la date limite change');
insert into public.quittances (id, numero_recu, date, etudiant_id, lignes, statut) values ('q-awa-2', 'RECU-2026-999', '2026-10-20', 'et-awa', '[{"label": "APE", "montant": 5000}]', 'paye');
select tests.verifier((select numero_recu = 'RECU-2026-003' from public.quittances where id = 'q-awa-2'), 'une quittance renvoyée ne consomme pas de numéro : la suite reste sans trou');
select tests.echoue('insert into public.quittances (id, numero_recu, date, etudiant_id, lignes, statut) values (''q-vide'', ''x'', ''2026-10-20'', ''et-awa'', ''[]'', ''paye'')',
  'quittances_lignes_check', 'une quittance a au moins une rubrique');
select tests.echoue('insert into public.quittances (id, numero_recu, date, etudiant_id, lignes, statut) values (''q-neg'', ''x'', ''2026-10-20'', ''et-awa'', ''[{"label": "x", "montant": -5}]'', ''paye'')',
  'montant positif', 'une rubrique négative est refusée');

-- ——— Mouvements : la base additionne ———
insert into public.mouvements_solde (id, etudiant_id, delta_du, motif) values ('mv-1', 'et-awa', 100000, 'Quittance émise');
insert into public.mouvements_solde (id, etudiant_id, quittance_id, delta_paye, motif) values ('mv-2', 'et-awa', 'q-awa', 40000, 'Encaissement');
insert into public.mouvements_solde (id, etudiant_id, delta_du, motif) values ('mv-3', 'et-awa', -40000, 'Encaissement');
select tests.verifier((select montant = 40000 from public.quittances where id = 'q-awa'), 'versement de 40 000 F : réglé sur la quittance');
select tests.verifier((select solde_du = 60000 and solde_avoir = 0 from public.soldes_etudiants where id = 'et-awa'), 'solde dû d''Awa : 100 000 − 40 000 = 60 000 F');
select tests.verifier((select cree_par = :F from public.mouvements_solde where id = 'mv-2'), 'chaque mouvement garde son auteur');
update public.quittances set montant = 99999, moyen = 'Espèce' where id = 'q-awa';
select tests.verifier((select montant = 40000 and moyen = 'Espèce' from public.quittances where id = 'q-awa'), 'un poste n''écrit jamais le montant réglé : seul le mouvement le change');
-- Deux postes retirent chacun 10 000 F au même solde : aucun ne perd l'autre.
insert into public.mouvements_solde (id, etudiant_id, delta_du) values ('mv-poste-1', 'et-awa', -10000);
insert into public.mouvements_solde (id, etudiant_id, delta_du) values ('mv-poste-2', 'et-awa', -10000);
select tests.verifier((select solde_du = 40000 from public.soldes_etudiants where id = 'et-awa'), 'deux postes sur le même solde : 60 000 − 10 000 − 10 000 = 40 000 F');
select tests.echoue('insert into public.mouvements_solde (id, etudiant_id, quittance_id, delta_paye, delta_du) values (''mv-trop'', ''et-awa'', ''q-awa'', 70000, -70000)',
  'dépasse le reste à payer', 'un versement au-delà du reste à payer est refusé (déjà réglé ailleurs)');
select tests.verifier((select montant = 40000 from public.quittances where id = 'q-awa') and (select solde_du = 40000 from public.soldes_etudiants where id = 'et-awa'),
  'refusé : ni la quittance ni le solde ne bougent');
select tests.echoue('insert into public.mouvements_solde (id, etudiant_id, quittance_id, delta_paye) values (''mv-autre'', ''et-ousmane'', ''q-awa'', 1000)',
  'ne correspond pas', 'un règlement sur la quittance d''une autre étudiante est refusé');
select tests.echoue('insert into public.mouvements_solde (id, etudiant_id) values (''mv-nul'', ''et-awa'')', 'mouvements_solde_utile', 'un mouvement vide est refusé');
insert into public.mouvements_solde (id, etudiant_id, delta_du) values ('mv-remise', 'et-awa', -1000000);
select tests.verifier((select solde_du = 0 from public.soldes_etudiants where id = 'et-awa'), 'le solde dû ne descend jamais sous zéro');

-- Avoir : jamais dépensé deux fois.
insert into public.mouvements_solde (id, etudiant_id, delta_avoir, motif) values ('mv-avoir', 'et-ousmane', 5000, 'Avoir déposé');
insert into public.mouvements_solde (id, etudiant_id, delta_avoir) values ('mv-avoir-1', 'et-ousmane', -3000);
select tests.echoue('insert into public.mouvements_solde (id, etudiant_id, delta_avoir) values (''mv-avoir-2'', ''et-ousmane'', -3000)',
  'avoir insuffisant', 'le même avoir dépensé depuis un second poste est refusé');
select tests.verifier((select solde_avoir = 2000 from public.soldes_etudiants where id = 'et-ousmane'), 'avoir d''Ousmane : 5 000 − 3 000 = 2 000 F');

-- ——— Encaissements ———
insert into public.encaissements (id, reference, date, quittance_id, quittance_reference, etudiant_id, payeur, montant, moyen, encaisse_par, lignes)
  values ('enc-1', 'OP-2026-777', '2026-10-15', 'q-awa', 'RECU-2026-999', 'et-awa', '2026-LQHSE-0001 - Awa SECK', 40000, 'Espèce', 'Caisse',
          '[{"label": "Scolarité", "montantApplique": 40000, "montantLigneTotal": 90000}]');
select tests.verifier((select reference = 'OP-2026-001' and quittance_reference = 'RECU-2026-001' from public.encaissements where id = 'enc-1'),
  'encaissement : numéro donné par la base, et le numéro définitif de sa quittance');
select tests.echoue('insert into public.encaissements (id, reference, date, quittance_id, etudiant_id, montant) values (''enc-x'', ''OP-2026-778'', ''2026-10-15'', ''q-awa'', ''et-ousmane'', 1000)',
  'ne correspond pas', 'un encaissement sur la quittance d''une autre étudiante est refusé');
update public.encaissements set montant = 1, reference = 'OP-2026-777', annulee = true where id = 'enc-1';
select tests.verifier((select montant = 40000 and reference = 'OP-2026-001' and annulee from public.encaissements where id = 'enc-1'),
  'seule l''annulation d''un encaissement se note ; le reste ne change plus');
select tests.echoue('update public.encaissements set annulee = false where id = ''enc-1''', 'il le reste', 'un encaissement annulé le reste');

-- ——— Annulation d'une quittance ———
update public.quittances set statut = 'annule' where id = 'q-ousmane';
select tests.echoue('update public.quittances set statut = ''paye'' where id = ''q-ousmane''', 'elle le reste', 'une quittance annulée le reste');
select tests.echoue('insert into public.mouvements_solde (id, etudiant_id, quittance_id, delta_paye) values (''mv-annulee'', ''et-ousmane'', ''q-ousmane'', 1000)',
  'annulée', 'une quittance annulée ne reçoit plus de règlement');

-- ——— Frais des étudiants ———
insert into public.frais_etudiants (id, etudiant_id, annee, type_frais_id, montant, obligatoire) values ('fe-1', 'et-awa', '2026-2027', 'tf-ape', 5000, true);
update public.frais_etudiants set quittance_id = 'q-awa-2', quittance_date = '2026-10-20', montant = 1 where id = 'fe-1';
select tests.verifier((select quittance_id = 'q-awa-2' and montant = 5000 from public.frais_etudiants where id = 'fe-1'), 'un frais est quittancé ; son montant ne change pas');
select tests.echoue('update public.frais_etudiants set quittance_id = ''q-awa'' where id = ''fe-1''', 'déjà quittancé', 'un frais quittancé garde sa quittance');
update public.frais_etudiants set annulee = true, motif_annulation = 'Doublon' where id = 'fe-1';
select tests.echoue('update public.frais_etudiants set annulee = false where id = ''fe-1''', 'il le reste', 'un frais annulé le reste');

-- ——— Rien ne s'efface, rien ne s'écrit à la main ———
select tests.echoue('delete from public.quittances where id = ''q-awa''', 'permission denied', 'une quittance ne se supprime pas');
select tests.echoue('delete from public.encaissements where id = ''enc-1''', 'permission denied', 'un encaissement ne se supprime pas');
select tests.echoue('update public.soldes_etudiants set solde_du = 0 where id = ''et-awa''', 'permission denied', 'un solde ne s''écrit pas à la main');
select tests.echoue('update public.mouvements_solde set delta_du = 0 where id = ''mv-1''', 'permission denied', 'un mouvement ne se modifie pas');
select tests.echoue('delete from public.mouvements_solde where id = ''mv-1''', 'permission denied', 'un mouvement ne se supprime pas');

-- ——— Qui lit, qui écrit ———
select tests.connecter(:S);
select tests.verifier((select count(*) = 3 from public.quittances) and (select count(*) = 2 from public.soldes_etudiants), 'la scolarité lit les quittances et les soldes');
select tests.echoue('insert into public.quittances (id, numero_recu, date, etudiant_id, lignes, statut) values (''q-s'', ''x'', ''2026-10-20'', ''et-awa'', ''[{"label": "x", "montant": 1}]'', ''paye'')',
  'row-level security', 'sans page Finances, pas de quittance');
select tests.echoue('insert into public.mouvements_solde (id, etudiant_id, delta_du) values (''mv-s'', ''et-awa'', -5000)', 'row-level security', 'sans page Finances, pas de mouvement de solde');
select tests.verifier(tests.lignes('update public.quittances set statut = ''annule'' where id = ''q-awa''') = 0, 'sans page Finances, une quittance ne s''annule pas');

select tests.connecter(:W);
select tests.verifier((select count(*) = 2 and bool_and(etudiant_id = 'et-awa') from public.quittances), 'Awa lit ses deux quittances, pas celle d''Ousmane');
select tests.verifier((select count(*) = 1 from public.soldes_etudiants) and (select solde_du = 0 from public.soldes_etudiants where id = 'et-awa'), 'Awa lit son seul solde');
select tests.verifier((select count(*) = 1 from public.encaissements) and (select count(*) = 1 from public.frais_etudiants), 'Awa lit son encaissement et ses frais');
select tests.verifier(not exists (select 1 from public.mouvements_solde), 'Awa ne lit pas le journal des mouvements');
select tests.verifier(exists (select 1 from public.notifications where message like 'Paiement validé — reçu RECU-2026-001 (40%FCFA)'),
  'Awa est prévenue de son versement, avec le numéro définitif');
select tests.echoue('insert into public.mouvements_solde (id, etudiant_id, delta_du) values (''mv-w'', ''et-awa'', -60000)', 'row-level security', 'Awa ne réduit pas son solde');

select tests.connecter(:O);
select tests.verifier((select count(*) = 1 from public.quittances) and not exists (select 1 from public.encaissements), 'Ousmane ne lit que sa quittance');

select tests.connecter(:K);
select tests.verifier(not exists (select 1 from public.quittances) and not exists (select 1 from public.soldes_etudiants) and not exists (select 1 from public.frais_etudiants),
  'KANE ne lit rien des finances des étudiants');

rollback;
