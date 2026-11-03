-- Notes et résultats (partie 6 du plan de migration, lot 1) : évaluations, notes, demandes de
-- correction.
--
-- Une note passe de « brouillon » (saisie) à « soumise » (à la scolarité), « validée » puis
-- « publiée » (visible par l'étudiant). Validée ou publiée, elle est officielle : sa valeur ne
-- change plus que par une demande de correction acceptée par la scolarité, que la base applique
-- elle-même, et une note publiée ne revient jamais en arrière. Le professeur saisit et soumet les
-- notes de ses évaluations, demande les corrections ; l'étudiant ne lit que ses notes publiées.
-- La base prévient : la scolarité des notes soumises et des corrections demandées, l'étudiant de
-- ses notes publiées et corrigées, le professeur de la décision sur sa demande.

-- ——— 1. Tables ————————————————————————————————————————————————————————————————————————————

create table public.evaluations (
  id text primary key default gen_random_uuid()::text,
  code text not null default '',
  filiere_id text references public.filieres (id) on delete restrict,
  filiere text not null default '',
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  niveau_id text references public.niveaux (id) on delete restrict,
  niveau text not null default '',
  classe_id text not null references public.classes (id) on delete restrict,
  classe text not null default '',
  semestre_id text references public.semestres (id) on delete restrict,
  semestre text not null default '',
  ec_id text not null references public.ecs (id) on delete restrict,
  cours text not null default '',
  professeur_id text references public.enseignants (id) on delete restrict,
  professeur text not null default '',
  type text not null check (type in ('devoir', 'examen')),
  poids numeric not null check (poids between 0 and 100),
  type_evaluation_id text references public.types_evaluation (id) on delete restrict,
  description text,
  cree_par text,
  date_creation date not null default current_date,
  modifie_par text,
  modifie_le date,
  session text check (session = 'rattrapage'),
  constraint evaluations_rattrapage check (session is null or type = 'examen')
);
comment on table public.evaluations is 'Évaluations (devoirs, examens, rattrapages) d''un cours pour une classe, avec leur poids.';

create table public.notes (
  id text primary key default gen_random_uuid()::text,
  etudiant text not null default '',
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  matricule text not null default '',
  ec text not null default '',
  ec_id text not null references public.ecs (id) on delete restrict,
  type text not null check (type in ('CC', 'EF')),
  note numeric not null check (note >= 0),
  -- « ABS » : absent à l'évaluation, compté 0.
  absent boolean not null default false,
  statut text not null check (statut in ('brouillon_prof', 'soumis_admin', 'valide_admin', 'publie')),
  classe_id text not null references public.classes (id) on delete restrict,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  session text check (session = 'rattrapage'),
  evaluation_id text references public.evaluations (id) on delete restrict,
  date_creation timestamptz not null default now(),
  date_modification timestamptz,
  constraint notes_absent check (not absent or note = 0)
);
comment on table public.notes is 'Notes des étudiants, de la saisie à la publication.';
-- Une note par étudiant et par évaluation ; sans évaluation (anciennes saisies, rattrapage), une
-- par étudiant, cours, type et session.
create unique index notes_evaluation_unique on public.notes (etudiant_id, evaluation_id) where evaluation_id is not null;
create unique index notes_sans_evaluation_unique on public.notes (etudiant_id, classe_id, ec_id, type, coalesce(session, ''))
  where evaluation_id is null;

create table public.demandes_correction (
  id text primary key default gen_random_uuid()::text,
  note_id text not null references public.notes (id) on delete cascade,
  etudiant_id text not null references public.etudiants (id) on delete cascade,
  etudiant text not null default '',
  matricule text not null default '',
  ec_id text not null references public.ecs (id) on delete restrict,
  ec text not null default '',
  classe_id text not null references public.classes (id) on delete restrict,
  type_label text not null default '',
  ancienne_note numeric not null,
  ancien_absent boolean not null default false,
  nouvelle_note numeric not null check (nouvelle_note >= 0),
  nouvel_absent boolean not null default false,
  motif text not null check (length(trim(motif)) > 0),
  demande_par_id uuid not null references public.comptes (id) on delete restrict,
  demande_par text not null default '',
  statut text not null check (statut in ('en_attente', 'acceptee', 'refusee')),
  motif_refus text,
  cree_le timestamptz not null default now(),
  traitee_le timestamptz,
  traitee_par text,
  constraint demandes_correction_refus check (statut <> 'refusee' or length(trim(coalesce(motif_refus, ''))) > 0)
);
comment on table public.demandes_correction is 'Demandes de correction d''une note validée ou publiée, et décision de la scolarité.';
create unique index demandes_correction_une_en_attente on public.demandes_correction (note_id) where statut = 'en_attente';

do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('evaluations', array['filiere_id', 'annee', 'niveau_id', 'classe_id', 'semestre_id', 'ec_id', 'professeur_id', 'type_evaluation_id']),
      ('notes', array['etudiant_id', 'ec_id', 'classe_id', 'annee', 'evaluation_id']),
      ('demandes_correction', array['etudiant_id', 'ec_id', 'classe_id', 'demande_par_id'])
    ) as t(nom, colonnes)
  loop
    for i in 1 .. array_length(v.colonnes, 1) loop
      execute format('create index %I on public.%I (%I)', v.nom || '_' || v.colonnes[i] || '_idx', v.nom, v.colonnes[i]);
    end loop;
  end loop;
end
$$;

-- ——— 2. Cours du professeur connecté ————————————————————————————————————————————————————————
-- Ses cours : les séances qu'il donne, et les EC dont il est responsable dans les classes qui
-- suivent leur UE (classe:EC). Ses évaluations : les siennes, et celles de ses cours sans
-- professeur désigné (ou désigné par son seul nom).

create function private.cours_enseignant()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct x.cle), '{}')
  from (
    select s.classe_id || ':' || s.ec_id as cle from public.seances s where s.prof_id = private.enseignant_courant()
    union
    select c.id || ':' || e.id
    from public.ecs e
    join public.ues u on u.id = e.ue_id
    join public.classes c on c.filiere_id = u.filiere_id and c.niveau = u.niveau
    where e.responsable_id = private.enseignant_courant()
  ) x
$$;

create function private.evaluations_enseignant()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(ev.id), '{}')
  from public.evaluations ev
  left join public.enseignants en on en.id = private.enseignant_courant()
  where ev.professeur_id = private.enseignant_courant()
     or (ev.professeur_id is null
         and (ev.classe_id || ':' || ev.ec_id) = any (private.cours_enseignant())
         and (trim(ev.professeur) = '' or lower(trim(ev.professeur)) = lower(en.prenom || ' ' || en.nom)))
$$;

-- Note d'un cours du professeur connecté (pour demander sa correction).
create function private.note_du_professeur(p_note text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.notes n
    where n.id = p_note
      and (n.evaluation_id = any (private.evaluations_enseignant()) or (n.classe_id || ':' || n.ec_id) = any (private.cours_enseignant()))
  )
$$;

revoke execute on function private.cours_enseignant(), private.evaluations_enseignant(), private.note_du_professeur(text) from public, anon;
grant execute on function private.cours_enseignant(), private.evaluations_enseignant(), private.note_du_professeur(text)
  to authenticated, service_role;

-- Valeur d'une note telle que l'application l'affiche : « ABS », « 12,6 » ou « 12,60 ».
create function private.valeur_note(p_note numeric, p_absent boolean, p_deux_decimales boolean default false)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_absent then 'ABS'
    when p_deux_decimales then replace(to_char(p_note, 'FM999990.00'), '.', ',')
    else replace(trim_scale(p_note)::text, '.', ',')
  end
$$;
revoke execute on function private.valeur_note(numeric, boolean, boolean) from public, anon;
grant execute on function private.valeur_note(numeric, boolean, boolean) to authenticated, service_role;

-- ——— 3. Garde-fous des notes ————————————————————————————————————————————————————————————————

-- Note dans le barème de la filière (20 par défaut). Une note validée ou publiée garde son
-- étudiant, son cours et sa valeur ; elle ne change que par une correction acceptée (appliquée
-- par la base, voir suivre_demande_correction) ; publiée, elle le reste.
create function private.controler_note()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_bareme numeric;
begin
  v_bareme := coalesce((select sc.note_bareme from public.scolarite_configs sc join public.classes c on c.filiere_id = sc.filiere_id
                        where c.id = new.classe_id), 20);
  if new.note > v_bareme then
    raise exception 'Note invalide pour % : % — elle doit être comprise entre 0 et %.', new.etudiant, private.valeur_note(new.note, false), trim_scale(v_bareme)
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and old.statut in ('valide_admin', 'publie') then
    if (old.statut = 'publie' and new.statut <> 'publie') or new.statut not in ('valide_admin', 'publie') then
      raise exception 'La note de % en % est déjà % : elle ne revient plus en arrière.', old.etudiant, old.ec,
        case when old.statut = 'publie' then 'publiée' else 'validée' end
        using errcode = 'check_violation';
    end if;
    if (new.etudiant_id, new.ec_id, new.classe_id, new.annee, new.type, new.evaluation_id) is distinct from
       (old.etudiant_id, old.ec_id, old.classe_id, old.annee, old.type, old.evaluation_id)
       or new.session is distinct from old.session then
      raise exception 'Une note validée ou publiée reste attachée à son étudiant et à son évaluation.' using errcode = 'check_violation';
    end if;
    if (new.note, new.absent) is distinct from (old.note, old.absent)
       and coalesce(current_setting('edumanage.correction_note', true), '') <> old.id then
      raise exception 'La note de % en % est validée ou publiée : elle ne change que par une demande de correction acceptée.', old.etudiant, old.ec
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_note() from public, anon, authenticated;
create trigger notes_controle before insert or update on public.notes
  for each row execute function private.controler_note();

-- Notes soumises : la scolarité est prévenue (une notification tant qu'elle ne l'a pas lue).
-- Note publiée : l'étudiant est prévenu, selon le réglage « mise à jour d'une note » (actif par
-- défaut) ; corrigée après publication, il apprend l'ancienne et la nouvelle valeur.
create function private.suivre_note()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_compte uuid;
begin
  if new.statut = 'soumis_admin' and (tg_op = 'INSERT' or old.statut is distinct from 'soumis_admin') then
    for v_compte in
      select c.id from public.comptes c
      where c.type_compte = 'administration' and c.actif and private.acces_page_de(c.id, 'scol-notes-saisie')
    loop
      perform private.envoyer_notification(v_compte, 'De nouvelles notes attendent validation.', 'notes-a-valider',
        '{n} nouvelles notes attendent validation.');
    end loop;
  end if;
  if new.statut = 'publie' and (tg_op = 'INSERT' or old.statut is distinct from 'publie')
     and coalesce((select n.actif and n.envoyer_etudiant from public.notifications_evenementielles n where n.code = 'NOTIFICATION_UPDATE_NOTE'), true) then
    for v_compte in
      select c.id from public.comptes c where c.type_compte = 'etudiant' and c.actif and c.lien_id = new.etudiant_id
    loop
      perform private.envoyer_notification(v_compte, 'Nouvelle note publiée — ' || new.ec, 'notes-publiees',
        '{n} nouvelles notes publiées — dernière : ' || new.ec);
    end loop;
  end if;
  if tg_op = 'UPDATE' and old.statut = 'publie' and new.statut = 'publie' and (new.note, new.absent) is distinct from (old.note, old.absent) then
    for v_compte in
      select c.id from public.comptes c where c.type_compte = 'etudiant' and c.actif and c.lien_id = new.etudiant_id
    loop
      perform private.envoyer_notification(v_compte, format('Note corrigée — %s (%s) : %s → %s.', new.ec,
        case new.type when 'EF' then 'Examen' else 'Contrôle continu' end,
        private.valeur_note(old.note, old.absent), private.valeur_note(new.note, new.absent)));
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function private.suivre_note() from public, anon, authenticated;
create trigger notes_suivi after insert or update on public.notes
  for each row execute function private.suivre_note();

-- ——— 4. Demandes de correction ——————————————————————————————————————————————————————————————

-- Une demande porte sur une note officielle, telle qu'elle est en base, au nom de qui la fait ;
-- elle n'est traitée qu'une fois, et seule sa décision change.
create function private.controler_demande_correction()
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
  return new;
end;
$$;
revoke execute on function private.controler_demande_correction() from public, anon, authenticated;
create trigger demandes_correction_controle before insert or update on public.demandes_correction
  for each row execute function private.controler_demande_correction();

-- Demande reçue : la scolarité est prévenue. Acceptée : la base corrige la note (le seul chemin
-- qui change une note officielle) ; le professeur apprend la décision.
create function private.suivre_demande_correction()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_compte uuid;
  v_avant_apres text := private.valeur_note(new.ancienne_note, new.ancien_absent, true) || ' → '
    || private.valeur_note(new.nouvelle_note, new.nouvel_absent, true);
begin
  if tg_op = 'INSERT' then
    for v_compte in
      select c.id from public.comptes c
      where c.type_compte = 'administration' and c.actif and private.acces_page_de(c.id, 'scol-notes-saisie')
    loop
      perform private.envoyer_notification(v_compte, format('Correction de note demandée par %s : %s — %s (%s) %s.',
        new.demande_par, new.etudiant, new.ec, new.type_label, v_avant_apres));
    end loop;
    return null;
  end if;
  if new.statut = 'acceptee' then
    perform set_config('edumanage.correction_note', new.note_id, true);
    update public.notes set note = new.nouvelle_note, absent = new.nouvel_absent, date_modification = now() where id = new.note_id;
    perform set_config('edumanage.correction_note', '', true);
    perform private.envoyer_notification(new.demande_par_id, format('Votre demande de correction a été acceptée : %s — %s (%s) %s.',
      new.etudiant, new.ec, new.type_label, v_avant_apres));
  elsif new.statut = 'refusee' then
    perform private.envoyer_notification(new.demande_par_id, format('Votre demande de correction a été refusée : %s — %s (%s) — motif : %s.',
      new.etudiant, new.ec, new.type_label, new.motif_refus));
  end if;
  return null;
end;
$$;
revoke execute on function private.suivre_demande_correction() from public, anon, authenticated;
create trigger demandes_correction_suivi after insert or update on public.demandes_correction
  for each row execute function private.suivre_demande_correction();

-- ——— 5. Année clôturée, journal, compteurs ————————————————————————————————————————————————

create trigger evaluations_annee_cloturee before insert or update or delete on public.evaluations
  for each row execute function private.refuser_annee_cloturee();
create trigger notes_annee_cloturee before insert or update or delete on public.notes
  for each row execute function private.refuser_annee_cloturee();
create trigger evaluations_journal after insert or update or delete on public.evaluations
  for each row execute function private.journaliser_modification();
create trigger notes_journal after insert or update or delete on public.notes
  for each row execute function private.journaliser_modification();
create trigger demandes_correction_journal after insert or update or delete on public.demandes_correction
  for each row execute function private.journaliser_modification();
select private.suivre_table('evaluations');
select private.suivre_table('notes');
select private.suivre_table('demandes_correction');

-- ——— 6. Droits et règles d'accès ————————————————————————————————————————————————————————————

alter table public.evaluations enable row level security;
alter table public.notes enable row level security;
alter table public.demandes_correction enable row level security;
grant select, insert, update, delete on public.evaluations, public.notes to authenticated, service_role;
grant select, insert, update on public.demandes_correction to authenticated, service_role;

-- Évaluations : lues par l'administration, par le professeur de ses cours, par l'étudiant de sa
-- classe (et des cours où il est ajouté) ; écrites par les pages Évaluations, Saisie notes et
-- Rattrapage.
create policy evaluations_lecture on public.evaluations for select to authenticated
  using (
    (select private.est_administration())
    or professeur_id = (select private.enseignant_courant())
    or (classe_id || ':' || ec_id) = any ((select private.cours_enseignant())::text[])
    or classe_id = (select private.classe_etudiant())
    or exists (select 1 from public.portefeuille_cours p
               where p.etudiant_id = (select private.etudiant_courant()) and p.classe_id = evaluations.classe_id
                 and p.ec_id = evaluations.ec_id and p.action = 'ajout')
  );
create policy evaluations_creation on public.evaluations for insert to authenticated
  with check ((select private.a_acces_une_page(array['scol-eval-nouvelle', 'scol-eval-devoir', 'scol-eval-poids', 'scol-eval-poids-masse',
    'scol-notes-saisie', 'scol-notes-rattrapage'])));
create policy evaluations_modification on public.evaluations for update to authenticated
  using ((select private.a_acces_une_page(array['scol-eval-nouvelle', 'scol-eval-devoir', 'scol-eval-poids', 'scol-eval-poids-masse',
    'scol-notes-saisie', 'scol-notes-rattrapage'])))
  with check ((select private.a_acces_une_page(array['scol-eval-nouvelle', 'scol-eval-devoir', 'scol-eval-poids', 'scol-eval-poids-masse',
    'scol-notes-saisie', 'scol-notes-rattrapage'])));
create policy evaluations_suppression on public.evaluations for delete to authenticated
  using ((select private.a_acces_une_page(array['scol-eval-devoir', 'scol-eval-poids'])));

-- Notes : lues par l'administration, par le professeur de ses cours, par l'étudiant (les siennes,
-- publiées). La scolarité saisit, valide et publie ; le professeur saisit et soumet celles de ses
-- évaluations, tant qu'elles ne sont ni validées ni publiées.
create policy notes_lecture on public.notes for select to authenticated
  using (
    (select private.est_administration())
    or (etudiant_id = (select private.etudiant_courant()) and statut = 'publie')
    or (classe_id || ':' || ec_id) = any ((select private.cours_enseignant())::text[])
  );
create policy notes_saisie on public.notes for insert to authenticated
  with check (
    (select private.a_acces_une_page(array['scol-notes-saisie', 'scol-notes-rattrapage']))
    or (evaluation_id = any ((select private.evaluations_enseignant())::text[]) and statut in ('brouillon_prof', 'soumis_admin'))
  );
create policy notes_modification on public.notes for update to authenticated
  using (
    (select private.a_acces_une_page(array['scol-notes-saisie', 'scol-notes-rattrapage']))
    or (evaluation_id = any ((select private.evaluations_enseignant())::text[]) and statut in ('brouillon_prof', 'soumis_admin'))
  )
  with check (
    (select private.a_acces_une_page(array['scol-notes-saisie', 'scol-notes-rattrapage']))
    or (evaluation_id = any ((select private.evaluations_enseignant())::text[]) and statut in ('brouillon_prof', 'soumis_admin'))
  );
create policy notes_suppression on public.notes for delete to authenticated
  using (
    (select private.a_acces_une_page(array['scol-notes-saisie', 'scol-notes-etudiants', 'scol-notes-rattrapage', 'scol-eval-devoir', 'scol-eval-poids']))
    or (evaluation_id = any ((select private.evaluations_enseignant())::text[]) and statut in ('brouillon_prof', 'soumis_admin'))
  );

-- Demandes de correction : lues par l'administration et par qui les a faites ; faites par le
-- professeur (sur une note de ses cours) ou la scolarité ; décidées par la page Saisie notes.
create policy demandes_correction_lecture on public.demandes_correction for select to authenticated
  using ((select private.est_administration()) or demande_par_id = (select auth.uid()));
create policy demandes_correction_creation on public.demandes_correction for insert to authenticated
  with check (
    demande_par_id = (select auth.uid())
    and ((select private.a_acces_page('scol-notes-saisie')) or private.note_du_professeur(note_id))
  );
create policy demandes_correction_decision on public.demandes_correction for update to authenticated
  using ((select private.a_acces_page('scol-notes-saisie'))) with check ((select private.a_acces_page('scol-notes-saisie')));
