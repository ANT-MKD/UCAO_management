-- Tests des textes d'attestation réglables (Paramètres généraux → Textes des attestations) :
-- modèles contrôlés par la base (champs connus, nom et matricule obligatoires, limites), écrits par
-- les paramètres généraux seulement, et copie figée du modèle dans chaque attestation émise.
-- Comptes d'essai : les paramètres généraux (G), les attestations (B), l'étudiante Awa SECK (W).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set G '''00000000-0000-4000-8000-000000000023'''
\set B '''00000000-0000-4000-8000-000000000091'''
\set W '''00000000-0000-4000-8000-00000000000e'''
begin;

insert into auth.users (id, email) values
  (:G, 'param.g@comptes.edumanage.invalid'), (:B, 'attestations.b@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-parametres', 'ROLE_PARAMETRES', array['sec-settings']),
  ('role-attestations', 'ROLE_ATTESTATIONS', array['bul-attestations']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true);
insert into public.filieres (id, code, nom) values ('fil-lpig', 'LPIG', 'Licence professionnelle en informatique de gestion');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l3', 'Licence 3', 'L3', 'fil-lpig');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values ('cl-ig3', 'IG3-26/27', 'fil-lpig', 'niv-l3', 'L3', 40, '2026-2027');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LPIG-0001', 'Awa', 'SECK', 'fil-lpig', 'cl-ig3', 'L3', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:G, 'administration', 'PARAM-1', 'Paramètres', null, 'role-parametres', false),
  (:B, 'administration', 'ATTEST-1', 'Attestations', null, 'role-attestations', false),
  (:W, 'etudiant', '2026-LPIG-0001', 'Awa SECK', 'et-awa', null, false);

-- ——— Textes de départ ———
select tests.verifier((select count(*) = 3 from public.modeles_attestations), 'trois textes de départ : inscription, scolarité, réussite');
select tests.verifier((select titre = 'CERTIFICAT D''INSCRIPTION' and paragraphes -> 1 ->> 'texte' = '{NOM}' and (paragraphes -> 1 ->> 'centre')::boolean
    from public.modeles_attestations where id = 'inscription'),
  'le certificat d''inscription reprend celui de l''établissement : le nom centré sur sa ligne');

-- ——— Les paramètres généraux écrivent les textes ———
select tests.connecter(:G);
update public.modeles_attestations set titre = 'CERTIFICAT D''INSCRIPTION', paragraphes = '[
  {"texte": "Je soussigné, {soussigne}, certifie que :", "centre": false},
  {"texte": "{NOM}", "centre": true},
  {"texte": "{Ne} le {date_naissance} à {lieu_naissance}", "centre": true},
  {"texte": "de nationalité {nationalite}, est {inscrit} en classe de {niveau} de {filiere} sous le matricule {matricule}, pour l''année académique {annee}.", "centre": false}
]' where id = 'inscription';
select tests.verifier((select jsonb_array_length(paragraphes) = 4 and paragraphes -> 0 ->> 'texte' like 'Je soussigné, %' from public.modeles_attestations where id = 'inscription'),
  'les paramètres généraux réécrivent le certificat d''inscription');
select tests.echoue($$update public.modeles_attestations set paragraphes = '[{"texte": "{nom} est inscrit.", "centre": false}]' where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'le matricule de l''étudiant est obligatoire');
select tests.echoue($$update public.modeles_attestations set paragraphes = '[{"texte": "Matricule {matricule}.", "centre": false}]' where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'le nom de l''étudiant est obligatoire');
select tests.echoue($$update public.modeles_attestations set paragraphes = '[{"texte": "{nom} ({matricule}) : {telephone}", "centre": false}]' where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'un champ inconnu est refusé');
select tests.echoue($$update public.modeles_attestations set paragraphes = '[{"texte": "{nom} ({matricule}) a obtenu {moyenne}/20", "centre": false}]' where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'la moyenne n''existe que dans l''attestation de réussite');
select tests.echoue($$update public.modeles_attestations set paragraphes = '[{"texte": "{nom} ({matricule}) {matricule", "centre": false}]' where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'une accolade seule est refusée');
select tests.echoue($$update public.modeles_attestations set paragraphes = '[{"texte": "{nom} ({matricule})", "centre": "oui"}]' where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'l''alignement est vrai ou faux');
select tests.echoue($$update public.modeles_attestations set paragraphes = '[{"texte": "{nom} ({matricule})", "centre": false, "style": "<b>"}]' where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'un paragraphe ne porte que son texte et son alignement');
select tests.echoue($$update public.modeles_attestations set paragraphes = jsonb_build_array(jsonb_build_object('texte', '{nom} {matricule} ' || repeat('x', 600), 'centre', false)) where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'un paragraphe tient en 600 caractères');
select tests.echoue($$update public.modeles_attestations set paragraphes = (select jsonb_agg(jsonb_build_object('texte', '{nom} {matricule}', 'centre', false)) from generate_series(1, 13)) where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'douze paragraphes au plus');
select tests.echoue($$update public.modeles_attestations set paragraphes = '[]' where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'un texte a au moins un paragraphe');
select tests.echoue($$update public.modeles_attestations set paragraphes = '{"texte": "{nom} {matricule}"}' where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'les paragraphes forment une liste');
select tests.echoue($$update public.modeles_attestations set titre = '  ' where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'un texte a un titre');
select tests.echoue($$update public.modeles_attestations set titre = repeat('X', 81) where id = 'scolarite'$$,
  'modeles_attestations_contenu', 'le titre tient en 80 caractères');
update public.modeles_attestations set paragraphes = '[{"texte": "{NOM}, matricule {matricule}, {decision} avec {moyenne}/20 au {semestre}.", "centre": false}]' where id = 'reussite';
select tests.verifier((select paragraphes -> 0 ->> 'texte' like '%{moyenne}%' from public.modeles_attestations where id = 'reussite'),
  'l''attestation de réussite cite le semestre, la moyenne et la décision');
select tests.echoue($$insert into public.modeles_attestations (id, titre, paragraphes) values ('passage', 'CERTIFICAT DE PASSAGE', '[{"texte": "{nom} {matricule}", "centre": false}]')$$,
  'modeles_attestations_id_check', 'trois attestations seulement');
select tests.echoue($$delete from public.modeles_attestations where id = 'scolarite'$$, 'permission denied',
  'un texte ne se supprime pas (le texte d''origine se rétablit en le réécrivant)');

-- ——— Les autres comptes lisent sans écrire ———
select tests.connecter(:B);
with u as (update public.modeles_attestations set titre = 'AUTRE' where id = 'inscription' returning 1)
select tests.verifier((select count(*) from u) = 0, 'la page Attestations ne change pas les textes');
select tests.connecter(:W);
select tests.verifier((select count(*) = 3 from public.modeles_attestations), 'Awa lit les textes (elle imprime ses attestations)');
with u as (update public.modeles_attestations set titre = 'AUTRE' where id = 'inscription' returning 1)
select tests.verifier((select count(*) from u) = 0, 'Awa ne change pas les textes');

-- ——— Copie figée à l'émission ———
select tests.connecter(:B);
select set_config('essai.n1', public.attribuer_numero_attestation(), true);
insert into public.attestations (id, numero, etudiant_id, etudiant, matricule, classe_id, classe, filiere_id, filiere, annee, type, type_label, statut, effectue_par, modele)
  values ('att-1', current_setting('essai.n1'), 'et-awa', 'Awa SECK', '2026-LPIG-0001', 'cl-ig3', 'IG3-26/27', 'fil-lpig', 'Licence professionnelle', '2026-2027',
          'inscription', 'Attestation d''inscription', 'genere', 'Attestations', '{"titre": "FAUX", "paragraphes": []}');
select tests.verifier((select modele ->> 'titre' = 'CERTIFICAT D''INSCRIPTION' and jsonb_array_length(modele -> 'paragraphes') = 4
    and modele -> 'paragraphes' -> 0 ->> 'texte' = 'Je soussigné, {soussigne}, certifie que :' from public.attestations where id = 'att-1'),
  'à l''émission, la base copie le texte du moment (ce que le poste envoie est ignoré)');
select tests.connecter(:G);
update public.modeles_attestations set titre = 'ATTESTATION D''INSCRIPTION', paragraphes = '[{"texte": "{nom}, matricule {matricule}.", "centre": false}]' where id = 'inscription';
select tests.connecter(:B);
select tests.verifier((select modele ->> 'titre' = 'CERTIFICAT D''INSCRIPTION' and jsonb_array_length(modele -> 'paragraphes') = 4 from public.attestations where id = 'att-1'),
  'le texte d''une attestation émise ne change pas quand le modèle change');
update public.attestations set statut = 'envoyee', modele = null where id = 'att-1';
select tests.verifier((select statut = 'envoyee' and modele ->> 'titre' = 'CERTIFICAT D''INSCRIPTION' from public.attestations where id = 'att-1'),
  'l''envoi se note ; le texte figé reste, même si le poste l''envoie vide');
-- Comme l'application : la ligne entière renvoyée (insertion ou mise à jour), avec un autre texte.
insert into public.attestations (id, numero, etudiant_id, etudiant, matricule, classe_id, classe, filiere_id, filiere, annee, type, type_label, statut, effectue_par, modele)
  select id, numero, etudiant_id, etudiant, matricule, classe_id, classe, filiere_id, filiere, annee, type, type_label, 'envoyee', effectue_par, '{"titre": "AUTRE", "paragraphes": []}'
  from public.attestations where id = 'att-1'
  on conflict (id) do update set statut = excluded.statut, modele = excluded.modele;
select tests.verifier((select statut = 'envoyee' and modele ->> 'titre' = 'CERTIFICAT D''INSCRIPTION' and jsonb_array_length(modele -> 'paragraphes') = 4
    from public.attestations where id = 'att-1'),
  'renvoyée en entier par le poste, l''attestation note son envoi et garde son texte figé');
select tests.echoue($$insert into public.attestations (id, numero, etudiant_id, etudiant, matricule, classe_id, annee, type, type_label, statut)
    select id, numero, etudiant_id, etudiant, matricule, classe_id, annee, type, 'Autre', statut from public.attestations where id = 'att-1'
    on conflict (id) do update set type_label = excluded.type_label$$, 'ne change plus', 'renvoyée en entier, elle ne change pas pour autant');
select tests.echoue($$insert into public.attestations (id, numero, etudiant_id, etudiant, matricule, classe_id, annee, type, type_label, statut)
    values ('att-x', current_setting('essai.n1'), 'et-awa', 'Awa SECK', '2026-LPIG-0001', 'cl-ig3', '2026-2027', 'inscription', 'Attestation d''inscription', 'envoyee')
    on conflict (id) do update set statut = excluded.statut$$, 'abord émise', 'une nouvelle attestation n''arrive pas déjà envoyée');
select tests.echoue($$update public.attestations set type_label = 'Autre' where id = 'att-1'$$, 'ne change plus',
  'le reste de l''attestation émise ne change toujours pas');
select set_config('essai.n2', public.attribuer_numero_attestation(), true);
insert into public.attestations (id, numero, etudiant_id, etudiant, matricule, classe_id, annee, type, type_label, statut)
  values ('att-2', current_setting('essai.n2'), 'et-awa', 'Awa SECK', '2026-LPIG-0001', 'cl-ig3', '2026-2027', 'inscription', 'Attestation d''inscription', 'genere');
select tests.verifier((select modele ->> 'titre' = 'ATTESTATION D''INSCRIPTION' from public.attestations where id = 'att-2'),
  'l''attestation suivante prend le nouveau texte');
select tests.connecter(:W);
select tests.verifier((select count(*) = 2 and bool_and(modele is not null) from public.attestations), 'Awa lit ses attestations avec leur texte figé');
select tests.deconnecter();

-- ——— Journal, visiteurs ———
select tests.verifier((select count(*) >= 3 from public.journal_audit where cible_type = 'modeles_attestations' and acteur = :G),
  'chaque modification d''un texte est journalisée avec son auteur');
select tests.anonyme();
select tests.echoue('select * from public.modeles_attestations', 'permission denied', 'un visiteur ne lit pas les textes');
select tests.deconnecter();

rollback;
