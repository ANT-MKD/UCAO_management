-- Tests de la partie 10, lot 3 : trace des sauvegardes hors de Supabase.
-- Comptes d'essai : Ibrahima FALL, administrateur principal (A) ; la scolarité (S, accès limité).
-- Tout se passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-0000000000f3'''
\set S '''00000000-0000-4000-8000-0000000000f4'''
begin;

insert into auth.users (id, email) values (:A, 'adm.f3@comptes.edumanage.invalid'), (:S, 'scol.f4@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values ('role-scol-sauv', 'ROLE_SCOL_SAUV', array['sec-users']);
insert into public.comptes (id, type_compte, identifiant, nom_affiche, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM', 'Ibrahima FALL', null, false),
  (:S, 'administration', 'SCOL-1', 'Scolarité', 'role-scol-sauv', false);

-- ——— Fonctions réservées à la fonction serveur ———
select tests.connecter(:A);
select tests.echoue(format('select private.noter_sauvegarde(%L, 1000, 0)', :A), 'permission denied', 'même l''administrateur principal ne note pas une sauvegarde lui-même');
select tests.echoue(format('select private.noter_export(%L)', :A), 'permission denied', 'ni un export');
select tests.deconnecter();

-- ——— Appelées par la fonction serveur (propriétaire de la base) ———
select tests.echoue(format('select private.noter_export(%L)', :S), 'accès complet', 'un export pour la scolarité est refusé');
select tests.echoue(format('select private.noter_sauvegarde(%L, 1000, 0)', :S), 'accès complet', 'une sauvegarde par la scolarité est refusée');
select private.noter_export(:A);
select tests.verifier((select count(*) = 1 from public.journal_audit where action = 'export_sauvegarde' and acteur = :A and details like '%mots de passe chiffrés%'),
  'chaque export des données est inscrit au journal, en disant qu''il contient les mots de passe chiffrés');
select tests.echoue(format('select private.noter_sauvegarde(%L, 0, 0)', :A), 'Sauvegarde incomplète', 'une sauvegarde vide n''est pas notée');
select tests.echoue(format('select private.noter_sauvegarde(%L, 1000, -1)', :A), 'Sauvegarde incomplète', 'ni un nombre de fichiers négatif');
select private.noter_sauvegarde(:A, 52000000, 310);
select tests.verifier((select count(*) = 1 and bool_and(octets = 52000000 and fichiers = 310 and par = :A) from private.sauvegardes),
  'la sauvegarde terminée est notée (taille, fichiers, auteur)');
select tests.verifier((select count(*) = 1 from public.journal_audit where action = 'sauvegarde' and details = 'sauvegarde chiffrée de 52000000 octets, 310 fichier(s)'),
  'et inscrite au journal');

-- ——— Date de la dernière sauvegarde, pour le rappel ———
select tests.connecter(:A);
create temporary table etat_sauvegarde on commit drop as select public.etat_service() as e;
select tests.deconnecter();
select tests.verifier((select (e ->> 'derniere_sauvegarde')::timestamptz = (select max(le) from private.sauvegardes) from etat_sauvegarde),
  'l''état du service donne la date de la dernière sauvegarde');
select tests.verifier(not has_table_privilege('authenticated', 'private.sauvegardes', 'select'), 'aucun compte ne lit la liste des sauvegardes');

rollback;
