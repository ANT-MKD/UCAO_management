-- Tests de la partie 10, lot 4 : file des e-mails (Resend) et alertes du service.
-- Comptes d'essai : Ibrahima FALL, administrateur principal (A) ; un validateur des mails (V) ;
-- Awa SECK (W), étudiante. Tout se passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-0000000000e8'''
\set V '''00000000-0000-4000-8000-0000000000e9'''
\set W '''00000000-0000-4000-8000-0000000000ea'''
begin;

insert into auth.users (id, email) values (:A, 'adm.e8@comptes.edumanage.invalid'), (:V, 'val.e9@comptes.edumanage.invalid'),
  (:W, 'awa.ea@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values ('role-com-e', 'ROLE_COM_E', array['com-mails']);
insert into public.annees_academiques (id, libelle, actuelle) values ('an-2026-e', '2026-2027', true);
insert into public.filieres (id, code, nom) values ('fil-qhse-e', 'LQHSEE', 'Licence QHSE');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, statut, annee) values ('et-awa-e', '2026-LQHSEE-0001', 'Awa', 'SECK', 'fil-qhse-e', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, role_id, lien_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM-E', 'Ibrahima FALL', null, null, false),
  (:V, 'administration', 'COM-E', 'Communication', 'role-com-e', null, false),
  (:W, 'etudiant', '2026-LQHSEE-0001', 'Awa SECK', null, 'et-awa-e', true);
delete from private.courriels;

-- ——— Un mail qui part : une ligne par adresse valable ———
select tests.connecter(:A);
insert into public.mails_envoyes (id, auteur_id, objet, message, destinataires, emails_supplementaires, fichiers, statut) values
  ('mail-e1', :A, 'Rentrée 2026', 'Bonjour, la rentrée a lieu lundi.',
   jsonb_build_array(
     jsonb_build_object('label', 'Awa SECK', 'email', 'Awa.Seck@Exemple.sn', 'userId', :W),
     jsonb_build_object('label', 'Ousmane DIALLO', 'email', 'ousmane.diallo@exemple.sn'),
     jsonb_build_object('label', 'Compte technique', 'email', 'awa.ea@comptes.edumanage.invalid'),
     jsonb_build_object('label', 'Sans adresse'),
     jsonb_build_object('label', 'Adresse fautive', 'email', 'pas-une-adresse')),
   array['awa.seck@exemple.sn', ' parents.kane@exemple.sn '], array['calendrier.pdf'], 'traite');
select tests.deconnecter();
select tests.verifier((select array_agg(destinataire order by destinataire) from private.courriels where mail_id = 'mail-e1')
  = array['awa.seck@exemple.sn', 'ousmane.diallo@exemple.sn', 'parents.kane@exemple.sn'],
  'une ligne par adresse, sans doublon (majuscules, espaces), sans adresse technique ni fautive');
select tests.verifier((select bool_and(etat = 'en_attente' and nature = 'mail' and objet = 'Rentrée 2026'
  and texte like 'Bonjour, la rentrée a lieu lundi.%Pièces jointes, à consulter dans votre espace EduManage : calendrier.pdf') from private.courriels),
  'l''e-mail reprend l''objet, le message et cite les pièces jointes');
select tests.verifier((select count(*) = 1 from public.messages where mail_id = 'mail-e1'), 'la messagerie interne reçoit toujours le mail');

-- ——— Validation : rien ne part avant ; un mail rejeté ne part jamais ———
insert into public.roles_communication (role, compte_id, compte_libelle) values ('validateur_message', :V, 'Communication');
select tests.connecter(:A);
insert into public.mails_envoyes (id, auteur_id, objet, message, destinataires, statut) values
  ('mail-e2', :A, 'Examens', 'Calendrier des examens.', jsonb_build_array(jsonb_build_object('label', 'Ousmane', 'email', 'ousmane.diallo@exemple.sn')), 'en_attente_validation'),
  ('mail-e3', :A, 'Brouillon', 'À ne pas envoyer.', jsonb_build_array(jsonb_build_object('label', 'Ousmane', 'email', 'ousmane.diallo@exemple.sn')), 'en_attente_validation');
select tests.deconnecter();
select tests.verifier((select count(*) = 0 from private.courriels where mail_id in ('mail-e2', 'mail-e3')), 'un mail en attente de validation ne part pas');
select tests.connecter(:V);
update public.mails_envoyes set statut = 'traite' where id = 'mail-e2';
update public.mails_envoyes set statut = 'rejete', motif_rejet = 'Doublon' where id = 'mail-e3';
select tests.deconnecter();
select tests.verifier((select count(*) = 1 from private.courriels where mail_id = 'mail-e2') and (select count(*) = 0 from private.courriels where mail_id = 'mail-e3'),
  'validé, il part ; rejeté, jamais');

-- ——— La file est réservée à la fonction serveur ———
select tests.connecter(:A);
select tests.echoue('select count(*) from private.courriels', 'permission denied', 'aucun compte ne lit la file');
select tests.echoue('select * from private.courriels_reserver(10)', 'permission denied', 'ni ne réserve d''e-mails');
select tests.deconnecter();

-- ——— Réservation et résultats ———
create temporary table lot on commit drop as select * from private.courriels_reserver(2);
select tests.verifier((select count(*) = 2 and bool_and(tentatives = 1) from lot), 'deux e-mails réservés, première tentative');
select tests.verifier((select count(*) = 2 from private.courriels_reserver(10)), 'les e-mails réservés ne sont pas repris par un second envoi en même temps');
select private.courriel_resultat((select min(id) from lot), 'envoye', 're_123', null);
select private.courriel_resultat((select max(id) from lot), 'reessayer', null, 'Resend indisponible (503)', 5);
select tests.verifier((select etat = 'envoye' and resend_id = 're_123' and traite_le is not null from private.courriels where id = (select min(id) from lot)),
  'un e-mail parti est noté avec son identifiant Resend');
select tests.verifier((select etat = 'en_attente' and prochain_essai > now() + interval '4 minutes' and motif like 'Resend indisponible%' from private.courriels where id = (select max(id) from lot)),
  'un échec passager est réessayé plus tard');
select private.courriel_resultat((select min(id) from lot), 'refuse', null, 'trop tard');
select tests.verifier((select etat = 'envoye' from private.courriels where id = (select min(id) from lot)), 'un e-mail traité ne change plus');
update private.courriels set tentatives = 6 where id = (select max(id) from lot);
select private.courriel_resultat((select max(id) from lot), 'reessayer', null, 'Resend indisponible (503)', 5);
select tests.verifier((select etat = 'refuse' and traite_le is not null from private.courriels where id = (select max(id) from lot)), 'après 6 tentatives, l''e-mail est abandonné');
select tests.echoue('select private.courriel_resultat(1, ''perdu'', null, null)', 'Résultat inconnu', 'un résultat inconnu est refusé');

-- ——— Suivi par mail, pour l'administration ———
select tests.connecter(:V);
select tests.verifier((public.livraison_courriels(array['mail-e1', 'mail-e2']) -> 'mail-e1' ->> 'envoyes')::int
  + (public.livraison_courriels(array['mail-e1', 'mail-e2']) -> 'mail-e1' ->> 'en_attente')::int
  + (public.livraison_courriels(array['mail-e1', 'mail-e2']) -> 'mail-e1' ->> 'refuses')::int = 3,
  'le suivi donne, mail par mail, les e-mails envoyés, en attente et refusés');
select tests.connecter(:W);
select tests.echoue('select public.livraison_courriels(array[''mail-e1''])', 'réservé à l''administration', 'une étudiante ne lit pas le suivi');
select tests.deconnecter();

-- ——— Alertes du service ———
delete from private.courriels where nature = 'alerte';
insert into public.journal_audit (acteur, action, cible_type, cible_id, cree_le) values (:A, 'installation', 'compte', :A, now() - interval '10 days');
insert into private.mesures_service (jour, base_octets, fichiers_octets, fichiers_nombre) values (current_date, 450000000, 900000000, 1200)
  on conflict (jour) do update set base_octets = excluded.base_octets, fichiers_octets = excluded.fichiers_octets;
select private.preparer_alertes();
select tests.verifier((select array_agg(cle_alerte order by cle_alerte) from private.courriels where nature = 'alerte') = array['base', 'fichiers', 'sauvegarde'],
  'base à 90 %, fichiers à 90 %, aucune sauvegarde depuis 10 jours : trois alertes');
select tests.verifier((select texte like '%450 Mo sur les 500 Mo%lecture seule%' from private.courriels where cle_alerte = 'base'),
  'l''alerte dit la taille et la conséquence');
select private.preparer_alertes();
select tests.verifier((select count(*) = 3 from private.courriels where nature = 'alerte'), 'au plus une alerte de chaque sorte tous les 3 jours');
delete from private.courriels where nature = 'alerte';
update private.mesures_service set base_octets = 50000000, fichiers_octets = 1000000 where jour = current_date;
insert into private.sauvegardes (par, octets, fichiers) values (:A, 1000, 0);
select private.preparer_alertes();
select tests.verifier((select count(*) = 0 from private.courriels where nature = 'alerte'), 'tout va bien : aucune alerte');

-- ——— Purge par la visite quotidienne ———
insert into private.courriels (nature, cle_alerte, objet, texte, etat, cree_le) values
  ('alerte', 'ancienne', 'Ancienne', 'x', 'envoye', now() - interval '200 days'),
  ('alerte', 'attente', 'En attente', 'x', 'en_attente', now() - interval '200 days');
update private.mesures_service set mesure_le = now() - interval '2 hours' where jour = current_date;
select public.veille();
select tests.verifier((select array_agg(cle_alerte) from private.courriels where cle_alerte in ('ancienne', 'attente')) = array['attente'],
  'la visite quotidienne efface les e-mails traités de plus de 180 jours, jamais ceux en attente');

rollback;
