-- Textes des attestations réglables par l'établissement (Paramètres généraux → Textes des
-- attestations) : pour chaque attestation (inscription, scolarité, réussite), un titre et des
-- paragraphes écrits librement, où des champs entre accolades ({NOM}, {matricule}…) sont remplacés à
-- l'impression par les informations de l'étudiant. Les données ne sont jamais tapées : seuls les
-- champs connus sont acceptés, et le nom et le matricule de l'étudiant sont obligatoires.
--
-- Un texte délivré ne change plus : à l'émission, la base copie le modèle du moment dans
-- l'attestation (colonne modele), et cette copie ne se modifie jamais, même si le modèle change
-- ensuite. Les attestations émises avant cette migration gardent le texte d'origine de
-- l'application.

-- ——— Champs et contrôle d'un modèle ——————————————————————————————————————————————————————————

-- Champs qu'un texte peut contenir ; l'attestation de réussite a en plus le semestre, la moyenne et
-- la décision du jury.
create function private.champs_attestation(p_type text)
returns text[]
language sql immutable set search_path = ''
as $$
  select array['soussigne', 'signataire', 'qualite', 'etablissement', 'NOM', 'nom', 'matricule', 'Ne', 'ne', 'inscrit',
    'date_naissance', 'lieu_naissance', 'nationalite', 'classe', 'niveau', 'filiere', 'annee']
    || case when p_type = 'reussite' then array['semestre', 'moyenne', 'decision'] else array[]::text[] end
$$;

-- Titre de 1 à 80 caractères ; 1 à 12 paragraphes { texte, centre } de 600 caractères au plus ;
-- aucune accolade hors d'un champ connu ; le nom ({nom} ou {NOM}) et le matricule présents.
create function private.modele_attestation_valide(p_type text, p_titre text, p_paragraphes jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select case when jsonb_typeof(p_paragraphes) is distinct from 'array' then false else
    length(trim(coalesce(p_titre, ''))) between 1 and 80
    and jsonb_array_length(p_paragraphes) between 1 and 12
    and not exists (
      select 1 from jsonb_array_elements(p_paragraphes) p
      where case when jsonb_typeof(p) <> 'object' then true else
        jsonb_typeof(p -> 'texte') is distinct from 'string'
        or length(p ->> 'texte') > 600
        or jsonb_typeof(p -> 'centre') is distinct from 'boolean'
        or exists (select 1 from jsonb_object_keys(p) k where k not in ('texte', 'centre'))
      end)
    and coalesce((
      select regexp_replace(t.texte, '\{(' || array_to_string(private.champs_attestation(p_type), '|') || ')\}', '', 'g') !~ '[{}]'
        and t.texte ~ '\{(nom|NOM)\}' and t.texte ~ '\{matricule\}'
      from (select string_agg(case when jsonb_typeof(p) = 'object' then p ->> 'texte' end, E'\n') as texte
            from jsonb_array_elements(p_paragraphes) p) t), false)
  end
$$;

revoke execute on function private.champs_attestation(text), private.modele_attestation_valide(text, text, jsonb) from public, anon;
grant execute on function private.champs_attestation(text), private.modele_attestation_valide(text, text, jsonb) to authenticated, service_role;

-- ——— Modèles ——————————————————————————————————————————————————————————————————————————————

create table public.modeles_attestations (
  id text primary key check (id in ('inscription', 'scolarite', 'reussite')),
  titre text not null,
  paragraphes jsonb not null,
  constraint modeles_attestations_contenu check (private.modele_attestation_valide(id, titre, paragraphes))
);
comment on table public.modeles_attestations is 'Titre et texte de chaque attestation, réglés par l''établissement.';

create trigger modeles_attestations_journal after insert or update or delete on public.modeles_attestations
  for each row execute function private.journaliser_modification();
select private.suivre_table('modeles_attestations');

-- Lus par tous les comptes connectés (impression) ; écrits par qui a la page Paramètres généraux ;
-- jamais supprimés (le texte d'origine se rétablit en le réécrivant).
alter table public.modeles_attestations enable row level security;
grant select on public.modeles_attestations to authenticated, service_role;
grant insert (id, titre, paragraphes), update (titre, paragraphes) on public.modeles_attestations to authenticated;
grant insert, update on public.modeles_attestations to service_role;
create policy modeles_attestations_lecture on public.modeles_attestations for select to authenticated
  using ((select private.type_compte_courant()) is not null);
create policy modeles_attestations_creation on public.modeles_attestations for insert to authenticated
  with check ((select private.a_acces_page('sec-settings')));
create policy modeles_attestations_modification on public.modeles_attestations for update to authenticated
  using ((select private.a_acces_page('sec-settings')))
  with check ((select private.a_acces_page('sec-settings')));

-- Textes de départ : ceux des documents de l'établissement (certificat d'inscription de l'ISAE
-- Thiès), repris pour la scolarité et la réussite. Les mêmes que MODELES_PAR_DEFAUT de l'application.
insert into public.modeles_attestations (id, titre, paragraphes) values
  ('inscription', 'CERTIFICAT D''INSCRIPTION', '[
    {"texte": "Je soussigné(e), {soussigne}, certifie que :", "centre": false},
    {"texte": "{NOM}", "centre": true},
    {"texte": "{Ne} le {date_naissance} à {lieu_naissance}", "centre": true},
    {"texte": "de nationalité {nationalite}, est {inscrit} dans notre établissement en classe de {niveau} de {filiere}, sous le matricule {matricule}, pour l''année académique {annee}.", "centre": false},
    {"texte": "En foi de quoi, ce présent certificat lui est délivré pour servir et valoir ce que de droit.", "centre": false}
  ]'),
  ('scolarite', 'CERTIFICAT DE SCOLARITÉ', '[
    {"texte": "Je soussigné(e), {soussigne}, certifie que :", "centre": false},
    {"texte": "{NOM}", "centre": true},
    {"texte": "{Ne} le {date_naissance} à {lieu_naissance}", "centre": true},
    {"texte": "matricule {matricule}, est régulièrement {inscrit} dans notre établissement en classe de {niveau} de {filiere} pour l''année académique {annee} et suit assidûment les cours dispensés.", "centre": false},
    {"texte": "En foi de quoi, ce présent certificat lui est délivré pour servir et valoir ce que de droit.", "centre": false}
  ]'),
  ('reussite', 'ATTESTATION DE RÉUSSITE', '[
    {"texte": "Je soussigné(e), {soussigne}, atteste que :", "centre": false},
    {"texte": "{NOM}", "centre": true},
    {"texte": "{Ne} le {date_naissance} à {lieu_naissance}, matricule {matricule}", "centre": true},
    {"texte": "a subi avec succès les épreuves du {semestre} de {filiere} ({classe}), année académique {annee}, avec une moyenne de {moyenne}/20 et la décision du jury : {decision}.", "centre": false},
    {"texte": "En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.", "centre": false}
  ]');

-- ——— Copie figée dans chaque attestation ————————————————————————————————————————————————————

alter table public.attestations add column modele jsonb;
comment on column public.attestations.modele is 'Titre et paragraphes du modèle au moment de l''émission, figés.';

-- À l'émission, le modèle du moment (ce que le poste envoie est ignoré) ; ensuite, jamais modifié.
-- Nommé pour passer avant attestations_controle, qui refuse toute autre modification que l'envoi.
create function private.figer_modele_attestation()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.modele := old.modele;
  else
    new.modele := (select jsonb_build_object('titre', m.titre, 'paragraphes', m.paragraphes)
                   from public.modeles_attestations m where m.id = new.type);
  end if;
  return new;
end;
$$;
revoke execute on function private.figer_modele_attestation() from public, anon, authenticated;
create trigger attestations_a_modele before insert or update on public.attestations
  for each row execute function private.figer_modele_attestation();

-- ——— Envoi noté depuis l'application ————————————————————————————————————————————————————————
-- L'application renvoie l'attestation entière (insertion qui rejoint la ligne existante) pour noter
-- son envoi. Les contrôles d'une émission refusaient cette ligne déjà envoyée ; une attestation qui
-- existe déjà passe désormais par les contrôles de la mise à jour (seul l'envoi se note). Une vraie
-- insertion du même identifiant est de toute façon refusée par la clé primaire.
create or replace function private.controler_attestation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_ligne public.deliberations_lignes;
  v_statut text;
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'statut') <> (to_jsonb(old) - 'statut') or (old.statut = 'envoyee' and new.statut <> 'envoyee') then
      raise exception 'L''attestation % est émise : elle ne change plus (seul son envoi se note).', old.numero using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if exists (select 1 from public.attestations a where a.id = new.id) then
    return new;
  end if;
  if split_part(new.numero, '-', 3)::bigint > coalesce((select c.valeur from private.compteurs c
                                                         where c.cle = 'attestation:' || split_part(new.numero, '-', 2)), 0) then
    raise exception 'Le numéro % n''a pas été réservé : demandez un numéro à la base.', new.numero using errcode = 'check_violation';
  end if;
  if new.statut <> 'genere' then
    raise exception 'Une attestation est d''abord émise, puis envoyée.' using errcode = 'check_violation';
  end if;
  if new.type = 'reussite' then
    select d.statut into v_statut from public.deliberations d where d.classe_id = new.classe_id and d.semestre_id = new.semestre_id;
    if v_statut is null then
      raise exception 'Aucune délibération n''a encore eu lieu pour ce semestre — impossible de certifier une réussite.' using errcode = 'check_violation';
    end if;
    if v_statut <> 'cloturee' then
      raise exception 'La délibération de ce semestre n''est pas clôturée — ses décisions sont encore provisoires.' using errcode = 'check_violation';
    end if;
    select l.* into v_ligne from public.deliberations_lignes l
    join public.deliberations d on d.id = l.deliberation_id
    where d.classe_id = new.classe_id and d.semestre_id = new.semestre_id and l.etudiant_id = new.etudiant_id;
    if v_ligne.id is null then
      raise exception 'Cet étudiant n''apparaît pas dans la délibération de ce semestre.' using errcode = 'check_violation';
    end if;
    if v_ligne.decision_finale <> 'admis' then
      raise exception 'Décision du jury pour ce semestre : l''étudiant n''est pas admis, aucune attestation de réussite ne peut être délivrée.'
        using errcode = 'check_violation';
    end if;
    new.moyenne_constatee := v_ligne.moyenne;
    new.decision_constatee := v_ligne.decision_finale;
  else
    new.moyenne_constatee := null;
    new.decision_constatee := null;
  end if;
  return new;
end;
$$;
