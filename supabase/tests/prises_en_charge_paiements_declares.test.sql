-- Tests de la partie 7, lot 3 : prises en charge et organismes, encaissements des organismes,
-- prises en charge en masse, paiements déclarés en ligne, factures d'autres services, devis et
-- émissions en masse. Comptes d'essai : la caisse (F), la scolarité sans page Finances (S), les
-- étudiants Awa SECK (W) et Ousmane DIALLO (O). Tout se passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set F '''00000000-0000-4000-8000-000000000022'''
\set S '''00000000-0000-4000-8000-000000000071'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
begin;

insert into auth.users (id, email) values
  (:F, 'caisse.f@comptes.edumanage.invalid'), (:S, 'saisie.s@comptes.edumanage.invalid'),
  (:W, 'awa.w@comptes.edumanage.invalid'), (:O, 'ousmane.o@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-caisse', 'ROLE_CAISSE', array['fin-quittance-nouvelle', 'fin-quittance-masse', 'fin-pec-liste', 'fin-pec-organisme', 'fin-enc-pec', 'fin-enc-pec-masse',
    'fin-enc-pec-masse2', 'fin-enc-declares', 'fin-enc-facture', 'fin-devis-nouveau', 'fin-devis-liste']),
  ('role-saisie', 'ROLE_SAISIE', array['scol-notes-saisie']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:F, 'administration', 'CAISSE-1', 'Caisse', null, 'role-caisse', false),
  (:S, 'administration', 'SAISIE-1', 'Scolarité', null, 'role-saisie', false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false);

select tests.connecter(:F);
insert into public.quittances (id, numero_recu, date, etudiant_id, lignes, statut) values
  ('q-awa', 'x', '2026-10-15', 'et-awa', '[{"label": "Scolarité", "montant": 100000}]', 'paye'),
  ('q-ousmane', 'x', '2026-10-15', 'et-ousmane', '[{"label": "Scolarité", "montant": 100000}]', 'paye');

-- ——— Prises en charge ———
insert into public.organismes_pec (id, intitule, contact_nom) values ('org-1', 'Fondation Sonatel', 'M. NDIAYE');
-- Comme le poste : la quittance réglée « par » la prise en charge, avec son numéro provisoire.
update public.quittances set reference = 'PEC-2026-777', moyen = 'Prise en charge' where id = 'q-awa';
insert into public.mouvements_solde (id, etudiant_id, quittance_id, delta_paye) values ('mv-pec', 'et-awa', 'q-awa', 50000);
insert into public.prises_en_charge (id, reference, type, date_saisie, organisme_id, organisme, etudiant_id, etudiant, annee, debut, fin, date_limite, montant,
  ajoutee_par, lignes, montant_encaisse)
  values ('pec-1', 'PEC-2026-777', 'montant', '2026-10-20', 'org-1', 'Fondation Sonatel', 'et-awa', 'Awa SECK', '2026-2027', '2026-10-01', '2027-07-31', '2026-12-31',
          50000, 'Caisse', '[{"quittanceId": "q-awa", "label": "Scolarité", "montantFrais": 100000, "montantPEC": 50000}]', 999);
select tests.verifier((select reference = 'PEC-2026-001' and montant_encaisse = 0 from public.prises_en_charge where id = 'pec-1'),
  'prise en charge : numéro donné par la base ; le versé ne s''écrit pas, il se calcule');
select tests.verifier((select reference = 'PEC-2026-001' and montant = 50000 from public.quittances where id = 'q-awa'),
  'la quittance réglée par la prise en charge reprend son numéro définitif');
insert into public.encaissements_pec (id, reference, organisme_id, organisme, date, mode_paiement, ajoutee_par, lignes)
  values ('encpec-1', 'ENC-PEC-2026-777', 'org-1', 'Fondation Sonatel', '2026-11-10', 'Virement', 'Caisse',
          '[{"priseEnChargeId": "pec-1", "reference": "PEC-2026-001", "montant": 30000}]');
insert into public.reglements_masse (id, reference, organisme_id, organisme, annee, date, mode_paiement, montant_global, ajoutee_par, lignes)
  values ('regm-1', 'x', 'org-1', 'Fondation Sonatel', '2026-2027', '2026-11-20', 'Virement', 10000, 'Caisse',
          '[{"priseEnChargeId": "pec-1", "reference": "PEC-2026-001", "etudiant": "Awa SECK", "montant": 10000}]');
select tests.verifier((select reference = 'ENC-PEC-2026-001' from public.encaissements_pec where id = 'encpec-1')
    and (select reference = 'REGM-2026-001' from public.reglements_masse where id = 'regm-1'),
  'encaissement d''organisme et règlement en masse : numéros donnés par la base');
select tests.verifier((select montant_encaisse = 40000 from public.prises_en_charge where id = 'pec-1'), 'versé par l''organisme : 30 000 + 10 000 = 40 000 F');
update public.prises_en_charge set montant_encaisse = 0, fin = '2027-08-31' where id = 'pec-1';
select tests.verifier((select montant_encaisse = 40000 and fin = '2027-08-31' from public.prises_en_charge where id = 'pec-1'),
  'la prolongation se note ; le versé envoyé par un poste est ignoré');
update public.encaissements_pec set annulee = true where id = 'encpec-1';
select tests.verifier((select montant_encaisse = 10000 from public.prises_en_charge where id = 'pec-1'), 'encaissement annulé : le versé redescend à 10 000 F');
select tests.echoue('update public.encaissements_pec set annulee = false where id = ''encpec-1''', 'elle le reste', 'un encaissement d''organisme annulé le reste');

-- Prise en charge en masse : ses prises en charge reprennent le numéro définitif du lot.
insert into public.prises_en_charge (id, reference, reference_externe, type, date_saisie, organisme_id, etudiant_id, annee, debut, fin, date_limite, pourcentage, lignes)
  values ('pec-2', 'x', 'Lot PECM-2026-555', 'pourcentage', '2026-10-20', 'org-1', 'et-ousmane', '2026-2027', '2026-10-01', '2027-07-31', '2026-12-31', 50, '[]');
insert into public.pec_masse (id, reference, organisme_id, type, pourcentage, filiere_id, annee, niveau_id, classe_id, debut, fin, date_limite, prise_en_charge_ids)
  values ('pecm-1', 'PECM-2026-555', 'org-1', 'pourcentage', 50, 'fil-qhse', '2026-2027', 'niv-l1', 'cl-l1', '2026-10-01', '2027-07-31', '2026-12-31', array['pec-2']);
select tests.verifier((select reference = 'PECM-2026-001' from public.pec_masse where id = 'pecm-1')
    and (select reference = 'PEC-2026-002' and reference_externe = 'Lot PECM-2026-001' from public.prises_en_charge where id = 'pec-2'),
  'prise en charge en masse : le lot et ses prises en charge portent le numéro définitif');
update public.prises_en_charge set annulee = true where id = 'pec-2';
select tests.echoue('update public.prises_en_charge set annulee = false where id = ''pec-2''', 'elle le reste', 'une prise en charge annulée le reste');

-- ——— Factures d'autres services, devis, émissions en masse ———
insert into public.factures_autres_services (id, reference, date, beneficiaire, remarque, lignes, montant, statut)
  values ('fas-1', 'x', '2026-11-02', 'Restaurant universitaire', '', '[{"article": "Location salle", "prixUnitaire": 25000, "quantite": 2, "montant": 50000}]', 20000, 'actif');
select tests.verifier((select reference = 'FAS-2026-001' from public.factures_autres_services where id = 'fas-1'), 'facture d''autre service : numéro donné par la base');
select tests.echoue('update public.factures_autres_services set montant = 60000 where id = ''fas-1''', 'dépasse le montant facturé', 'un règlement au-delà du facturé est refusé');
update public.factures_autres_services set statut = 'annule' where id = 'fas-1';
select tests.echoue('update public.factures_autres_services set statut = ''actif'' where id = ''fas-1''', 'elle le reste', 'une facture annulée le reste');
insert into public.devis (id, reference, date, filiere_id, beneficiaire, lignes, total_ttc) values
  ('dev-1', 'x', '2026-09-15', 'fil-qhse', 'Fatou SOW', '[{"intitule": "Scolarité", "montantHT": 600000, "modalite": "comptant", "montantTTC": 600000}]', 600000),
  ('dev-2', 'x', '2026-09-16', 'fil-qhse', 'Mamadou KANE', '[]', 0);
select tests.verifier((select array_agg(reference order by id) = array['DEV-2026-001', 'DEV-2026-002'] from public.devis), 'devis : numéros donnés par la base');
update public.devis set converti_etudiant_id = 'et-awa', total_ttc = 1 where id = 'dev-1';
select tests.verifier((select converti_etudiant_id = 'et-awa' and total_ttc = 600000 from public.devis where id = 'dev-1'), 'un devis se convertit ; ses montants ne changent pas');
select tests.echoue('update public.devis set annule = true where id = ''dev-1''', 'devis_annule_ou_converti', 'un devis converti ne s''annule pas');
select tests.echoue('update public.devis set converti_etudiant_id = ''et-ousmane'' where id = ''dev-1''', 'déjà été converti', 'un devis converti le reste');
insert into public.quittances (id, numero_recu, date, etudiant_id, lignes, reference, statut)
  values ('q-em', 'x', '2026-11-01', 'et-ousmane', '[{"label": "Frais généraux", "montant": 15000}]', 'EM-2026-555-l1-1', 'paye');
insert into public.emissions_masse (id, reference, filiere_id, annee, niveau_id, classe_id, date_facturation, quittance_ids)
  values ('em-1', 'EM-2026-555', 'fil-qhse', '2026-2027', 'niv-l1', 'cl-l1', '2026-11-01', array['q-em']);
select tests.verifier((select reference = 'EM-2026-001' from public.emissions_masse where id = 'em-1')
    and (select reference = 'EM-2026-001-l1-1' from public.quittances where id = 'q-em'),
  'émission en masse : ses quittances reprennent le numéro définitif');

-- ——— Paiements déclarés en ligne ———
select tests.connecter(:W);
insert into public.paiements_declares (id, quittance_id, etudiant_id, etudiant_label, montant, moyen, telephone, reference_transaction, statut, traite_par)
  values ('decl-1', 'q-awa', 'et-awa', '2026-LQHSE-0001 - Awa SECK', 30000, 'Wave', '770000001', 'WV-4521', 'confirme', 'moi');
select tests.verifier((select statut = 'a_verifier' and traite_par is null and quittance_reference = 'RECU-2026-001' from public.paiements_declares where id = 'decl-1'),
  'Awa déclare un paiement : il attend la vérification de la caisse');
select tests.echoue('insert into public.paiements_declares (id, quittance_id, etudiant_id, montant, moyen, reference_transaction, statut) values (''decl-2'', ''q-awa'', ''et-awa'', 25000, ''Wave'', ''WV-4522'', ''a_verifier'')',
  'au plus 20', 'au-delà du reste à payer moins ce qui attend déjà, la déclaration est refusée');
select tests.echoue('insert into public.paiements_declares (id, quittance_id, etudiant_id, montant, moyen, reference_transaction, statut) values (''decl-o'', ''q-ousmane'', ''et-ousmane'', 1000, ''Wave'', ''WV-1'', ''a_verifier'')',
  'row-level security', 'Awa ne déclare pas pour Ousmane');
select tests.verifier(tests.lignes('update public.paiements_declares set statut = ''confirme'' where id = ''decl-1''') = 0, 'Awa ne confirme pas son propre paiement');
select tests.connecter(:F);
select tests.verifier(exists (select 1 from public.notifications where message like 'Paiement en ligne à vérifier : 2026-LQHSE-0001 - Awa SECK — 30%(Wave, réf. WV-4521).'),
  'la caisse est prévenue du paiement à vérifier');
select tests.echoue('update public.paiements_declares set statut = ''rejete'' where id = ''decl-1''', 'motif du rejet', 'un rejet demande son motif');
update public.paiements_declares set statut = 'confirme', montant = 1 where id = 'decl-1';
select tests.verifier((select statut = 'confirme' and montant = 30000 and traite_par = 'Caisse' and traite_le is not null from public.paiements_declares where id = 'decl-1'),
  'la caisse confirme ; le montant déclaré ne change pas');
select tests.echoue('update public.paiements_declares set statut = ''rejete'', motif_rejet = ''x'' where id = ''decl-1''', 'plus à vérifier', 'un paiement traité ne se retraite pas');

-- ——— Qui lit, qui écrit ———
select tests.connecter(:S);
select tests.verifier((select count(*) = 2 from public.prises_en_charge) and (select count(*) = 1 from public.paiements_declares), 'la scolarité lit les prises en charge et les déclarations');
select tests.echoue('insert into public.organismes_pec (intitule) values (''Autre'')', 'row-level security', 'sans page Finances, pas d''organisme');
select tests.connecter(:W);
select tests.verifier((select count(*) = 1 from public.prises_en_charge) and (select count(*) = 1 from public.paiements_declares), 'Awa lit sa prise en charge et sa déclaration');
select tests.verifier(exists (select 1 from public.notifications where message like 'Votre paiement de 30%(Wave) a été vérifié et enregistré.'), 'Awa est prévenue de la confirmation');
select tests.verifier(not exists (select 1 from public.organismes_pec) and not exists (select 1 from public.devis) and not exists (select 1 from public.factures_autres_services),
  'Awa ne lit ni les organismes, ni les devis, ni les factures');
select tests.connecter(:O);
select tests.verifier((select count(*) = 1 from public.prises_en_charge) and not exists (select 1 from public.paiements_declares), 'Ousmane ne lit que sa prise en charge');

rollback;
