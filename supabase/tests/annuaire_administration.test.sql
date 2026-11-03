-- Tests du complément de la partie 8, lot 1 : l'annuaire détaillé de l'administration.
-- Comptes d'essai : l'administration (A), la scolarité (S, avec un rôle), Mamadou KANE (K, cours en
-- L1) et Awa SECK (W, en L1). Tout se passe dans une transaction annulée.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-8000-000000000091'''
\set S '''00000000-0000-4000-8000-000000000092'''
\set K '''00000000-0000-4000-8000-00000000000c'''
\set W '''00000000-0000-4000-8000-00000000000e'''
begin;

insert into auth.users (id, email) values
  (:A, 'admin.a@comptes.edumanage.invalid'), (:S, 'scolarite.s@comptes.edumanage.invalid'),
  (:K, 'kane.k@comptes.edumanage.invalid'), (:W, 'awa.w@comptes.edumanage.invalid');
insert into public.roles (id, code, pages) values ('role-com', 'ROLE_COM', array['com-envoi']);
insert into public.annees_academiques (id, libelle, date_debut, date_fin, actuelle) values ('annee-2026', '2026-2027', '2026-09-01', '2027-08-31', true);
insert into public.filieres (id, code, nom) values ('fil-qhse', 'LQHSE', 'Licence QHSE');
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-l1', 'Licence 1', 'L1', 'fil-qhse');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee) values ('cl-l1', 'LQHSE1-26/27', 'fil-qhse', 'niv-l1', 'L1', 40, '2026-2027');
insert into public.ues (id, code, libelle, credits, filiere_id, niveau, semestre) values ('ue-l1', 'UE11', 'Fondamentaux QHSE', 6, 'fil-qhse', 'L1', 'S1');
insert into public.ecs (id, code, libelle, ue_id, credits, vht) values ('ec-qualite', 'QHSE111', 'Qualité', 'ue-l1', 3, 30);
insert into public.enseignants (id, prenom, nom, matricule, grade) values ('en-kane', 'Mamadou', 'KANE', 'ENS-2026-100', 'Vacataire');
insert into public.seances (id, ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, prof_id, annee) values
  ('se-kane-1', 'ec-qualite', 'cl-l1', 1, '2026-11-02', '08:00', '10:00', 'en-kane', '2026-2027');
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, classe_id, niveau, statut, annee) values
  ('et-awa', '2026-LQHSE-0001', 'Awa', 'SECK', 'fil-qhse', 'cl-l1', 'L1', 'inscrit', '2026-2027');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, email, telephone, fonction, lien_id, role_id, doit_changer_mot_de_passe) values
  (:A, 'administration', 'ADMIN-1', 'Direction des études', 'direction@ucao.invalid', '+221 33 000 00 01', 'Directeur', null, null, false),
  (:S, 'administration', 'SCOL-1', 'Scolarité', 'scolarite@ucao.invalid', '+221 33 000 00 02', 'Secrétariat', null, 'role-com', true),
  (:K, 'enseignant', 'KANE', 'Mamadou KANE', 'kane@ucao.invalid', '+221 77 000 00 03', '', 'en-kane', null, false),
  (:W, 'etudiant', '2026-LQHSE-0001', 'Awa SECK', 'awa@ucao.invalid', '+221 77 000 00 04', '', 'et-awa', null, true);

select tests.connecter(:A);
select tests.verifier((select identifiant = 'KANE' and telephone = '+221 77 000 00 03' from public.annuaire() where id = :K)
    and (select role_id = 'role-com' and doit_changer_mot_de_passe from public.annuaire() where id = :S),
  'l''administration lit l''identifiant, le téléphone, le rôle et l''état du mot de passe de chaque compte');
select tests.connecter(:W);
select tests.verifier((select identifiant = '2026-LQHSE-0001' and telephone = '+221 77 000 00 04' and doit_changer_mot_de_passe from public.annuaire() where id = :W),
  'Awa lit ses propres détails');
select tests.verifier((select bool_and(identifiant = '' and telephone = '' and email = '' and role_id is null and not doit_changer_mot_de_passe and mot_de_passe_change_le is null)
    from public.annuaire() where id in (:A, :S, :K)),
  'mais ni l''identifiant, ni le rôle, ni les coordonnées des autres comptes');
select tests.verifier((select count(*) = 4 from public.annuaire() where id in (:A, :S, :K, :W)), 'son annuaire compte l''administration, KANE et elle-même');
select tests.connecter(:K);
select tests.verifier((select identifiant = '' and fonction = '' from public.annuaire() where id = :W) and (select fonction = 'Secrétariat' from public.annuaire() where id = :S),
  'KANE nomme Awa sans lire son matricule de connexion ; il lit la fonction de l''administration');

rollback;
