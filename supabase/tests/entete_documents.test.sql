-- Tests de l'en-tête et du pied de page des documents scolaires (Paramètres généraux → Documents
-- officiels) : forme d'en-tête, bannière et logo de droite dans l'espace de fichiers, lignes de
-- texte et pied de page contrôlés par la base, ville de « Fait à ».
-- Comptes d'essai : les paramètres généraux (G), le secrétariat (S), l'étudiante Awa SECK (W).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set G '''00000000-0000-4000-8000-000000000023'''
\set S '''00000000-0000-4000-8000-000000000021'''
\set W '''00000000-0000-4000-8000-00000000000e'''
begin;

insert into auth.users (id, email) values
  (:G, 'param.g@comptes.edumanage.invalid'), (:S, 'sec.s@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-parametres', 'ROLE_PARAMETRES', array['sec-settings']),
  ('role-secretariat', 'ROLE_SECRETARIAT', array['etudiants-liste']);
insert into public.etablissement (id, nom, adresse) values (1, 'Université Catholique de l''Afrique de l''Ouest', 'Route de Mont-Rolland, Thiès');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-11-02', '2027-07-31', true);
insert into public.filieres (id, code, nom) values ('fil-lpig', 'LPIG', 'Licence professionnelle en informatique de gestion');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, statut, annee) values
  ('et-awa', '2026-LPIG-0001', 'Awa', 'SECK', 'fil-lpig', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:G, 'administration', 'PARAM-1', 'Paramètres', null, 'role-parametres', false),
  (:S, 'administration', 'SEC-1', 'Secrétariat', null, 'role-secretariat', false),
  (:W, 'etudiant', '2026-LPIG-0001', 'Awa SECK', 'et-awa', null, false);
select set_config('storage.allow_delete_query', 'true', true);

-- ——— Valeurs de départ : la présentation livrée avec l'application ———
select tests.verifier((select entete_forme = 'standard' and banniere_chemin is null and logo_droit_chemin is null
    and entete_lignes = '[]'::jsonb and entete_cadre and pied_lignes = '[]'::jsonb and ville = '' from public.etablissement),
  'sans réglage, les documents gardent leur présentation actuelle');

-- ——— Bannière : déposée dans entete/, choisie par les paramètres généraux ———
select tests.connecter(:G);
insert into storage.objects (bucket_id, name) values ('etablissement', 'entete/banniere-ucao.png'), ('etablissement', 'entete/logo-isae.png');
update public.etablissement set entete_forme = 'banniere', banniere_chemin = 'entete/banniere-ucao.png',
  pied_lignes = '["Route de Mont-Rolland", "Tél. : (00221) 33 951 14 81", "isaet@ucao.edu.sn"]', ville = 'Thiès' where id = 1;
select tests.verifier((select entete_forme = 'banniere' and banniere_chemin = 'entete/banniere-ucao.png'
    and jsonb_array_length(pied_lignes) = 3 and ville = 'Thiès' from public.etablissement),
  'les paramètres généraux choisissent la bannière, le pied de page et la ville');
select tests.echoue('update public.etablissement set banniere_chemin = ''logo/banniere.png'' where id = 1', 'etablissement_banniere_chemin',
  'la bannière est rangée dans le dossier entete/');
select tests.echoue('update public.etablissement set logo_droit_chemin = ''signatures/bulletin/x.png'' where id = 1', 'etablissement_logo_droit_chemin',
  'le logo de droite est rangé dans le dossier entete/');
select tests.echoue('insert into storage.objects (bucket_id, name) values (''etablissement'', ''entete/sous/x.png'')', 'row-level security',
  'pas de sous-dossier dans entete/');
select tests.echoue('update public.etablissement set entete_forme = ''libre'' where id = 1', 'etablissement_entete_forme',
  'trois formes d''en-tête seulement');

-- ——— En-tête composé : lignes contrôlées par la base ———
update public.etablissement set entete_forme = 'compose', logo_droit_chemin = 'entete/logo-isae.png', entete_cadre = false, entete_lignes = '[
  {"texte": "Université Catholique de l''Afrique de l''Ouest", "taille": "grande", "style": "gras", "couleur": "bordeaux"},
  {"texte": "Faculté des Sciences de Gestion", "taille": "moyenne", "style": "normal", "couleur": "bordeaux"},
  {"texte": "Science - Foi - Action", "taille": "petite", "style": "italique", "couleur": "noir"},
  {"texte": "Institut Supérieur d''Administration des Entreprises Thiès", "taille": "moyenne", "style": "gras", "couleur": "bleu"}
]' where id = 1;
select tests.verifier((select entete_forme = 'compose' and jsonb_array_length(entete_lignes) = 4 and not entete_cadre from public.etablissement),
  'l''en-tête composé garde ses quatre lignes, le logo de droite et le choix du cadre');
select tests.echoue($$update public.etablissement set entete_lignes = (select jsonb_agg(jsonb_build_object('texte', 'Ligne ' || i, 'taille', 'petite', 'style', 'normal', 'couleur', 'noir')) from generate_series(1, 7) i) where id = 1$$,
  'etablissement_entete_lignes', 'six lignes d''en-tête au plus');
select tests.echoue($$update public.etablissement set entete_lignes = jsonb_build_array(jsonb_build_object('texte', repeat('x', 121), 'taille', 'petite', 'style', 'normal', 'couleur', 'noir')) where id = 1$$,
  'etablissement_entete_lignes', 'une ligne d''en-tête tient en 120 caractères');
select tests.echoue($$update public.etablissement set entete_lignes = '[{"texte": "UCAO", "taille": "enorme", "style": "gras", "couleur": "noir"}]' where id = 1$$,
  'etablissement_entete_lignes', 'trois tailles seulement');
select tests.echoue($$update public.etablissement set entete_lignes = '[{"texte": "UCAO", "taille": "grande", "style": "souligne", "couleur": "noir"}]' where id = 1$$,
  'etablissement_entete_lignes', 'trois styles seulement');
select tests.echoue($$update public.etablissement set entete_lignes = '[{"texte": "UCAO", "taille": "grande", "style": "gras", "couleur": "vert"}]' where id = 1$$,
  'etablissement_entete_lignes', 'trois couleurs seulement');
select tests.echoue($$update public.etablissement set entete_lignes = '[{"texte": "UCAO", "taille": "grande", "style": "gras", "couleur": "noir", "html": "<b>"}]' where id = 1$$,
  'etablissement_entete_lignes', 'une ligne ne porte que son texte, sa taille, son style et sa couleur');
select tests.echoue($$update public.etablissement set entete_lignes = '[{"texte": 12, "taille": "grande", "style": "gras", "couleur": "noir"}]' where id = 1$$,
  'etablissement_entete_lignes', 'le texte d''une ligne est du texte');
select tests.echoue($$update public.etablissement set entete_lignes = '["UCAO"]' where id = 1$$,
  'etablissement_entete_lignes', 'une ligne d''en-tête décrit son texte et sa présentation');
select tests.echoue($$update public.etablissement set entete_lignes = '{"texte": "UCAO"}' where id = 1$$,
  'etablissement_entete_lignes', 'les lignes d''en-tête forment une liste');

-- ——— Pied de page et ville ———
select tests.echoue($$update public.etablissement set pied_lignes = '["a", "b", "c", "d"]' where id = 1$$,
  'etablissement_pied_lignes', 'trois lignes de pied de page au plus');
select tests.echoue($$update public.etablissement set pied_lignes = jsonb_build_array(repeat('x', 161)) where id = 1$$,
  'etablissement_pied_lignes', 'une ligne de pied de page tient en 160 caractères');
select tests.echoue($$update public.etablissement set pied_lignes = '[{"texte": "Route"}]' where id = 1$$,
  'etablissement_pied_lignes', 'une ligne de pied de page est du texte');
select tests.echoue($$update public.etablissement set ville = repeat('x', 61) where id = 1$$,
  'etablissement_ville', 'la ville tient en 60 caractères');

-- ——— Les autres comptes lisent mais ne changent rien ———
select tests.connecter(:S);
with u as (update public.etablissement set entete_forme = 'standard', pied_lignes = '[]' where id = 1 returning 1)
select tests.verifier((select count(*) from u) = 0, 'le secrétariat ne change pas l''en-tête des documents');
select tests.echoue('insert into storage.objects (bucket_id, name) values (''etablissement'', ''entete/faux.png'')', 'row-level security',
  'le secrétariat ne dépose pas de bannière');
with d as (delete from storage.objects where bucket_id = 'etablissement' and name like 'entete/%' returning 1)
select tests.verifier((select count(*) from d) = 0, 'le secrétariat ne retire pas la bannière');
select tests.connecter(:W);
select tests.verifier((select entete_forme = 'compose' and logo_droit_chemin = 'entete/logo-isae.png' from public.etablissement)
    and (select count(*) = 2 from storage.objects where bucket_id = 'etablissement' and name like 'entete/%'),
  'Awa lit l''en-tête et ses images : elle imprime ses attestations et ses relevés');
select tests.echoue('insert into storage.objects (bucket_id, name) values (''etablissement'', ''entete/faux.png'')', 'row-level security',
  'Awa ne dépose pas de bannière');

-- ——— Les paramètres généraux remplacent la bannière ———
select tests.connecter(:G);
with d as (delete from storage.objects where bucket_id = 'etablissement' and name = 'entete/banniere-ucao.png' returning 1)
select tests.verifier((select count(*) from d) = 1, 'les paramètres généraux retirent l''ancienne bannière');
select tests.verifier((select modifie_par = :G from public.etablissement), 'la modification de l''en-tête garde son auteur');
select tests.deconnecter();

-- ——— Visiteurs ———
select tests.anonyme();
select tests.echoue('select entete_lignes from public.etablissement', 'permission denied', 'un visiteur ne lit pas l''en-tête');
select tests.deconnecter();

rollback;
