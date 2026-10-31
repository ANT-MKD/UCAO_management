-- Finances (partie 7 du plan de migration, lot 1) : quittances, encaissements, frais des
-- étudiants et soldes.
--
-- Numéros : chaque pièce (quittance RECU-2026-001, encaissement OP-2026-001…) reçoit son numéro de
-- la base à l'enregistrement, dans la même transaction : deux caissières qui encaissent en même
-- temps n'obtiennent jamais le même numéro, et la suite reste sans trou. Le numéro saisi par le
-- poste n'est que provisoire ; il revient à l'écran juste après.
--
-- Soldes : le solde dû et l'avoir d'un étudiant, et ce qui est réglé sur chaque quittance, ne
-- s'écrivent jamais directement. Chaque poste envoie le mouvement (« −40 000 sur le solde de
-- Awa, +40 000 réglés sur sa quittance ») et la base l'additionne : deux postes qui touchent au
-- même solde en même temps ne s'écrasent jamais. La base refuse un avoir dépensé deux fois et un
-- versement qui dépasse le reste à payer d'une quittance.

-- ——— 1. Numérotation des pièces ————————————————————————————————————————————————————————————

-- Déclencheur générique : numérote la colonne tg_argv[0] avec le préfixe tg_argv[1] et l'année de
-- la colonne tg_argv[2] (une date, ou une année « 2026-2027 ») ; la colonne tg_argv[3], quand
-- elle reprenait le numéro provisoire, reprend le définitif. Une ligne déjà enregistrée (renvoyée
-- par un poste) garde son numéro, sans consommer de numéro.
create function private.numeroter_piece()
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
  return new;
end;
$$;
revoke execute on function private.numeroter_piece() from public, anon, authenticated;

-- Pages qui écrivent les finances des étudiants : le module Finances, et l'inscription et la
-- réinscription, qui émettent la facture d'inscription.
create function private.ecrit_finances()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.a_acces_une_page(array['fin-quittance-nouvelle', 'fin-quittance-liste', 'fin-quittance-masse',
    'fin-enc-pec', 'fin-enc-pec-masse', 'fin-enc-pec-liste', 'fin-enc-pec-masse2', 'fin-enc-liste', 'fin-enc-declares', 'fin-enc-facture',
    'fin-avoir-depot', 'fin-avoir-remboursement', 'fin-avoir-remboursements', 'fin-avoir-consentement',
    'fin-devis-nouveau', 'fin-devis-liste', 'fin-reduction-frais', 'fin-maj-ajouter', 'fin-maj-supprimer', 'fin-maj-ajouter-masse',
    'fin-maj-suppression', 'fin-maj-liste', 'fin-reprise-nouvelle', 'fin-reprise-liste', 'fin-rappel', 'fin-pec-liste', 'fin-derogation',
    'etudiants-ajouter', 'etudiants-liste', 'etudiants-reinscrire'])
$$;
revoke execute on function private.ecrit_finances() from public, anon;
grant execute on function private.ecrit_finances() to authenticated, service_role;

-- Total facturé par une quittance (somme de ses rubriques).
create function private.total_lignes(p_lignes jsonb)
returns numeric
language sql immutable set search_path = ''
as $$
  select coalesce(sum((l ->> 'montant')::numeric), 0) from jsonb_array_elements(p_lignes) l
$$;
revoke execute on function private.total_lignes(jsonb) from public, anon, authenticated;

-- ——— 2. Tables ———————————————————————————————————————————————————————————————————————————

-- Quittance : la facture d'un étudiant (une ou plusieurs rubriques) et ce qui y est réglé.
create table public.quittances (
  id text primary key,
  numero_recu text not null unique check (numero_recu ~ '^RECU-[0-9]{4}-[0-9]{3,}$'),
  date date not null,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  etudiant text not null default '',
  classe text not null default '',
  rubrique text not null default '',
  lignes jsonb not null check (jsonb_typeof(lignes) = 'array' and jsonb_array_length(lignes) > 0),
  -- Montant réglé à ce jour : tenu par la base à partir des mouvements, jamais écrit par un poste.
  montant numeric not null default 0 check (montant >= 0),
  moyen text not null default '',
  reference text not null default '',
  solde_restant numeric not null default 0,
  statut text not null check (statut in ('paye', 'annule')),
  date_limite date,
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid()
);
comment on table public.quittances is 'Quittances (factures) des étudiants, numérotées par la base ; le montant réglé est tenu par les mouvements.';
create index quittances_etudiant_id_idx on public.quittances (etudiant_id);

-- Encaissement : un versement réellement reçu sur une quittance, avec son propre reçu.
create table public.encaissements (
  id text primary key,
  reference text not null unique check (reference ~ '^OP-[0-9]{4}-[0-9]{3,}$'),
  date date not null,
  quittance_id text not null references public.quittances (id) on delete restrict,
  quittance_reference text not null default '',
  quittance_date_emission date,
  quittance_date_limite date,
  montant_quittance_total numeric not null default 0,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  payeur text not null default '',
  filiere text not null default '',
  annee text not null default '',
  montant numeric not null check (montant > 0),
  moyen text not null default '',
  reference_bancaire text,
  encaisse_par text not null default '',
  annulee boolean not null default false,
  lignes jsonb not null default '[]' check (jsonb_typeof(lignes) = 'array'),
  cree_le timestamptz not null default now(),
  cree_par uuid default auth.uid()
);
comment on table public.encaissements is 'Versements encaissés sur les quittances, numérotés par la base ; seule leur annulation se note ensuite.';
create index encaissements_quittance_id_idx on public.encaissements (quittance_id);
create index encaissements_etudiant_id_idx on public.encaissements (etudiant_id);

-- Frais ajoutés à un étudiant (hors inscription), quittancés aussitôt ou plus tard.
create table public.frais_etudiants (
  id text primary key,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  annee text not null references public.annees_academiques (libelle) on update cascade on delete restrict,
  type_frais_id text not null references public.types_frais (id) on delete restrict,
  montant numeric not null check (montant >= 0),
  date_limite date,
  obligatoire boolean not null default false,
  echeance boolean not null default false,
  nb_echeances integer check (nb_echeances is null or nb_echeances > 0),
  ajoute_le date not null default current_date,
  quittance_id text references public.quittances (id) on delete restrict,
  quittance_date date,
  annulee boolean not null default false,
  motif_annulation text
);
comment on table public.frais_etudiants is 'Frais ajoutés à un étudiant : jamais effacés, annulés avec leur motif.';
create index frais_etudiants_etudiant_id_idx on public.frais_etudiants (etudiant_id);
create index frais_etudiants_annee_idx on public.frais_etudiants (annee);
create index frais_etudiants_type_frais_id_idx on public.frais_etudiants (type_frais_id);
create index frais_etudiants_quittance_id_idx on public.frais_etudiants (quittance_id);

-- Solde dû et avoir de chaque étudiant : écrits par la base seule, à partir des mouvements.
create table public.soldes_etudiants (
  id text primary key references public.etudiants (id) on delete cascade,
  solde_du numeric not null default 0 check (solde_du >= 0),
  solde_avoir numeric not null default 0 check (solde_avoir >= 0),
  modifie_le timestamptz not null default now()
);
comment on table public.soldes_etudiants is 'Solde dû et avoir de chaque étudiant, tenus par la base à partir des mouvements.';

-- Mouvement : ce qu'une opération change au solde dû, à l'avoir d'un étudiant et au montant réglé
-- d'une de ses quittances. Ajouté une fois, jamais modifié ni supprimé.
create table public.mouvements_solde (
  id text primary key,
  etudiant_id text not null references public.etudiants (id) on delete restrict,
  quittance_id text references public.quittances (id) on delete restrict,
  delta_du numeric not null default 0,
  delta_avoir numeric not null default 0,
  delta_paye numeric not null default 0,
  motif text not null default '',
  cree_le timestamptz not null default now(),
  cree_par uuid,
  constraint mouvements_solde_utile check (delta_du <> 0 or delta_avoir <> 0 or delta_paye <> 0),
  constraint mouvements_solde_quittance check (delta_paye = 0 or quittance_id is not null)
);
comment on table public.mouvements_solde is 'Mouvements des soldes et des montants réglés : la base les additionne, deux postes ne s''écrasent jamais.';
create index mouvements_solde_etudiant_id_idx on public.mouvements_solde (etudiant_id);
create index mouvements_solde_quittance_id_idx on public.mouvements_solde (quittance_id);

-- ——— 3. Contrôles ——————————————————————————————————————————————————————————————————————————

create trigger quittances_a_numero before insert on public.quittances
  for each row execute function private.numeroter_piece('numero_recu', 'RECU', 'date', 'reference');
create trigger encaissements_a_numero before insert on public.encaissements
  for each row execute function private.numeroter_piece('reference', 'OP', 'date');

-- Une quittance garde ses rubriques, son étudiant et son numéro ; le montant réglé ne change que
-- par un mouvement ; une quittance annulée le reste.
create function private.controler_quittance()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Le montant réglé arrive par le mouvement qui accompagne la quittance.
    new.montant := 0;
    if exists (select 1 from jsonb_array_elements(new.lignes) l where jsonb_typeof(l -> 'montant') <> 'number' or (l ->> 'montant')::numeric < 0) then
      raise exception 'Chaque rubrique de la quittance doit avoir un montant positif.' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if old.statut = 'annule' and new.statut <> 'annule' then
    raise exception 'La quittance % est annulée : elle le reste.', old.numero_recu using errcode = 'check_violation';
  end if;
  if coalesce(current_setting('edumanage.mouvement', true), '') <> 'on' then
    new.montant := old.montant;
  end if;
  -- Un poste qui n'a pas encore relu le numéro définitif renvoie le provisoire : il est ignoré.
  if new.numero_recu is distinct from old.numero_recu and new.reference = new.numero_recu then
    new.reference := old.reference;
  end if;
  new.numero_recu := old.numero_recu;
  new.etudiant_id := old.etudiant_id;
  new.lignes := old.lignes;
  new.cree_le := old.cree_le;
  new.cree_par := old.cree_par;
  return new;
end;
$$;
revoke execute on function private.controler_quittance() from public, anon, authenticated;
create trigger quittances_controle before insert or update on public.quittances
  for each row execute function private.controler_quittance();

-- Un encaissement reprend le numéro définitif de sa quittance ; ensuite, seule son annulation se
-- note (définitive), le reste ne change plus.
create function private.controler_encaissement()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_annulee boolean;
begin
  if tg_op = 'INSERT' then
    select q.numero_recu into new.quittance_reference from public.quittances q where q.id = new.quittance_id;
    if not exists (select 1 from public.quittances q where q.id = new.quittance_id and q.etudiant_id = new.etudiant_id) then
      raise exception 'Cet encaissement ne correspond pas à une quittance de cet étudiant.' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if old.annulee and not new.annulee then
    raise exception 'L''encaissement % est annulé : il le reste.', old.reference using errcode = 'check_violation';
  end if;
  v_annulee := new.annulee;
  new := old;
  new.annulee := v_annulee;
  return new;
end;
$$;
revoke execute on function private.controler_encaissement() from public, anon, authenticated;
create trigger encaissements_controle before insert or update on public.encaissements
  for each row execute function private.controler_encaissement();

-- Un frais annulé le reste, et une fois quittancé il garde sa quittance.
create function private.controler_frais_etudiant()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.annulee and not new.annulee then
    raise exception 'Ce frais est annulé : il le reste.' using errcode = 'check_violation';
  end if;
  if old.quittance_id is not null and new.quittance_id is distinct from old.quittance_id then
    raise exception 'Ce frais est déjà quittancé.' using errcode = 'check_violation';
  end if;
  new.etudiant_id := old.etudiant_id;
  new.annee := old.annee;
  new.type_frais_id := old.type_frais_id;
  new.montant := old.montant;
  return new;
end;
$$;
revoke execute on function private.controler_frais_etudiant() from public, anon, authenticated;
create trigger frais_etudiants_controle before update on public.frais_etudiants
  for each row execute function private.controler_frais_etudiant();

-- Le mouvement est attribué à son auteur.
create function private.dater_mouvement()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.cree_par := (select auth.uid());
  new.cree_le := now();
  return new;
end;
$$;
revoke execute on function private.dater_mouvement() from public, anon, authenticated;
create trigger mouvements_solde_auteur before insert on public.mouvements_solde
  for each row execute function private.dater_mouvement();

-- La base applique le mouvement : montant réglé de la quittance (jamais au-delà du facturé, jamais
-- sur une quittance annulée), solde dû (jamais négatif) et avoir (jamais dépensé deux fois).
-- L'étudiant est prévenu de chaque versement.
create function private.appliquer_mouvement()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_quittance public.quittances;
  v_total numeric;
  v_regle numeric;
  v_avoir numeric;
  v_compte uuid;
begin
  if new.delta_paye <> 0 then
    -- « no key update » : compatible avec le verrou que prend le contrôle du lien vers la quittance
    -- (un « for update » interbloquerait deux caisses qui encaissent la même quittance).
    select * into v_quittance from public.quittances q where q.id = new.quittance_id for no key update;
    if v_quittance.etudiant_id is distinct from new.etudiant_id then
      raise exception 'Ce mouvement ne correspond pas à une quittance de cet étudiant.' using errcode = 'check_violation';
    end if;
    if v_quittance.statut = 'annule' and new.delta_paye > 0 then
      raise exception 'La quittance % est annulée : elle ne reçoit plus de règlement.', v_quittance.numero_recu using errcode = 'check_violation';
    end if;
    v_total := private.total_lignes(v_quittance.lignes);
    v_regle := v_quittance.montant + new.delta_paye;
    if v_regle > v_total then
      raise exception 'La quittance % est déjà réglée à hauteur de % F : ce versement dépasse le reste à payer (% F).',
        v_quittance.numero_recu, private.montant_fr(v_quittance.montant), private.montant_fr(v_total - v_quittance.montant)
        using errcode = 'check_violation';
    end if;
    if v_regle < 0 then
      raise exception 'La quittance % n''a pas autant de règlement à retirer.', v_quittance.numero_recu using errcode = 'check_violation';
    end if;
    perform set_config('edumanage.mouvement', 'on', true);
    update public.quittances q set montant = v_regle where q.id = v_quittance.id;
    perform set_config('edumanage.mouvement', '', true);
    if new.delta_paye > 0 and coalesce((select n.actif and n.envoyer_etudiant from public.notifications_evenementielles n
                                         where n.code = 'NOTIFICATION_ENCAISSEMENT'), true) then
      for v_compte in
        select c.id from public.comptes c where c.type_compte = 'etudiant' and c.actif and c.lien_id = new.etudiant_id
      loop
        perform private.envoyer_notification(v_compte, case
          when v_quittance.montant = 0 then format('Paiement validé — reçu %s (%s FCFA)', v_quittance.numero_recu, private.montant_fr(new.delta_paye))
          else format('Paiement validé — reçu %s : %s F CFA réglés à ce jour sur cette facture', v_quittance.numero_recu, private.montant_fr(v_regle))
        end);
      end loop;
    end if;
  end if;
  if new.delta_du <> 0 or new.delta_avoir <> 0 then
    insert into public.soldes_etudiants (id) values (new.etudiant_id) on conflict (id) do nothing;
    select s.solde_avoir + new.delta_avoir into v_avoir from public.soldes_etudiants s where s.id = new.etudiant_id for update;
    if v_avoir < 0 then
      raise exception 'Avoir insuffisant : il a déjà été utilisé (il reste % F).', private.montant_fr(v_avoir - new.delta_avoir)
        using errcode = 'check_violation';
    end if;
    update public.soldes_etudiants s
      set solde_du = greatest(0, s.solde_du + new.delta_du), solde_avoir = v_avoir, modifie_le = now()
      where s.id = new.etudiant_id;
  end if;
  return null;
end;
$$;
revoke execute on function private.appliquer_mouvement() from public, anon, authenticated;
create trigger mouvements_solde_application after insert on public.mouvements_solde
  for each row execute function private.appliquer_mouvement();

-- ——— 4. Journal, compteurs de changements et droits ————————————————————————————————————————

create trigger quittances_journal after insert or update or delete on public.quittances
  for each row execute function private.journaliser_modification();
create trigger encaissements_journal after insert or update or delete on public.encaissements
  for each row execute function private.journaliser_modification();
create trigger frais_etudiants_journal after insert or update or delete on public.frais_etudiants
  for each row execute function private.journaliser_modification();
select private.suivre_table('quittances');
select private.suivre_table('encaissements');
select private.suivre_table('frais_etudiants');
select private.suivre_table('soldes_etudiants');
select private.suivre_table('mouvements_solde');

-- Lus par l'administration et par l'étudiant concerné (jamais par les professeurs) ; écrits par
-- les pages Finances, l'inscription et la réinscription ; jamais supprimés.
alter table public.quittances enable row level security;
alter table public.encaissements enable row level security;
alter table public.frais_etudiants enable row level security;
alter table public.soldes_etudiants enable row level security;
alter table public.mouvements_solde enable row level security;

grant select, insert, update on public.quittances, public.encaissements, public.frais_etudiants to authenticated, service_role;
grant select on public.soldes_etudiants to authenticated, service_role;
grant select, insert on public.mouvements_solde to authenticated, service_role;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['quittances', 'encaissements', 'frais_etudiants'] loop
    execute format('create policy %I on public.%I for select to authenticated using '
      '((select private.est_administration()) or etudiant_id = (select private.etudiant_courant()))', v_table || '_lecture', v_table);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.ecrit_finances()))',
      v_table || '_creation', v_table);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.ecrit_finances())) '
      'with check ((select private.ecrit_finances()))', v_table || '_modification', v_table);
  end loop;
end
$$;
create policy soldes_etudiants_lecture on public.soldes_etudiants for select to authenticated
  using ((select private.est_administration()) or id = (select private.etudiant_courant()));
create policy mouvements_solde_lecture on public.mouvements_solde for select to authenticated
  using ((select private.est_administration()));
create policy mouvements_solde_creation on public.mouvements_solde for insert to authenticated
  with check ((select private.ecrit_finances()));
