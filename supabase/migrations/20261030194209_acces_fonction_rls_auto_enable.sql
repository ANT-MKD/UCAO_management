-- Fonction posée par Supabase à la création du projet (elle active les règles d'accès sur chaque
-- nouvelle table du schéma public). Créée avant que la partie 1 ne ferme les droits par défaut,
-- elle restait exécutable par les visiteurs et les comptes connectés via l'API. Son déclencheur
-- n'a pas besoin de ces droits : on les retire. Absente d'une base qui n'est pas un projet
-- Supabase, d'où le test d'existence.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
