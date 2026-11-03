-- Tests de la partie 8, lot 2 : demandes des étudiants.
-- Comptes d'essai : le secrétariat (D, page « Demandes »), un validateur des rallonges (R, page
-- « Demandes »), la caisse (F, sans la page), Mamadou KANE (K) et les étudiants Awa SECK (W) et
-- Ousmane DIALLO (O). Tout se passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set D '''00000000-0000-4000-8000-0000000000a1'''
\set R '''00000000-0000-4000-8000-0000000000a2'''
\set F '''00000000-0000-4000-8000-0000000000a3'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set W '''00000000-0000-4000-8000-00000000000e'''
\set O '''00000000-0000-4000-8000-00000000000f'''
begin;

insert into auth.users (id, email) values
  (:D, 'demandes.d@comptes.edumanage.invalid'), (:R, 'rallonges.r@comptes.edumanage.invalid'), (:F, 'caisse.f@comptes.edumanage.invalid'),
  (:K, 'kane.k@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid'), (:O, 'ousmane.o@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values
  ('role-demandes', 'ROLE_DEMANDES', array['com-demandes']), ('role-caisse', 'ROLE_CAISSE', array['fin-quittance-nouvelle']);
insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest');
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse');
insert into public.semestres (id, nom, alias, niveau, niveau_id) values ('sem-s1', 'Semestre 1', 'S1', 'L1', 'niv-l1');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027');
insert into public.ues (id, code, libelle, credits, filiere_id, niveau, semestre) values ('ue-l1', 'UE11', 'Fondamentaux QHSE', 6, 'fil-qhse', 'L1', 'S1');
insert into public.ecs (id, code, libelle, ue_id, credits, vht) values ('ec-qualite', 'QHSE111', 'Qualité', 'ue-l1', 3, 30);
insert into public.salles (id, nom) values ('salle-a1', 'RDC 1A');
insert into public.enseignants (id, prenom, nom, matricule, grade) values ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire');
insert into public.seances (id, ec, ec_id, classe, classe_id, jour, semaine_du, heure_debut, heure_fin, salle, salle_id, prof, prof_id, type, annee) values
  ('se-kane', 'Qualité', 'ec-qualite', 'LQHSE1-26/27', 'cl-l1', 1, date_trunc('week', current_date)::date - 7, '08:00', '10:00', 'RDC 1A', 'salle-a1', 'Mamadou KANE', 'en-kane', 'CM', '2026-2027');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027'),
  ('et-ousmane', '2026-LQHSE-0002', 'Ousmane', 'DIALLO', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, lien_id, role_id, doit_changer_mot_de_passe) values
  (:D, 'administration', 'DEMANDES-1', 'Secrétariat', null, 'role-demandes', false),
  (:R, 'administration', 'RALLONGES-1', 'Direction financière', null, 'role-demandes', false),
  (:F, 'administration', 'CAISSE-1', 'Caisse', null, 'role-caisse', false),
  (:K, 'enseignant', 'KANE', 'Mamadou KANE', 'en-kane', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'et-awa', null, false),
  (:O, 'etudiant', '2026-LQHSE-0002', 'Ousmane DIALLO', 'et-ousmane', null, false);
insert into public.roles_communication (role, compte_id, compte_libelle) values ('validateur_rallonge', :R, 'Direction financière');

-- KANE fait l'appel : Awa absente, Ousmane présent ; une note publiée pour chacun.
select tests.connecter(:K);
insert into public.cahiers (id, seance_id, annee, ec, ec_id, classe_id, classe, prof, prof_id, salle, salle_id, date, heure_debut, heure_fin, type_seance,
  sujet, resume, etat_seance, statut) values
  ('cah-kane', 'se-kane', '2026-2027', 'Qualité', 'ec-qualite', 'cl-l1', 'LQHSE1-26/27', 'Mamadou KANE', 'en-kane', 'RDC 1A', 'salle-a1',
   date_trunc('week', current_date)::date - 7, '08:00', '10:00', 'CM', 'Norme ISO 9001', 'Principes', 'realisee', 'brouillon');
insert into public.presences (id, cahier_id, etudiant_id, nom, statut, ordre) values
  ('cah-kane:et-awa', 'cah-kane', 'et-awa', 'Awa SECK', 'absent', 1), ('cah-kane:et-ousmane', 'cah-kane', 'et-ousmane', 'Ousmane DIALLO', 'present', 2);
select tests.deconnecter();
insert into public.evaluations (id, code, filiere_id, filiere, annee, niveau_id, niveau, classe_id, classe, semestre_id, semestre, ec_id, cours,
  professeur_id, professeur, type, poids) values
  ('ev-devoir', '100000001', 'fil-qhse', 'LQHSE', '2026-2027', 'niv-l1', 'L1', 'cl-l1', 'LQHSE1-26/27', 'sem-s1', 'S1', 'ec-qualite', 'QHSE111 — Qualité',
   'en-kane', 'Mamadou KANE', 'devoir', 40);
insert into public.notes (id, etudiant, etudiant_id, matricule, ec, ec_id, type, note, absent, statut, classe_id, annee, evaluation_id) values
  ('no-awa', 'Awa SECK', 'et-awa', '2026-LQHSE-0001', 'Qualité', 'ec-qualite', 'CC', 8, false, 'publie', 'cl-l1', '2026-2027', 'ev-devoir'),
  ('no-ousmane', 'Ousmane DIALLO', 'et-ousmane', '2026-LQHSE-0002', 'Qualité', 'ec-qualite', 'CC', 11, false, 'publie', 'cl-l1', '2026-2027', 'ev-devoir');

create function pg_temp.notifie(p_compte uuid, p_message text) returns bigint language sql as $$
  select count(*) from public.notifications n where n.destinataire = p_compte and n.message = p_message
$$;
create temp table diffusions_essai (canal text, tab text);
create or replace function private.envoyer_diffusion(p_canal text, p_table text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  insert into pg_temp.diffusions_essai values (p_canal, p_table);
end;
$$;

-- ——— Dépôt par l'étudiant ———
select tests.connecter(:W);
insert into public.demandes_etudiants (id, etudiant_id, type, objet, message, statut, absence_cahier_id, absence_libelle, piece_nom, piece_type, piece_chemin, traite_par)
  values ('req-just', 'et-awa', 'justificatif_absence', 'Absence du lundi', 'J''étais malade.', 'valide', 'cah-kane', 'Absence — Qualité',
    'certificat.pdf', 'application/pdf', 'et-awa/req-just/certificat.pdf', :D);
select tests.verifier((select statut = 'nouveau' and traite_par is null and cree_le > now() - interval '1 minute' from public.demandes_etudiants where id = 'req-just'),
  'une demande part « nouvelle », datée par la base, sans traitement');
select tests.echoue('insert into public.demandes_etudiants (id, etudiant_id, type, objet, message, absence_cahier_id) values (''req-x'', ''et-awa'', ''justificatif_absence'', ''Encore'', ''Malade'', ''cah-kane'')',
  'demandes_absence_en_cours', 'une seule demande en cours par absence');
select tests.echoue('insert into public.demandes_etudiants (id, etudiant_id, type, objet, message) values (''req-x'', ''et-awa'', ''justificatif_absence'', ''Absence'', ''Malade'')',
  'vos absences', 'un justificatif vise une absence');
select tests.echoue('insert into public.demandes_etudiants (id, etudiant_id, type, objet, message, note_id) values (''req-x'', ''et-awa'', ''reclamation_note'', ''Note'', ''Erreur'', ''no-ousmane'')',
  'vos notes publiées', 'une réclamation vise une note publiée de l''étudiant lui-même');
select tests.echoue('insert into public.demandes_etudiants (id, etudiant_id, type, objet, message) values (''req-x'', ''et-ousmane'', ''autre'', ''Au nom d''''Ousmane'', ''Texte'')',
  'row-level security', 'personne ne dépose une demande au nom d''un autre');
select tests.echoue('insert into public.demandes_etudiants (id, etudiant_id, type, objet, message, piece_chemin) values (''req-x'', ''et-awa'', ''autre'', ''Pièce'', ''Texte'', ''et-ousmane/req-x/a.pdf'')',
  'demandes_piece_rangee', 'une pièce jointe est rangée avec sa demande');
select tests.echoue('insert into public.demandes_etudiants (id, etudiant_id, type, objet, message) values (''req-x'', ''et-awa'', ''demande_rallonge'', ''Rallonge'', ''Délai'')',
  'demandes_rallonge_complete', 'une rallonge précise sa portée et sa date de fin');
insert into public.demandes_etudiants (id, etudiant_id, type, objet, message, note_id, note_libelle) values ('req-note', 'et-awa', 'reclamation_note', 'Note de qualité', 'Erreur de report', 'no-awa', 'Qualité — CC');
insert into public.demandes_etudiants (id, etudiant_id, type, objet, message, portee_rallonge, date_fin_souhaitee)
  values ('req-rallonge', 'et-awa', 'demande_rallonge', 'Rallonge de paiement', 'Bourse en retard', 'reinscription', '2026-12-31');
insert into public.demandes_etudiants (id, etudiant_id, type, objet, message, attestation_type) values ('req-att', 'et-awa', 'attestation', 'Attestation de scolarité', 'Pour la bourse', 'scolarite');
insert into public.demandes_etudiants (id, etudiant_id, type, objet, message) values ('req-autre', 'et-awa', 'autre', 'Changement d''adresse', 'Nouvelle adresse');
select tests.verifier((select count(*) = 5 from public.demandes_etudiants), 'Awa lit ses demandes');
select tests.connecter(:O);
select tests.verifier(not exists (select 1 from public.demandes_etudiants), 'Ousmane ne lit pas celles d''Awa');
select tests.connecter(:K);
select tests.verifier(not exists (select 1 from public.demandes_etudiants), 'un professeur non plus');
select tests.deconnecter();
select tests.verifier(pg_temp.notifie(:D, 'Nouvelle demande étudiant: Absence du lundi') = 1 and pg_temp.notifie(:R, 'Nouvelle demande étudiant: Absence du lundi') = 1
    and pg_temp.notifie(:F, 'Nouvelle demande étudiant: Absence du lundi') = 0,
  'la base prévient les comptes qui ont la page « Demandes », pas la caisse');
select tests.verifier(exists (select 1 from pg_temp.diffusions_essai where canal = 'administration' and tab = 'demandes_etudiants')
    and exists (select 1 from pg_temp.diffusions_essai where canal = 'compte:' || :W and tab = 'demandes_etudiants'),
  'en direct : le secrétariat (centre « À traiter ») et Awa sont prévenus');

-- ——— Annulation par l'étudiante ———
select tests.connecter(:W);
update public.demandes_etudiants set statut = 'annule' where id = 'req-autre';
select tests.verifier((select statut = 'annule' from public.demandes_etudiants where id = 'req-autre'), 'Awa annule une demande pas encore prise en charge');
select tests.echoue('update public.demandes_etudiants set statut = ''valide'' where id = ''req-note''', 'seul le secrétariat', 'elle ne la traite pas elle-même');
select tests.echoue('update public.demandes_etudiants set message = ''Autre texte'' where id = ''req-note''', 'ne se modifie plus', 'une demande envoyée ne se modifie plus');
select tests.echoue('delete from public.demandes_etudiants where id = ''req-note''', 'permission denied', 'une demande ne se supprime pas');

-- ——— Traitement par le secrétariat ———
select tests.connecter(:F);
select tests.verifier(tests.lignes('update public.demandes_etudiants set statut = ''en_cours'' where id = ''req-note''') = 0, 'sans la page « Demandes », la caisse ne traite rien');
select tests.connecter(:D);
select tests.echoue('update public.demandes_etudiants set statut = ''en_cours'' where id = ''req-autre''', 'annulée par l''étudiant', 'une demande annulée ne se traite plus');
update public.demandes_etudiants set statut = 'en_cours', resolution = '  ' where id = 'req-note';
select tests.verifier((select statut = 'en_cours' and traite_par = :D and resolution is null from public.demandes_etudiants where id = 'req-note'),
  'le secrétariat prend une demande en charge ; la base note qui');
select tests.connecter(:W);
select tests.echoue('update public.demandes_etudiants set statut = ''annule'' where id = ''req-note''', 'seul le secrétariat', 'prise en charge, elle ne s''annule plus');
select tests.connecter(:D);
update public.demandes_etudiants set statut = 'valide', resolution = 'Note corrigée' where id = 'req-note';
update public.demandes_etudiants set statut = 'rejete', resolution = 'Certificat illisible' where id = 'req-just';
select tests.echoue('update public.demandes_etudiants set statut = ''en_cours'' where id = ''req-note''', 'déjà traitée', 'une demande traitée ne change plus');
select tests.echoue('update public.demandes_etudiants set statut = ''annule'' where id = ''req-rallonge''', 'seul l''étudiant', 'le secrétariat n''annule pas à la place de l''étudiant');
select tests.echoue('update public.demandes_etudiants set statut = ''valide'' where id = ''req-rallonge''', 'validateur désigné', 'seul un validateur désigné accepte une rallonge');
select tests.connecter(:R);
update public.demandes_etudiants set statut = 'valide' where id = 'req-rallonge';
select tests.verifier((select statut = 'valide' and traite_par = :R from public.demandes_etudiants where id = 'req-rallonge'), 'le validateur désigné accepte la rallonge');
select tests.deconnecter();
select tests.verifier(pg_temp.notifie(:W, 'Votre demande « Note de qualité » est en cours de traitement.') = 1
    and pg_temp.notifie(:W, 'Votre demande « Note de qualité » a été acceptée : Note corrigée') = 1
    and pg_temp.notifie(:W, 'Votre demande « Absence du lundi » a été refusée : Certificat illisible') = 1
    and pg_temp.notifie(:W, 'Votre demande « Rallonge de paiement » a été acceptée.') = 1
    and not exists (select 1 from public.notifications where destinataire = :W and message like '%Changement d''adresse%'),
  'la base prévient Awa de chaque étape (pas de son annulation à elle)');
select tests.connecter(:W);
insert into public.demandes_etudiants (id, etudiant_id, type, objet, message, absence_cahier_id) values ('req-just-2', 'et-awa', 'justificatif_absence', 'Absence du lundi', 'Nouveau certificat', 'cah-kane');
select tests.verifier((select count(*) = 1 from public.demandes_etudiants where id = 'req-just-2'), 'refusé, le justificatif peut être déposé de nouveau');

-- ——— Attestation délivrée pour la demande ———
select tests.connecter(:D);
select set_config('essai.numero', public.attribuer_numero_attestation(), false);
insert into public.attestations (id, numero, etudiant_id, etudiant, matricule, classe_id, classe, filiere_id, annee, type, type_label, solde_du_constate, statut, effectue_par)
  values ('att-awa', current_setting('essai.numero'), 'et-awa', 'Awa SECK', '2026-LQHSE-0001', 'cl-l1', 'LQHSE1-26/27', 'fil-qhse', '2026-2027', 'scolarite',
          'Certificat de scolarité', 0, 'genere', 'Secrétariat');
select set_config('essai.numero_ousmane', public.attribuer_numero_attestation(), false);
insert into public.attestations (id, numero, etudiant_id, etudiant, matricule, classe_id, classe, filiere_id, annee, type, type_label, solde_du_constate, statut, effectue_par)
  values ('att-ousmane', current_setting('essai.numero_ousmane'), 'et-ousmane', 'Ousmane DIALLO', '2026-LQHSE-0002', 'cl-l1', 'LQHSE1-26/27', 'fil-qhse', '2026-2027', 'scolarite',
          'Certificat de scolarité', 0, 'genere', 'Secrétariat');
select tests.echoue('update public.demandes_etudiants set attestation_id = ''att-ousmane'' where id = ''req-att''', 'pas celle de l''étudiant', 'on ne rattache pas l''attestation d''un autre étudiant');
update public.demandes_etudiants set attestation_id = 'att-awa', attestation_numero = 'ATT-FAUX', statut = 'valide' where id = 'req-att';
select tests.verifier((select attestation_numero = current_setting('essai.numero') and statut = 'valide' from public.demandes_etudiants where id = 'req-att'),
  'l''attestation délivrée est rattachée, avec son vrai numéro');

-- ——— Pièces jointes ———
select tests.connecter(:W);
insert into storage.objects (bucket_id, name, owner_id) values ('demandes', 'et-awa/req-piece/certificat.pdf', :W);
select tests.echoue(format('insert into storage.objects (bucket_id, name, owner_id) values (''demandes'', ''et-ousmane/req-x/faux.pdf'', %L)', :W),
  'row-level security', 'Awa ne dépose rien dans le dossier d''Ousmane');
insert into public.demandes_etudiants (id, etudiant_id, type, objet, message, piece_nom, piece_type, piece_chemin)
  values ('req-piece', 'et-awa', 'autre', 'Bourse', 'Voir pièce', 'certificat.pdf', 'application/pdf', 'et-awa/req-piece/certificat.pdf');
select tests.verifier((select count(*) = 1 from storage.objects where bucket_id = 'demandes'), 'Awa relit sa pièce');
select tests.verifier(tests.lignes('delete from storage.objects where bucket_id = ''demandes''') = 0, 'elle ne retire pas une pièce que sa demande désigne');
select tests.connecter(:O);
select tests.verifier(not exists (select 1 from storage.objects where bucket_id = 'demandes'), 'Ousmane ne lit pas la pièce d''Awa');
select tests.connecter(:F);
select tests.verifier(not exists (select 1 from storage.objects where bucket_id = 'demandes'), 'ni la caisse');
select tests.connecter(:D);
select tests.verifier((select count(*) = 1 from storage.objects where bucket_id = 'demandes'), 'le secrétariat la lit');
select tests.connecter(:W);
insert into storage.objects (bucket_id, name, owner_id) values ('demandes', 'et-awa/req-perdue/brouillon.pdf', :W);
select tests.verifier(tests.lignes('delete from storage.objects where bucket_id = ''demandes'' and name = ''et-awa/req-perdue/brouillon.pdf''') = 1,
  'une pièce qu''aucune demande ne désigne (envoi refusé) se retire');

rollback;
