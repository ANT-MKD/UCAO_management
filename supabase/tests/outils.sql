-- Outils des tests de la base (chargés après les migrations, jamais sur Supabase).
--   tests.connecter(id)      : la suite s'exécute comme ce compte connecté (rôle authenticated) ;
--   tests.anonyme()          : comme un visiteur non connecté (rôle anon) ;
--   tests.service()          : comme une fonction serveur (clé secrète, rôle service_role) ;
--   tests.deconnecter()      : retour au propriétaire de la base ;
--   tests.verifier(cond, m)  : échoue avec le message m si cond n'est pas vraie ;
--   tests.echoue(sql, motif) : vérifie que l'instruction est refusée, avec un message contenant motif.

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.connecter(p_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

create or replace function tests.anonyme() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  execute 'set role anon';
end $$;

create or replace function tests.service() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  execute 'set role service_role';
end $$;

create or replace function tests.deconnecter() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;

create or replace function tests.verifier(p_condition boolean, p_message text) returns void
language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'ÉCHEC : %', p_message;
  end if;
  raise notice 'ok  %', p_message;
end $$;

create or replace function tests.echoue(p_sql text, p_motif text, p_message text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(lower(p_motif) in lower(sqlerrm)) > 0 then
      raise notice 'ok  % (refusé : %)', p_message, sqlerrm;
      return;
    end if;
    raise exception 'ÉCHEC : % — refusé, mais pour une autre raison : %', p_message, sqlerrm;
  end;
  raise exception 'ÉCHEC : % — l''instruction a été acceptée', p_message;
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;
