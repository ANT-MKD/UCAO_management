-- Partie 8, lot 3 : actualités, ressources pédagogiques et purge des notifications.
--
-- 1. Actualités (bannières des portails) : la page « Publicité et actualité » les rédige, avec une
--    image rangée dans l'espace de fichiers « actualites » ; chaque compte lit celles de son portail
--    (ou de tous) qui ne sont pas terminées ; l'administration les lit toutes. La base inscrit
--    l'auteur et la date.
-- 2. Ressources pédagogiques : le professeur dépose un fichier (espace « ressources ») ou un lien
--    pour une de ses classes ; les étudiants de la classe, ses professeurs et l'administration les
--    lisent ; seul leur auteur (ou l'administration) les retire. La base prévient les étudiants de
--    la classe, en direct.
-- 3. Les notifications lues depuis plus de 90 jours (et non rangées) sont purgées chaque nuit.

-- ——— 1. Actualités ————————————————————————————————————————————————————————————————————————

create table public.actualites (
  id text primary key check (length(id) between 1 and 100),
  type_contenu text not null check (type_contenu in ('image', 'video', 'document', 'url')),
  profil_cible text not null check (profil_cible in ('tous', 'student', 'teacher', 'admin')),
  titre text not null check (length(trim(titre)) between 1 and 200),
  description text not null default '' check (length(description) <= 2000),
  ordre integer not null default 0,
  date_debut date not null,
  date_fin date not null,
  -- Image : <actualité>/<fichier> dans l'espace « actualites » ; vidéo, document, lien : adresse web.
  image_chemin text,
  lien_externe text check (lien_externe is null or lien_externe ~* '^https?://'),
  auteur_id uuid references public.comptes (id) on delete set null,
  auteur_label text not null default '',
  cree_le timestamptz not null default now(),
  constraint actualites_dates check (date_debut <= date_fin),
  constraint actualites_image_rangee check (image_chemin is null or starts_with(image_chemin, id || '/')),
  constraint actualites_contenu check (
    (type_contenu = 'image' and image_chemin is not null) or (type_contenu <> 'image' and lien_externe is not null))
);
comment on table public.actualites is 'Actualités et publicités affichées en bannière des portails.';
create index actualites_auteur_id_idx on public.actualites (auteur_id);
create index actualites_image_idx on public.actualites (image_chemin);

-- L'auteur est le compte qui enregistre ; la date de création ne change plus.
create function private.signer_actualite()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.auteur_id := (select auth.uid());
  new.auteur_label := coalesce((select c.nom_affiche from public.comptes c where c.id = (select auth.uid())), new.auteur_label);
  if tg_op = 'INSERT' then
    new.cree_le := now();
  else
    new.cree_le := old.cree_le;
  end if;
  return new;
end;
$$;
revoke execute on function private.signer_actualite() from public, anon, authenticated;
create trigger actualites_signature before insert or update on public.actualites
  for each row execute function private.signer_actualite();

-- Portail du compte connecté, dans les termes de l'application (student, teacher, admin).
create function private.profil_courant()
returns text
language sql stable security definer set search_path = ''
as $$
  select case (select private.type_compte_courant())
    when 'administration' then 'admin' when 'enseignant' then 'teacher' when 'etudiant' then 'student' end
$$;
revoke execute on function private.profil_courant() from public, anon;
grant execute on function private.profil_courant() to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('actualites', 'actualites', false, 524288, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

create policy edumanage_actualites_lecture on storage.objects for select to authenticated
  using (bucket_id = 'actualites' and (select private.type_compte_courant()) is not null);
create policy edumanage_actualites_depot on storage.objects for insert to authenticated
  with check (bucket_id = 'actualites' and array_length(storage.foldername(name), 1) = 1
              and (select private.a_acces_page('com-publicite')));

-- ——— 2. Ressources pédagogiques —————————————————————————————————————————————————————————————

create table public.ressources_pedagogiques (
  id text primary key check (length(id) between 1 and 100),
  classe_id text not null references public.classes (id) on delete cascade,
  classe text not null default '',
  ec_id text references public.ecs (id) on delete set null,
  ec text,
  titre text not null check (length(trim(titre)) between 1 and 200),
  description text check (length(description) <= 2000),
  -- Fichier : <classe>/<ressource>/<fichier> dans l'espace « ressources » ; ou bien un lien.
  nom text,
  fichier_chemin text,
  taille_octets integer check (taille_octets is null or taille_octets >= 0),
  url text check (url is null or url ~* '^https?://'),
  ajoute_le timestamptz not null default now(),
  ajoute_par text not null default '',
  ajoute_par_id uuid references public.comptes (id) on delete set null,
  constraint ressources_fichier_ou_lien check ((fichier_chemin is null) <> (url is null)),
  constraint ressources_fichier_range check (fichier_chemin is null or starts_with(fichier_chemin, classe_id || '/' || id || '/'))
);
comment on table public.ressources_pedagogiques is 'Supports de cours déposés par les professeurs pour leurs classes.';
create index ressources_pedagogiques_classe_idx on public.ressources_pedagogiques (classe_id, ajoute_le desc);
create index ressources_pedagogiques_ec_idx on public.ressources_pedagogiques (ec_id);
create index ressources_pedagogiques_auteur_idx on public.ressources_pedagogiques (ajoute_par_id);
create index ressources_pedagogiques_fichier_idx on public.ressources_pedagogiques (fichier_chemin);

-- Déposée au nom de son auteur, datée par la base ; une ressource ne se modifie pas (on la retire).
create function private.signer_ressource()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.ajoute_par_id := (select auth.uid());
  new.ajoute_par := coalesce((select c.nom_affiche from public.comptes c where c.id = (select auth.uid())), new.ajoute_par);
  new.ajoute_le := now();
  return new;
end;
$$;
revoke execute on function private.signer_ressource() from public, anon, authenticated;
create trigger ressources_pedagogiques_signature before insert on public.ressources_pedagogiques
  for each row execute function private.signer_ressource();

-- Nouvelle ressource : les étudiants de la classe (pas ceux qui ont abandonné) sont prévenus.
create function private.suivre_ressource()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_compte uuid;
begin
  for v_compte in
    select c.id from public.comptes c join public.etudiants e on e.id = c.lien_id
    where c.type_compte = 'etudiant' and c.actif and e.classe_id = new.classe_id and e.statut <> 'abandon'
  loop
    perform private.envoyer_notification(v_compte, format('Nouvelle ressource pédagogique%s : « %s ».',
      case when nullif(trim(coalesce(new.ec, '')), '') is not null then ' en ' || new.ec else '' end, new.titre));
  end loop;
  return null;
end;
$$;
revoke execute on function private.suivre_ressource() from public, anon, authenticated;
create trigger ressources_pedagogiques_suivi after insert on public.ressources_pedagogiques
  for each row execute function private.suivre_ressource();

-- Qui lit les ressources d'une classe : l'administration, ses professeurs, ses étudiants.
create function private.lit_ressources(p_classe text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select private.est_administration())
    or p_classe = any (private.classes_enseignant())
    or p_classe = (select private.classe_etudiant()), false)
$$;
revoke execute on function private.lit_ressources(text) from public, anon;
grant execute on function private.lit_ressources(text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('ressources', 'ressources', false, 1048576, null);

create policy edumanage_ressources_lecture on storage.objects for select to authenticated
  using (bucket_id = 'ressources' and array_length(storage.foldername(name), 1) = 2
         and private.lit_ressources((storage.foldername(name))[1]));
create policy edumanage_ressources_depot on storage.objects for insert to authenticated
  with check (bucket_id = 'ressources' and array_length(storage.foldername(name), 1) = 2
              and ((storage.foldername(name))[1] = any (private.classes_enseignant()) or (select private.est_administration())));

-- ——— 3. Fichiers orphelins : images des actualités et fichiers des ressources aussi ———————————

create or replace function private.fichier_orphelin(p_espace text, p_chemin text, p_proprietaire text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case p_espace
      when 'photos' then not exists (select 1 from public.etudiants_dossiers d where d.photo_chemin = p_chemin)
                     and not exists (select 1 from public.enseignants_dossiers d where d.photo_chemin = p_chemin)
      when 'pieces' then not exists (select 1 from public.pieces_etudiants p where p.fichier = p_chemin or p.en_verification = p_chemin)
      when 'cahiers' then not exists (select 1 from public.cahiers_fichiers f where f.chemin = p_chemin)
      when 'justificatifs' then not exists (select 1 from public.absences_enseignants a where a.justificatif_piece = p_chemin)
      when 'demandes' then not exists (select 1 from public.demandes_etudiants d where d.piece_chemin = p_chemin)
      when 'actualites' then not exists (select 1 from public.actualites a where a.image_chemin = p_chemin)
      when 'ressources' then not exists (select 1 from public.ressources_pedagogiques r where r.fichier_chemin = p_chemin)
      else false
    end
    and (p_proprietaire = auth.uid()::text
         or (p_espace = 'cahiers' and private.a_acces_une_page(array['scol-ass-cahier', 'edt-grille'])
             and not exists (select 1 from public.cahiers c where c.id = split_part(p_chemin, '/', 1)))
         or (p_espace = 'actualites' and private.a_acces_page('com-publicite'))
         or (p_espace = 'ressources' and private.est_administration()))
$$;

drop policy edumanage_fichiers_orphelins_lecture on storage.objects;
drop policy edumanage_fichiers_orphelins_suppression on storage.objects;
create policy edumanage_fichiers_orphelins_lecture on storage.objects for select to authenticated
  using (bucket_id in ('photos', 'pieces', 'cahiers', 'justificatifs', 'demandes', 'actualites', 'ressources')
         and private.fichier_orphelin(bucket_id, name, owner_id));
create policy edumanage_fichiers_orphelins_suppression on storage.objects for delete to authenticated
  using (bucket_id in ('photos', 'pieces', 'cahiers', 'justificatifs', 'demandes', 'actualites', 'ressources')
         and private.fichier_orphelin(bucket_id, name, owner_id));

-- ——— 4. Droits, journal, compteurs et diffusion ——————————————————————————————————————————————

alter table public.actualites enable row level security;
alter table public.ressources_pedagogiques enable row level security;

grant select, insert, update, delete on public.actualites to authenticated;
create policy actualites_lecture on public.actualites for select to authenticated
  using ((select private.est_administration())
         or ((select private.type_compte_courant()) is not null and profil_cible in ('tous', (select private.profil_courant()))
             and date_fin >= current_date));
create policy actualites_redaction on public.actualites for insert to authenticated
  with check ((select private.a_acces_page('com-publicite')));
create policy actualites_modification on public.actualites for update to authenticated
  using ((select private.a_acces_page('com-publicite'))) with check ((select private.a_acces_page('com-publicite')));
create policy actualites_retrait on public.actualites for delete to authenticated
  using ((select private.a_acces_page('com-publicite')));

grant select, insert, delete on public.ressources_pedagogiques to authenticated;
create policy ressources_pedagogiques_lecture on public.ressources_pedagogiques for select to authenticated
  using (private.lit_ressources(classe_id));
create policy ressources_pedagogiques_depot on public.ressources_pedagogiques for insert to authenticated
  with check (classe_id = any (private.classes_enseignant()) or (select private.est_administration()));
create policy ressources_pedagogiques_retrait on public.ressources_pedagogiques for delete to authenticated
  using (ajoute_par_id = (select auth.uid()) or (select private.est_administration()));

create trigger actualites_journal after insert or update or delete on public.actualites
  for each row execute function private.journaliser_modification();
create trigger ressources_pedagogiques_journal after insert or delete on public.ressources_pedagogiques
  for each row execute function private.journaliser_modification();
select private.suivre_table('actualites');
select private.suivre_table('ressources_pedagogiques');
-- En direct : les étudiants de la classe voient arriver la ressource (leur notification aussi).
select private.diffuser_table('ressources_pedagogiques', array['classe:classe_id']);

-- ——— 5. Purge nocturne des notifications ————————————————————————————————————————————————————
-- Avec pg_cron (Supabase), chaque nuit à 3 h 17 ; sans lui (base de test), rien n'est programmé.
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    grant usage on schema cron to postgres;
    grant all privileges on all tables in schema cron to postgres;
    perform cron.schedule('edumanage-purge-notifications', '17 3 * * *', 'select private.purger_notifications()');
  end if;
end
$$;
