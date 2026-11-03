-- Partie 10, lot 3 : sauvegardes hors de Supabase (l'offre gratuite n'en fait aucune).
-- La fonction serveur « sauvegarde » produit le fichier ; la base garde la trace de chaque
-- sauvegarde terminée (rappel au-delà de 7 jours) et le journal note chaque export, réussi ou non.

create table private.sauvegardes (
  id bigint generated always as identity primary key,
  le timestamptz not null default now(),
  par uuid not null,
  octets bigint not null check (octets > 0),
  fichiers integer not null check (fichiers >= 0)
);
alter table private.sauvegardes enable row level security;
revoke all on private.sauvegardes from public, anon, authenticated;

-- Appelées par la fonction serveur seulement (propriétaire de la base), jamais par un compte.
create function private.noter_export(p_par uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.acces_complet_de(p_par) then
    raise exception 'La sauvegarde est réservée à un administrateur à accès complet.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.journal_audit (acteur, action, cible_type, details)
  values (p_par, 'export_sauvegarde', 'base', 'données exportées pour une sauvegarde (mots de passe chiffrés compris)');
end;
$$;

create function private.noter_sauvegarde(p_par uuid, p_octets bigint, p_fichiers integer)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.acces_complet_de(p_par) then
    raise exception 'La sauvegarde est réservée à un administrateur à accès complet.' using errcode = 'insufficient_privilege';
  end if;
  if p_octets is null or p_octets <= 0 or p_fichiers is null or p_fichiers < 0 then
    raise exception 'Sauvegarde incomplète : rien n''est noté.' using errcode = 'check_violation';
  end if;
  insert into private.sauvegardes (par, octets, fichiers) values (p_par, p_octets, p_fichiers);
  insert into public.journal_audit (acteur, action, cible_type, details)
  values (p_par, 'sauvegarde', 'base', format('sauvegarde chiffrée de %s octets, %s fichier(s)', p_octets, p_fichiers));
end;
$$;
revoke execute on function private.noter_export(uuid), private.noter_sauvegarde(uuid, bigint, integer) from public, anon, authenticated;

-- L'état du service donne aussi la date de la dernière sauvegarde.
create or replace function public.etat_service()
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
    'derniere_veille', (select max(m.mesure_le) from private.mesures_service m),
    'derniere_sauvegarde', (select max(s.le) from private.sauvegardes s)
  );
end;
$$;
revoke execute on function public.etat_service() from public, anon;
grant execute on function public.etat_service() to authenticated;
