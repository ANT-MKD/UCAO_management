-- Tests de la partie 2 (comptes et connexion) : installation, création de comptes, connexion et
-- verrouillage, portails, gestion des comptes par l'administration, codes PIN.
-- Comptes d'essai : l'administrateur principal (A), un secrétariat limité par un rôle (S), un
-- accueil limité (X), les enseignants KANE (K) et FALL (F), l'étudiante Awa SECK (W).
-- Tout se passe dans une transaction annulée à la fin : la base reste vide pour les autres tests.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-00000000000a'''
\set S '''00000000-0000-4000-8000-00000000000b'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set F '''00000000-0000-4000-8000-00000000000d'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set X '''00000000-0000-4000-8000-000000000011'''
\set A2 '''00000000-0000-4000-8000-000000000012'''
begin;

-- Identités Supabase (créées par la fonction serveur avec une adresse technique).
insert into auth.users (id, email) values
  (:A, 'adm-principal.a1b2c3d4e5f6@comptes.edumanage.invalid'),
  (:S, 'sec-1.0a0b0c0d0e0f@comptes.edumanage.invalid'),
  (:X, 'accueil-1.111111111111@comptes.edumanage.invalid'),
  (:K, 'prof-kane.222222222222@comptes.edumanage.invalid'),
  (:F, 'prof-fall.333333333333@comptes.edumanage.invalid'),
  (:W, '2026-lqhse-0001.444444444444@comptes.edumanage.invalid'),
  (:A2, 'adm-adjoint.555555555555@comptes.edumanage.invalid');
insert into public.roles (id, code, description, pages) values
  ('role-secretariat', 'ROLE_SECRETARIAT', 'Comptes, codes PIN et étudiants',
   array['sec-users', 'sec-pin-activation', 'etudiants-ajouter', 'etu-liste']),
  ('role-accueil', 'ROLE_ACCUEIL', 'Consultation des étudiants', array['etu-liste']),
  ('role-direction', 'ROLE_DIRECTION', 'Direction', array['etu-liste', 'sec-portails', 'fin-enc-liste']);

-- ——— Structure ———
select tests.verifier(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'private') and c.relkind = 'r' and not c.relrowsecurity
), 'règles d''accès (RLS) actives sur toutes les tables, dont portails, codes PIN et tentatives');
select tests.verifier(not exists (
  select 1 from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.contype = 'f' and c.connamespace in ('public'::regnamespace)
    and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and a.attnum = any (i.indkey))
), 'chaque clé étrangère a son index');
select tests.verifier(not exists (
  select 1 from (values
    ('public.connexion_preparer(text)'), ('public.connexion_echec(text)'), ('public.connexion_reussie(uuid,text)'),
    ('public.installation_enregistrer(uuid,text,text,text,text,text,date,date,text)'),
    ('public.compte_enregistrer(uuid,uuid,text,text,text,text,text,text,text,text)'),
    ('public.code_pin_utiliser(text,text)'), ('public.mot_de_passe_definitif(uuid,text)'),
    ('public.demande_reinitialisation(text)')) f(sig)
  where has_function_privilege('anon', f.sig, 'execute') or has_function_privilege('authenticated', f.sig, 'execute')
     or not has_function_privilege('service_role', f.sig, 'execute')
), 'les fonctions de connexion, d''installation et de mot de passe ne s''exécutent qu''avec la clé secrète');
select tests.verifier(not has_column_privilege('authenticated', 'public.codes_pin', 'code_chiffre', 'select'),
  'le code PIN chiffré n''est lisible par aucun compte');
select tests.verifier((select 'security_invoker=true' = any (c.reloptions) from pg_class c where c.oid = 'public.codes_pin_suivi'::regclass),
  'la vue de suivi des codes applique les règles d''accès de celui qui la lit');
select tests.verifier(not exists (
  select 1 from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute')
    and p.oid <> 'public.etat_installation()'::regprocedure
), 'aucune fonction à droits étendus n''est ouverte aux visiteurs, sauf l''état de l''installation');

-- ——— Installation (fonction serveur) ———
select tests.service();
select tests.echoue($$select public.installation_enregistrer(null, 'adm-principal', 'Fatou', 'Diop', 'f.diop@ucao.edu', '2026-2028', '2026-11-02', '2027-07-31')$$,
  'format 2026-2027', 'installation : libellé d''année mal formé refusé');
select tests.echoue($$select public.installation_enregistrer(null, 'adm-principal', 'Fatou', 'Diop', 'f.diop@ucao.edu', '2026-2027', '2025-11-02', '2027-07-31')$$,
  'doit tomber en 2026', 'installation : rentrée hors de la première année refusée');
select tests.echoue($$select public.installation_enregistrer(null, '', 'Fatou', 'Diop', 'f.diop@ucao.edu', '2026-2027', '2026-11-02', '2027-07-31')$$,
  'Renseignez tous les champs', 'installation : champ manquant refusé');
select public.installation_enregistrer(null, 'adm-principal', 'Fatou', 'Diop', 'f.diop@ucao.edu', '2026-2027', '2026-11-02', '2027-07-31');
select tests.verifier(not exists (select 1 from public.comptes), 'installation : le contrôle seul n''enregistre rien');
select public.installation_enregistrer(:A, 'adm-principal', 'Fatou', 'Diop', 'F.Diop@ucao.edu', '2026-2027', '2026-11-02', '2027-07-31');
select tests.verifier((select identifiant = 'ADM-PRINCIPAL' and nom_affiche = 'Fatou DIOP' and email = 'f.diop@ucao.edu'
    and type_compte = 'administration' and role_id is null and not doit_changer_mot_de_passe
    and fonction = 'Administrateur principal' from public.comptes where id = :A),
  'installation : administrateur principal à accès complet, mot de passe déjà choisi');
select tests.verifier((select nom = 'Institut Supérieur EduManage' from public.etablissement)
    and (select actuelle and date_debut = '2026-11-02' from public.annees_academiques where libelle = '2026-2027')
    and exists (select 1 from public.journal_audit where action = 'installation' and acteur = :A),
  'installation : établissement, année en cours et journal');
select tests.echoue($$select public.installation_enregistrer(null, 'autre', 'Jean', 'Faye', 'j@ucao.edu', '2026-2027', '2026-11-02', '2027-07-31')$$,
  'déjà installée', 'une seconde installation est refusée');
select tests.anonyme();
select tests.verifier((public.etat_installation() ->> 'installee')::boolean, 'l''écran d''accueil sait que l''application est installée');
select tests.echoue('select public.connexion_preparer(''ADM-PRINCIPAL'')', 'permission denied',
  'un visiteur ne peut pas obtenir l''adresse de connexion d''un compte');

-- ——— Création des comptes (fonction serveur, au nom de l'administrateur connecté) ———
select tests.service();
select public.compte_enregistrer(:A, null, 'enseignant', ' prof-kane ', 'Mamadou KANE', 'm.kane@ucao.edu', '77 000 00 01', 'Professeur', null, 'en-kane');
select tests.verifier(not exists (select 1 from public.comptes where id = :K), 'création : le contrôle seul n''enregistre rien');
select public.compte_enregistrer(:A, :K, 'enseignant', ' prof-kane ', 'Mamadou KANE', 'm.kane@ucao.edu', '77 000 00 01', 'Professeur', null, 'en-kane');
select tests.verifier((select identifiant = 'PROF-KANE' and doit_changer_mot_de_passe and actif from public.comptes where id = :K)
    and exists (select 1 from public.journal_audit where action = 'create_user_account' and acteur = :A and cible_id = :K::text),
  'KANE : identifiant en majuscules, mot de passe initial à changer, création au journal');
select tests.echoue(format('select public.compte_enregistrer(%L, null, ''enseignant'', ''PROF-KANE'', ''Autre'')', :A),
  'déjà utilisé', 'un identifiant déjà pris est refusé');
select tests.echoue(format('select public.compte_enregistrer(%L, null, ''enseignant'', ''prof-x'', ''Autre'', ''M.Kane@ucao.edu'')', :A),
  'email est déjà utilisé', 'un email de contact déjà pris par un membre du personnel est refusé');
select tests.echoue(format('select public.compte_enregistrer(%L, null, ''enseignant'', ''prof-y'', ''Autre'', '''', '''', '''', null, ''en-kane'')', :A),
  'déjà reliée', 'une fiche enseignant n''a qu''un compte');
select tests.echoue(format('select public.compte_enregistrer(%L, null, ''etudiant'', ''2026-LQHSE-0001'', ''Awa SECK'')', :A),
  'rattaché à son dossier', 'un compte étudiant sans dossier est refusé');
select tests.echoue(format('select public.compte_enregistrer(%L, null, ''enseignant'', ''prof-z'', ''Autre'', '''', '''', '''', ''role-accueil'')', :A),
  'qu''à un compte de l''administration', 'un rôle ne s''attribue pas à un professeur');
select public.compte_enregistrer(:A, :S, 'administration', 'sec-1', 'Secrétariat', '', '', 'Secrétariat', 'role-secretariat');
select tests.echoue(format('select public.compte_enregistrer(%L, null, ''enseignant'', ''prof-w'', ''Autre'')', :K),
  'pas le droit', 'un professeur ne crée pas de compte');
-- Le secrétariat (rôle limité) :
select tests.echoue(format('select public.compte_enregistrer(%L, null, ''administration'', ''adm-x'', ''Autre'')', :S),
  'accès complet', 'le secrétariat ne crée pas de compte à accès complet');
select tests.echoue(format('select public.compte_enregistrer(%L, null, ''administration'', ''adm-x'', ''Autre'', '''', '''', '''', ''role-direction'')', :S),
  'pages auxquelles vous n''avez pas accès', 'le secrétariat n''attribue pas un rôle plus large que le sien');
select public.compte_enregistrer(:S, :X, 'administration', 'accueil-1', 'Accueil', '', '', 'Accueil', 'role-accueil');
select public.compte_enregistrer(:S, :F, 'enseignant', 'prof-fall', 'Ibrahima FALL', 'i.fall@ucao.edu', '', '', null, 'en-fall');
select public.compte_enregistrer(:S, :W, 'etudiant', '2026-lqhse-0001', 'Awa SECK', 'awa.seck@mail.sn', '', '', null, 'et-awa');
select tests.verifier((select count(*) = 6 from public.comptes), 'le secrétariat crée un accueil, FALL et Awa SECK');

-- ——— Connexion et verrouillage (fonction serveur) ———
select tests.verifier((select public.connexion_preparer(' prof-kane ') = jsonb_build_object('verrouille', false,
    'email', 'prof-kane.222222222222@comptes.edumanage.invalid')),
  'KANE : son identifiant donne son adresse de connexion technique');
select tests.verifier((select public.connexion_preparer('PROF-INCONNU') ->> 'email') is null, 'un identifiant inconnu ne donne aucune adresse');
select public.connexion_echec('prof-kane') from generate_series(1, 3);
select tests.verifier(not (public.connexion_echec('prof-kane') ->> 'verrouille')::boolean, 'KANE : pas verrouillé après 4 échecs');
select tests.verifier((public.connexion_echec('PROF-KANE') ->> 'verrouille')::boolean, 'KANE : verrouillé au 5e échec');
select tests.verifier((select public.connexion_preparer('prof-kane') = '{"verrouille": true, "minutes": 15}'::jsonb),
  'KANE : verrouillé pour 15 minutes, l''adresse n''est même plus donnée');
select tests.verifier(exists (select 1 from public.journal_audit where action = 'lockout_failed_attempts' and cible_id = :K::text)
    and exists (select 1 from public.notifications where destinataire = :K and message like 'Votre compte a été temporairement bloqué%')
    and exists (select 1 from public.notifications where destinataire = :A and groupe = 'comptes-verrouilles' and message like '%Mamadou KANE (PROF-KANE)%')
    and not exists (select 1 from public.notifications where destinataire = :S),
  'KANE : verrouillage au journal, KANE et l''administrateur principal prévenus (pas le secrétariat)');
select public.connexion_echec('PROF-INCONNU') from generate_series(1, 5);
select tests.verifier((public.connexion_preparer('prof-inconnu') ->> 'verrouille')::boolean,
  'un identifiant inconnu se verrouille aussi (on ne devine pas quels comptes existent)');
select public.connexion_echec('2026-LQHSE-0001') from generate_series(1, 5);
select tests.verifier((select nombre = 2 and message like '2 comptes verrouillés%' from public.notifications
    where destinataire = :A and groupe = 'comptes-verrouilles'),
  'deux verrouillages : une seule alerte « 2 comptes verrouillés » pour l''administrateur');
update private.tentatives_connexion set verrouille_jusqua = now() - interval '1 second' where identifiant = 'PROF-KANE';
select tests.verifier(not (public.connexion_preparer('prof-kane') ->> 'verrouille')::boolean, 'KANE : déverrouillé après 15 minutes');
select tests.verifier(not (public.connexion_echec('prof-kane') ->> 'verrouille')::boolean, 'KANE : un nouvel échec ne le reverrouille pas');
select tests.verifier((select echecs = 1 from private.tentatives_connexion where identifiant = 'PROF-KANE'),
  'KANE : après le verrouillage, les échecs repartent de zéro');
select tests.verifier((select public.connexion_reussie(:K, 'prof-kane') = '{"autorise": true, "doit_changer_mot_de_passe": true}'::jsonb),
  'KANE : connexion acceptée, mot de passe initial à changer');
select tests.verifier(not exists (select 1 from private.tentatives_connexion where identifiant = 'PROF-KANE')
    and exists (select 1 from public.journal_audit where action = 'login' and acteur = :K),
  'KANE : échecs effacés et connexion au journal');

-- ——— Portails ———
select tests.connecter(:S);
select tests.echoue('select public.definir_portail(''etudiant'', false)', 'pas accès', 'le secrétariat ne ferme pas un portail');
select tests.connecter(:A);
select tests.echoue('select public.definir_portail(''administration'', false)', 'ne peut pas être fermé',
  'le portail Administration ne se ferme jamais');
select public.definir_portail('etudiant', false, 'Saisie des notes en cours');
select tests.connecter(:W);
select tests.verifier(private.lien_courant() is null and private.type_compte_courant() is null,
  'portail Étudiants fermé : la session d''Awa n''a plus accès à rien');
select tests.echoue('update public.portails set ouvert = true', 'permission denied', 'Awa ne rouvre pas le portail elle-même');
select tests.service();
select tests.verifier((select public.connexion_reussie(:W, '2026-LQHSE-0001') ->> 'message')
    = 'Le portail Étudiants est actuellement fermé : Saisie des notes en cours. Contactez l''administration.',
  'portail Étudiants fermé : Awa ne se connecte pas, avec le message de l''administration');
select tests.verifier((public.connexion_reussie(:K, 'prof-kane') ->> 'autorise')::boolean,
  'portail Étudiants fermé : KANE se connecte toujours');
select tests.connecter(:A);
select public.definir_portail('etudiant', true);
select tests.verifier(exists (select 1 from public.journal_audit where action = 'close_portal' and details = 'Saisie des notes en cours')
    and exists (select 1 from public.journal_audit where action = 'open_portal'),
  'fermeture et réouverture du portail au journal');
select tests.connecter(:W);
select tests.verifier(private.lien_courant() = 'et-awa', 'portail rouvert : Awa retrouve son dossier');
select tests.verifier((select count(*) = 3 from public.portails), 'chaque compte voit l''état des trois portails');
select tests.anonyme();
select tests.echoue('select * from public.portails', 'permission denied', 'un visiteur ne lit pas les portails');

-- ——— Gestion des comptes par l'administration ———
select tests.connecter(:S);
select tests.echoue(format('select public.modifier_compte(%L, ''Fatou DIOP'', '''', '''', '''')', :A),
  'seul un administrateur à accès complet', 'le secrétariat ne modifie pas l''administrateur principal');
select tests.echoue(format('select public.definir_compte_actif(%L, false)', :A),
  'seul un administrateur à accès complet', 'le secrétariat ne bloque pas l''administrateur principal');
select tests.echoue(format('select public.modifier_compte(%L, ''Accueil'', '''', '''', '''', ''role-direction'')', :X),
  'pages auxquelles vous n''avez pas accès', 'le secrétariat n''élargit pas le rôle de l''accueil au-delà du sien');
select tests.echoue(format('select public.modifier_compte(%L, ''Accueil'', '''', '''', '''', null)', :X),
  'donner l''accès complet', 'le secrétariat ne donne pas l''accès complet');
select tests.echoue(format('select public.modifier_compte(%L, ''Secrétariat'', '''', '''', '''', ''role-accueil'')', :S),
  'propre rôle', 'le secrétariat ne change pas son propre rôle');
select public.modifier_compte(:K, 'Mamadou KANE', 'mamadou.kane@ucao.edu', '77 000 00 02', 'Professeur titulaire');
select tests.verifier(not exists (select 1 from public.journal_audit), 'le secrétariat ne lit pas le journal (pas la page « Journal d''audit »)');
select tests.deconnecter();
select tests.verifier((select email = 'mamadou.kane@ucao.edu' and telephone = '77 000 00 02' from public.comptes where id = :K)
    and exists (select 1 from public.journal_audit where action = 'update_user_account' and acteur = :S and cible_id = :K::text),
  'le secrétariat met à jour la fiche de KANE (au journal)');
select tests.connecter(:S);
select tests.echoue(format('select public.modifier_compte(%L, ''Mamadou KANE'', '''', '''', '''', ''role-accueil'')', :K),
  'qu''à un compte de l''administration', 'pas de rôle pour un professeur');
select public.definir_compte_actif(:K, false);
select tests.connecter(:K);
select tests.verifier(private.type_compte_courant() is null, 'KANE bloqué : sa session n''a plus accès à rien');
select tests.echoue('select public.modifier_compte(auth.uid(), ''KANE'', '''', '''', '''')', 'pas accès', 'un professeur ne gère pas les comptes');
select tests.service();
select tests.verifier((select public.connexion_reussie(:K, 'prof-kane') ->> 'message') like 'Ce compte a été désactivé%',
  'KANE bloqué : connexion refusée');
select tests.connecter(:S);
select public.definir_compte_actif(:K, true);
select tests.connecter(:A);
select tests.echoue(format('select public.definir_compte_actif(%L, false)', :A), 'dernier administrateur',
  'le dernier administrateur à accès complet ne se bloque pas');
select tests.echoue(format('select public.modifier_compte(%L, ''Fatou DIOP'', '''', '''', '''', ''role-accueil'')', :A), 'dernier administrateur',
  'le dernier administrateur à accès complet garde l''accès complet');
select tests.service();
select public.compte_enregistrer(:A, :A2, 'administration', 'adm-adjoint', 'Administrateur adjoint');
select tests.connecter(:A);
select public.definir_compte_actif(:A2, false);
select tests.echoue(format('select public.definir_compte_actif(%L, false)', :A), 'dernier administrateur',
  'un second administrateur bloqué ne compte pas : le principal reste indispensable');
select public.definir_compte_actif(:A2, true);
select public.definir_compte_actif(:A, false);
select tests.verifier((select not actif from public.comptes where id = :A), 'avec un second administrateur actif, le principal peut être bloqué');
select tests.connecter(:A2);
select public.definir_compte_actif(:A, true);
select tests.connecter(:K);
select tests.echoue('update public.comptes set doit_changer_mot_de_passe = false where id = auth.uid()', 'permission denied',
  'KANE ne lève pas lui-même l''obligation de changer son mot de passe');

-- ——— « Mot de passe oublié » et codes PIN ———
select tests.service();
select public.demande_reinitialisation(' 2026-lqhse-0001 ');
select public.demande_reinitialisation('2026-LQHSE-0001');
select public.demande_reinitialisation('INCONNU-99');
select tests.verifier((select count(*) = 1 from public.demandes_reinitialisation where compte = :W and traitee_le is null),
  'Awa : une seule demande en attente, même après deux clics ; rien pour un identifiant inconnu');
select tests.verifier((select count(*) = 1 from public.notifications where destinataire = :S and groupe = 'demandes-reinitialisation')
    and exists (select 1 from public.notifications where destinataire = :A and message like '%Awa SECK (2026-LQHSE-0001)%')
    and not exists (select 1 from public.notifications where destinataire = :X),
  'la demande d''Awa prévient ceux qui gèrent les codes PIN (pas l''accueil)');
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.demandes_reinitialisation), 'Awa ne lit pas les demandes');
select tests.echoue(format('select public.generer_code_pin(%L)', :W), 'pas accès', 'Awa ne se donne pas un code PIN');
select tests.connecter(:S);
select tests.echoue(format('select public.generer_code_pin(%L)', :A), 'seul un administrateur à accès complet',
  'le secrétariat ne génère pas de code pour l''administrateur principal');
select set_config('tests.code1', (public.generer_code_pin(:W)) ->> 'code', false);
select tests.verifier(current_setting('tests.code1') ~ '^[1-9][0-9]{5}$', 'le code PIN a 6 chiffres');
select tests.verifier((select traitee_par = :S from public.demandes_reinitialisation where compte = :W),
  'le code remis règle la demande d''Awa');
select tests.echoue('select code_chiffre from public.codes_pin', 'permission denied', 'le code chiffré reste illisible, même pour le secrétariat');
select tests.verifier((select statut = 'actif' and auteur = :S from public.codes_pin_suivi where compte = :W),
  'le secrétariat suit le code dans l''historique');
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.codes_pin_suivi), 'Awa ne lit pas l''historique des codes');
select tests.service();
select tests.verifier((select code_chiffre <> current_setting('tests.code1') and code_chiffre like '$2a$08$%' from public.codes_pin where compte = :W),
  'le code est conservé chiffré');
select tests.verifier(not (public.code_pin_utiliser('2026-LQHSE-0001', '000000') ->> 'ok')::boolean, 'mauvais code : refusé');
select tests.verifier((select essais_echoues = 1 from public.codes_pin where compte = :W), 'mauvais code : l''essai est compté');
select tests.verifier((select public.code_pin_utiliser(' 2026-lqhse-0001 ', current_setting('tests.code1'))
    = jsonb_build_object('ok', true, 'compte', :W::uuid)), 'bon code : accepté pour Awa');
select tests.verifier(not (public.code_pin_utiliser('2026-LQHSE-0001', current_setting('tests.code1')) ->> 'ok')::boolean,
  'un code ne sert qu''une fois');
select tests.connecter(:S);
select set_config('tests.code2', (public.generer_code_pin(:W)) ->> 'code', false);
select tests.service();
select public.code_pin_utiliser('2026-LQHSE-0001', '000000') from generate_series(1, 5);
select tests.verifier((select statut = 'revoque' and revoque_motif = 'Système — 5 essais erronés'
    from public.codes_pin_suivi where compte = :W order by id desc limit 1),
  '5 mauvais codes : le code est révoqué par le système');
select tests.verifier(not (public.code_pin_utiliser('2026-LQHSE-0001', current_setting('tests.code2')) ->> 'ok')::boolean,
  'un code révoqué ne sert plus, même juste');
select tests.connecter(:S);
select set_config('tests.code3', (public.generer_code_pin(:W)) ->> 'id', false);
select set_config('tests.code4', (public.generer_code_pin(:W)) ->> 'code', false);
select tests.verifier((select statut = 'remplace' from public.codes_pin_suivi where id = current_setting('tests.code3')::bigint),
  'un nouveau code remplace le précédent');
select tests.echoue(format('select public.revoquer_code_pin(%s)', current_setting('tests.code3')), 'seul un code actif',
  'un code remplacé ne se révoque pas');
select public.revoquer_code_pin((select max(id) from public.codes_pin where compte = :W));
select tests.verifier((select statut = 'revoque' and revoque_par = :S from public.codes_pin_suivi where compte = :W order by id desc limit 1),
  'le secrétariat révoque le code actif');
select tests.service();
select tests.verifier(not (public.code_pin_utiliser('2026-LQHSE-0001', current_setting('tests.code4')) ->> 'ok')::boolean,
  'un code révoqué par l''administration ne sert plus');
select tests.connecter(:S);
select set_config('tests.code5', (public.generer_code_pin(:W)) ->> 'code', false);
select tests.deconnecter();
update public.codes_pin set expire_le = now() - interval '1 minute' where id = (select max(id) from public.codes_pin where compte = :W);
select tests.service();
select tests.verifier(not (public.code_pin_utiliser('2026-LQHSE-0001', current_setting('tests.code5')) ->> 'ok')::boolean,
  'un code de plus de 24 heures ne sert plus');

-- ——— Mot de passe définitif ———
select public.connexion_echec('2026-LQHSE-0001');
select public.mot_de_passe_definitif(:W, 'reset_password_pin');
select public.mot_de_passe_definitif(:K, 'update_password');
select tests.verifier((select not doit_changer_mot_de_passe and mot_de_passe_change_le is not null from public.comptes where id = :K)
    and not exists (select 1 from private.tentatives_connexion where identifiant = '2026-LQHSE-0001')
    and exists (select 1 from public.journal_audit where action = 'reset_password_pin' and acteur = :W)
    and exists (select 1 from public.journal_audit where action = 'update_password' and acteur = :K),
  'nouveau mot de passe : plus rien de provisoire, verrouillage levé, au journal');
select tests.echoue(format('select public.mot_de_passe_definitif(%L, ''autre'')', :K), 'Action inconnue', 'action de mot de passe inconnue refusée');

select tests.deconnecter();
rollback;
