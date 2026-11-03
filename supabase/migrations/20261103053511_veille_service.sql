-- Partie 10, lot 3 : compenser l'offre gratuite de Supabase (veille).
-- • public.veille() : la visite quotidienne (tâche planifiée Vercel) passe par l'API de la base, ce
--   qui empêche la mise en pause du projet après 7 jours sans activité, vacances comprises. Elle
--   mesure au passage l'espace occupé (au plus une fois par heure, une ligne par jour, 400 jours
--   gardés) ; elle ne rend rien d'autre que « ok ».
-- • public.etat_service() : espace occupé (base, fichiers) face aux limites de l'offre gratuite et
--   date de la dernière visite, pour l'alerte du tableau de bord. Accès complet seulement.

create table private.mesures_service (
  jour date primary key,
  base_octets bigint not null,
  fichiers_octets bigint not null,
  fichiers_nombre bigint not null,
  mesure_le timestamptz not null default now()
);
alter table private.mesures_service enable row level security;
revoke all on private.mesures_service from public, anon, authenticated;

-- Espace occupé par les fichiers (taille déclarée par l'espace de fichiers).
create function private.espace_fichiers()
returns table (octets bigint, nombre bigint)
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(case when (o.metadata ->> 'size') ~ '^[0-9]+$' then (o.metadata ->> 'size')::bigint else 0 end), 0)::bigint,
         count(*)::bigint
  from storage.objects o
$$;
revoke execute on function private.espace_fichiers() from public, anon, authenticated;

create function public.veille()
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_derniere timestamptz;
  v_fichiers record;
begin
  select m.mesure_le into v_derniere from private.mesures_service m where m.jour = current_date;
  if v_derniere is null or v_derniere < now() - interval '1 hour' then
    select * into v_fichiers from private.espace_fichiers();
    insert into private.mesures_service (jour, base_octets, fichiers_octets, fichiers_nombre, mesure_le)
    values (current_date, pg_database_size(current_database()), v_fichiers.octets, v_fichiers.nombre, now())
    on conflict (jour) do update
      set base_octets = excluded.base_octets, fichiers_octets = excluded.fichiers_octets,
          fichiers_nombre = excluded.fichiers_nombre, mesure_le = excluded.mesure_le;
    delete from private.mesures_service m where m.jour < current_date - 400;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.veille() from public;
grant execute on function public.veille() to anon, authenticated;

create function public.etat_service()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_fichiers record;
begin
  if not (select private.a_acces_complet()) then
    raise exception 'L''état du service est réservé à un administrateur à accès complet.' using errcode = 'insufficient_privilege';
  end if;
  select * into v_fichiers from private.espace_fichiers();
  return jsonb_build_object(
    'base_octets', pg_database_size(current_database()),
    'base_limite', 500000000,
    'fichiers_octets', v_fichiers.octets,
    'fichiers_nombre', v_fichiers.nombre,
    'fichiers_limite', 1000000000,
    'derniere_veille', (select max(m.mesure_le) from private.mesures_service m)
  );
end;
$$;
revoke execute on function public.etat_service() from public, anon;
grant execute on function public.etat_service() to authenticated;
