-- Tests de la partie 7, lot 2 : réductions et autorisations, avoirs, dérogations, relances,
-- rappels, reprises, et notifications entre professeurs et étudiants de leurs classes.
-- Comptes d'essai : la caisse (F), la personne qui règle les autorisations (R), la scolarité sans
-- page Finances (S), Mamadou KANE (K, cours en L1) et Ibrahima FALL (L, sans cours en L1), les
-- étudiants Awa SECK (W) et Ousmane DIALLO (O). Tout se passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set F '''00000000-0000-4000-8000-000000000022'''
\set R '''00000000-0000-4000-8000-000000000023'''
\set S '''00000000-0000-4000-8000-000000000071'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set L '''00000000-0000-4000-8000-000000000013'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
begin;

insert into auth.users (id, email) values
  (:F, 'caisse.f@comptes.edumanage.invalid'), (:R, 'reductions.r@comptes.edumanage.invalid'), (:S, 'saisie.s@comptes.edumanage.invalid'),
  (:K, 'kane.k@comptes.edumanage.invalid'), (:L, 'fall.l@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid'),
  (:O, 'ousmane.o@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-caisse', 'ROLE_CAISSE', array['fin-quittance-nouvelle', 'fin-reduction-frais', 'fin-avoir-depot', 'fin-avoir-remboursement', 'fin-derogation',
    'fin-rappel', 'fin-reprise-nouvelle', 'fin-reprise-liste', 'etudiants-interdire']),
  ('role-reductions', 'ROLE_REDUCTIONS', array['fin-reduction-autorisee']),
  ('role-saisie', 'ROLE_SAISIE', array['scol-notes-saisie']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027');
insert into public.ues (id, code, libelle, credits, filiere_id, niveau, semestre) values ('ue-l1', 'UE11', 'Fondamentaux QHSE', 6, 'fil-qhse', 'L1', 'S1');
insert into public.ecs (id, code, libelle, ue_id, credits, vht) values ('ec-qualite', 'QHSE111', 'Qualité', 'ue-l1', 3, 30);
insert into public.enseignants (id, prenom, nom, matricule, grade) values
  ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire'), ('en-fall', 'Ibrahima', 'FALL', 'ENS-2026-101', 'Permanent');
insert into public.seances (id, ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, prof_id, annee)
  values ('se-kane-1', 'ec-qualite', 'cl-l1', 1, '2026-11-02', '08:00', '10:00', 'en-kane', '2026-2027');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:F, 'administration', 'CAISSE-1', 'Caisse', null, 'role-caisse', false),
  (:R, 'administration', 'REDUC-1', 'Direction financière', null, 'role-reductions', false),
  (:S, 'administration', 'SAISIE-1', 'Scolarité', null, 'role-saisie', false),
  (:K, 'enseignant', 'KANE', 'Mamadou KANE', 'en-kane', null, false),
  (:L, 'enseignant', 'FALL', 'Ibrahima FALL', 'en-fall', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false);

-- ——— Réductions : jamais au-delà de l'autorisation ———
select tests.connecter(:S);
select tests.echoue(format('insert into public.reductions_autorisees (personnel_id, taux_max, montant_plafond, date_debut, date_fin) values (%L, 30, 50000, ''2026-10-01'', ''2026-12-31'')', :F),
  'row-level security', 'sans la page « Réduction autorisée », pas d''autorisation');
select tests.connecter(:R);
insert into public.reductions_autorisees (personnel_id, taux_max, montant_plafond, date_debut, date_fin) values (:F, 30, 50000, '2026-10-01', '2026-12-31');
select tests.connecter(:F);
insert into public.reductions_frais (id, reference, date, etudiant_id, personnel_id, taux_applique, total_reduit) values ('red-1', 'RED-2026-555', '2026-11-02', 'et-awa', :F, 20, 20000);
select tests.verifier((select reference = 'RED-2026-001' from public.reductions_frais where id = 'red-1'), 'réduction : numéro donné par la base');
select tests.echoue(format('insert into public.reductions_frais (id, reference, date, etudiant_id, personnel_id, taux_applique, total_reduit) values (''red-taux'', ''x'', ''2026-11-02'', ''et-awa'', %L, 40, 1000)', :F),
  'au-delà du taux autorisé', 'un taux au-delà du taux autorisé est refusé');
select tests.echoue(format('insert into public.reductions_frais (id, reference, date, etudiant_id, personnel_id, taux_applique, total_reduit) values (''red-plafond'', ''x'', ''2026-11-03'', ''et-ousmane'', %L, 25, 35000)', :F),
  'plafond de réduction dépassé', 'le plafond cumulé de la période ne se dépasse pas (20 000 + 35 000 > 50 000)');
insert into public.reductions_frais (id, reference, date, etudiant_id, personnel_id, taux_applique, total_reduit) values ('red-2', 'x', '2026-11-03', 'et-ousmane', :F, 25, 30000);
select tests.verifier((select reference = 'RED-2026-002' from public.reductions_frais where id = 'red-2'), 'jusqu''au plafond exactement : 50 000 F accordés');
select tests.echoue(format('insert into public.reductions_frais (id, reference, date, etudiant_id, personnel_id, taux_applique, total_reduit) values (''red-hors'', ''x'', ''2027-01-05'', ''et-awa'', %L, 10, 1000)', :F),
  'aucune autorisation', 'hors de la période autorisée, pas de réduction');
select tests.echoue(format('insert into public.reductions_frais (id, reference, date, etudiant_id, personnel_id, taux_applique, total_reduit) values (''red-s'', ''x'', ''2026-11-03'', ''et-awa'', %L, 10, 1000)', :S),
  'aucune autorisation', 'au nom d''une personne sans autorisation, pas de réduction');
update public.reductions_frais set annulee = true, total_reduit = 1 where id = 'red-1';
select tests.verifier((select annulee and total_reduit = 20000 from public.reductions_frais where id = 'red-1'), 'une réduction s''annule ; son montant ne change pas');
insert into public.reductions_frais (id, reference, date, etudiant_id, personnel_id, taux_applique, total_reduit) values ('red-3', 'x', '2026-11-04', 'et-awa', :F, 20, 20000);
select tests.verifier((select reference = 'RED-2026-003' from public.reductions_frais where id = 'red-3'), 'l''annulation libère le plafond de son auteur');
select tests.echoue('update public.reductions_frais set annulee = false where id = ''red-1''', 'elle le reste', 'une réduction annulée le reste');
select tests.echoue('delete from public.reductions_frais where id = ''red-1''', 'permission denied', 'une réduction ne se supprime pas');

-- ——— Avoirs déposés et remboursés ———
insert into public.avoirs_depots (id, reference, date, etudiant_id, payeur, montant, motif, moyen_origine, ajoutee_par)
  values ('dpt-1', 'DPT-2026-900', '2026-11-05', 'et-ousmane', 'Ousmane DIALLO', 25000, 'Trop-perçu', 'Espèce', 'Caisse');
insert into public.avoirs_remboursements (id, reference, date, etudiant_id, payeur, montant, motif, moyen_remboursement, ajoutee_par)
  values ('remb-1', 'REMB-2026-900', '2026-11-06', 'et-ousmane', 'Ousmane DIALLO', 10000, 'Remboursement partiel', 'Espèce', 'Caisse');
select tests.verifier((select reference = 'DPT-2026-001' from public.avoirs_depots where id = 'dpt-1') and (select reference = 'REMB-2026-001' from public.avoirs_remboursements where id = 'remb-1'),
  'dépôt et remboursement d''avoir : numéros donnés par la base');
update public.avoirs_remboursements set annulee = true where id = 'remb-1';
select tests.echoue('update public.avoirs_remboursements set annulee = false where id = ''remb-1''', 'elle le reste', 'un remboursement annulé le reste');

-- ——— Dérogations ———
insert into public.derogations_paiement (id, reference, etudiant_id, etudiant_label, solde_du_constate, portee, motif, personnel_id, personnel_label, date_debut, date_fin)
  values ('der-1', 'DER-2026-900', 'et-awa', 'Awa SECK', 60000, 'reinscription', 'Échéancier convenu avec la famille', :F, 'Caisse', '2026-11-01', '2027-01-31');
select tests.verifier((select reference = 'DER-2026-001' from public.derogations_paiement where id = 'der-1'), 'dérogation : numéro donné par la base');
update public.derogations_paiement set motif = 'autre', date_fin = '2027-12-31' where id = 'der-1';
select tests.verifier((select motif = 'Échéancier convenu avec la famille' and date_fin = '2027-01-31' from public.derogations_paiement where id = 'der-1'),
  'une dérogation accordée ne se modifie pas');
select tests.echoue('update public.derogations_paiement set revoquee = true where id = ''der-1''', 'derogations_paiement_revocation', 'une révocation demande son motif');
update public.derogations_paiement set revoquee = true, motif_revocation = 'Échéancier non respecté', revoquee_le = '2026-12-01' where id = 'der-1';
select tests.echoue('update public.derogations_paiement set revoquee = false where id = ''der-1''', 'elle le reste', 'une dérogation révoquée le reste');

-- ——— Relances et rappels ———
insert into public.relances_paiement (id, etudiant_id, date_envoi, date_echeance, montant_du, envoye_par, statut)
  values ('rel-1', 'et-awa', '2026-11-10', '2026-11-20', 60000, :F, 'active');
update public.relances_paiement set statut = 'annulee', montant_du = 0 where id = 'rel-1';
select tests.verifier((select statut = 'annulee' and montant_du = 60000 from public.relances_paiement where id = 'rel-1'), 'une relance remplacée se clôt ; son montant ne change pas');
select tests.echoue('update public.relances_paiement set statut = ''active'' where id = ''rel-1''', 'ne se rouvre pas', 'une relance close ne se rouvre pas');
insert into public.rappels_paiement (id, reference, date, filiere_id, filiere_label, annee, frais_echus_avant, quittance_ids, nb_etudiants, nb_notifications_envoyees)
  values ('rap-1', 'RAP-2026-900', '2026-11-12', 'fil-qhse', 'LQHSE', '2026-2027', '2026-11-10', array['q-1', 'q-2'], 2, 2);
update public.rappels_paiement set nb_etudiants = 9 where id = 'rap-1';
select tests.verifier((select reference = 'RAP-2026-001' and nb_etudiants = 2 from public.rappels_paiement where id = 'rap-1'), 'rappel : numéro donné par la base, puis inchangé');

-- ——— Reprise des anciens frais ———
insert into public.reprises_frais (id, ancien_code, nom, prenom, libelle_annee_scolaire, montant, statut)
  values ('rep-1', 'ANC-001', 'SECK', 'Awa', '2026-2027', 45000, 'en_attente'), ('rep-2', 'ANC-002', 'DIALLO', 'Ousmane', '2026-2027', 30000, 'en_attente');
select tests.echoue('insert into public.reprises_frais (id, ancien_code, libelle_annee_scolaire, montant, statut) values (''rep-double'', ''ANC-001'', ''2026-2027'', 45000, ''en_attente'')',
  'reprises_frais_code', 'la même ligne de l''ancien système ne s''importe pas deux fois');
select tests.echoue('update public.reprises_frais set statut = ''valide'' where id = ''rep-1''', 'associez d''abord', 'une reprise se valide pour un étudiant retrouvé');
update public.reprises_frais set etudiant_id = 'et-awa' where id = 'rep-1';
update public.reprises_frais set statut = 'valide' where id = 'rep-1';
select tests.echoue('update public.reprises_frais set statut = ''rejete'', motif_rejet = ''x'' where id = ''rep-1''', 'déjà été traitée', 'une reprise se traite une seule fois');
select tests.echoue('update public.reprises_frais set statut = ''rejete'' where id = ''rep-2''', 'motif du rejet', 'un rejet demande son motif');

-- ——— Qui lit, qui écrit ———
select tests.connecter(:S);
select tests.echoue('insert into public.avoirs_depots (id, reference, date, etudiant_id, montant) values (''dpt-s'', ''x'', ''2026-11-05'', ''et-awa'', 1000)',
  'row-level security', 'sans page Finances, pas de dépôt d''avoir');
select tests.verifier((select count(*) = 3 from public.reductions_frais), 'la scolarité lit les réductions');
select tests.connecter(:W);
select tests.verifier((select count(*) = 1 from public.derogations_paiement) and (select count(*) = 1 from public.relances_paiement) and (select count(*) = 2 from public.reductions_frais),
  'Awa lit sa dérogation, sa relance et ses deux réductions');
select tests.verifier(not exists (select 1 from public.reductions_autorisees) and not exists (select 1 from public.rappels_paiement) and not exists (select 1 from public.reprises_frais),
  'Awa ne lit ni les autorisations, ni les rappels, ni les reprises');
select tests.verifier(exists (select 1 from public.notifications where message like 'Rappel de paiement : votre dossier présente un solde impayé de 60%avant le 20/11/2026%'),
  'Awa est prévenue de sa relance, avec son échéance');
select tests.echoue(format('insert into public.derogations_paiement (id, reference, etudiant_id, portee, motif, personnel_id, date_debut, date_fin) values (''der-w'', ''x'', ''et-awa'', ''global'', ''moi'', %L, ''2026-11-01'', ''2026-12-01'')', :W),
  'row-level security', 'Awa ne s''accorde pas de dérogation');
select tests.connecter(:O);
select tests.verifier(not exists (select 1 from public.derogations_paiement) and not exists (select 1 from public.relances_paiement), 'Ousmane ne lit pas ce qui concerne Awa');

-- ——— Notifications entre professeurs et étudiants de leurs classes ———
select tests.connecter(:K);
select tests.verifier(public.notifier(:W, 'Nouvelle ressource pédagogique en Qualité') is not null, 'KANE prévient Awa, étudiante de sa classe');
select tests.connecter(:L);
select tests.echoue(format('select public.notifier(%L, ''x'')', :W), 'ne pouvez pas', 'FALL ne prévient pas une étudiante hors de ses classes');
select tests.connecter(:W);
select tests.verifier(public.notifier(:K, 'Nouveau message : question sur le TD') is not null, 'Awa prévient KANE, professeur de sa classe');
select tests.echoue(format('select public.notifier(%L, ''x'')', :L), 'ne pouvez pas', 'Awa ne prévient pas un professeur hors de sa classe');
select tests.echoue(format('select public.notifier(%L, ''x'')', :O), 'ne pouvez pas', 'Awa ne prévient pas un autre étudiant');

rollback;
