-- Tests de la partie 6, lot 3 : attestations numérotées.
-- Comptes d'essai : les attestations (B), les demandes des étudiants (Q), la caisse (F), la
-- délibération (D), les étudiants Awa SECK (W, admise au S1) et Ousmane DIALLO (O, ajourné).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set B '''00000000-0000-4000-8000-000000000091'''
\set Q '''00000000-0000-4000-8000-000000000092'''
\set F '''00000000-0000-4000-8000-000000000022'''
\set D '''00000000-0000-4000-8000-000000000082'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
begin;

insert into auth.users (id, email) values
  (:B, 'attestations.b@comptes.edumanage.invalid'), (:Q, 'demandes.q@comptes.edumanage.invalid'), (:F, 'caisse.f@comptes.edumanage.invalid'),
  (:D, 'deliberation.d@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid'), (:O, 'ousmane.o@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-attestations', 'ROLE_ATTESTATIONS', array['bul-attestations']),
  ('role-demandes', 'ROLE_DEMANDES', array['com-demandes']),
  ('role-caisse', 'ROLE_CAISSE', array['fin-quittance-nouvelle']),
  ('role-deliberation', 'ROLE_DELIBERATION', array['bul-deliberation']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse');
insert into public.semestres (id, nom, alias, niveau, niveau_id) values ('sem-s1', 'Semestre 1', 'S1', 'L1', 'niv-l1'), ('sem-s2', 'Semestre 2', 'S2', 'L1', 'niv-l1');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:B, 'administration', 'ATTEST-1', 'Attestations', null, 'role-attestations', false),
  (:Q, 'administration', 'DEMANDES-1', 'Demandes', null, 'role-demandes', false),
  (:F, 'administration', 'CAISSE-1', 'Caisse', null, 'role-caisse', false),
  (:D, 'administration', 'DELIB-1', 'Délibération', null, 'role-deliberation', false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false);
select tests.connecter(:D);
insert into public.deliberations (id, filiere_id, annee, classe_id, classe, semestre_id, semestre, statut) values
  ('delib-s1', 'fil-qhse', '2026-2027', 'cl-l1', 'LQHSE1-26/27', 'sem-s1', 'Semestre 1 (S1)', 'en_cours'),
  ('delib-s2', 'fil-qhse', '2026-2027', 'cl-l1', 'LQHSE1-26/27', 'sem-s2', 'Semestre 2 (S2)', 'en_cours');
insert into public.deliberations_lignes (id, deliberation_id, etudiant_id, etudiant, ordre, moyenne, decision_auto, decision_finale) values
  ('delib-s1:et-awa', 'delib-s1', 'et-awa', 'Awa SECK', 0, 12.4, 'admis', 'admis'),
  ('delib-s1:et-ousmane', 'delib-s1', 'et-ousmane', 'Ousmane DIALLO', 1, 8.1, 'ajourne', 'ajourne'),
  ('delib-s2:et-awa', 'delib-s2', 'et-awa', 'Awa SECK', 0, 13, 'admis', 'admis');
update public.deliberations set statut = 'cloturee' where id = 'delib-s1';

-- ——— Numérotation ———
select tests.connecter(:F);
select tests.echoue('select public.attribuer_numero_attestation()', 'pas accès aux attestations', 'la caisse ne réserve pas de numéro');
select tests.connecter(:B);
select set_config('essai.n1', public.attribuer_numero_attestation(), true);
select tests.verifier(current_setting('essai.n1') = 'ATT-' || to_char(now(), 'YYYY') || '-001', 'premier numéro de l''année : ATT-…-001');
insert into public.attestations (id, numero, etudiant_id, etudiant, matricule, classe_id, classe, filiere_id, annee, type, type_label, solde_du_constate, statut, effectue_par)
  values ('att-1', current_setting('essai.n1'), 'et-awa', 'Awa SECK', '2026-LQHSE-0001', 'cl-l1', 'LQHSE1-26/27', 'fil-qhse', '2026-2027', 'scolarite',
          'Certificat de scolarité', 150000, 'genere', 'Attestations');
select tests.echoue(format('insert into public.attestations (id, numero, etudiant_id, annee, type, statut) values (''att-faux'', %L, ''et-awa'', ''2026-2027'', ''inscription'', ''genere'')',
  'ATT-' || to_char(now(), 'YYYY') || '-050'), 'pas été réservé', 'un numéro non réservé est refusé');
select tests.echoue(format('insert into public.attestations (id, numero, etudiant_id, annee, type, statut) values (''att-double'', %L, ''et-awa'', ''2026-2027'', ''inscription'', ''genere'')',
  current_setting('essai.n1')), 'attestations_numero_key', 'jamais deux fois le même numéro');
select tests.connecter(:Q);
select tests.verifier(public.attribuer_numero_attestation() = 'ATT-' || to_char(now(), 'YYYY') || '-002',
  'la page Demandes réserve le numéro suivant, sans doublon');

-- ——— Réussite : seulement sur un jury clôturé qui admet l'étudiant ———
select tests.connecter(:B);
select set_config('essai.n3', public.attribuer_numero_attestation(), true);
insert into public.attestations (id, numero, etudiant_id, etudiant, classe_id, filiere_id, annee, type, type_label, semestre_id, semestre_label,
  moyenne_constatee, decision_constatee, statut)
  values ('att-reussite', current_setting('essai.n3'), 'et-awa', 'Awa SECK', 'cl-l1', 'fil-qhse', '2026-2027', 'reussite', 'Attestation de réussite',
          'sem-s1', 'Semestre 1 (S1)', 20, 'admis', 'genere');
select tests.verifier((select moyenne_constatee = 12.4 and decision_constatee = 'admis' from public.attestations where id = 'att-reussite'),
  'la moyenne et la décision inscrites sont celles du jury, relues par la base');
select set_config('essai.n4', public.attribuer_numero_attestation(), true);
select tests.echoue(format('insert into public.attestations (id, numero, etudiant_id, classe_id, annee, type, semestre_id, statut) values (''att-o'', %L, ''et-ousmane'', ''cl-l1'', ''2026-2027'', ''reussite'', ''sem-s1'', ''genere'')',
  current_setting('essai.n4')), 'n''est pas admis', 'Ousmane, ajourné, n''obtient pas d''attestation de réussite');
select tests.echoue(format('insert into public.attestations (id, numero, etudiant_id, classe_id, annee, type, semestre_id, statut) values (''att-s2'', %L, ''et-awa'', ''cl-l1'', ''2026-2027'', ''reussite'', ''sem-s2'', ''genere'')',
  current_setting('essai.n4')), 'pas clôturée', 'pas de réussite sur un jury encore ouvert');
select tests.echoue(format('insert into public.attestations (id, numero, etudiant_id, classe_id, annee, type, statut) values (''att-sans'', %L, ''et-awa'', ''cl-l1'', ''2026-2027'', ''reussite'', ''genere'')',
  current_setting('essai.n4')), 'impossible de certifier', 'une réussite désigne le semestre délibéré');

-- ——— Une attestation émise ne change plus ———
update public.attestations set statut = 'envoyee' where id = 'att-1';
select tests.echoue('update public.attestations set solde_du_constate = 0 where id = ''att-1''', 'ne change plus', 'une attestation émise ne change plus');
select tests.echoue('update public.attestations set statut = ''genere'' where id = ''att-1''', 'ne change plus', 'envoyée, elle le reste');
select tests.echoue('delete from public.attestations where id = ''att-1''', 'permission denied', 'une attestation ne se supprime pas');

-- ——— L'étudiant lit les siennes et en est prévenu ———
select tests.connecter(:W);
select tests.verifier((select count(*) = 2 from public.attestations), 'Awa lit ses deux attestations');
select tests.verifier(exists (select 1 from public.notifications where message = format('Nouveau document disponible : Certificat de scolarité (%s)', current_setting('essai.n1'))),
  'Awa est prévenue de son certificat');
select tests.connecter(:O);
select tests.verifier(not exists (select 1 from public.attestations), 'Ousmane ne lit pas les attestations d''Awa');

rollback;
