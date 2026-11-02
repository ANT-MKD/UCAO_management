-- Tests de la partie 9, lot 4 : remise à zéro de l'environnement de test.
-- Une campagne de recette a eu lieu : Ibrahima FALL (A) a installé, repris les données d'un poste
-- (Awa SECK, W), et la base a numéroté, journalisé, compté des tentatives de connexion. Tout se
-- passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-0000000000d1'''
\set W '''00000000-0000-4000-8000-0000000000d2'''
begin;

insert into auth.users (id, email) values (:A, 'adm.d@comptes.edumanage.invalid'), (:W, 'awa.d@comptes.edumanage.invalid');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, doit_changer_mot_de_passe) values (:A, 'administration', 'ADM', 'Ibrahima FALL', false);
insert into public.annees_academiques (id, libelle, actuelle) values ('an-2026', '2026-2027', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, statut, annee) values ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id) values (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa');
update public.portails set ouvert = false, message = 'Recette en cours', modifie_par = :A where type_compte = 'etudiant';
insert into public.journal_audit (acteur, action, cible_type, cible_id) values (:A, 'installation', 'compte', :A);
insert into public.notifications (destinataire, message) values (:W, 'Bienvenue');
insert into private.compteurs (cle, valeur) values ('matricule:2026-LQHSE', 1);
insert into private.reprises (par, annee, rapport) values (:A, '2026-2027', '{}');
insert into private.tentatives_connexion (identifiant, echecs, derniere_tentative) values ('KANE', 2, now());

-- ——— Refus ———
select tests.echoue('select private.remettre_a_zero_test(''REMETTRE A ZERO'')', 'pas marqué comme environnement de test',
  'un projet sans marque (la production) ne se remet jamais à zéro');
insert into private.environnement (nom) values ('production');
select tests.echoue('select private.remettre_a_zero_test(''REMETTRE A ZERO'')', 'pas marqué comme environnement de test',
  'un projet marqué « production » non plus');
update private.environnement set nom = 'test';
select tests.echoue('select private.remettre_a_zero_test(''oui'')', 'REMETTRE A ZERO', 'il faut la confirmation écrite en entier');
select tests.echoue('insert into private.environnement (id, nom) values (false, ''test'')', 'check', 'le projet n''a qu''une seule marque');
select tests.connecter(:A);
select tests.echoue('select private.remettre_a_zero_test(''REMETTRE A ZERO'')', 'permission denied',
  'même l''administrateur principal ne la lance pas depuis l''application');
select tests.deconnecter();

-- ——— Remise à zéro ———
create temporary table resultat on commit drop as select private.remettre_a_zero_test('REMETTRE A ZERO') as r;
select tests.verifier((select (r ->> 'identites_supprimees')::int = 2 and (r ->> 'lignes_effacees')::int >= 10 and (r ->> 'fichiers_a_retirer')::int = 0 from resultat),
  'le compte rendu donne les lignes effacées, les identités supprimées et les fichiers à retirer');
select tests.verifier(not exists (select 1 from public.comptes) and not exists (select 1 from public.etudiants) and not exists (select 1 from public.annees_academiques)
  and not exists (select 1 from public.journal_audit) and not exists (select 1 from public.notifications), 'toutes les données de la campagne sont effacées, journal compris');
select tests.verifier(not exists (select 1 from private.compteurs) and not exists (select 1 from private.reprises) and not exists (select 1 from private.tentatives_connexion),
  'numérotation, trace de la reprise et tentatives de connexion repartent de zéro (une nouvelle reprise est possible)');
select tests.verifier(not exists (select 1 from auth.users), 'les identités Supabase sont supprimées');
select tests.verifier((select array_agg(type_compte || ':' || ouvert || ':' || message order by type_compte) from public.portails)
  = array['administration:true:', 'enseignant:true:', 'etudiant:true:'], 'les trois portails sont rouverts, comme après l''installation');
select tests.verifier((select nom from private.environnement) = 'test', 'la marque « test » reste');
select tests.verifier((select public.etat_installation() ->> 'installee') = 'false', 'l''application propose à nouveau l''installation');

rollback;
