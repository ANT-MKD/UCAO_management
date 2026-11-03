-- Espace de fichiers privé (partie 4 du plan de migration, lot 3).
--
-- Trois espaces, tous privés (aucun lien public, chaque lecture passe par les règles ci-dessous) :
--   - « photos » : photos d'identité des étudiants (etudiants/<id>/…) et des enseignants
--     (enseignants/<id>/…), lues par l'administration et par la personne elle-même ;
--   - « pieces » : pièces d'inscription déposées par l'étudiant (<etudiant>/<piece>/…), lues par
--     l'étudiant et par le secrétariat (page « Liste étudiants », où se trouve le dossier) ;
--   - « etablissement » : logo (logo/…) et images des signatures (signatures/<document>/…), lus
--     par tout compte connecté (l'étudiant imprime ses attestations), réglés depuis les
--     « Paramètres généraux ».
-- Les tables ne gardent que le chemin du fichier. Un fichier déposé n'est jamais réécrit : une
-- nouvelle version a un nouveau chemin. L'étudiant ne supprime pas une pièce qu'il a déposée ;
-- seul le secrétariat l'accepte ou la refuse. Le professeur modifie lui-même son téléphone, son
-- adresse et sa photo (portail professeur), rien d'autre de son dossier.

-- ——— 1. Les espaces ————————————————————————————————————————————————————————————————————————

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos', 'photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('pieces', 'pieces', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']),
  ('etablissement', 'etablissement', false, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

-- ——— 2. Qui est connecté, côté fichiers ————————————————————————————————————————————————————

-- Compte enseignant connecté : sa propre fiche.
create function private.enseignant_courant()
returns text
language sql stable security definer set search_path = ''
as $$
  select case when private.type_compte_courant() = 'enseignant' then private.lien_courant() end
$$;

-- Secrétariat qui vérifie les pièces : la page « Liste étudiants » (dossier de l'étudiant).
create function private.verifie_pieces()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.a_acces_page('etudiants-liste')
$$;

-- Photos : etudiants/<id>/<fichier> ou enseignants/<id>/<fichier>.
create function private.lit_photo(p_nom text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_length(storage.foldername(p_nom), 1) = 2 and case (storage.foldername(p_nom))[1]
    when 'etudiants' then private.est_administration() or (storage.foldername(p_nom))[2] = private.etudiant_courant()
    when 'enseignants' then private.est_administration() or (storage.foldername(p_nom))[2] = private.enseignant_courant()
    else false
  end, false)
$$;

create function private.ecrit_photo(p_nom text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_length(storage.foldername(p_nom), 1) = 2 and case (storage.foldername(p_nom))[1]
    when 'etudiants' then private.gere_etudiants() or (storage.foldername(p_nom))[2] = private.etudiant_courant()
    when 'enseignants' then private.a_acces_une_page(array['prof-liste', 'prof-ajouter'])
                            or (storage.foldername(p_nom))[2] = private.enseignant_courant()
    else false
  end, false)
$$;

-- Pièces : <etudiant>/<piece>/<fichier>, à l'étudiant lui-même ou au secrétariat.
create function private.acces_piece(p_nom text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_length(storage.foldername(p_nom), 1) = 2
    and ((storage.foldername(p_nom))[1] = private.etudiant_courant() or private.verifie_pieces()), false)
$$;

-- Établissement : logo/<fichier> ou signatures/<document>/<fichier>.
create function private.ecrit_fichier_etablissement(p_nom text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(case (storage.foldername(p_nom))[1]
    when 'logo' then array_length(storage.foldername(p_nom), 1) = 1
    when 'signatures' then array_length(storage.foldername(p_nom), 1) = 2
    else false
  end and private.a_acces_page('sec-settings'), false)
$$;

revoke execute on function private.enseignant_courant(), private.verifie_pieces(), private.lit_photo(text),
  private.ecrit_photo(text), private.acces_piece(text), private.ecrit_fichier_etablissement(text) from public, anon;
grant execute on function private.enseignant_courant(), private.verifie_pieces(), private.lit_photo(text),
  private.ecrit_photo(text), private.acces_piece(text), private.ecrit_fichier_etablissement(text) to authenticated, service_role;

-- ——— 3. Règles d'accès aux fichiers ————————————————————————————————————————————————————————
-- Pas de règle de modification : un fichier déposé ne se réécrit pas (nouvelle version, nouveau
-- chemin). Les visiteurs non connectés n'ont aucune règle, donc aucun fichier.

create policy edumanage_photos_lecture on storage.objects for select to authenticated
  using (bucket_id = 'photos' and private.lit_photo(name));
create policy edumanage_photos_depot on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and private.ecrit_photo(name));
create policy edumanage_photos_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and private.ecrit_photo(name));

create policy edumanage_pieces_lecture on storage.objects for select to authenticated
  using (bucket_id = 'pieces' and private.acces_piece(name));
create policy edumanage_pieces_depot on storage.objects for insert to authenticated
  with check (bucket_id = 'pieces' and private.acces_piece(name));
create policy edumanage_pieces_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'pieces' and (select private.verifie_pieces()));

create policy edumanage_etablissement_lecture on storage.objects for select to authenticated
  using (bucket_id = 'etablissement' and (select private.type_compte_courant()) is not null);
create policy edumanage_etablissement_depot on storage.objects for insert to authenticated
  with check (bucket_id = 'etablissement' and private.ecrit_fichier_etablissement(name));
create policy edumanage_etablissement_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'etablissement' and private.ecrit_fichier_etablissement(name));

-- ——— 4. Chemins des photos, du logo et des signatures ——————————————————————————————————————
-- Chaque chemin reste dans le dossier de sa fiche : on ne désigne pas comme sa photo celle d'un
-- autre.

alter table public.etudiants_dossiers add column photo_chemin text,
  add constraint etudiants_dossiers_photo_chemin check (photo_chemin is null or starts_with(photo_chemin, 'etudiants/' || id || '/'));
alter table public.enseignants_dossiers add column photo_chemin text,
  add constraint enseignants_dossiers_photo_chemin check (photo_chemin is null or starts_with(photo_chemin, 'enseignants/' || id || '/'));
alter table public.signatures_documents add column image_chemin text,
  add constraint signatures_documents_image_chemin check (image_chemin is null or starts_with(image_chemin, 'signatures/' || id || '/'));
alter table public.etablissement
  add constraint etablissement_logo_chemin check (logo_chemin is null or starts_with(logo_chemin, 'logo/'));

-- L'étudiant change aussi sa photo (Mon profil).
create or replace function private.controler_dossier_etudiant()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select private.type_compte_courant()) = 'etudiant'
     and to_jsonb(new) - array['adresse', 'telephone', 'nom_tuteur', 'tel_tuteur', 'photo_chemin']
       is distinct from to_jsonb(old) - array['adresse', 'telephone', 'nom_tuteur', 'tel_tuteur', 'photo_chemin'] then
    raise exception 'Vous ne pouvez modifier que votre adresse, votre téléphone, votre tuteur et votre photo.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- Le professeur modifie son téléphone, son adresse et sa photo (Mon profil), jamais son RIB ni
-- son taux.
create function private.controler_dossier_enseignant()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select private.type_compte_courant()) = 'enseignant'
     and to_jsonb(new) - array['telephone', 'adresse', 'photo_chemin']
       is distinct from to_jsonb(old) - array['telephone', 'adresse', 'photo_chemin'] then
    raise exception 'Vous ne pouvez modifier que votre téléphone, votre adresse et votre photo.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_dossier_enseignant() from public, anon, authenticated;
create trigger enseignants_dossiers_controle before update on public.enseignants_dossiers
  for each row execute function private.controler_dossier_enseignant();

alter policy enseignants_dossiers_lecture on public.enseignants_dossiers
  using (
    (select private.a_acces_une_page(array['prof-liste', 'prof-ajouter', 'prof-taux', 'prof-vacations', 'prof-contrat']))
    or id = (select private.enseignant_courant())
  );
alter policy enseignants_dossiers_modification on public.enseignants_dossiers
  using ((select private.a_acces_une_page(array['prof-liste', 'prof-ajouter'])) or id = (select private.enseignant_courant()))
  with check ((select private.a_acces_une_page(array['prof-liste', 'prof-ajouter'])) or id = (select private.enseignant_courant()));

-- ——— 5. Pièces d'inscription déposées et vérifiées ———————————————————————————————————————————
-- Une ligne par pièce d'un étudiant : le fichier en attente de vérification, le fichier accepté,
-- ou le motif du refus. L'étudiant dépose (ce qui efface un refus précédent) ; le secrétariat
-- accepte (la pièce devient fournie) ou refuse avec un motif.

create table public.pieces_etudiants (
  id text primary key,
  etudiant_id text not null references public.etudiants (id) on delete cascade,
  piece text not null check (length(trim(piece)) > 0 and strpos(piece, '/') = 0),
  -- Fichier accepté par le secrétariat.
  fichier text,
  -- Fichier déposé, en attente de vérification.
  en_verification text,
  depose_le timestamptz,
  motif_refus text,
  refuse_le timestamptz,
  constraint pieces_etudiants_id check (id = etudiant_id || ':' || piece),
  constraint pieces_etudiants_chemins check (
    (fichier is null or starts_with(fichier, etudiant_id || '/' || piece || '/'))
    and (en_verification is null or starts_with(en_verification, etudiant_id || '/' || piece || '/'))
  ),
  constraint pieces_etudiants_depot_date check (en_verification is null or depose_le is not null),
  constraint pieces_etudiants_refus check ((motif_refus is null) = (refuse_le is null))
);
comment on table public.pieces_etudiants is 'Pièces d''inscription déposées par les étudiants : en vérification, acceptées ou refusées.';
create index pieces_etudiants_etudiant_id_idx on public.pieces_etudiants (etudiant_id);

-- L'étudiant ne fait que déposer : un fichier en vérification, sur une pièce qui n'est pas déjà
-- fournie. Accepter, refuser ou retirer une pièce revient au secrétariat.
create function private.controler_piece_etudiant()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select private.type_compte_courant()) is distinct from 'etudiant' then
    return new;
  end if;
  if (tg_op = 'UPDATE' and old.fichier is not null)
     or exists (select 1 from public.etudiants_dossiers d where d.id = new.etudiant_id and new.piece = any (d.documents_fournis)) then
    raise exception 'Cette pièce figure déjà comme fournie à votre dossier.' using errcode = 'check_violation';
  end if;
  if new.fichier is not null or new.en_verification is null or new.motif_refus is not null then
    raise exception 'Vous déposez une pièce ; seul le secrétariat l''accepte ou la refuse.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_piece_etudiant() from public, anon, authenticated;
create trigger pieces_etudiants_controle before insert or update on public.pieces_etudiants
  for each row execute function private.controler_piece_etudiant();
create trigger pieces_etudiants_journal after insert or update or delete on public.pieces_etudiants
  for each row execute function private.journaliser_modification();

alter table public.pieces_etudiants enable row level security;
grant select, insert, update, delete on public.pieces_etudiants to authenticated, service_role;
create policy pieces_etudiants_lecture on public.pieces_etudiants for select to authenticated
  using (etudiant_id = (select private.etudiant_courant()) or (select private.verifie_pieces()));
create policy pieces_etudiants_depot on public.pieces_etudiants for insert to authenticated
  with check (etudiant_id = (select private.etudiant_courant()) or (select private.verifie_pieces()));
create policy pieces_etudiants_modification on public.pieces_etudiants for update to authenticated
  using (etudiant_id = (select private.etudiant_courant()) or (select private.verifie_pieces()))
  with check (etudiant_id = (select private.etudiant_courant()) or (select private.verifie_pieces()));
create policy pieces_etudiants_suppression on public.pieces_etudiants for delete to authenticated
  using ((select private.verifie_pieces()));
