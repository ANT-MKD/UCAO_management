// Traitement de la fonction serveur « sauvegarde » (partie 10, lot 3) : copie de la base et des
// fichiers hors de Supabase, dont l'offre gratuite ne fait aucune sauvegarde.
//   donnees   : script SQL des données (format COPY, comme pg_dump --data-only), pris dans un
//               instantané cohérent et envoyé au fil de l'eau ; inscrit au journal ;
//   fichiers  : liste des fichiers, chacun avec un lien de téléchargement valable une heure ;
//   noter     : inscrit la sauvegarde terminée (rappel au-delà de 7 jours) ;
//   url_depot : lien de dépôt d'un fichier, pour la restauration (jamais par-dessus un fichier).
// Le chiffrement se fait dans le navigateur, avec la phrase secrète que la fonction ne voit pas.
// Réservée à un administrateur à accès complet ; la session est vérifiée ici (verify_jwt = false).
// La base est jointe en propriétaire (SUPABASE_DB_URL) : seule façon de lire les identités
// (auth.users, mots de passe chiffrés compris) et les tables privées.
import type postgres from "npm:postgres@3.4.5";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { ENTETES_CORS, lireCorps, refuser, repondre, texte } from "../_shared/commun.ts";

type Sql = ReturnType<typeof postgres>;
export interface Acces {
  serveur: SupabaseClient;
  sql: Sql;
}

const INDISPONIBLE = "Sauvegarde impossible pour le moment. Réessayez dans quelques instants.";
/** Dernière ligne du script : son absence signale une sauvegarde interrompue. */
export const FIN_DONNEES = "-- Fin de la sauvegarde.\n";
/** Tables jamais sauvegardées : marque de l'environnement (posée à la main sur chaque projet),
 * mesures de la veille et tentatives de connexion (passagères). */
const TABLES_EXCLUES = ["private.environnement", "private.mesures_service", "private.tentatives_connexion"];
const CHEMIN = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const LIENS_PAR_APPEL = 100;
const encodeur = new TextEncoder();

/** Script des données : vide les tables de la base neuve, les remplit, recale les compteurs.
 * Tout se lit dans une seule transaction en lecture seule (instantané cohérent). */
export async function* produireDonnees(sql: Sql, maintenant = new Date()): AsyncGenerator<Uint8Array> {
  const tx = await sql.reserve();
  try {
    await tx`begin isolation level repeatable read read only`;
    const tables = await tx`
      select format('%I.%I', n.nspname, c.relname) as nom,
             (select string_agg(quote_ident(a.attname), ', ' order by a.attnum) from pg_attribute a
              where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped and a.attgenerated = '') as colonnes,
             n.nspname = 'auth' as identites
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p') and not c.relispartition
        and (n.nspname in ('public', 'private') or (n.nspname = 'auth' and c.relname in ('users', 'identities')))
        and format('%s.%s', n.nspname, c.relname) <> all (${TABLES_EXCLUES})
      order by n.nspname <> 'auth', n.nspname, c.relname`;
    const aVider = tables.filter((t) => !t.identites).map((t) => String(t.nom));
    yield encodeur.encode([
      `-- Sauvegarde des données d'EduManage, faite le ${maintenant.toISOString()}.`,
      "-- À restaurer sur un projet neuf dont les migrations sont appliquées : outil de restauration",
      "-- (supabase/restauration), ou psql -v ON_ERROR_STOP=1 -1 -f donnees.sql.",
      "SET client_encoding = 'UTF8';",
      "SET standard_conforming_strings = on;",
      "SET session_replication_role = replica;",
      `TRUNCATE TABLE ${aVider.join(", ")} CASCADE;`,
      "",
    ].join("\n") + "\n");
    for (const t of tables) {
      yield encodeur.encode(`COPY ${t.nom} (${t.colonnes}) FROM stdin;\n`);
      const flux = await tx.unsafe(`copy (select ${t.colonnes} from ${t.nom}) to stdout`).readable();
      for await (const morceau of flux) yield morceau as Uint8Array;
      yield encodeur.encode("\\.\n\n");
    }
    const sequences = await tx`
      select format('%I.%I', schemaname, sequencename) as nom, last_value
      from pg_sequences where schemaname in ('public', 'private') order by 1`;
    for (const s of sequences) {
      const valeur = s.last_value === null ? "1, false" : `${s.last_value}, true`;
      yield encodeur.encode(`SELECT pg_catalog.setval('${String(s.nom).replace(/'/g, "''")}', ${valeur});\n`);
    }
    yield encodeur.encode(`\n${FIN_DONNEES}`);
    await tx`commit`;
  } finally {
    tx.release();
    await sql.end({ timeout: 5 });
  }
}

async function listerFichiers(sql: Sql, serveur: SupabaseClient): Promise<Response> {
  const objets = await sql`
    select bucket_id as espace, name as chemin,
           case when (metadata ->> 'size') ~ '^[0-9]+$' then (metadata ->> 'size')::bigint else 0 end as taille,
           coalesce(metadata ->> 'mimetype', '') as type
    from storage.objects order by bucket_id, name`;
  const fichiers: Record<string, unknown>[] = [];
  const parEspace = new Map<string, typeof objets>();
  for (const o of objets) parEspace.set(String(o.espace), [...(parEspace.get(String(o.espace)) ?? []), o] as typeof objets);
  for (const [espace, liste] of parEspace) {
    for (let i = 0; i < liste.length; i += LIENS_PAR_APPEL) {
      const lot = liste.slice(i, i + LIENS_PAR_APPEL);
      const { data, error } = await serveur.storage.from(espace).createSignedUrls(lot.map((o) => String(o.chemin)), 3600);
      if (error || !data) throw new Error(`liens de ${espace} : ${error?.message}`);
      lot.forEach((o, j) => {
        const lien = data[j];
        if (!lien?.signedUrl || lien.error) throw new Error(`lien de ${espace}/${o.chemin} : ${lien?.error}`);
        fichiers.push({ espace, chemin: o.chemin, taille: Number(o.taille), type: o.type, url: lien.signedUrl });
      });
    }
  }
  return repondre(200, { fichiers });
}

async function lienDepot(sql: Sql, serveur: SupabaseClient, corps: Record<string, unknown>): Promise<Response> {
  const espace = texte(corps.espace);
  const chemin = texte(corps.chemin);
  if (!CHEMIN.test(chemin) || chemin.length > 400) return refuser(400, "Chemin de fichier invalide.");
  const [etat] = await sql`
    select exists (select 1 from storage.buckets b where b.id = ${espace}) as espace_existe,
           exists (select 1 from storage.objects o where o.bucket_id = ${espace} and o.name = ${chemin}) as deja_la`;
  if (!etat.espace_existe) return refuser(400, `Espace de fichiers inconnu : ${espace}.`);
  if (etat.deja_la) return refuser(409, `Ce fichier existe déjà : ${espace}/${chemin}.`);
  const { data, error } = await serveur.storage.from(espace).createSignedUploadUrl(chemin);
  if (error || !data) throw new Error(`dépôt de ${espace}/${chemin} : ${error?.message}`);
  return repondre(200, { url: data.signedUrl });
}

export async function traiter(req: Request, ouvrir: () => Acces): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: ENTETES_CORS });
  if (req.method !== "POST") return refuser(405, "Méthode non prise en charge.");
  const jeton = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!jeton) return refuser(401, "Connectez-vous pour continuer.");
  const corps = await lireCorps(req);
  if (!corps) return refuser(400, "Requête illisible.");

  const { serveur, sql } = ouvrir();
  let fluxOuvert = false;
  try {
    const { data, error } = await serveur.auth.getUser(jeton);
    if (error || !data.user) return refuser(401, "Votre session a expiré : reconnectez-vous.");
    const par = data.user.id;
    const [etat] = await sql`
      select exists (select 1 from public.comptes c where c.id = ${par}::uuid and c.actif
                     and c.type_compte = 'administration' and c.role_id is null) as autorise`;
    if (!etat.autorise) return refuser(403, "La sauvegarde est réservée à un administrateur à accès complet.");

    switch (corps.action) {
      case "donnees": {
        await sql`select private.noter_export(${par}::uuid)`;
        fluxOuvert = true;
        return new Response(ReadableStream.from(produireDonnees(sql)), {
          headers: { ...ENTETES_CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
      case "fichiers":
        return await listerFichiers(sql, serveur);
      case "noter": {
        const octets = Number(corps.octets);
        const fichiers = Number(corps.fichiers);
        if (!Number.isSafeInteger(octets) || octets <= 0 || !Number.isSafeInteger(fichiers) || fichiers < 0) {
          return refuser(400, "Sauvegarde incomplète : rien n'est noté.");
        }
        await sql`select private.noter_sauvegarde(${par}::uuid, ${octets}, ${fichiers})`;
        return repondre(200, { ok: true });
      }
      case "url_depot":
        return await lienDepot(sql, serveur, corps);
      default:
        return refuser(400, "Action inconnue.");
    }
  } catch (erreur) {
    console.error("sauvegarde :", erreur);
    return refuser(500, INDISPONIBLE);
  } finally {
    if (!fluxOuvert) await sql.end({ timeout: 5 });
  }
}
