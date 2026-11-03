-- Emploi du temps : conflits refusés et notifications envoyées par la base (partie 5, lot 1 bis).
--
-- 1. Conflits : la base refuse, même pour deux postes qui enregistrent au même moment,
--    - deux séances qui se chevauchent le même jour de la même semaine dans la même salle, avec le
--      même professeur ou pour la même classe (les règles de l'application) ;
--    - deux événements qui se chevauchent le même jour dans la même salle ;
--    - un événement et une séance qui se chevauchent dans la même salle.
--    Les règles entre séances et entre événements sont vérifiées à la fin de l'enregistrement : un
--    envoi qui déplace plusieurs séances à la fois n'est jugé que sur le résultat.
-- 2. Notifications : quand une séance est créée, modifiée ou annulée, la base prévient elle-même
--    les étudiants de la classe et le ou les professeurs concernés, selon le réglage « Envoi
--    notification après la mise à jour d'un emploi du temps » (actif par défaut, comme dans
--    l'application). Les créations se regroupent : « 12 nouveaux créneaux ajoutés ».

-- ——— 1. Conflits ———————————————————————————————————————————————————————————————————————————

create extension if not exists btree_gist with schema extensions;

-- « 08:30 » → 510 minutes.
create function private.minutes(p_heure text)
returns integer
language sql immutable parallel safe set search_path = ''
as $$
  select split_part(p_heure, ':', 1)::integer * 60 + split_part(p_heure, ':', 2)::integer
$$;
revoke execute on function private.minutes(text) from public, anon;
grant execute on function private.minutes(text) to authenticated, service_role;

alter table public.seances
  add constraint seances_salle_libre exclude using gist (
    salle_id with =, semaine_du with =, jour with =,
    int4range(private.minutes(heure_debut), private.minutes(heure_fin)) with &&
  ) where (salle_id is not null) deferrable initially deferred,
  add constraint seances_professeur_libre exclude using gist (
    prof_id with =, semaine_du with =, jour with =,
    int4range(private.minutes(heure_debut), private.minutes(heure_fin)) with &&
  ) where (prof_id is not null) deferrable initially deferred,
  add constraint seances_classe_libre exclude using gist (
    classe_id with =, semaine_du with =, jour with =,
    int4range(private.minutes(heure_debut), private.minutes(heure_fin)) with &&
  ) deferrable initially deferred;

alter table public.evenements
  add constraint evenements_salle_libre exclude using gist (
    salle_id with =, date with =,
    int4range(private.minutes(heure_debut), private.minutes(heure_fin)) with &&
  ) where (salle_id is not null) deferrable initially deferred;

-- Séance contre événement dans la même salle : vérifié salle par salle, l'une après l'autre (deux
-- enregistrements simultanés pour la même salle ne passent pas tous les deux).
create function private.controler_salle_seance_evenement()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.salle_id is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('edumanage:salle:' || new.salle_id, 0));
  if tg_table_name = 'seances' then
    if exists (
      select 1 from public.evenements e
      where e.salle_id = new.salle_id
        and e.date = new.semaine_du + (new.jour - 1)
        and int4range(private.minutes(e.heure_debut), private.minutes(e.heure_fin))
            && int4range(private.minutes(new.heure_debut), private.minutes(new.heure_fin))
    ) then
      raise exception 'La salle % est déjà occupée par un événement sur ce créneau.', coalesce(nullif(new.salle, ''), new.salle_id)
        using errcode = 'exclusion_violation';
    end if;
  elsif exists (
    select 1 from public.seances s
    where s.salle_id = new.salle_id
      and s.semaine_du + (s.jour - 1) = new.date
      and int4range(private.minutes(s.heure_debut), private.minutes(s.heure_fin))
          && int4range(private.minutes(new.heure_debut), private.minutes(new.heure_fin))
  ) then
    raise exception 'La salle % est déjà occupée par une séance sur ce créneau.', coalesce(nullif(new.salle, ''), new.salle_id)
      using errcode = 'exclusion_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_salle_seance_evenement() from public, anon, authenticated;
create trigger seances_salle_evenements before insert or update of salle_id, semaine_du, jour, heure_debut, heure_fin on public.seances
  for each row execute function private.controler_salle_seance_evenement();
create trigger evenements_salle_seances before insert or update of salle_id, date, heure_debut, heure_fin on public.evenements
  for each row execute function private.controler_salle_seance_evenement();

-- ——— 2. Notifications de l'emploi du temps —————————————————————————————————————————————————

-- Écrit une notification ; avec un groupe, une notification non lue du même groupe est complétée
-- (« {n} » remplacé par le nombre) au lieu d'être doublée. Réservé aux fonctions de la base.
create function private.envoyer_notification(p_destinataire uuid, p_message text, p_groupe text default null, p_message_groupe text default null)
returns void
language sql volatile security definer set search_path = ''
as $$
  insert into public.notifications as n (destinataire, message, groupe)
  values (p_destinataire, left(p_message, 1000), p_groupe)
  on conflict (destinataire, groupe) where groupe is not null and not lue
  do update set
    nombre = n.nombre + 1,
    message = left(replace(coalesce(p_message_groupe, p_message), '{n}', (n.nombre + 1)::text), 1000),
    cree_le = now()
$$;
revoke execute on function private.envoyer_notification(uuid, text, text, text) from public, anon, authenticated;

-- « mercredi 04/11 à 14:00 », comme dans l'application.
create function private.libelle_creneau(p_semaine_du date, p_jour smallint, p_heure text)
returns text
language sql stable set search_path = ''
as $$
  select (array['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'])[p_jour] || ' '
    || to_char(p_semaine_du + (p_jour - 1), 'DD/MM') || ' à ' || p_heure
$$;
revoke execute on function private.libelle_creneau(date, smallint, text) from public, anon, authenticated;

create function private.notifier_emploi_du_temps()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actif boolean;
  v_etudiants boolean;
  v_professeurs boolean;
  v_seance public.seances;
  v_profs text[];
  v_details text[] := '{}';
  v_avant text;
  v_apres text;
  v_message_etudiant text;
  v_message_prof text;
  v_groupe text;
  v_groupe_etudiant text;
  v_groupe_prof text;
  v_compte uuid;
begin
  select coalesce(n.actif, true), coalesce(n.envoyer_etudiant, true), coalesce(n.envoyer_professeur, true)
    into v_actif, v_etudiants, v_professeurs
    from (select 1) x
    left join public.notifications_evenementielles n on n.code = 'NOTIFICATION_UPDATE_EDT';
  if not v_actif then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_seance := new;
    v_profs := array[new.prof_id];
    v_apres := private.libelle_creneau(new.semaine_du, new.jour, new.heure_debut);
    v_message_etudiant := format('Emploi du temps : %s le %s — %s', new.ec, v_apres, new.salle);
    v_message_prof := format('Nouveau créneau : %s — %s — %s — %s', new.ec, new.classe, v_apres, new.salle);
    v_groupe := 'edt-nouveaux-creneaux';
    v_groupe_etudiant := format('Emploi du temps : {n} nouveaux créneaux ajoutés — dernier : %s le %s', new.ec, v_apres);
    v_groupe_prof := format('{n} nouveaux créneaux à votre emploi du temps — dernier : %s — %s — %s', new.ec, new.classe, v_apres);
  elsif tg_op = 'UPDATE' then
    v_seance := new;
    v_profs := array[new.prof_id, old.prof_id];
    v_avant := private.libelle_creneau(old.semaine_du, old.jour, old.heure_debut) || '–' || old.heure_fin;
    v_apres := private.libelle_creneau(new.semaine_du, new.jour, new.heure_debut) || '–' || new.heure_fin;
    if v_avant <> v_apres then
      v_details := v_details || (v_avant || ' → ' || v_apres);
    end if;
    if old.salle_id is distinct from new.salle_id then
      v_details := v_details || format('salle %s → %s', old.salle, new.salle);
    end if;
    if old.prof_id is distinct from new.prof_id then
      v_details := v_details || format('professeur %s → %s', old.prof, new.prof);
    end if;
    if old.type is distinct from new.type then
      v_details := v_details || format('type %s → %s', old.type, new.type);
    end if;
    if cardinality(v_details) = 0 then
      return null;
    end if;
    v_message_etudiant := format('Cours modifié : %s — %s', new.ec, array_to_string(v_details, ' ; '));
    v_message_prof := format('Séance modifiée : %s — %s — %s', new.ec, new.classe, array_to_string(v_details, ' ; '));
  else
    v_seance := old;
    v_profs := array[old.prof_id];
    v_avant := private.libelle_creneau(old.semaine_du, old.jour, old.heure_debut);
    v_message_etudiant := format('Cours annulé : %s du %s — %s.', old.ec, v_avant, old.salle);
    v_message_prof := format('Séance annulée : %s — %s — %s.', old.ec, old.classe, v_avant);
  end if;

  if v_etudiants then
    for v_compte in
      select c.id from public.comptes c
      join public.etudiants e on e.id = c.lien_id
      where c.type_compte = 'etudiant' and c.actif and e.classe_id = v_seance.classe_id
    loop
      perform private.envoyer_notification(v_compte, v_message_etudiant, v_groupe, v_groupe_etudiant);
    end loop;
  end if;
  if v_professeurs then
    for v_compte in
      select c.id from public.comptes c
      where c.type_compte = 'enseignant' and c.actif and c.lien_id = any (v_profs)
    loop
      perform private.envoyer_notification(v_compte, v_message_prof, v_groupe, v_groupe_prof);
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function private.notifier_emploi_du_temps() from public, anon, authenticated;
create trigger seances_notification after insert or update or delete on public.seances
  for each row execute function private.notifier_emploi_du_temps();
