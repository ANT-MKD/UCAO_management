-- Notes et résultats (partie 6 du plan de migration, lot 2) : relevés, générations de bulletins,
-- délibérations du semestre et de l'année, repêchages d'UE par le jury, résultats figés, dettes
-- de crédit (AJAC).
--
-- Une délibération est un en-tête (classe, semestre, statut, seuil de session) et une ligne par
-- étudiant : l'étudiant ne lit que sa ligne, son bulletin figé et ses repêchages, jamais les
-- résultats de ses camarades. Clôturée, une délibération ne change plus (ni ses lignes) tant
-- qu'elle n'est pas rouverte ; ses résultats figés ne se modifient jamais, ne s'ajoutent qu'à la
-- clôture et ne se retirent qu'à la réouverture ; une correction de note n'est plus acceptée.
-- La base numérote les générations de bulletins et prévient l'étudiant de son relevé disponible.

-- ——— 1. Relevés et générations de bulletins ————————————————————————————————————————————————

create table public.releves (
  id text primary key,
  etudiant_id text not null references public.etudiants (id) on delete cascade,
  etudiant text not null default '',
  matricule text not null default '',
  classe text not null default '',
  filiere text not null default '',
  semestre text not null default '',
  statut text not null check (statut in ('genere', 'envoye', 'en_attente')),
  date_generation date not null default current_date,
  -- Anciens relevés par EC (avant le relevé par semestre) : identifiant de l'EC, sinon vide.
  ec_id text not null default '',
  semestre_id text references public.semestres (id) on delete restrict,
  annee text references public.annees_academiques (libelle) on update cascade on delete restrict
);
comment on table public.releves is 'Relevés de notes : un par étudiant, semestre et année.';
create unique index releves_semestre_unique on public.releves (etudiant_id, semestre_id, annee) where semestre_id is not null;

create table public.bulletin_generations (
  id text primary key,
  numero text not null unique,
  filiere_id text references public.filieres (id) on delete restrict,
  filiere text not null default '',
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  niveau text not null default '',
  niveau_label text not null default '',
  classe_id text not null references public.classes (id) on delete restrict,
  classe text not null default '',
  semestre_id text references public.semestres (id) on delete restrict,
  semestre text not null default '',
  effectue_le timestamptz not null default now(),
  effectue_par text not null default '',
  statut text not null check (statut in ('succes', 'echec', 'partiel')),
  nb_succes integer not null default 0 check (nb_succes >= 0),
  nb_echec integer not null default 0 check (nb_echec >= 0),
  nb_declasses integer not null default 0 check (nb_declasses >= 0),
  etudiants_concernes jsonb not null default '[]' check (jsonb_typeof(etudiants_concernes) = 'array')
);
comment on table public.bulletin_generations is 'Générations de bulletins d''une classe pour un semestre, et leur résultat par étudiant.';

-- ——— 2. Délibérations du semestre ——————————————————————————————————————————————————————————

create table public.deliberations (
  id text primary key,
  filiere_id text references public.filieres (id) on delete restrict,
  filiere text not null default '',
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  niveau text not null default '',
  niveau_label text not null default '',
  classe_id text not null references public.classes (id) on delete restrict,
  classe text not null default '',
  semestre_id text not null references public.semestres (id) on delete restrict,
  semestre text not null default '',
  effectue_par text not null default '',
  date_deliberation timestamptz not null default now(),
  statut text not null check (statut in ('en_cours', 'cloturee', 'reouverte')),
  -- Seuil de passage retenu pour cette session seulement (péréquation), avec son motif.
  seuil_override numeric check (seuil_override >= 0),
  seuil_override_raison text,
  seuil_override_modifie_par text,
  seuil_override_modifie_le timestamptz,
  constraint deliberations_classe_semestre unique (classe_id, semestre_id)
);
comment on table public.deliberations is 'Délibérations du jury d''une classe pour un semestre.';

create table public.deliberations_lignes (
  id text primary key,
  deliberation_id text not null references public.deliberations (id) on delete cascade,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  etudiant text not null default '',
  matricule text not null default '',
  ordre integer not null default 0,
  moyenne numeric not null,
  credits_obtenus numeric not null default 0,
  credits_total numeric not null default 0,
  absences numeric not null default 0,
  decision_auto text not null check (decision_auto in ('admis', 'ajourne', 'rattrapage', 'exclu', 'a_declasser')),
  decision_finale text not null check (decision_finale in ('admis', 'ajourne', 'rattrapage', 'exclu', 'a_declasser')),
  override_raison text,
  override_modifie_par text,
  raisons_declassement jsonb check (raisons_declassement is null or jsonb_typeof(raisons_declassement) = 'array'),
  constraint deliberations_lignes_id check (id = deliberation_id || ':' || etudiant_id)
);
comment on table public.deliberations_lignes is 'Résultat de chaque étudiant dans une délibération du semestre.';

-- Repêchage d'une UE par le jury : l'UE est déclarée acquise, la vraie moyenne reste imprimée.
create table public.repechages_ue (
  id text primary key,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  classe_id text not null references public.classes (id) on delete restrict,
  ue_id text not null references public.ues (id) on delete restrict,
  ue_libelle text not null default '',
  semestre_alias text not null default '',
  moyenne numeric,
  absences numeric not null default 0,
  motif text not null check (length(trim(motif)) > 0),
  decide_par text not null default '',
  decide_le timestamptz not null default now(),
  constraint repechages_ue_unique unique (etudiant_id, classe_id, ue_id)
);
comment on table public.repechages_ue is 'UE déclarées acquises par décision du jury, avec leur motif.';

-- Bulletin de chaque étudiant tel qu'il a été délibéré, figé à la clôture du jury.
create table public.resultats_figes (
  id text primary key,
  deliberation_id text not null references public.deliberations (id) on delete cascade,
  classe_id text not null references public.classes (id) on delete restrict,
  semestre_alias text not null,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  fige_le timestamptz not null default now(),
  bulletin jsonb not null check (jsonb_typeof(bulletin) = 'object'),
  constraint resultats_figes_id check (id = classe_id || '|' || semestre_alias || '|' || etudiant_id)
);
comment on table public.resultats_figes is 'Bulletins figés à la clôture d''une délibération : un document délivré ne change plus.';

-- ——— 3. Délibérations de l'année et dettes de crédit ——————————————————————————————————————

create table public.deliberations_annuelles (
  id text primary key,
  filiere_id text references public.filieres (id) on delete restrict,
  filiere text not null default '',
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  niveau_id text references public.niveaux (id) on delete restrict,
  niveau text not null default '',
  niveau_label text not null default '',
  classe_id text not null unique references public.classes (id) on delete restrict,
  classe text not null default '',
  effectue_par text not null default '',
  date_deliberation timestamptz not null default now(),
  statut text not null check (statut in ('en_cours', 'cloturee', 'reouverte'))
);
comment on table public.deliberations_annuelles is 'Délibérations de fin d''année d''une classe (passage, dette, redoublement).';

create table public.deliberations_annuelles_lignes (
  id text primary key,
  deliberation_id text not null references public.deliberations_annuelles (id) on delete cascade,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  etudiant text not null default '',
  matricule text not null default '',
  ordre integer not null default 0,
  moyenne_annuelle numeric not null default 0,
  semestres jsonb check (semestres is null or jsonb_typeof(semestres) = 'array'),
  credits_obtenus numeric not null default 0,
  credits_total numeric not null default 0,
  ues_non_validees jsonb not null default '[]' check (jsonb_typeof(ues_non_validees) = 'array'),
  decision_auto text not null check (decision_auto in ('admis', 'admis_avec_dette', 'redouble', 'exclu')),
  decision_finale text not null check (decision_finale in ('admis', 'admis_avec_dette', 'redouble', 'exclu')),
  override_raison text,
  override_modifie_par text,
  constraint deliberations_annuelles_lignes_id check (id = deliberation_id || ':' || etudiant_id)
);
comment on table public.deliberations_annuelles_lignes is 'Décision de fin d''année de chaque étudiant.';

create table public.credits_dette (
  id text primary key,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  etudiant text not null default '',
  matricule text not null default '',
  ue_id text not null references public.ues (id) on delete restrict,
  ue_code text not null default '',
  ue_libelle text not null default '',
  ue_credits numeric not null default 0,
  filiere_id text references public.filieres (id) on delete restrict,
  filiere text not null default '',
  niveau_origine text not null default '',
  niveau_label_origine text not null default '',
  semestre_origine text not null default '',
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  statut text not null check (statut in ('en_cours', 'soldee')),
  date_creation timestamptz not null default now(),
  date_soldee timestamptz,
  soldee_par text
);
comment on table public.credits_dette is 'UE non validées qu''un étudiant admis avec dette (AJAC) doit repasser.';
create unique index credits_dette_une_en_cours on public.credits_dette (etudiant_id, ue_id) where statut = 'en_cours';

do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('releves', array['etudiant_id', 'semestre_id', 'annee']),
      ('bulletin_generations', array['filiere_id', 'annee', 'classe_id', 'semestre_id']),
      ('deliberations', array['filiere_id', 'annee', 'semestre_id']),
      ('deliberations_lignes', array['deliberation_id', 'etudiant_id']),
      ('repechages_ue', array['classe_id', 'ue_id']),
      ('resultats_figes', array['deliberation_id', 'classe_id', 'etudiant_id']),
      ('deliberations_annuelles', array['filiere_id', 'annee', 'niveau_id']),
      ('deliberations_annuelles_lignes', array['deliberation_id', 'etudiant_id']),
      ('credits_dette', array['etudiant_id', 'ue_id', 'filiere_id', 'annee'])
    ) as t(nom, colonnes)
  loop
    for i in 1 .. array_length(v.colonnes, 1) loop
      execute format('create index %I on public.%I (%I)', v.nom || '_' || v.colonnes[i] || '_idx', v.nom, v.colonnes[i]);
    end loop;
  end loop;
end
$$;

-- ——— 4. Garde-fous ——————————————————————————————————————————————————————————————————————————

-- Numéro d'une génération de bulletins (GB-2026-001…), donné par la base : jamais deux fois le
-- même, même depuis deux postes. Une génération est une trace : elle ne se modifie pas.
create function private.numeroter_generation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_annee text := to_char(now(), 'YYYY');
begin
  new.numero := 'GB-' || v_annee || '-' || lpad(private.prochain_numero('generation-bulletins:' || v_annee)::text, 3, '0');
  return new;
end;
$$;
revoke execute on function private.numeroter_generation() from public, anon, authenticated;
create trigger bulletin_generations_numero before insert on public.bulletin_generations
  for each row execute function private.numeroter_generation();

-- Génération réussie : chaque étudiant qui a obtenu son relevé en est prévenu.
create function private.suivre_generation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_etudiant jsonb;
  v_compte uuid;
begin
  for v_etudiant in select e from jsonb_array_elements(new.etudiants_concernes) e where e ->> 'statut' = 'succes'
  loop
    for v_compte in
      select c.id from public.comptes c where c.type_compte = 'etudiant' and c.actif and c.lien_id = v_etudiant ->> 'etudiantId'
    loop
      perform private.envoyer_notification(v_compte,
        format('Votre relevé de notes %s (%s) est disponible dans « Relevés & bulletins ».', new.semestre, new.annee));
    end loop;
  end loop;
  return null;
end;
$$;
revoke execute on function private.suivre_generation() from public, anon, authenticated;
create trigger bulletin_generations_suivi after insert on public.bulletin_generations
  for each row execute function private.suivre_generation();

-- Délibération clôturée : seule sa réouverture la change ; elle ne se supprime pas.
create function private.controler_deliberation()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_quoi text := old.classe || coalesce(' (' || (to_jsonb(old) ->> 'semestre') || ')', '');
begin
  if old.statut <> 'cloturee' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'La délibération de % est clôturée : elle ne se supprime pas.', v_quoi using errcode = 'check_violation';
  end if;
  if new.statut <> 'reouverte' or (to_jsonb(new) - 'statut') <> (to_jsonb(old) - 'statut') then
    raise exception 'La délibération de % est clôturée : rouvrez-la avant de la modifier.', v_quoi using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_deliberation() from public, anon, authenticated;
create trigger deliberations_controle before update or delete on public.deliberations
  for each row execute function private.controler_deliberation();
create trigger deliberations_annuelles_controle before update or delete on public.deliberations_annuelles
  for each row execute function private.controler_deliberation();

-- Lignes d'une délibération clôturée : figées avec elle.
create function private.controler_ligne_deliberation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_deliberation text := case when tg_op = 'DELETE' then old.deliberation_id else new.deliberation_id end;
  v_statut text;
begin
  if tg_table_name = 'deliberations_lignes' then
    select d.statut into v_statut from public.deliberations d where d.id = v_deliberation;
  else
    select d.statut into v_statut from public.deliberations_annuelles d where d.id = v_deliberation;
  end if;
  -- Une délibération supprimée emporte ses lignes (elle n'était pas clôturée).
  if v_statut = 'cloturee' then
    raise exception 'La délibération est clôturée : rouvrez-la avant de modifier ses résultats.' using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function private.controler_ligne_deliberation() from public, anon, authenticated;
create trigger deliberations_lignes_controle before insert or update or delete on public.deliberations_lignes
  for each row execute function private.controler_ligne_deliberation();
create trigger deliberations_annuelles_lignes_controle before insert or update or delete on public.deliberations_annuelles_lignes
  for each row execute function private.controler_ligne_deliberation();

-- Résultats figés : posés à la clôture du jury, retirés à sa réouverture, jamais modifiés.
create function private.controler_resultat_fige()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_statut text;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Un résultat figé ne se modifie pas : rouvrez la délibération.' using errcode = 'check_violation';
  end if;
  select d.statut into v_statut from public.deliberations d
  where d.id = case when tg_op = 'DELETE' then old.deliberation_id else new.deliberation_id end;
  if tg_op = 'INSERT' and v_statut is distinct from 'cloturee' then
    raise exception 'Les résultats ne se figent qu''à la clôture de la délibération.' using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' and v_statut = 'cloturee' then
    raise exception 'La délibération est clôturée : ses résultats restent figés tant qu''elle n''est pas rouverte.' using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function private.controler_resultat_fige() from public, anon, authenticated;
create trigger resultats_figes_controle before insert or update or delete on public.resultats_figes
  for each row execute function private.controler_resultat_fige();

-- Une correction de note n'est plus acceptée quand le jury de son semestre est clôturé (lot 1 :
-- demandes de correction, ici complétées).
create or replace function private.controler_demande_correction()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_note public.notes;
  v_bareme numeric;
begin
  if tg_op = 'INSERT' then
    select * into v_note from public.notes n where n.id = new.note_id;
    if v_note.id is null then
      raise exception 'Note introuvable.' using errcode = 'foreign_key_violation';
    end if;
    if v_note.statut not in ('valide_admin', 'publie') then
      raise exception 'Cette note n''est pas encore validée : modifiez-la directement dans la saisie.' using errcode = 'check_violation';
    end if;
    if new.statut <> 'en_attente' or new.traitee_le is not null or new.motif_refus is not null then
      raise exception 'Une demande de correction commence en attente de décision.' using errcode = 'check_violation';
    end if;
    if auth.uid() is not null and new.demande_par_id is distinct from auth.uid() then
      raise exception 'Une demande de correction se fait en son propre nom.' using errcode = 'insufficient_privilege';
    end if;
    new.etudiant_id := v_note.etudiant_id;
    new.ec_id := v_note.ec_id;
    new.classe_id := v_note.classe_id;
    new.ancienne_note := v_note.note;
    new.ancien_absent := v_note.absent;
    if new.nouvel_absent then
      new.nouvelle_note := 0;
    end if;
    v_bareme := coalesce((select sc.note_bareme from public.scolarite_configs sc join public.classes c on c.filiere_id = sc.filiere_id
                          where c.id = v_note.classe_id), 20);
    if new.nouvelle_note > v_bareme then
      raise exception 'La nouvelle note doit être comprise entre 0 et %.', trim_scale(v_bareme) using errcode = 'check_violation';
    end if;
    if (new.nouvelle_note, new.nouvel_absent) = (v_note.note, v_note.absent) then
      raise exception 'La nouvelle note est identique à la note actuelle.' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if old.statut <> 'en_attente' then
    raise exception 'Cette demande a déjà été traitée.' using errcode = 'check_violation';
  end if;
  if (new.note_id, new.etudiant_id, new.ec_id, new.classe_id, new.ancienne_note, new.ancien_absent, new.nouvelle_note, new.nouvel_absent,
      new.motif, new.demande_par_id, new.cree_le)
     is distinct from
     (old.note_id, old.etudiant_id, old.ec_id, old.classe_id, old.ancienne_note, old.ancien_absent, old.nouvelle_note, old.nouvel_absent,
      old.motif, old.demande_par_id, old.cree_le) then
    raise exception 'Seule la décision sur une demande de correction se modifie.' using errcode = 'check_violation';
  end if;
  if new.statut = 'acceptee' and exists (
    select 1 from public.notes n
    join public.evaluations ev on ev.id = n.evaluation_id
    join public.deliberations d on d.classe_id = n.classe_id and d.semestre_id = ev.semestre_id
    where n.id = new.note_id and d.statut = 'cloturee'
  ) then
    raise exception 'Le jury de ce semestre est clôturé : rouvrez la délibération avant de corriger la note.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ——— 5. Année clôturée, journal, compteurs ————————————————————————————————————————————————

do $$
declare
  v_table text;
begin
  foreach v_table in array array['bulletin_generations', 'deliberations', 'deliberations_annuelles']
  loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function private.refuser_annee_cloturee()',
      v_table || '_annee_cloturee', v_table);
  end loop;
  foreach v_table in array array['releves', 'bulletin_generations', 'deliberations', 'deliberations_lignes', 'repechages_ue', 'resultats_figes',
    'deliberations_annuelles', 'deliberations_annuelles_lignes', 'credits_dette']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.journaliser_modification()',
      v_table || '_journal', v_table);
    perform private.suivre_table(v_table);
  end loop;
end
$$;

-- ——— 6. Droits et règles d'accès ————————————————————————————————————————————————————————————
-- Lecture : l'administration ; l'étudiant pour ce qui le concerne (son relevé, sa ligne de
-- délibération et l'en-tête qui va avec, son bulletin figé, ses repêchages, ses dettes).
-- Écriture : les pages qui en ont la charge.

-- Délibérations où figure l'étudiant connecté.
create function private.deliberations_etudiant()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(l.deliberation_id), '{}') from public.deliberations_lignes l where l.etudiant_id = private.etudiant_courant()
$$;
create function private.deliberations_annuelles_etudiant()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(l.deliberation_id), '{}') from public.deliberations_annuelles_lignes l where l.etudiant_id = private.etudiant_courant()
$$;
revoke execute on function private.deliberations_etudiant(), private.deliberations_annuelles_etudiant() from public, anon;
grant execute on function private.deliberations_etudiant(), private.deliberations_annuelles_etudiant() to authenticated, service_role;

do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('releves', 'etudiant_id = (select private.etudiant_courant())', array['scol-notes-saisie', 'scol-notes-rattrapage', 'bul-generation'], true),
      ('bulletin_generations', 'false', array['bul-generation'], false),
      ('deliberations', 'id = any ((select private.deliberations_etudiant())::text[])', array['bul-deliberation'], true),
      ('deliberations_lignes', 'etudiant_id = (select private.etudiant_courant())', array['bul-deliberation'], true),
      ('repechages_ue', 'etudiant_id = (select private.etudiant_courant())', array['bul-deliberation'], true),
      ('resultats_figes', 'etudiant_id = (select private.etudiant_courant())', array['bul-deliberation'], false),
      ('deliberations_annuelles', 'id = any ((select private.deliberations_annuelles_etudiant())::text[])', array['bul-deliberation-annuelle'], true),
      ('deliberations_annuelles_lignes', 'etudiant_id = (select private.etudiant_courant())', array['bul-deliberation-annuelle'], true),
      ('credits_dette', 'etudiant_id = (select private.etudiant_courant())', array['bul-deliberation-annuelle'], true)
    ) as t(nom, lecture, pages, modifiable)
  loop
    execute format('alter table public.%I enable row level security', v.nom);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', v.nom);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.est_administration()) or %s)',
      v.nom || '_lecture', v.nom, v.lecture);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.a_acces_une_page(%L)))',
      v.nom || '_creation', v.nom, v.pages);
    if v.modifiable then
      execute format(
        'create policy %I on public.%I for update to authenticated using ((select private.a_acces_une_page(%L))) with check ((select private.a_acces_une_page(%L)))',
        v.nom || '_modification', v.nom, v.pages, v.pages);
    end if;
    -- Une génération de bulletins est une trace : ni modifiée ni supprimée.
    if v.nom <> 'bulletin_generations' then
      execute format('create policy %I on public.%I for delete to authenticated using ((select private.a_acces_une_page(%L)))',
        v.nom || '_suppression', v.nom, v.pages);
    end if;
  end loop;
end
$$;
