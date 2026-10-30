-- Tests de la partie 3, lot 4 : listes de départ, paramétrage de l'emploi du temps, des finances,
-- de la communication et des signatures.
-- Comptes d'essai : l'administrateur principal (A), la planification (E : emploi du temps),
-- Aminata NDIAYE aux finances (F : paramétrage et grille tarifaire), la communication (C), le
-- professeur Mamadou KANE (K), l'étudiante Awa SECK (W).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-00000000000a'''
\set E '''00000000-0000-4000-8000-000000000001'''
\set F '''00000000-0000-4000-8000-000000000002'''
\set C '''00000000-0000-4000-8000-000000000003'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set W '''00000000-0000-4000-8000-00000000000e'''
begin;

insert into auth.users (id, email) values
  (:A, 'adm.a@comptes.edumanage.invalid'), (:E, 'edt.e@comptes.edumanage.invalid'), (:F, 'fin.f@comptes.edumanage.invalid'),
  (:C, 'com.c@comptes.edumanage.invalid'), (:K, 'kane.k@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-planification', 'ROLE_PLANIFICATION', array['edt-param']),
  ('role-finances', 'ROLE_FINANCES', array['fin-param', 'fin-grille-frais']),
  ('role-communication', 'ROLE_COMMUNICATION', array['com-param']);
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM-PRINCIPAL', 'Fatou DIOP', null, null, false),
  (:E, 'administration', 'PLANIF-1', 'Planification', null, 'role-planification', false),
  (:F, 'administration', 'FIN-NDIAYE', 'Aminata NDIAYE', null, 'role-finances', false),
  (:C, 'administration', 'COM-1', 'Communication', null, 'role-communication', false),
  (:K, 'enseignant', 'PROF-KANE', 'Mamadou KANE', 'en-kane', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false);
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle, cloturee) values
  ('annee-2025', '2025-2026', '2025-11-03', '2026-07-31', false, true),
  ('annee-2026', '2026-2027', '2026-11-02', '2027-07-31', true, false);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');

-- ——— Listes de départ ———
select tests.verifier(not exists (select 1 from public.modes_paiement), 'avant l''installation, aucune liste de départ');
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
select tests.verifier((select count(*) from public.cycles) = 4 and (select count(*) from public.categories_cours) = 6
  and (select count(*) from public.types_evaluation) = 5 and (select count(*) from public.regroupements_devoir) = 2
  and (select count(*) from public.types_seance) = 4 and (select count(*) from public.types_frais) = 5
  and (select count(*) from public.modes_paiement) = 6 and (select count(*) from public.modeles_frais) = 4,
  'à l''installation, la base pose les listes de départ de l''application');
select tests.verifier((select type_evaluation_ids = array['type-eval-COMPOSITION', 'type-eval-EXAMEN'] from public.regroupements_devoir where id = 'regroupement-devoir-ef'),
  'le regroupement « Examen » désigne bien les types Composition et Examen');
update public.modes_paiement set intitule = 'Espèces' where id = 'mp-seed-3';
select private.poser_valeurs_depart();
select tests.verifier((select count(*) = 6 from public.modes_paiement) and (select intitule = 'Espèces' from public.modes_paiement where id = 'mp-seed-3'),
  'reposer les listes de départ n''ajoute rien et n''écrase pas une valeur modifiée');

-- ——— Emploi du temps ———
select tests.connecter(:E);
insert into public.jours_feries (id, intitule, date_debut, date_fin) values ('jf-tabaski', 'Tabaski', '2027-05-17', '2027-05-18');
select tests.echoue('insert into public.jours_feries (intitule, date_debut, date_fin) values (''Inversé'', ''2027-05-18'', ''2027-05-17'')', 'jours_feries_dates_ordonnees',
  'un jour férié finit après son début');
insert into public.types_seance (code, intitule, categorie) values ('SOUT', 'Soutenance', 'evenement');
select tests.echoue('insert into public.types_seance (code, intitule, categorie) values (''X'', ''X'', ''fete'')', 'check constraint',
  'un type de séance est un cours ou un événement');
select tests.echoue('insert into public.types_frais (code, intitule) values (''X'', ''Pirate'')', 'row-level security',
  'la planification ne crée pas de type de frais');
select tests.connecter(:K);
select tests.verifier((select intitule = 'Tabaski' from public.jours_feries where id = 'jf-tabaski'), 'KANE voit la Tabaski dans son cahier de séance');
select tests.echoue('insert into public.jours_feries (intitule, date_debut, date_fin) values (''Congé'', ''2027-01-02'', ''2027-01-03'')', 'row-level security',
  'KANE ne se donne pas de jour férié');

-- ——— Finances ———
select tests.connecter(:F);
insert into public.modes_paiement (id, code, intitule) values ('mp-free', 'FREE', 'Free Money');
insert into public.banques (id, code, intitule, numero_compte) values ('bq-cbao', 'CBAO', 'CBAO Groupe Attijariwafa', 'SN012 01201 036182657602 87');
select tests.echoue('insert into public.articles_service (code, intitule, prix_unitaire) values (''TSH'', ''Tee-shirt'', -500)', 'check constraint',
  'un article n''a pas de prix négatif');
insert into public.grilles_frais (id, filiere_id, niveau, annee, modele_frais_id, lignes) values
  ('fil-qhse:L1:2026-2027:mf-seed-4', 'fil-qhse', 'L1', '2026-2027', 'mf-seed-4',
   '[{"id": "l1", "typeFraisId": "tf-seed-4", "intitule": "Frais généraux", "montant": 350000, "modalite": "echeances", "nbEcheances": 8}]');
select tests.echoue('insert into public.grilles_frais (id, filiere_id, niveau, annee, modele_frais_id) values (''g2'', ''fil-qhse'', ''L1'', ''2026-2027'', ''mf-inconnu'')',
  'foreign key', 'une grille suit un modèle de frais qui existe');
select tests.echoue('insert into public.grilles_frais (id, filiere_id, niveau, annee, modele_frais_id) values (''g3'', ''fil-qhse'', ''L1'', ''2025-2026'', ''mf-seed-4'')',
  'clôturée', 'pas de grille ajoutée à une année clôturée');
select tests.echoue('insert into public.grilles_frais (id, filiere_id, niveau, annee, modele_frais_id, lignes) values (''g4'', ''fil-qhse'', ''L2'', ''2026-2027'', ''mf-seed-4'', ''{"montant": 1}'')',
  'check constraint', 'les lignes d''une grille forment une liste');
select tests.echoue('delete from public.modeles_frais where id = ''mf-seed-4''', 'foreign key', 'un modèle de frais utilisé par une grille ne se supprime pas');
select tests.connecter(:W);
select tests.verifier((select (lignes -> 0 ->> 'montant')::numeric = 350000 from public.grilles_frais where id = 'fil-qhse:L1:2026-2027:mf-seed-4'),
  'Awa lit la grille de frais de sa classe');
with u as (update public.grilles_frais set lignes = '[]' returning 1)
select tests.verifier((select count(*) from u) = 0, 'Awa ne vide pas la grille');

-- ——— Communication ———
select tests.connecter(:C);
insert into public.groupes_externes (id, nom, code, contacts) values
  ('grp-ext-parents', 'Parents délégués', 'PAR', '[{"intitule": "M. SECK", "telephone": "77 000 00 02", "email": ""}]');
insert into public.groupes_internes (id, nom, type, ref_id, annee) values ('grp-int-qhse', 'Licence QHSE — 2026-2027', 'programme', 'fil-qhse', '2026-2027');
insert into public.roles_communication (id, role, compte_id, compte_libelle) values ('com-role-kane', 'validateur_message', :K, 'Mamadou KANE');
select tests.echoue('insert into public.roles_communication (role, compte_id, compte_libelle) values (''validateur_message'', ' || quote_literal(:K) || ', ''KANE'')',
  'duplicate key', 'KANE n''est désigné qu''une fois validateur des messages');
insert into public.roles_communication (role, compte_id, compte_libelle) values ('validateur_rallonge', :K, 'Mamadou KANE');
insert into public.notifications_evenementielles (id, code, description, actif, envoyer_etudiant, branche_reellement)
  values ('notif-evt-1', 'NOTIFICATION_ABSENCE', 'Envoi notification après constat absence étudiant', true, true, true);
update public.notifications_evenementielles set actif = false where id = 'notif-evt-1';
select tests.echoue('insert into public.signatures_documents (id, actif) values (''bulletin'', true)', 'row-level security',
  'la communication ne règle pas les signatures');
select tests.connecter(:W);
select tests.verifier((select not actif from public.notifications_evenementielles where code = 'NOTIFICATION_ABSENCE'),
  'Awa voit que la notification d''absence est désactivée');
select tests.verifier(not exists (select 1 from public.groupes_externes) and not exists (select 1 from public.groupes_internes),
  'Awa ne lit pas les groupes (téléphones et emails des contacts)');
select tests.verifier((select count(*) = 2 from public.roles_communication where compte_id = :K), 'Awa sait qui valide (ses demandes de rallonge)');
select tests.echoue('insert into public.notifications_evenementielles (code) values (''NOTIFICATION_PIRATE'')', 'row-level security',
  'Awa ne crée pas de notification automatique');

-- ——— Signatures ———
select tests.connecter(:A);
insert into public.signatures_documents (id, actif, signataire_nom, signataire_qualite) values ('bulletin', true, 'Pr Jean NDIAYE', 'Le Recteur');
select tests.echoue('insert into public.signatures_documents (id) values (''diplome'')', 'check constraint',
  'une signature vise un document que l''application produit');
select tests.connecter(:W);
select tests.verifier((select signataire_qualite = 'Le Recteur' from public.signatures_documents where id = 'bulletin'),
  'Awa lit le signataire de son bulletin');

-- ——— Journal et visiteurs ———
select tests.deconnecter();
select tests.verifier((select count(*) >= 3 from public.journal_audit where acteur = :F and cible_type in ('modes_paiement', 'banques', 'grilles_frais')),
  'les changements des finances sont journalisés au nom d''Aminata NDIAYE');
select tests.verifier((select count(*) >= 5 from public.journal_audit where acteur = :C), 'les changements de la communication sont journalisés');
select tests.anonyme();
select tests.echoue('select * from public.modes_paiement', 'permission denied', 'un visiteur ne lit pas les modes de paiement');
select tests.deconnecter();

rollback;
