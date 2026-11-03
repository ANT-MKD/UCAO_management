-- Tests de la partie 3, lot 2 : rôles journalisés, pages des portails, motifs de blocage.
-- Comptes d'essai : l'administrateur principal (A), un compte « Portails et paramètres » limité
-- (P), l'étudiante Awa SECK (W).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-00000000000a'''
\set P '''00000000-0000-4000-8000-00000000000b'''
\set W '''00000000-0000-4000-8000-00000000000e'''
begin;

insert into auth.users (id, email) values
  (:A, 'adm.a@comptes.edumanage.invalid'), (:P, 'sec.p@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values ('role-securite', 'ROLE_SECURITE', array['sec-portails', 'sec-settings']);
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM-PRINCIPAL', 'Fatou DIOP', null, null, false),
  (:P, 'administration', 'SEC-PORTAILS', 'Sécurité', null, 'role-securite', false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false);

-- ——— Rôles ———
select tests.connecter(:A);
insert into public.roles (id, code, description, pages, auteur) values ('role-caisse', 'ROLE_CAISSE', 'Caisse', array['fin-enc-liste'], :A);
update public.roles set pages = array['fin-enc-liste', 'fin-enc-declares'] where id = 'role-caisse';
select tests.deconnecter();
select tests.verifier((select count(*) = 2 from public.journal_audit where cible_type = 'roles' and acteur = :A and cible_id = 'role-caisse'),
  'création et changement de pages d''un rôle journalisés au nom de l''administrateur');
select tests.connecter(:A);
select tests.echoue('delete from public.roles where id = ''role-securite''', 'foreign key', 'un rôle attribué à un compte ne se supprime pas');
select tests.connecter(:P);
select tests.echoue('insert into public.roles (code) values (''ROLE_TOUT'')', 'row-level security', 'un compte limité ne crée pas de rôle');
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.roles), 'Awa ne voit pas les rôles');

-- ——— Pages des portails ———
select tests.connecter(:P);
insert into public.pages_portails (id, portail, active) values ('student-notes', 'etudiant', false), ('teacher-grades', 'enseignant', true);
update public.pages_portails set active = true where id = 'student-notes';
update public.pages_portails set active = false where id = 'student-notes';
select tests.verifier((select not active from public.pages_portails where id = 'student-notes'), 'le compte « Portails » ferme la page Notes du portail Étudiant');
select tests.echoue('insert into public.pages_portails (id, portail, active) values (''student-dashboard'', ''etudiant'', false)', 'check constraint',
  'la page d''accueil d''un portail ne se ferme jamais');
select tests.echoue('insert into public.pages_portails (id, portail) values (''teacher-cahier'', ''etudiant'')', 'check constraint',
  'une page du portail Professeur reste au portail Professeur');
select tests.echoue('insert into public.pages_portails (id, portail) values (''admin-users'', ''etudiant'')', 'check constraint',
  'seules les pages des portails Étudiant et Professeur s''y règlent');
select tests.connecter(:W);
select tests.verifier((select count(*) = 2 from public.pages_portails), 'Awa lit quelles pages de son portail sont ouvertes');
with u as (update public.pages_portails set active = true returning 1)
select tests.verifier((select count(*) from u) = 0, 'Awa ne rouvre pas une page elle-même');
select tests.deconnecter();
select tests.verifier((select count(*) = 4 from public.journal_audit where cible_type = 'pages_portails' and acteur = :P),
  'chaque changement de page de portail est journalisé');

-- ——— Motifs de blocage ———
select tests.connecter(:P);
insert into public.motifs_blocage (id, code, intitule, actions_interdites) values ('motif-impaye', 'IMPAYE', 'Impayé de scolarité', array['portail_etudiant', 'impression_bulletin']);
select tests.echoue('insert into public.motifs_blocage (code, intitule) values (''impaye'', ''Doublon'')', 'duplicate key',
  'un code de motif n''existe qu''une fois, majuscules ou non');
select tests.echoue('insert into public.motifs_blocage (code, intitule, actions_interdites) values (''X'', ''X'', array[''supprimer_notes''])', 'check constraint',
  'un motif n''interdit que des actions connues');
select tests.connecter(:W);
select tests.verifier((select actions_interdites = array['portail_etudiant', 'impression_bulletin'] from public.motifs_blocage where id = 'motif-impaye'),
  'Awa lit les motifs (son portail vérifie ce qui lui est interdit)');
select tests.echoue('insert into public.motifs_blocage (code, intitule) values (''LIBRE'', ''Pirate'')', 'row-level security', 'Awa ne crée pas de motif');
select tests.connecter(:A);
delete from public.motifs_blocage where id = 'motif-impaye';
select tests.verifier(not exists (select 1 from public.motifs_blocage), 'l''administrateur principal supprime un motif inutilisé');
select tests.anonyme();
select tests.echoue('select * from public.pages_portails', 'permission denied', 'un visiteur ne lit pas les pages des portails');
select tests.deconnecter();

rollback;
