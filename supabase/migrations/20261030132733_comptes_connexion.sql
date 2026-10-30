-- Comptes et connexion (partie 2 du plan de migration).
--
-- On se connecte avec son matricule (étudiants) ou son identifiant (administration, professeurs).
-- Chaque compte Supabase a une adresse de connexion technique, jamais montrée : la fonction serveur
-- « connexion » la retrouve à partir de l'identifiant saisi, compte les échecs (verrouillage de
-- 15 minutes après 5 échecs), puis contrôle le compte et son portail.
--
-- Deux sortes de fonctions ici :
--   - celles « du serveur » (connexion, installation, création de compte, code PIN) ne sont
--     exécutables qu'avec la clé secrète (service_role), par les fonctions serveur ; elles reçoivent
--     le compte qui agit, déjà vérifié par la fonction serveur ;
--   - celles de l'administration (modifier, bloquer, portails, codes PIN) sont appelées avec la
--     session de l'administrateur et vérifient elles-mêmes ses droits.

-- ——— 1. Droits d'un compte donné ————————————————————————————————————————————————————————————
-- Les fonctions serveur agissent pour un compte qu'elles nomment (pas de session) : mêmes règles
-- que private.a_acces_page / a_acces_complet, qui deviennent des raccourcis vers celles-ci.

create function private.acces_page_de(p_compte uuid, p_page text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.comptes c
    left join public.roles r on r.id = c.role_id
    where c.id = p_compte and c.actif
      and c.type_compte = 'administration'
      and (c.role_id is null or p_page = any (r.pages))
  )
$$;

create function private.acces_complet_de(p_compte uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.comptes c
    where c.id = p_compte and c.actif
      and c.type_compte = 'administration' and c.role_id is null
  )
$$;

create or replace function private.a_acces_complet()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.acces_complet_de((select auth.uid()))
$$;

create or replace function private.a_acces_page(p_page text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.acces_page_de((select auth.uid()), p_page)
$$;

-- Un compte limité par un rôle ne touche jamais à un compte à accès complet (il pourrait s'en
-- emparer par un code PIN, ou écarter les administrateurs principaux).
create function private.peut_gerer_compte(p_acteur uuid, p_cible uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.acces_complet_de(p_acteur)
    or not exists (
      select 1 from public.comptes c
      where c.id = p_cible and c.type_compte = 'administration' and c.role_id is null
    )
$$;

-- Un compte limité n'attribue jamais un rôle qui ouvre une page qu'il n'a pas lui-même.
create function private.peut_attribuer_role(p_acteur uuid, p_role text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_role is null
    or private.acces_complet_de(p_acteur)
    or not exists (
      select 1 from public.roles r, unnest(r.pages) as page
      where r.id = p_role and not private.acces_page_de(p_acteur, page)
    )
$$;

-- Il reste toujours au moins un administrateur à accès complet actif : sans lui, plus personne ne
-- gère les rôles ni ne débloque un compte.
create function private.serait_dernier_acces_complet(p_compte uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.acces_complet_de(p_compte)
    and not exists (
      select 1 from public.comptes c
      where c.id <> p_compte and c.actif and c.type_compte = 'administration' and c.role_id is null
    )
$$;

revoke execute on function
  private.acces_page_de(uuid, text), private.acces_complet_de(uuid),
  private.peut_gerer_compte(uuid, uuid), private.peut_attribuer_role(uuid, text),
  private.serait_dernier_acces_complet(uuid)
  from public, anon, authenticated;
grant execute on function
  private.acces_page_de(uuid, text), private.acces_complet_de(uuid),
  private.peut_gerer_compte(uuid, uuid), private.peut_attribuer_role(uuid, text),
  private.serait_dernier_acces_complet(uuid)
  to service_role;

-- ——— 2. Portails ————————————————————————————————————————————————————————————————————————————
-- Un portail fermé refuse la connexion de tous ses comptes et coupe l'accès aux données des
-- sessions déjà ouvertes. Le portail Administration ne se ferme jamais (sinon plus personne ne
-- pourrait le rouvrir).
create table public.portails (
  type_compte text primary key check (type_compte in ('administration', 'enseignant', 'etudiant')),
  ouvert boolean not null default true,
  message text not null default '' check (length(message) <= 500),
  modifie_le timestamptz not null default now(),
  modifie_par uuid references public.comptes (id) on delete set null,
  constraint portails_administration_toujours_ouvert check (type_compte <> 'administration' or ouvert)
);
comment on table public.portails is 'Ouverture des portails administration, enseignant et étudiant.';
create index portails_modifie_par_idx on public.portails (modifie_par);
insert into public.portails (type_compte) values ('administration'), ('enseignant'), ('etudiant');

create function private.libelle_portail(p_type_compte text)
returns text
language sql immutable set search_path = ''
as $$
  select case p_type_compte
    when 'administration' then 'Administration'
    when 'enseignant' then 'Professeurs'
    when 'etudiant' then 'Étudiants'
  end
$$;
revoke execute on function private.libelle_portail(text) from public, anon, authenticated;

-- Le compte connecté n'a de droits que si son portail est ouvert.
create or replace function private.type_compte_courant()
returns text
language sql stable security definer set search_path = ''
as $$
  select c.type_compte
  from public.comptes c
  join public.portails p on p.type_compte = c.type_compte
  where c.id = (select auth.uid()) and c.actif and p.ouvert
$$;

create or replace function private.lien_courant()
returns text
language sql stable security definer set search_path = ''
as $$
  select c.lien_id
  from public.comptes c
  join public.portails p on p.type_compte = c.type_compte
  where c.id = (select auth.uid()) and c.actif and p.ouvert
$$;

-- ——— 3. Verrouillage après échecs ———————————————————————————————————————————————————————————
-- Suivi par identifiant saisi, qu'il corresponde à un compte ou non : sinon le verrouillage
-- révélerait quels identifiants existent.
create table private.tentatives_connexion (
  identifiant text primary key,
  echecs integer not null default 0 check (echecs >= 0),
  verrouille_jusqua timestamptz,
  derniere_tentative timestamptz not null default now()
);
comment on table private.tentatives_connexion is 'Échecs de connexion récents par identifiant saisi (verrouillage).';
create index tentatives_connexion_derniere_idx on private.tentatives_connexion (derniere_tentative);

-- ——— 4. Codes PIN et demandes « mot de passe oublié » ——————————————————————————————————————————
-- Un code à 6 chiffres remis en main propre par l'administration permet de choisir un nouveau mot
-- de passe depuis la page de connexion. Seul le plus récent code d'un compte compte ; il sert une
-- fois, 24 heures au plus, et tombe après 5 essais erronés. Le code n'est conservé que chiffré.
create table public.codes_pin (
  id bigint generated always as identity primary key,
  compte uuid not null references public.comptes (id) on delete cascade,
  code_chiffre text not null,
  cree_le timestamptz not null default now(),
  expire_le timestamptz not null,
  auteur uuid references public.comptes (id) on delete set null,
  utilise_le timestamptz,
  revoque_le timestamptz,
  -- Révocation : par un administrateur (revoque_par), ou par le système après trop d'essais.
  revoque_par uuid references public.comptes (id) on delete set null,
  revoque_motif text,
  essais_echoues integer not null default 0 check (essais_echoues >= 0)
);
comment on table public.codes_pin is 'Codes de réinitialisation du mot de passe remis par l''administration.';
create index codes_pin_compte_idx on public.codes_pin (compte, id desc);
create index codes_pin_auteur_idx on public.codes_pin (auteur);
create index codes_pin_revoque_par_idx on public.codes_pin (revoque_par);

create table public.demandes_reinitialisation (
  id bigint generated always as identity primary key,
  compte uuid not null references public.comptes (id) on delete cascade,
  cree_le timestamptz not null default now(),
  traitee_le timestamptz,
  traitee_par uuid references public.comptes (id) on delete set null
);
comment on table public.demandes_reinitialisation is 'Demandes « mot de passe oublié » faites depuis la page de connexion.';
-- Une seule demande en attente par compte (pas de nouvelle alerte à chaque clic).
create unique index demandes_reinitialisation_en_attente on public.demandes_reinitialisation (compte)
  where traitee_le is null;
create index demandes_reinitialisation_traitee_par_idx on public.demandes_reinitialisation (traitee_par);

-- Statut calculé à la lecture : un code plus ancien que le dernier du compte est « remplacé ».
create view public.codes_pin_suivi
with (security_invoker = true)
as
  select
    c.id, c.compte, c.cree_le, c.expire_le, c.auteur, c.utilise_le, c.revoque_le, c.revoque_par,
    c.revoque_motif, c.essais_echoues,
    case
      when c.revoque_le is not null then 'revoque'
      when c.utilise_le is not null then 'utilise'
      when c.expire_le <= now() then 'expire'
      when c.id <> max(c.id) over (partition by c.compte) then 'remplace'
      else 'actif'
    end as statut
  from public.codes_pin c;

-- ——— 5. Fonctions du serveur : connexion ———————————————————————————————————————————————————

-- Avant d'essayer le mot de passe : identifiant verrouillé ? Sinon, adresse de connexion du compte
-- (vide si l'identifiant ne correspond à aucun compte).
create function public.connexion_preparer(p_identifiant text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_identifiant text := upper(trim(coalesce(p_identifiant, '')));
  v_jusqua timestamptz;
  v_email text;
begin
  select t.verrouille_jusqua into v_jusqua
  from private.tentatives_connexion t where t.identifiant = v_identifiant;
  if v_jusqua > now() then
    return jsonb_build_object('verrouille', true, 'minutes', ceil(extract(epoch from v_jusqua - now()) / 60)::int);
  end if;
  select u.email into v_email
  from public.comptes c join auth.users u on u.id = c.id
  where c.identifiant = v_identifiant;
  return jsonb_build_object('verrouille', false, 'email', v_email);
end;
$$;

-- Mot de passe refusé : un échec de plus ; au 5e en 15 minutes, l'identifiant est verrouillé
-- 15 minutes, le titulaire et les administrateurs à accès complet sont prévenus.
create function public.connexion_echec(p_identifiant text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_identifiant text := upper(trim(coalesce(p_identifiant, '')));
  v_ligne private.tentatives_connexion;
  v_compte public.comptes;
begin
  -- Ménage : les identifiants sans tentative depuis un jour sont oubliés.
  delete from private.tentatives_connexion t
  where t.derniere_tentative < now() - interval '1 day'
    and (t.verrouille_jusqua is null or t.verrouille_jusqua <= now());

  insert into private.tentatives_connexion as t (identifiant, echecs, derniere_tentative)
  values (v_identifiant, 1, now())
  on conflict (identifiant) do update set
    -- Un verrouillage échu ou des échecs anciens ne comptent plus.
    echecs = case
      when t.verrouille_jusqua <= now() or t.derniere_tentative < now() - interval '15 minutes' then 1
      else t.echecs + 1
    end,
    verrouille_jusqua = case when t.verrouille_jusqua <= now() then null else t.verrouille_jusqua end,
    derniere_tentative = now()
  returning * into v_ligne;

  if v_ligne.echecs >= 5 and v_ligne.verrouille_jusqua is null then
    update private.tentatives_connexion t set verrouille_jusqua = now() + interval '15 minutes'
    where t.identifiant = v_identifiant
    returning * into v_ligne;

    select * into v_compte from public.comptes c where c.identifiant = v_identifiant;
    if found then
      insert into public.journal_audit (acteur, action, cible_type, cible_id, details)
      values (null, 'lockout_failed_attempts', 'compte', v_compte.id::text, '5 tentatives échouées');
      insert into public.notifications (destinataire, message)
      values (v_compte.id, 'Votre compte a été temporairement bloqué après plusieurs tentatives de connexion échouées.');
      insert into public.notifications as n (destinataire, message, groupe)
      select a.id,
             format('Compte verrouillé après des tentatives échouées : %s (%s).', v_compte.nom_affiche, v_compte.identifiant),
             'comptes-verrouilles'
      from public.comptes a
      where a.actif and a.type_compte = 'administration' and a.role_id is null and a.id <> v_compte.id
      on conflict (destinataire, groupe) where groupe is not null and not lue
      do update set
        nombre = n.nombre + 1,
        message = format('%s comptes verrouillés après des tentatives de connexion échouées (voir le journal d''audit).', n.nombre + 1),
        cree_le = now();
    end if;
  end if;

  return jsonb_build_object(
    'verrouille', coalesce(v_ligne.verrouille_jusqua > now(), false),
    'minutes', case when v_ligne.verrouille_jusqua > now()
                    then ceil(extract(epoch from v_ligne.verrouille_jusqua - now()) / 60)::int end
  );
end;
$$;

-- Mot de passe accepté : le compte et son portail sont-ils ouverts ? Si oui, les échecs sont
-- effacés et la connexion inscrite au journal.
create function public.connexion_reussie(p_compte uuid, p_identifiant text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_compte public.comptes;
  v_portail public.portails;
begin
  select * into v_compte from public.comptes c where c.id = p_compte;
  if not found then
    return jsonb_build_object('autorise', false, 'message', 'Ce compte n''est relié à aucun portail. Contactez l''administration.');
  end if;
  if not v_compte.actif then
    return jsonb_build_object('autorise', false, 'message', 'Ce compte a été désactivé. Contactez l''administration de l''établissement.');
  end if;
  select * into v_portail from public.portails p where p.type_compte = v_compte.type_compte;
  if not v_portail.ouvert then
    return jsonb_build_object('autorise', false, 'message',
      format('Le portail %s est actuellement fermé%s. Contactez l''administration.',
             private.libelle_portail(v_compte.type_compte),
             case when v_portail.message <> '' then ' : ' || v_portail.message else '' end));
  end if;

  delete from private.tentatives_connexion t where t.identifiant = upper(trim(coalesce(p_identifiant, '')));
  insert into public.journal_audit (acteur, action, cible_type, cible_id)
  values (v_compte.id, 'login', 'compte', v_compte.id::text);
  return jsonb_build_object('autorise', true, 'doit_changer_mot_de_passe', v_compte.doit_changer_mot_de_passe);
end;
$$;

-- ——— 6. Fonctions du serveur : installation et création de comptes ——————————————————————————
-- La fonction serveur les appelle d'abord sans compte (p_compte null : contrôle seul, pour ne pas
-- créer d'identité Supabase pour rien), puis, l'identité créée, avec son id pour enregistrer.

create function private.controler_annee(p_libelle text, p_date_debut date, p_date_fin date)
returns void
language plpgsql immutable set search_path = ''
as $$
declare
  v_premiere int;
begin
  if p_libelle is null or p_libelle !~ '^[0-9]{4}-[0-9]{4}$'
     or split_part(p_libelle, '-', 2)::int <> split_part(p_libelle, '-', 1)::int + 1 then
    raise exception 'Le libellé doit suivre le format 2026-2027.' using errcode = 'check_violation';
  end if;
  if p_date_debut is null or p_date_fin is null then
    raise exception 'Renseignez la date de début et la date de fin.' using errcode = 'check_violation';
  end if;
  v_premiere := split_part(p_libelle, '-', 1)::int;
  if extract(year from p_date_debut)::int <> v_premiere then
    raise exception 'La rentrée de l''année % doit tomber en %.', p_libelle, v_premiere using errcode = 'check_violation';
  end if;
  if p_date_fin <= p_date_debut then
    raise exception 'La date de fin doit être postérieure à la date de début.' using errcode = 'check_violation';
  end if;
  if extract(year from p_date_fin)::int > v_premiere + 1 then
    raise exception 'L''année % doit se terminer au plus tard en %.', p_libelle, v_premiere + 1 using errcode = 'check_violation';
  end if;
end;
$$;
revoke execute on function private.controler_annee(text, date, date) from public, anon, authenticated;

-- Première ouverture : crée l'établissement, l'année en cours et l'administrateur principal (mot
-- de passe choisi par lui-même). Refusé dès qu'un compte d'administration existe.
create function public.installation_enregistrer(
  p_compte uuid,
  p_identifiant text,
  p_prenom text,
  p_nom text,
  p_email text,
  p_annee text,
  p_date_debut date,
  p_date_fin date,
  p_etablissement text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_identifiant text := upper(trim(coalesce(p_identifiant, '')));
begin
  -- Deux installations simultanées : la seconde attend la première, puis est refusée.
  perform pg_advisory_xact_lock(hashtext('edumanage:installation'));
  if exists (select 1 from public.comptes c where c.type_compte = 'administration') then
    raise exception 'L''application est déjà installée : connectez-vous.' using errcode = 'unique_violation';
  end if;
  if v_identifiant = '' or trim(coalesce(p_prenom, '')) = '' or trim(coalesce(p_nom, '')) = ''
     or trim(coalesce(p_email, '')) = '' then
    raise exception 'Renseignez tous les champs.' using errcode = 'check_violation';
  end if;
  perform private.controler_annee(p_annee, p_date_debut, p_date_fin);
  if p_compte is null then
    return;
  end if;

  insert into public.comptes (id, type_compte, identifiant, nom_affiche, email, fonction, doit_changer_mot_de_passe, mot_de_passe_change_le)
  values (p_compte, 'administration', v_identifiant, trim(p_prenom) || ' ' || upper(trim(p_nom)),
          lower(trim(p_email)), 'Administrateur principal', false, now());

  insert into public.etablissement (id, nom)
  values (1, coalesce(nullif(trim(p_etablissement), ''), 'Institut Supérieur EduManage'))
  on conflict (id) do nothing;

  update public.annees_academiques set actuelle = false where actuelle and libelle <> p_annee;
  insert into public.annees_academiques (libelle, date_debut, date_fin, actuelle)
  values (p_annee, p_date_debut, p_date_fin, true)
  on conflict (libelle) do update set date_debut = excluded.date_debut, date_fin = excluded.date_fin, actuelle = true;

  insert into public.journal_audit (acteur, action, cible_type, cible_id, details)
  values (p_compte, 'installation', 'compte', p_compte::text, 'Année ' || p_annee);
end;
$$;

-- Création d'un compte par l'administration (p_acteur : l'administrateur connecté).
--   - administration et professeurs : pages « Liste des utilisateurs » ou « Ajouter nouvel
--     utilisateur » ; un professeur peut aussi l'être depuis « Ajouter professeurs » ;
--   - étudiants : page « Ajouter étudiants », rattachés à leur dossier.
-- Le titulaire devra changer son mot de passe initial à la première connexion.
create function public.compte_enregistrer(
  p_acteur uuid,
  p_compte uuid,
  p_type_compte text,
  p_identifiant text,
  p_nom_affiche text,
  p_email text default '',
  p_telephone text default '',
  p_fonction text default '',
  p_role_id text default null,
  p_lien_id text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_identifiant text := upper(trim(coalesce(p_identifiant, '')));
  v_email text := trim(coalesce(p_email, ''));
  v_role text := nullif(trim(coalesce(p_role_id, '')), '');
  v_lien text := nullif(trim(coalesce(p_lien_id, '')), '');
  v_autorise boolean;
begin
  if p_type_compte is null or p_type_compte not in ('administration', 'enseignant', 'etudiant') then
    raise exception 'Type de compte inconnu.' using errcode = 'check_violation';
  end if;
  v_autorise := case p_type_compte
    when 'etudiant' then private.acces_page_de(p_acteur, 'etudiants-ajouter')
    when 'enseignant' then private.acces_page_de(p_acteur, 'sec-users') or private.acces_page_de(p_acteur, 'sec-user-add')
                           or private.acces_page_de(p_acteur, 'prof-ajouter')
    else private.acces_page_de(p_acteur, 'sec-users') or private.acces_page_de(p_acteur, 'sec-user-add')
  end;
  if not v_autorise then
    raise exception 'Vous n''avez pas le droit de créer ce compte.' using errcode = 'insufficient_privilege';
  end if;
  if v_identifiant = '' or trim(coalesce(p_nom_affiche, '')) = '' then
    raise exception 'Renseignez l''identifiant et le nom du compte.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.comptes c where c.identifiant = v_identifiant) then
    raise exception 'Cet identifiant est déjà utilisé par un autre compte.' using errcode = 'unique_violation';
  end if;
  if p_type_compte <> 'etudiant' and v_email <> ''
     and exists (select 1 from public.comptes c where lower(c.email) = lower(v_email) and c.type_compte <> 'etudiant') then
    raise exception 'Cet email est déjà utilisé par un autre compte.' using errcode = 'unique_violation';
  end if;
  if p_type_compte = 'etudiant' and v_lien is null then
    raise exception 'Un compte étudiant est rattaché à son dossier.' using errcode = 'check_violation';
  end if;
  if v_lien is not null and exists (select 1 from public.comptes c where c.type_compte = p_type_compte and c.lien_id = v_lien) then
    raise exception 'Cette fiche est déjà reliée à un autre compte.' using errcode = 'unique_violation';
  end if;
  if p_type_compte = 'administration' then
    if v_role is null and not private.acces_complet_de(p_acteur) then
      raise exception 'Seul un administrateur à accès complet peut créer un compte sans rôle (accès complet). Choisissez un rôle.'
        using errcode = 'insufficient_privilege';
    end if;
    if v_role is not null and not exists (select 1 from public.roles r where r.id = v_role) then
      raise exception 'Ce rôle n''existe pas.' using errcode = 'foreign_key_violation';
    end if;
    if not private.peut_attribuer_role(p_acteur, v_role) then
      raise exception 'Vous ne pouvez pas attribuer un rôle qui ouvre des pages auxquelles vous n''avez pas accès.'
        using errcode = 'insufficient_privilege';
    end if;
  elsif v_role is not null then
    raise exception 'Un rôle ne s''attribue qu''à un compte de l''administration.' using errcode = 'check_violation';
  end if;
  if p_compte is null then
    return;
  end if;

  insert into public.comptes (id, type_compte, identifiant, nom_affiche, email, telephone, fonction, role_id, lien_id)
  values (p_compte, p_type_compte, v_identifiant, trim(p_nom_affiche), v_email, trim(coalesce(p_telephone, '')),
          trim(coalesce(p_fonction, '')), v_role, v_lien);
  insert into public.journal_audit (acteur, action, cible_type, cible_id, details)
  values (p_acteur, 'create_user_account', 'compte', p_compte::text, trim(p_nom_affiche));
end;
$$;

-- ——— 7. Fonctions du serveur : mots de passe —————————————————————————————————————————————————

-- Code PIN saisi sur la page de connexion : vérifié contre le plus récent code du compte, et
-- consommé s'il est bon. Les essais erronés sont comptés (pas d'exception, qui les annulerait).
create function public.code_pin_utiliser(p_identifiant text, p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_refus constant jsonb := jsonb_build_object('ok', false,
    'message', 'Code invalide ou expiré. Demandez un nouveau code à l''administration.');
  v_compte uuid;
  v_code public.codes_pin;
begin
  select c.id into v_compte from public.comptes c where c.identifiant = upper(trim(coalesce(p_identifiant, '')));
  if v_compte is null then
    return v_refus;
  end if;
  select * into v_code from public.codes_pin p where p.compte = v_compte order by p.id desc limit 1 for update;
  if not found or v_code.utilise_le is not null or v_code.revoque_le is not null or v_code.expire_le <= now() then
    return v_refus;
  end if;
  if v_code.code_chiffre <> extensions.crypt(trim(coalesce(p_code, '')), v_code.code_chiffre) then
    update public.codes_pin p set
      essais_echoues = p.essais_echoues + 1,
      revoque_le = case when p.essais_echoues + 1 >= 5 then now() end,
      revoque_motif = case when p.essais_echoues + 1 >= 5 then 'Système — 5 essais erronés' end
    where p.id = v_code.id;
    return v_refus;
  end if;
  update public.codes_pin p set utilise_le = now() where p.id = v_code.id;
  return jsonb_build_object('ok', true, 'compte', v_compte);
end;
$$;

-- Nouveau mot de passe choisi par le titulaire (code PIN, changement obligatoire ou volontaire) :
-- plus rien de provisoire, l'éventuel verrouillage est levé.
create function public.mot_de_passe_definitif(p_compte uuid, p_action text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_identifiant text;
begin
  if p_action not in ('reset_password_pin', 'update_password') then
    raise exception 'Action inconnue.' using errcode = 'check_violation';
  end if;
  update public.comptes c set doit_changer_mot_de_passe = false, mot_de_passe_change_le = now()
  where c.id = p_compte
  returning c.identifiant into v_identifiant;
  if v_identifiant is null then
    raise exception 'Compte introuvable.' using errcode = 'no_data_found';
  end if;
  delete from private.tentatives_connexion t where t.identifiant = v_identifiant;
  insert into public.journal_audit (acteur, action, cible_type, cible_id)
  values (p_compte, p_action, 'compte', p_compte::text);
end;
$$;

-- « Mot de passe oublié » : l'administration est prévenue (une demande en attente par compte) ;
-- aucun code n'est envoyé. Un identifiant inconnu ne change rien (et la réponse est la même).
create function public.demande_reinitialisation(p_identifiant text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_compte public.comptes;
  v_demande bigint;
begin
  select * into v_compte from public.comptes c where c.identifiant = upper(trim(coalesce(p_identifiant, '')));
  if not found then
    return;
  end if;
  insert into public.demandes_reinitialisation (compte) values (v_compte.id)
  on conflict (compte) where traitee_le is null do nothing
  returning id into v_demande;
  if v_demande is null then
    return;
  end if;
  insert into public.notifications as n (destinataire, message, groupe)
  select a.id,
         format('Mot de passe oublié : %s (%s) demande un code de réinitialisation.', v_compte.nom_affiche, v_compte.identifiant),
         'demandes-reinitialisation'
  from public.comptes a
  where a.id <> v_compte.id and private.acces_page_de(a.id, 'sec-pin-activation')
  on conflict (destinataire, groupe) where groupe is not null and not lue
  do update set
    nombre = n.nombre + 1,
    message = format('%s demandes de code de réinitialisation en attente.', n.nombre + 1),
    cree_le = now();
end;
$$;

revoke execute on function
  public.connexion_preparer(text), public.connexion_echec(text), public.connexion_reussie(uuid, text),
  public.installation_enregistrer(uuid, text, text, text, text, text, date, date, text),
  public.compte_enregistrer(uuid, uuid, text, text, text, text, text, text, text, text),
  public.code_pin_utiliser(text, text), public.mot_de_passe_definitif(uuid, text),
  public.demande_reinitialisation(text)
  from public, anon, authenticated;
grant execute on function
  public.connexion_preparer(text), public.connexion_echec(text), public.connexion_reussie(uuid, text),
  public.installation_enregistrer(uuid, text, text, text, text, text, date, date, text),
  public.compte_enregistrer(uuid, uuid, text, text, text, text, text, text, text, text),
  public.code_pin_utiliser(text, text), public.mot_de_passe_definitif(uuid, text),
  public.demande_reinitialisation(text)
  to service_role;

-- ——— 8. Fonctions de l'administration (session de l'administrateur) ——————————————————————————

create function private.exiger_compte_gerable(p_cible uuid)
returns public.comptes
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_cible public.comptes;
begin
  select * into v_cible from public.comptes c where c.id = p_cible;
  if not found then
    raise exception 'Compte introuvable.' using errcode = 'no_data_found';
  end if;
  if not private.peut_gerer_compte((select auth.uid()), p_cible) then
    raise exception 'Ce compte a un accès complet : seul un administrateur à accès complet peut le modifier.'
      using errcode = 'insufficient_privilege';
  end if;
  return v_cible;
end;
$$;
revoke execute on function private.exiger_compte_gerable(uuid) from public, anon, authenticated;

-- Fiche d'un compte : jamais l'identifiant (sert à la connexion) ni le type de compte ; le rôle
-- d'un compte d'administration, oui, avec les garde-fous.
create function public.modifier_compte(
  p_compte uuid,
  p_nom_affiche text,
  p_email text,
  p_telephone text,
  p_fonction text,
  p_role_id text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_cible public.comptes;
  v_role text := nullif(trim(coalesce(p_role_id, '')), '');
begin
  if not private.acces_page_de(v_moi, 'sec-users') then
    raise exception 'Vous n''avez pas accès à la gestion des comptes.' using errcode = 'insufficient_privilege';
  end if;
  v_cible := private.exiger_compte_gerable(p_compte);
  if trim(coalesce(p_nom_affiche, '')) = '' then
    raise exception 'Le nom du compte est obligatoire.' using errcode = 'check_violation';
  end if;
  if v_role is distinct from v_cible.role_id then
    if v_cible.type_compte <> 'administration' then
      raise exception 'Un rôle ne s''attribue qu''à un compte de l''administration.' using errcode = 'check_violation';
    end if;
    if not private.acces_complet_de(v_moi) then
      if p_compte = v_moi then
        raise exception 'Vous ne pouvez pas changer votre propre rôle.' using errcode = 'insufficient_privilege';
      end if;
      if v_role is null then
        raise exception 'Seul un administrateur à accès complet peut donner l''accès complet.' using errcode = 'insufficient_privilege';
      end if;
    end if;
    if not private.peut_attribuer_role(v_moi, v_role) then
      raise exception 'Vous ne pouvez pas attribuer un rôle qui ouvre des pages auxquelles vous n''avez pas accès.'
        using errcode = 'insufficient_privilege';
    end if;
    if v_role is not null and private.serait_dernier_acces_complet(p_compte) then
      raise exception 'C''est le dernier administrateur à accès complet : il doit le rester.' using errcode = 'check_violation';
    end if;
  end if;

  update public.comptes c set
    nom_affiche = trim(p_nom_affiche),
    email = trim(coalesce(p_email, '')),
    telephone = trim(coalesce(p_telephone, '')),
    fonction = trim(coalesce(p_fonction, '')),
    role_id = v_role
  where c.id = p_compte;
  insert into public.journal_audit (acteur, action, cible_type, cible_id)
  values (v_moi, 'update_user_account', 'compte', p_compte::text);
end;
$$;

-- Blocage / déblocage individuel de connexion (distinct de la fermeture d'un portail).
create function public.definir_compte_actif(p_compte uuid, p_actif boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
begin
  if not private.acces_page_de(v_moi, 'sec-users') then
    raise exception 'Vous n''avez pas accès à la gestion des comptes.' using errcode = 'insufficient_privilege';
  end if;
  perform private.exiger_compte_gerable(p_compte);
  if not p_actif and private.serait_dernier_acces_complet(p_compte) then
    raise exception 'C''est le dernier administrateur à accès complet : il ne peut pas être désactivé.' using errcode = 'check_violation';
  end if;
  update public.comptes c set actif = p_actif where c.id = p_compte;
  insert into public.journal_audit (acteur, action, cible_type, cible_id)
  values (v_moi, case when p_actif then 'activate_user_account' else 'deactivate_user_account' end, 'compte', p_compte::text);
end;
$$;

-- Ouvre ou ferme un portail, avec le message affiché aux comptes refusés.
create function public.definir_portail(p_type_compte text, p_ouvert boolean, p_message text default '')
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
begin
  if not private.acces_page_de(v_moi, 'sec-portails') then
    raise exception 'Vous n''avez pas accès à la gestion des portails.' using errcode = 'insufficient_privilege';
  end if;
  if p_type_compte = 'administration' and not p_ouvert then
    raise exception 'Le portail Administration ne peut pas être fermé (risque de verrouillage total).' using errcode = 'check_violation';
  end if;
  update public.portails p set ouvert = p_ouvert, message = trim(coalesce(p_message, '')), modifie_le = now(), modifie_par = v_moi
  where p.type_compte = p_type_compte;
  if not found then
    raise exception 'Portail inconnu.' using errcode = 'no_data_found';
  end if;
  insert into public.journal_audit (acteur, action, cible_type, cible_id, details)
  values (v_moi, case when p_ouvert then 'open_portal' else 'close_portal' end, 'portail', p_type_compte, nullif(trim(coalesce(p_message, '')), ''));
end;
$$;

-- Nouveau code PIN pour un compte : renvoyé une seule fois, à remettre en main propre. Les codes
-- précédents ne servent plus ; les demandes « mot de passe oublié » du compte sont réglées.
create function public.generer_code_pin(p_compte uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_code text;
  v_id bigint;
  v_expire timestamptz := now() + interval '24 hours';
begin
  if not (private.acces_page_de(v_moi, 'sec-pin-activation') or private.acces_page_de(v_moi, 'sec-users')) then
    raise exception 'Vous n''avez pas accès aux codes PIN.' using errcode = 'insufficient_privilege';
  end if;
  perform private.exiger_compte_gerable(p_compte);
  -- Tirage cryptographique (random() serait prévisible).
  v_code := (100000 + ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 900000)::text;
  insert into public.codes_pin (compte, code_chiffre, expire_le, auteur)
  values (p_compte, extensions.crypt(v_code, extensions.gen_salt('bf', 8)), v_expire, v_moi)
  returning id into v_id;
  update public.demandes_reinitialisation d set traitee_le = now(), traitee_par = v_moi
  where d.compte = p_compte and d.traitee_le is null;
  insert into public.journal_audit (acteur, action, cible_type, cible_id)
  values (v_moi, 'generate_pin', 'compte', p_compte::text);
  return jsonb_build_object('id', v_id, 'code', v_code, 'expire_le', v_expire);
end;
$$;

-- Annule un code encore actif (remis par erreur, compte compromis).
create function public.revoquer_code_pin(p_code bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_statut text;
  v_compte uuid;
begin
  if not (private.acces_page_de(v_moi, 'sec-pin-activation') or private.acces_page_de(v_moi, 'sec-users')) then
    raise exception 'Vous n''avez pas accès aux codes PIN.' using errcode = 'insufficient_privilege';
  end if;
  select s.statut, s.compte into v_statut, v_compte from public.codes_pin_suivi s where s.id = p_code;
  if v_statut is distinct from 'actif' then
    raise exception 'Seul un code actif peut être révoqué.' using errcode = 'check_violation';
  end if;
  perform private.exiger_compte_gerable(v_compte);
  update public.codes_pin p set revoque_le = now(), revoque_par = v_moi where p.id = p_code;
  insert into public.journal_audit (acteur, action, cible_type, cible_id)
  values (v_moi, 'revoke_pin', 'compte', v_compte::text);
end;
$$;

revoke execute on function
  public.modifier_compte(uuid, text, text, text, text, text), public.definir_compte_actif(uuid, boolean),
  public.definir_portail(text, boolean, text), public.generer_code_pin(uuid), public.revoquer_code_pin(bigint)
  from public, anon;
grant execute on function
  public.modifier_compte(uuid, text, text, text, text, text), public.definir_compte_actif(uuid, boolean),
  public.definir_portail(text, boolean, text), public.generer_code_pin(uuid), public.revoquer_code_pin(bigint)
  to authenticated;

-- ——— 9. Droits et règles d'accès ——————————————————————————————————————————————————————————

alter table public.portails enable row level security;
alter table private.tentatives_connexion enable row level security;
alter table public.codes_pin enable row level security;
alter table public.demandes_reinitialisation enable row level security;

-- Portails : lus par tous les comptes connectés (bandeau « portail fermé »), modifiés seulement
-- par public.definir_portail.
grant select on public.portails to authenticated;
create policy portails_lecture on public.portails for select to authenticated using (true);

-- Codes PIN : historique lu par qui gère les codes, jamais le code chiffré.
grant select (id, compte, cree_le, expire_le, auteur, utilise_le, revoque_le, revoque_par, revoque_motif, essais_echoues)
  on public.codes_pin to authenticated;
create policy codes_pin_lecture on public.codes_pin for select to authenticated
  using ((select private.a_acces_page('sec-pin-activation')) or (select private.a_acces_page('sec-users')));
grant select on public.codes_pin_suivi to authenticated;

-- Demandes « mot de passe oublié » : lues par qui gère les codes.
grant select on public.demandes_reinitialisation to authenticated;
create policy demandes_reinitialisation_lecture on public.demandes_reinitialisation for select to authenticated
  using ((select private.a_acces_page('sec-pin-activation')) or (select private.a_acces_page('sec-users')));

-- Fonctions serveur (clé secrète).
grant select, update on public.portails to service_role;
grant select, insert, update, delete on private.tentatives_connexion to service_role;
grant select, insert, update on public.codes_pin to service_role;
grant select, insert, update on public.demandes_reinitialisation to service_role;
grant select on public.codes_pin_suivi to service_role;
