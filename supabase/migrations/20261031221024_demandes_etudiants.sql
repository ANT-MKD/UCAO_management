-- Partie 8, lot 2 : demandes des étudiants.
--
-- Un étudiant dépose ses demandes (justificatif d'absence, attestation, réclamation de note,
-- rallonge de paiement, autre), avec au besoin une pièce jointe rangée dans l'espace de fichiers
-- « demandes » ; il les lit, et les annule tant que le secrétariat ne s'en est pas saisi.
-- L'administration les lit ; la page « Demandes » les prend en charge, les accepte ou les refuse,
-- une fois : une demande traitée ne change plus. Seul un validateur désigné accepte une rallonge.
-- Un justificatif vise une absence (ou un retard) de l'étudiant lui-même, une réclamation une de
-- ses notes publiées ; une seule demande en cours par absence ou par note. La base prévient le
-- secrétariat d'une nouvelle demande et l'étudiant de son traitement, en direct.

-- ——— 1. Demandes ——————————————————————————————————————————————————————————————————————————

create table public.demandes_etudiants (
  id text primary key check (length(id) between 1 and 100),
  etudiant_id text not null references public.etudiants (id) on delete cascade,
  type text not null check (type in ('justificatif_absence', 'attestation', 'reclamation_note', 'demande_rallonge', 'autre')),
  objet text not null check (length(trim(objet)) between 1 and 300),
  message text not null default '' check (length(message) <= 20000),
  statut text not null default 'nouveau' check (statut in ('nouveau', 'en_cours', 'valide', 'rejete', 'annule')),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  traite_par uuid references public.comptes (id) on delete set null,
  resolution text check (length(resolution) <= 5000),
  -- Rallonge : portée et date de fin souhaitées (la dérogation est créée à la validation).
  portee_rallonge text check (portee_rallonge in ('reinscription', 'documents', 'global')),
  date_fin_souhaitee date,
  -- Justificatif : l'absence visée ; réclamation : la note contestée.
  absence_cahier_id text references public.cahiers (id) on delete set null,
  absence_libelle text,
  note_id text references public.notes (id) on delete set null,
  note_libelle text,
  -- Attestation : le document demandé, puis celui réellement délivré.
  attestation_type text check (attestation_type in ('scolarite', 'inscription')),
  attestation_id text references public.attestations (id) on delete set null,
  attestation_numero text,
  -- Pièce jointe : <étudiant>/<demande>/<fichier> dans l'espace « demandes ».
  piece_nom text,
  piece_type text,
  piece_chemin text,
  constraint demandes_piece_rangee check (piece_chemin is null or starts_with(piece_chemin, etudiant_id || '/' || id || '/')),
  constraint demandes_rallonge_complete check (type <> 'demande_rallonge' or (portee_rallonge is not null and date_fin_souhaitee is not null))
);
comment on table public.demandes_etudiants is 'Demandes des étudiants au secrétariat et leur traitement.';
create index demandes_etudiants_etudiant_idx on public.demandes_etudiants (etudiant_id, cree_le desc);
create index demandes_etudiants_statut_idx on public.demandes_etudiants (statut);
create index demandes_etudiants_traite_par_idx on public.demandes_etudiants (traite_par);
create index demandes_etudiants_absence_idx on public.demandes_etudiants (absence_cahier_id);
create index demandes_etudiants_note_idx on public.demandes_etudiants (note_id);
create index demandes_etudiants_attestation_idx on public.demandes_etudiants (attestation_id);
create index demandes_etudiants_piece_idx on public.demandes_etudiants (piece_chemin);
-- Une seule demande en cours par absence et par note.
create unique index demandes_absence_en_cours on public.demandes_etudiants (etudiant_id, absence_cahier_id)
  where type = 'justificatif_absence' and statut in ('nouveau', 'en_cours');
create unique index demandes_note_en_cours on public.demandes_etudiants (etudiant_id, note_id)
  where type = 'reclamation_note' and statut in ('nouveau', 'en_cours');

create function private.controler_demande()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_numero text;
begin
  if tg_op = 'INSERT' then
    -- Demande déjà enregistrée (renvoi complet de la ligne) : la modification suit ses propres règles.
    if exists (select 1 from public.demandes_etudiants d where d.id = new.id) then
      return new;
    end if;
    new.statut := 'nouveau';
    new.cree_le := now();
    new.modifie_le := new.cree_le;
    new.traite_par := null;
    new.resolution := null;
    new.attestation_id := null;
    new.attestation_numero := null;
    if new.type = 'justificatif_absence' then
      if new.absence_cahier_id is null or not exists (
        select 1 from public.presences p
        where p.cahier_id = new.absence_cahier_id and p.etudiant_id = new.etudiant_id and p.statut in ('absent', 'retard')) then
        raise exception 'Choisissez une de vos absences à justifier.' using errcode = 'check_violation';
      end if;
    else
      new.absence_cahier_id := null;
      new.absence_libelle := null;
    end if;
    if new.type = 'reclamation_note' then
      if new.note_id is null or not exists (
        select 1 from public.notes n where n.id = new.note_id and n.etudiant_id = new.etudiant_id and n.statut = 'publie') then
        raise exception 'Choisissez une de vos notes publiées.' using errcode = 'check_violation';
      end if;
    else
      new.note_id := null;
      new.note_libelle := null;
    end if;
    if new.type <> 'demande_rallonge' then
      new.portee_rallonge := null;
      new.date_fin_souhaitee := null;
    end if;
    if new.type <> 'attestation' then
      new.attestation_type := null;
    end if;
    if new.piece_chemin is null then
      new.piece_nom := null;
      new.piece_type := null;
    end if;
    return new;
  end if;

  if (new.id, new.etudiant_id, new.type, new.objet, new.message, new.cree_le, new.portee_rallonge, new.date_fin_souhaitee,
      new.absence_cahier_id, new.absence_libelle, new.note_id, new.note_libelle, new.attestation_type, new.piece_nom, new.piece_type, new.piece_chemin)
     is distinct from (old.id, old.etudiant_id, old.type, old.objet, old.message, old.cree_le, old.portee_rallonge, old.date_fin_souhaitee,
      old.absence_cahier_id, old.absence_libelle, old.note_id, old.note_libelle, old.attestation_type, old.piece_nom, old.piece_type, old.piece_chemin) then
    raise exception 'Une demande envoyée ne se modifie plus.' using errcode = 'check_violation';
  end if;
  if (new.statut, new.resolution, new.attestation_id) is not distinct from (old.statut, old.resolution, old.attestation_id) then
    -- Rien ne change (renvoi de la ligne telle quelle).
    new.traite_par := old.traite_par;
    new.modifie_le := old.modifie_le;
    new.attestation_numero := old.attestation_numero;
    return new;
  end if;
  if old.statut = 'annule' then
    raise exception 'Cette demande a été annulée par l''étudiant : elle ne se traite plus.' using errcode = 'check_violation';
  end if;
  if old.statut in ('valide', 'rejete') then
    raise exception 'Cette demande est déjà traitée : elle ne change plus.' using errcode = 'check_violation';
  end if;

  if not (select private.a_acces_page('com-demandes')) then
    -- L'étudiant : il annule sa demande tant que le secrétariat ne s'en est pas saisi.
    if new.statut = 'annule' and old.statut = 'nouveau'
       and (new.resolution, new.attestation_id) is not distinct from (old.resolution, old.attestation_id) then
      new.traite_par := old.traite_par;
      new.attestation_numero := old.attestation_numero;
      new.modifie_le := now();
      return new;
    end if;
    raise exception 'Seul le secrétariat traite une demande ; vous pouvez l''annuler tant qu''il ne l''a pas prise en charge.' using errcode = 'insufficient_privilege';
  end if;

  if new.statut = 'annule' then
    raise exception 'Seul l''étudiant annule sa demande.' using errcode = 'check_violation';
  elsif new.statut = 'nouveau' and old.statut <> 'nouveau' then
    raise exception 'Une demande prise en charge ne redevient pas nouvelle.' using errcode = 'check_violation';
  elsif new.statut = 'valide' and old.type = 'demande_rallonge' and not exists (
    select 1 from public.roles_communication r where r.role = 'validateur_rallonge' and r.compte_id = (select auth.uid())) then
    raise exception 'Seul un validateur désigné (Paramétrage communication) peut approuver une demande de rallonge.' using errcode = 'insufficient_privilege';
  end if;
  if new.attestation_id is distinct from old.attestation_id then
    if old.attestation_id is not null then
      raise exception 'Cette demande a déjà son attestation.' using errcode = 'check_violation';
    end if;
    select a.numero into v_numero from public.attestations a where a.id = new.attestation_id and a.etudiant_id = old.etudiant_id;
    if v_numero is null then
      raise exception 'Cette attestation n''est pas celle de l''étudiant de la demande.' using errcode = 'check_violation';
    end if;
    new.attestation_numero := v_numero;
  else
    new.attestation_numero := old.attestation_numero;
  end if;
  new.resolution := nullif(trim(coalesce(new.resolution, '')), '');
  new.traite_par := (select auth.uid());
  new.modifie_le := now();
  return new;
end;
$$;
revoke execute on function private.controler_demande() from public, anon, authenticated;
create trigger demandes_etudiants_controle before insert or update on public.demandes_etudiants
  for each row execute function private.controler_demande();

-- Nouvelle demande : le secrétariat (comptes qui ont la page « Demandes ») est prévenu ; ensuite,
-- l'étudiant apprend la prise en charge et la décision.
create function private.suivre_demande()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_compte uuid;
begin
  if tg_op = 'INSERT' then
    for v_compte in
      select c.id from public.comptes c
      where c.type_compte = 'administration' and c.actif and private.acces_page_de(c.id, 'com-demandes')
    loop
      perform private.envoyer_notification(v_compte, 'Nouvelle demande étudiant: ' || new.objet);
    end loop;
  elsif new.statut is distinct from old.statut and new.statut in ('en_cours', 'valide', 'rejete') then
    for v_compte in
      select c.id from public.comptes c where c.type_compte = 'etudiant' and c.actif and c.lien_id = new.etudiant_id
    loop
      perform private.envoyer_notification(v_compte, format('Votre demande « %s » %s%s', new.objet,
        case new.statut when 'valide' then 'a été acceptée' when 'rejete' then 'a été refusée' else 'est en cours de traitement' end,
        case when new.resolution is not null then ' : ' || new.resolution else '.' end));
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function private.suivre_demande() from public, anon, authenticated;
create trigger demandes_etudiants_suivi after insert or update of statut on public.demandes_etudiants
  for each row execute function private.suivre_demande();

-- ——— 2. Pièces jointes ————————————————————————————————————————————————————————————————————————

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('demandes', 'demandes', false, 1048576, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);

-- <étudiant>/<demande>/<fichier> : déposé par l'étudiant dans son dossier ; lu par lui et par la page
-- « Demandes ». Un fichier qu'aucune demande ne désigne plus se retire comme les autres (section 3).
create policy edumanage_demandes_lecture on storage.objects for select to authenticated
  using (bucket_id = 'demandes' and array_length(storage.foldername(name), 1) = 2
         and ((storage.foldername(name))[1] = (select private.etudiant_courant())
              or (select private.a_acces_page('com-demandes'))));
create policy edumanage_demandes_depot on storage.objects for insert to authenticated
  with check (bucket_id = 'demandes' and array_length(storage.foldername(name), 1) = 2
              and (storage.foldername(name))[1] = (select private.etudiant_courant()));

-- ——— 3. Fichiers orphelins : les pièces des demandes aussi ————————————————————————————————————

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
      else false
    end
    and (p_proprietaire = auth.uid()::text
         or (p_espace = 'cahiers' and private.a_acces_une_page(array['scol-ass-cahier', 'edt-grille'])
             and not exists (select 1 from public.cahiers c where c.id = split_part(p_chemin, '/', 1))))
$$;

drop policy edumanage_fichiers_orphelins_lecture on storage.objects;
drop policy edumanage_fichiers_orphelins_suppression on storage.objects;
create policy edumanage_fichiers_orphelins_lecture on storage.objects for select to authenticated
  using (bucket_id in ('photos', 'pieces', 'cahiers', 'justificatifs', 'demandes') and private.fichier_orphelin(bucket_id, name, owner_id));
create policy edumanage_fichiers_orphelins_suppression on storage.objects for delete to authenticated
  using (bucket_id in ('photos', 'pieces', 'cahiers', 'justificatifs', 'demandes') and private.fichier_orphelin(bucket_id, name, owner_id));

-- ——— 4. Droits, journal, compteurs et diffusion ——————————————————————————————————————————————

alter table public.demandes_etudiants enable row level security;
grant select, insert, update on public.demandes_etudiants to authenticated;
create policy demandes_etudiants_lecture on public.demandes_etudiants for select to authenticated
  using (etudiant_id = (select private.etudiant_courant()) or (select private.est_administration()));
create policy demandes_etudiants_depot on public.demandes_etudiants for insert to authenticated
  with check (etudiant_id = (select private.etudiant_courant()));
create policy demandes_etudiants_traitement on public.demandes_etudiants for update to authenticated
  using (etudiant_id = (select private.etudiant_courant()) or (select private.a_acces_page('com-demandes')))
  with check (etudiant_id = (select private.etudiant_courant()) or (select private.a_acces_page('com-demandes')));

create trigger demandes_etudiants_journal after insert or update on public.demandes_etudiants
  for each row execute function private.journaliser_modification();
select private.suivre_table('demandes_etudiants');
-- En direct : le secrétariat voit arriver les demandes (centre « À traiter ») ; l'étudiant, leur suivi.
select private.diffuser_table('demandes_etudiants', array['administration', 'etudiant:etudiant_id'], array['statut', 'attestation_numero']);
