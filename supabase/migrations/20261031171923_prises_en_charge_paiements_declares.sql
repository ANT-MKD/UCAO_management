-- Finances (partie 7 du plan de migration, lot 3) : organismes et prises en charge, encaissements
-- des organismes (un à un ou en masse), prises en charge en masse, paiements déclarés en ligne par
-- les étudiants, factures d'autres services, devis et émissions de quittances en masse.
--
-- Numéros donnés par la base (PEC-, ENC-PEC-, PECM-, REGM-, FAS-, DEV-, EM-) ; les quittances et
-- prises en charge qui reprenaient un numéro provisoire reçoivent le définitif. Ce qu'un organisme
-- a réellement versé sur une prise en charge est recalculé par la base à partir de ses
-- encaissements. Un paiement déclaré ne dépasse jamais le reste à payer (déclarations en attente
-- comprises) ; seule la caisse le confirme ou le rejette, et la base prévient la caisse puis
-- l'étudiant. Une pièce annulée le reste ; rien ne se supprime (sauf un organisme sans prise en
-- charge).

-- ——— 1. Numéro provisoire remplacé : retenu pour les déclencheurs qui suivent ————————————————————

create or replace function private.numeroter_piece()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_colonne text := tg_argv[0];
  v_prefixe text := tg_argv[1];
  v_source text := to_jsonb(new) ->> tg_argv[2];
  v_annee text := case when v_source ~ '^[0-9]{4}' then left(v_source, 4) else to_char(now(), 'YYYY') end;
  v_provisoire text := to_jsonb(new) ->> v_colonne;
  v_numero text;
  v_existe boolean;
begin
  perform set_config('edumanage.numero_provisoire', '', true);
  execute format('select exists (select 1 from %I.%I where id = $1)', tg_table_schema, tg_table_name) into v_existe using new.id;
  if v_existe then
    return new;
  end if;
  loop
    v_numero := v_prefixe || '-' || v_annee || '-' || lpad(private.prochain_numero(lower(v_prefixe) || ':' || v_annee)::text, 3, '0');
    execute format('select exists (select 1 from %I.%I where %I = $1)', tg_table_schema, tg_table_name, v_colonne) into v_existe using v_numero;
    exit when not v_existe;
  end loop;
  new := jsonb_populate_record(new, jsonb_build_object(v_colonne, v_numero));
  if tg_nargs > 3 and to_jsonb(new) ->> tg_argv[3] is not distinct from v_provisoire then
    new := jsonb_populate_record(new, jsonb_build_object(tg_argv[3], v_numero));
  end if;
  -- Numéro provisoire remplacé, pour les déclencheurs qui le reportent ailleurs.
  if v_provisoire is not null and v_provisoire <> v_numero then
    perform set_config('edumanage.numero_provisoire', v_provisoire, true);
  end if;
  return new;
end;
$$;

-- Pages des prises en charge et des encaissements des organismes.
create function private.gere_prises_en_charge()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.a_acces_une_page(array['fin-pec-liste', 'fin-pec-organisme', 'fin-enc-pec', 'fin-enc-pec-masse', 'fin-enc-pec-liste', 'fin-enc-pec-masse2'])
$$;
revoke execute on function private.gere_prises_en_charge() from public, anon;
grant execute on function private.gere_prises_en_charge() to authenticated, service_role;

-- ——— 2. Tables ———————————————————————————————————————————————————————————————————————————

create table public.organismes_pec (
  id text primary key default gen_random_uuid()::text,
  intitule text not null check (length(trim(intitule)) > 0),
  adresse text not null default '',
  telephone text,
  email text,
  remarques text,
  contact_nom text not null default '',
  contact_telephone text,
  contact_email text
);
comment on table public.organismes_pec is 'Organismes qui prennent en charge les frais d''étudiants (bourses, entreprises…).';

create table public.prises_en_charge (
  id text primary key,
  reference text not null unique check (reference ~ '^PEC-[0-9]{4}-[0-9]{3,}$'),
  reference_externe text,
  type text not null check (type in ('montant', 'pourcentage')),
  date_saisie date not null,
  organisme_id text not null references public.organismes_pec (id) on delete restrict,
  organisme text not null default '',
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  etudiant text not null default '',
  filiere text not null default '',
  annee text not null default '',
  debut date not null,
  fin date not null,
  date_limite date not null,
  montant numeric check (montant is null or montant >= 0),
  pourcentage numeric check (pourcentage is null or pourcentage between 0 and 100),
  document text,
  ajoutee_par text not null default '',
  lignes jsonb not null default '[]' check (jsonb_typeof(lignes) = 'array'),
  annulee boolean not null default false,
  -- Versé par l'organisme : recalculé par la base à partir des encaissements.
  montant_encaisse numeric not null default 0,
  constraint prises_en_charge_periode check (fin >= debut)
);
comment on table public.prises_en_charge is 'Prises en charge des frais d''un étudiant par un organisme ; le versé est recalculé par la base.';
create index prises_en_charge_organisme_id_idx on public.prises_en_charge (organisme_id);
create index prises_en_charge_etudiant_id_idx on public.prises_en_charge (etudiant_id);

create table public.encaissements_pec (
  id text primary key,
  reference text not null unique check (reference ~ '^ENC-PEC-[0-9]{4}-[0-9]{3,}$'),
  organisme_id text not null references public.organismes_pec (id) on delete restrict,
  organisme text not null default '',
  date date not null,
  mode_paiement text not null default '',
  reference_bancaire text,
  ajoutee_par text not null default '',
  lignes jsonb not null default '[]' check (jsonb_typeof(lignes) = 'array'),
  annulee boolean not null default false
);
comment on table public.encaissements_pec is 'Versements reçus d''un organisme, répartis sur ses prises en charge.';
create index encaissements_pec_organisme_id_idx on public.encaissements_pec (organisme_id);

create table public.pec_masse (
  id text primary key,
  reference text not null unique check (reference ~ '^PECM-[0-9]{4}-[0-9]{3,}$'),
  organisme_id text not null references public.organismes_pec (id) on delete restrict,
  organisme text not null default '',
  type text not null check (type in ('montant', 'pourcentage')),
  montant numeric,
  pourcentage numeric,
  filiere_id text references public.filieres (id) on delete restrict,
  filiere text not null default '',
  annee text not null default '',
  niveau_id text references public.niveaux (id) on delete restrict,
  niveau text not null default '',
  classe_id text references public.classes (id) on delete restrict,
  classe text not null default '',
  debut date not null,
  fin date not null,
  date_limite date not null,
  filtre_frais text,
  emis_le date not null default current_date,
  ajoutee_par text not null default '',
  prise_en_charge_ids text[] not null default '{}',
  annulee boolean not null default false
);
comment on table public.pec_masse is 'Prises en charge générées pour toute une classe.';
create index pec_masse_organisme_id_idx on public.pec_masse (organisme_id);
create index pec_masse_filiere_id_idx on public.pec_masse (filiere_id);
create index pec_masse_niveau_id_idx on public.pec_masse (niveau_id);
create index pec_masse_classe_id_idx on public.pec_masse (classe_id);

create table public.reglements_masse (
  id text primary key,
  reference text not null unique check (reference ~ '^REGM-[0-9]{4}-[0-9]{3,}$'),
  organisme_id text not null references public.organismes_pec (id) on delete restrict,
  organisme text not null default '',
  annee text not null default '',
  date date not null,
  mode_paiement text not null default '',
  reference_bancaire text,
  montant_global numeric not null check (montant_global >= 0),
  ajoutee_par text not null default '',
  lignes jsonb not null default '[]' check (jsonb_typeof(lignes) = 'array'),
  annulee boolean not null default false
);
comment on table public.reglements_masse is 'Montant global reçu d''un organisme, réparti sur plusieurs prises en charge.';
create index reglements_masse_organisme_id_idx on public.reglements_masse (organisme_id);

create table public.paiements_declares (
  id text primary key,
  quittance_id text not null references public.quittances (id) on delete restrict,
  quittance_reference text not null default '',
  rubrique text not null default '',
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  etudiant_label text not null default '',
  montant numeric not null check (montant > 0),
  moyen text not null check (length(trim(moyen)) > 0),
  telephone text not null default '',
  reference_transaction text not null check (length(trim(reference_transaction)) > 0),
  declare_le timestamptz not null default now(),
  statut text not null check (statut in ('a_verifier', 'confirme', 'rejete')),
  traite_le timestamptz,
  traite_par text,
  motif_rejet text,
  constraint paiements_declares_rejet check (statut <> 'rejete' or length(trim(coalesce(motif_rejet, ''))) > 0)
);
comment on table public.paiements_declares is 'Paiements Wave / Orange Money déclarés par les étudiants, à vérifier par la caisse.';
create index paiements_declares_quittance_id_idx on public.paiements_declares (quittance_id);
create index paiements_declares_etudiant_id_idx on public.paiements_declares (etudiant_id);

create table public.factures_autres_services (
  id text primary key,
  reference text not null unique check (reference ~ '^FAS-[0-9]{4}-[0-9]{3,}$'),
  date date not null,
  beneficiaire text not null check (length(trim(beneficiaire)) > 0),
  telephone text,
  adresse text,
  reference_externe text,
  remarque text not null default '',
  lignes jsonb not null check (jsonb_typeof(lignes) = 'array' and jsonb_array_length(lignes) > 0),
  montant numeric not null default 0 check (montant >= 0),
  moyen text,
  reference_bancaire_paiement text,
  date_paiement date,
  ajoutee_par text not null default '',
  statut text not null check (statut in ('actif', 'annule'))
);
comment on table public.factures_autres_services is 'Factures de services (hors scolarité) à un bénéficiaire libre, et leur règlement.';

create table public.devis (
  id text primary key,
  reference text not null unique check (reference ~ '^DEV-[0-9]{4}-[0-9]{3,}$'),
  date date not null,
  filiere_id text references public.filieres (id) on delete restrict,
  filiere_label text not null default '',
  niveau text not null default '',
  niveau_label text not null default '',
  annee text not null default '',
  modele_frais_id text,
  modele_frais_label text not null default '',
  beneficiaire text not null check (length(trim(beneficiaire)) > 0),
  telephone text not null default '',
  email text,
  adresse text,
  taux_taxe numeric not null default 0 check (taux_taxe >= 0),
  lignes jsonb not null default '[]' check (jsonb_typeof(lignes) = 'array'),
  total_ht numeric not null default 0,
  total_taxe numeric not null default 0,
  total_ttc numeric not null default 0,
  ajoutee_par text not null default '',
  annule boolean not null default false,
  converti_etudiant_id text references public.etudiants (id) on delete restrict,
  constraint devis_annule_ou_converti check (not (annule and converti_etudiant_id is not null))
);
comment on table public.devis is 'Devis d''inscription remis à un futur étudiant, convertibles en inscription.';
create index devis_filiere_id_idx on public.devis (filiere_id);
create index devis_converti_etudiant_id_idx on public.devis (converti_etudiant_id);

create table public.emissions_masse (
  id text primary key,
  reference text not null unique check (reference ~ '^EM-[0-9]{4}-[0-9]{3,}$'),
  filiere_id text references public.filieres (id) on delete restrict,
  filiere text not null default '',
  annee text not null default '',
  niveau_id text references public.niveaux (id) on delete restrict,
  niveau text not null default '',
  classe_id text references public.classes (id) on delete restrict,
  classe text not null default '',
  modele_frais_id text,
  ligne_intitules text[] not null default '{}',
  date_facturation date not null,
  commentaire text not null default '',
  emis_le date not null default current_date,
  emis_par text not null default '',
  quittance_ids text[] not null default '{}',
  annulee boolean not null default false
);
comment on table public.emissions_masse is 'Quittances émises en une fois pour toute une classe.';
create index emissions_masse_filiere_id_idx on public.emissions_masse (filiere_id);
create index emissions_masse_niveau_id_idx on public.emissions_masse (niveau_id);
create index emissions_masse_classe_id_idx on public.emissions_masse (classe_id);

-- ——— 3. Numéros ————————————————————————————————————————————————————————————————————————————

create trigger prises_en_charge_a_numero before insert on public.prises_en_charge
  for each row execute function private.numeroter_piece('reference', 'PEC', 'annee');
create trigger encaissements_pec_a_numero before insert on public.encaissements_pec
  for each row execute function private.numeroter_piece('reference', 'ENC-PEC', 'date');
create trigger pec_masse_a_numero before insert on public.pec_masse
  for each row execute function private.numeroter_piece('reference', 'PECM', 'annee');
create trigger reglements_masse_a_numero before insert on public.reglements_masse
  for each row execute function private.numeroter_piece('reference', 'REGM', 'annee');
create trigger factures_autres_services_a_numero before insert on public.factures_autres_services
  for each row execute function private.numeroter_piece('reference', 'FAS', 'date');
create trigger devis_a_numero before insert on public.devis
  for each row execute function private.numeroter_piece('reference', 'DEV', 'date');
create trigger emissions_masse_a_numero before insert on public.emissions_masse
  for each row execute function private.numeroter_piece('reference', 'EM', 'annee');

-- La prise en charge numérotée : ses quittances, réglées « par » son numéro provisoire, reprennent
-- le définitif.
create function private.reporter_numero_pec()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_provisoire text := coalesce(current_setting('edumanage.numero_provisoire', true), '');
begin
  if v_provisoire <> '' then
    update public.quittances q set reference = new.reference
      where q.id in (select l ->> 'quittanceId' from jsonb_array_elements(new.lignes) l) and q.reference = v_provisoire;
  end if;
  return new;
end;
$$;
revoke execute on function private.reporter_numero_pec() from public, anon, authenticated;
create trigger prises_en_charge_b_quittances before insert on public.prises_en_charge
  for each row execute function private.reporter_numero_pec();

-- Le lot numéroté : ses prises en charge (« Lot PECM-… ») reprennent le numéro définitif.
create function private.reporter_numero_lot_pec()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_provisoire text := coalesce(current_setting('edumanage.numero_provisoire', true), '');
begin
  if v_provisoire <> '' then
    update public.prises_en_charge p set reference_externe = 'Lot ' || new.reference
      where p.id = any (new.prise_en_charge_ids) and p.reference_externe = 'Lot ' || v_provisoire;
  end if;
  return new;
end;
$$;
revoke execute on function private.reporter_numero_lot_pec() from public, anon, authenticated;
create trigger pec_masse_b_lot before insert on public.pec_masse
  for each row execute function private.reporter_numero_lot_pec();

-- L'émission numérotée : ses quittances (référence « EM-… » ou « EM-…-ligne-échéance ») reprennent
-- le numéro définitif.
create function private.reporter_numero_emission()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_provisoire text := coalesce(current_setting('edumanage.numero_provisoire', true), '');
begin
  if v_provisoire <> '' then
    update public.quittances q set reference = new.reference || substr(q.reference, length(v_provisoire) + 1)
      where q.id = any (new.quittance_ids)
        and (q.reference = v_provisoire or left(q.reference, length(v_provisoire) + 1) = v_provisoire || '-');
  end if;
  return new;
end;
$$;
revoke execute on function private.reporter_numero_emission() from public, anon, authenticated;
create trigger emissions_masse_b_quittances before insert on public.emissions_masse
  for each row execute function private.reporter_numero_emission();

-- ——— 4. Contrôles ——————————————————————————————————————————————————————————————————————————

-- Versé par un organisme sur une prise en charge : ses encaissements et règlements en masse non
-- annulés.
create function private.encaisse_pec(p_pec text)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce((select sum((l ->> 'montant')::numeric) from public.encaissements_pec e, jsonb_array_elements(e.lignes) l
                   where not e.annulee and l ->> 'priseEnChargeId' = p_pec), 0)
       + coalesce((select sum((l ->> 'montant')::numeric) from public.reglements_masse r, jsonb_array_elements(r.lignes) l
                   where not r.annulee and l ->> 'priseEnChargeId' = p_pec), 0)
$$;
revoke execute on function private.encaisse_pec(text) from public, anon, authenticated;

-- Une prise en charge garde son numéro, son étudiant, son organisme et son type ; tant qu'elle
-- n'est pas annulée, sa période et ses frais couverts changent (prolongation, frais retiré).
-- Annulée, elle le reste. Le versé est recalculé.
create function private.controler_prise_en_charge()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.annulee and not new.annulee then
      raise exception 'La prise en charge % est annulée : elle le reste.', old.reference using errcode = 'check_violation';
    end if;
    if old.annulee then
      new := old;
    end if;
    new.reference := old.reference;
    new.etudiant_id := old.etudiant_id;
    new.organisme_id := old.organisme_id;
    new.type := old.type;
    new.date_saisie := old.date_saisie;
  end if;
  new.montant_encaisse := private.encaisse_pec(new.id);
  return new;
end;
$$;
revoke execute on function private.controler_prise_en_charge() from public, anon, authenticated;
create trigger prises_en_charge_controle before insert or update on public.prises_en_charge
  for each row execute function private.controler_prise_en_charge();

-- Encaissement d'un organisme ou règlement en masse : seule son annulation se note ; le versé des
-- prises en charge concernées est recalculé.
create trigger encaissements_pec_controle before update on public.encaissements_pec
  for each row execute function private.garder_piece_annulable();
create trigger reglements_masse_controle before update on public.reglements_masse
  for each row execute function private.garder_piece_annulable();
create trigger pec_masse_controle before update on public.pec_masse
  for each row execute function private.garder_piece_annulable();
create trigger emissions_masse_controle before update on public.emissions_masse
  for each row execute function private.garder_piece_annulable();

create function private.recalculer_encaisse_pec()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.prises_en_charge p set montant_encaisse = 0
    where p.id in (select l ->> 'priseEnChargeId' from jsonb_array_elements(new.lignes) l);
  return null;
end;
$$;
revoke execute on function private.recalculer_encaisse_pec() from public, anon, authenticated;
create trigger encaissements_pec_versement after insert or update on public.encaissements_pec
  for each row execute function private.recalculer_encaisse_pec();
create trigger reglements_masse_versement after insert or update on public.reglements_masse
  for each row execute function private.recalculer_encaisse_pec();

-- Paiement déclaré par l'étudiant : sur une de ses quittances non annulées, jamais au-delà du reste
-- à payer moins ce qui attend déjà d'être vérifié (deux déclarations simultanées passent l'une
-- après l'autre). Ensuite, seule la caisse le confirme ou le rejette, une fois.
create function private.controler_paiement_declare()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_quittance public.quittances;
  v_attente numeric;
  v_disponible numeric;
  v_statut text;
  v_motif text;
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.paiements_declares d where d.id = new.id) then
      return new;
    end if;
    select * into v_quittance from public.quittances q where q.id = new.quittance_id for no key update;
    if v_quittance.etudiant_id is distinct from new.etudiant_id or v_quittance.statut = 'annule' then
      raise exception 'Facture introuvable.' using errcode = 'check_violation';
    end if;
    select coalesce(sum(d.montant), 0) into v_attente from public.paiements_declares d
      where d.quittance_id = new.quittance_id and d.statut = 'a_verifier';
    v_disponible := private.total_lignes(v_quittance.lignes) - v_quittance.montant - v_attente;
    if new.montant > v_disponible then
      raise exception 'Montant invalide : au plus % F CFA peuvent encore être déclarés sur cette facture.', private.montant_fr(greatest(v_disponible, 0))
        using errcode = 'check_violation';
    end if;
    new.quittance_reference := v_quittance.numero_recu;
    new.rubrique := v_quittance.rubrique;
    new.statut := 'a_verifier';
    new.declare_le := now();
    new.traite_le := null;
    new.traite_par := null;
    new.motif_rejet := null;
    return new;
  end if;
  v_statut := new.statut;
  v_motif := new.motif_rejet;
  if old.statut <> 'a_verifier' then
    if v_statut <> old.statut then
      raise exception 'Ce paiement n''est plus à vérifier.' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if v_statut = 'rejete' and length(trim(coalesce(v_motif, ''))) = 0 then
    raise exception 'Indiquez le motif du rejet.' using errcode = 'check_violation';
  end if;
  new := old;
  if v_statut <> 'a_verifier' then
    new.statut := v_statut;
    new.motif_rejet := case when v_statut = 'rejete' then trim(v_motif) end;
    new.traite_le := now();
    new.traite_par := coalesce((select c.nom_affiche from public.comptes c where c.id = (select auth.uid())), '');
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_paiement_declare() from public, anon, authenticated;
create trigger paiements_declares_controle before insert or update on public.paiements_declares
  for each row execute function private.controler_paiement_declare();

-- La caisse est prévenue d'un paiement à vérifier ; l'étudiant, de la décision.
create function private.suivre_paiement_declare()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_compte uuid;
begin
  if tg_op = 'INSERT' then
    for v_compte in
      select c.id from public.comptes c
      where c.type_compte = 'administration' and c.actif and private.acces_page_de(c.id, 'fin-enc-declares')
    loop
      perform private.envoyer_notification(v_compte, format('Paiement en ligne à vérifier : %s — %s F CFA (%s, réf. %s).',
        new.etudiant_label, private.montant_fr(new.montant), new.moyen, new.reference_transaction));
    end loop;
  elsif new.statut <> old.statut then
    for v_compte in
      select c.id from public.comptes c where c.type_compte = 'etudiant' and c.actif and c.lien_id = new.etudiant_id
    loop
      perform private.envoyer_notification(v_compte, case new.statut
        when 'confirme' then format('Votre paiement de %s F CFA (%s) a été vérifié et enregistré.', private.montant_fr(new.montant), new.moyen)
        else format('Votre paiement déclaré de %s F CFA n''a pas pu être vérifié : %s. Contactez la caisse.', private.montant_fr(new.montant), new.motif_rejet)
      end);
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function private.suivre_paiement_declare() from public, anon, authenticated;
create trigger paiements_declares_suivi after insert or update on public.paiements_declares
  for each row execute function private.suivre_paiement_declare();

-- Facture d'un autre service : ses lignes ne changent plus, son règlement ne dépasse pas le
-- facturé ; annulée, elle le reste.
create function private.controler_facture_autre_service()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.statut = 'annule' and new.statut <> 'annule' then
      raise exception 'La facture % est annulée : elle le reste.', old.reference using errcode = 'check_violation';
    end if;
    new.reference := old.reference;
    new.lignes := old.lignes;
    new.beneficiaire := old.beneficiaire;
    new.date := old.date;
  end if;
  if new.montant > (select coalesce(sum((l ->> 'montant')::numeric), 0) from jsonb_array_elements(new.lignes) l) then
    raise exception 'Le règlement dépasse le montant facturé.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.controler_facture_autre_service() from public, anon, authenticated;
create trigger factures_autres_services_controle before insert or update on public.factures_autres_services
  for each row execute function private.controler_facture_autre_service();

-- Devis : ses lignes et ses montants ne changent plus ; il est annulé ou converti, une fois.
create function private.controler_devis()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_annule boolean := new.annule;
  v_converti text := new.converti_etudiant_id;
begin
  if old.annule and not v_annule then
    raise exception 'Le devis % est annulé : il le reste.', old.reference using errcode = 'check_violation';
  end if;
  if old.converti_etudiant_id is not null and v_converti is distinct from old.converti_etudiant_id then
    raise exception 'Le devis % a déjà été converti en inscription.', old.reference using errcode = 'check_violation';
  end if;
  new := old;
  new.annule := v_annule;
  new.converti_etudiant_id := v_converti;
  return new;
end;
$$;
revoke execute on function private.controler_devis() from public, anon, authenticated;
create trigger devis_controle before update on public.devis
  for each row execute function private.controler_devis();

-- ——— 5. Journal, compteurs de changements et droits ————————————————————————————————————————

do $$
declare
  v_table text;
begin
  foreach v_table in array array['organismes_pec', 'prises_en_charge', 'encaissements_pec', 'pec_masse', 'reglements_masse', 'paiements_declares',
    'factures_autres_services', 'devis', 'emissions_masse']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.journaliser_modification()',
      v_table || '_journal', v_table);
    perform private.suivre_table(v_table);
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end
$$;

grant select, insert, update, delete on public.organismes_pec to authenticated, service_role;
grant select, insert, update on public.prises_en_charge, public.encaissements_pec, public.pec_masse, public.reglements_masse, public.paiements_declares,
  public.factures_autres_services, public.devis, public.emissions_masse to authenticated, service_role;

-- Organismes : lus par l'administration, gérés par la page « Organisme de PEC ».
create policy organismes_pec_lecture on public.organismes_pec for select to authenticated using ((select private.est_administration()));
create policy organismes_pec_creation on public.organismes_pec for insert to authenticated with check ((select private.a_acces_page('fin-pec-organisme')));
create policy organismes_pec_modification on public.organismes_pec for update to authenticated
  using ((select private.a_acces_page('fin-pec-organisme'))) with check ((select private.a_acces_page('fin-pec-organisme')));
create policy organismes_pec_suppression on public.organismes_pec for delete to authenticated using ((select private.a_acces_page('fin-pec-organisme')));

-- Prises en charge : lues par l'administration et l'étudiant concerné ; écrites par les pages des
-- prises en charge et de leurs encaissements.
create policy prises_en_charge_lecture on public.prises_en_charge for select to authenticated
  using ((select private.est_administration()) or etudiant_id = (select private.etudiant_courant()));
create policy prises_en_charge_creation on public.prises_en_charge for insert to authenticated with check ((select private.gere_prises_en_charge()));
create policy prises_en_charge_modification on public.prises_en_charge for update to authenticated
  using ((select private.gere_prises_en_charge())) with check ((select private.gere_prises_en_charge()));

-- Paiements déclarés : l'étudiant déclare les siens et les lit ; la caisse les lit et les traite.
create policy paiements_declares_lecture on public.paiements_declares for select to authenticated
  using ((select private.est_administration()) or etudiant_id = (select private.etudiant_courant()));
create policy paiements_declares_declaration on public.paiements_declares for insert to authenticated
  with check (etudiant_id = (select private.etudiant_courant()));
create policy paiements_declares_traitement on public.paiements_declares for update to authenticated
  using ((select private.a_acces_page('fin-enc-declares'))) with check ((select private.a_acces_page('fin-enc-declares')));

do $$
declare
  v_regle record;
begin
  for v_regle in
    select * from (values
      ('encaissements_pec', array['fin-enc-pec', 'fin-enc-pec-masse', 'fin-enc-pec-liste', 'fin-enc-pec-masse2', 'fin-pec-liste']),
      ('pec_masse', array['fin-enc-pec-masse2', 'fin-pec-liste']),
      ('reglements_masse', array['fin-enc-pec-masse', 'fin-enc-pec-liste', 'fin-enc-pec-masse2']),
      ('factures_autres_services', array['fin-enc-facture']),
      ('devis', array['fin-devis-nouveau', 'fin-devis-liste']),
      ('emissions_masse', array['fin-quittance-masse'])
    ) as r(nom, pages)
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.est_administration()))', v_regle.nom || '_lecture', v_regle.nom);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.a_acces_une_page(%L)))',
      v_regle.nom || '_creation', v_regle.nom, v_regle.pages);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.a_acces_une_page(%L))) '
      'with check ((select private.a_acces_une_page(%L)))', v_regle.nom || '_modification', v_regle.nom, v_regle.pages, v_regle.pages);
  end loop;
end
$$;
