-- Partie 10, lot 4 : e-mails par Resend.
-- • File d'envoi (private.courriels) : chaque mail qui part (validé, ou envoyé par le système,
--   comme les relances de paiement) y dépose une ligne par adresse e-mail ; la messagerie interne
--   ne change pas. La fonction serveur « courriels » vide la file par l'API Resend (clé dans les
--   secrets du serveur, jamais dans la base ni dans l'application) et y note le résultat.
-- • Alertes du service (sauvegarde en retard, espace presque plein) : préparées par la visite
--   quotidienne, au plus une de chaque sorte tous les 3 jours, envoyées à l'adresse des alertes
--   réglée dans les secrets du serveur.
-- • public.livraison_courriels() : suivi des e-mails de chaque mail, pour l'administration.

create table private.courriels (
  id bigint generated always as identity primary key,
  nature text not null check (nature in ('mail', 'alerte')),
  mail_id text references public.mails_envoyes (id) on delete cascade,
  -- Adresse du destinataire ; vide pour une alerte (adresse des alertes, dans les secrets).
  destinataire text check (destinataire is null or length(destinataire) <= 254),
  cle_alerte text,
  objet text not null check (length(objet) between 1 and 300),
  texte text not null check (length(texte) <= 60000),
  cree_le timestamptz not null default now(),
  etat text not null default 'en_attente' check (etat in ('en_attente', 'envoye', 'refuse', 'ignore')),
  tentatives integer not null default 0,
  prochain_essai timestamptz not null default now(),
  traite_le timestamptz,
  resend_id text,
  motif text,
  check ((nature = 'mail') = (mail_id is not null and destinataire is not null)),
  check ((nature = 'alerte') = (cle_alerte is not null))
);
create index courriels_file_idx on private.courriels (prochain_essai, id) where etat = 'en_attente';
create index courriels_mail_idx on private.courriels (mail_id);
create index courriels_alerte_idx on private.courriels (cle_alerte, cree_le) where nature = 'alerte';
alter table private.courriels enable row level security;
revoke all on private.courriels from public, anon, authenticated;

-- Départ d'un mail : une ligne par adresse valable (destinataires et adresses ajoutées), sans
-- doublon ; les adresses techniques de connexion (….invalid) ne reçoivent jamais rien.
create function private.mettre_en_file_courriels()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.statut = 'traite' and (tg_op = 'INSERT' or old.statut is distinct from 'traite') then
    insert into private.courriels (nature, mail_id, destinataire, objet, texte)
    select 'mail', new.id, a.adresse, left(new.objet, 300),
           left(new.message || case when cardinality(new.fichiers) > 0
             then E'\n\nPièces jointes, à consulter dans votre espace EduManage : ' || array_to_string(new.fichiers, ', ') else '' end, 60000)
    from (
      select distinct lower(trim(x)) as adresse
      from (
        select d ->> 'email' as x from jsonb_array_elements(new.destinataires) d
        union all
        select unnest(new.emails_supplementaires)
      ) s
      where x is not null
    ) a
    where a.adresse ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      and a.adresse not like '%.invalid'
      and length(a.adresse) <= 254
    order by a.adresse
    limit 5000;
  end if;
  return null;
end;
$$;
revoke execute on function private.mettre_en_file_courriels() from public, anon, authenticated;
create trigger mails_envoyes_courriels after insert or update of statut on public.mails_envoyes
  for each row execute function private.mettre_en_file_courriels();

-- Alerte du service : au plus une de chaque sorte tous les 3 jours.
create function private.alerter(p_cle text, p_objet text, p_texte text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not exists (select 1 from private.courriels c
                 where c.nature = 'alerte' and c.cle_alerte = p_cle and c.cree_le > now() - interval '3 days') then
    insert into private.courriels (nature, cle_alerte, objet, texte) values ('alerte', p_cle, p_objet, p_texte);
  end if;
end;
$$;

-- Alertes préparées par la visite quotidienne (mêmes limites et mêmes seuils que le tableau de
-- bord : 80 % de 500 Mo de base et de 1 Go de fichiers ; sauvegarde de plus de 7 jours, ou
-- aucune depuis une installation de plus de 7 jours).
create function private.preparer_alertes()
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_mesure record;
  v_installation timestamptz := (select min(j.cree_le) from public.journal_audit j where j.action = 'installation');
  v_sauvegarde timestamptz := (select max(s.le) from private.sauvegardes s);
begin
  select m.base_octets, m.fichiers_octets into v_mesure from private.mesures_service m order by m.jour desc limit 1;
  if v_mesure.base_octets >= 400000000 then
    perform private.alerter('base', 'EduManage : base de données presque pleine',
      format(E'La base de données occupe %s Mo sur les 500 Mo de l''offre gratuite de Supabase.\nPleine, elle passe en lecture seule : plus aucune saisie possible. Prévoyez l''offre Pro de Supabase.',
        round(v_mesure.base_octets / 1e6)));
  end if;
  if v_mesure.fichiers_octets >= 800000000 then
    perform private.alerter('fichiers', 'EduManage : espace des fichiers presque plein',
      format(E'Les fichiers occupent %s Mo sur 1 Go (offre gratuite de Supabase).\nPlein, il refuse tout nouveau dépôt (photos, pièces, documents). Retirez les fichiers inutiles ou prévoyez l''offre Pro.',
        round(v_mesure.fichiers_octets / 1e6)));
  end if;
  if v_installation is not null and coalesce(v_sauvegarde, v_installation) < now() - interval '7 days' then
    perform private.alerter('sauvegarde', 'EduManage : sauvegarde à faire',
      case when v_sauvegarde is null
        then E'Aucune sauvegarde n''a encore été faite.\n'
        else format(E'Dernière sauvegarde le %s.\n', to_char(v_sauvegarde at time zone 'UTC', 'DD/MM/YYYY')) end
      || E'L''offre gratuite de Supabase n''en garde aucune : l''administrateur principal en télécharge une depuis Sécurité → Données et sauvegarde.');
  end if;
end;
$$;
revoke execute on function private.alerter(text, text, text), private.preparer_alertes() from public, anon, authenticated;

-- La visite quotidienne prépare aussi les alertes et purge les e-mails traités de plus de 180 jours.
create or replace function public.veille()
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_derniere timestamptz;
  v_fichiers record;
begin
  select m.mesure_le into v_derniere from private.mesures_service m where m.jour = current_date;
  if v_derniere is null or v_derniere < now() - interval '1 hour' then
    select * into v_fichiers from private.espace_fichiers();
    insert into private.mesures_service (jour, base_octets, fichiers_octets, fichiers_nombre, mesure_le)
    values (current_date, pg_database_size(current_database()), v_fichiers.octets, v_fichiers.nombre, now())
    on conflict (jour) do update
      set base_octets = excluded.base_octets, fichiers_octets = excluded.fichiers_octets,
          fichiers_nombre = excluded.fichiers_nombre, mesure_le = excluded.mesure_le;
    delete from private.mesures_service m where m.jour < current_date - 400;
    perform private.preparer_alertes();
    delete from private.courriels c where c.etat <> 'en_attente' and c.cree_le < now() - interval '180 days';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.veille() from public;
grant execute on function public.veille() to anon, authenticated;

-- Pour la fonction serveur « courriels » (propriétaire de la base) : réserve des e-mails à
-- envoyer (10 minutes, le temps de l'envoi), puis note le résultat de chacun.
create function private.courriels_reserver(p_limite integer)
returns table (id bigint, nature text, destinataire text, objet text, texte text, tentatives integer, cree_le timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  return query
  with choisis as (
    select c.id from private.courriels c
    where c.etat = 'en_attente' and c.prochain_essai <= now()
    order by c.prochain_essai, c.id
    limit greatest(1, least(coalesce(p_limite, 1), 200))
    for update skip locked
  )
  update private.courriels c
     set tentatives = c.tentatives + 1, prochain_essai = now() + interval '10 minutes'
    from choisis
   where c.id = choisis.id
  returning c.id, c.nature, c.destinataire, c.objet, c.texte, c.tentatives, c.cree_le;
end;
$$;

-- p_resultat : envoye, refuse, ignore (définitifs) ou reessayer (dans p_minutes ; refusé après
-- 6 tentatives). Un e-mail déjà traité ne change plus.
create function private.courriel_resultat(p_id bigint, p_resultat text, p_resend_id text, p_motif text, p_minutes integer default 0)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if p_resultat not in ('envoye', 'refuse', 'ignore', 'reessayer') then
    raise exception 'Résultat inconnu : %', p_resultat using errcode = 'check_violation';
  end if;
  if p_resultat = 'reessayer' then
    update private.courriels c
       set etat = case when c.tentatives >= 6 then 'refuse' else 'en_attente' end,
           traite_le = case when c.tentatives >= 6 then now() end,
           prochain_essai = now() + make_interval(mins => greatest(coalesce(p_minutes, 0), 0)),
           motif = left(p_motif, 500)
     where c.id = p_id and c.etat = 'en_attente';
  else
    update private.courriels c
       set etat = p_resultat, traite_le = now(), resend_id = left(p_resend_id, 100), motif = left(p_motif, 500)
     where c.id = p_id and c.etat = 'en_attente';
  end if;
end;
$$;
revoke execute on function private.courriels_reserver(integer), private.courriel_resultat(bigint, text, text, text, integer)
  from public, anon, authenticated;

-- Suivi des e-mails de chaque mail (écran « Mails envoyés »), pour l'administration.
create function public.livraison_courriels(p_mails text[])
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select private.est_administration()) then
    raise exception 'Le suivi des e-mails est réservé à l''administration.' using errcode = 'insufficient_privilege';
  end if;
  return coalesce((
    select jsonb_object_agg(t.mail_id, jsonb_build_object(
      'envoyes', t.envoyes, 'en_attente', t.en_attente, 'refuses', t.refuses, 'ignores', t.ignores, 'motif', t.motif))
    from (
      select c.mail_id,
             count(*) filter (where c.etat = 'envoye') as envoyes,
             count(*) filter (where c.etat = 'en_attente') as en_attente,
             count(*) filter (where c.etat = 'refuse') as refuses,
             count(*) filter (where c.etat = 'ignore') as ignores,
             (array_agg(c.motif order by c.traite_le desc nulls last) filter (where c.etat in ('refuse', 'ignore') and c.motif is not null))[1] as motif
      from private.courriels c
      where c.mail_id = any (p_mails[1:500])
      group by c.mail_id
    ) t), '{}'::jsonb);
end;
$$;
revoke execute on function public.livraison_courriels(text[]) from public, anon;
grant execute on function public.livraison_courriels(text[]) to authenticated;
