-- En-tête et pied de page des documents scolaires (attestations, relevés et bulletins,
-- procès-verbaux de délibération), réglés dans Paramètres généraux → Documents officiels.
--
--   entete_forme : « standard » (présentation livrée avec l'application), « banniere » (une image
--                  qui contient tout l'en-tête : logos, textes, cadre) ou « compose » (logo de
--                  l'établissement à gauche, logo de droite, lignes de texte au centre) ;
--   banniere_chemin, logo_droit_chemin : images de l'espace de fichiers « etablissement », dossier
--                  entete/ ;
--   entete_lignes : au plus 6 lignes { texte, taille, style, couleur } ;
--   entete_cadre  : cadre autour de l'en-tête composé ;
--   pied_lignes   : au plus 3 lignes de texte en bas de page ;
--   ville         : ville de « Fait à …, le … » (sinon le début de l'adresse).
-- Mêmes droits que le reste de l'identité : lue par tous les comptes connectés (documents),
-- modifiée par qui a la page « Paramètres généraux ».

-- ——— Contrôles du contenu ———————————————————————————————————————————————————————————————————

create function private.entete_lignes_valides(p_lignes jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(p_lignes) = 'array' and jsonb_array_length(p_lignes) <= 6
    and not exists (
      select 1 from jsonb_array_elements(p_lignes) l
      where case when jsonb_typeof(l) <> 'object' then true else
        jsonb_typeof(l -> 'texte') is distinct from 'string'
        or length(l ->> 'texte') > 120
        or coalesce(l ->> 'taille', '') not in ('grande', 'moyenne', 'petite')
        or coalesce(l ->> 'style', '') not in ('gras', 'normal', 'italique')
        or coalesce(l ->> 'couleur', '') not in ('noir', 'bleu', 'bordeaux')
        or exists (select 1 from jsonb_object_keys(l) k where k not in ('texte', 'taille', 'style', 'couleur'))
      end)
$$;

create function private.pied_lignes_valides(p_lignes jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(p_lignes) = 'array' and jsonb_array_length(p_lignes) <= 3
    and not exists (
      select 1 from jsonb_array_elements(p_lignes) l
      where jsonb_typeof(l) <> 'string' or length(l #>> '{}') > 160)
$$;

revoke execute on function private.entete_lignes_valides(jsonb), private.pied_lignes_valides(jsonb) from public, anon;
grant execute on function private.entete_lignes_valides(jsonb), private.pied_lignes_valides(jsonb) to authenticated, service_role;

-- ——— Colonnes de l'établissement ————————————————————————————————————————————————————————————

alter table public.etablissement
  add column entete_forme text not null default 'standard'
    constraint etablissement_entete_forme check (entete_forme in ('standard', 'banniere', 'compose')),
  add column banniere_chemin text
    constraint etablissement_banniere_chemin check (banniere_chemin is null or starts_with(banniere_chemin, 'entete/')),
  add column logo_droit_chemin text
    constraint etablissement_logo_droit_chemin check (logo_droit_chemin is null or starts_with(logo_droit_chemin, 'entete/')),
  add column entete_lignes jsonb not null default '[]'
    constraint etablissement_entete_lignes check (private.entete_lignes_valides(entete_lignes)),
  add column entete_cadre boolean not null default true,
  add column pied_lignes jsonb not null default '[]'
    constraint etablissement_pied_lignes check (private.pied_lignes_valides(pied_lignes)),
  add column ville text not null default ''
    constraint etablissement_ville check (length(ville) <= 60);

grant update (entete_forme, banniere_chemin, logo_droit_chemin, entete_lignes, entete_cadre, pied_lignes, ville)
  on public.etablissement to authenticated;

-- ——— Espace de fichiers : le dossier entete/ s'ajoute au logo et aux signatures ——————————————

create or replace function private.ecrit_fichier_etablissement(p_nom text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(case (storage.foldername(p_nom))[1]
    when 'logo' then array_length(storage.foldername(p_nom), 1) = 1
    when 'entete' then array_length(storage.foldername(p_nom), 1) = 1
    when 'signatures' then array_length(storage.foldername(p_nom), 1) = 2
    else false
  end and private.a_acces_page('sec-settings'), false)
$$;
