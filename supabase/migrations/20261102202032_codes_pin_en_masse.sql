-- Partie 10, lot 1 : codes PIN en masse.
--
-- Au démarrage, chaque étudiant d'une classe doit choisir son mot de passe : sans e-mail envoyé
-- (pas encore de nom de domaine), l'administration remet à chacun un code, sur une liste imprimée.
-- Cette fonction en génère pour plusieurs comptes à la fois (100 au plus par appel), avec une durée
-- de validité de 1 à 14 jours, le temps de distribuer la liste. Mêmes règles que pour un seul code :
-- mêmes pages d'accès, comptes gérables seulement, code tiré au hasard et gardé chiffré, journal ;
-- le nouveau code d'un compte remplace le précédent (seul le dernier sert). Un compte désactivé ne
-- reçoit pas de code : il figure dans la réponse avec son motif.

create function public.generer_codes_pin(p_comptes uuid[], p_validite_jours integer default 7)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_expire timestamptz;
  v_id uuid;
  v_compte public.comptes;
  v_code text;
  v_resultat jsonb := '[]';
begin
  if not (private.acces_page_de(v_moi, 'sec-pin-activation') or private.acces_page_de(v_moi, 'sec-users')) then
    raise exception 'Vous n''avez pas accès aux codes PIN.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(cardinality(p_comptes), 0) = 0 or cardinality(p_comptes) > 100 then
    raise exception 'Générez les codes de 1 à 100 comptes à la fois.' using errcode = 'check_violation';
  end if;
  if p_validite_jours is null or p_validite_jours not between 1 and 14 then
    raise exception 'La validité d''un code va de 1 à 14 jours.' using errcode = 'check_violation';
  end if;
  v_expire := now() + make_interval(days => p_validite_jours);

  foreach v_id in array (select array_agg(distinct x order by x) from unnest(p_comptes) x where x is not null) loop
    v_compte := private.exiger_compte_gerable(v_id);
    if not v_compte.actif then
      v_resultat := v_resultat || jsonb_build_object('compte', v_id, 'identifiant', v_compte.identifiant,
        'nom_affiche', v_compte.nom_affiche, 'code', null, 'motif', 'compte désactivé');
      continue;
    end if;
    -- Tirage cryptographique (random() serait prévisible), comme pour un code seul.
    v_code := (100000 + ('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 900000)::text;
    insert into public.codes_pin (compte, code_chiffre, expire_le, auteur)
    values (v_id, extensions.crypt(v_code, extensions.gen_salt('bf', 8)), v_expire, v_moi);
    update public.demandes_reinitialisation d set traitee_le = now(), traitee_par = v_moi
    where d.compte = v_id and d.traitee_le is null;
    insert into public.journal_audit (acteur, action, cible_type, cible_id, details)
    values (v_moi, 'generate_pin', 'compte', v_id::text, format('en masse, valable %s jour(s)', p_validite_jours));
    v_resultat := v_resultat || jsonb_build_object('compte', v_id, 'identifiant', v_compte.identifiant,
      'nom_affiche', v_compte.nom_affiche, 'code', v_code, 'expire_le', v_expire);
  end loop;
  return v_resultat;
end;
$$;
revoke execute on function public.generer_codes_pin(uuid[], integer) from public, anon;
grant execute on function public.generer_codes_pin(uuid[], integer) to authenticated;
