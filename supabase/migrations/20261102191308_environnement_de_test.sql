-- Partie 9, lot 4 : environnement de test.
--
-- Le projet de test sert aux campagnes de recette : installation, reprise des données d'un poste,
-- puis scénarios rejoués par l'administration. Entre deux campagnes (par exemple après une
-- correction de la reprise), la base de test doit pouvoir repartir de zéro. Cette remise à zéro
-- n'est possible que sur un projet marqué « test » à la main (jamais par une migration) : sur la
-- production, qui ne porte pas cette marque, elle est refusée. Elle ne s'appelle que par le
-- propriétaire de la base (aucun rôle de l'application n'y a droit) ; les fichiers déposés se
-- retirent depuis le tableau de bord (Storage), Supabase interdisant de les effacer par SQL.

create table private.environnement (
  id boolean primary key default true check (id),
  nom text not null check (nom in ('developpement', 'test', 'production')),
  marque_le timestamptz not null default now()
);
comment on table private.environnement is 'Nature du projet (une ligne, posée à la main) : seule une base « test » se remet à zéro.';
alter table private.environnement enable row level security;
revoke all on private.environnement from public, anon, authenticated;

create function private.remettre_a_zero_test(p_confirmation text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_tables text;
  v_lignes bigint := 0;
  v_n bigint;
  v_table text;
  v_identites bigint;
  v_fichiers bigint;
begin
  if coalesce((select e.nom from private.environnement e), '') <> 'test' then
    raise exception 'Remise à zéro refusée : ce projet n''est pas marqué comme environnement de test.' using errcode = 'insufficient_privilege';
  end if;
  if p_confirmation is distinct from 'REMETTRE A ZERO' then
    raise exception 'Confirmez avec « REMETTRE A ZERO ».' using errcode = 'check_violation';
  end if;

  for v_table in select t.tablename from pg_catalog.pg_tables t where t.schemaname = 'public' loop
    execute format('select count(*) from public.%I', v_table) into v_n;
    v_lignes := v_lignes + v_n;
  end loop;
  select string_agg(format('public.%I', t.tablename), ', ' order by t.tablename) into v_tables
  from pg_catalog.pg_tables t where t.schemaname = 'public';
  execute 'truncate ' || v_tables || ' restart identity cascade';
  truncate private.compteurs, private.reprises, private.tentatives_connexion;
  -- Portails tels que les crée l'installation : ouverts.
  insert into public.portails (type_compte) values ('administration'), ('enseignant'), ('etudiant');

  delete from auth.users;
  get diagnostics v_identites = row_count;
  select count(*) into v_fichiers from storage.objects;

  return jsonb_build_object('lignes_effacees', v_lignes, 'identites_supprimees', v_identites,
    'fichiers_a_retirer', v_fichiers);
end;
$$;
revoke execute on function private.remettre_a_zero_test(text) from public, anon, authenticated, service_role;
