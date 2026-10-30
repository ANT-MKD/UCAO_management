-- Fondations d'EduManage (partie 1 du plan de migration).
--
-- Ce qui sert à toutes les autres parties : l'établissement, les années académiques, les rôles
-- d'administration, les comptes des trois portails (reliés aux identités Supabase), le journal
-- d'audit, les notifications et les compteurs de numérotation ; plus les fonctions qui disent
-- « qui est connecté, avec quel type de compte et quelles pages », utilisées par les règles d'accès.
--
-- Principes appliqués partout :
--   - rien n'est ouvert par défaut : chaque table reçoit ses droits explicitement, avec ses
--     règles d'accès (RLS) dans la même migration ;
--   - les données qui décident des droits (type de compte, rôle, rattachement, compte actif) ne
--     sont jamais modifiables par l'utilisateur lui-même ;
--   - les fonctions qui contournent les règles d'accès vivent dans le schéma « private », non
--     exposé par l'API, et vérifient toujours qui les appelle.

-- ——— 0. Rien n'est ouvert par défaut ———————————————————————————————————————————————————————
-- Supabase donnait jusqu'ici tous les droits aux rôles de l'API sur chaque nouvel objet du schéma
-- public ; on les retire pour que chaque ouverture soit volontaire.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
-- PostgreSQL rend toute nouvelle fonction exécutable par tous (PUBLIC) ; ce droit est global et ne
-- se retire pas schéma par schéma : chaque fonction devra être ouverte explicitement.
alter default privileges for role postgres revoke execute on functions from public;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ——— 1. Tables ————————————————————————————————————————————————————————————————————————————

-- Rôles d'administration : un rôle limite un compte de l'administration à certaines pages du
-- menu (identifiants de adminNavConfig.ts). Un compte d'administration sans rôle a l'accès complet.
create table public.roles (
  id text primary key default gen_random_uuid()::text,
  code text not null unique check (length(trim(code)) > 0),
  description text not null default '',
  pages text[] not null default '{}',
  auteur uuid,
  cree_le timestamptz not null default now()
);
comment on table public.roles is 'Rôles d''administration : pages du menu accessibles. Sans rôle, un compte d''administration a l''accès complet.';

-- Comptes des trois portails. L'identité (adresse de connexion, mot de passe) est gérée par
-- Supabase Auth (auth.users) ; ce qui décide des droits est rangé ici, hors de portée de l'utilisateur.
create table public.comptes (
  id uuid primary key references auth.users (id) on delete cascade,
  type_compte text not null check (type_compte in ('administration', 'enseignant', 'etudiant')),
  -- Matricule de l'étudiant ou identifiant de connexion (toujours en majuscules).
  identifiant text not null unique check (length(identifiant) > 0 and identifiant = upper(identifiant)),
  nom_affiche text not null check (length(trim(nom_affiche)) > 0),
  -- Adresse de contact (l'adresse de connexion, elle, est dans auth.users).
  email text not null default '',
  telephone text not null default '',
  fonction text not null default '',
  -- Dossier étudiant ou fiche enseignant rattaché (la clé étrangère arrive avec ces tables).
  lien_id text,
  role_id text references public.roles (id) on delete restrict,
  actif boolean not null default true,
  doit_changer_mot_de_passe boolean not null default true,
  mot_de_passe_change_le timestamptz,
  photo_chemin text,
  cree_le timestamptz not null default now(),
  constraint comptes_role_reserve_administration check (role_id is null or type_compte = 'administration'),
  constraint comptes_etudiant_rattache check (type_compte <> 'etudiant' or lien_id is not null)
);
comment on table public.comptes is 'Comptes des portails administration, enseignant et étudiant (un par identité Supabase).';
create index comptes_role_id_idx on public.comptes (role_id);
-- Un dossier étudiant ou une fiche enseignant n'a qu'un seul compte.
create unique index comptes_lien_unique on public.comptes (type_compte, lien_id) where lien_id is not null;

alter table public.roles
  add constraint roles_auteur_fkey foreign key (auteur) references public.comptes (id) on delete set null;
create index roles_auteur_idx on public.roles (auteur);

-- Établissement : une seule ligne, dont le nom figure sur tous les documents officiels.
create table public.etablissement (
  id smallint primary key default 1 check (id = 1),
  nom text not null check (length(trim(nom)) > 0),
  adresse text not null default '',
  telephone text not null default '',
  email text not null default '',
  site_web text not null default '',
  agrement text not null default '',
  logo_chemin text,
  modifie_le timestamptz not null default now(),
  modifie_par uuid references public.comptes (id) on delete set null
);
comment on table public.etablissement is 'Identité de l''établissement (une seule ligne).';
create index etablissement_modifie_par_idx on public.etablissement (modifie_par);

-- Années académiques : « 2026-2027 », une seule année courante à la fois.
create table public.annees_academiques (
  id text primary key default gen_random_uuid()::text,
  libelle text not null unique check (
    libelle ~ '^[0-9]{4}-[0-9]{4}$'
    and split_part(libelle, '-', 2)::int = split_part(libelle, '-', 1)::int + 1
  ),
  date_debut date,
  date_fin date,
  actuelle boolean not null default false,
  -- Clôturée : plus aucune donnée de cette année ne se modifie (voir private.refuser_annee_cloturee).
  cloturee boolean not null default false,
  archivee boolean not null default false,
  cree_le timestamptz not null default now(),
  constraint annees_dates_ordonnees check (date_debut is null or date_fin is null or date_debut < date_fin)
);
comment on table public.annees_academiques is 'Années académiques ; une année clôturée est figée.';
create unique index annees_une_seule_actuelle on public.annees_academiques (actuelle) where actuelle;

-- Journal d'audit : qui a fait quoi, quand. Rien ne s'y modifie ni ne s'y efface.
create table public.journal_audit (
  id bigint generated always as identity primary key,
  cree_le timestamptz not null default now(),
  acteur uuid references public.comptes (id) on delete set null,
  action text not null check (length(trim(action)) > 0),
  cible_type text not null default '',
  cible_id text not null default '',
  details text
);
comment on table public.journal_audit is 'Journal d''audit, en ajout seul.';
create index journal_audit_cree_le_idx on public.journal_audit (cree_le desc);
create index journal_audit_acteur_idx on public.journal_audit (acteur);

-- Notifications. Celles d'un même « groupe » (ex. notes publiées) fusionnent tant qu'elles ne
-- sont pas lues : « 6 nouvelles notes publiées ».
create table public.notifications (
  id bigint generated always as identity primary key,
  destinataire uuid not null references public.comptes (id) on delete cascade,
  message text not null check (length(message) between 1 and 1000),
  cree_le timestamptz not null default now(),
  lue boolean not null default false,
  lue_le timestamptz,
  archivee boolean not null default false,
  groupe text,
  nombre integer not null default 1 check (nombre >= 1)
);
comment on table public.notifications is 'Notifications des trois portails.';
create index notifications_destinataire_idx on public.notifications (destinataire, cree_le desc);
create unique index notifications_groupe_non_lue on public.notifications (destinataire, groupe)
  where groupe is not null and not lue;

-- Compteurs des numérotations officielles (matricules, quittances, décomptes…), hors de l'API.
create table private.compteurs (
  cle text primary key,
  valeur bigint not null default 0 check (valeur >= 0)
);
comment on table private.compteurs is 'Dernier numéro attribué par numérotation (ex. « matricule:2026-LQHSE »).';

-- ——— 2. Fonctions d'aide aux règles d'accès ——————————————————————————————————————————————
-- SECURITY DEFINER : elles lisent les comptes et les rôles sans repasser par leurs propres règles
-- d'accès (sinon une règle sur « comptes » s'appellerait elle-même). Chacune ne parle que du
-- compte connecté (auth.uid()), et un compte désactivé n'a aucun droit.

create function private.type_compte_courant()
returns text
language sql stable security definer set search_path = ''
as $$
  select c.type_compte from public.comptes c
  where c.id = (select auth.uid()) and c.actif
$$;

create function private.est_administration()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select private.type_compte_courant()) = 'administration', false)
$$;

-- Accès complet : compte d'administration actif sans rôle limitant.
create function private.a_acces_complet()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.comptes c
    where c.id = (select auth.uid()) and c.actif
      and c.type_compte = 'administration' and c.role_id is null
  )
$$;

-- Accès à une page du menu d'administration (identifiant de adminNavConfig.ts).
create function private.a_acces_page(p_page text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.comptes c
    left join public.roles r on r.id = c.role_id
    where c.id = (select auth.uid()) and c.actif
      and c.type_compte = 'administration'
      and (c.role_id is null or p_page = any (r.pages))
  )
$$;

-- Dossier étudiant ou fiche enseignant du compte connecté.
create function private.lien_courant()
returns text
language sql stable security definer set search_path = ''
as $$
  select c.lien_id from public.comptes c
  where c.id = (select auth.uid()) and c.actif
$$;

create function private.annee_cloturee(p_libelle text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select a.cloturee from public.annees_academiques a where a.libelle = p_libelle), false)
$$;

revoke execute on function
  private.type_compte_courant(), private.est_administration(), private.a_acces_complet(),
  private.a_acces_page(text), private.lien_courant(), private.annee_cloturee(text)
  from public, anon;
grant execute on function
  private.type_compte_courant(), private.est_administration(), private.a_acces_complet(),
  private.a_acces_page(text), private.lien_courant(), private.annee_cloturee(text)
  to authenticated, service_role;

-- Garde-fou des années clôturées, posé par les parties suivantes sur chaque table qui a une
-- colonne « annee » (libellé) : ni ajout, ni modification, ni suppression dans une année figée.
create function private.refuser_annee_cloturee()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_annee text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_annee := to_jsonb(old) ->> 'annee';
    if private.annee_cloturee(v_annee) then
      raise exception 'L''année académique % est clôturée — aucune modification n''est plus possible.', v_annee
        using errcode = 'check_violation';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_annee := to_jsonb(new) ->> 'annee';
    if private.annee_cloturee(v_annee) then
      raise exception 'L''année académique % est clôturée — aucune modification n''est plus possible.', v_annee
        using errcode = 'check_violation';
    end if;
    return new;
  end if;
  return old;
end;
$$;

-- Prochain numéro d'une numérotation, sans doublon même avec des enregistrements simultanés
-- (la ligne du compteur est verrouillée le temps de l'incrément). Réservé aux fonctions serveur.
create function private.prochain_numero(p_cle text)
returns bigint
language sql volatile set search_path = ''
as $$
  insert into private.compteurs as c (cle, valeur) values (p_cle, 1)
  on conflict (cle) do update set valeur = c.valeur + 1
  returning c.valeur
$$;
revoke execute on function private.prochain_numero(text) from public, anon, authenticated;
grant execute on function private.prochain_numero(text) to service_role;

-- ——— 3. Déclencheurs ——————————————————————————————————————————————————————————————————————

create function private.horodater_etablissement()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.modifie_le := now();
  new.modifie_par := (select auth.uid());
  return new;
end;
$$;
create trigger etablissement_horodatage before insert or update on public.etablissement
  for each row execute function private.horodater_etablissement();

create function private.journal_inalterable()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'Le journal d''audit ne se modifie pas et ne s''efface pas.' using errcode = 'insufficient_privilege';
end;
$$;
create trigger journal_audit_inalterable before update or delete on public.journal_audit
  for each row execute function private.journal_inalterable();

create function private.dater_lecture()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.lue and not old.lue then
    new.lue_le := now();
  elsif not new.lue then
    new.lue_le := null;
  end if;
  return new;
end;
$$;
create trigger notifications_date_lecture before update on public.notifications
  for each row execute function private.dater_lecture();

-- ——— 4. Fonctions appelables par l'application ————————————————————————————————————————————

-- Avant toute connexion, l'écran d'accueil sait si l'application est installée et sous quel nom.
create function public.etat_installation()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'installee', exists (select 1 from public.comptes c where c.type_compte = 'administration'),
    'etablissement', (select e.nom from public.etablissement e where e.id = 1)
  )
$$;
revoke execute on function public.etat_installation() from public;
grant execute on function public.etat_installation() to anon, authenticated, service_role;

-- Inscrit une action au journal au nom du compte connecté (jamais au nom d'un autre).
create function public.journaliser(
  p_action text,
  p_cible_type text default '',
  p_cible_id text default '',
  p_details text default null
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_id bigint;
begin
  if (select private.type_compte_courant()) is null then
    raise exception 'Connectez-vous avec un compte actif.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.journal_audit (acteur, action, cible_type, cible_id, details)
  values ((select auth.uid()), p_action, coalesce(p_cible_type, ''), coalesce(p_cible_id, ''), p_details)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.journaliser(text, text, text, text) from public;
grant execute on function public.journaliser(text, text, text, text) to authenticated, service_role;

-- Envoie une notification. Partie 1 : chacun peut se notifier lui-même et prévenir
-- l'administration ; l'administration peut prévenir tout le monde. Les parties suivantes ouvrent
-- les échanges professeur ↔ étudiants de ses classes.
-- Avec un groupe, une notification non lue du même groupe est complétée au lieu d'être doublée :
-- « {n} » dans p_message_groupe est remplacé par le nombre d'événements regroupés.
create function public.notifier(
  p_destinataire uuid,
  p_message text,
  p_groupe text default null,
  p_message_groupe text default null
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_id bigint;
begin
  if (select private.type_compte_courant()) is null then
    raise exception 'Connectez-vous avec un compte actif.' using errcode = 'insufficient_privilege';
  end if;
  if not (
    p_destinataire = v_moi
    or (select private.est_administration())
    or exists (select 1 from public.comptes c where c.id = p_destinataire and c.type_compte = 'administration')
  ) then
    raise exception 'Vous ne pouvez pas envoyer de notification à ce compte.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.notifications as n (destinataire, message, groupe)
  values (p_destinataire, p_message, p_groupe)
  on conflict (destinataire, groupe) where groupe is not null and not lue
  do update set
    nombre = n.nombre + 1,
    message = replace(coalesce(p_message_groupe, p_message), '{n}', (n.nombre + 1)::text),
    cree_le = now()
  returning n.id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.notifier(uuid, text, text, text) from public;
grant execute on function public.notifier(uuid, text, text, text) to authenticated, service_role;

-- Notifications lues depuis plus de 90 jours et non archivées : supprimées (programmé à la partie 8).
create function private.purger_notifications()
returns integer
language sql volatile set search_path = ''
as $$
  with supprimees as (
    delete from public.notifications n
    where n.lue and n.lue_le < now() - interval '90 days' and not n.archivee
    returning 1
  )
  select count(*)::integer from supprimees
$$;
revoke execute on function private.purger_notifications() from public, anon, authenticated;
grant execute on function private.purger_notifications() to service_role;

-- ——— 5. Droits et règles d'accès ——————————————————————————————————————————————————————————

alter table public.roles enable row level security;
alter table public.comptes enable row level security;
alter table public.etablissement enable row level security;
alter table public.annees_academiques enable row level security;
alter table public.journal_audit enable row level security;
alter table public.notifications enable row level security;
alter table private.compteurs enable row level security;

-- Rôles : visibles par l'administration ; seuls les comptes à accès complet les créent ou modifient.
grant select, insert, update, delete on public.roles to authenticated;
create policy roles_lecture on public.roles for select to authenticated
  using ((select private.est_administration()));
create policy roles_creation on public.roles for insert to authenticated
  with check ((select private.a_acces_complet()));
create policy roles_modification on public.roles for update to authenticated
  using ((select private.a_acces_complet())) with check ((select private.a_acces_complet()));
create policy roles_suppression on public.roles for delete to authenticated
  using ((select private.a_acces_complet()));

-- Comptes : chacun voit le sien, l'administration voit tous les comptes. Seuls l'adresse de
-- contact, le téléphone et la photo sont modifiables par leur titulaire ; le reste passe par les
-- fonctions serveur de la partie 2 (création, blocage, rôle, mot de passe).
grant select on public.comptes to authenticated;
grant update (email, telephone, photo_chemin) on public.comptes to authenticated;
create policy comptes_lecture on public.comptes for select to authenticated
  using (id = (select auth.uid()) or (select private.est_administration()));
create policy comptes_modification_soi on public.comptes for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Établissement : lu par tous les comptes connectés (documents), modifié par qui a la page
-- « Paramètres généraux ». La ligne est créée à l'installation (partie 2).
grant select on public.etablissement to authenticated;
grant update (nom, adresse, telephone, email, site_web, agrement, logo_chemin) on public.etablissement to authenticated;
create policy etablissement_lecture on public.etablissement for select to authenticated using (true);
create policy etablissement_modification on public.etablissement for update to authenticated
  using ((select private.a_acces_page('sec-settings')))
  with check ((select private.a_acces_page('sec-settings')));

-- Années : lues par tous les comptes connectés, gérées par qui a la page « Années académiques ».
grant select, insert, update, delete on public.annees_academiques to authenticated;
create policy annees_lecture on public.annees_academiques for select to authenticated using (true);
create policy annees_creation on public.annees_academiques for insert to authenticated
  with check ((select private.a_acces_page('acad-annees')));
create policy annees_modification on public.annees_academiques for update to authenticated
  using ((select private.a_acces_page('acad-annees')))
  with check ((select private.a_acces_page('acad-annees')));
create policy annees_suppression on public.annees_academiques for delete to authenticated
  using ((select private.a_acces_page('acad-annees')));

-- Journal : lu par qui a la page « Journal d'audit » ; écrit seulement par public.journaliser
-- et les fonctions serveur.
grant select on public.journal_audit to authenticated;
create policy journal_lecture on public.journal_audit for select to authenticated
  using ((select private.a_acces_page('sec-audit')));

-- Notifications : chacun lit les siennes et ne peut que les marquer lues ou archivées ; elles sont
-- créées par public.notifier et les fonctions serveur.
grant select on public.notifications to authenticated;
grant update (lue, archivee) on public.notifications to authenticated;
create policy notifications_lecture on public.notifications for select to authenticated
  using (destinataire = (select auth.uid()));
create policy notifications_modification on public.notifications for update to authenticated
  using (destinataire = (select auth.uid())) with check (destinataire = (select auth.uid()));

-- Fonctions serveur et scripts d'administration (clé secrète, jamais dans le navigateur).
grant select, insert, update, delete on
  public.roles, public.comptes, public.etablissement, public.annees_academiques, public.notifications
  to service_role;
grant select, insert on public.journal_audit to service_role;
grant select, insert, update on private.compteurs to service_role;
