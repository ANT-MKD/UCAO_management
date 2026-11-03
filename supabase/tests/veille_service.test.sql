-- Tests de la partie 10, lot 3 : veille (contre la mise en pause) et espace occupé.
-- Comptes d'essai : Ibrahima FALL, administrateur principal (A) ; la scolarité (S, accès limité).
-- Fichiers : une photo d'Awa SECK et un relevé de Mamadou KANE, plus un objet sans taille lisible.
-- Tout se passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-0000000000f1'''
\set S '''00000000-0000-4000-8000-0000000000f2'''
begin;

insert into auth.users (id, email) values (:A, 'adm.f1@comptes.edumanage.invalid'), (:S, 'scol.f2@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values ('role-scol-veille', 'ROLE_SCOL_VEILLE', array['sec-users']);
insert into public.comptes (id, type_compte, identifiant, nom_affiche, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM', 'Ibrahima FALL', null, false),
  (:S, 'administration', 'SCOL-1', 'Scolarité', 'role-scol-veille', false);
insert into storage.buckets (id, name) values ('essai-veille', 'essai-veille') on conflict do nothing;
insert into storage.objects (bucket_id, name, metadata) values
  ('essai-veille', 'etudiants/et-awa/photo.jpg', '{"size": 150000, "mimetype": "image/jpeg"}'),
  ('essai-veille', 'enseignants/en-kane/releve.pdf', '{"size": 350000}'),
  ('essai-veille', 'divers/sans-taille.bin', '{"size": "inconnue"}');
delete from private.mesures_service;

-- ——— La visite quotidienne, sans compte ———
select tests.anonyme();
select tests.verifier(public.veille() = '{"ok": true}'::jsonb, 'la visite répond « ok », sans rien dévoiler d''autre');
select tests.echoue('select count(*) from private.mesures_service', 'permission denied', 'un visiteur ne lit pas les mesures');
select tests.echoue('select public.etat_service()', 'permission denied', 'un visiteur ne lit pas l''état du service');
select tests.deconnecter();

select tests.verifier((select count(*) = 1 and bool_and(jour = current_date) from private.mesures_service), 'la visite enregistre une mesure pour aujourd''hui');
select tests.verifier((select base_octets > 0 from private.mesures_service), 'la taille de la base est mesurée');
select tests.verifier((select fichiers_octets = 500000 and fichiers_nombre >= 3 from private.mesures_service),
  'les fichiers comptent pour leur taille (150 Ko + 350 Ko), un objet sans taille lisible compte pour zéro');

-- Au plus une mesure par heure : une seconde visite ne la refait pas.
update private.mesures_service set mesure_le = now() - interval '30 minutes', base_octets = 1;
select public.veille();
select tests.verifier((select base_octets = 1 from private.mesures_service), 'une seconde visite dans l''heure ne refait pas la mesure');
update private.mesures_service set mesure_le = now() - interval '2 hours';
select public.veille();
select tests.verifier((select base_octets > 1 and mesure_le > now() - interval '1 minute' from private.mesures_service), 'au-delà d''une heure, la mesure est refaite');

-- 400 jours d'historique au plus.
insert into private.mesures_service (jour, base_octets, fichiers_octets, fichiers_nombre, mesure_le) values
  (current_date - 401, 1, 0, 0, now() - interval '401 days'), (current_date - 30, 1, 0, 0, now() - interval '30 days');
update private.mesures_service set mesure_le = now() - interval '2 hours' where jour = current_date;
select public.veille();
select tests.verifier((select array_agg(current_date - jour order by jour) = array[30, 0] from private.mesures_service),
  'les mesures de plus de 400 jours sont effacées, les autres gardées');

-- ——— L'état du service, pour l'administrateur principal ———
select tests.connecter(:S);
select tests.echoue('select public.etat_service()', 'accès complet', 'la scolarité ne lit pas l''état du service');
select tests.connecter(:A);
create temporary table etat on commit drop as select public.etat_service() as e;
select tests.deconnecter();
select tests.verifier((select (e ->> 'base_limite')::bigint = 500000000 and (e ->> 'fichiers_limite')::bigint = 1000000000 from etat),
  'les limites de l''offre gratuite : 500 Mo de base, 1 Go de fichiers');
select tests.verifier((select (e ->> 'base_octets')::bigint > 0 and (e ->> 'fichiers_octets')::bigint = 500000 and (e ->> 'fichiers_nombre')::bigint >= 3 from etat),
  'l''espace occupé est mesuré au moment de la lecture');
select tests.verifier((select (e ->> 'derniere_veille')::timestamptz = (select max(mesure_le) from private.mesures_service) from etat),
  'la date de la dernière visite est donnée');
delete from private.mesures_service;
select tests.connecter(:A);
select tests.verifier(public.etat_service() -> 'derniere_veille' = 'null'::jsonb, 'sans aucune visite, la date est vide (alerte possible)');
select tests.deconnecter();

rollback;
