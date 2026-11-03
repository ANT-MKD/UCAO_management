-- Partie 8, lot 1 (complément) : l'annuaire de l'administration porte aussi l'identifiant de
-- connexion, le rôle, le téléphone et l'état du mot de passe de chaque compte — ce qu'elle lit déjà
-- dans les comptes — pour les écrans qui les affichent (envoi des identifiants, rôles, journal…).
-- Les autres comptes ne reçoivent ces détails que pour eux-mêmes.

drop function public.annuaire();
create function public.annuaire()
returns table (id uuid, type_compte text, identifiant text, nom_affiche text, fonction text, lien_id text, role_id text, actif boolean,
  email text, telephone text, doit_changer_mot_de_passe boolean, mot_de_passe_change_le timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_type text := (select private.type_compte_courant());
begin
  if v_type is null then
    raise exception 'Connectez-vous avec un compte actif.' using errcode = 'insufficient_privilege';
  end if;
  if v_type = 'administration' then
    return query
      select c.id, c.type_compte, c.identifiant, c.nom_affiche, c.fonction, c.lien_id, c.role_id, c.actif, c.email, c.telephone,
        c.doit_changer_mot_de_passe, c.mot_de_passe_change_le
      from public.comptes c order by c.id;
    return;
  end if;
  return query
    select c.id, c.type_compte, case when c.id = v_moi then c.identifiant else '' end, c.nom_affiche,
      case when c.type_compte = 'administration' or c.id = v_moi then c.fonction else '' end,
      c.lien_id, case when c.id = v_moi then c.role_id end, c.actif,
      case when c.id = v_moi then c.email else '' end, case when c.id = v_moi then c.telephone else '' end,
      c.id = v_moi and c.doit_changer_mot_de_passe, case when c.id = v_moi then c.mot_de_passe_change_le end
    from public.comptes c
    where c.id = v_moi
      or (c.actif and c.type_compte = 'administration')
      or (v_type = 'enseignant' and c.actif and c.type_compte = 'etudiant'
          and c.lien_id in (select e.id from public.etudiants e
                            where e.classe_id = any (private.classes_enseignant()) and e.statut not in ('abandon', 'suspendu')))
      or (v_type = 'etudiant' and c.actif and c.type_compte = 'enseignant'
          and c.lien_id in (select private.enseignants_classe(private.classe_etudiant())))
      or c.id in (select m.expediteur from public.messages m where m.destinataire = v_moi)
      or c.id in (select m.destinataire from public.messages m where m.expediteur = v_moi)
    order by c.id;
end;
$$;
comment on function public.annuaire() is 'Comptes que le compte connecté peut nommer dans sa messagerie (tous, en détail, pour l''administration).';
revoke execute on function public.annuaire() from public, anon;
grant execute on function public.annuaire() to authenticated, service_role;
