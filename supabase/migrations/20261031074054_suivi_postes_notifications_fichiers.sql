-- Corrections des limites connues des parties 4 et 5.
--
-- 1. Les autres postes voient vite ce qui change. Chaque table tient un compteur de changements
--    (une séquence, augmentée à chaque écriture sans verrou entre les postes). L'application lit
--    tous les compteurs d'un coup (versions_donnees) toutes les 30 secondes et ne recharge que les
--    tables qui ont changé : un pointage créé par la base, une notification, un cahier validé…
-- 2. La base écrit elle-même les notifications qui restaient sur le poste qui agissait : pièce
--    déposée (au secrétariat), pièce acceptée ou refusée (à l'étudiant), blocage et déblocage d'un
--    étudiant, pointage validé ou rejeté, absence d'un professeur validée.
-- 3. Fichiers orphelins : chacun peut retirer un fichier qu'il a lui-même déposé et qu'aucune ligne
--    de la base ne désigne plus (pièce remplacée avant sa vérification, envoi refusé après le
--    dépôt du fichier) ; les fichiers du brouillon d'une séance annulée sont retirés par le poste
--    qui l'annule.

-- ——— 1. Compteurs de changements ————————————————————————————————————————————————————————————

create function private.marquer_version()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform nextval(format('private.%I', 'version_' || tg_table_name)::regclass);
  return null;
end;
$$;
revoke execute on function private.marquer_version() from public, anon, authenticated;

-- Compteur et déclencheur d'une table. Une table créée par une migration suivante s'inscrit de la
-- même façon : select private.suivre_table('nouvelle_table');
create function private.suivre_table(p_table text)
returns void
language plpgsql set search_path = ''
as $$
begin
  execute format('create sequence private.%I', 'version_' || p_table);
  execute format('create trigger %I after insert or update or delete or truncate on public.%I '
    'for each statement execute function private.marquer_version()', p_table || '_compteur', p_table);
end;
$$;
revoke execute on function private.suivre_table(text) from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  for v_table in
    select c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' order by c.relname
  loop
    perform private.suivre_table(v_table);
  end loop;
end
$$;

-- Compteur de chaque table, pour un compte connecté. Il ne dit que « cette table a changé » : les
-- lignes restent lues selon les règles d'accès de chaque table. Une écriture annulée augmente
-- aussi le compteur (un rechargement de trop, sans conséquence).
create function public.versions_donnees()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if private.type_compte_courant() is null then
    raise exception 'Connectez-vous pour suivre les changements.' using errcode = 'insufficient_privilege';
  end if;
  return (
    select coalesce(jsonb_object_agg(substr(s.sequencename, 9), coalesce(s.last_value, 0)), '{}'::jsonb)
    from pg_catalog.pg_sequences s
    where s.schemaname = 'private' and s.sequencename like 'version\_%'
  );
end;
$$;
comment on function public.versions_donnees() is 'Compteur de changements de chaque table (rechargement des seules tables modifiées).';
revoke execute on function public.versions_donnees() from public, anon;
grant execute on function public.versions_donnees() to authenticated, service_role;

-- ——— 2. Notifications écrites par la base ————————————————————————————————————————————————

-- Intitulé d'une pièce d'inscription, comme dans l'application (DOCUMENTS_INSCRIPTION).
create function private.libelle_piece(p_piece text)
returns text
language sql immutable set search_path = ''
as $$
  select case p_piece
    when 'extraitNaissance' then 'Extrait de naissance'
    when 'cni' then 'CNI / Passeport'
    when 'releveBac' then 'Relevé de notes BAC'
    when 'diplomeBac' then 'Diplôme BAC'
    when 'relevesNotes' then 'Relevés de notes (transfert)'
    when 'justificatifPaiement' then 'Justificatif de paiement'
    else p_piece
  end
$$;
revoke execute on function private.libelle_piece(text) from public, anon, authenticated;

-- Pièce déposée : le secrétariat qui vérifie les pièces est prévenu (une seule notification qui
-- compte les dépôts tant qu'il ne l'a pas lue). Décision sur une pièce déposée : l'étudiant
-- l'apprend, avec le motif d'un refus.
create function private.suivre_piece_etudiant()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_etudiant text;
  v_libelle text := private.libelle_piece(new.piece);
  v_compte uuid;
begin
  if new.en_verification is not null and (tg_op = 'INSERT' or old.en_verification is distinct from new.en_verification) then
    select format('%s %s (%s)', e.prenom, e.nom, e.matricule) into v_etudiant from public.etudiants e where e.id = new.etudiant_id;
    for v_compte in
      select c.id from public.comptes c
      where c.type_compte = 'administration' and c.actif and private.acces_page_de(c.id, 'etudiants-liste')
    loop
      perform private.envoyer_notification(v_compte,
        format('Pièce à vérifier : %s a déposé « %s ».', v_etudiant, v_libelle), 'pieces-a-verifier',
        format('{n} pièces à vérifier — dernière : %s, « %s ».', v_etudiant, v_libelle));
    end loop;
  end if;
  if tg_op = 'UPDATE' and old.en_verification is not null and new.en_verification is null then
    for v_compte in
      select c.id from public.comptes c where c.type_compte = 'etudiant' and c.actif and c.lien_id = new.etudiant_id
    loop
      if new.fichier is not null and new.fichier is distinct from old.fichier then
        perform private.envoyer_notification(v_compte,
          format('Votre pièce « %s » a été acceptée : elle figure désormais comme fournie à votre dossier.', v_libelle));
      elsif new.motif_refus is not null then
        perform private.envoyer_notification(v_compte,
          format('Votre pièce « %s » a été refusée — motif : %s. Vous pouvez en déposer une nouvelle depuis Mes documents.', v_libelle, new.motif_refus));
      end if;
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function private.suivre_piece_etudiant() from public, anon, authenticated;
create trigger pieces_etudiants_suivi after insert or update on public.pieces_etudiants
  for each row execute function private.suivre_piece_etudiant();

-- Blocage et déblocage d'un étudiant, selon les réglages de la communication (actifs par défaut).
create function private.notifier_blocage_etudiant()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_bloque boolean := new.motif_blocage_id is not null;
  v_compte uuid;
begin
  if not coalesce((select n.actif and n.envoyer_etudiant from public.notifications_evenementielles n
                   where n.code = case when v_bloque then 'NOTIFICATION_BLOCAGE_ETUDIANT' else 'NOTIFICATION_DEBLOCAGE_ETUDIANT' end), true) then
    return null;
  end if;
  for v_compte in
    select c.id from public.comptes c where c.type_compte = 'etudiant' and c.actif and c.lien_id = new.id
  loop
    perform private.envoyer_notification(v_compte, case when v_bloque
      then 'Un blocage a été appliqué à votre dossier. Contactez l''administration.'
      else 'Le blocage sur votre dossier a été levé.' end);
  end loop;
  return null;
end;
$$;
revoke execute on function private.notifier_blocage_etudiant() from public, anon, authenticated;
create trigger etudiants_dossiers_blocage after update of motif_blocage_id on public.etudiants_dossiers
  for each row when (old.motif_blocage_id is distinct from new.motif_blocage_id)
  execute function private.notifier_blocage_etudiant();

-- Pointage validé ou rejeté : le professeur l'apprend (avec le motif d'un rejet).
create function private.notifier_pointage()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_creneau text := format('%s (%s–%s', to_char(new.date, 'DD/MM/YYYY'), new.heure_debut, new.heure_fin);
begin
  perform private.notifier_enseignant(new.teacher_id, case when new.statut = 'valide'
    then format('Pointage du %s, %s h) validé.', v_creneau, trim_scale(new.volume_pointe))
    else format('Pointage du %s) rejeté : %s.', v_creneau, coalesce(nullif(trim(new.motif_rejet), ''), 'sans motif'))
  end);
  return null;
end;
$$;
revoke execute on function private.notifier_pointage() from public, anon, authenticated;
create trigger pointages_decision after update of statut on public.pointages
  for each row when (new.statut in ('valide', 'rejete') and old.statut is distinct from new.statut)
  execute function private.notifier_pointage();

-- Absences des professeurs : une absence déclarée justifiée par l'administration, sans justificatif
-- du professeur, est « validée » (réglage « validation de l'absence d'un professeur », actif par
-- défaut) ; le reste ne change pas.
create or replace function private.suivre_absence_enseignant()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_date text := to_char(new.date, 'DD/MM/YYYY');
  v_quoi text := case when new.type = 'retard' then 'retard' else 'absence' end;
  v_ec text := (select e.libelle from public.ecs e where e.id = new.ec_id);
  v_auteur text;
  v_compte uuid;
begin
  if tg_op = 'INSERT' then
    perform private.notifier_enseignant(new.teacher_id,
      case when new.type = 'retard'
        then 'Un retard' || coalesce(' de ' || nullif(new.duree_minutes, 0) || ' min', '') || ' a été constaté'
        else 'Une absence a été constatée' end
      || ' le ' || v_date || coalesce(' en ' || v_ec, '')
      || case when trim(new.motif) <> '' then ' — motif : ' || trim(new.motif) else '' end
      || '. Consultez « Mes absences ».');
    return null;
  end if;
  if new.justificatif_motif is not null and old.justificatif_motif is null then
    select c.nom_affiche into v_auteur from public.comptes c
    where c.type_compte = 'enseignant' and c.lien_id = new.teacher_id limit 1;
    for v_compte in
      select c.id from public.comptes c
      where c.type_compte = 'administration' and c.actif and private.acces_page_de(c.id, 'prof-absence-retard')
    loop
      perform private.envoyer_notification(v_compte,
        format('Justificatif reçu de %s pour son %s du %s : %s.', coalesce(v_auteur, 'un professeur'), v_quoi, v_date, new.justificatif_motif));
    end loop;
  end if;
  if new.justifie and not old.justifie then
    if new.justificatif_motif is not null then
      perform private.notifier_enseignant(new.teacher_id, format('Justificatif accepté : votre %s du %s est justifié(e).', v_quoi, v_date));
    elsif coalesce((select n.actif and n.envoyer_professeur from public.notifications_evenementielles n
                    where n.code = 'NOTIFICATION_VALIDATION_ABSENCE_PROF'), true) then
      perform private.notifier_enseignant(new.teacher_id, format('Votre %s du %s a été validé(e).', v_quoi, v_date));
    end if;
  elsif new.refus_le is not null and new.refus_le is distinct from old.refus_le then
    perform private.notifier_enseignant(new.teacher_id,
      format('Justificatif refusé pour votre %s du %s — motif : %s. Vous pouvez en envoyer un autre depuis « Mes absences ».', v_quoi, v_date, new.refus_motif_refus));
  end if;
  return null;
end;
$$;

-- ——— 3. Fichiers orphelins ———————————————————————————————————————————————————————————————————

-- Fichier qu'aucune ligne de la base (photo, pièce, fichier de cahier, justificatif) ne désigne
-- plus, et que ce compte peut retirer : il l'a déposé lui-même, ou c'est un fichier d'un cahier
-- supprimé (séance annulée avec son brouillon) et ce compte supprime les cahiers. Les lignes sont
-- lues sans les règles d'accès : un fichier désigné par une ligne qu'on ne voit pas reste désigné.
create function private.fichier_orphelin(p_espace text, p_chemin text, p_proprietaire text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case p_espace
      when 'photos' then not exists (select 1 from public.etudiants_dossiers d where d.photo_chemin = p_chemin)
                     and not exists (select 1 from public.enseignants_dossiers d where d.photo_chemin = p_chemin)
      when 'pieces' then not exists (select 1 from public.pieces_etudiants p where p.fichier = p_chemin or p.en_verification = p_chemin)
      when 'cahiers' then not exists (select 1 from public.cahiers_fichiers f where f.chemin = p_chemin)
      when 'justificatifs' then not exists (select 1 from public.absences_enseignants a where a.justificatif_piece = p_chemin)
      else false
    end
    and (p_proprietaire = auth.uid()::text
         or (p_espace = 'cahiers' and private.a_acces_une_page(array['scol-ass-cahier', 'edt-grille'])
             and not exists (select 1 from public.cahiers c where c.id = split_part(p_chemin, '/', 1))))
$$;
revoke execute on function private.fichier_orphelin(text, text, text) from public, anon;
grant execute on function private.fichier_orphelin(text, text, text) to authenticated, service_role;

create index cahiers_fichiers_chemin_idx on public.cahiers_fichiers (chemin);

-- Le retrait passe par une lecture du fichier : les deux règles vont ensemble.
create policy edumanage_fichiers_orphelins_lecture on storage.objects for select to authenticated
  using (bucket_id in ('photos', 'pieces', 'cahiers', 'justificatifs') and private.fichier_orphelin(bucket_id, name, owner_id));
create policy edumanage_fichiers_orphelins_suppression on storage.objects for delete to authenticated
  using (bucket_id in ('photos', 'pieces', 'cahiers', 'justificatifs') and private.fichier_orphelin(bucket_id, name, owner_id));
