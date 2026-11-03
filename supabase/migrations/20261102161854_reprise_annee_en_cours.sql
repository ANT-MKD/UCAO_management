-- Partie 9, lot 3 : reprise de l'année en cours depuis les données d'un poste.
--
-- Avant la base, chaque poste gardait ses données dans le navigateur ; à son premier chargement
-- avec la base, elles ont été mises de côté (sauvegarde du poste). La reprise les verse une fois,
-- dans une base neuve (juste après l'installation), à la demande d'un administrateur à accès
-- complet :
--   - la fonction serveur « reprise » se connecte en propriétaire de la base et passe sa
--     transaction en mode « replica » : les déclencheurs (contrôles, notifications, numérotation,
--     journal ligne à ligne) ne jouent pas, les lignes entrent telles qu'elles ont été saisies ;
--   - seules les lignes de l'année en cours sont gardées dans les tables de l'année (étudiants
--     inscrits, classes, notes, emploi du temps…) ; les pièces financières des étudiants gardés le
--     sont en entier, leur solde en dépend ;
--   - une ligne qui enfreint une règle de la base (valeur hors limites, doublon) est écartée et
--     listée avec son motif ;
--   - les liens sont vérifiés à la fin : une ligne dont le parent manque est écartée, et comptée ;
--   - les comptes des utilisateurs sont recréés (leur mot de passe ne se reprend pas : chacun en
--     choisit un nouveau avec un code remis par l'administration) et leurs anciens identifiants
--     remplacés partout ;
--   - les compteurs de numérotation repartent après les plus grands numéros repris.
-- Le rapport de contrôle détaille, table par table, ce qui est reçu, écarté et repris. Un essai
-- (même traitement, annulé) le donne avant la reprise réelle.

-- ——— 1. Trace des reprises ————————————————————————————————————————————————————————————————————

create table private.reprises (
  id bigint generated always as identity primary key,
  le timestamptz not null default now(),
  par uuid not null,
  annee text not null,
  rapport jsonb not null
);
comment on table private.reprises is 'Reprise des données d''un poste : une seule, avec son rapport de contrôle.';
alter table private.reprises enable row level security;
revoke all on private.reprises from public, anon, authenticated;

-- Tables de l'année : seules leurs lignes de l'année en cours sont reprises.
create function private.tables_de_l_annee()
returns text[]
language sql immutable set search_path = ''
as $$
  select array['abandons', 'absences_enseignants', 'absences_periodes', 'attestations', 'bulletin_generations', 'cahiers',
    'classes', 'contrats_enseignants', 'declassement_parametres', 'deliberations', 'deliberations_annuelles', 'etudiants',
    'evaluations', 'grilles_frais', 'groupes_internes', 'inscriptions', 'notes', 'pointages', 'rallonges', 'reglements_calcul',
    'reglements_calcul_versions', 'releves', 'seances', 'statuts_cours_enseignants', 'taux_enseignants', 'volumes_enseignants']
$$;
revoke execute on function private.tables_de_l_annee() from public, anon, authenticated;

-- ——— 2. Reprise ———————————————————————————————————————————————————————————————————————————————
-- p_tables  : { table: [lignes] } (colonnes de la base) ;
-- p_comptes : [{ ancien, id, type_compte, identifiant, nom_affiche, email, telephone, fonction,
--               role_id, lien_id, actif }] — « ancien » : identifiant du compte sur le poste ;
--               « id » : identité Supabase déjà créée (en essai, une identité provisoire est
--               donnée) ; un compte dont l'identifiant existe déjà dans la base est celui-là ;
-- p_ids_pour : tables dont le rapport donne les lignes gardées (fichiers à déposer).
create function private.reprendre(p_annee text, p_tables jsonb, p_comptes jsonb, p_par uuid, p_essai boolean,
  p_ids_pour text[] default '{}')
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_remplacees constant text[] := array['etablissement', 'annees_academiques', 'portails'];
  v_exclues constant text[] := array['comptes', 'journal_audit', 'notifications', 'codes_pin', 'codes_pin_suivi',
    'demandes_reinitialisation', 'mouvements_solde'];
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_table text;
  v_tables text[];
  v_pleines text[] := '{}';
  v_existe boolean;
  v_lignes jsonb;
  v_colonnes text;
  v_colonne record;
  v_fk record;
  v_n bigint;
  v_tour bigint;
  v_details jsonb := '{}';
  v_liens jsonb := '{}';
  v_refus jsonb := '[]';
  v_carte jsonb := '{}';
  v_entree jsonb;
  v_ancien text;
  v_identifiant text;
  v_type text;
  v_id uuid;
  v_existant uuid;
  v_crees uuid[] := '{}';
  v_existants int := 0;
  v_ecartes jsonb := '[]';
  v_ecartes_ids uuid[] := '{}';
  v_compteurs jsonb;
  v_gardes jsonb := '{}';
  v_reprises bigint := 0;
  v_rapport jsonb;
  v_trigger record;
begin
  if current_setting('session_replication_role') <> 'replica' then
    raise exception 'La reprise se fait par la fonction serveur « reprise ».' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('edumanage:reprise'));
  if not exists (select 1 from public.comptes c where c.id = p_par and c.actif and c.type_compte = 'administration' and c.role_id is null) then
    raise exception 'La reprise est réservée à un administrateur à accès complet.' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from private.reprises) then
    raise exception 'La reprise a déjà été faite (%).', (select to_char(r.le at time zone 'UTC', 'DD/MM/YYYY') from private.reprises r order by r.id limit 1)
      using errcode = 'unique_violation';
  end if;
  if coalesce(p_annee, '') !~ '^\d{4}-\d{4}$' then
    raise exception 'Année en cours invalide.' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_tables) is distinct from 'object' or jsonb_typeof(p_comptes) is distinct from 'array' then
    raise exception 'Données de reprise illisibles.' using errcode = 'check_violation';
  end if;

  select coalesce(array_agg(k order by k), '{}') into v_tables from jsonb_object_keys(p_tables) k;
  select array_agg(k) into v_pleines from unnest(v_tables) k
  where k = any (v_exclues) or not exists (select 1 from pg_catalog.pg_tables t where t.schemaname = 'public' and t.tablename = k)
     or jsonb_typeof(p_tables -> k) <> 'array';
  if v_pleines is not null then
    raise exception 'Tables qui ne se reprennent pas : %.', array_to_string(v_pleines, ', ') using errcode = 'check_violation';
  end if;
  v_pleines := '{}';

  -- Base neuve : seules l'installation (établissement, année, portails, administrateurs) y a écrit.
  foreach v_table in array v_tables loop
    continue when v_table = any (v_remplacees);
    execute format('select exists (select 1 from public.%I)', v_table) into v_existe;
    if v_existe then
      v_pleines := v_pleines || v_table;
    end if;
  end loop;
  if exists (select 1 from public.comptes c where c.type_compte <> 'administration') then
    v_pleines := v_pleines || 'comptes'::text;
  end if;
  if cardinality(v_pleines) > 0 then
    raise exception 'La base contient déjà des données (%) : la reprise se fait dans une base neuve, juste après l''installation.',
      array_to_string(v_pleines, ', ') using errcode = 'check_violation';
  end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(p_tables -> 'annees_academiques', '[]')) a where a ->> 'libelle' = p_annee) then
    raise exception 'L''année % est absente des données de ce poste.', p_annee using errcode = 'check_violation';
  end if;

  -- 1. Comptes : ceux qui existent déjà (même identifiant) sont repris tels quels ; les autres sont
  --    créés, avec un mot de passe à choisir.
  for v_entree in select e from jsonb_array_elements(p_comptes) e loop
    v_ancien := nullif(trim(coalesce(v_entree ->> 'ancien', '')), '');
    v_identifiant := upper(trim(coalesce(v_entree ->> 'identifiant', '')));
    v_type := coalesce(v_entree ->> 'type_compte', '');
    v_id := case when coalesce(v_entree ->> 'id', '') ~* v_uuid then (v_entree ->> 'id')::uuid end;
    if v_ancien is null or v_carte ? v_ancien then
      v_ecartes := v_ecartes || jsonb_build_object('ancien', v_ancien, 'identifiant', v_identifiant, 'motif', 'compte en double sur le poste');
    elsif v_identifiant = '' then
      v_ecartes := v_ecartes || jsonb_build_object('ancien', v_ancien, 'identifiant', v_identifiant, 'motif', 'identifiant vide');
    else
      select c.id into v_existant from public.comptes c where c.identifiant = v_identifiant;
      if v_existant is not null and not (v_existant = any (v_crees)) then
        v_carte := v_carte || jsonb_build_object(v_ancien, v_existant);
        v_existants := v_existants + 1;
        if v_id is not null and v_id <> v_existant then
          v_ecartes_ids := v_ecartes_ids || v_id;
        end if;
        continue;
      end if;
      if v_existant is not null then
        v_ecartes := v_ecartes || jsonb_build_object('ancien', v_ancien, 'identifiant', v_identifiant, 'motif', 'identifiant en double');
      elsif v_type not in ('administration', 'enseignant', 'etudiant') then
        v_ecartes := v_ecartes || jsonb_build_object('ancien', v_ancien, 'identifiant', v_identifiant, 'motif', 'type de compte inconnu');
      elsif v_type <> 'administration' and coalesce(v_entree ->> 'lien_id', '') = '' then
        v_ecartes := v_ecartes || jsonb_build_object('ancien', v_ancien, 'identifiant', v_identifiant, 'motif', 'compte sans fiche');
      elsif v_type <> 'administration' and exists (select 1 from public.comptes c where c.type_compte = v_type and c.lien_id = v_entree ->> 'lien_id') then
        v_ecartes := v_ecartes || jsonb_build_object('ancien', v_ancien, 'identifiant', v_identifiant, 'motif', 'fiche déjà rattachée à un autre compte');
      else
        if v_id is null then
          if not p_essai then
            raise exception 'Compte % sans identité.', v_identifiant using errcode = 'check_violation';
          end if;
          v_id := gen_random_uuid();
        end if;
        insert into public.comptes (id, type_compte, identifiant, nom_affiche, email, telephone, fonction, role_id, lien_id, actif,
          doit_changer_mot_de_passe)
        values (v_id, v_type, v_identifiant, coalesce(nullif(trim(coalesce(v_entree ->> 'nom_affiche', '')), ''), v_identifiant),
          lower(trim(coalesce(v_entree ->> 'email', ''))), trim(coalesce(v_entree ->> 'telephone', '')),
          trim(coalesce(v_entree ->> 'fonction', '')),
          case when v_type = 'administration' then nullif(v_entree ->> 'role_id', '') end,
          case when v_type <> 'administration' then v_entree ->> 'lien_id' end,
          coalesce((v_entree ->> 'actif')::boolean, true), true);
        v_crees := v_crees || v_id;
        v_carte := v_carte || jsonb_build_object(v_ancien, v_id);
        continue;
      end if;
      if v_id is not null then
        v_ecartes_ids := v_ecartes_ids || v_id;
      end if;
    end if;
  end loop;

  -- 2. Lignes, table par table : anciens identifiants de comptes remplacés, colonnes de la base
  --    seulement (les autres prennent leur valeur par défaut).
  foreach v_table in array v_tables loop
    v_lignes := p_tables -> v_table;
    v_details := v_details || jsonb_build_object(v_table, jsonb_build_object('recues', jsonb_array_length(v_lignes),
      'comptes_inconnus', 0, 'refusees', 0, 'autre_annee', 0, 'liens_manquants', 0));
    for v_colonne in
      select a.attname::text as nom, not a.attnotnull as facultative
      from pg_catalog.pg_attribute a
      where a.attrelid = format('public.%I', v_table)::regclass and a.attnum > 0 and not a.attisdropped
        and a.atttypid = 'uuid'::regtype and a.attname <> 'id'
    loop
      with lignes as (
        select l, l ->> v_colonne.nom as valeur from jsonb_array_elements(v_lignes) l
      ), jugees as (
        select l, valeur,
          case
            when valeur is null then 'gardee'
            when v_carte ? valeur then 'remplacee'
            when valeur ~* v_uuid and exists (select 1 from public.comptes c where c.id = valeur::uuid) then 'gardee'
            when v_colonne.facultative then 'videe'
            else 'ecartee'
          end as sort
        from lignes
      )
      select coalesce(jsonb_agg(case sort
               when 'remplacee' then jsonb_set(l, array[v_colonne.nom], v_carte -> valeur)
               when 'videe' then jsonb_set(l, array[v_colonne.nom], 'null'::jsonb)
               else l end) filter (where sort <> 'ecartee'), '[]'::jsonb),
             count(*) filter (where sort in ('videe', 'ecartee'))
        into v_lignes, v_n
      from jugees;
      if v_n > 0 then
        v_details := jsonb_set(v_details, array[v_table, 'comptes_inconnus'],
          to_jsonb((v_details #>> array[v_table, 'comptes_inconnus'])::bigint + v_n));
      end if;
    end loop;

    select string_agg(format('%I', a.attname), ', ' order by a.attnum) into v_colonnes
    from pg_catalog.pg_attribute a
    where a.attrelid = format('public.%I', v_table)::regclass and a.attnum > 0 and not a.attisdropped
      and a.attgenerated = '' and a.attidentity = ''
      and exists (select 1 from jsonb_array_elements(v_lignes) l where l ? a.attname);

    if v_table = any (v_remplacees) then
      execute format('delete from public.%I', v_table);
    end if;
    if v_colonnes is not null then
      begin
        execute format('insert into public.%I (%s) select %s from pg_catalog.jsonb_populate_recordset(null::public.%I, $1)',
          v_table, v_colonnes, v_colonnes, v_table) using v_lignes;
      exception when others then
        -- Une ligne au moins enfreint une règle de la base : ligne par ligne, celles qui sont
        -- refusées sont écartées et listées avec leur motif.
        for v_entree in select l from jsonb_array_elements(v_lignes) l loop
          begin
            execute format('insert into public.%I (%s) select %s from pg_catalog.jsonb_populate_record(null::public.%I, $1)',
              v_table, v_colonnes, v_colonnes, v_table) using v_entree;
          exception when others then
            v_details := jsonb_set(v_details, array[v_table, 'refusees'], to_jsonb((v_details #>> array[v_table, 'refusees'])::bigint + 1));
            if jsonb_array_length(v_refus) < 500 then
              v_refus := v_refus || jsonb_build_object('table', v_table, 'id', v_entree ->> 'id', 'motif', sqlerrm);
            end if;
          end;
        end loop;
      end;
    end if;
  end loop;

  if p_tables ? 'annees_academiques' then
    update public.annees_academiques set actuelle = (libelle = p_annee) where actuelle is distinct from (libelle = p_annee);
  end if;

  -- 3. Année en cours : les autres années sont écartées des tables de l'année.
  foreach v_table in array private.tables_de_l_annee() loop
    continue when not (p_tables ? v_table);
    execute format('delete from public.%I where annee is distinct from $1', v_table) using p_annee;
    get diagnostics v_n = row_count;
    v_details := jsonb_set(v_details, array[v_table, 'autre_annee'], to_jsonb(v_n));
  end loop;

  -- 4. Liens : une ligne dont le parent manque (autre année, fiche absente du poste) est écartée,
  --    jusqu'à ce qu'il n'en reste aucune.
  loop
    v_tour := 0;
    for v_fk in
      select c.conname::text as nom, c.conrelid::regclass::text as enfant, c.confrelid::regclass::text as parent,
        e.relname::text as table_enfant,
        (select string_agg(format('e.%I is not null', a.attname), ' and ')
           from unnest(c.conkey) k join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = k) as non_nuls,
        (select string_agg(format('p.%I = e.%I', pa.attname, ea.attname), ' and ')
           from unnest(c.conkey, c.confkey) as k(ek, pk)
           join pg_catalog.pg_attribute ea on ea.attrelid = c.conrelid and ea.attnum = k.ek
           join pg_catalog.pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = k.pk) as jointure
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_class e on e.oid = c.conrelid
      join pg_catalog.pg_class p on p.oid = c.confrelid
      where c.contype = 'f' and e.relnamespace = 'public'::regnamespace and p.relnamespace = 'public'::regnamespace
      order by c.conname
    loop
      execute format('delete from %s e where %s and not exists (select 1 from %s p where %s)',
        v_fk.enfant, v_fk.non_nuls, v_fk.parent, v_fk.jointure);
      get diagnostics v_n = row_count;
      if v_n > 0 then
        v_tour := v_tour + v_n;
        v_liens := v_liens || jsonb_build_object(v_fk.nom, coalesce((v_liens ->> v_fk.nom)::bigint, 0) + v_n);
        if v_details ? v_fk.table_enfant then
          v_details := jsonb_set(v_details, array[v_fk.table_enfant, 'liens_manquants'],
            to_jsonb((v_details #>> array[v_fk.table_enfant, 'liens_manquants'])::bigint + v_n));
        end if;
      end if;
    end loop;
    -- Comptes d'étudiants et de professeurs dont la fiche n'est pas reprise.
    with ecartes as (
      delete from public.comptes c
      where c.id = any (v_crees)
        and ((c.type_compte = 'etudiant' and not exists (select 1 from public.etudiants e where e.id = c.lien_id))
          or (c.type_compte = 'enseignant' and not exists (select 1 from public.enseignants e where e.id = c.lien_id)))
      returning c.id, c.identifiant
    )
    select count(*), coalesce(jsonb_agg(jsonb_build_object('identifiant', identifiant, 'motif', 'fiche non reprise (autre année)')), '[]')
      into v_n, v_entree
    from ecartes;
    v_ecartes := v_ecartes || v_entree;
    v_tour := v_tour + v_n;
    exit when v_tour = 0;
  end loop;
  -- Identités créées pour des comptes qui ne sont finalement pas repris : à supprimer.
  v_ecartes_ids := v_ecartes_ids || array(select x from unnest(v_crees) x where not exists (select 1 from public.comptes c where c.id = x));
  v_crees := array(select x from unnest(v_crees) x where exists (select 1 from public.comptes c where c.id = x));

  -- 5. Compteurs de numérotation : après les plus grands numéros repris.
  if to_regclass('pg_temp.numeros_repris') is not null then
    drop table pg_temp.numeros_repris;
  end if;
  create temporary table numeros_repris (cle text, valeur bigint) on commit drop;
  insert into pg_temp.numeros_repris
    select 'matricule:' || substring(e.matricule from '^(.*)-[0-9]+$'), substring(e.matricule from '-([0-9]+)$')::bigint
    from public.etudiants e where e.matricule ~ '^.+-[0-9]+$'
    union all
    select 'contrat', substring(c.id from '^CTR-([0-9]+)$')::bigint from public.contrats_enseignants c where c.id ~ '^CTR-[0-9]+$'
    union all
    select 'generation-bulletins:' || substring(g.numero from '^GB-([0-9]{4})-'), substring(g.numero from '([0-9]+)$')::bigint
    from public.bulletin_generations g where g.numero ~ '^GB-[0-9]{4}-[0-9]+$'
    union all
    select 'attestation:' || substring(a.numero from '^ATT-([0-9]{4})-'), substring(a.numero from '([0-9]+)$')::bigint
    from public.attestations a where a.numero ~ '^ATT-[0-9]{4}-[0-9]+$';
  for v_trigger in
    select c.relname::text as nom_table,
      (string_to_array(encode(t.tgargs, 'escape'), '\000'))[1] as colonne,
      (string_to_array(encode(t.tgargs, 'escape'), '\000'))[2] as prefixe
    from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid
    where t.tgfoid = 'private.numeroter_piece'::regproc and c.relnamespace = 'public'::regnamespace
  loop
    execute format('insert into pg_temp.numeros_repris select %L || substring(%I from %L), substring(%I from ''([0-9]+)$'')::bigint from public.%I where %I ~ %L',
      lower(v_trigger.prefixe) || ':', v_trigger.colonne, '^' || v_trigger.prefixe || '-([0-9]{4})-', v_trigger.colonne,
      v_trigger.nom_table, v_trigger.colonne, '^' || v_trigger.prefixe || '-[0-9]{4}-[0-9]+$');
  end loop;
  with maximums as (
    insert into private.compteurs as k (cle, valeur)
    select n.cle, max(n.valeur) from pg_temp.numeros_repris n group by n.cle
    on conflict (cle) do update set valeur = greatest(k.valeur, excluded.valeur)
    returning k.cle, k.valeur
  )
  select coalesce(jsonb_object_agg(cle, valeur), '{}') into v_compteurs from maximums;

  -- 6. Compte rendu, table par table ; les postes connectés rechargent tout.
  foreach v_table in array v_tables loop
    execute format('select count(*) from public.%I', v_table) into v_n;
    v_details := jsonb_set(v_details, array[v_table, 'reprises'], to_jsonb(v_n));
    v_reprises := v_reprises + v_n;
    if v_table = any (p_ids_pour) then
      execute format('select coalesce(jsonb_agg(id), ''[]'') from public.%I', v_table) into v_lignes;
      v_gardes := v_gardes || jsonb_build_object(v_table, v_lignes);
    end if;
    if to_regclass(format('private.%I', 'version_' || v_table)) is not null then
      perform nextval(format('private.%I', 'version_' || v_table)::regclass);
    end if;
  end loop;
  perform nextval('private.version_comptes'::regclass);

  v_rapport := jsonb_build_object(
    'annee', p_annee,
    'essai', p_essai,
    'tables', v_details,
    'liens', v_liens,
    'refus', v_refus,
    'lignes_reprises', v_reprises,
    'comptes', jsonb_build_object('recus', jsonb_array_length(p_comptes), 'existants', v_existants,
      'crees', cardinality(v_crees), 'ecartes', v_ecartes,
      'a_creer', (select coalesce(jsonb_agg(k.key), '[]') from jsonb_each_text(v_carte) k where k.value::uuid = any (v_crees))),
    'ecartes_ids', to_jsonb(v_ecartes_ids),
    'compteurs', v_compteurs,
    'gardes', v_gardes);

  insert into public.journal_audit (acteur, action, cible_type, cible_id, details)
  values (p_par, 'reprise_donnees', 'etablissement', p_annee,
    format('%s lignes reprises, %s comptes créés', v_reprises, cardinality(v_crees)));
  insert into private.reprises (par, annee, rapport) values (p_par, p_annee, v_rapport - 'gardes' - 'ecartes_ids');
  return v_rapport;
end;
$$;
revoke execute on function private.reprendre(text, jsonb, jsonb, uuid, boolean, text[]) from public, anon, authenticated, service_role;

-- ——— 3. État de la reprise, pour l'écran de l'administration ——————————————————————————————————

create function public.etat_reprise()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select private.a_acces_complet()) then
    raise exception 'La reprise est réservée à un administrateur à accès complet.' using errcode = 'insufficient_privilege';
  end if;
  return (select jsonb_build_object('le', r.le, 'annee', r.annee, 'rapport', r.rapport)
          from private.reprises r order by r.id desc limit 1);
end;
$$;
revoke execute on function public.etat_reprise() from public, anon;
grant execute on function public.etat_reprise() to authenticated;
