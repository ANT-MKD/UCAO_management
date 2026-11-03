-- Cahiers de séance, présences et pointages (partie 5 du plan de migration, lot 2).
--
-- Le cahier de séance décrit une séance réellement tenue : son contenu, ses travaux, ses photos du
-- tableau et pièces jointes (espace de fichiers privé « cahiers »), et les présences de la classe.
--   - Le professeur écrit les cahiers de ses seules séances, en brouillon ou soumis ; il ne valide
--     ni ne rejette jamais, et un cahier validé ne change plus pour lui.
--   - L'administration (« Cahier de textes », « Nouvelle assiduité ») les valide, les rejette ou
--     saisit un cahier de secours ; « Demandes » justifie une absence.
--   - L'étudiant lit les cahiers soumis ou validés de sa classe, et ses seules présences.
-- Quand un cahier d'une séance réalisée est validé, la base crée elle-même son pointage (à
-- confirmer par le traitement des pointages) : un cahier validé crée son pointage, quel que soit
-- le poste. Les pointages sont lus par l'administration et par le professeur concerné : FALL ne
-- voit rien des cours de KANE.
-- La base prévient : l'administration des cahiers soumis, les étudiants absents, le professeur de
-- la validation ou du rejet de son cahier.
-- Rejoignent aussi la base : les absences déclarées sur une période et le portefeuille de cours
-- (étudiant retiré d'un cours de sa classe, ou ajouté à un cours d'une autre), dont le professeur
-- a besoin pour faire l'appel.

-- ——— 1. Cahiers de séance ————————————————————————————————————————————————————————————————————

create table public.cahiers (
  id text primary key default gen_random_uuid()::text,
  -- Une séance qui a un cahier, et le cours, la classe et le professeur d'un cahier, ne se
  -- suppriment plus.
  seance_id text not null references public.seances (id) on delete restrict,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  semestre text not null default '',
  departement text not null default '',
  filiere text not null default '',
  filiere_id text references public.filieres (id) on delete restrict,
  niveau text not null default '',
  ue text not null default '',
  ue_id text references public.ues (id) on delete restrict,
  ec text not null default '',
  ec_id text not null references public.ecs (id) on delete restrict,
  classe_id text not null references public.classes (id) on delete restrict,
  classe text not null default '',
  prof text not null default '',
  prof_id text references public.enseignants (id) on delete restrict,
  salle text not null default '',
  salle_id text references public.salles (id) on delete restrict,
  date date not null,
  heure_debut text not null check (heure_debut ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  heure_fin text not null check (heure_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  type_seance text not null default '',
  sujet text not null default '',
  resume text not null default '',
  competences text not null default '',
  liens_externes text[] not null default '{}',
  travail jsonb check (travail is null or jsonb_typeof(travail) = 'object'),
  evaluation jsonb check (evaluation is null or jsonb_typeof(evaluation) = 'object'),
  taux_presence numeric not null default 0 check (taux_presence between 0 and 100),
  etat_seance text not null check (etat_seance in ('preparee', 'realisee', 'annulee')),
  motif_annulation text,
  statut text not null check (statut in ('brouillon', 'soumis', 'valide', 'rejete')),
  valide_par text,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz
);
comment on table public.cahiers is 'Cahiers de séance (cahier de textes) : contenu de la séance tenue, travaux, validation.';
create index cahiers_seance_id_idx on public.cahiers (seance_id);
create index cahiers_annee_idx on public.cahiers (annee);
create index cahiers_filiere_id_idx on public.cahiers (filiere_id);
create index cahiers_ue_id_idx on public.cahiers (ue_id);
create index cahiers_ec_id_idx on public.cahiers (ec_id);
create index cahiers_classe_id_idx on public.cahiers (classe_id);
create index cahiers_prof_id_idx on public.cahiers (prof_id);
create index cahiers_salle_id_idx on public.cahiers (salle_id);

-- ——— 2. Présences ————————————————————————————————————————————————————————————————————————————

create table public.presences (
  id text primary key,
  cahier_id text not null references public.cahiers (id) on delete cascade,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  nom text not null default '',
  statut text not null check (statut in ('present', 'absent', 'retard')),
  justification text,
  retard_minutes integer check (retard_minutes is null or retard_minutes >= 0),
  ordre integer not null default 0,
  constraint presences_id check (id = cahier_id || ':' || etudiant_id)
);
comment on table public.presences is 'Présence de chaque étudiant à une séance, relevée dans son cahier.';
create index presences_cahier_id_idx on public.presences (cahier_id);
create index presences_etudiant_id_idx on public.presences (etudiant_id);

-- ——— 3. Photos du tableau et pièces jointes ——————————————————————————————————————————————

create table public.cahiers_fichiers (
  id text primary key,
  cahier_id text not null references public.cahiers (id) on delete cascade,
  genre text not null check (genre in ('photo', 'piece')),
  ordre integer not null default 0,
  nom text not null default '',
  type text not null default '',
  taille_ko integer check (taille_ko is null or taille_ko >= 0),
  ref text,
  -- Fichier dans l'espace « cahiers », rangé dans le dossier de son cahier (absent pour une pièce
  -- ancienne dont seul le nom était gardé).
  chemin text,
  constraint cahiers_fichiers_chemin check (chemin is null or starts_with(chemin, cahier_id || '/'))
);
comment on table public.cahiers_fichiers is 'Photos du tableau et pièces jointes des cahiers de séance.';
create index cahiers_fichiers_cahier_id_idx on public.cahiers_fichiers (cahier_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('cahiers', 'cahiers', false, 5242880, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv', 'application/zip',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation']);

-- ——— 4. Pointages ——————————————————————————————————————————————————————————————————————————

create table public.pointages (
  id text primary key default gen_random_uuid()::text,
  teacher_id text not null references public.enseignants (id) on delete restrict,
  ec_id text not null references public.ecs (id) on delete restrict,
  classe_id text not null references public.classes (id) on delete restrict,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  seance_id text references public.seances (id) on delete restrict,
  -- Cahier validé dont ce pointage a été créé par la base.
  cahier_id text references public.cahiers (id) on delete restrict,
  date date not null,
  heure_debut text not null check (heure_debut ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  heure_fin text not null check (heure_fin ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  type text not null check (type in ('CM', 'TD', 'TP', 'EX')),
  salle_id text references public.salles (id) on delete restrict,
  volume_pointe numeric not null check (volume_pointe > 0),
  remarque text,
  statut text not null check (statut in ('brouillon', 'soumis', 'valide', 'rejete')),
  motif_rejet text,
  cree_le timestamptz not null default now(),
  constraint pointages_horaire check (heure_fin > heure_debut)
);
comment on table public.pointages is 'Heures pointées des enseignants (créées depuis un cahier validé ou saisies), à valider.';
create index pointages_teacher_id_idx on public.pointages (teacher_id);
create index pointages_ec_id_idx on public.pointages (ec_id);
create index pointages_classe_id_idx on public.pointages (classe_id);
create index pointages_annee_idx on public.pointages (annee);
create index pointages_seance_id_idx on public.pointages (seance_id);
create index pointages_cahier_id_idx on public.pointages (cahier_id);
create index pointages_salle_id_idx on public.pointages (salle_id);
-- Un même créneau n'est pointé qu'une fois (hors pointage rejeté), même depuis deux postes.
create unique index pointages_creneau_unique on public.pointages (teacher_id, ec_id, classe_id, date, heure_debut, heure_fin)
  where statut <> 'rejete';

-- ——— 5. Absences déclarées sur une période, portefeuille de cours ——————————————————————————

create table public.absences_periodes (
  id text primary key default gen_random_uuid()::text,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  etudiant text not null default '',
  matricule text not null default '',
  classe_id text references public.classes (id) on delete restrict,
  classe text not null default '',
  filiere_id text references public.filieres (id) on delete restrict,
  filiere text not null default '',
  niveau text not null default '',
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  date_debut date not null,
  date_fin date not null,
  motif text not null default '',
  justifie boolean not null default false,
  justificatif text,
  declare_par text,
  date_declaration date not null default current_date,
  constraint absences_periodes_dates check (date_fin >= date_debut)
);
comment on table public.absences_periodes is 'Absences d''étudiants déclarées sur une période (maladie, stage…).';
create index absences_periodes_etudiant_id_idx on public.absences_periodes (etudiant_id);
create index absences_periodes_classe_id_idx on public.absences_periodes (classe_id);
create index absences_periodes_filiere_id_idx on public.absences_periodes (filiere_id);
create index absences_periodes_annee_idx on public.absences_periodes (annee);

create table public.portefeuille_cours (
  id text primary key default gen_random_uuid()::text,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  etudiant text not null default '',
  matricule text not null default '',
  classe_id text not null references public.classes (id) on delete restrict,
  classe text not null default '',
  ec_id text not null references public.ecs (id) on delete restrict,
  ec text not null default '',
  action text not null check (action in ('ajout', 'retrait')),
  date_action date not null default current_date,
  effectue_par text,
  motif text,
  cree_le timestamptz not null default now()
);
comment on table public.portefeuille_cours is 'Cours ajoutés à un étudiant hors de sa classe, ou retirés de sa classe (la dernière action compte).';
create index portefeuille_cours_etudiant_id_idx on public.portefeuille_cours (etudiant_id);
create index portefeuille_cours_classe_id_idx on public.portefeuille_cours (classe_id);
create index portefeuille_cours_ec_id_idx on public.portefeuille_cours (ec_id);

-- ——— 6. Qui lit et écrit quoi ———————————————————————————————————————————————————————————————

-- Pages qui écrivent des cahiers (validation, cahier de secours) et des présences (justification).
create function private.ecrit_cahiers()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.a_acces_une_page(array['scol-ass-cahier', 'scol-ass-nouvelle'])
$$;

-- Cahiers du professeur connecté, et ceux qu'il peut encore modifier (pas encore validés).
create function private.cahiers_enseignant()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(c.id), '{}') from public.cahiers c where c.prof_id = private.enseignant_courant()
$$;

create function private.cahiers_modifiables_enseignant()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(c.id), '{}') from public.cahiers c
  where c.prof_id = private.enseignant_courant() and c.statut <> 'valide'
$$;

-- Un cahier (et ses fichiers) est lu par l'administration, par son professeur, et par les
-- étudiants de sa classe une fois soumis.
create function private.cahier_lisible(p_cahier text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.cahiers c
    where c.id = p_cahier
      and (private.est_administration()
           or c.prof_id = private.enseignant_courant()
           or (c.classe_id = private.classe_etudiant() and c.statut in ('soumis', 'valide')))
  )
$$;

create function private.cahier_modifiable(p_cahier text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.ecrit_cahiers() or p_cahier = any (private.cahiers_modifiables_enseignant())
$$;

-- Étudiants ajoutés (dernière action) à un cours d'une classe du professeur connecté.
create function private.etudiants_ajoutes_enseignant()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct x.etudiant_id), '{}')
  from (
    select distinct on (p.etudiant_id, p.classe_id, p.ec_id) p.etudiant_id, p.action
    from public.portefeuille_cours p
    where p.classe_id = any (private.classes_enseignant())
    order by p.etudiant_id, p.classe_id, p.ec_id, p.date_action desc, p.cree_le desc
  ) x
  where x.action = 'ajout'
$$;

revoke execute on function private.ecrit_cahiers(), private.cahiers_enseignant(), private.cahiers_modifiables_enseignant(),
  private.cahier_lisible(text), private.cahier_modifiable(text), private.etudiants_ajoutes_enseignant() from public, anon;
grant execute on function private.ecrit_cahiers(), private.cahiers_enseignant(), private.cahiers_modifiables_enseignant(),
  private.cahier_lisible(text), private.cahier_modifiable(text), private.etudiants_ajoutes_enseignant() to authenticated, service_role;

-- ——— 7. Garde-fous des cahiers ————————————————————————————————————————————————————————————

-- Un cahier décrit sa séance (même cours, même classe, à sa date) et n'est jamais soumis à
-- l'avance comme réalisé. Le professeur n'écrit que pour ses séances, en brouillon ou soumis, et
-- ne touche plus à un cahier validé.
create function private.controler_cahier()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_seance public.seances;
begin
  select * into v_seance from public.seances s where s.id = new.seance_id;
  if new.date <> v_seance.semaine_du + (v_seance.jour - 1) or new.ec_id <> v_seance.ec_id or new.classe_id <> v_seance.classe_id then
    raise exception 'Un cahier décrit sa séance : même cours, même classe, à la date de la séance (%).', to_char(v_seance.semaine_du + (v_seance.jour - 1), 'DD/MM/YYYY')
      using errcode = 'check_violation';
  end if;
  if new.statut = 'soumis' and new.etat_seance = 'realisee' and new.date > current_date then
    raise exception 'La séance du % n''a pas encore eu lieu : enregistrez-la comme « préparée » ou en brouillon.', to_char(new.date, 'DD/MM/YYYY')
      using errcode = 'check_violation';
  end if;
  if (select private.type_compte_courant()) = 'enseignant' then
    if v_seance.prof_id is distinct from private.enseignant_courant() or new.prof_id is distinct from private.enseignant_courant() then
      raise exception 'Ce cours n''est pas le vôtre.' using errcode = 'insufficient_privilege';
    end if;
    if tg_op = 'UPDATE' and old.statut = 'valide' then
      raise exception 'Ce cahier est validé : il ne change plus.' using errcode = 'insufficient_privilege';
    end if;
    if new.statut not in ('brouillon', 'soumis')
       or new.valide_par is distinct from (case when tg_op = 'UPDATE' then old.valide_par end) then
      raise exception 'Seule l''administration valide ou rejette un cahier.' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_cahier() from public, anon, authenticated;
create trigger cahiers_controle before insert or update on public.cahiers
  for each row execute function private.controler_cahier();

-- ——— 8. Cahier validé → pointage ; notifications des cahiers ———————————————————————————————

create function private.suivre_cahier()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_avant text := case when tg_op = 'UPDATE' then old.statut end;
  v_date text := to_char(new.date, 'DD/MM/YYYY');
  v_prof text;
  v_minutes integer;
  v_volume numeric;
  v_pointe boolean := false;
  v_compte uuid;
  v_absence record;
begin
  -- Séance réalisée et validée : le pointage est préparé, il ne reste qu'à le confirmer.
  if new.statut = 'valide' and v_avant is distinct from 'valide' and new.etat_seance = 'realisee' then
    v_prof := coalesce(new.prof_id, (select s.prof_id from public.seances s where s.id = new.seance_id));
    v_minutes := private.minutes(new.heure_fin) - private.minutes(new.heure_debut);
    v_volume := round(v_minutes / 60.0, 2);
    if v_prof is not null and v_minutes > 0
       and not exists (select 1 from public.pointages p where p.cahier_id = new.id and p.statut <> 'rejete') then
      insert into public.pointages (id, teacher_id, ec_id, classe_id, annee, seance_id, cahier_id, date, heure_debut, heure_fin, type,
        salle_id, volume_pointe, remarque, statut)
      values ('ptg-' || new.id, v_prof, new.ec_id, new.classe_id, new.annee, new.seance_id, new.id, new.date, new.heure_debut, new.heure_fin,
        case when new.type_seance in ('CM', 'TD', 'TP', 'EX') then new.type_seance else 'CM' end,
        new.salle_id, v_volume, 'Créé depuis le cahier de séance validé — ' || new.ec, 'soumis')
      on conflict do nothing;
      v_pointe := found;
    end if;
  end if;

  -- Le professeur apprend la décision sur son cahier.
  if new.statut in ('valide', 'rejete') and v_avant is distinct from new.statut then
    for v_compte in
      select c.id from public.comptes c where c.type_compte = 'enseignant' and c.actif and c.lien_id = new.prof_id
    loop
      perform private.envoyer_notification(v_compte, case
        when new.statut = 'rejete' then format('Cahier %s du %s rejeté — à corriger avant transmission au pointage', new.ec, v_date)
        when v_pointe then format('Cahier %s du %s validé — %s h transmises au pointage', new.ec, v_date, trim_scale(v_volume))
        else format('Cahier %s du %s validé', new.ec, v_date)
      end);
    end loop;
  end if;

  -- Cahier soumis : l'administration qui tient les cahiers est prévenue, et les étudiants déjà
  -- relevés absents aussi.
  if new.statut = 'soumis' and v_avant is distinct from 'soumis' then
    for v_compte in
      select c.id from public.comptes c
      where c.type_compte = 'administration' and c.actif and private.acces_page_de(c.id, 'scol-ass-cahier')
    loop
      perform private.envoyer_notification(v_compte,
        format('Cahier de texte soumis : %s — %s (%s)', new.ec, new.classe, v_date), 'cahiers-soumis',
        format('{n} cahiers de texte soumis — dernier : %s — %s (%s)', new.ec, new.classe, v_date));
    end loop;
    for v_absence in select p.etudiant_id from public.presences p where p.cahier_id = new.id and p.statut = 'absent'
    loop
      perform private.notifier_absence(v_absence.etudiant_id, new.ec, new.date);
    end loop;
  end if;
  return null;
end;
$$;

-- « Absence constatée », selon le réglage « Envoi notification après constat absence étudiant »
-- (actif par défaut, comme dans l'application).
create function private.notifier_absence(p_etudiant text, p_ec text, p_date date)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_compte uuid;
begin
  if not coalesce((select n.actif and n.envoyer_etudiant from public.notifications_evenementielles n where n.code = 'NOTIFICATION_ABSENCE'), true) then
    return;
  end if;
  for v_compte in
    select c.id from public.comptes c where c.type_compte = 'etudiant' and c.actif and c.lien_id = p_etudiant
  loop
    perform private.envoyer_notification(v_compte, format('Absence constatée en %s le %s', p_ec, to_char(p_date, 'DD/MM/YYYY')));
  end loop;
end;
$$;

-- Absence relevée dans un cahier déjà soumis (appel envoyé après le cahier, ou corrigé).
create function private.suivre_presence()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_cahier public.cahiers;
begin
  if new.statut = 'absent' and (tg_op = 'INSERT' or old.statut is distinct from 'absent') then
    select * into v_cahier from public.cahiers c where c.id = new.cahier_id;
    if v_cahier.statut = 'soumis' then
      perform private.notifier_absence(new.etudiant_id, v_cahier.ec, v_cahier.date);
    end if;
  end if;
  return null;
end;
$$;

revoke execute on function private.suivre_cahier(), private.notifier_absence(text, text, date), private.suivre_presence()
  from public, anon, authenticated;
create trigger cahiers_suivi after insert or update on public.cahiers
  for each row execute function private.suivre_cahier();
create trigger presences_suivi after insert or update of statut on public.presences
  for each row execute function private.suivre_presence();

-- ——— 9. Année clôturée, journal ————————————————————————————————————————————————————————————

create trigger cahiers_annee_cloturee before insert or update or delete on public.cahiers
  for each row execute function private.refuser_annee_cloturee();
create trigger pointages_annee_cloturee before insert or update or delete on public.pointages
  for each row execute function private.refuser_annee_cloturee();
create trigger absences_periodes_annee_cloturee before insert or update or delete on public.absences_periodes
  for each row execute function private.refuser_annee_cloturee();

do $$
declare
  v_table text;
begin
  foreach v_table in array array['cahiers', 'presences', 'cahiers_fichiers', 'pointages', 'absences_periodes', 'portefeuille_cours']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.journaliser_modification()',
      v_table || '_journal', v_table);
  end loop;
end
$$;

-- ——— 10. Droits et règles d'accès ——————————————————————————————————————————————————————————

alter table public.cahiers enable row level security;
alter table public.presences enable row level security;
alter table public.cahiers_fichiers enable row level security;
alter table public.pointages enable row level security;
alter table public.absences_periodes enable row level security;
alter table public.portefeuille_cours enable row level security;
grant select, insert, update, delete on public.cahiers, public.presences, public.cahiers_fichiers, public.pointages,
  public.absences_periodes, public.portefeuille_cours to authenticated, service_role;

create policy cahiers_lecture on public.cahiers for select to authenticated
  using (
    (select private.est_administration())
    or prof_id = (select private.enseignant_courant())
    or (classe_id = (select private.classe_etudiant()) and statut in ('soumis', 'valide'))
  );
create policy cahiers_creation on public.cahiers for insert to authenticated
  with check ((select private.ecrit_cahiers()) or prof_id = (select private.enseignant_courant()));
create policy cahiers_modification on public.cahiers for update to authenticated
  using ((select private.ecrit_cahiers()) or prof_id = (select private.enseignant_courant()))
  with check ((select private.ecrit_cahiers()) or prof_id = (select private.enseignant_courant()));
-- Les brouillons d'une séance annulée partent avec elle (page Emploi du temps).
create policy cahiers_suppression on public.cahiers for delete to authenticated
  using ((select private.a_acces_une_page(array['scol-ass-cahier', 'edt-grille'])));

create policy presences_lecture on public.presences for select to authenticated
  using (
    (select private.est_administration())
    or (etudiant_id = (select private.etudiant_courant()) and private.cahier_lisible(cahier_id))
    or cahier_id = any ((select private.cahiers_enseignant())::text[])
  );
create policy presences_creation on public.presences for insert to authenticated
  with check (
    (select private.a_acces_une_page(array['scol-ass-cahier', 'scol-ass-nouvelle', 'com-demandes']))
    or cahier_id = any ((select private.cahiers_modifiables_enseignant())::text[])
  );
create policy presences_modification on public.presences for update to authenticated
  using (
    (select private.a_acces_une_page(array['scol-ass-cahier', 'scol-ass-nouvelle', 'com-demandes']))
    or cahier_id = any ((select private.cahiers_modifiables_enseignant())::text[])
  )
  with check (
    (select private.a_acces_une_page(array['scol-ass-cahier', 'scol-ass-nouvelle', 'com-demandes']))
    or cahier_id = any ((select private.cahiers_modifiables_enseignant())::text[])
  );
create policy presences_suppression on public.presences for delete to authenticated
  using (
    (select private.a_acces_une_page(array['scol-ass-cahier', 'scol-ass-nouvelle', 'edt-grille']))
    or cahier_id = any ((select private.cahiers_modifiables_enseignant())::text[])
  );

create policy cahiers_fichiers_lecture on public.cahiers_fichiers for select to authenticated
  using (private.cahier_lisible(cahier_id));
create policy cahiers_fichiers_creation on public.cahiers_fichiers for insert to authenticated
  with check (private.cahier_modifiable(cahier_id));
create policy cahiers_fichiers_modification on public.cahiers_fichiers for update to authenticated
  using (private.cahier_modifiable(cahier_id)) with check (private.cahier_modifiable(cahier_id));
create policy cahiers_fichiers_suppression on public.cahiers_fichiers for delete to authenticated
  using (private.cahier_modifiable(cahier_id) or (select private.a_acces_page('edt-grille')));

create policy edumanage_cahiers_lecture on storage.objects for select to authenticated
  using (bucket_id = 'cahiers' and array_length(storage.foldername(name), 1) = 1 and private.cahier_lisible((storage.foldername(name))[1]));
create policy edumanage_cahiers_depot on storage.objects for insert to authenticated
  with check (bucket_id = 'cahiers' and array_length(storage.foldername(name), 1) = 1 and private.cahier_modifiable((storage.foldername(name))[1]));
create policy edumanage_cahiers_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'cahiers' and private.cahier_modifiable((storage.foldername(name))[1]));

create policy pointages_lecture on public.pointages for select to authenticated
  using ((select private.est_administration()) or teacher_id = (select private.enseignant_courant()));
create policy pointages_creation on public.pointages for insert to authenticated
  with check ((select private.a_acces_une_page(array['prof-pointage-nouveau', 'prof-pointage-traitement'])));
create policy pointages_modification on public.pointages for update to authenticated
  using ((select private.a_acces_une_page(array['prof-pointage-nouveau', 'prof-pointage-traitement'])))
  with check ((select private.a_acces_une_page(array['prof-pointage-nouveau', 'prof-pointage-traitement'])));
create policy pointages_suppression on public.pointages for delete to authenticated
  using ((select private.a_acces_une_page(array['prof-pointage-nouveau', 'prof-pointage-traitement'])));

create policy absences_periodes_lecture on public.absences_periodes for select to authenticated
  using (
    (select private.est_administration())
    or etudiant_id = (select private.etudiant_courant())
    or classe_id = any ((select private.classes_enseignant())::text[])
  );
create policy absences_periodes_creation on public.absences_periodes for insert to authenticated
  with check ((select private.a_acces_une_page(array['scol-ass-periode', 'scol-ass-periode-liste'])));
create policy absences_periodes_modification on public.absences_periodes for update to authenticated
  using ((select private.a_acces_une_page(array['scol-ass-periode', 'scol-ass-periode-liste'])))
  with check ((select private.a_acces_une_page(array['scol-ass-periode', 'scol-ass-periode-liste'])));
create policy absences_periodes_suppression on public.absences_periodes for delete to authenticated
  using ((select private.a_acces_une_page(array['scol-ass-periode', 'scol-ass-periode-liste'])));

create policy portefeuille_cours_lecture on public.portefeuille_cours for select to authenticated
  using (
    (select private.est_administration())
    or etudiant_id = (select private.etudiant_courant())
    or classe_id = any ((select private.classes_enseignant())::text[])
  );
create policy portefeuille_cours_creation on public.portefeuille_cours for insert to authenticated
  with check ((select private.a_acces_page('scol-maj-cours-etu')));
create policy portefeuille_cours_modification on public.portefeuille_cours for update to authenticated
  using ((select private.a_acces_page('scol-maj-cours-etu'))) with check ((select private.a_acces_page('scol-maj-cours-etu')));
create policy portefeuille_cours_suppression on public.portefeuille_cours for delete to authenticated
  using ((select private.a_acces_page('scol-maj-cours-etu')));

-- Le professeur lit aussi la fiche d'un étudiant ajouté à un cours de ses classes (redoublant qui
-- reprend un seul cours, par exemple).
alter policy etudiants_lecture on public.etudiants
  using (
    (select private.est_administration())
    or id = (select private.etudiant_courant())
    or classe_id = any ((select private.classes_enseignant())::text[])
    or id = any ((select private.etudiants_ajoutes_enseignant())::text[])
  );
