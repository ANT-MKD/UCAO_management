-- Tests de la partie 8, lot 1 : diffusion en direct, annuaire, messages, mails envoyés.
-- Comptes d'essai : l'administration (A, accès complet), la scolarité (S, page « Envoi message »),
-- un validateur des mails (V), Mamadou KANE (K, cours en L1), Ibrahima FALL (L, cours en L2), les
-- étudiants Awa SECK (W) et Ousmane DIALLO (O) en L1, Fatou SOW (F) en L2, et un compte désactivé
-- (X). Tout se passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-000000000081'''
\set S '''00000000-0000-4000-8000-000000000082'''
\set V '''00000000-0000-4000-8000-000000000083'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set L '''00000000-0000-4000-8000-000000000013'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
\set F '''00000000-0000-4000-8000-000000000084'''
\set X '''00000000-0000-4000-8000-000000000085'''
begin;

insert into auth.users (id, email) values
  (:A, 'admin.a@comptes.edumanage.invalid'), (:S, 'scolarite.s@comptes.edumanage.invalid'), (:V, 'validateur.v@comptes.edumanage.invalid'),
  (:K, 'kane.k@comptes.edumanage.invalid'), (:L, 'fall.l@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid'),
  (:O, 'ousmane.o@comptes.edumanage.invalid'), (:F, 'fatou.f@comptes.edumanage.invalid'), (:X, 'ancien.x@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values ('role-com', 'ROLE_COM', array['com-envoi', 'com-mails', 'com-validation']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
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
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-fatou', '2026-LQHSE-0003', 'Fatou', 'SOW', 'fil-qhse', 'cl-l2', 'L2', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, email, fonction, lien_id, role_id, actif, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADMIN-1', 'Direction des études', 'direction@ucao.invalid', 'Directeur', null, null, true, false),
  (:S, 'administration', 'SCOL-1', 'Scolarité', 'scolarite@ucao.invalid', 'Secrétariat', null, 'role-com', true, false),
  (:V, 'administration', 'VALID-1', 'Responsable communication', 'communication@ucao.invalid', 'Communication', null, 'role-com', true, false),
  (:K, 'enseignant', 'KANE', 'Mamadou KANE', 'kane@ucao.invalid', '', 'en-kane', null, true, false),
  (:L, 'enseignant', 'FALL', 'Ibrahima FALL', 'fall@ucao.invalid', '', 'en-fall', null, true, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'awa@ucao.invalid', '', 'et-awa', null, true, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'ousmane@ucao.invalid', '', 'et-ousmane', null, true, false),
  (:F, 'etudiant', '2026-LQHSE-0003', 'Fatou SOW', 'fatou@ucao.invalid', '', 'et-fatou', null, true, false),
  (:X, 'administration', 'ANCIEN-1', 'Ancien secrétariat', '', '', null, 'role-com', false, false);

-- Diffusions observées : chaque envoi est aussi noté ici, et vidé entre deux étapes (en vrai,
-- chaque envoi a sa transaction). Sur un projet où Realtime n'a pas encore démarré, la table des
-- messages diffusés n'a pas de partition du jour : l'écoute n'y est alors vérifiée qu'en local.
create temp table diffusions_essai (canal text, tab text);
create or replace function private.envoyer_diffusion(p_canal text, p_table text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  insert into pg_temp.diffusions_essai values (p_canal, p_table);
  perform realtime.send(jsonb_build_object('table', p_table), 'changement', p_canal, true);
end;
$$;
create function pg_temp.vider_diffusions() returns void language sql as $$
  truncate pg_temp.diffusions_essai;
  select set_config('edumanage.diffusions', '', false);
$$;
create function pg_temp.diffuse(p_canal text, p_table text) returns boolean language sql as $$
  select exists (select 1 from pg_temp.diffusions_essai d where d.canal = p_canal and d.tab = p_table)
$$;
select set_config('essai.ecoute', ((select c.relkind from pg_class c where c.oid = 'realtime.messages'::regclass) <> 'p'
  or exists (select 1 from pg_inherits i where i.inhparent = 'realtime.messages'::regclass))::text, false);
create function pg_temp.notifie(p_compte uuid, p_debut text) returns bigint language sql as $$
  select count(*) from public.notifications n where n.destinataire = p_compte and starts_with(n.message, p_debut)
$$;

-- ——— Annuaire ———
select tests.connecter(:W);
select tests.verifier((select count(*) = 1 from public.comptes), 'Awa ne lit que son propre compte');
select tests.verifier((select array_agg(nom_affiche order by nom_affiche) from public.annuaire() where id in (:A, :S, :V, :K, :L, :W, :O, :F, :X))
    = array['Awa SECK', 'Direction des études', 'Mamadou KANE', 'Responsable communication', 'Scolarité'],
  'annuaire d''Awa : elle-même, l''administration active et le professeur de sa classe (ni FALL, ni les autres étudiants, ni le compte désactivé)');
select tests.verifier((select bool_and(email = '') from public.annuaire() where id <> :W) and (select email = 'awa@ucao.invalid' from public.annuaire() where id = :W),
  'l''annuaire ne donne les coordonnées de personne d''autre');
select tests.verifier((select fonction = 'Secrétariat' from public.annuaire() where id = :S) and (select lien_id = 'en-kane' from public.annuaire() where id = :K),
  'il donne la fonction de l''administration et la fiche du professeur');
select tests.connecter(:K);
select tests.verifier((select array_agg(nom_affiche order by nom_affiche) from public.annuaire() where type_compte <> 'administration' and id in (:K, :L, :W, :O, :F))
    = array['Awa SECK', 'Mamadou KANE', 'Ousmane DIALLO'],
  'annuaire de KANE : les étudiants de ses classes, pas Fatou (L2) ni FALL');
select tests.connecter(:A);
select tests.verifier((select count(*) = 9 from public.annuaire() where id in (:A, :S, :V, :K, :L, :W, :O, :F, :X)) and (select email = 'kane@ucao.invalid' from public.annuaire() where id = :K),
  'l''administration connaît tous les comptes, avec leurs coordonnées');
select tests.anonyme();
select tests.echoue('select * from public.annuaire()', 'permission denied', 'un visiteur n''a pas d''annuaire');

-- ——— Messages ———
select tests.deconnecter();
select pg_temp.vider_diffusions();
select tests.connecter(:W);
insert into public.messages (id, expediteur, destinataire, objet, contenu, cree_le, lu)
  values ('msg-awa-1', :W, :K, 'Question sur le TP', 'Bonjour Monsieur, le TP est-il à rendre lundi ?', '2020-01-01', true);
select tests.verifier((select not lu and cree_le > now() - interval '1 minute' from public.messages where id = 'msg-awa-1'),
  'un message est daté par la base et part non lu');
select tests.echoue(format('insert into public.messages (id, expediteur, destinataire, objet, contenu) values (''msg-x'', %L, %L, ''Salut'', ''Coucou'')', :W, :O),
  'row-level security', 'un étudiant n''écrit pas à un autre étudiant');
select tests.echoue(format('insert into public.messages (id, expediteur, destinataire, objet, contenu) values (''msg-x'', %L, %L, ''Cours'', ''Bonjour'')', :W, :L),
  'row-level security', 'ni à un professeur qui n''enseigne pas dans sa classe');
select tests.echoue(format('insert into public.messages (id, expediteur, destinataire, objet, contenu) values (''msg-x'', %L, %L, ''Cours'', ''Bonjour'')', :K, :W),
  'row-level security', 'personne n''écrit au nom d''un autre');
select tests.echoue(format('insert into public.messages (id, expediteur, destinataire, objet, contenu) values (''msg-x'', %L, %L, ''Dossier'', ''Bonjour'')', :W, :X),
  'row-level security', 'on n''écrit pas à un compte désactivé');
select tests.echoue(format('insert into public.messages (id, expediteur, destinataire, objet, contenu, mail_id) values (''msg-x'', %L, %L, ''Dossier'', ''Bonjour'', ''mail-faux'')', :W, :S),
  'row-level security', 'un message ne se fait pas passer pour un mail de l''administration');
insert into public.messages (id, expediteur, destinataire, objet, contenu) values ('msg-awa-2', :W, :S, 'Attestation', 'Bonjour, je voudrais une attestation.');
select tests.verifier((select count(*) = 2 from public.messages), 'Awa écrit à l''administration et au professeur de sa classe');

select tests.deconnecter();
select tests.verifier(pg_temp.diffuse('compte:' || :K, 'messages') and pg_temp.diffuse('compte:' || :W, 'messages') and pg_temp.diffuse('compte:' || :S, 'messages'),
  'en direct : KANE, la scolarité et Awa elle-même sont prévenus que leurs messages ont changé');
select tests.verifier(pg_temp.diffuse('compte:' || :K, 'notifications') and not pg_temp.diffuse('compte:' || :O, 'messages') and not pg_temp.diffuse('administration', 'messages'),
  'KANE est prévenu de sa notification ; ni Ousmane ni le canal de l''administration ne le sont');
select tests.verifier((select count(*) = 1 from pg_temp.diffusions_essai where canal = 'compte:' || :W and tab = 'messages'),
  'deux messages dans la même transaction : une seule diffusion par canal et par table');
select tests.verifier((select bool_and(payload - 'id' = jsonb_build_object('table', payload ->> 'table') and event = 'changement' and private and extension = 'broadcast')
    from realtime.messages where topic like 'compte:00000000-0000-4000-8000-%'),
  'une diffusion est privée et ne dit que le nom de la table, jamais le contenu')
  where current_setting('essai.ecoute')::boolean;
select tests.verifier(pg_temp.notifie(:K, 'Nouveau message: Question sur le TP') = 1, 'la base prévient KANE du message d''Awa');

select tests.connecter(:K);
select tests.verifier((select count(*) = 1 from public.messages where id = 'msg-awa-1'), 'KANE lit le message d''Awa');
select tests.verifier((select array_agg(nom_affiche) from public.annuaire() where id = :W) = array['Awa SECK'], 'et connaît le nom de son expéditrice');
select tests.connecter(:O);
select tests.verifier(not exists (select 1 from public.messages), 'Ousmane ne lit pas les messages d''Awa');
select tests.connecter(:A);
select tests.verifier(not exists (select 1 from public.messages), 'l''administration ne lit pas les messages des autres');

select tests.connecter(:W);
select tests.verifier(tests.lignes('update public.messages set lu = true where id = ''msg-awa-1''') = 0, 'seul le destinataire marque un message lu');
select tests.connecter(:K);
update public.messages set lu = true where id = 'msg-awa-1';
select tests.verifier((select lu and lu_le is not null from public.messages where id = 'msg-awa-1'), 'KANE marque le message lu ; la base date la lecture');
update public.messages set lu = false where id = 'msg-awa-1';
select tests.verifier((select lu from public.messages where id = 'msg-awa-1'), 'un message lu le reste');
select tests.echoue('update public.messages set contenu = ''Autre texte'' where id = ''msg-awa-1''', 'ne se modifie plus', 'un message envoyé ne se modifie plus');
select tests.echoue('delete from public.messages where id = ''msg-awa-1''', 'permission denied', 'un message ne se supprime pas');
insert into public.messages (id, expediteur, destinataire, objet, contenu) values ('msg-kane-1', :K, :W, 'Re: Question sur le TP', 'Oui, lundi.');
insert into public.messages (id, expediteur, destinataire, objet, contenu) values ('msg-kane-2', :K, :O, 'Absence', 'Merci de me voir après le cours.');
select tests.echoue(format('insert into public.messages (id, expediteur, destinataire, objet, contenu) values (''msg-x'', %L, %L, ''Cours'', ''Bonjour'')', :K, :F),
  'row-level security', 'KANE n''écrit pas à une étudiante qu''il n''a pas en cours');
select tests.deconnecter();
update public.etudiants set statut = 'abandon' where id = 'et-ousmane';
select tests.connecter(:K);
select tests.echoue(format('insert into public.messages (id, expediteur, destinataire, objet, contenu) values (''msg-x'', %L, %L, ''Rappel'', ''Bonjour'')', :K, :O),
  'row-level security', 'ni à un étudiant qui a abandonné');
select tests.deconnecter();
update public.etudiants set statut = 'inscrit' where id = 'et-ousmane';
-- Un ancien professeur de la classe avait écrit à Awa : elle peut lui répondre, et le nomme.
insert into public.messages (id, expediteur, destinataire, objet, contenu) values ('msg-fall-ancien', :L, :W, 'Projet', 'Votre projet est noté.');
select tests.connecter(:W);
insert into public.messages (id, expediteur, destinataire, objet, contenu) values ('msg-awa-3', :W, :L, 'Re: Projet', 'Merci beaucoup.');
select tests.verifier((select count(*) = 1 from public.annuaire() where id = :L), 'Awa répond à qui lui a écrit et connaît son nom');

-- ——— Écoute en direct ———
select tests.deconnecter();
select pg_temp.vider_diffusions();
insert into public.messages (id, expediteur, destinataire, objet, contenu) values ('msg-scol-1', :S, :W, 'Attestation', 'Votre attestation est prête.');
select tests.verifier(true, 'écoute des canaux : vérifiée en local seulement, Realtime n''ayant pas encore démarré sur ce projet')
  where not current_setting('essai.ecoute')::boolean;
select tests.connecter(:W);
select set_config('realtime.topic', 'compte:' || :W, false);
select tests.verifier((select count(*) > 0 from realtime.messages), 'Awa écoute son canal') where current_setting('essai.ecoute')::boolean;
select set_config('realtime.topic', 'compte:' || :K, false);
select tests.verifier((select count(*) = 0 from realtime.messages), 'Awa n''écoute pas le canal de KANE') where current_setting('essai.ecoute')::boolean;
select set_config('realtime.topic', 'administration', false);
select tests.verifier((select count(*) = 0 from realtime.messages), 'ni celui de l''administration') where current_setting('essai.ecoute')::boolean;
select tests.echoue('insert into realtime.messages (topic, extension, payload, event, private) values (''administration'', ''broadcast'', ''{"table":"notes"}'', ''changement'', true)',
  'row-level security', 'personne n''écrit dans un canal') where current_setting('essai.ecoute')::boolean;
select tests.deconnecter();
select pg_temp.vider_diffusions();
update public.etudiants set prenom = 'Awa' where id = 'et-awa';
select tests.verifier(not pg_temp.diffuse('administration', 'etudiants'), 'une modification sans changement de statut ne réveille pas l''administration');
update public.etudiants set statut = 'suspendu' where id = 'et-ousmane';
select tests.verifier(pg_temp.diffuse('administration', 'etudiants'), 'un changement de statut la prévient (centre « À traiter »)');
update public.etudiants set statut = 'inscrit' where id = 'et-ousmane';
select tests.connecter(:A);
select set_config('realtime.topic', 'administration', false);
select tests.verifier((select count(*) > 0 from realtime.messages), 'l''administration écoute son canal') where current_setting('essai.ecoute')::boolean;
select set_config('realtime.topic', 'compte:' || :A, false);
select tests.verifier((select count(*) > 0 from realtime.messages), 'et son propre canal') where current_setting('essai.ecoute')::boolean;
select tests.connecter(:X);
select set_config('realtime.topic', 'administration', false);
select tests.verifier((select count(*) = 0 from realtime.messages), 'un compte désactivé n''écoute rien') where current_setting('essai.ecoute')::boolean;
select tests.anonyme();
select tests.verifier((select count(*) = 0 from realtime.messages), 'un visiteur n''écoute rien') where current_setting('essai.ecoute')::boolean;
select set_config('realtime.topic', '', false);

-- ——— Mails envoyés ———
select tests.deconnecter();
delete from public.notifications where destinataire in (:A, :S, :V, :K, :L, :W, :O, :F, :X);
select tests.connecter(:S);
insert into public.mails_envoyes (id, auteur_id, auteur_label, selections, destinataires, objet, message, fichiers, statut)
  values ('mail-1', :S, 'Scolarité', '[{"type":"compte","id":"x","label":"L1"}]',
    jsonb_build_array(jsonb_build_object('label', 'Awa SECK', 'userId', :W), jsonb_build_object('label', 'Mamadou KANE', 'userId', :K),
      jsonb_build_object('label', 'Scolarité', 'userId', :S), jsonb_build_object('label', 'Parent', 'email', 'parent@exemple.invalid')),
    'Réunion de rentrée', 'La réunion aura lieu vendredi.', array['programme.pdf'], 'traite');
select tests.verifier((select validateur_id = :S::text and date_traitement is not null from public.mails_envoyes where id = 'mail-1'),
  'sans validateur désigné, le mail part tout de suite');
select tests.deconnecter();
select tests.verifier((select count(*) = 2 and bool_and(expediteur = :S and mail_id = 'mail-1' and contenu = E'La réunion aura lieu vendredi.\n\nPièces jointes : programme.pdf')
    from public.messages where mail_id = 'mail-1'),
  'la base le dépose dans la messagerie d''Awa et de KANE, au nom de son auteur, avec ses pièces jointes');
select tests.verifier(pg_temp.notifie(:W, 'Nouveau message: Réunion de rentrée') = 1 and pg_temp.notifie(:K, 'Nouveau message: Réunion de rentrée') = 1
    and pg_temp.notifie(:S, 'Nouveau message : Réunion de rentrée') = 1,
  'chaque destinataire est prévenu (l''auteur, destinataire de son propre mail, par une simple notification)');

insert into public.roles_communication (role, compte_id, compte_libelle) values ('validateur_message', :V, 'Responsable communication'), ('destinataire_alert', :A, 'Direction des études');
select tests.connecter(:S);
select tests.echoue(format('insert into public.mails_envoyes (id, auteur_id, objet, message, destinataires, statut) values (''mail-x'', %L, ''Info'', ''Texte'', ''[]'', ''traite'')', :S),
  'doit être validé', 'avec un validateur désigné, le mail d''un autre compte attend la validation');
select tests.echoue(format('insert into public.mails_envoyes (id, auteur_id, objet, message, destinataires, statut) values (''mail-x'', %L, ''Info'', ''Texte'', ''[]'', ''en_attente_validation'')', :V),
  'au nom de son auteur', 'un mail part au nom de son auteur');
insert into public.mails_envoyes (id, auteur_id, auteur_label, destinataires, objet, message, statut)
  values ('mail-2', :S, 'Scolarité', jsonb_build_array(jsonb_build_object('label', 'Awa SECK', 'userId', :W)), 'Calendrier des examens', 'Les examens commencent le 15.', 'en_attente_validation');
insert into public.mails_envoyes (id, auteur_id, auteur_label, destinataires, objet, message, statut)
  values ('mail-3', :S, 'Scolarité', jsonb_build_array(jsonb_build_object('label', 'Awa SECK', 'userId', :W)), 'Fête de fin d''année', 'Tous invités.', 'en_attente_validation');
select tests.deconnecter();
select tests.verifier(not exists (select 1 from public.messages where mail_id in ('mail-2', 'mail-3')), 'un mail en attente n''est déposé chez personne');
select tests.connecter(:S);
select tests.echoue('update public.mails_envoyes set statut = ''traite'' where id = ''mail-2''', 'seul un validateur', 'son auteur ne le valide pas lui-même');
select tests.connecter(:V);
update public.mails_envoyes set statut = 'traite' where id = 'mail-2';
select tests.verifier((select validateur_id = :V::text and validateur_label = 'Responsable communication' and date_traitement is not null from public.mails_envoyes where id = 'mail-2'),
  'le validateur désigné valide ; la base inscrit qui et quand');
select tests.deconnecter();
select tests.verifier((select expediteur = :S from public.messages where mail_id = 'mail-2' and destinataire = :W), 'validé, le mail est déposé chez Awa au nom de son auteur');
select tests.connecter(:V);
select tests.echoue('update public.mails_envoyes set statut = ''rejete'' where id = ''mail-2''', 'déjà été traité', 'un mail traité ne se rejette plus');
select tests.echoue('update public.mails_envoyes set objet = ''Autre objet'' where id = ''mail-3''', 'ne se modifie plus', 'un mail ne se modifie pas après son envoi');
update public.mails_envoyes set statut = 'rejete', motif_rejet = 'Hors sujet' where id = 'mail-3';
select tests.deconnecter();
select tests.verifier(pg_temp.notifie(:S, 'Votre mail "Fête de fin d''année" a été rejeté par Responsable communication — Hors sujet.') = 1,
  'au rejet, la base prévient l''auteur, avec le motif');
select tests.verifier(pg_temp.notifie(:A, 'Mail rejeté : "Fête de fin d''année" (auteur : Scolarité, par Responsable communication).') = 1,
  'et les destinataires des alertes');
select tests.verifier(not exists (select 1 from public.messages where mail_id = 'mail-3'), 'un mail rejeté n''est déposé chez personne');

select tests.connecter(:S);
insert into public.mails_envoyes (id, auteur_id, auteur_label, destinataires, objet, message, statut)
  values ('mail-sys', 'system', 'X', jsonb_build_array(jsonb_build_object('label', 'Mamadou KANE', 'userId', :K)), 'Vos identifiants de connexion', 'Identifiant : KANE', 'en_attente_validation');
select tests.verifier((select statut = 'traite' and auteur_label = 'Système' and validateur_id = 'system' from public.mails_envoyes where id = 'mail-sys'),
  'un mail du système part tout de suite, au nom du « Système »');
select tests.deconnecter();
select tests.verifier(pg_temp.notifie(:K, 'Nouveau message : Vos identifiants de connexion') = 1 and not exists (select 1 from public.messages where mail_id = 'mail-sys'),
  'il prévient son destinataire sans déposer de message (personne à qui répondre)');

select tests.connecter(:K);
select tests.verifier(not exists (select 1 from public.mails_envoyes), 'un professeur ne lit pas les mails de l''administration');
select tests.echoue(format('insert into public.mails_envoyes (id, auteur_id, objet, message, destinataires, statut) values (''mail-x'', %L, ''Info'', ''Texte'', ''[]'', ''traite'')', :K),
  'seule l''administration', 'ni n''en envoie');
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.mails_envoyes), 'une étudiante non plus');
select tests.echoue('delete from public.mails_envoyes', 'permission denied', 'un mail ne se supprime pas');

-- ——— Relance de paiement : son mail inscrit par la base, une seule notification ———
select tests.deconnecter();
select pg_temp.vider_diffusions();
select tests.connecter(:A);
insert into public.relances_paiement (id, etudiant_id, date_envoi, date_echeance, montant_du, envoye_par, statut)
  values ('rel-1', 'et-awa', '2026-11-10', '2026-11-20', 60000, :A, 'active');
select tests.verifier((select auteur_id = 'system' and statut = 'traite' and objet = 'Rappel de paiement — régularisation avant blocage de votre accès'
    and message like '%solde impayé de 60_000 FCFA%' and message like '%avant le 20/11/2026,%' and destinataires -> 0 ->> 'userId' = :W::text
  from public.mails_envoyes where id = 'relance-rel-1'),
  'la relance inscrit son mail au journal des mails, au nom du système');
select tests.deconnecter();
select tests.verifier(pg_temp.notifie(:W, 'Rappel de paiement') = 1 and pg_temp.notifie(:W, 'Nouveau message : Rappel') = 0,
  'Awa n''en reçoit qu''une notification, celle de la relance');
select tests.verifier(pg_temp.diffuse('administration', 'mails_envoyes') and pg_temp.diffuse('compte:' || :W, 'notifications'),
  'en direct : l''administration voit le mail, Awa sa notification');

rollback;
