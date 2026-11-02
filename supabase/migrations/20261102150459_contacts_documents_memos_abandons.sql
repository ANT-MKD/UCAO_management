-- Partie 9, lot 1 : les dernières données encore gardées dans le navigateur.
--
-- 1. Contacts des étudiants (père, mère, tuteur…) : lus par l'administration et par l'étudiant
--    lui-même ; tenus par les pages qui gèrent les étudiants.
-- 2. Documents des dossiers (étudiants, enseignants) : fichier rangé dans l'espace « dossiers »,
--    lus par l'administration, déposés et retirés par les pages qui gèrent ces dossiers.
-- 3. Mémos des dossiers (administratif, pédagogique, discipline) : lus et écrits par les seules
--    pages qui gèrent ces dossiers ; un mémo ne se modifie pas (on le retire).
-- 4. Abandons : la page « Abandon » fige la situation de l'étudiant ; le dossier ne se supprime
--    jamais et ne change plus, sauf pour noter la réintégration, une fois. Un seul abandon actif
--    par étudiant ; la base inscrit qui a validé.

-- Pages qui gèrent les dossiers d'un type d'entité.
create function private.gere_dossier(p_type text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case p_type
    when 'etudiant' then private.gere_etudiants()
    when 'enseignant' then private.a_acces_une_page(array['prof-liste', 'prof-ajouter'])
    else false
  end
$$;
revoke execute on function private.gere_dossier(text) from public, anon;
grant execute on function private.gere_dossier(text) to authenticated, service_role;

-- Le dossier visé existe (étudiant ou enseignant).
create function private.controler_entite_dossier()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.entite_type = 'etudiant' and not exists (select 1 from public.etudiants e where e.id = new.entite_id))
     or (new.entite_type = 'enseignant' and not exists (select 1 from public.enseignants e where e.id = new.entite_id)) then
    raise exception 'Ce dossier n''existe pas.' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_entite_dossier() from public, anon, authenticated;

-- ——— 1. Contacts des étudiants ————————————————————————————————————————————————————————————————

create table public.contacts_etudiants (
  id text primary key check (length(id) between 1 and 100),
  etudiant_id text not null references public.etudiants (id) on delete cascade,
  role text not null check (role in ('pere', 'mere', 'tuteur', 'autre')),
  nom_complet text not null check (length(trim(nom_complet)) between 1 and 200),
  telephone text,
  email text,
  adresse text,
  lien text
);
comment on table public.contacts_etudiants is 'Parents, tuteurs et autres contacts d''un étudiant.';
create index contacts_etudiants_etudiant_idx on public.contacts_etudiants (etudiant_id);

-- ——— 2. Documents des dossiers ————————————————————————————————————————————————————————————————

create table public.documents_dossiers (
  id text primary key check (length(id) between 1 and 100),
  entite_type text not null check (entite_type in ('etudiant', 'enseignant')),
  entite_id text not null,
  nom text not null check (length(trim(nom)) between 1 and 300),
  -- <etudiants|enseignants>/<dossier>/<document>/<fichier> dans l'espace « dossiers ».
  fichier_chemin text not null,
  taille_octets integer check (taille_octets is null or taille_octets >= 0),
  ajoute_le timestamptz not null default now(),
  ajoute_par text not null default '',
  constraint documents_fichier_range check (starts_with(fichier_chemin, entite_type || 's/' || entite_id || '/' || id || '/'))
);
comment on table public.documents_dossiers is 'Documents joints aux dossiers des étudiants et des enseignants.';
create index documents_dossiers_entite_idx on public.documents_dossiers (entite_type, entite_id);
create index documents_dossiers_fichier_idx on public.documents_dossiers (fichier_chemin);
create trigger documents_dossiers_entite before insert on public.documents_dossiers
  for each row execute function private.controler_entite_dossier();

-- Déposé au nom du compte qui l'ajoute, daté par la base.
create function private.signer_document()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.ajoute_le := now();
  new.ajoute_par := coalesce((select c.nom_affiche from public.comptes c where c.id = (select auth.uid())), new.ajoute_par);
  return new;
end;
$$;
revoke execute on function private.signer_document() from public, anon, authenticated;
create trigger documents_dossiers_signature before insert on public.documents_dossiers
  for each row execute function private.signer_document();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('dossiers', 'dossiers', false, 1048576, null);

-- Le dossier d'un chemin <etudiants|enseignants>/<id>/… : son type d'entité.
create function private.type_dossier(p_nom text)
returns text
language sql immutable set search_path = ''
as $$
  select case (storage.foldername(p_nom))[1] when 'etudiants' then 'etudiant' when 'enseignants' then 'enseignant' end
$$;
revoke execute on function private.type_dossier(text) from public, anon;
grant execute on function private.type_dossier(text) to authenticated, service_role;

create policy edumanage_dossiers_lecture on storage.objects for select to authenticated
  using (bucket_id = 'dossiers' and array_length(storage.foldername(name), 1) = 3 and (select private.est_administration()));
create policy edumanage_dossiers_depot on storage.objects for insert to authenticated
  with check (bucket_id = 'dossiers' and array_length(storage.foldername(name), 1) = 3
              and private.gere_dossier(private.type_dossier(name)));

-- ——— 3. Mémos des dossiers ————————————————————————————————————————————————————————————————————

create table public.memos_dossiers (
  id text primary key check (length(id) between 1 and 100),
  entite_type text not null check (entite_type in ('etudiant', 'enseignant')),
  entite_id text not null,
  type text not null check (type in ('Administratif', 'Pédagogique', 'Discipline', 'Autre')),
  date date not null default current_date,
  objet text not null check (length(trim(objet)) between 1 and 300),
  contenu text not null default '' check (length(contenu) <= 20000),
  auteur text not null default ''
);
comment on table public.memos_dossiers is 'Mémos internes des dossiers des étudiants et des enseignants.';
create index memos_dossiers_entite_idx on public.memos_dossiers (entite_type, entite_id);
create trigger memos_dossiers_entite before insert on public.memos_dossiers
  for each row execute function private.controler_entite_dossier();

-- ——— 4. Abandons ——————————————————————————————————————————————————————————————————————————

create table public.abandons (
  id text primary key check (length(id) between 1 and 100),
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  matricule text not null default '',
  nom text not null default '',
  prenom text not null default '',
  email text not null default '',
  telephone text not null default '',
  date_naissance text not null default '',
  lieu_naissance text,
  nationalite text,
  filiere text not null default '',
  filiere_id text,
  niveau text not null default '',
  classe text not null default '',
  classe_id text,
  annee text not null default '',
  sessions_abandonnees text[] not null default '{}',
  cumul_paye numeric not null default 0,
  cumul_impaye numeric not null default 0,
  statut_avant text not null default '',
  date_abandon date not null,
  motif text not null check (length(trim(motif)) between 1 and 2000),
  valide_par_id uuid references public.comptes (id) on delete set null,
  valide_par_label text not null default '',
  reintegre boolean not null default false,
  date_reintegration date,
  reintegre_par_label text,
  constraint abandons_reintegration check (reintegre = (date_reintegration is not null))
);
comment on table public.abandons is 'Dossiers d''abandon : situation figée de l''étudiant, puis sa réintégration éventuelle.';
create index abandons_etudiant_idx on public.abandons (etudiant_id);
create index abandons_valide_par_idx on public.abandons (valide_par_id);
create unique index abandons_un_actif on public.abandons (etudiant_id) where not reintegre;

create function private.controler_abandon()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_reintegre boolean;
  v_date date;
  v_par text;
begin
  if tg_op = 'INSERT' then
    -- Abandon déjà enregistré (renvoi complet de la ligne) : la modification suit ses propres règles.
    if exists (select 1 from public.abandons a where a.id = new.id) then
      return new;
    end if;
    new.valide_par_id := (select auth.uid());
    new.valide_par_label := coalesce((select c.nom_affiche from public.comptes c where c.id = (select auth.uid())), new.valide_par_label);
    new.reintegre := false;
    new.date_reintegration := null;
    new.reintegre_par_label := null;
    return new;
  end if;
  -- Seule la réintégration se note, une fois ; le reste du dossier est figé.
  if old.reintegre and (new.reintegre, new.date_reintegration, new.reintegre_par_label)
     is distinct from (old.reintegre, old.date_reintegration, old.reintegre_par_label) then
    raise exception 'Cet étudiant est déjà réintégré : le dossier d''abandon ne change plus.' using errcode = 'check_violation';
  end if;
  v_reintegre := new.reintegre;
  v_date := new.date_reintegration;
  v_par := new.reintegre_par_label;
  new := old;
  if v_reintegre and not old.reintegre then
    new.reintegre := true;
    new.date_reintegration := coalesce(v_date, current_date);
    new.reintegre_par_label := coalesce(nullif(trim(coalesce(v_par, '')), ''),
      (select c.nom_affiche from public.comptes c where c.id = (select auth.uid())), '');
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_abandon() from public, anon, authenticated;
create trigger abandons_controle before insert or update on public.abandons
  for each row execute function private.controler_abandon();

-- ——— 5. Fichiers orphelins : les documents des dossiers aussi ——————————————————————————————————

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
      when 'dossiers' then not exists (select 1 from public.documents_dossiers d where d.fichier_chemin = p_chemin)
      else false
    end
    and (p_proprietaire = auth.uid()::text
         or (p_espace = 'cahiers' and private.a_acces_une_page(array['scol-ass-cahier', 'edt-grille'])
             and not exists (select 1 from public.cahiers c where c.id = split_part(p_chemin, '/', 1)))
         or (p_espace = 'actualites' and private.a_acces_page('com-publicite'))
         or (p_espace = 'ressources' and private.est_administration())
         or (p_espace = 'dossiers' and private.gere_dossier(private.type_dossier(p_chemin))))
$$;

drop policy edumanage_fichiers_orphelins_lecture on storage.objects;
drop policy edumanage_fichiers_orphelins_suppression on storage.objects;
create policy edumanage_fichiers_orphelins_lecture on storage.objects for select to authenticated
  using (bucket_id in ('photos', 'pieces', 'cahiers', 'justificatifs', 'demandes', 'actualites', 'ressources', 'dossiers')
         and private.fichier_orphelin(bucket_id, name, owner_id));
create policy edumanage_fichiers_orphelins_suppression on storage.objects for delete to authenticated
  using (bucket_id in ('photos', 'pieces', 'cahiers', 'justificatifs', 'demandes', 'actualites', 'ressources', 'dossiers')
         and private.fichier_orphelin(bucket_id, name, owner_id));

-- ——— 6. Droits, journal et compteurs ——————————————————————————————————————————————————————————

alter table public.contacts_etudiants enable row level security;
alter table public.documents_dossiers enable row level security;
alter table public.memos_dossiers enable row level security;
alter table public.abandons enable row level security;

grant select, insert, update, delete on public.contacts_etudiants to authenticated;
create policy contacts_etudiants_lecture on public.contacts_etudiants for select to authenticated
  using ((select private.est_administration()) or etudiant_id = (select private.etudiant_courant()));
create policy contacts_etudiants_ajout on public.contacts_etudiants for insert to authenticated
  with check ((select private.gere_etudiants()));
create policy contacts_etudiants_modification on public.contacts_etudiants for update to authenticated
  using ((select private.gere_etudiants())) with check ((select private.gere_etudiants()));
create policy contacts_etudiants_retrait on public.contacts_etudiants for delete to authenticated
  using ((select private.gere_etudiants()));

grant select, insert, delete on public.documents_dossiers to authenticated;
create policy documents_dossiers_lecture on public.documents_dossiers for select to authenticated
  using ((select private.est_administration()));
create policy documents_dossiers_ajout on public.documents_dossiers for insert to authenticated
  with check (private.gere_dossier(entite_type));
create policy documents_dossiers_retrait on public.documents_dossiers for delete to authenticated
  using (private.gere_dossier(entite_type));

grant select, insert, delete on public.memos_dossiers to authenticated;
create policy memos_dossiers_lecture on public.memos_dossiers for select to authenticated
  using (private.gere_dossier(entite_type));
create policy memos_dossiers_ajout on public.memos_dossiers for insert to authenticated
  with check (private.gere_dossier(entite_type));
create policy memos_dossiers_retrait on public.memos_dossiers for delete to authenticated
  using (private.gere_dossier(entite_type));

grant select, insert, update on public.abandons to authenticated;
create policy abandons_lecture on public.abandons for select to authenticated
  using ((select private.est_administration()));
create policy abandons_creation on public.abandons for insert to authenticated
  with check ((select private.a_acces_page('scol-abandon')));
create policy abandons_reintegration on public.abandons for update to authenticated
  using ((select private.a_acces_page('scol-abandon'))) with check ((select private.a_acces_page('scol-abandon')));

do $$
declare
  v_table text;
begin
  foreach v_table in array array['contacts_etudiants', 'documents_dossiers', 'memos_dossiers', 'abandons']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.journaliser_modification()',
      v_table || '_journal', v_table);
    perform private.suivre_table(v_table);
  end loop;
end
$$;
