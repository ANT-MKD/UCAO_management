-- Tests de la partie 9, lot 3 : reprise de l'année en cours depuis les données d'un poste.
-- La base vient d'être installée par Ibrahima FALL (A, administrateur principal, identifiant ADM).
-- Le poste avait : l'année passée (2025-2026) et l'année en cours (2026-2027), Awa SECK et
-- Ousmane DIALLO inscrits cette année, Fatou SOW inscrite l'an passé seulement, Mamadou KANE,
-- la scolarité (rôle limité), des quittances, encaissements, messages, contacts et un abandon.
-- La reprise passe par la fonction serveur, en mode « replica » ; ici, le propriétaire de la base
-- en tient lieu. Tout se passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-0000000000a1'''
\set S '''00000000-0000-4000-8000-0000000000a2'''
\set K '''00000000-0000-4000-8000-0000000000a3'''
\set W '''00000000-0000-4000-8000-0000000000a4'''
\set F '''00000000-0000-4000-8000-0000000000a5'''
\set D '''00000000-0000-4000-8000-0000000000a6'''
begin;

-- ——— Base installée ———
insert into auth.users (id, email) values
  (:A, 'adm.a@comptes.edumanage.invalid'), (:S, 'scol.s@comptes.edumanage.invalid'), (:K, 'kane.k@comptes.edumanage.invalid'),
  (:W, 'awa.w@comptes.edumanage.invalid'), (:F, 'fatou.f@comptes.edumanage.invalid'), (:D, 'double.d@comptes.edumanage.invalid');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, fonction, doit_changer_mot_de_passe)
  values (:A, 'administration', 'ADM', 'Ibrahima FALL', 'Administrateur principal', false);
insert into public.etablissement (id, nom) values (1, 'Institut Supérieur EduManage');
insert into public.annees_academiques (libelle, date_debut, date_fin, actuelle) values ('2026-2027', '2026-10-01', '2027-07-31', true);

-- ——— Données du poste ———
create function pg_temp.poste() returns jsonb language sql as $$
  select jsonb_build_object(
    'annees_academiques', jsonb_build_array(
      jsonb_build_object('id', 'an-2025', 'libelle', '2025-2026', 'date_debut', '2025-10-01', 'date_fin', '2026-07-31', 'actuelle', false, 'cloturee', true),
      jsonb_build_object('id', 'an-2026', 'libelle', '2026-2027', 'date_debut', '2026-10-01', 'date_fin', '2027-07-31', 'actuelle', true, 'cloturee', false)),
    'etablissement', jsonb_build_array(jsonb_build_object('id', 1, 'nom', 'UCAO Saint-Michel', 'adresse', 'Dakar')),
    'roles', jsonb_build_array(jsonb_build_object('id', 'role-scol', 'code', 'ROLE_SCOL', 'pages', jsonb_build_array('etudiants-liste'))),
    'filieres', jsonb_build_array(jsonb_build_object('id', 'fil-qhse', 'code', 'LQHSE', 'nom', 'Licence QHSE')),
    'niveaux', jsonb_build_array(jsonb_build_object('id', 'niv-l1', 'nom', 'Licence 1', 'alias', 'L1', 'filiere_id', 'fil-qhse')),
    'classes', jsonb_build_array(
      jsonb_build_object('id', 'cl-l1-26', 'nom', 'LQHSE1-26/27', 'filiere_id', 'fil-qhse', 'niveau_id', 'niv-l1', 'niveau', 'L1', 'max', 40, 'annee', '2026-2027'),
      jsonb_build_object('id', 'cl-l1-25', 'nom', 'LQHSE1-25/26', 'filiere_id', 'fil-qhse', 'niveau_id', 'niv-l1', 'niveau', 'L1', 'max', 40, 'annee', '2025-2026')),
    'enseignants', jsonb_build_array(jsonb_build_object('id', 'en-kane', 'prenom', 'Mamadou', 'nom', 'KANE', 'matricule', 'ENS-2026-100', 'grade', 'Vacataire')),
    'etudiants', jsonb_build_array(
      jsonb_build_object('id', 'et-awa', 'matricule', '2026-LQHSE-0001', 'prenom', 'Awa', 'nom', 'SECK', 'filiere_id', 'fil-qhse', 'classe_id', 'cl-l1-26',
        'niveau', 'L1', 'statut', 'inscrit', 'annee', '2026-2027'),
      jsonb_build_object('id', 'et-ousmane', 'matricule', '2026-LQHSE-0007', 'prenom', 'Ousmane', 'nom', 'DIALLO', 'filiere_id', 'fil-qhse', 'classe_id', 'cl-l1-26',
        'niveau', 'L1', 'statut', 'inscrit', 'annee', '2026-2027'),
      jsonb_build_object('id', 'et-fatou', 'matricule', '2025-LQHSE-0003', 'prenom', 'Fatou', 'nom', 'SOW', 'filiere_id', 'fil-qhse', 'classe_id', 'cl-l1-25',
        'niveau', 'L1', 'statut', 'inscrit', 'annee', '2025-2026')),
    'inscriptions', jsonb_build_array(
      jsonb_build_object('id', 'ins-awa-25', 'etudiant_id', 'et-awa', 'annee', '2025-2026', 'filiere_id', 'fil-qhse', 'statut', 'inscrit', 'type', 'premiere'),
      jsonb_build_object('id', 'ins-awa-26', 'etudiant_id', 'et-awa', 'annee', '2026-2027', 'filiere_id', 'fil-qhse', 'statut', 'inscrit', 'type', 'reinscription')),
    'quittances', jsonb_build_array(
      jsonb_build_object('id', 'q-awa-25', 'numero_recu', 'RECU-2025-002', 'date', '2025-11-02', 'etudiant_id', 'et-awa', 'etudiant', 'Awa SECK', 'classe', 'LQHSE1-25/26',
        'rubrique', 'Scolarité', 'lignes', '[{"libelle": "Scolarité", "montant": 60000}]'::jsonb, 'montant', 60000, 'moyen', '', 'reference', '', 'solde_restant', 20000, 'statut', 'paye'),
      jsonb_build_object('id', 'q-awa-26', 'numero_recu', 'RECU-2026-007', 'date', '2026-11-02', 'etudiant_id', 'et-awa', 'etudiant', 'Awa SECK', 'classe', 'LQHSE1-26/27',
        'rubrique', 'Scolarité', 'lignes', '[{"libelle": "Scolarité", "montant": 60000}]'::jsonb, 'montant', 60000, 'moyen', '', 'reference', '', 'solde_restant', 60000, 'statut', 'paye'),
      jsonb_build_object('id', 'q-fatou', 'numero_recu', 'RECU-2025-009', 'date', '2025-11-03', 'etudiant_id', 'et-fatou', 'etudiant', 'Fatou SOW', 'classe', 'LQHSE1-25/26',
        'rubrique', 'Scolarité', 'lignes', '[{"libelle": "Scolarité", "montant": 50000}]'::jsonb, 'montant', 50000, 'moyen', '', 'reference', '', 'solde_restant', 50000, 'statut', 'paye')),
    'encaissements', jsonb_build_array(
      jsonb_build_object('id', 'enc-awa-25', 'reference', 'OP-2025-004', 'date', '2025-12-01', 'quittance_id', 'q-awa-25', 'quittance_reference', 'RECU-2025-002',
        'montant_quittance_total', 60000, 'etudiant_id', 'et-awa', 'payeur', 'Awa SECK', 'filiere', 'LQHSE', 'annee', '2025-2026', 'montant', 40000,
        'moyen', 'especes', 'encaisse_par', 'Caisse', 'annulee', false, 'lignes', '[]'::jsonb)),
    'soldes_etudiants', jsonb_build_array(
      jsonb_build_object('id', 'et-awa', 'solde_du', 80000, 'solde_avoir', 0), jsonb_build_object('id', 'et-fatou', 'solde_du', 50000, 'solde_avoir', 0)),
    'contacts_etudiants', jsonb_build_array(
      jsonb_build_object('id', 'ct-awa', 'etudiant_id', 'et-awa', 'role', 'pere', 'nom_complet', 'Moussa SECK'),
      jsonb_build_object('id', 'ct-fatou', 'etudiant_id', 'et-fatou', 'role', 'mere', 'nom_complet', 'Aminata SOW'),
      jsonb_build_object('id', 'ct-oncle', 'etudiant_id', 'et-awa', 'role', 'oncle', 'nom_complet', 'Cheikh SECK')),
    'abandons', jsonb_build_array(
      jsonb_build_object('id', 'ab-ousmane', 'etudiant_id', 'et-ousmane', 'annee', '2026-2027', 'date_abandon', '2026-10-20', 'motif', 'Raisons familiales',
        'valide_par_id', 'u-parti', 'reintegre', true, 'date_reintegration', '2026-10-28')),
    'messages', jsonb_build_array(
      jsonb_build_object('id', 'msg-awa', 'expediteur', 'u-awa', 'destinataire', 'u-kane', 'objet', 'TP', 'contenu', 'Le TP est-il à rendre lundi ?'),
      jsonb_build_object('id', 'msg-fatou', 'expediteur', 'u-fatou', 'destinataire', 'u-admin', 'objet', 'Relevé', 'contenu', 'Mon relevé de l''an passé ?'),
      jsonb_build_object('id', 'msg-parti', 'expediteur', 'u-parti', 'destinataire', 'u-admin', 'objet', 'Au revoir', 'contenu', 'Je quitte l''établissement.')))
$$;

-- Comptes du poste ; « ids » : identités Supabase créées pour eux (reprise réelle).
create function pg_temp.comptes(p_ids boolean) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('ancien', 'u-admin', 'type_compte', 'administration', 'identifiant', 'adm', 'nom_affiche', 'Administrateur'),
    jsonb_build_object('ancien', 'u-scol', 'type_compte', 'administration', 'identifiant', 'scol-1', 'nom_affiche', 'Scolarité', 'role_id', 'role-scol',
      'email', 'Scolarite@UCAO.edu', 'id', case when p_ids then '00000000-0000-4000-8000-0000000000a2' end),
    jsonb_build_object('ancien', 'u-kane', 'type_compte', 'enseignant', 'identifiant', 'KANE', 'nom_affiche', 'Mamadou KANE', 'lien_id', 'en-kane',
      'id', case when p_ids then '00000000-0000-4000-8000-0000000000a3' end),
    jsonb_build_object('ancien', 'u-awa', 'type_compte', 'etudiant', 'identifiant', '2026-lqhse-0001', 'nom_affiche', 'Awa SECK', 'lien_id', 'et-awa',
      'id', case when p_ids then '00000000-0000-4000-8000-0000000000a4' end),
    jsonb_build_object('ancien', 'u-fatou', 'type_compte', 'etudiant', 'identifiant', '2025-LQHSE-0003', 'nom_affiche', 'Fatou SOW', 'lien_id', 'et-fatou',
      'id', case when p_ids then '00000000-0000-4000-8000-0000000000a5' end),
    jsonb_build_object('ancien', 'u-kane-bis', 'type_compte', 'enseignant', 'identifiant', 'kane', 'nom_affiche', 'Mamadou KANE (doublon)', 'lien_id', 'en-kane',
      'id', case when p_ids then '00000000-0000-4000-8000-0000000000a6' end))
$$;

-- ——— Refus ———
select tests.echoue(format('select private.reprendre(%L, pg_temp.poste(), pg_temp.comptes(false), %L, true)', '2026-2027', :A),
  'fonction serveur « reprise »', 'hors de la fonction serveur (mode replica), pas de reprise');
set local session_replication_role = replica;
select tests.echoue(format('select private.reprendre(%L, pg_temp.poste(), pg_temp.comptes(false), %L, true)', '2026-2027', :K),
  'administrateur à accès complet', 'seul un administrateur à accès complet reprend les données');
select tests.echoue(format('select private.reprendre(%L, pg_temp.poste(), pg_temp.comptes(false), %L, true)', '2027-2028', :A),
  'absente des données de ce poste', 'l''année en cours doit figurer dans les données du poste');
select tests.echoue(format('select private.reprendre(%L, pg_temp.poste() || %L::jsonb, pg_temp.comptes(false), %L, true)', '2026-2027',
  '{"journal_audit": []}', :A), 'ne se reprennent pas', 'le journal, les notifications, les codes et les comptes ne se reprennent pas tels quels');
select tests.echoue(format('select private.reprendre(%L, pg_temp.poste() || %L::jsonb, pg_temp.comptes(false), %L, true)', '2026-2027',
  '{"tables_inconnue": []}', :A), 'ne se reprennent pas', 'une table inconnue est refusée');
savepoint base_utilisee;
insert into public.filieres (id, code, nom) values ('fil-info', 'LINFO', 'Licence Informatique');
select tests.echoue(format('select private.reprendre(%L, pg_temp.poste(), pg_temp.comptes(false), %L, true)', '2026-2027', :A),
  'contient déjà des données (filieres)', 'une base déjà utilisée ne reçoit pas de reprise');
rollback to savepoint base_utilisee;

-- ——— Essai : le rapport de contrôle, puis rien ne reste ———
savepoint essai;
create temporary table rapport_essai on commit drop as
  select private.reprendre('2026-2027', pg_temp.poste(), pg_temp.comptes(false), :A, true, array['etudiants', 'contacts_etudiants']) as r;
select tests.verifier((select r #> '{tables,etudiants}' = '{"recues": 3, "autre_annee": 1, "liens_manquants": 0, "comptes_inconnus": 0, "refusees": 0, "reprises": 2}'::jsonb
  from rapport_essai), 'essai : 3 étudiants reçus, Fatou (l''an passé) écartée, 2 repris');
select tests.verifier((select r #> '{tables,inscriptions}' = '{"recues": 2, "autre_annee": 1, "liens_manquants": 0, "comptes_inconnus": 0, "refusees": 0, "reprises": 1}'::jsonb
  from rapport_essai), 'essai : l''inscription d''Awa de l''an passé est écartée, celle de cette année reprise');
select tests.verifier((select (r #>> '{tables,quittances,reprises}')::int = 2 and (r #>> '{tables,quittances,liens_manquants}')::int = 1
  and (r #>> '{tables,encaissements,reprises}')::int = 1 from rapport_essai),
  'essai : les pièces financières d''Awa sont reprises en entier (l''an passé compris), celle de Fatou écartée avec elle');
select tests.verifier((select (r #>> '{liens,quittances_etudiant_id_fkey}')::int = 1 and (r #>> '{liens,contacts_etudiants_etudiant_id_fkey}')::int = 1
  and (r #>> '{liens,soldes_etudiants_id_fkey}')::int = 1 and (r #>> '{liens,messages_expediteur_fkey}')::int = 1 from rapport_essai),
  'essai : chaque ligne écartée faute de lien est comptée par lien (quittance, contact, solde, message de Fatou)');
select tests.verifier((select (r #>> '{tables,contacts_etudiants,refusees}')::int = 1 and (r #>> '{tables,contacts_etudiants,reprises}')::int = 1
  and r -> 'refus' = jsonb_build_array(jsonb_build_object('table', 'contacts_etudiants', 'id', 'ct-oncle',
    'motif', 'new row for relation "contacts_etudiants" violates check constraint "contacts_etudiants_role_check"')) from rapport_essai),
  'essai : le contact « oncle » (rôle inconnu de la base) est écarté et listé avec son motif, les autres lignes de la table sont reprises');
select tests.verifier((select (r #>> '{tables,abandons,comptes_inconnus}')::int = 1 and (r #>> '{tables,messages,comptes_inconnus}')::int = 1
  and (r #>> '{tables,messages,reprises}')::int = 1 from rapport_essai),
  'essai : un compte inconnu est retiré d''un abandon (validé par), et le message qu''il avait écrit est écarté');
select tests.verifier((select r #> '{comptes,existants}' = '1' and r #> '{comptes,crees}' = '3' and r -> 'gardes' = '{"etudiants": ["et-awa", "et-ousmane"], "contacts_etudiants": ["ct-awa"]}'::jsonb
  from rapport_essai), 'essai : l''administrateur existant est repris tel quel, 3 comptes à créer ; les lignes gardées sont données pour leurs fichiers');
select tests.verifier((select (select array_agg(e ->> 'motif' order by e ->> 'motif') from jsonb_array_elements(r #> '{comptes,ecartes}') e)
  = array['fiche non reprise (autre année)', 'identifiant en double'] and r #> '{comptes,a_creer}' @> '["u-scol", "u-kane", "u-awa"]'
  and jsonb_array_length(r #> '{comptes,a_creer}') = 3 from rapport_essai),
  'essai : le compte de Fatou (fiche de l''an passé) et le doublon de KANE sont écartés, avec leur motif');
select tests.verifier((select r -> 'compteurs' @> '{"matricule:2026-LQHSE": 7, "recu:2026": 7, "recu:2025": 2, "op:2025": 4}' from rapport_essai),
  'essai : les compteurs de numérotation repartent après les plus grands numéros repris');
rollback to savepoint essai;
select tests.verifier((select count(*) = 1 from public.comptes) and not exists (select 1 from public.etudiants) and not exists (select 1 from private.reprises)
  and (select nom from public.etablissement) = 'Institut Supérieur EduManage', 'après l''essai, rien ne reste');

-- ——— Reprise réelle ———
create temporary table versions_avant on commit drop as select (select last_value from private.version_etudiants) as etudiants;
create temporary table rapport_reel on commit drop as
  select private.reprendre('2026-2027', pg_temp.poste(), pg_temp.comptes(true), :A, false) as r;
select tests.verifier((select array_agg(id order by id) from public.etudiants) = array['et-awa', 'et-ousmane']
  and (select array_agg(id) from public.inscriptions) = array['ins-awa-26'] and (select array_agg(id order by id) from public.classes) = array['cl-l1-26'],
  'reprise : étudiants, inscriptions et classes de l''année en cours seulement');
select tests.verifier((select array_agg(libelle || ':' || actuelle order by libelle) from public.annees_academiques) = array['2025-2026:false', '2026-2027:true']
  and (select id from public.annees_academiques where actuelle) = 'an-2026', 'reprise : les années du poste remplacent celle de l''installation, l''année en cours reste l''actuelle');
select tests.verifier((select nom = 'UCAO Saint-Michel' and adresse = 'Dakar' from public.etablissement), 'reprise : l''établissement du poste remplace celui de l''installation');
select tests.verifier((select array_agg(identifiant order by identifiant) from public.comptes) = array['2026-LQHSE-0001', 'ADM', 'KANE', 'SCOL-1']
  and (select bool_and(doit_changer_mot_de_passe) from public.comptes where id <> :A)
  and (select email = 'scolarite@ucao.edu' and role_id = 'role-scol' from public.comptes where id = :S),
  'reprise : comptes recréés (identifiants en majuscules), chacun choisira un nouveau mot de passe');
select tests.verifier((select expediteur = :W and destinataire = :K from public.messages where id = 'msg-awa'),
  'reprise : le message d''Awa à KANE porte leurs nouveaux comptes');
select tests.verifier((select valide_par_id is null and reintegre from public.abandons where id = 'ab-ousmane'), 'reprise : l''abandon réintégré d''Ousmane est repris tel quel');
select tests.verifier((select solde_du = 80000 from public.soldes_etudiants where id = 'et-awa') and not exists (select 1 from public.soldes_etudiants where id = 'et-fatou'),
  'reprise : le solde d''Awa est repris tel que le poste le tenait');
select tests.verifier((select r -> 'ecartes_ids' = to_jsonb(array[:F, :D]::uuid[]) from rapport_reel)
  or (select r -> 'ecartes_ids' = to_jsonb(array[:D, :F]::uuid[]) from rapport_reel),
  'reprise : les identités créées pour Fatou et le doublon sont désignées pour suppression');
select tests.verifier((select valeur = 7 from private.compteurs where cle = 'matricule:2026-LQHSE'), 'reprise : le prochain matricule LQHSE 2026 sera le 0008');
select tests.verifier((select last_value from private.version_etudiants) > (select etudiants from versions_avant),
  'reprise : les postes connectés voient que les tables ont changé (sans déclencheur, la reprise l''indique elle-même)');
select tests.verifier((select count(*) = 1 from public.journal_audit where action = 'reprise_donnees' and acteur = :A and cible_id = '2026-2027'),
  'reprise : elle est inscrite au journal');
select tests.verifier((select count(*) = 1 from private.reprises where par = :A and annee = '2026-2027' and not (rapport ? 'gardes')),
  'reprise : elle est gardée avec son rapport');
select tests.echoue(format('select private.reprendre(%L, pg_temp.poste(), pg_temp.comptes(true), %L, false)', '2026-2027', :A),
  'déjà été faite', 'une seconde reprise est refusée');
set local session_replication_role = origin;

-- ——— État de la reprise, pour l'administration ———
select tests.connecter(:S);
select tests.echoue('select public.etat_reprise()', 'accès complet', 'la scolarité (rôle limité) ne lit pas l''état de la reprise');
select tests.connecter(:A);
select tests.verifier((select public.etat_reprise() ->> 'annee') = '2026-2027'
  and (select (public.etat_reprise() #>> '{rapport,tables,etudiants,reprises}')::int) = 2, 'l''administrateur principal lit la reprise et son rapport');
select tests.anonyme();
select tests.echoue('select public.etat_reprise()', 'permission denied', 'un visiteur ne la lit pas');
select tests.deconnecter();

rollback;
