-- Tests de la partie 1 (fondations) : structure, cloisonnement par compte, garde-fous.
-- Comptes d'essai : l'administrateur principal (A), un secrétariat limité par un rôle (S), les
-- enseignants KANE (K) et FALL (F), l'étudiante Awa SECK (W) et un ancien administrateur désactivé (D).
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-00000000000a'''
\set S '''00000000-0000-4000-8000-00000000000b'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set F '''00000000-0000-4000-8000-00000000000d'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set D '''00000000-0000-4000-8000-000000000010'''

-- ——— Préparation (propriétaire de la base) ———
insert into auth.users (id, email) values
  (:A, 'adm-scolarite@comptes.ucao'), (:S, 'sec-1@comptes.ucao'), (:K, 'prof-kane@comptes.ucao'),
  (:F, 'prof-fall@comptes.ucao'), (:W, '2026-lqhse-0001@comptes.ucao'), (:D, 'adm-ancien@comptes.ucao');
insert into public.roles (id, code, description, pages)
  values ('role-secretariat', 'ROLE_SECRETARIAT', 'Étudiants et scolarité', array['etu-liste', 'scol-notes']);
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM-SCOLARITE', 'Responsable Scolarité', null, null, false),
  (:S, 'administration', 'SEC-1', 'Secrétariat', null, 'role-secretariat', false),
  (:K, 'enseignant', 'PROF-KANE', 'Mamadou KANE', 'en-kane', null, false),
  (:F, 'enseignant', 'PROF-FALL', 'Ibrahima FALL', 'en-fall', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:D, 'administration', 'ADM-ANCIEN', 'Ancien administrateur', null, null, false);
update public.comptes set actif = false where id = :D;
insert into public.etablissement (nom, adresse) values ('Université Catholique de l''Afrique de l''Ouest', 'Dakar, Sénégal');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle, cloturee) values
  ('annee-2025', '2025-2026', '2025-11-03', '2026-07-31', false, true),
  ('annee-2026', '2026-2027', '2026-11-02', '2027-07-31', true, false);

-- ——— Structure ———
select tests.verifier(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind = 'r' and not c.relrowsecurity
), 'règles d''accès (RLS) actives sur toutes les tables');

select tests.verifier(not exists (
  select 1 from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.contype = 'f' and c.connamespace in ('public'::regnamespace)
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and a.attnum = any (i.indkey))
), 'chaque clé étrangère a son index');

create table public.t_nouvelle (x int);
create function public.f_nouvelle() returns int language sql as 'select 1';
select tests.verifier(
  not has_table_privilege('anon', 'public.t_nouvelle', 'select')
  and not has_table_privilege('authenticated', 'public.t_nouvelle', 'select')
  and not has_function_privilege('anon', 'public.f_nouvelle()', 'execute')
  and not has_function_privilege('authenticated', 'public.f_nouvelle()', 'execute'),
  'une nouvelle table ou fonction n''est ouverte à personne par défaut');
drop table public.t_nouvelle;
drop function public.f_nouvelle();

select tests.verifier(not has_schema_privilege('anon', 'private', 'usage'), 'le schéma private est fermé aux visiteurs');
select tests.verifier(not has_function_privilege('authenticated', 'private.prochain_numero(text)', 'execute'),
  'un compte connecté ne peut pas tirer un numéro officiel lui-même');

-- ——— Visiteur non connecté ———
select tests.anonyme();
select tests.echoue('select * from public.comptes', 'permission denied', 'un visiteur ne lit pas les comptes');
select tests.echoue('select * from public.etablissement', 'permission denied', 'un visiteur ne lit pas les tables');
select tests.verifier((select public.etat_installation() ->> 'installee')::boolean, 'un visiteur sait que l''application est installée');
select tests.verifier(public.etat_installation() ->> 'etablissement' = 'Université Catholique de l''Afrique de l''Ouest',
  'un visiteur voit le nom de l''établissement');
select tests.echoue('select public.journaliser(''essai'')', 'permission denied', 'un visiteur n''écrit pas au journal');
select tests.echoue('select public.notifier(gen_random_uuid(), ''essai'')', 'permission denied', 'un visiteur n''envoie pas de notification');
select tests.deconnecter();

-- ——— Awa SECK, étudiante ———
select tests.connecter(:W);
select tests.verifier((select count(*) from public.comptes) = 1 and (select id from public.comptes) = :W,
  'Awa ne voit que son propre compte');
update public.comptes set telephone = '+221 77 123 45 67' where id = :W;
select tests.verifier((select telephone from public.comptes where id = :W) = '+221 77 123 45 67', 'Awa modifie son téléphone');
select tests.echoue(format('update public.comptes set type_compte = %L where id = %L', 'administration', :W),
  'permission denied', 'Awa ne peut pas se donner un compte d''administration');
select tests.echoue(format('update public.comptes set actif = true, role_id = null where id = %L', :W),
  'permission denied', 'Awa ne touche ni à son blocage ni à son rôle');
with u as (update public.comptes set telephone = 'piraté' where id = :K returning 1)
select tests.verifier((select count(*) from u) = 0, 'Awa ne modifie pas le compte de KANE');
select tests.verifier((select count(*) from public.roles) = 0, 'Awa ne voit pas les rôles');
select tests.verifier((select count(*) from public.journal_audit) = 0, 'Awa ne lit pas le journal');
select tests.verifier((select count(*) from public.etablissement) = 1, 'Awa lit le nom de l''établissement');
with u as (update public.etablissement set nom = 'Autre' returning 1)
select tests.verifier((select count(*) from u) = 0, 'Awa ne renomme pas l''établissement');
select tests.verifier((select count(*) from public.annees_academiques) = 2, 'Awa lit les années académiques');
select tests.echoue('insert into public.annees_academiques (libelle) values (''2027-2028'')', 'row-level security',
  'Awa ne crée pas d''année');
select public.journaliser('connexion', 'compte', '2026-LQHSE-0001');
select public.notifier(:A, 'Demande d''attestation d''inscription');
select tests.echoue(format('select public.notifier(%L, %L)', :K, 'Message direct'), 'ne pouvez pas',
  'Awa ne notifie pas directement un enseignant (ouvert à la partie 5)');
select tests.echoue(format('insert into public.notifications (destinataire, message) values (%L, %L)', :W, 'fabriquée'),
  'permission denied', 'Awa ne fabrique pas de notification');
select tests.echoue('select private.prochain_numero(''quittance:2026'')', 'permission denied',
  'Awa ne tire pas de numéro officiel');
select tests.deconnecter();

-- ——— Mamadou KANE, enseignant ———
select tests.connecter(:K);
select tests.verifier((select count(*) from public.comptes) = 1, 'KANE ne voit que son propre compte');
select tests.verifier((select count(*) from public.roles) = 0, 'KANE ne voit pas les rôles');
select tests.verifier((select count(*) from public.notifications) = 0, 'KANE ne voit pas les notifications des autres');
select tests.deconnecter();

-- ——— Secrétariat, limité par le rôle ROLE_SECRETARIAT ———
select tests.connecter(:S);
select tests.verifier((select count(*) from public.comptes) = 6, 'le secrétariat voit les comptes');
select tests.verifier((select count(*) from public.roles) = 1, 'le secrétariat voit les rôles');
select tests.verifier((select count(*) from public.journal_audit) = 0, 'sans la page « Journal d''audit », pas de journal');
with u as (update public.etablissement set nom = 'Autre' returning 1)
select tests.verifier((select count(*) from u) = 0, 'sans « Paramètres généraux », pas de modification de l''établissement');
select tests.echoue('insert into public.roles (code) values (''ROLE_TOUT'')', 'row-level security',
  'un compte limité ne crée pas de rôle (il pourrait s''élever lui-même)');
with u as (update public.roles set pages = array['sec-audit'] where id = 'role-secretariat' returning 1)
select tests.verifier((select count(*) from u) = 0, 'un compte limité n''élargit pas son propre rôle');
select tests.echoue('insert into public.annees_academiques (libelle) values (''2027-2028'')', 'row-level security',
  'sans « Années académiques », pas de création d''année');
select public.notifier(:W, 'Votre attestation est prête');
select tests.deconnecter();

-- ——— Administrateur principal (accès complet) ———
select tests.connecter(:A);
select tests.verifier(exists (select 1 from public.journal_audit where action = 'connexion' and acteur = :W),
  'le journal garde Awa comme auteure de sa propre action');
update public.etablissement set nom = 'Université Catholique de l''Afrique de l''Ouest — Dakar';
select tests.verifier((select modifie_par from public.etablissement) = :A, 'la modification de l''établissement garde son auteur');
insert into public.roles (code, description, pages) values ('ROLE_COMPTABLE', 'Finances', array['fin-param']);
select tests.verifier((select count(*) from public.roles) = 2, 'l''administrateur principal crée un rôle');
select tests.echoue('delete from public.roles where id = ''role-secretariat''', 'foreign key',
  'un rôle attribué à un compte ne se supprime pas');
insert into public.annees_academiques (libelle, date_debut, date_fin) values ('2027-2028', '2027-11-01', '2028-07-31');
select tests.echoue('insert into public.annees_academiques (libelle) values (''2027-2029'')', 'check constraint',
  'une année doit couvrir deux années civiles consécutives');
select tests.echoue('insert into public.annees_academiques (libelle, date_debut, date_fin) values (''2028-2029'', ''2029-07-31'', ''2028-11-01'')',
  'check constraint', 'la rentrée précède la fin d''année');
select tests.echoue('update public.annees_academiques set actuelle = true where libelle = ''2027-2028''', 'duplicate key',
  'une seule année courante à la fois');
select tests.echoue('delete from public.journal_audit', 'permission denied', 'le journal ne s''efface pas');
select tests.deconnecter();
select tests.echoue('update public.journal_audit set action = ''modifiée''', 'ne se modifie pas',
  'même le propriétaire de la base ne réécrit pas le journal');
select tests.echoue('delete from public.journal_audit', 'ne se modifie pas', 'même le propriétaire de la base n''efface pas le journal');

-- ——— Compte désactivé ———
select tests.connecter(:D);
select tests.verifier((select count(*) from public.roles) = 0, 'un administrateur désactivé perd ses droits');
select tests.echoue('select public.journaliser(''essai'')', 'compte actif', 'un compte désactivé n''écrit pas au journal');
select tests.deconnecter();

-- ——— Notifications regroupées ———
select tests.connecter(:A);
select public.notifier(:W, 'Nouvelle note publiée — Projet Tutoré', 'notes-publiees', '{n} nouvelles notes publiées');
select public.notifier(:W, 'Nouvelle note publiée — Système de Management', 'notes-publiees', '{n} nouvelles notes publiées');
select tests.deconnecter();
select tests.connecter(:W);
select tests.verifier((select count(*) from public.notifications where groupe = 'notes-publiees') = 1
  and (select message from public.notifications where groupe = 'notes-publiees') = '2 nouvelles notes publiées',
  'deux notes publiées donnent une seule notification « 2 nouvelles notes publiées »');
select tests.verifier((select bool_and(destinataire = :W) from public.notifications), 'Awa ne voit que ses notifications');
update public.notifications set lue = true where groupe = 'notes-publiees';
select tests.verifier((select lue_le is not null from public.notifications where groupe = 'notes-publiees'), 'la date de lecture est posée');
select tests.echoue(format('update public.notifications set destinataire = %L', :K), 'permission denied',
  'Awa ne réattribue pas une notification');
select tests.deconnecter();
select tests.connecter(:A);
select public.notifier(:W, 'Nouvelle note publiée — Anglais', 'notes-publiees', '{n} nouvelles notes publiées');
select tests.deconnecter();
select tests.verifier((select count(*) from public.notifications where destinataire = :W and groupe = 'notes-publiees') = 2,
  'une fois la première lue, une nouvelle notification de groupe commence');

-- ——— Année clôturée ———
create table public.t_annee (id int primary key, annee text not null);
alter table public.t_annee enable row level security;
create policy t_annee_tout on public.t_annee for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.t_annee to authenticated;
create trigger t_annee_cloture before insert or update or delete on public.t_annee
  for each row execute function private.refuser_annee_cloturee();
select tests.connecter(:A);
insert into public.t_annee values (1, '2026-2027');
select tests.echoue('insert into public.t_annee values (2, ''2025-2026'')', 'est clôturée', 'rien ne s''ajoute dans une année clôturée');
select tests.echoue('update public.t_annee set annee = ''2025-2026'' where id = 1', 'est clôturée', 'rien ne glisse vers une année clôturée');
select tests.deconnecter();
update public.annees_academiques set cloturee = true where libelle = '2026-2027';
select tests.connecter(:A);
select tests.echoue('delete from public.t_annee where id = 1', 'est clôturée', 'rien ne s''efface d''une année devenue clôturée');
select tests.deconnecter();
drop table public.t_annee;
update public.annees_academiques set cloturee = false where libelle = '2026-2027';

-- ——— Numérotation ———
select tests.verifier(
  private.prochain_numero('quittance:2026') = 1 and private.prochain_numero('quittance:2026') = 2
  and private.prochain_numero('matricule:2026-LQHSE') = 1 and private.prochain_numero('quittance:2026') = 3,
  'chaque numérotation avance de un, indépendamment des autres');

-- ——— Purge des notifications ———
insert into public.notifications (destinataire, message, lue, lue_le, archivee) values
  (:K, 'lue il y a 100 jours', true, now() - interval '100 days', false),
  (:K, 'lue il y a 100 jours, archivée', true, now() - interval '100 days', true),
  (:K, 'lue hier', true, now() - interval '1 day', false),
  (:K, 'non lue', false, null, false);
select tests.verifier(private.purger_notifications() = 1, 'la purge retire une notification');
select tests.verifier((select count(*) from public.notifications where destinataire = :K) = 3
  and not exists (select 1 from public.notifications where message = 'lue il y a 100 jours'),
  'la purge ne retire que les notifications lues depuis plus de 90 jours et non archivées');
