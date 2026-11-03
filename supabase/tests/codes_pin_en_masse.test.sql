-- Tests de la partie 10, lot 1 : codes PIN en masse.
-- Comptes d'essai : Ibrahima FALL, administrateur principal (A) ; la scolarité (S, page des codes
-- PIN) ; la caisse (C, sans cette page) ; un second administrateur à accès complet (X) ; les
-- étudiants de L1 QHSE Awa SECK (W), Ousmane DIALLO (O) et Fatou SOW (F, compte désactivé).
-- Tout se passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-0000000000e1'''
\set S '''00000000-0000-4000-8000-0000000000e2'''
\set C '''00000000-0000-4000-8000-0000000000e3'''
\set X '''00000000-0000-4000-8000-0000000000e4'''
\set W '''00000000-0000-4000-8000-0000000000e5'''
\set O '''00000000-0000-4000-8000-0000000000e6'''
\set F '''00000000-0000-4000-8000-0000000000e7'''
begin;

insert into auth.users (id, email) values
  (:A, 'adm.e1@comptes.edumanage.invalid'), (:S, 'scol.e2@comptes.edumanage.invalid'), (:C, 'caisse.e3@comptes.edumanage.invalid'),
  (:X, 'adm2.e4@comptes.edumanage.invalid'), (:W, 'awa.e5@comptes.edumanage.invalid'), (:O, 'ousmane.e6@comptes.edumanage.invalid'),
  (:F, 'fatou.e7@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values ('role-scol', 'ROLE_SCOL', array['sec-pin-activation']), ('role-caisse', 'ROLE_CAISSE', array['fin-quittance-liste']);
insert into public.annees_academiques (id, libelle, actuelle) values ('an-2026', '2026-2027', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'inscrit', '2026-2027'),
  ('et-fatou', '2026-LQHSE-0003', 'Fatou', 'SOW', 'fil-qhse', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, role_id, lien_id, actif, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM', 'Ibrahima FALL', null, null, true, false),
  (:S, 'administration', 'SCOL-1', 'Scolarité', 'role-scol', null, true, false),
  (:C, 'administration', 'CAISSE-1', 'Caisse', 'role-caisse', null, true, false),
  (:X, 'administration', 'ADM-2', 'Second administrateur', null, null, true, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', null, 'et-awa', true, true),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', null, 'et-ousmane', true, true),
  (:F, 'etudiant', '2026-LQHSE-0003', 'Fatou SOW', null, 'et-fatou', false, true);
insert into public.demandes_reinitialisation (compte) values (:W);

-- ——— Refus ———
select tests.connecter(:C);
select tests.echoue(format('select public.generer_codes_pin(array[%L]::uuid[])', :W), 'pas accès aux codes PIN', 'la caisse ne génère pas de codes');
select tests.connecter(:S);
select tests.echoue('select public.generer_codes_pin(array[]::uuid[])', 'de 1 à 100 comptes', 'une liste vide est refusée');
select tests.echoue('select public.generer_codes_pin(array(select gen_random_uuid() from generate_series(1, 101)))', 'de 1 à 100 comptes',
  'au-delà de 100 comptes, l''écran envoie en plusieurs fois');
select tests.echoue(format('select public.generer_codes_pin(array[%L]::uuid[], 0)', :W), 'de 1 à 14 jours', 'validité nulle refusée');
select tests.echoue(format('select public.generer_codes_pin(array[%L]::uuid[], 15)', :W), 'de 1 à 14 jours', 'validité de plus de 14 jours refusée');
select tests.echoue(format('select public.generer_codes_pin(array[%L, %L]::uuid[])', :W, :X), 'accès complet',
  'la scolarité ne génère pas de code pour un administrateur à accès complet');
select tests.verifier(not exists (select 1 from public.codes_pin_suivi), 'un refus ne laisse aucun code, même pour les comptes valables de la liste');

-- ——— Codes de la classe ———
select set_config('tests.ancien', (public.generer_code_pin(:O)) ->> 'code', false);
create temporary table codes on commit drop as
  select public.generer_codes_pin(array[:W, :O, :F, :W, null]::uuid[], 7) as r;
select tests.verifier((select jsonb_array_length(r) = 3 from codes), 'un résultat par compte, doublons et vides ignorés');
select tests.verifier((select bool_and(e ->> 'code' ~ '^[0-9]{6}$') from codes, jsonb_array_elements(r) e where e ->> 'compte' in (:W, :O)),
  'Awa et Ousmane reçoivent chacun un code à 6 chiffres');
select tests.verifier((select e ->> 'code' is null and e ->> 'motif' = 'compte désactivé' from codes, jsonb_array_elements(r) e where e ->> 'compte' = :F),
  'Fatou (compte désactivé) n''en reçoit pas, avec le motif');
select tests.verifier((select bool_and(e ->> 'identifiant' like '2026-LQHSE-%' and e ->> 'nom_affiche' <> '') from codes, jsonb_array_elements(r) e),
  'la liste donne matricule et nom, pour l''impression');
select tests.verifier((select bool_and((e ->> 'expire_le')::timestamptz between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour')
  from codes, jsonb_array_elements(r) e where e ->> 'code' is not null), 'les codes valent 7 jours');
select tests.verifier((select array_agg(statut order by id) from public.codes_pin_suivi where compte = :O) = array['remplace', 'actif'],
  'le code remis la veille à Ousmane est remplacé par le nouveau');
select tests.verifier((select count(*) = 3 from public.codes_pin_suivi), 'trois codes en tout : aucun pour Fatou');
select tests.verifier((select traitee_le is not null and traitee_par = :S from public.demandes_reinitialisation where compte = :W),
  'la demande « mot de passe oublié » d''Awa est traitée');
select tests.deconnecter();
select tests.verifier((select count(*) = 2 from public.journal_audit where action = 'generate_pin' and details = 'en masse, valable 7 jour(s)' and acteur = :S),
  'chaque code en masse est inscrit au journal');

-- ——— Les codes servent comme un code remis seul ———
select tests.verifier(not (public.code_pin_utiliser('2026-LQHSE-0002', current_setting('tests.ancien')) ->> 'ok')::boolean,
  'l''ancien code d''Ousmane ne sert plus');
select tests.verifier((select (public.code_pin_utiliser('2026-lqhse-0001', e ->> 'code') ->> 'ok')::boolean from codes, jsonb_array_elements(r) e where e ->> 'compte' = :W),
  'Awa choisit son mot de passe avec le code de la liste');
select tests.verifier((select (public.code_pin_utiliser('2026-LQHSE-0002', e ->> 'code') ->> 'ok')::boolean from codes, jsonb_array_elements(r) e where e ->> 'compte' = :O),
  'Ousmane aussi, avec le sien');

-- ——— Accès complet et visiteurs ———
select tests.connecter(:A);
select tests.verifier((select jsonb_array_length(public.generer_codes_pin(array[:X]::uuid[], 1)) = 1), 'l''administrateur principal génère aussi pour un autre accès complet');
select tests.anonyme();
select tests.echoue(format('select public.generer_codes_pin(array[%L]::uuid[])', :W), 'permission denied', 'un visiteur n''y a pas accès');
select tests.deconnecter();

rollback;
