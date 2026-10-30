-- Tests de la partie 3, lot 3 : paramétrage scolarité, règlements de calcul et leur historique,
-- paramétrage bulletins.
-- Comptes d'essai : l'administrateur principal (A), Ibrahima FALL à la scolarité (S : Paramétrage
-- scolarité et Règlements de calcul), un compte « Bulletins » (B : Paramétrage bulletins),
-- l'étudiante Awa SECK (W).
-- Tout se passe dans une transaction annulée à la fin.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-00000000000a'''
\set S '''00000000-0000-4000-8000-00000000000b'''
\set B '''00000000-0000-4000-8000-00000000000d'''
\set W '''00000000-0000-4000-8000-00000000000e'''
begin;

insert into auth.users (id, email) values
  (:A, 'adm.a@comptes.edumanage.invalid'), (:S, 'scol.s@comptes.edumanage.invalid'),
  (:B, 'bul.b@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-scolarite', 'ROLE_SCOLARITE', array['scol-param', 'scol-formules']),
  ('role-bulletins', 'ROLE_BULLETINS', array['bul-param']);
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADM-PRINCIPAL', 'Fatou DIOP', null, null, false),
  (:S, 'administration', 'SCOL-FALL', 'Ibrahima FALL', null, 'role-scolarite', false),
  (:B, 'administration', 'BUL-1', 'Bulletins', null, 'role-bulletins', false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false);
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle, cloturee) values
  ('annee-2025', '2025-2026', '2025-11-03', '2026-07-31', false, true),
  ('annee-2026', '2026-2027', '2026-11-02', '2027-07-31', true, false);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE'), ('fil-gl', 'LGL', 'Licence Génie logiciel');

-- ——— Paramétrage scolarité ———
select tests.connecter(:S);
insert into public.scolarite_valeurs_defaut (note_bareme, cumul_credit, moyenne_passage, moyenne_eliminatoire, modifie_par)
  values (20, true, 10, 0, 'Ibrahima FALL');
insert into public.scolarite_configs (id, filiere_id, filiere, note_bareme, cumul_credit, moyenne_passage, moyenne_eliminatoire, regles_calcul) values
  ('scol-cfg-fil-qhse', 'fil-qhse', 'Licence QHSE', 20, true, 10, 0, '{"seuilValidationEc": 10, "regleRattrapage": "meilleure", "creditsPassageAvecDette": 42}');
select tests.echoue('insert into public.scolarite_valeurs_defaut (id, note_bareme, cumul_credit, moyenne_passage, moyenne_eliminatoire) values (''autre'', 20, true, 10, 0)',
  'check constraint', 'les valeurs par défaut de l''établissement tiennent sur une seule ligne');
select tests.echoue('update public.scolarite_configs set regles_calcul = ''{"bonusSecret": 5}'' where id = ''scol-cfg-fil-qhse''', 'check constraint',
  'une règle de calcul inconnue de l''application est refusée');
select tests.echoue('update public.scolarite_configs set note_bareme = 0 where id = ''scol-cfg-fil-qhse''', 'check constraint',
  'un barème nul est refusé');
select tests.connecter(:B);
update public.scolarite_configs set methode_calcul_moy_ue_id = 'meth-moyenneUe-calculMoyenneCredit', calcul_grade = true where id = 'scol-cfg-fil-qhse';
select tests.verifier((select methode_calcul_moy_ue_id = 'meth-moyenneUe-calculMoyenneCredit' from public.scolarite_configs where id = 'scol-cfg-fil-qhse'),
  'Paramétrage bulletins choisit la méthode de calcul des UE de LQHSE');
with u as (update public.scolarite_valeurs_defaut set moyenne_passage = 8 returning 1)
select tests.verifier((select count(*) from u) = 0, 'Paramétrage bulletins ne touche pas aux valeurs par défaut de la scolarité');
select tests.connecter(:W);
select tests.verifier((select reglement.moyenne_passage = 10 from public.scolarite_configs reglement where filiere_id = 'fil-qhse'),
  'Awa lit le paramétrage de sa filière (son portail calcule ses résultats)');
with u as (update public.scolarite_configs set moyenne_passage = 5 returning 1)
select tests.verifier((select count(*) from u) = 0, 'Awa ne baisse pas la moyenne de passage');
select tests.connecter(:A);
insert into public.filieres (id, code, nom) values ('fil-tmp', 'TMP', 'Filière d''essai');
insert into public.scolarite_configs (id, filiere_id, note_bareme, cumul_credit, moyenne_passage, moyenne_eliminatoire)
  values ('scol-cfg-fil-tmp', 'fil-tmp', 20, true, 10, 0);
delete from public.filieres where id = 'fil-tmp';
select tests.verifier(not exists (select 1 from public.scolarite_configs where filiere_id = 'fil-tmp'),
  'une filière supprimée emporte son paramétrage');

-- ——— Règlements de calcul et historique ———
select tests.connecter(:S);
insert into public.reglements_calcul (id, nom, annee, filiere_ids, formules, cree_par)
  values ('reg-qhse', 'Règlement LQHSE', '2026-2027', array['fil-qhse'], '{"moyenneUe": "moyenne(notes)"}', 'Ibrahima FALL');
update public.reglements_calcul set formules = '{"moyenneUe": "moyenne_ponderee(notes, credits)"}', modifie_par = 'Ibrahima FALL' where id = 'reg-qhse';
update public.reglements_calcul set modifie_le = now() where id = 'reg-qhse';
update public.reglements_calcul set filiere_ids = array['fil-qhse'] where id = 'reg-qhse';
select tests.verifier((select array_agg(action order by numero) = array['creation', 'modification'] from public.reglements_calcul_versions where reglement_id = 'reg-qhse'),
  'création puis modification des formules : deux versions ; un enregistrement sans changement n''en ajoute pas');
select tests.verifier((select bool_and(par = 'Ibrahima FALL') from public.reglements_calcul_versions where reglement_id = 'reg-qhse'),
  'chaque version porte le nom du compte connecté');
update public.reglements_calcul set formules = '{"moyenneUe": "moyenne(notes)"}', depuis_version = 1 where id = 'reg-qhse';
select tests.verifier((select action = 'retour' and depuis_version = 1 and formules = '{"moyenneUe": "moyenne(notes)"}'
  from public.reglements_calcul_versions where reglement_id = 'reg-qhse' and numero = 3), 'retour à la version 1 : troisième version, notée comme un retour');
select tests.echoue('insert into public.reglements_calcul (nom, annee, filiere_ids) values (''Doublon'', ''2026-2027'', array[''fil-gl'', ''fil-qhse''])',
  'Licence QHSE a déjà le règlement « Règlement LQHSE » pour 2026-2027', 'une filière n''a qu''un règlement par année');
select tests.echoue('insert into public.reglements_calcul (nom, annee, filiere_ids) values (''Fantôme'', ''2026-2027'', array[''fil-inconnue''])',
  'n''existe pas', 'un règlement ne vise que des filières existantes');
select tests.echoue('insert into public.reglements_calcul (nom, annee, filiere_ids, formules) values (''X'', ''2026-2027'', array[''fil-gl''], ''{"bonus": "20"}'')',
  'check constraint', 'une formule d''une étape inconnue est refusée');
select tests.echoue('insert into public.reglements_calcul (nom, annee, filiere_ids) values (''Ancien'', ''2025-2026'', array[''fil-gl''])',
  'clôturée', 'pas de règlement ajouté à une année clôturée');
select tests.echoue('insert into public.reglements_calcul_versions (id, reglement_id, numero, action, nom, annee, filiere_ids, formules, par) values (''v'', ''reg-qhse'', 9, ''creation'', ''x'', ''2026-2027'', ''{}'', ''{}'', ''x'')',
  'permission denied', 'personne n''écrit dans l''historique');
select tests.echoue('delete from public.reglements_calcul_versions', 'permission denied', 'personne n''efface l''historique');
delete from public.reglements_calcul where id = 'reg-qhse';
select tests.verifier((select count(*) = 4 and max(numero) = 4 and bool_or(action = 'suppression') from public.reglements_calcul_versions where reglement_id = 'reg-qhse'),
  'règlement supprimé : son historique reste, avec la suppression en quatrième version');
select tests.connecter(:B);
select tests.echoue('insert into public.reglements_calcul (nom, annee, filiere_ids) values (''Pirate'', ''2026-2027'', array[''fil-gl''])',
  'row-level security', 'Paramétrage bulletins ne crée pas de règlement de calcul');
select tests.connecter(:W);
select tests.verifier(not exists (select 1 from public.reglements_calcul_versions), 'Awa ne lit pas l''historique des règlements');

-- ——— Paramétrage bulletins ———
select tests.connecter(:B);
insert into public.methodes_calcul (id, code, intitule, niveau) values ('meth-moyenneUe-calculMoyenneCredit', 'calculMoyenneCredit', 'Moyenne pondérée par crédit', 'moyenneUe');
insert into public.mentions (id, niveau, valeur_min, valeur_max, mention, appreciation_succes) values ('mention-tb', 'moyenneSession', 16, 20, 'Très Bien', 'Félicitations du jury.');
select tests.echoue('insert into public.mentions (niveau, valeur_min, valeur_max, mention) values (''moyenneSession'', 14, 12, ''Bien'')', 'mentions_tranche_ordonnee',
  'une tranche de mention va du minimum au maximum');
select tests.echoue('insert into public.methodes_calcul (id, code, intitule, niveau) values (''m'', ''calcul'', ''X'', ''moyenneMois'')', 'check constraint',
  'une méthode vise un niveau de moyenne connu');
insert into public.types_evaluation (id, code, intitule) values ('type-eval-EXAMEN', 'EXAMEN', 'Examen');
select tests.echoue('insert into public.types_evaluation (code, intitule) values (''examen'', ''Doublon'')', 'duplicate key',
  'un code de type d''évaluation n''existe qu''une fois');
insert into public.regroupements_devoir (id, code, intitule, role, type_evaluation_ids) values ('regroupement-devoir-ef', '2', 'Examen', 'examen', array['type-eval-EXAMEN']);
insert into public.regles_validation (id, filiere_id, filiere, type, validation_par_credit, validation_par_moyenne, credit_passage, moyenne_passage, moyenne_eliminatoire)
  values ('regle-val-fil-qhse-annee', 'fil-qhse', 'Licence QHSE', 'annee', true, false, 60, 10, 0);
insert into public.declassement_parametres (filiere_id, filiere, annee, niveau, type_evaluation_id, nb_notes_requis)
  values ('fil-qhse', 'Licence QHSE', '2026-2027', 'L1', 'type-eval-EXAMEN', 2);
select tests.echoue('insert into public.declassement_parametres (filiere_id, annee, niveau, type_evaluation_id, nb_notes_requis) values (''fil-qhse'', ''2025-2026'', ''L1'', ''type-eval-EXAMEN'', 2)',
  'clôturée', 'pas de paramètre de déclassement dans une année clôturée');
select tests.connecter(:S);
update public.regles_validation set moyenne_passage = 12, modifie_par = 'Ibrahima FALL' where id = 'regle-val-fil-qhse-annee';
select tests.verifier((select moyenne_passage = 12 from public.regles_validation where id = 'regle-val-fil-qhse-annee'),
  'Paramétrage scolarité reporte sa moyenne de passage sur les règles de validation');
select tests.echoue('insert into public.mentions (niveau, valeur_min, valeur_max, mention) values (''moyenneUe'', 0, 10, ''Ajourné'')', 'row-level security',
  'Paramétrage scolarité ne crée pas de mention');
select tests.connecter(:W);
select tests.verifier((select count(*) = 1 from public.mentions) and (select count(*) = 1 from public.regroupements_devoir),
  'Awa lit les mentions et les regroupements (son bulletin en dépend)');
select tests.echoue('insert into public.mentions (niveau, valeur_min, valeur_max, mention) values (''moyenneUe'', 0, 20, ''Excellent'')', 'row-level security',
  'Awa ne crée pas de mention');
select tests.deconnecter();
select tests.verifier((select count(*) >= 10 from public.journal_audit where cible_type in ('scolarite_valeurs_defaut', 'scolarite_configs', 'reglements_calcul',
  'methodes_calcul', 'mentions', 'regles_validation', 'types_evaluation', 'regroupements_devoir', 'declassement_parametres')),
  'chaque changement du paramétrage est journalisé');
select tests.verifier((select acteur = :S::uuid from public.journal_audit where cible_type = 'regles_validation' and action = 'update_regles_validation'),
  'le report sur la règle de validation est journalisé au nom d''Ibrahima FALL');
select tests.anonyme();
select tests.echoue('select * from public.mentions', 'permission denied', 'un visiteur ne lit pas les mentions');
select tests.deconnecter();

rollback;
