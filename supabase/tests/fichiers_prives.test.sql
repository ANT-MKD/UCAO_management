-- Tests de la partie 4, lot 3 : espace de fichiers privé (photos, pièces, logo, signatures).
-- Comptes d'essai : l'administrateur principal (A), le secrétariat (S : liste des étudiants), la
-- caisse (F : nouvelle quittance, qui affecte pourtant les étudiants à leur classe), le service des
-- professeurs (P), les paramètres généraux (G), les professeurs Mamadou KANE (K) et Ibrahima FALL
-- (L), les étudiants Awa SECK (W) et Ousmane DIALLO (O).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-00000000000a'''
\set S '''00000000-0000-4000-8000-000000000021'''
\set F '''00000000-0000-4000-8000-000000000022'''
\set P '''00000000-0000-4000-8000-000000000011'''
\set G '''00000000-0000-4000-8000-000000000023'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set L '''00000000-0000-4000-8000-000000000013'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
begin;

-- ——— Les espaces ———
select tests.verifier((select count(*) = 3 from storage.buckets
  where id in ('photos', 'pieces', 'etablissement') and not public and file_size_limit is not null and allowed_mime_types is not null),
  'trois espaces privés, chacun limité en taille et en types de fichiers');
select tests.verifier((select 'application/pdf' = any (allowed_mime_types) from storage.buckets where id = 'pieces')
  and (select not ('application/pdf' = any (allowed_mime_types)) from storage.buckets where id = 'photos'),
  'une pièce peut être un PDF, une photo non');

insert into auth.users (id, email) values
  (:A, 'adm.a@comptes.edumanage.invalid'), (:S, 'sec.s@comptes.edumanage.invalid'), (:F, 'caisse.f@comptes.edumanage.invalid'),
  (:P, 'prof.p@comptes.edumanage.invalid'), (:G, 'param.g@comptes.edumanage.invalid'), (:K, 'kane.k@comptes.edumanage.invalid'),
  (:L, 'fall.l@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid'), (:O, 'ousmane.o@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-secretariat', 'ROLE_SECRETARIAT', array['etudiants-liste']),
  ('role-caisse', 'ROLE_CAISSE', array['fin-quittance-nouvelle']),
  ('role-professeurs', 'ROLE_PROFESSEURS', array['prof-liste', 'prof-ajouter']),
  ('role-parametres', 'ROLE_PARAMETRES', array['sec-settings']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-11-02', '2027-07-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'inscrit', '2026-2027');
insert into public.etudiants_dossiers (id, telephone, documents_fournis) values ('et-awa', '770000001', array['photo']), ('et-ousmane', '770000002', '{}');
insert into public.enseignants (id, prenom, nom, matricule, grade) values
  ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire'), ('en-fall', 'Ibrahima', 'FALL', 'ENS-2026-101', 'Permanent');
insert into public.enseignants_dossiers (id, telephone, rib, taux_horaire) values
  ('en-kane', '77 000 00 01', 'SN012 01201 000000000001 01', 10000), ('en-fall', '77 000 00 03', 'SN012 01201 000000000003 03', 0);
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM-PRINCIPAL', 'Fatou DIOP', null, null, false),
  (:S, 'administration', 'SEC-1', 'Secrétariat', null, 'role-secretariat', false),
  (:F, 'administration', 'CAISSE-1', 'Caisse', null, 'role-caisse', false),
  (:P, 'administration', 'PROF-SERVICE', 'Service des professeurs', null, 'role-professeurs', false),
  (:G, 'administration', 'PARAM-1', 'Paramètres', null, 'role-parametres', false),
  (:K, 'enseignant', 'ENS-2026-100', 'Mamadou KANE', 'en-kane', null, false),
  (:L, 'enseignant', 'ENS-2026-101', 'Ibrahima FALL', 'en-fall', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false);
-- La base refuse la suppression directe d'un fichier hors de l'API de Supabase ; les essais de
-- suppression ci-dessous passent par la même règle d'accès.
select set_config('storage.allow_delete_query', 'true', true);

-- ——— Pièces : Awa dépose, le secrétariat vérifie ———
select tests.connecter(:W);
insert into storage.objects (bucket_id, name) values ('pieces', 'et-awa/cni/depot-1.jpg');
insert into public.pieces_etudiants (id, etudiant_id, piece, en_verification, depose_le)
  values ('et-awa:cni', 'et-awa', 'cni', 'et-awa/cni/depot-1.jpg', now());
select tests.verifier((select count(*) = 1 from storage.objects where bucket_id = 'pieces') and (select count(*) = 1 from public.pieces_etudiants),
  'Awa dépose sa CNI et la retrouve dans « Mes documents »');
select tests.echoue('insert into storage.objects (bucket_id, name) values (''pieces'', ''et-ousmane/cni/faux.jpg'')', 'row-level security',
  'Awa ne dépose rien dans le dossier d''Ousmane');
select tests.echoue('insert into public.pieces_etudiants (id, etudiant_id, piece, en_verification, depose_le) values (''et-awa:diplome'', ''et-awa'', ''diplome'', ''et-ousmane/diplome/d.pdf'', now())',
  'pieces_etudiants_chemins', 'Awa ne présente pas comme sienne une pièce rangée ailleurs');
select tests.echoue('update public.pieces_etudiants set fichier = en_verification, en_verification = null where id = ''et-awa:cni''', 'seul le secrétariat',
  'Awa n''accepte pas elle-même sa pièce');
select tests.echoue('insert into public.pieces_etudiants (id, etudiant_id, piece, en_verification, depose_le) values (''et-awa:photo'', ''et-awa'', ''photo'', ''et-awa/photo/p.jpg'', now())',
  'déjà comme fournie', 'Awa ne redépose pas une pièce déjà fournie');
with u as (update storage.objects set name = 'et-awa/cni/autre.jpg' where bucket_id = 'pieces' returning 1)
select tests.verifier((select count(*) from u) = 0, 'Awa ne réécrit pas un fichier déposé');
with d as (delete from storage.objects where bucket_id = 'pieces' returning 1)
select tests.verifier((select count(*) from d) = 0, 'Awa ne supprime pas le fichier qu''elle a déposé');
with d as (delete from public.pieces_etudiants returning 1)
select tests.verifier((select count(*) from d) = 0, 'Awa ne retire pas sa pièce du dossier');

select tests.connecter(:O);
select tests.verifier(not exists (select 1 from storage.objects where bucket_id = 'pieces') and not exists (select 1 from public.pieces_etudiants),
  'Ousmane ne voit ni le fichier ni la pièce d''Awa');
insert into storage.objects (bucket_id, name) values ('pieces', 'et-ousmane/cni/depot-1.pdf');
insert into public.pieces_etudiants (id, etudiant_id, piece, en_verification, depose_le)
  values ('et-ousmane:cni', 'et-ousmane', 'cni', 'et-ousmane/cni/depot-1.pdf', now());
select tests.connecter(:K);
select tests.verifier(not exists (select 1 from storage.objects where bucket_id = 'pieces') and not exists (select 1 from public.pieces_etudiants),
  'KANE ne voit aucune pièce d''étudiant');
select tests.connecter(:F);
select tests.verifier(not exists (select 1 from storage.objects where bucket_id = 'pieces') and not exists (select 1 from public.pieces_etudiants),
  'la caisse, qui affecte pourtant les étudiants, ne voit aucune pièce');
select tests.echoue('insert into storage.objects (bucket_id, name) values (''pieces'', ''et-awa/cni/caisse.jpg'')', 'row-level security',
  'la caisse ne dépose pas de pièce');

select tests.connecter(:S);
select tests.verifier((select count(*) = 2 from storage.objects where bucket_id = 'pieces') and (select count(*) = 2 from public.pieces_etudiants),
  'le secrétariat voit les pièces d''Awa et d''Ousmane');
update public.pieces_etudiants set fichier = en_verification, en_verification = null where id = 'et-awa:cni';
update public.etudiants_dossiers set documents_fournis = array_append(documents_fournis, 'cni') where id = 'et-awa';
update public.pieces_etudiants set en_verification = null, motif_refus = 'Scan illisible', refuse_le = now() where id = 'et-ousmane:cni';
with d as (delete from storage.objects where bucket_id = 'pieces' and name = 'et-ousmane/cni/depot-1.pdf' returning 1)
select tests.verifier((select count(*) from d) = 1, 'le secrétariat accepte la CNI d''Awa, refuse celle d''Ousmane et en retire le fichier');

select tests.connecter(:W);
select tests.verifier((select fichier = 'et-awa/cni/depot-1.jpg' from public.pieces_etudiants where id = 'et-awa:cni')
  and exists (select 1 from storage.objects where bucket_id = 'pieces' and name = 'et-awa/cni/depot-1.jpg'),
  'Awa voit sa CNI acceptée et peut encore l''ouvrir');
select tests.echoue('update public.pieces_etudiants set en_verification = ''et-awa/cni/depot-2.jpg'', depose_le = now() where id = ''et-awa:cni''', 'déjà comme fournie',
  'Awa ne remplace pas une pièce acceptée');
select tests.connecter(:O);
select tests.verifier((select motif_refus = 'Scan illisible' from public.pieces_etudiants where id = 'et-ousmane:cni'), 'Ousmane lit le motif du refus');
select tests.echoue('update public.pieces_etudiants set motif_refus = null, refuse_le = null where id = ''et-ousmane:cni''', 'seul le secrétariat',
  'Ousmane n''efface pas un refus sans redéposer');
insert into storage.objects (bucket_id, name) values ('pieces', 'et-ousmane/cni/depot-2.jpg');
insert into public.pieces_etudiants (id, etudiant_id, piece, en_verification, depose_le, motif_refus, refuse_le)
  values ('et-ousmane:cni', 'et-ousmane', 'cni', 'et-ousmane/cni/depot-2.jpg', now(), null, null)
  on conflict (id) do update set en_verification = excluded.en_verification, depose_le = excluded.depose_le,
    motif_refus = excluded.motif_refus, refuse_le = excluded.refuse_le;
select tests.verifier((select en_verification = 'et-ousmane/cni/depot-2.jpg' and motif_refus is null from public.pieces_etudiants where id = 'et-ousmane:cni'),
  'Ousmane redépose sa CNI, ce qui efface le refus');

-- ——— Photos ———
select tests.connecter(:W);
insert into storage.objects (bucket_id, name) values ('photos', 'etudiants/et-awa/p1.jpg');
update public.etudiants_dossiers set photo_chemin = 'etudiants/et-awa/p1.jpg' where id = 'et-awa';
select tests.verifier((select photo_chemin = 'etudiants/et-awa/p1.jpg' from public.etudiants_dossiers where id = 'et-awa'), 'Awa change sa photo');
select tests.echoue('insert into storage.objects (bucket_id, name) values (''photos'', ''etudiants/et-ousmane/p.jpg'')', 'row-level security',
  'Awa ne change pas la photo d''Ousmane');
select tests.echoue('update public.etudiants_dossiers set photo_chemin = ''etudiants/et-ousmane/p.jpg'' where id = ''et-awa''', 'etudiants_dossiers_photo_chemin',
  'Awa ne prend pas la photo d''un autre comme la sienne');
select tests.echoue('insert into storage.objects (bucket_id, name) values (''photos'', ''p-a-la-racine.jpg'')', 'row-level security',
  'une photo est rangée dans le dossier de sa fiche');
select tests.connecter(:O);
select tests.verifier(not exists (select 1 from storage.objects where bucket_id = 'photos'), 'Ousmane ne voit pas la photo d''Awa');
select tests.connecter(:S);
select tests.verifier(exists (select 1 from storage.objects where bucket_id = 'photos' and name = 'etudiants/et-awa/p1.jpg'), 'le secrétariat voit la photo d''Awa');
insert into storage.objects (bucket_id, name) values ('photos', 'etudiants/et-ousmane/p1.jpg');

select tests.connecter(:K);
insert into storage.objects (bucket_id, name) values ('photos', 'enseignants/en-kane/k1.jpg');
select tests.echoue('insert into public.enseignants_dossiers (id, telephone) values (''en-kane'', ''77 000 00 09'') on conflict (id) do update set telephone = excluded.telephone',
  'row-level security', 'KANE ne crée pas de dossier (l''application lui envoie une simple mise à jour)');
-- L'application renvoie toute la ligne : seuls le téléphone, l'adresse et la photo changent.
update public.enseignants_dossiers set telephone = '77 000 00 09', adresse = 'Dakar, Fann', photo_chemin = 'enseignants/en-kane/k1.jpg',
  rib = 'SN012 01201 000000000001 01', taux_horaire = 10000 where id = 'en-kane';
select tests.verifier((select telephone = '77 000 00 09' and photo_chemin = 'enseignants/en-kane/k1.jpg' from public.enseignants_dossiers where id = 'en-kane'),
  'KANE met à jour son téléphone, son adresse et sa photo depuis son profil');
select tests.echoue('update public.enseignants_dossiers set rib = ''SN000 PIRATE'' where id = ''en-kane''', 'votre photo',
  'KANE ne change toujours pas son RIB');
select tests.echoue('update public.enseignants_dossiers set taux_horaire = 50000, telephone = ''770000000'' where id = ''en-kane''', 'votre photo',
  'KANE ne glisse pas une hausse de son taux avec son téléphone');
with u as (update public.enseignants_dossiers set telephone = '770000000' where id = 'en-fall' returning 1)
select tests.verifier((select count(*) from u) = 0, 'KANE ne touche pas au dossier de FALL');
select tests.verifier(not exists (select 1 from storage.objects where bucket_id = 'photos' and name like 'etudiants/%'),
  'KANE ne voit pas les photos des étudiants (la partie 5 ouvrira ses seules classes)');
select tests.connecter(:L);
select tests.verifier(not exists (select 1 from storage.objects where bucket_id = 'photos'), 'FALL ne voit pas la photo de KANE');
select tests.echoue('insert into storage.objects (bucket_id, name) values (''photos'', ''enseignants/en-kane/faux.jpg'')', 'row-level security',
  'FALL ne change pas la photo de KANE');
select tests.connecter(:P);
select tests.verifier(exists (select 1 from storage.objects where bucket_id = 'photos' and name = 'enseignants/en-kane/k1.jpg'), 'le service des professeurs voit la photo de KANE');
insert into storage.objects (bucket_id, name) values ('photos', 'enseignants/en-fall/f1.jpg');
select tests.connecter(:W);
with d as (delete from storage.objects where bucket_id = 'photos' and name = 'etudiants/et-awa/p1.jpg' returning 1)
select tests.verifier((select count(*) from d) = 1, 'Awa retire son ancienne photo');

-- ——— Logo et signatures ———
select tests.connecter(:G);
insert into storage.objects (bucket_id, name) values ('etablissement', 'logo/ucao.png'), ('etablissement', 'signatures/bulletin/recteur.png');
update public.etablissement set logo_chemin = 'logo/ucao.png' where id = 1;
insert into public.signatures_documents (id, actif, signataire_nom, signataire_qualite, image_chemin)
  values ('bulletin', true, 'Pr Jean NDIAYE', 'Le Recteur', 'signatures/bulletin/recteur.png');
select tests.echoue('update public.etablissement set logo_chemin = ''photos/ucao.png'' where id = 1', 'etablissement_logo_chemin',
  'le logo est rangé avec les fichiers de l''établissement');
select tests.echoue('update public.signatures_documents set image_chemin = ''signatures/reussite/r.png'' where id = ''bulletin''', 'signatures_documents_image_chemin',
  'la signature du bulletin est rangée avec le bulletin');
select tests.echoue('insert into storage.objects (bucket_id, name) values (''etablissement'', ''divers/x.png'')', 'row-level security',
  'l''espace de l''établissement ne garde que le logo et les signatures');
select tests.connecter(:W);
select tests.verifier((select count(*) = 2 from storage.objects where bucket_id = 'etablissement'),
  'Awa lit le logo et la signature (elle imprime ses attestations)');
select tests.echoue('insert into storage.objects (bucket_id, name) values (''etablissement'', ''logo/faux.png'')', 'row-level security',
  'Awa ne change pas le logo');
select tests.connecter(:S);
with d as (delete from storage.objects where bucket_id = 'etablissement' returning 1)
select tests.verifier((select count(*) from d) = 0, 'le secrétariat ne retire pas le logo');

-- ——— Suppression, journal, visiteurs ———
select tests.connecter(:A);
delete from public.etudiants where id = 'et-ousmane';
select tests.verifier(not exists (select 1 from public.pieces_etudiants where etudiant_id = 'et-ousmane'), 'une fiche supprimée emporte ses pièces');
select tests.deconnecter();
select tests.verifier((select count(*) >= 2 from public.journal_audit where cible_type = 'pieces_etudiants' and acteur = :S),
  'chaque décision du secrétariat sur une pièce est journalisée');
select tests.verifier((select count(*) >= 1 from public.journal_audit where cible_type = 'pieces_etudiants' and acteur = :W),
  'chaque dépôt d''Awa est journalisé');
select tests.anonyme();
select tests.verifier(not exists (select 1 from storage.objects), 'un visiteur ne voit aucun fichier');
select tests.echoue('select * from public.pieces_etudiants', 'permission denied', 'un visiteur ne lit pas les pièces');
select tests.deconnecter();

rollback;
