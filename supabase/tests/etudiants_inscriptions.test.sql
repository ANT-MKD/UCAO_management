-- Tests de la partie 4, lot 2 : matricules attribués par le serveur, fiche et dossier des
-- étudiants, inscriptions, classe qui a des étudiants, années clôturées.
-- Comptes d'essai : l'administrateur principal (A), la scolarité (S : ajout et liste des
-- étudiants), la caisse (F : nouvelle quittance), les bulletins (B : aucune page Étudiants), le
-- professeur Mamadou KANE (K), les étudiants Awa SECK (W) et Ousmane DIALLO (O).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-00000000000a'''
\set S '''00000000-0000-4000-8000-000000000021'''
\set F '''00000000-0000-4000-8000-000000000022'''
\set B '''00000000-0000-4000-8000-000000000023'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-000000000024'''
begin;

insert into auth.users (id, email) values
  (:A, 'adm.a@comptes.edumanage.invalid'), (:S, 'scol.s@comptes.edumanage.invalid'), (:F, 'caisse.f@comptes.edumanage.invalid'),
  (:B, 'bul.b@comptes.edumanage.invalid'), (:K, 'kane.k@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid'),
  (:O, 'ousmane.o@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-scolarite', 'ROLE_SCOLARITE', array['etudiants-ajouter', 'etudiants-liste']),
  ('role-caisse', 'ROLE_CAISSE', array['fin-quittance-nouvelle']),
  ('role-bulletins', 'ROLE_BULLETINS', array['bul-param']);
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM-PRINCIPAL', 'Fatou DIOP', null, null, false),
  (:S, 'administration', 'SCOL-1', 'Scolarité', null, 'role-scolarite', false),
  (:F, 'administration', 'CAISSE-1', 'Caisse', null, 'role-caisse', false),
  (:B, 'administration', 'BUL-1', 'Bulletins', null, 'role-bulletins', false),
  (:K, 'enseignant', 'ENS-2026-100', 'Mamadou KANE', 'en-kane', null, false);
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle, cloturee) values
  ('annee-2025', '2025-2026', '2025-11-03', '2026-07-31', false, false),
  ('annee-2026', '2026-2027', '2026-11-02', '2027-07-31', true, false);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values
  ('cl-l1-25', 'LQHSE1-25/26', 'fil-qhse', 'niv-l1', 'L1', 40, '2025-2026'),
  ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027'),
  ('cl-vide', 'LQHSE1B-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027');
update public.annees_academiques set cloturee = true where libelle = '2025-2026';
insert into public.modeles_frais (id, code, intitule) values ('mf-seed-4', 'NV', 'Nouveau');
insert into public.motifs_blocage (id, code, intitule, actions_interdites) values ('motif-impaye', 'IMPAYE', 'Impayé de scolarité', array['portail_etudiant']);

-- ——— Matricules attribués par le serveur ———
select tests.connecter(:S);
select tests.verifier(public.apercu_matricule('fil-qhse', '2026-2027') = '2026-LQHSE-0001'
  and public.apercu_matricule('fil-qhse', '2026-2027') = '2026-LQHSE-0001', 'l''aperçu annonce 2026-LQHSE-0001 sans le réserver');
select tests.verifier(public.attribuer_matricule('fil-qhse', '2026-2027') = '2026-LQHSE-0001', 'premier matricule de la Licence QHSE 2026 : 2026-LQHSE-0001');
select tests.verifier(public.attribuer_matricule('fil-qhse', '2026-2027') = '2026-LQHSE-0002', 'le suivant : 2026-LQHSE-0002, jamais deux fois le même');
select tests.echoue('select public.attribuer_matricule(''fil-inconnue'', ''2026-2027'')', 'Filière inconnue', 'un matricule vise une filière qui existe');
select tests.echoue('select public.attribuer_matricule(''fil-qhse'', ''2026'')', 'invalide', 'un matricule vise une année au format 2026-2027');
select tests.connecter(:B);
select tests.echoue('select public.attribuer_matricule(''fil-qhse'', ''2026-2027'')', 'pas accès', 'sans page Étudiants, pas de matricule');
select tests.anonyme();
select tests.echoue('select public.attribuer_matricule(''fil-qhse'', ''2026-2027'')', 'permission denied', 'un visiteur ne réserve pas de matricule');

-- ——— Inscription d'Awa SECK et d'Ousmane DIALLO ———
select tests.connecter(:S);
insert into public.etudiants (id, matricule, prenom, nom, sexe, filiere, filiere_id, classe, classe_id, niveau, statut, annee, annee_premiere_inscription) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'F', 'LQHSE', 'fil-qhse', 'LQHSE1-26/27', 'cl-l1', 'L1', 'inscrit', '2026-2027', 2026),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'M', 'LQHSE', 'fil-qhse', '', null, 'L1', 'preinscrit', '2026-2027', 2026);
insert into public.etudiants_dossiers (id, email, telephone, cni, adresse, nom_tuteur, tel_tuteur, documents_fournis, modele_frais_id) values
  ('et-awa', 'awa.seck@mail.sn', '770000001', '2 345 2005 00067', 'Dakar, Sicap', 'Mme SECK', '770000009', array['acte_naissance'], 'mf-seed-4'),
  ('et-ousmane', 'o.diallo@mail.sn', '770000002', '1 456 2004 00089', 'Thiès', 'M. DIALLO', '770000008', '{}', null);
insert into public.inscriptions (id, etudiant_id, annee, filiere, filiere_id, niveau, classe, classe_id, statut, type, modele_frais_id) values
  ('ins-awa-2026', 'et-awa', '2026-2027', 'LQHSE', 'fil-qhse', 'L1', 'LQHSE1-26/27', 'cl-l1', 'inscrit', 'premiere', 'mf-seed-4'),
  ('ins-ousmane-2026', 'et-ousmane', '2026-2027', 'LQHSE', 'fil-qhse', 'L1', '', null, 'preinscrit', 'premiere', null);
select tests.verifier(public.attribuer_matricule('fil-qhse', '2026-2027') = '2026-LQHSE-0003', 'troisième matricule : 2026-LQHSE-0003');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, statut, annee) values ('et-repris', '2026-LQHSE-0004', 'Dossier', 'REPRIS', 'fil-qhse', 'inscrit', '2026-2027');
select tests.verifier(public.attribuer_matricule('fil-qhse', '2026-2027') = '2026-LQHSE-0005', 'un matricule déjà pris par un dossier repris est sauté');
select tests.echoue('insert into public.etudiants (matricule, prenom, nom, filiere_id, statut, annee) values (''2026-lqhse-0001'', ''Faux'', ''DOUBLON'', ''fil-qhse'', ''inscrit'', ''2026-2027'')',
  'duplicate key', 'un matricule n''appartient qu''à un étudiant');
select tests.echoue('insert into public.etudiants (matricule, prenom, nom, filiere_id, classe_id, statut, annee) values (''2026-LQHSE-0090'', ''X'', ''Y'', ''fil-qhse'', ''cl-fantome'', ''inscrit'', ''2026-2027'')',
  'foreign key', 'un étudiant est affecté à une classe qui existe');
select tests.echoue('insert into public.inscriptions (etudiant_id, annee, filiere_id, statut, type) values (''et-awa'', ''2025-2026'', ''fil-qhse'', ''inscrit'', ''correction'')',
  'clôturée', 'pas d''inscription ajoutée à une année clôturée');
select tests.echoue('insert into public.inscriptions (etudiant_id, annee, filiere_id, statut, type) values (''et-awa'', ''2026-2027'', ''fil-qhse'', ''inscrit'', ''transfert'')',
  'check constraint', 'une inscription est une première inscription, une réinscription, une correction ou une bascule');
select tests.connecter(:B);
select tests.echoue('insert into public.etudiants (matricule, prenom, nom, filiere_id, statut, annee) values (''2026-LQHSE-0091'', ''X'', ''Y'', ''fil-qhse'', ''inscrit'', ''2026-2027'')',
  'row-level security', 'sans page Étudiants, pas d''inscription');

-- ——— Classe et année ———
select tests.connecter(:A);
select tests.echoue('delete from public.classes where id = ''cl-l1''', 'foreign key', 'une classe qui a des étudiants ne se supprime pas, même hors de l''application');
delete from public.classes where id = 'cl-vide';
select tests.verifier(not exists (select 1 from public.classes where id = 'cl-vide'), 'une classe vide se supprime');
select tests.echoue('update public.classes set max = 50 where id = ''cl-l1-25''', 'clôturée', 'une classe d''une année clôturée ne change plus');
insert into public.filieres (id, code, nom) values ('fil-gl', 'LGL', 'Licence Génie logiciel');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, statut, annee) values ('et-gl', '2026-LGL-0001', 'Moussa', 'NDIAYE', 'fil-gl', 'preinscrit', '2026-2027');
select tests.echoue('delete from public.filieres where id = ''fil-gl''', 'etudiants_filiere_id_fkey', 'une filière qui a des étudiants ne se supprime pas');

-- ——— La caisse affecte Ousmane à sa classe après paiement ———
select tests.connecter(:F);
update public.etudiants set classe_id = 'cl-l1', classe = 'LQHSE1-26/27', statut = 'inscrit' where id = 'et-ousmane';
update public.inscriptions set classe_id = 'cl-l1', classe = 'LQHSE1-26/27', statut = 'inscrit' where id = 'ins-ousmane-2026';
update public.etudiants_dossiers set inscription_unique_payee = true where id = 'et-ousmane';
select tests.verifier((select classe_id = 'cl-l1' from public.etudiants where id = 'et-ousmane')
  and (select inscription_unique_payee from public.etudiants_dossiers where id = 'et-ousmane'), 'la caisse affecte Ousmane à LQHSE1-26/27 une fois les frais payés');

-- ——— Ce que lit et modifie chacun ———
select tests.deconnecter();
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, doit_changer_mot_de_passe) values
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', false);
select tests.connecter(:S);
update public.etudiants_dossiers set motif_blocage_id = 'motif-impaye' where id = 'et-awa';
select tests.verifier((select motif_blocage_id = 'motif-impaye' from public.etudiants_dossiers where id = 'et-awa'), 'la scolarité bloque Awa pour impayé');
select tests.connecter(:W);
select tests.verifier((select array_agg(id) = array['et-awa'] from public.etudiants), 'Awa ne lit que sa propre fiche');
select tests.verifier((select array_agg(id) = array['et-awa'] from public.etudiants_dossiers), 'Awa ne lit que son propre dossier');
select tests.verifier((select array_agg(id) = array['ins-awa-2026'] from public.inscriptions), 'Awa ne lit que ses inscriptions');
update public.etudiants_dossiers set telephone = '771234567', adresse = 'Dakar, Mermoz' where id = 'et-awa';
select tests.verifier((select telephone = '771234567' and adresse = 'Dakar, Mermoz' from public.etudiants_dossiers where id = 'et-awa'), 'Awa met à jour son téléphone et son adresse');
select tests.echoue('update public.etudiants_dossiers set cni = ''0 000 0000 00000'' where id = ''et-awa''', 'que votre adresse',
  'Awa ne modifie pas sa CNI');
select tests.echoue('update public.etudiants_dossiers set motif_blocage_id = null, telephone = ''770000000'' where id = ''et-awa''', 'que votre adresse',
  'Awa ne lève pas un blocage en glissant une autre modification');
with u as (update public.etudiants set classe_id = null returning 1)
select tests.verifier((select count(*) from u) = 0, 'Awa ne change pas de classe elle-même');
with u as (update public.etudiants_dossiers set telephone = '770000000' where id = 'et-ousmane' returning 1)
select tests.verifier((select count(*) from u) = 0, 'Awa ne touche pas au dossier d''Ousmane');
select tests.connecter(:K);
select tests.verifier((select count(*) = 4 from public.etudiants), 'KANE lit les fiches (listes de classe)');
select tests.verifier(not exists (select 1 from public.etudiants_dossiers) and not exists (select 1 from public.inscriptions),
  'KANE ne lit ni les dossiers personnels ni les inscriptions');
select tests.connecter(:A);
select tests.echoue('delete from public.motifs_blocage where id = ''motif-impaye''', 'foreign key', 'un motif de blocage assigné à un étudiant ne se supprime pas');

-- ——— Journal et visiteurs ———
select tests.deconnecter();
select tests.verifier((select count(*) >= 6 from public.journal_audit where acteur = :S and cible_type in ('etudiants', 'etudiants_dossiers', 'inscriptions')),
  'les inscriptions sont journalisées au nom de la scolarité');
select tests.verifier((select count(*) >= 1 from public.journal_audit where acteur = :W and cible_type = 'etudiants_dossiers'),
  'la mise à jour du téléphone d''Awa est journalisée à son nom');
select tests.anonyme();
select tests.echoue('select * from public.etudiants', 'permission denied', 'un visiteur ne lit pas les étudiants');
select tests.deconnecter();

rollback;
