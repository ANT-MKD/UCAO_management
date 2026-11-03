-- Tests de la partie 9, lot 1 : contacts, documents, mémos et abandons.
-- Comptes d'essai : la scolarité (S, gère les étudiants et les abandons), la gestion des
-- professeurs (G), la caisse sans page de dossier (C ; sa page de quittance gère tout de même les
-- étudiants, d'où un rôle limité aux réductions), Mamadou KANE (K) et les étudiants Awa SECK (W) et
-- Ousmane DIALLO (O). Tout se passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set S '''00000000-0000-4000-8000-0000000000c1'''
\set G '''00000000-0000-4000-8000-0000000000c2'''
\set C '''00000000-0000-4000-8000-0000000000c3'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
begin;

insert into auth.users (id, email) values
  (:S, 'scolarite.s@comptes.edumanage.invalid'), (:G, 'professeurs.g@comptes.edumanage.invalid'), (:C, 'caisse.c@comptes.edumanage.invalid'),
  (:K, 'kane.k@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid'), (:O, 'ousmane.o@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-scol', 'ROLE_SCOL', array['etudiants-liste', 'scol-abandon']),
  ('role-prof', 'ROLE_PROF', array['prof-liste']),
  ('role-caisse', 'ROLE_CAISSE', array['fin-reduction-frais']);
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027');
insert into public.enseignants (id, prenom, nom, matricule, grade) values ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:S, 'administration', 'SCOL-1', 'Scolarité', null, 'role-scol', false),
  (:G, 'administration', 'PROF-1', 'Gestion des professeurs', null, 'role-prof', false),
  (:C, 'administration', 'CAISSE-1', 'Caisse', null, 'role-caisse', false),
  (:K, 'enseignant', 'KANE', 'Mamadou KANE', 'en-kane', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false);

-- ——— Contacts ———
select tests.connecter(:S);
insert into public.contacts_etudiants (id, etudiant_id, role, nom_complet, telephone) values
  ('ct-pere', 'et-awa', 'pere', 'Moussa SECK', '+221 77 000 00 10'), ('ct-tuteur', 'et-ousmane', 'tuteur', 'Aliou DIALLO', '+221 77 000 00 11');
update public.contacts_etudiants set telephone = '+221 77 000 00 12' where id = 'ct-pere';
select tests.verifier((select telephone = '+221 77 000 00 12' from public.contacts_etudiants where id = 'ct-pere'), 'la scolarité tient les contacts des étudiants');
select tests.connecter(:C);
select tests.verifier((select count(*) = 2 from public.contacts_etudiants), 'l''administration les lit');
select tests.echoue('insert into public.contacts_etudiants (id, etudiant_id, role, nom_complet) values (''ct-x'', ''et-awa'', ''mere'', ''Fatou SECK'')',
  'row-level security', 'sans page qui gère les étudiants, on n''en ajoute pas');
select tests.connecter(:W);
select tests.verifier((select array_agg(id) from public.contacts_etudiants) = array['ct-pere'], 'Awa lit ses propres contacts, pas ceux d''Ousmane');
select tests.echoue('insert into public.contacts_etudiants (id, etudiant_id, role, nom_complet) values (''ct-x'', ''et-awa'', ''mere'', ''Fatou SECK'')',
  'row-level security', 'elle ne les modifie pas');
select tests.connecter(:K);
select tests.verifier(not exists (select 1 from public.contacts_etudiants), 'un professeur ne les lit pas');

-- ——— Documents ———
select tests.connecter(:S);
insert into storage.objects (bucket_id, name, owner_id) values ('dossiers', 'etudiants/et-awa/doc-cni/cni.pdf', :S);
insert into public.documents_dossiers (id, entite_type, entite_id, nom, fichier_chemin, taille_octets, ajoute_par, ajoute_le)
  values ('doc-cni', 'etudiant', 'et-awa', 'cni.pdf', 'etudiants/et-awa/doc-cni/cni.pdf', 120000, 'Autre', '2020-01-01');
select tests.verifier((select ajoute_par = 'Scolarité' and ajoute_le > now() - interval '1 minute' from public.documents_dossiers where id = 'doc-cni'),
  'un document est signé et daté par la base');
select tests.echoue('insert into public.documents_dossiers (id, entite_type, entite_id, nom, fichier_chemin) values (''doc-x'', ''etudiant'', ''et-inconnu'', ''a.pdf'', ''etudiants/et-inconnu/doc-x/a.pdf'')',
  'n''existe pas', 'un document vise un dossier qui existe');
select tests.echoue('insert into public.documents_dossiers (id, entite_type, entite_id, nom, fichier_chemin) values (''doc-x'', ''etudiant'', ''et-awa'', ''a.pdf'', ''etudiants/et-ousmane/doc-x/a.pdf'')',
  'documents_fichier_range', 'son fichier est rangé dans son dossier');
select tests.echoue('insert into public.documents_dossiers (id, entite_type, entite_id, nom, fichier_chemin) values (''doc-x'', ''enseignant'', ''en-kane'', ''contrat.pdf'', ''enseignants/en-kane/doc-x/contrat.pdf'')',
  'row-level security', 'la scolarité ne dépose rien dans le dossier d''un professeur');
select tests.echoue(format('insert into storage.objects (bucket_id, name, owner_id) values (''dossiers'', ''enseignants/en-kane/doc-x/contrat.pdf'', %L)', :S),
  'row-level security', 'ni dans son espace de fichiers');
select tests.connecter(:G);
insert into storage.objects (bucket_id, name, owner_id) values ('dossiers', 'enseignants/en-kane/doc-contrat/contrat.pdf', :G);
insert into public.documents_dossiers (id, entite_type, entite_id, nom, fichier_chemin) values ('doc-contrat', 'enseignant', 'en-kane', 'contrat.pdf', 'enseignants/en-kane/doc-contrat/contrat.pdf');
select tests.verifier((select count(*) = 2 from public.documents_dossiers) and (select count(*) = 2 from storage.objects where bucket_id = 'dossiers'),
  'la gestion des professeurs dépose le contrat de KANE ; l''administration lit les documents et leurs fichiers');
select tests.verifier(tests.lignes('delete from public.documents_dossiers where id = ''doc-cni''') = 0, 'elle ne retire pas un document d''étudiant');
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.documents_dossiers) and not exists (select 1 from storage.objects where bucket_id = 'dossiers'),
  'ni Awa ni personne hors administration ne lit les documents des dossiers');
select tests.connecter(:K);
select tests.verifier(not exists (select 1 from public.documents_dossiers), 'KANE non plus (même le sien)');
select tests.connecter(:S);
delete from public.documents_dossiers where id = 'doc-cni';
select tests.verifier(not exists (select 1 from public.documents_dossiers where id = 'doc-cni'), 'la scolarité retire un document d''étudiant');
select tests.verifier(private.fichier_orphelin('dossiers', 'etudiants/et-awa/doc-cni/cni.pdf', :G::text)
    and not private.fichier_orphelin('dossiers', 'enseignants/en-kane/doc-contrat/contrat.pdf', :S::text),
  'son fichier se retire alors (par qui gère ces dossiers), pas celui d''un document encore là (règle de retrait)');

-- ——— Mémos ———
select tests.connecter(:S);
insert into public.memos_dossiers (id, entite_type, entite_id, type, date, objet, contenu, auteur)
  values ('memo-1', 'etudiant', 'et-awa', 'Discipline', '2026-11-02', 'Retards répétés', 'Convoquée le 05/11.', 'Scolarité');
select tests.echoue('update public.memos_dossiers set contenu = ''Autre'' where id = ''memo-1''', 'permission denied', 'un mémo ne se modifie pas');
select tests.connecter(:C);
select tests.verifier(not exists (select 1 from public.memos_dossiers), 'les mémos ne se lisent que depuis les pages qui gèrent ces dossiers');
select tests.connecter(:G);
select tests.verifier(not exists (select 1 from public.memos_dossiers), 'la gestion des professeurs ne lit pas les mémos des étudiants');
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.memos_dossiers), 'Awa ne lit pas les mémos de son dossier');
select tests.connecter(:S);
delete from public.memos_dossiers where id = 'memo-1';
select tests.verifier(not exists (select 1 from public.memos_dossiers), 'la scolarité retire un mémo');

-- ——— Abandons ———
select tests.connecter(:S);
insert into public.abandons (id, etudiant_id, matricule, nom, prenom, filiere, niveau, classe, classe_id, annee, sessions_abandonnees, cumul_paye, cumul_impaye,
  statut_avant, date_abandon, motif, valide_par_id, valide_par_label, reintegre, date_reintegration)
  values ('aband-1', 'et-ousmane', '2026-LQHSE-0002', 'DIALLO', 'Ousmane', 'LQHSE', 'L1', 'LQHSE1-26/27', 'cl-l1', '2026-2027', array['S1'], 40000, 60000,
    'inscrit', '2026-11-02', 'Raisons familiales', :C, 'Autre', true, '2026-11-02');
select tests.verifier((select valide_par_id = :S and valide_par_label = 'Scolarité' and not reintegre and date_reintegration is null from public.abandons where id = 'aband-1'),
  'un abandon est validé au nom de qui l''enregistre, sans réintégration');
select tests.echoue('insert into public.abandons (id, etudiant_id, date_abandon, motif) values (''aband-2'', ''et-ousmane'', ''2026-11-03'', ''Encore'')',
  'abandons_un_actif', 'un seul abandon actif par étudiant');
update public.abandons set cumul_impaye = 0, motif = 'Autre motif' where id = 'aband-1';
select tests.verifier((select cumul_impaye = 60000 and motif = 'Raisons familiales' from public.abandons where id = 'aband-1'), 'la situation figée ne change pas');
update public.abandons set reintegre = true, reintegre_par_label = '' where id = 'aband-1';
select tests.verifier((select reintegre and date_reintegration = current_date and reintegre_par_label = 'Scolarité' from public.abandons where id = 'aband-1'),
  'la réintégration se note, datée, au nom de qui la fait');
select tests.echoue('update public.abandons set reintegre = false, date_reintegration = null where id = ''aband-1''', 'déjà réintégré', 'une réintégration ne s''annule pas');
insert into public.abandons (id, etudiant_id, date_abandon, motif) values ('aband-2', 'et-ousmane', '2026-11-20', 'Départ à l''étranger');
select tests.verifier((select count(*) = 2 from public.abandons), 'réintégré, l''étudiant peut avoir un nouvel abandon');
select tests.echoue('delete from public.abandons where id = ''aband-1''', 'permission denied', 'un abandon ne se supprime jamais');
select tests.connecter(:C);
select tests.verifier((select count(*) = 2 from public.abandons), 'l''administration lit les abandons');
select tests.echoue('insert into public.abandons (id, etudiant_id, date_abandon, motif) values (''aband-x'', ''et-awa'', ''2026-11-20'', ''Test'')',
  'row-level security', 'sans la page « Abandon », on n''en enregistre pas');
select tests.connecter(:O);
select tests.verifier(not exists (select 1 from public.abandons), 'l''étudiant ne lit pas son dossier d''abandon');

rollback;
