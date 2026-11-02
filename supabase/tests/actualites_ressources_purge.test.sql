-- Tests de la partie 8, lot 3 : actualités, ressources pédagogiques, purge des notifications.
-- Comptes d'essai : la communication (P, page « Publicité et actualité »), la scolarité (S, sans
-- cette page), Mamadou KANE (K, cours en L1), Ibrahima FALL (L, cours en L2), les étudiants Awa SECK
-- (W) et Ousmane DIALLO (O, qui a abandonné) en L1, Fatou SOW (F) en L2. Transaction annulée.
\set ON_ERROR_STOP on
\set P '''00000000-0000-4000-8000-0000000000b1'''
\set S '''00000000-0000-4000-8000-0000000000b2'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set L '''00000000-0000-4000-8000-000000000013'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
\set F '''00000000-0000-4000-8000-0000000000b3'''
begin;

insert into auth.users (id, email) values
  (:P, 'communication.p@comptes.edumanage.invalid'), (:S, 'scolarite.s@comptes.edumanage.invalid'), (:K, 'kane.k@comptes.edumanage.invalid'),
  (:L, 'fall.l@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid'), (:O, 'ousmane.o@comptes.edumanage.invalid'), (:F, 'fatou.f@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values ('role-pub', 'ROLE_PUB', array['com-publicite']), ('role-scol', 'ROLE_SCOL', array['com-demandes']);
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse'), ('niv-l2', 'Licence 2', 'L2', 'fil-qhse');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values
  ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027'), ('cl-l2', 'LQHSE2-26/27', 'fil-qhse', 'niv-l2', 'L2', 40, '2026-2027');
insert into public.ues (id, code, libelle, credits, filiere_id, niveau, semestre) values
  ('ue-l1', 'UE11', 'Fondamentaux QHSE', 6, 'fil-qhse', 'L1', 'S1'), ('ue-l2', 'UE21', 'Management', 6, 'fil-qhse', 'L2', 'S3');
insert into public.ecs (id, code, libelle, ue_id, credits, vht) values ('ec-qualite', 'QHSE111', 'Qualité', 'ue-l1', 3, 30), ('ec-mgt', 'QHSE211', 'Management', 'ue-l2', 3, 30);
insert into public.enseignants (id, prenom, nom, matricule, grade) values
  ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire'), ('en-fall', 'Ibrahima', 'FALL', 'ENS-2026-101', 'Permanent');
insert into public.seances (id, ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, prof_id, annee) values
  ('se-kane-1', 'ec-qualite', 'cl-l1', 1, '2026-11-02', '08:00', '10:00', 'en-kane', '2026-2027'),
  ('se-fall-1', 'ec-mgt', 'cl-l2', 2, '2026-11-02', '08:00', '10:00', 'en-fall', '2026-2027');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l1', 'L1', 'abandon', '2026-2027'),
  ('et-fatou', '2026-LQHSE-0003', 'Fatou', 'SOW', 'fil-qhse', 'cl-l2', 'L2', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:P, 'administration', 'PUB-1', 'Communication', null, 'role-pub', false),
  (:S, 'administration', 'SCOL-1', 'Scolarité', null, 'role-scol', false),
  (:K, 'enseignant', 'KANE', 'Mamadou KANE', 'en-kane', null, false),
  (:L, 'enseignant', 'FALL', 'Ibrahima FALL', 'en-fall', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false),
  (:F, 'etudiant', '2026-LQHSE-0003', 'Fatou SOW', 'et-fatou', null, false);

create temp table diffusions_essai (canal text, tab text);
create or replace function private.envoyer_diffusion(p_canal text, p_table text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  insert into pg_temp.diffusions_essai values (p_canal, p_table);
end;
$$;

-- ——— Actualités ———
select tests.connecter(:P);
insert into public.actualites (id, type_contenu, profil_cible, titre, description, ordre, date_debut, date_fin, image_chemin, auteur_id, auteur_label, cree_le)
  values ('pub-rentree', 'image', 'student', 'Rentrée 2026', 'Bienvenue', 1, current_date - 1, current_date + 30, 'pub-rentree/banniere.png', :S, 'Autre', '2020-01-01');
insert into public.actualites (id, type_contenu, profil_cible, titre, date_debut, date_fin, lien_externe) values
  ('pub-profs', 'url', 'teacher', 'Réunion pédagogique', current_date, current_date + 7, 'https://ucao.invalid/reunion'),
  ('pub-tous', 'video', 'tous', 'Portes ouvertes', current_date, current_date + 7, 'https://ucao.invalid/video'),
  ('pub-passee', 'url', 'student', 'Inscriptions closes', current_date - 30, current_date - 1, 'https://ucao.invalid/inscriptions');
select tests.verifier((select auteur_id = :P and auteur_label = 'Communication' and cree_le > now() - interval '1 minute' from public.actualites where id = 'pub-rentree'),
  'une actualité est signée et datée par la base');
select tests.echoue('insert into public.actualites (id, type_contenu, profil_cible, titre, date_debut, date_fin) values (''pub-x'', ''image'', ''tous'', ''Sans image'', current_date, current_date)',
  'actualites_contenu', 'une actualité « image » a son image, les autres leur lien');
select tests.echoue('insert into public.actualites (id, type_contenu, profil_cible, titre, date_debut, date_fin, lien_externe) values (''pub-x'', ''url'', ''tous'', ''Dates'', current_date, current_date - 1, ''https://ucao.invalid'')',
  'actualites_dates', 'elle finit après son début');
select tests.echoue('insert into public.actualites (id, type_contenu, profil_cible, titre, date_debut, date_fin, image_chemin) values (''pub-x'', ''image'', ''tous'', ''Image'', current_date, current_date, ''pub-rentree/banniere.png'')',
  'actualites_image_rangee', 'son image est rangée dans son propre dossier');
insert into storage.objects (bucket_id, name, owner_id) values ('actualites', 'pub-rentree/banniere.png', :P);
select tests.connecter(:S);
select tests.echoue('insert into public.actualites (id, type_contenu, profil_cible, titre, date_debut, date_fin, lien_externe) values (''pub-x'', ''url'', ''tous'', ''Info'', current_date, current_date, ''https://ucao.invalid'')',
  'row-level security', 'sans la page « Publicité et actualité », pas de rédaction');
select tests.echoue(format('insert into storage.objects (bucket_id, name, owner_id) values (''actualites'', ''pub-x/image.png'', %L)', :S),
  'row-level security', 'ni de dépôt d''image');
select tests.verifier((select count(*) = 4 from public.actualites), 'l''administration lit toutes les actualités (pour les gérer)');
select tests.verifier(tests.lignes('update public.actualites set titre = ''Autre'' where id = ''pub-tous''') = 0 and tests.lignes('delete from public.actualites where id = ''pub-tous''') = 0,
  'sans la page, elle ne les modifie ni ne les retire');
select tests.connecter(:W);
select tests.verifier((select array_agg(id order by id) from public.actualites) = array['pub-rentree', 'pub-tous'],
  'Awa lit celles des étudiants et de tous, pas celles des professeurs ni les terminées');
select tests.verifier((select count(*) = 1 from storage.objects where bucket_id = 'actualites'), 'et voit leur image');
select tests.connecter(:K);
select tests.verifier((select array_agg(id order by id) from public.actualites) = array['pub-profs', 'pub-tous'], 'KANE lit celles des professeurs et de tous');
select tests.anonyme();
select tests.echoue('select count(*) from public.actualites', 'permission denied', 'un visiteur ne lit rien');
select tests.connecter(:P);
update public.actualites set titre = 'Rentrée 2026-2027', cree_le = '2020-01-01' where id = 'pub-rentree';
select tests.verifier((select titre = 'Rentrée 2026-2027' and cree_le > now() - interval '1 minute' from public.actualites where id = 'pub-rentree'),
  'la page modifie une actualité ; sa date de création ne change pas');
delete from public.actualites where id = 'pub-passee';
select tests.verifier(not exists (select 1 from public.actualites where id = 'pub-passee'), 'et la retire');

-- ——— Ressources pédagogiques ———
select tests.connecter(:K);
insert into public.ressources_pedagogiques (id, classe_id, classe, ec_id, ec, titre, url, ajoute_par, ajoute_par_id, ajoute_le)
  values ('res-lien', 'cl-l1', 'LQHSE1-26/27', 'ec-qualite', 'Qualité', 'Norme ISO 9001', 'https://iso.invalid/9001', 'Autre', :L, '2020-01-01');
select tests.verifier((select ajoute_par_id = :K and ajoute_par = 'Mamadou KANE' and ajoute_le > now() - interval '1 minute' from public.ressources_pedagogiques where id = 'res-lien'),
  'une ressource est déposée au nom de son auteur, datée par la base');
insert into storage.objects (bucket_id, name, owner_id) values ('ressources', 'cl-l1/res-cours/cours.pdf', :K);
insert into public.ressources_pedagogiques (id, classe_id, classe, titre, nom, fichier_chemin, taille_octets)
  values ('res-cours', 'cl-l1', 'LQHSE1-26/27', 'Cours chapitre 1', 'cours.pdf', 'cl-l1/res-cours/cours.pdf', 120000);
select tests.echoue('insert into public.ressources_pedagogiques (id, classe_id, titre, url) values (''res-x'', ''cl-l2'', ''Autre classe'', ''https://ucao.invalid'')',
  'row-level security', 'KANE ne dépose rien pour une classe où il n''enseigne pas');
select tests.echoue(format('insert into storage.objects (bucket_id, name, owner_id) values (''ressources'', ''cl-l2/res-x/a.pdf'', %L)', :K),
  'row-level security', 'ni dans son espace de fichiers');
select tests.echoue('insert into public.ressources_pedagogiques (id, classe_id, titre) values (''res-x'', ''cl-l1'', ''Vide'')',
  'ressources_fichier_ou_lien', 'une ressource est un fichier ou un lien');
select tests.echoue('insert into public.ressources_pedagogiques (id, classe_id, titre, nom, fichier_chemin) values (''res-x'', ''cl-l1'', ''Ailleurs'', ''a.pdf'', ''cl-l1/res-autre/a.pdf'')',
  'ressources_fichier_range', 'son fichier est rangé dans son propre dossier');
select tests.echoue('update public.ressources_pedagogiques set titre = ''Autre'' where id = ''res-lien''', 'permission denied', 'une ressource ne se modifie pas');
select tests.deconnecter();
select tests.verifier((select count(*) = 2 from public.notifications where destinataire = :W and starts_with(message, 'Nouvelle ressource pédagogique'))
    and exists (select 1 from public.notifications where destinataire = :W and message = 'Nouvelle ressource pédagogique en Qualité : « Norme ISO 9001 ».')
    and not exists (select 1 from public.notifications where destinataire in (:O, :F)),
  'la base prévient les étudiants de la classe (pas Ousmane, qui a abandonné, ni Fatou, en L2)');
select tests.verifier(exists (select 1 from pg_temp.diffusions_essai where canal = 'compte:' || :W and tab = 'ressources_pedagogiques'),
  'en direct : Awa voit arriver la ressource');
select tests.connecter(:W);
select tests.verifier((select count(*) = 2 from public.ressources_pedagogiques), 'Awa lit les ressources de sa classe');
select tests.verifier((select count(*) = 1 from storage.objects where bucket_id = 'ressources'), 'et leurs fichiers');
select tests.verifier(tests.lignes('delete from public.ressources_pedagogiques') = 0, 'elle n''en retire aucune');
select tests.connecter(:F);
select tests.verifier(not exists (select 1 from public.ressources_pedagogiques) and not exists (select 1 from storage.objects where bucket_id = 'ressources'),
  'Fatou, en L2, ne lit rien des L1');
select tests.connecter(:L);
select tests.verifier(not exists (select 1 from public.ressources_pedagogiques), 'FALL non plus');
select tests.connecter(:S);
select tests.verifier((select count(*) = 2 from public.ressources_pedagogiques), 'l''administration les lit');
select tests.connecter(:K);
delete from public.ressources_pedagogiques where id = 'res-cours';
select tests.verifier(not exists (select 1 from public.ressources_pedagogiques where id = 'res-cours'), 'KANE retire sa ressource');
select tests.verifier(private.fichier_orphelin('ressources', 'cl-l1/res-cours/cours.pdf', :K::text)
    and not private.fichier_orphelin('ressources', 'cl-l1/res-cours/cours.pdf', :L::text),
  'son fichier, qu''aucune ressource ne désigne plus, se retire par lui (règle de retrait)');
select tests.connecter(:S);
select tests.verifier(private.fichier_orphelin('ressources', 'cl-l1/res-cours/cours.pdf', :K::text), 'ou par l''administration');
select tests.connecter(:P);
select tests.verifier(not private.fichier_orphelin('actualites', 'pub-rentree/banniere.png', :P::text)
    and private.fichier_orphelin('actualites', 'pub-ancienne/vieille.png', :K::text),
  'une image d''actualité se retire quand plus rien ne la désigne, par la page « Publicité et actualité »');

-- ——— Purge des notifications ———
select tests.deconnecter();
delete from public.notifications where destinataire in (:P, :S, :K, :L, :W, :O, :F);
insert into public.notifications (destinataire, message, lue, lue_le, archivee) values
  (:W, 'Vieille, lue', true, now() - interval '100 days', false),
  (:W, 'Vieille, lue, rangée', true, now() - interval '100 days', true),
  (:W, 'Récente, lue', true, now() - interval '10 days', false),
  (:W, 'Vieille, pas lue', false, null, false);
select private.purger_notifications();
select tests.verifier((select array_agg(message order by message) from public.notifications where destinataire = :W)
    = array['Récente, lue', 'Vieille, lue, rangée', 'Vieille, pas lue'],
  'la purge retire les notifications lues depuis plus de 90 jours, pas les rangées ni les autres');
create function pg_temp.purge_programmee() returns boolean language plpgsql as $$
declare
  v boolean;
begin
  if to_regclass('cron.job') is null then
    return null;
  end if;
  execute 'select exists (select 1 from cron.job where jobname = ''edumanage-purge-notifications'' and schedule = ''17 3 * * *''
    and command = ''select private.purger_notifications()'' and active)' into v;
  return v;
end $$;
select tests.verifier(pg_temp.purge_programmee(), 'la purge est programmée chaque nuit à 3 h 17') where pg_temp.purge_programmee() is not null;
select tests.verifier(true, 'purge programmée : vérifiée sur Supabase seulement (pas de pg_cron ici)') where pg_temp.purge_programmee() is null;

rollback;
