-- Étudiants, inscriptions et matricules (partie 4 du plan de migration, lot 2).
--
-- Comme pour les enseignants, deux tables pour un étudiant :
--   - la fiche scolaire (matricule, nom, filière, classe, niveau, statut, année), lue par
--     l'administration, par l'étudiant lui-même et par les professeurs (listes de classe ; la
--     partie 5 la réduira à leurs classes) ;
--   - le dossier personnel (contacts, état civil, CNI, tuteur, pièces déclarées, modèle de frais,
--     motif de blocage), lu par l'administration et par l'étudiant, qui n'y modifie que son
--     adresse, son téléphone et son tuteur.
-- Les inscriptions gardent l'historique de chaque année. Le matricule est attribué par le serveur
-- (jamais deux fois le même, même pour deux inscriptions simultanées) et une classe qui a des
-- étudiants ne se supprime plus. Les soldes restent calculés par l'application jusqu'à la partie
-- Finances ; la photo et les pièces déposées rejoindront l'espace de fichiers (lot 3).

-- ——— 1. Fiche scolaire ——————————————————————————————————————————————————————————————————————

create table public.etudiants (
  id text primary key default gen_random_uuid()::text,
  matricule text not null check (length(trim(matricule)) > 0),
  prenom text not null check (length(trim(prenom)) > 0),
  nom text not null check (length(trim(nom)) > 0),
  sexe text check (sexe in ('M', 'F')),
  filiere text not null default '',
  filiere_id text not null references public.filieres (id) on delete restrict,
  classe text not null default '',
  -- Sans classe : en attente d'affectation (après paiement).
  classe_id text references public.classes (id) on delete restrict,
  niveau text not null default '',
  statut text not null check (length(trim(statut)) > 0),
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  annee_premiere_inscription integer
);
comment on table public.etudiants is 'Fiche scolaire des étudiants (matricule, filière, classe, niveau, statut, année en cours).';
create unique index etudiants_matricule_unique on public.etudiants (upper(matricule));
create index etudiants_filiere_id_idx on public.etudiants (filiere_id);
create index etudiants_classe_id_idx on public.etudiants (classe_id);
create index etudiants_annee_idx on public.etudiants (annee);

-- ——— 2. Dossier personnel ———————————————————————————————————————————————————————————————————

create table public.etudiants_dossiers (
  id text primary key references public.etudiants (id) on delete cascade,
  email text not null default '',
  telephone text not null default '',
  -- Dates saisies telles quelles (le formulaire et l'import acceptent des dates vides).
  date_naissance text,
  lieu_naissance text,
  pays text,
  nationalite text,
  cni text,
  adresse text,
  nom_tuteur text,
  tel_tuteur text,
  type_admission text check (type_admission in ('nouveau', 'transfert')),
  documents_fournis text[] not null default '{}',
  inscription_unique_payee boolean not null default false,
  modele_frais_id text references public.modeles_frais (id) on delete restrict,
  motif_blocage_id text references public.motifs_blocage (id) on delete restrict
);
comment on table public.etudiants_dossiers is 'Dossier personnel des étudiants (contacts, état civil, tuteur, pièces déclarées, frais, blocage).';
create index etudiants_dossiers_modele_frais_id_idx on public.etudiants_dossiers (modele_frais_id);
create index etudiants_dossiers_motif_blocage_id_idx on public.etudiants_dossiers (motif_blocage_id);

-- L'étudiant ne modifie de son dossier que son adresse, son téléphone et son tuteur.
create function private.controler_dossier_etudiant()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select private.type_compte_courant()) = 'etudiant'
     and to_jsonb(new) - array['adresse', 'telephone', 'nom_tuteur', 'tel_tuteur']
       is distinct from to_jsonb(old) - array['adresse', 'telephone', 'nom_tuteur', 'tel_tuteur'] then
    raise exception 'Vous ne pouvez modifier que votre adresse, votre téléphone et votre tuteur.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_dossier_etudiant() from public, anon, authenticated;
create trigger etudiants_dossiers_controle before update on public.etudiants_dossiers
  for each row execute function private.controler_dossier_etudiant();

-- ——— 3. Inscriptions ————————————————————————————————————————————————————————————————————————

create table public.inscriptions (
  id text primary key default gen_random_uuid()::text,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  filiere text not null default '',
  filiere_id text not null references public.filieres (id) on delete restrict,
  niveau text not null default '',
  classe text not null default '',
  classe_id text references public.classes (id) on delete restrict,
  statut text not null check (length(trim(statut)) > 0),
  type text not null check (type in ('premiere', 'reinscription', 'correction', 'bascule')),
  date_inscription date not null default current_date,
  specialite text,
  modele_frais_id text references public.modeles_frais (id) on delete restrict,
  modele_frais text,
  motif text,
  effectue_par text
);
comment on table public.inscriptions is 'Inscriptions des étudiants, une par année (première, réinscription, correction, bascule).';
create index inscriptions_etudiant_id_idx on public.inscriptions (etudiant_id);
create index inscriptions_annee_idx on public.inscriptions (annee);
create index inscriptions_filiere_id_idx on public.inscriptions (filiere_id);
create index inscriptions_classe_id_idx on public.inscriptions (classe_id);
create index inscriptions_modele_frais_id_idx on public.inscriptions (modele_frais_id);

-- Une année clôturée ne change plus : ni ses inscriptions, ni ses classes.
create trigger inscriptions_annee_cloturee before insert or update or delete on public.inscriptions
  for each row execute function private.refuser_annee_cloturee();
create trigger classes_annee_cloturee before insert or update or delete on public.classes
  for each row execute function private.refuser_annee_cloturee();

do $$
declare
  v_table text;
begin
  foreach v_table in array array['etudiants', 'etudiants_dossiers', 'inscriptions']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.journaliser_modification()',
      v_table || '_journal', v_table);
  end loop;
end
$$;

-- ——— 4. Matricules attribués par le serveur ——————————————————————————————————————————————————
-- Format de l'application : année de la rentrée, code de la filière, numéro sur 4 chiffres
-- (2026-LQHSE-0001). Le compteur de la partie 1 ne rend jamais deux fois le même numéro ; un
-- matricule déjà pris (dossier repris d'un autre système) est sauté.

create function private.cle_matricule(p_filiere_id text, p_annee text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_code text;
begin
  if coalesce(p_annee, '') !~ '^\d{4}-\d{4}$' then
    raise exception 'Année académique invalide.' using errcode = 'check_violation';
  end if;
  select f.code into v_code from public.filieres f where f.id = p_filiere_id;
  if v_code is null then
    raise exception 'Filière inconnue.' using errcode = 'foreign_key_violation';
  end if;
  return split_part(p_annee, '-', 1) || '-' || v_code;
end;
$$;
revoke execute on function private.cle_matricule(text, text) from public, anon, authenticated;

create function public.attribuer_matricule(p_filiere_id text, p_annee text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_cle text;
  v_matricule text;
begin
  if not private.a_acces_une_page(array['etudiants-ajouter', 'etudiants-liste', 'fin-devis-liste']) then
    raise exception 'Vous n''avez pas accès à l''inscription des étudiants.' using errcode = 'insufficient_privilege';
  end if;
  v_cle := private.cle_matricule(p_filiere_id, p_annee);
  loop
    v_matricule := v_cle || '-' || lpad(private.prochain_numero('matricule:' || v_cle)::text, 4, '0');
    exit when not exists (select 1 from public.etudiants e where upper(e.matricule) = upper(v_matricule));
  end loop;
  return v_matricule;
end;
$$;
comment on function public.attribuer_matricule(text, text) is 'Réserve le prochain matricule d''une filière pour une année.';

-- Aperçu affiché pendant la saisie (le matricule n'est réservé qu'à l'enregistrement).
create function public.apercu_matricule(p_filiere_id text, p_annee text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_cle text;
begin
  if not private.a_acces_une_page(array['etudiants-ajouter', 'etudiants-liste', 'fin-devis-liste']) then
    raise exception 'Vous n''avez pas accès à l''inscription des étudiants.' using errcode = 'insufficient_privilege';
  end if;
  v_cle := private.cle_matricule(p_filiere_id, p_annee);
  return v_cle || '-' || lpad((coalesce((select c.valeur from private.compteurs c where c.cle = 'matricule:' || v_cle), 0) + 1)::text, 4, '0');
end;
$$;
comment on function public.apercu_matricule(text, text) is 'Prochain matricule d''une filière pour une année, sans le réserver.';

revoke execute on function public.attribuer_matricule(text, text), public.apercu_matricule(text, text) from public, anon;
grant execute on function public.attribuer_matricule(text, text), public.apercu_matricule(text, text) to authenticated, service_role;

-- ——— 5. Comptes étudiants : rattachés à un dossier enregistré, identifiant = matricule ———————
-- Reprise de la fonction de la partie 2 : les pages qui inscrivent un étudiant (ajout, import
-- depuis la liste, conversion d'un devis) lui ouvrent aussi son compte, et le dossier doit exister.

create or replace function public.compte_enregistrer(
  p_acteur uuid,
  p_compte uuid,
  p_type_compte text,
  p_identifiant text,
  p_nom_affiche text,
  p_email text default '',
  p_telephone text default '',
  p_fonction text default '',
  p_role_id text default null,
  p_lien_id text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_identifiant text := upper(trim(coalesce(p_identifiant, '')));
  v_email text := trim(coalesce(p_email, ''));
  v_role text := nullif(trim(coalesce(p_role_id, '')), '');
  v_lien text := nullif(trim(coalesce(p_lien_id, '')), '');
  v_autorise boolean;
begin
  if p_type_compte is null or p_type_compte not in ('administration', 'enseignant', 'etudiant') then
    raise exception 'Type de compte inconnu.' using errcode = 'check_violation';
  end if;
  v_autorise := case p_type_compte
    when 'etudiant' then private.acces_page_de(p_acteur, 'etudiants-ajouter') or private.acces_page_de(p_acteur, 'etudiants-liste')
                         or private.acces_page_de(p_acteur, 'fin-devis-liste')
    when 'enseignant' then private.acces_page_de(p_acteur, 'sec-users') or private.acces_page_de(p_acteur, 'sec-user-add')
                           or private.acces_page_de(p_acteur, 'prof-ajouter')
    else private.acces_page_de(p_acteur, 'sec-users') or private.acces_page_de(p_acteur, 'sec-user-add')
  end;
  if not v_autorise then
    raise exception 'Vous n''avez pas le droit de créer ce compte.' using errcode = 'insufficient_privilege';
  end if;
  if v_identifiant = '' or trim(coalesce(p_nom_affiche, '')) = '' then
    raise exception 'Renseignez l''identifiant et le nom du compte.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.comptes c where c.identifiant = v_identifiant) then
    raise exception 'Cet identifiant est déjà utilisé par un autre compte.' using errcode = 'unique_violation';
  end if;
  if p_type_compte <> 'etudiant' and v_email <> ''
     and exists (select 1 from public.comptes c where lower(c.email) = lower(v_email) and c.type_compte <> 'etudiant') then
    raise exception 'Cet email est déjà utilisé par un autre compte.' using errcode = 'unique_violation';
  end if;
  if p_type_compte = 'etudiant' and v_lien is null then
    raise exception 'Un compte étudiant est rattaché à son dossier.' using errcode = 'check_violation';
  end if;
  if p_type_compte = 'etudiant' and not exists (select 1 from public.etudiants e where e.id = v_lien) then
    raise exception 'Le dossier de cet étudiant n''est pas enregistré.' using errcode = 'foreign_key_violation';
  end if;
  if p_type_compte = 'etudiant' and not exists (select 1 from public.etudiants e where e.id = v_lien and upper(e.matricule) = v_identifiant) then
    raise exception 'Le compte d''un étudiant a pour identifiant son matricule.' using errcode = 'check_violation';
  end if;
  if v_lien is not null and exists (select 1 from public.comptes c where c.type_compte = p_type_compte and c.lien_id = v_lien) then
    raise exception 'Cette fiche est déjà reliée à un autre compte.' using errcode = 'unique_violation';
  end if;
  if p_type_compte = 'administration' then
    if v_role is null and not private.acces_complet_de(p_acteur) then
      raise exception 'Seul un administrateur à accès complet peut créer un compte sans rôle (accès complet). Choisissez un rôle.'
        using errcode = 'insufficient_privilege';
    end if;
    if v_role is not null and not exists (select 1 from public.roles r where r.id = v_role) then
      raise exception 'Ce rôle n''existe pas.' using errcode = 'foreign_key_violation';
    end if;
    if not private.peut_attribuer_role(p_acteur, v_role) then
      raise exception 'Vous ne pouvez pas attribuer un rôle qui ouvre des pages auxquelles vous n''avez pas accès.'
        using errcode = 'insufficient_privilege';
    end if;
  elsif v_role is not null then
    raise exception 'Un rôle ne s''attribue qu''à un compte de l''administration.' using errcode = 'check_violation';
  end if;
  if p_compte is null then
    return;
  end if;

  insert into public.comptes (id, type_compte, identifiant, nom_affiche, email, telephone, fonction, role_id, lien_id)
  values (p_compte, p_type_compte, v_identifiant, trim(p_nom_affiche), v_email, trim(coalesce(p_telephone, '')),
          trim(coalesce(p_fonction, '')), v_role, v_lien);
  insert into public.journal_audit (acteur, action, cible_type, cible_id, details)
  values (p_acteur, 'create_user_account', 'compte', p_compte::text, trim(p_nom_affiche));
end;
$$;

-- ——— 6. Droits et règles d'accès ——————————————————————————————————————————————————————————

alter table public.etudiants enable row level security;
alter table public.etudiants_dossiers enable row level security;
alter table public.inscriptions enable row level security;
grant select, insert, update, delete on public.etudiants, public.etudiants_dossiers, public.inscriptions to authenticated, service_role;

-- Pages qui inscrivent, réinscrivent, affectent ou changent le statut d'un étudiant (la nouvelle
-- quittance l'affecte à sa classe une fois les frais payés).
create function private.gere_etudiants()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.a_acces_une_page(array['etudiants-liste', 'etudiants-ajouter', 'etudiants-reinscrire',
    'etudiants-interdire', 'scol-insc-fiche', 'scol-insc-correction', 'scol-insc-definitive',
    'scol-classes-bascule', 'scol-abandon', 'acad-annees', 'fin-quittance-nouvelle', 'fin-devis-liste'])
$$;
revoke execute on function private.gere_etudiants() from public, anon;
grant execute on function private.gere_etudiants() to authenticated, service_role;

-- Compte étudiant connecté : son propre dossier.
create function private.etudiant_courant()
returns text
language sql stable security definer set search_path = ''
as $$
  select case when private.type_compte_courant() = 'etudiant' then private.lien_courant() end
$$;
revoke execute on function private.etudiant_courant() from public, anon;
grant execute on function private.etudiant_courant() to authenticated, service_role;

create policy etudiants_lecture on public.etudiants for select to authenticated
  using ((select private.est_administration()) or (select private.type_compte_courant()) = 'enseignant'
         or id = (select private.etudiant_courant()));
create policy etudiants_creation on public.etudiants for insert to authenticated
  with check ((select private.gere_etudiants()));
create policy etudiants_modification on public.etudiants for update to authenticated
  using ((select private.gere_etudiants())) with check ((select private.gere_etudiants()));
create policy etudiants_suppression on public.etudiants for delete to authenticated
  using ((select private.gere_etudiants()));

create policy etudiants_dossiers_lecture on public.etudiants_dossiers for select to authenticated
  using ((select private.est_administration()) or id = (select private.etudiant_courant()));
create policy etudiants_dossiers_creation on public.etudiants_dossiers for insert to authenticated
  with check ((select private.gere_etudiants()));
create policy etudiants_dossiers_modification on public.etudiants_dossiers for update to authenticated
  using ((select private.gere_etudiants()) or id = (select private.etudiant_courant()))
  with check ((select private.gere_etudiants()) or id = (select private.etudiant_courant()));
create policy etudiants_dossiers_suppression on public.etudiants_dossiers for delete to authenticated
  using ((select private.gere_etudiants()));

create policy inscriptions_lecture on public.inscriptions for select to authenticated
  using ((select private.est_administration()) or etudiant_id = (select private.etudiant_courant()));
create policy inscriptions_creation on public.inscriptions for insert to authenticated
  with check ((select private.gere_etudiants()));
create policy inscriptions_modification on public.inscriptions for update to authenticated
  using ((select private.gere_etudiants())) with check ((select private.gere_etudiants()));
create policy inscriptions_suppression on public.inscriptions for delete to authenticated
  using ((select private.gere_etudiants()));
