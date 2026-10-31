-- Partie 8, lot 1 : communication en direct — diffusion des changements, annuaire, messages et
-- mails envoyés.
--
-- 1. En direct. Dès qu'une écriture est enregistrée, la base prévient elle-même les postes
--    concernés (diffusion « depuis la base » de Supabase Realtime) : chaque compte écoute son canal
--    privé « compte:<identifiant> », l'administration aussi le canal « administration ». Le message
--    ne dit que le nom de la table qui a changé ; le poste la relit selon ses propres droits. Un
--    compte n'écoute que son canal (l'administration, aussi le sien) et personne n'écrit dans un
--    canal. Le suivi toutes les 30 secondes reste en secours (connexion coupée…).
-- 2. Annuaire : chaque compte connaît le nom des comptes à qui il peut écrire (l'administration ;
--    pour un professeur, les étudiants de ses classes ; pour un étudiant, les professeurs de sa
--    classe) et de ceux qui lui ont écrit, sans leurs coordonnées. L'administration les connaît tous.
-- 3. Messages : chacun ne lit que ses messages, n'écrit qu'en son nom et à qui il peut écrire ;
--    seul le destinataire marque un message lu ; un message envoyé ne change plus et ne se supprime
--    pas. La base prévient le destinataire.
-- 4. Mails envoyés (administration) : un mail part tout de suite si son auteur est validateur
--    désigné (ou s'il n'y en a aucun), sinon il attend ; seul un validateur le valide ou le rejette,
--    une fois. Au départ, la base le dépose elle-même dans la messagerie de chaque destinataire qui a
--    un compte (ou le prévient, pour un mail du système) ; au rejet, elle prévient l'auteur et les
--    destinataires des alertes. La relance de paiement inscrit elle-même son mail.

-- ——— 1. Diffusion en direct ——————————————————————————————————————————————————————————————————

-- Envoi d'une diffusion (un message privé « changement » qui ne dit que le nom de la table). Tant
-- que Realtime n'a pas démarré sur le projet, l'envoi est simplement perdu (le suivi toutes les
-- 30 secondes prend le relais) ; l'écriture, elle, n'échoue jamais.
create function private.envoyer_diffusion(p_canal text, p_table text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('table', p_table), 'changement', p_canal, true);
end;
$$;
revoke execute on function private.envoyer_diffusion(text, text) from public, anon, authenticated;

-- Prévient un canal qu'une table a changé, une seule fois par canal et par table dans une même
-- transaction (une publication de 500 notes ne fait qu'un message). La diffusion part à la
-- validation de la transaction ; rien ne part si elle est annulée.
create function private.diffuser(p_canal text, p_table text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_cle text := '|' || p_canal || '#' || p_table || '|';
  v_deja text := coalesce(current_setting('edumanage.diffusions', true), '');
begin
  if p_canal is null or strpos(v_deja, v_cle) > 0 then
    return;
  end if;
  perform set_config('edumanage.diffusions', v_deja || v_cle, true);
  perform private.envoyer_diffusion(p_canal, p_table);
end;
$$;
revoke execute on function private.diffuser(text, text) from public, anon, authenticated;

-- Déclencheur : chaque argument désigne qui prévenir, d'après la ligne écrite (avant et après) :
--   « administration »          : le canal de l'administration ;
--   « compte:<colonne> »        : le compte désigné par cette colonne ;
--   « etudiant:<colonne> »      : le compte de l'étudiant (dossier) désigné ;
--   « enseignant:<colonne> »    : le compte du professeur (fiche) désigné ;
--   « classe:<colonne> »        : les comptes des étudiants de la classe désignée.
create function private.diffuser_changement()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ligne jsonb;
  v_arg text;
  v_genre text;
  v_valeur text;
  v_compte uuid;
begin
  foreach v_ligne in array array[
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    case when tg_op <> 'INSERT' then to_jsonb(old) end]
  loop
    continue when v_ligne is null;
    foreach v_arg in array tg_argv
    loop
      v_genre := split_part(v_arg, ':', 1);
      if v_genre = 'administration' then
        perform private.diffuser('administration', tg_table_name);
        continue;
      end if;
      v_valeur := v_ligne ->> split_part(v_arg, ':', 2);
      continue when v_valeur is null;
      if v_genre = 'compte' then
        perform private.diffuser('compte:' || v_valeur, tg_table_name);
      elsif v_genre in ('etudiant', 'enseignant') then
        for v_compte in select c.id from public.comptes c where c.type_compte = v_genre and c.lien_id = v_valeur
        loop
          perform private.diffuser('compte:' || v_compte, tg_table_name);
        end loop;
      elsif v_genre = 'classe' then
        for v_compte in
          select c.id from public.comptes c join public.etudiants e on e.id = c.lien_id
          where c.type_compte = 'etudiant' and e.classe_id = v_valeur
        loop
          perform private.diffuser('compte:' || v_compte, tg_table_name);
        end loop;
      end if;
    end loop;
  end loop;
  return null;
end;
$$;
revoke execute on function private.diffuser_changement() from public, anon, authenticated;

-- Pose les déclencheurs de diffusion d'une table. Avec des colonnes suivies, une modification ne
-- prévient que si l'une d'elles change (ex. le statut d'un cahier, pas son texte en cours de saisie).
create function private.diffuser_table(p_table text, p_canaux text[], p_colonnes text[] default null)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_args text := (select string_agg(quote_literal(c), ', ') from unnest(p_canaux) c);
begin
  if p_colonnes is null then
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.diffuser_changement(%s)',
      p_table || '_en_direct', p_table, v_args);
  else
    execute format('create trigger %I after insert or delete on public.%I for each row execute function private.diffuser_changement(%s)',
      p_table || '_en_direct', p_table, v_args);
    execute format('create trigger %I after update of %s on public.%I for each row when (%s) execute function private.diffuser_changement(%s)',
      p_table || '_en_direct_suivi', (select string_agg(quote_ident(c), ', ') from unnest(p_colonnes) c), p_table,
      (select string_agg(format('old.%1$I is distinct from new.%1$I', c), ' or ') from unnest(p_colonnes) c), v_args);
  end if;
end;
$$;
revoke execute on function private.diffuser_table(text, text[], text[]) from public, anon, authenticated;

-- Écoute : un compte actif rejoint son propre canal ; l'administration, aussi le sien. Aucune règle
-- d'écriture : seule la base diffuse.
create policy edumanage_en_direct_ecoute on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select private.type_compte_courant()) is not null
    and ((select realtime.topic()) = 'compte:' || (select auth.uid())::text
         or ((select realtime.topic()) = 'administration' and (select private.est_administration())))
  );

-- ——— 2. Messages ——————————————————————————————————————————————————————————————————————————————

create table public.messages (
  id text primary key check (length(id) between 1 and 200),
  expediteur uuid not null references public.comptes (id) on delete cascade,
  destinataire uuid not null references public.comptes (id) on delete cascade,
  objet text not null check (length(trim(objet)) between 1 and 300),
  contenu text not null check (length(trim(contenu)) between 1 and 50000),
  cree_le timestamptz not null default now(),
  lu boolean not null default false,
  lu_le timestamptz,
  -- Message déposé par un mail de l'administration (section 4).
  mail_id text,
  constraint messages_deux_comptes check (expediteur <> destinataire)
);
comment on table public.messages is 'Messagerie des trois portails : un message, son expéditeur, son destinataire.';
create index messages_destinataire_idx on public.messages (destinataire, cree_le desc);
create index messages_expediteur_idx on public.messages (expediteur, cree_le desc);
create index messages_mail_id_idx on public.messages (mail_id);

-- Professeurs d'une classe : un créneau d'emploi du temps, une évaluation, ou la responsabilité d'un
-- EC de la filière et du niveau de la classe (comme comptesProfsDeLaClasse dans l'application).
create function private.enseignants_classe(p_classe text)
returns setof text
language sql stable security definer set search_path = ''
as $$
  select s.prof_id from public.seances s where s.classe_id = p_classe and s.prof_id is not null
  union
  select v.professeur_id from public.evaluations v where v.classe_id = p_classe and v.professeur_id is not null
  union
  select e.responsable_id
  from public.ecs e
  join public.ues u on u.id = e.ue_id
  join public.classes k on k.filiere_id = u.filiere_id and k.niveau = u.niveau
  where k.id = p_classe and e.responsable_id is not null
$$;
revoke execute on function private.enseignants_classe(text) from public, anon;
grant execute on function private.enseignants_classe(text) to authenticated, service_role;

-- Le compte connecté peut-il écrire à ce compte ? L'administration écrit à tous et tous lui
-- écrivent ; un professeur écrit aux étudiants de ses classes (pas à ceux qui ont abandonné ou sont
-- suspendus), un étudiant aux professeurs de sa classe ; chacun répond à qui lui a écrit.
create function private.peut_ecrire_a(p_destinataire uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.comptes c
    where c.id = p_destinataire and c.actif and c.id <> (select auth.uid())
      and (select private.type_compte_courant()) is not null
      and (
        (select private.est_administration())
        or c.type_compte = 'administration'
        or ((select private.type_compte_courant()) = 'enseignant' and c.type_compte = 'etudiant'
            and exists (select 1 from public.etudiants e
                        where e.id = c.lien_id and e.classe_id = any (private.classes_enseignant())
                          and e.statut not in ('abandon', 'suspendu')))
        or ((select private.type_compte_courant()) = 'etudiant' and c.type_compte = 'enseignant'
            and c.lien_id in (select private.enseignants_classe(private.classe_etudiant())))
        or exists (select 1 from public.messages m where m.expediteur = c.id and m.destinataire = (select auth.uid()))
      )
  )
$$;
revoke execute on function private.peut_ecrire_a(uuid) from public, anon;
grant execute on function private.peut_ecrire_a(uuid) to authenticated, service_role;

-- Un message est daté par la base et part non lu ; ensuite, seul « lu » change, et une seule fois.
create function private.controler_message()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.cree_le := now();
    new.lu := false;
    new.lu_le := null;
    return new;
  end if;
  if (new.id, new.expediteur, new.destinataire, new.objet, new.contenu, new.cree_le, new.mail_id)
     is distinct from (old.id, old.expediteur, old.destinataire, old.objet, old.contenu, old.cree_le, old.mail_id) then
    raise exception 'Un message envoyé ne se modifie plus.' using errcode = 'check_violation';
  end if;
  if old.lu then
    new.lu := true;
    new.lu_le := old.lu_le;
  elsif new.lu then
    new.lu_le := now();
  else
    new.lu_le := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_message() from public, anon, authenticated;
create trigger messages_controle before insert or update on public.messages
  for each row execute function private.controler_message();

create function private.suivre_message()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.envoyer_notification(new.destinataire, 'Nouveau message: ' || new.objet);
  return null;
end;
$$;
revoke execute on function private.suivre_message() from public, anon, authenticated;
create trigger messages_suivi after insert on public.messages
  for each row execute function private.suivre_message();

-- ——— 3. Annuaire ————————————————————————————————————————————————————————————————————————————

-- Comptes que le compte connecté peut nommer : lui-même, ceux à qui il peut écrire, ceux avec qui il
-- a échangé. Sans coordonnées (sauf pour l'administration, qui lit déjà tous les comptes).
create function public.annuaire()
returns table (id uuid, type_compte text, nom_affiche text, fonction text, lien_id text, actif boolean, email text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_type text := (select private.type_compte_courant());
begin
  if v_type is null then
    raise exception 'Connectez-vous avec un compte actif.' using errcode = 'insufficient_privilege';
  end if;
  if v_type = 'administration' then
    return query select c.id, c.type_compte, c.nom_affiche, c.fonction, c.lien_id, c.actif, c.email from public.comptes c order by c.id;
    return;
  end if;
  return query
    select c.id, c.type_compte, c.nom_affiche, case when c.type_compte = 'administration' then c.fonction else '' end,
      c.lien_id, c.actif, case when c.id = v_moi then c.email else '' end
    from public.comptes c
    where c.id = v_moi
      or (c.actif and c.type_compte = 'administration')
      or (v_type = 'enseignant' and c.actif and c.type_compte = 'etudiant'
          and c.lien_id in (select e.id from public.etudiants e
                            where e.classe_id = any (private.classes_enseignant()) and e.statut not in ('abandon', 'suspendu')))
      or (v_type = 'etudiant' and c.actif and c.type_compte = 'enseignant'
          and c.lien_id in (select private.enseignants_classe(private.classe_etudiant())))
      or c.id in (select m.expediteur from public.messages m where m.destinataire = v_moi)
      or c.id in (select m.destinataire from public.messages m where m.expediteur = v_moi)
    order by c.id;
end;
$$;
comment on function public.annuaire() is 'Comptes que le compte connecté peut nommer dans sa messagerie.';
revoke execute on function public.annuaire() from public, anon;
grant execute on function public.annuaire() to authenticated, service_role;

-- ——— 4. Mails envoyés ————————————————————————————————————————————————————————————————————————

create table public.mails_envoyes (
  id text primary key check (length(id) between 1 and 100),
  -- Compte de l'auteur, ou « system » (identifiants, relances).
  auteur_id text not null check (auteur_id = 'system' or auteur_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  auteur_label text not null default '',
  cree_le timestamptz not null default now(),
  -- Ce que l'auteur a choisi (groupes, comptes) et la liste résolue au moment de l'envoi.
  selections jsonb not null default '[]' check (jsonb_typeof(selections) = 'array'),
  destinataires jsonb not null default '[]' check (jsonb_typeof(destinataires) = 'array'),
  emails_supplementaires text[] not null default '{}',
  objet text not null check (length(trim(objet)) between 1 and 300),
  message text not null check (length(message) <= 50000),
  fichiers text[] not null default '{}',
  statut text not null check (statut in ('en_attente_validation', 'traite', 'rejete')),
  validateur_id text,
  validateur_label text,
  date_traitement timestamptz,
  motif_rejet text
);
comment on table public.mails_envoyes is 'Mails rédigés par l''administration ou le système, leur validation et leurs destinataires.';
create index mails_envoyes_cree_le_idx on public.mails_envoyes (cree_le desc);

alter table public.messages
  add constraint messages_mail_id_fkey foreign key (mail_id) references public.mails_envoyes (id) on delete set null;

-- Validation active : au moins un validateur désigné ; le compte connecté peut-il valider ?
create function private.peut_valider_mail()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select private.est_administration())
    and (not exists (select 1 from public.roles_communication r where r.role = 'validateur_message')
         or exists (select 1 from public.roles_communication r where r.role = 'validateur_message' and r.compte_id = (select auth.uid())))
$$;
revoke execute on function private.peut_valider_mail() from public, anon;
grant execute on function private.peut_valider_mail() to authenticated, service_role;

create function private.controler_mail()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_nom text := (select c.nom_affiche from public.comptes c where c.id = (select auth.uid()));
begin
  if tg_op = 'INSERT' then
    -- Mail déjà enregistré (renvoi complet de la ligne) : la modification suit ses propres règles.
    if exists (select 1 from public.mails_envoyes m where m.id = new.id) then
      return new;
    end if;
    if not private.est_administration() then
      raise exception 'Seule l''administration envoie des mails.' using errcode = 'insufficient_privilege';
    end if;
    new.cree_le := now();
    if new.auteur_id = 'system' then
      new.auteur_label := 'Système';
      new.statut := 'traite';
      new.validateur_id := 'system';
      new.validateur_label := 'Système';
      new.date_traitement := now();
      new.motif_rejet := null;
      return new;
    end if;
    if v_moi is null or new.auteur_id <> v_moi::text then
      raise exception 'Un mail part au nom de son auteur.' using errcode = 'insufficient_privilege';
    end if;
    new.auteur_label := coalesce(v_nom, new.auteur_label);
    if new.statut = 'rejete' then
      raise exception 'Un mail ne se rejette qu''après son envoi.' using errcode = 'check_violation';
    elsif new.statut = 'traite' and not private.peut_valider_mail() then
      raise exception 'Ce mail doit être validé par un validateur désigné (Paramétrage de la communication).' using errcode = 'check_violation';
    end if;
    if new.statut = 'traite' then
      new.validateur_id := v_moi::text;
      new.validateur_label := new.auteur_label;
      new.date_traitement := now();
    else
      new.validateur_id := null;
      new.validateur_label := null;
      new.date_traitement := null;
    end if;
    new.motif_rejet := null;
    return new;
  end if;

  if (new.id, new.auteur_id, new.auteur_label, new.cree_le, new.selections, new.destinataires, new.emails_supplementaires,
      new.objet, new.message, new.fichiers)
     is distinct from (old.id, old.auteur_id, old.auteur_label, old.cree_le, old.selections, old.destinataires, old.emails_supplementaires,
      old.objet, old.message, old.fichiers) then
    raise exception 'Un mail envoyé ne se modifie plus.' using errcode = 'check_violation';
  end if;
  if old.statut <> 'en_attente_validation' then
    if (new.statut, new.validateur_id, new.validateur_label, new.date_traitement, new.motif_rejet)
       is distinct from (old.statut, old.validateur_id, old.validateur_label, old.date_traitement, old.motif_rejet) then
      raise exception 'Ce mail a déjà été traité.' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if new.statut = 'en_attente_validation' then
    new.validateur_id := null;
    new.validateur_label := null;
    new.date_traitement := null;
    new.motif_rejet := null;
    return new;
  end if;
  if not private.peut_valider_mail() then
    raise exception 'Seul un validateur désigné (Paramétrage de la communication) peut valider ou rejeter un mail.' using errcode = 'insufficient_privilege';
  end if;
  new.validateur_id := v_moi::text;
  new.validateur_label := coalesce(v_nom, new.validateur_label);
  new.date_traitement := now();
  if new.statut = 'traite' then
    new.motif_rejet := null;
  else
    new.motif_rejet := nullif(trim(coalesce(new.motif_rejet, '')), '');
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_mail() from public, anon, authenticated;
create trigger mails_envoyes_controle before insert or update on public.mails_envoyes
  for each row execute function private.controler_mail();

-- Départ d'un mail : déposé dans la messagerie de chaque destinataire qui a un compte (il peut y
-- répondre) ; un mail du système, sans auteur à qui répondre, est une simple notification. Au
-- rejet : l'auteur et les destinataires des alertes sont prévenus.
create function private.suivre_mail()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_auteur uuid;
  v_dest uuid;
  v_contenu text;
  v_alerte uuid;
begin
  if new.statut = 'traite' and (tg_op = 'INSERT' or old.statut <> 'traite') then
    -- Mail que la base a déjà annoncé elle-même (relance de paiement) : seulement inscrit.
    if current_setting('edumanage.mail_annonce', true) = new.id then
      return null;
    end if;
    if new.auteur_id <> 'system' then
      select c.id into v_auteur from public.comptes c where c.id = new.auteur_id::uuid;
    end if;
    v_contenu := new.message || case when cardinality(new.fichiers) > 0
      then E'\n\nPièces jointes : ' || array_to_string(new.fichiers, ', ') else '' end;
    if length(trim(v_contenu)) = 0 then
      v_contenu := new.objet;
    end if;
    for v_dest in
      select distinct c.id
      from jsonb_array_elements(new.destinataires) d
      join public.comptes c on c.id::text = d ->> 'userId'
    loop
      if v_auteur is not null and v_dest <> v_auteur then
        insert into public.messages (id, expediteur, destinataire, objet, contenu, mail_id)
        values (new.id || '>' || v_dest, v_auteur, v_dest, left(new.objet, 300), left(v_contenu, 50000), new.id)
        on conflict (id) do nothing;
      else
        perform private.envoyer_notification(v_dest, 'Nouveau message : ' || new.objet);
      end if;
    end loop;
  elsif tg_op = 'UPDATE' and new.statut = 'rejete' and old.statut <> 'rejete' then
    if new.auteur_id <> 'system' then
      for v_auteur in select c.id from public.comptes c where c.id = new.auteur_id::uuid
      loop
        perform private.envoyer_notification(v_auteur, format('Votre mail "%s" a été rejeté par %s%s.', new.objet, new.validateur_label,
          case when new.motif_rejet is not null then ' — ' || new.motif_rejet else '' end));
      end loop;
    end if;
    for v_alerte in
      select distinct r.compte_id from public.roles_communication r where r.role = 'destinataire_alert'
    loop
      perform private.envoyer_notification(v_alerte, format('Mail rejeté : "%s" (auteur : %s, par %s).', new.objet, new.auteur_label, new.validateur_label));
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function private.suivre_mail() from public, anon, authenticated;
create trigger mails_envoyes_suivi after insert or update of statut on public.mails_envoyes
  for each row execute function private.suivre_mail();

-- ——— 5. Mail de la relance de paiement ————————————————————————————————————————————————————————
-- La relance prévient déjà l'étudiant (partie 7) ; son mail est désormais inscrit par la base,
-- au journal des mails, sans seconde notification.
create or replace function private.suivre_relance()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_compte record;
  v_mail text := 'relance-' || new.id;
begin
  for v_compte in
    select c.id, c.email, e.prenom, e.nom
    from public.comptes c join public.etudiants e on e.id = c.lien_id
    where c.type_compte = 'etudiant' and c.actif and c.lien_id = new.etudiant_id
  loop
    perform private.envoyer_notification(v_compte.id, format(
      'Rappel de paiement : votre dossier présente un solde impayé de %s FCFA. Régularisez-le avant le %s, faute de quoi l''accès à votre portail sera suspendu.',
      private.montant_fr(new.montant_du), to_char(new.date_echeance, 'DD/MM/YYYY')));
    perform set_config('edumanage.mail_annonce', v_mail, true);
    insert into public.mails_envoyes (id, auteur_id, objet, message, destinataires, statut)
    values (v_mail, 'system', 'Rappel de paiement — régularisation avant blocage de votre accès',
      format(E'Bonjour %s,\n\nVotre dossier présente un solde impayé de %s FCFA. Merci de régulariser votre situation avant le %s, faute de quoi l''accès à votre portail étudiant sera automatiquement suspendu.\n\nL''administration.',
        v_compte.prenom, private.montant_fr(new.montant_du), to_char(new.date_echeance, 'DD/MM/YYYY')),
      jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('label', v_compte.prenom || ' ' || v_compte.nom,
        'email', nullif(v_compte.email, ''), 'userId', v_compte.id))),
      'traite')
    on conflict (id) do nothing;
    perform set_config('edumanage.mail_annonce', '', true);
  end loop;
  return null;
end;
$$;

-- ——— 6. Droits, compteurs et diffusion ——————————————————————————————————————————————————————————

alter table public.messages enable row level security;
alter table public.mails_envoyes enable row level security;

grant select, insert, update on public.messages to authenticated;
create policy messages_lecture on public.messages for select to authenticated
  using (expediteur = (select auth.uid()) or destinataire = (select auth.uid()));
create policy messages_envoi on public.messages for insert to authenticated
  with check (expediteur = (select auth.uid()) and mail_id is null and private.peut_ecrire_a(destinataire));
create policy messages_lecture_marquee on public.messages for update to authenticated
  using (destinataire = (select auth.uid())) with check (destinataire = (select auth.uid()));

grant select, insert, update on public.mails_envoyes to authenticated;
create policy mails_envoyes_lecture on public.mails_envoyes for select to authenticated
  using ((select private.est_administration()));
create policy mails_envoyes_envoi on public.mails_envoyes for insert to authenticated
  with check ((select private.est_administration()));
create policy mails_envoyes_validation on public.mails_envoyes for update to authenticated
  using ((select private.est_administration())) with check ((select private.est_administration()));

create trigger mails_envoyes_journal after insert or update on public.mails_envoyes
  for each row execute function private.journaliser_modification();

select private.suivre_table('messages');
select private.suivre_table('mails_envoyes');

-- Qui prévenir en direct : le destinataire d'une notification ; les deux comptes d'un message ;
-- l'administration pour les mails et pour chaque file du centre « À traiter » (au changement de
-- statut seulement : un cahier en cours de saisie ne réveille personne).
select private.diffuser_table('notifications', array['compte:destinataire']);
select private.diffuser_table('messages', array['compte:destinataire', 'compte:expediteur']);
select private.diffuser_table('mails_envoyes', array['administration'], array['statut']);
select private.diffuser_table('cahiers', array['administration'], array['statut']);
select private.diffuser_table('pointages', array['administration'], array['statut']);
select private.diffuser_table('rallonges', array['administration'], array['statut']);
select private.diffuser_table('notes', array['administration'], array['statut']);
select private.diffuser_table('demandes_correction', array['administration'], array['statut']);
select private.diffuser_table('paiements_declares', array['administration'], array['statut']);
select private.diffuser_table('demandes_reinitialisation', array['administration'], array['traitee_le']);
select private.diffuser_table('pieces_etudiants', array['administration'], array['en_verification']);
select private.diffuser_table('absences_enseignants', array['administration'], array['justificatif_envoye_le', 'justifie']);
select private.diffuser_table('etudiants', array['administration'], array['statut']);
