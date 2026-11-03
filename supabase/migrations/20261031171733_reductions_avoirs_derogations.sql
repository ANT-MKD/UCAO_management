-- Finances (partie 7 du plan de migration, lot 2) : réductions et plafonds autorisés, avoirs
-- déposés et remboursés, dérogations, relances et rappels de paiement, reprise des anciens frais.
--
-- Comme au lot 1, chaque pièce reçoit son numéro de la base (RED-, DPT-, REMB-, DER-, RAP-) et les
-- soldes ne bougent que par les mouvements : une réduction, un dépôt ou un remboursement d'avoir
-- part avec son mouvement, que la base additionne (un remboursement au-delà de l'avoir restant est
-- refusé). Une réduction ne dépasse jamais l'autorisation de la personne qui l'accorde (taux et
-- plafond sur la période), même depuis deux postes. Une pièce annulée ou une dérogation révoquée
-- le reste ; rien ne se supprime. L'étudiant lit ses dérogations et ses relances, et la base le
-- prévient d'une relance. Les professeurs et les étudiants de leurs classes peuvent désormais se
-- prévenir l'un l'autre (notifications envoyées depuis l'application).

-- ——— 1. Tables ———————————————————————————————————————————————————————————————————————————

-- Autorisation d'accorder des réductions : taux maximal et plafond cumulé sur une période.
create table public.reductions_autorisees (
  id text primary key default gen_random_uuid()::text,
  personnel_id uuid not null references public.comptes (id) on delete cascade,
  taux_max numeric not null check (taux_max > 0 and taux_max <= 100),
  montant_plafond numeric not null check (montant_plafond >= 0),
  date_debut date not null,
  date_fin date not null,
  constraint reductions_autorisees_periode check (date_fin >= date_debut)
);
comment on table public.reductions_autorisees is 'Qui peut accorder des réductions, à quel taux au plus et pour quel montant cumulé sur la période.';
create index reductions_autorisees_personnel_id_idx on public.reductions_autorisees (personnel_id);

create table public.reductions_frais (
  id text primary key,
  reference text not null unique check (reference ~ '^RED-[0-9]{4}-[0-9]{3,}$'),
  date date not null,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  personnel_id uuid not null references public.comptes (id) on delete restrict,
  taux_applique numeric not null check (taux_applique > 0 and taux_applique <= 100),
  total_reduit numeric not null check (total_reduit > 0),
  annulee boolean not null default false
);
comment on table public.reductions_frais is 'Réductions accordées sur le solde dû, dans la limite de l''autorisation de leur auteur.';
create index reductions_frais_etudiant_id_idx on public.reductions_frais (etudiant_id);
create index reductions_frais_personnel_id_idx on public.reductions_frais (personnel_id);

create table public.avoirs_depots (
  id text primary key,
  reference text not null unique check (reference ~ '^DPT-[0-9]{4}-[0-9]{3,}$'),
  date date not null,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  payeur text not null default '',
  montant numeric not null check (montant > 0),
  motif text not null default '',
  moyen_origine text not null default '',
  reference_bancaire text,
  ajoutee_par text not null default '',
  annulee boolean not null default false
);
comment on table public.avoirs_depots is 'Dépôts d''avoir (crédit en faveur d''un étudiant).';
create index avoirs_depots_etudiant_id_idx on public.avoirs_depots (etudiant_id);

create table public.avoirs_remboursements (
  id text primary key,
  reference text not null unique check (reference ~ '^REMB-[0-9]{4}-[0-9]{3,}$'),
  date date not null,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  payeur text not null default '',
  montant numeric not null check (montant > 0),
  motif text not null default '',
  moyen_remboursement text not null default '',
  reference_bancaire text,
  ajoutee_par text not null default '',
  annulee boolean not null default false
);
comment on table public.avoirs_remboursements is 'Remboursements d''avoir à un étudiant.';
create index avoirs_remboursements_etudiant_id_idx on public.avoirs_remboursements (etudiant_id);

create table public.derogations_paiement (
  id text primary key,
  reference text not null unique check (reference ~ '^DER-[0-9]{4}-[0-9]{3,}$'),
  date date not null default current_date,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  etudiant_label text not null default '',
  solde_du_constate numeric not null default 0,
  portee text not null check (portee in ('reinscription', 'documents', 'global')),
  motif text not null check (length(trim(motif)) > 0),
  personnel_id uuid not null references public.comptes (id) on delete restrict,
  personnel_label text not null default '',
  date_debut date not null,
  date_fin date not null,
  revoquee boolean not null default false,
  motif_revocation text,
  revoquee_le date,
  constraint derogations_paiement_periode check (date_fin >= date_debut),
  constraint derogations_paiement_revocation check (not revoquee or length(trim(coalesce(motif_revocation, ''))) > 0)
);
comment on table public.derogations_paiement is 'Dérogations accordées à un étudiant en impayé (réinscription, documents ou accès global).';
create index derogations_paiement_etudiant_id_idx on public.derogations_paiement (etudiant_id);
create index derogations_paiement_personnel_id_idx on public.derogations_paiement (personnel_id);

create table public.relances_paiement (
  id text primary key,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  date_envoi date not null,
  date_echeance date not null,
  montant_du numeric not null check (montant_du >= 0),
  envoye_par uuid references public.comptes (id) on delete set null,
  statut text not null check (statut in ('active', 'resolue', 'annulee'))
);
comment on table public.relances_paiement is 'Relances de paiement envoyées aux étudiants en impayé, avec leur échéance avant blocage.';
create index relances_paiement_etudiant_id_idx on public.relances_paiement (etudiant_id);
create index relances_paiement_envoye_par_idx on public.relances_paiement (envoye_par);

create table public.rappels_paiement (
  id text primary key,
  reference text not null unique check (reference ~ '^RAP-[0-9]{4}-[0-9]{3,}$'),
  date date not null default current_date,
  filiere_id text references public.filieres (id) on delete restrict,
  filiere_label text not null default '',
  niveau text,
  niveau_label text,
  annee text not null default '',
  frais_echus_avant date not null,
  nouvelle_echeance date,
  quittance_ids text[] not null default '{}',
  nb_etudiants integer not null default 0 check (nb_etudiants >= 0),
  nb_notifications_envoyees integer not null default 0 check (nb_notifications_envoyees >= 0)
);
comment on table public.rappels_paiement is 'Rappels de paiement envoyés par filière (frais échus), avec le report d''échéance éventuel.';
create index rappels_paiement_filiere_id_idx on public.rappels_paiement (filiere_id);

create table public.reprises_frais (
  id text primary key,
  ancien_code text not null check (length(trim(ancien_code)) > 0),
  nom text not null default '',
  prenom text not null default '',
  libelle_annee_scolaire text not null default '',
  montant numeric not null check (montant >= 0),
  etudiant_id text references public.etudiants (id) on delete restrict,
  statut text not null check (statut in ('en_attente', 'valide', 'rejete')),
  importe_le date not null default current_date,
  motif_rejet text,
  constraint reprises_frais_code unique (ancien_code, libelle_annee_scolaire)
);
comment on table public.reprises_frais is 'Frais repris de l''ancien système, validés un à un en frais réels.';
create index reprises_frais_etudiant_id_idx on public.reprises_frais (etudiant_id);

-- ——— 2. Numéros et contrôles ———————————————————————————————————————————————————————————————

create trigger reductions_frais_a_numero before insert on public.reductions_frais
  for each row execute function private.numeroter_piece('reference', 'RED', 'date');
create trigger avoirs_depots_a_numero before insert on public.avoirs_depots
  for each row execute function private.numeroter_piece('reference', 'DPT', 'date');
create trigger avoirs_remboursements_a_numero before insert on public.avoirs_remboursements
  for each row execute function private.numeroter_piece('reference', 'REMB', 'date');
create trigger derogations_paiement_a_numero before insert on public.derogations_paiement
  for each row execute function private.numeroter_piece('reference', 'DER', 'date_debut');
create trigger rappels_paiement_a_numero before insert on public.rappels_paiement
  for each row execute function private.numeroter_piece('reference', 'RAP', 'date');

-- Pièce enregistrée : seule son annulation se note ensuite (définitive) ; un poste qui renvoie son
-- numéro provisoire ou d'autres valeurs est ignoré.
create function private.garder_piece_annulable()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_annulee boolean;
begin
  if old.annulee and not new.annulee then
    raise exception 'La pièce % est annulée : elle le reste.', old.reference using errcode = 'check_violation';
  end if;
  v_annulee := new.annulee;
  new := old;
  new.annulee := v_annulee;
  return new;
end;
$$;
revoke execute on function private.garder_piece_annulable() from public, anon, authenticated;
create trigger reductions_frais_controle before update on public.reductions_frais
  for each row execute function private.garder_piece_annulable();
create trigger avoirs_depots_controle before update on public.avoirs_depots
  for each row execute function private.garder_piece_annulable();
create trigger avoirs_remboursements_controle before update on public.avoirs_remboursements
  for each row execute function private.garder_piece_annulable();

-- Une réduction reste dans l'autorisation de la personne qui l'accorde : autorisation en cours à
-- la date de la réduction, taux au plus égal au taux autorisé, cumul de la période au plus égal au
-- plafond. Deux réductions simultanées de la même personne passent l'une après l'autre.
create function private.controler_reduction()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_autorisation public.reductions_autorisees;
  v_deja numeric;
begin
  if exists (select 1 from public.reductions_frais r where r.id = new.id) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('reduction:' || new.personnel_id::text));
  select * into v_autorisation from public.reductions_autorisees a
    where a.personnel_id = new.personnel_id and new.date between a.date_debut and a.date_fin
    order by a.date_fin desc limit 1;
  if v_autorisation.id is null then
    raise exception 'Aucune autorisation de réduction en cours pour cette personne au %.', to_char(new.date, 'DD/MM/YYYY')
      using errcode = 'insufficient_privilege';
  end if;
  if new.taux_applique > v_autorisation.taux_max then
    raise exception 'Taux de % %% au-delà du taux autorisé (% %%).', new.taux_applique, v_autorisation.taux_max using errcode = 'check_violation';
  end if;
  select coalesce(sum(r.total_reduit), 0) into v_deja from public.reductions_frais r
    where r.personnel_id = new.personnel_id and not r.annulee and r.date between v_autorisation.date_debut and v_autorisation.date_fin;
  if v_deja + new.total_reduit > v_autorisation.montant_plafond then
    raise exception 'Plafond de réduction dépassé : % F déjà accordés sur % F autorisés pour la période.',
      private.montant_fr(v_deja), private.montant_fr(v_autorisation.montant_plafond) using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_reduction() from public, anon, authenticated;
create trigger reductions_frais_autorisation before insert on public.reductions_frais
  for each row execute function private.controler_reduction();

-- Une dérogation ne se modifie plus ; seule sa révocation (définitive, motivée) se note.
create function private.controler_derogation()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_revoquee boolean := new.revoquee;
  v_motif text := new.motif_revocation;
  v_le date := new.revoquee_le;
begin
  if old.revoquee then
    if not new.revoquee then
      raise exception 'La dérogation % est révoquée : elle le reste.', old.reference using errcode = 'check_violation';
    end if;
    return old;
  end if;
  new := old;
  if v_revoquee then
    new.revoquee := true;
    new.motif_revocation := v_motif;
    new.revoquee_le := coalesce(v_le, current_date);
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_derogation() from public, anon, authenticated;
create trigger derogations_paiement_controle before update on public.derogations_paiement
  for each row execute function private.controler_derogation();

-- Une relance active se clôt (résolue ou remplacée) ; elle ne se rouvre pas.
create function private.controler_relance()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_statut text := new.statut;
begin
  if old.statut <> 'active' and v_statut <> old.statut then
    raise exception 'Cette relance est close : elle ne se rouvre pas.' using errcode = 'check_violation';
  end if;
  new := old;
  new.statut := v_statut;
  return new;
end;
$$;
revoke execute on function private.controler_relance() from public, anon, authenticated;
create trigger relances_paiement_controle before update on public.relances_paiement
  for each row execute function private.controler_relance();

-- Relance envoyée : l'étudiant en est prévenu, avec son échéance.
create function private.suivre_relance()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_compte uuid;
begin
  for v_compte in
    select c.id from public.comptes c where c.type_compte = 'etudiant' and c.actif and c.lien_id = new.etudiant_id
  loop
    perform private.envoyer_notification(v_compte, format(
      'Rappel de paiement : votre dossier présente un solde impayé de %s FCFA. Régularisez-le avant le %s, faute de quoi l''accès à votre portail sera suspendu.',
      private.montant_fr(new.montant_du), to_char(new.date_echeance, 'DD/MM/YYYY')));
  end loop;
  return null;
end;
$$;
revoke execute on function private.suivre_relance() from public, anon, authenticated;
create trigger relances_paiement_suivi after insert on public.relances_paiement
  for each row execute function private.suivre_relance();

-- Un rappel envoyé ne change plus.
create function private.garder_tel_quel()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  return old;
end;
$$;
revoke execute on function private.garder_tel_quel() from public, anon, authenticated;
create trigger rappels_paiement_controle before update on public.rappels_paiement
  for each row execute function private.garder_tel_quel();

-- Une reprise se traite une fois (validée ou rejetée avec son motif) ; tant qu'elle attend, on
-- peut lui associer l'étudiant retrouvé.
create function private.controler_reprise()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_statut text := new.statut;
  v_etudiant text := new.etudiant_id;
  v_motif text := new.motif_rejet;
begin
  if old.statut <> 'en_attente' then
    if v_statut <> old.statut then
      raise exception 'Cette reprise a déjà été traitée.' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if v_statut = 'valide' and v_etudiant is null then
    raise exception 'Associez d''abord un étudiant avant de valider.' using errcode = 'check_violation';
  end if;
  if v_statut = 'rejete' and length(trim(coalesce(v_motif, ''))) = 0 then
    raise exception 'Indiquez le motif du rejet.' using errcode = 'check_violation';
  end if;
  new := old;
  new.statut := v_statut;
  new.etudiant_id := v_etudiant;
  new.motif_rejet := v_motif;
  return new;
end;
$$;
revoke execute on function private.controler_reprise() from public, anon, authenticated;
create trigger reprises_frais_controle before update on public.reprises_frais
  for each row execute function private.controler_reprise();

-- ——— 3. Notifications entre professeurs et étudiants de leurs classes ——————————————————————————
-- Partie 1 : chacun se notifie lui-même et prévient l'administration ; l'administration prévient
-- tout le monde. Désormais aussi : un professeur prévient les étudiants de ses classes, un
-- étudiant les professeurs de sa classe (ressources, messages).
create or replace function public.notifier(
  p_destinataire uuid,
  p_message text,
  p_groupe text default null,
  p_message_groupe text default null
)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_moi uuid := (select auth.uid());
  v_id bigint;
begin
  if (select private.type_compte_courant()) is null then
    raise exception 'Connectez-vous avec un compte actif.' using errcode = 'insufficient_privilege';
  end if;
  if not (
    p_destinataire = v_moi
    or (select private.est_administration())
    or exists (select 1 from public.comptes c where c.id = p_destinataire and c.type_compte = 'administration')
    or exists (select 1 from public.comptes c join public.etudiants e on e.id = c.lien_id
               where c.id = p_destinataire and c.type_compte = 'etudiant' and e.classe_id = any (private.classes_enseignant()))
    or exists (select 1 from public.comptes c
               where c.id = p_destinataire and c.type_compte = 'enseignant'
                 and (exists (select 1 from public.seances s where s.prof_id = c.lien_id and s.classe_id = (select private.classe_etudiant()))
                      or exists (select 1 from public.ecs e
                                   join public.ues u on u.id = e.ue_id
                                   join public.classes k on k.filiere_id = u.filiere_id and k.niveau = u.niveau
                                 where e.responsable_id = c.lien_id and k.id = (select private.classe_etudiant()))))
  ) then
    raise exception 'Vous ne pouvez pas envoyer de notification à ce compte.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.notifications as n (destinataire, message, groupe)
  values (p_destinataire, p_message, p_groupe)
  on conflict (destinataire, groupe) where groupe is not null and not lue
  do update set
    nombre = n.nombre + 1,
    message = replace(coalesce(p_message_groupe, p_message), '{n}', (n.nombre + 1)::text),
    cree_le = now()
  returning n.id into v_id;
  return v_id;
end;
$$;

-- ——— 4. Journal, compteurs de changements et droits ————————————————————————————————————————

do $$
declare
  v_table text;
begin
  foreach v_table in array array['reductions_autorisees', 'reductions_frais', 'avoirs_depots', 'avoirs_remboursements', 'derogations_paiement',
    'relances_paiement', 'rappels_paiement', 'reprises_frais']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.journaliser_modification()',
      v_table || '_journal', v_table);
    perform private.suivre_table(v_table);
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end
$$;

grant select, insert, update, delete on public.reductions_autorisees to authenticated, service_role;
grant select, insert, update on public.reductions_frais, public.avoirs_depots, public.avoirs_remboursements, public.derogations_paiement,
  public.relances_paiement, public.rappels_paiement, public.reprises_frais to authenticated, service_role;

-- Autorisations : lues par l'administration, réglées par la page « Réduction autorisée ».
create policy reductions_autorisees_lecture on public.reductions_autorisees for select to authenticated
  using ((select private.est_administration()));
create policy reductions_autorisees_creation on public.reductions_autorisees for insert to authenticated
  with check ((select private.a_acces_page('fin-reduction-autorisee')));
create policy reductions_autorisees_modification on public.reductions_autorisees for update to authenticated
  using ((select private.a_acces_page('fin-reduction-autorisee'))) with check ((select private.a_acces_page('fin-reduction-autorisee')));
create policy reductions_autorisees_suppression on public.reductions_autorisees for delete to authenticated
  using ((select private.a_acces_page('fin-reduction-autorisee')));

-- Pièces lues par l'administration et l'étudiant concerné ; écrites par leurs pages Finances.
do $$
declare
  v_regle record;
begin
  for v_regle in
    select * from (values
      ('reductions_frais', array['fin-reduction-frais'], true),
      ('avoirs_depots', array['fin-avoir-depot', 'fin-avoir-remboursements', 'fin-avoir-consentement'], true),
      ('avoirs_remboursements', array['fin-avoir-remboursement', 'fin-avoir-remboursements'], true),
      ('derogations_paiement', array['fin-derogation', 'com-demandes'], true),
      ('relances_paiement', array['etudiants-interdire'], true),
      ('rappels_paiement', array['fin-rappel'], false),
      ('reprises_frais', array['fin-reprise-nouvelle', 'fin-reprise-liste'], false)
    ) as r(nom, pages, etudiant)
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.est_administration())%s)',
      v_regle.nom || '_lecture', v_regle.nom,
      case when v_regle.etudiant then ' or etudiant_id = (select private.etudiant_courant())' else '' end);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.a_acces_une_page(%L)))',
      v_regle.nom || '_creation', v_regle.nom, v_regle.pages);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.a_acces_une_page(%L))) '
      'with check ((select private.a_acces_une_page(%L)))', v_regle.nom || '_modification', v_regle.nom, v_regle.pages, v_regle.pages);
  end loop;
end
$$;
