-- Paramétrage de l'emploi du temps, des finances, de la communication et des signatures (partie 3
-- du plan de migration, lot 4), et listes de départ posées à l'installation.
--
-- L'identité de l'établissement a sa table depuis la partie 1. L'adresse de la passerelle de
-- communication reste dans le navigateur (aucune clé d'API dans la base). Le logo et l'image des
-- signatures rejoindront le stockage de fichiers avec les photos (partie 4).

-- ——— 1. Emploi du temps (Paramétrage de l'emploi du temps) ————————————————————————————————————

create table public.types_seance (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null check (length(trim(intitule)) > 0),
  categorie text not null check (categorie in ('emploi_du_temps', 'evenement')),
  couleur text not null default '#4f46e5',
  trajet boolean not null default false,
  necessite_surveillant boolean not null default false
);
comment on table public.types_seance is 'Types de séance de l''emploi du temps (cours, TD, examen…).';

create table public.jours_feries (
  id text primary key default gen_random_uuid()::text,
  intitule text not null check (length(trim(intitule)) > 0),
  date_debut date not null,
  date_fin date not null,
  constraint jours_feries_dates_ordonnees check (date_debut <= date_fin)
);
comment on table public.jours_feries is 'Jours fériés et périodes de fermeture (information des portails).';

-- ——— 2. Finances (Paramétrage finances, grille tarifaire) ——————————————————————————————————————

create table public.types_frais (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null check (length(trim(intitule)) > 0),
  remarques text
);
comment on table public.types_frais is 'Types de frais (frais généraux, APE, BDE…).';

create table public.modes_paiement (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null check (length(trim(intitule)) > 0)
);
comment on table public.modes_paiement is 'Modes de paiement (espèces, chèque, virement, Wave, Orange Money…).';

create table public.types_facture (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null check (length(trim(intitule)) > 0),
  facture_pedagogique boolean not null default false
);
comment on table public.types_facture is 'Types de facture.';

create table public.modeles_frais (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null check (length(trim(intitule)) > 0)
);
comment on table public.modeles_frais is 'Modèles de frais (nouveau, ancien, privé, État…) : une grille tarifaire par modèle.';

create table public.articles_service (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null check (length(trim(intitule)) > 0),
  prix_unitaire numeric not null check (prix_unitaire >= 0)
);
comment on table public.articles_service is 'Articles vendus par l''établissement (prix unitaire).';

create table public.banques (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null check (length(trim(intitule)) > 0),
  numero_compte text not null default ''
);
comment on table public.banques is 'Banques et comptes de l''établissement.';

create table public.activites_service (
  id text primary key default gen_random_uuid()::text,
  code text not null check (length(trim(code)) > 0),
  intitule text not null check (length(trim(intitule)) > 0),
  montant numeric not null check (montant >= 0)
);
comment on table public.activites_service is 'Activités payantes proposées aux étudiants.';

-- Grille tarifaire : les lignes de frais (montant, modalité, échéances) d'une filière, d'un niveau,
-- d'une année et d'un modèle de frais.
create table public.grilles_frais (
  id text primary key,
  filiere_id text not null references public.filieres (id) on delete cascade,
  niveau text not null,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  modele_frais_id text not null references public.modeles_frais (id) on delete restrict,
  lignes jsonb not null default '[]' check (jsonb_typeof(lignes) = 'array'),
  unique (filiere_id, niveau, annee, modele_frais_id)
);
comment on table public.grilles_frais is 'Grille tarifaire : frais d''une filière, d''un niveau et d''une année pour un modèle de frais.';
create index grilles_frais_annee_idx on public.grilles_frais (annee);
create index grilles_frais_modele_frais_id_idx on public.grilles_frais (modele_frais_id);

create trigger grilles_frais_annee_cloturee before insert or update or delete on public.grilles_frais
  for each row execute function private.refuser_annee_cloturee();

-- ——— 3. Communication (Paramétrage de la communication) ————————————————————————————————————

-- Groupes de destinataires : contacts extérieurs, groupes tirés de la structure (programme,
-- niveau, classe d'une année), groupes définis par des règles.
create table public.groupes_externes (
  id text primary key default gen_random_uuid()::text,
  nom text not null check (length(trim(nom)) > 0),
  code text not null default '',
  contacts jsonb not null default '[]' check (jsonb_typeof(contacts) = 'array')
);
comment on table public.groupes_externes is 'Groupes de contacts extérieurs (téléphone, email).';

create table public.groupes_internes (
  id text primary key default gen_random_uuid()::text,
  nom text not null check (length(trim(nom)) > 0),
  type text not null check (type in ('programme', 'niveau', 'classe')),
  ref_id text not null,
  niveau_alias text,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict
);
comment on table public.groupes_internes is 'Groupes de destinataires d''une année : un programme, un niveau ou une classe.';
create index groupes_internes_annee_idx on public.groupes_internes (annee);

create table public.groupes_personnalises (
  id text primary key default gen_random_uuid()::text,
  nom text not null check (length(trim(nom)) > 0),
  description text not null default '',
  regles jsonb not null default '[]' check (jsonb_typeof(regles) = 'array')
);
comment on table public.groupes_personnalises is 'Groupes de destinataires définis par des règles (filière, niveau, solde…).';

-- Comptes désignés : validateurs des messages, validateurs des demandes de rallonge, destinataires
-- des alertes. Un compte n'est désigné qu'une fois pour un même rôle (et une même alerte).
create table public.roles_communication (
  id text primary key default gen_random_uuid()::text,
  role text not null check (role in ('validateur_message', 'validateur_rallonge', 'destinataire_alert')),
  compte_id uuid not null references public.comptes (id) on delete cascade,
  compte_libelle text not null default '',
  remarque text,
  action text
);
comment on table public.roles_communication is 'Comptes désignés comme validateurs ou destinataires d''alertes.';
create unique index roles_communication_unique on public.roles_communication (role, compte_id, coalesce(action, ''));
create index roles_communication_compte_id_idx on public.roles_communication (compte_id);

-- Notifications envoyées automatiquement après un événement (absence, blocage, encaissement…).
create table public.notifications_evenementielles (
  id text primary key default gen_random_uuid()::text,
  code text not null unique check (length(trim(code)) > 0),
  description text not null default '',
  actif boolean not null default true,
  envoyer_etudiant boolean not null default false,
  envoyer_professeur boolean not null default false,
  envoyer_parent boolean not null default false,
  envoyer_tuteur boolean not null default false,
  branche_reellement boolean not null default false
);
comment on table public.notifications_evenementielles is 'Notifications automatiques après un événement, et leurs destinataires.';

-- ——— 4. Signatures des documents (Paramètres généraux) ——————————————————————————————————————

create table public.signatures_documents (
  id text primary key check (id in ('bulletin', 'inscription', 'reussite', 'scolarite')),
  actif boolean not null default false,
  signataire_nom text not null default '',
  signataire_qualite text not null default ''
);
comment on table public.signatures_documents is 'Signataire de chaque type de document officiel (bulletin, attestations, certificat).';

-- ——— 5. Journal ————————————————————————————————————————————————————————————————————————————

do $$
declare
  v_table text;
begin
  foreach v_table in array array['types_seance', 'jours_feries', 'types_frais', 'modes_paiement',
    'types_facture', 'modeles_frais', 'articles_service', 'banques', 'activites_service',
    'grilles_frais', 'groupes_externes', 'groupes_internes', 'groupes_personnalises',
    'roles_communication', 'notifications_evenementielles', 'signatures_documents']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.journaliser_modification()',
      v_table || '_journal', v_table);
  end loop;
end
$$;

-- ——— 6. Droits et règles d'accès ——————————————————————————————————————————————————————————

do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('types_seance', array['edt-param'], 'tous'),
      ('jours_feries', array['edt-param'], 'tous'),
      ('types_frais', array['fin-param'], 'tous'),
      ('modes_paiement', array['fin-param'], 'tous'),
      ('types_facture', array['fin-param'], 'tous'),
      ('modeles_frais', array['fin-param'], 'tous'),
      ('articles_service', array['fin-param'], 'tous'),
      ('banques', array['fin-param'], 'tous'),
      ('activites_service', array['fin-param'], 'tous'),
      ('grilles_frais', array['fin-grille-frais'], 'tous'),
      -- Les groupes contiennent des contacts (téléphones, emails) : lus par l'administration seule.
      ('groupes_externes', array['com-param'], 'administration'),
      ('groupes_internes', array['com-param'], 'administration'),
      ('groupes_personnalises', array['com-param'], 'administration'),
      ('roles_communication', array['com-param'], 'tous'),
      ('notifications_evenementielles', array['com-param'], 'tous'),
      ('signatures_documents', array['sec-settings'], 'tous')
    ) as t(nom, pages, lecteurs)
  loop
    execute format('alter table public.%I enable row level security', v.nom);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', v.nom);
    execute format(
      'create policy %I on public.%I for select to authenticated using (%s)',
      v.nom || '_lecture', v.nom,
      case v.lecteurs
        when 'tous' then '(select private.type_compte_courant()) is not null'
        else '(select private.est_administration())'
      end);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.a_acces_une_page(%L)))',
      v.nom || '_creation', v.nom, v.pages);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.a_acces_une_page(%L))) with check ((select private.a_acces_une_page(%L)))',
      v.nom || '_modification', v.nom, v.pages, v.pages);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.a_acces_une_page(%L)))',
      v.nom || '_suppression', v.nom, v.pages);
  end loop;
end
$$;

-- ——— 7. Listes de départ ———————————————————————————————————————————————————————————————————
-- Les listes que d'autres données désignent par leur identifiant (cycle d'une filière, type
-- d'évaluation, modèle d'une grille, mode d'un paiement…) sont posées dans la base à
-- l'installation, avec les identifiants de l'application. Chacune se modifie ou se supprime
-- ensuite comme les autres ; une valeur déjà présente n'est jamais écrasée.

create function private.poser_valeurs_depart()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.cycles (id, code, intitule, ordre) values
    ('cy-seed-1', 'BTS', 'BTS', 0), ('cy-seed-2', 'LICENCE', 'Licence', 1),
    ('cy-seed-3', 'MASTER', 'Master', 2), ('cy-seed-4', 'DOCTORAT', 'Doctorat', 3)
  on conflict do nothing;
  insert into public.categories_cours (id, code, intitule) values
    ('cc-seed-1', 'OBLIGATOIRE', 'Obligatoire'), ('cc-seed-2', 'LIBRE', 'Libre'),
    ('cc-seed-3', 'FONDAMENTALE', 'Fondamentale'), ('cc-seed-4', 'SPECIALITE', 'Spécialité'),
    ('cc-seed-5', 'TRANSVERSALE', 'Transversale'), ('cc-seed-6', 'OPTIONNELLE', 'Optionnelle')
  on conflict do nothing;
  insert into public.types_evaluation (id, code, intitule) values
    ('type-eval-COMPOSITION', 'COMPOSITION', 'Composition'),
    ('type-eval-CONTROLE_CONTINU', 'CONTROLE_CONTINU', 'Contrôle continu'),
    ('type-eval-DEVOIR', 'DEVOIR', 'Devoir'), ('type-eval-EXAMEN', 'EXAMEN', 'Examen'),
    ('type-eval-PARTIEL', 'PARTIEL', 'Partiel')
  on conflict do nothing;
  insert into public.regroupements_devoir (id, code, intitule, role, type_evaluation_ids) values
    ('regroupement-devoir-cc', '1', 'Devoir', 'devoir', array['type-eval-CONTROLE_CONTINU', 'type-eval-DEVOIR', 'type-eval-PARTIEL']),
    ('regroupement-devoir-ef', '2', 'Examen', 'examen', array['type-eval-COMPOSITION', 'type-eval-EXAMEN'])
  on conflict do nothing;
  insert into public.types_seance (id, code, intitule, categorie, couleur, trajet, necessite_surveillant) values
    ('ts-seed-1', 'CM', 'Cours magistral', 'emploi_du_temps', '#4f46e5', false, false),
    ('ts-seed-2', 'TD', 'Travaux dirigés', 'emploi_du_temps', '#10b981', false, false),
    ('ts-seed-3', 'TP', 'Travaux pratiques', 'emploi_du_temps', '#8b5cf6', false, false),
    ('ts-seed-4', 'EX', 'Examen', 'evenement', '#ef4444', false, true)
  on conflict do nothing;
  insert into public.types_frais (id, code, intitule) values
    ('tf-seed-1', 'APE', 'Association des Parents d''Étudiants (APE)'), ('tf-seed-2', 'AVU', 'Avance uniforme'),
    ('tf-seed-3', 'BDE', 'Bureau des étudiants (BDE)'), ('tf-seed-4', 'FG', 'Frais généraux'),
    ('tf-seed-5', 'REP', 'Reprise ancien système')
  on conflict do nothing;
  insert into public.modes_paiement (id, code, intitule) values
    ('mp-seed-1', 'AVR', 'AVOIR'), ('mp-seed-2', 'CHQ', 'Chèque'), ('mp-seed-3', 'ESP', 'Espèce'),
    ('mp-seed-4', 'VIR', 'Virement'), ('mp-seed-5', 'WAVE', 'Wave'), ('mp-seed-6', 'OM', 'Orange Money')
  on conflict do nothing;
  insert into public.modeles_frais (id, code, intitule) values
    ('mf-seed-1', 'AN', 'Ancien'), ('mf-seed-2', 'ep', 'Privé'), ('mf-seed-3', 'etat', 'État'),
    ('mf-seed-4', 'NV', 'Nouveau')
  on conflict do nothing;
end;
$$;
revoke execute on function private.poser_valeurs_depart() from public, anon, authenticated;

create function private.etablissement_installe()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.poser_valeurs_depart();
  return null;
end;
$$;
revoke execute on function private.etablissement_installe() from public, anon, authenticated;

create trigger etablissement_valeurs_depart after insert on public.etablissement
  for each row execute function private.etablissement_installe();

-- Établissement déjà installé : ses listes de départ sont posées maintenant.
do $$
begin
  if exists (select 1 from public.etablissement) then
    perform private.poser_valeurs_depart();
  end if;
end
$$;
