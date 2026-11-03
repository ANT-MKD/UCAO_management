// Traitement de la fonction serveur « reprise » : reprise, une fois, des données d'un poste (partie 9, lot 3).
//   analyser      : essai complet dans la base, annulé ; rend le rapport de contrôle ;
//   nettoyer      : supprime les identités laissées par une reprise interrompue ;
//   creer_comptes : crée les identités Supabase des comptes repris (par lots) ;
//   deposer       : dépose les fichiers repris dans leurs espaces (par lots) ;
//   reprendre     : reprise réelle, en une transaction ; ensuite, les identités des comptes
//                   écartés sont supprimées (en cas d'échec : toutes, et les fichiers déposés).
// Réservée à un administrateur à accès complet, tant qu'aucune reprise n'a été faite. La session
// est vérifiée ici (verify_jwt = false). La base est jointe en propriétaire (SUPABASE_DB_URL) :
// la transaction de reprise passe en mode « replica », que seul le propriétaire peut demander.
import type postgres from "npm:postgres@3.4.5";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { ENTETES_CORS, adresseTechnique, lireCorps, refuser, repondre, texte } from "../_shared/commun.ts";

type Sql = ReturnType<typeof postgres>;
type Rapport = Record<string, unknown> & { ecartes_ids?: string[] };

const INDISPONIBLE = "Reprise impossible pour le moment. Réessayez dans quelques instants.";
/** Au plus, par appel : comptes créés, octets de fichiers déposés. */
const COMPTES_PAR_LOT = 50;
const OCTETS_PAR_LOT = 4_000_000;
const CHEMIN = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

/** Erreur de la base dont le message est rédigé pour l'utilisateur (refus d'une règle). */
const REFUS_LISIBLES = new Set(["23514", "23505", "42501", "P0001"]);

function motDePasseAleatoire(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/[+/=]/g, "x");
}

/** Exécute fn avec quelques tâches à la fois (les appels à Supabase Auth un par un seraient trop longs). */
async function parLots<T, R>(elements: T[], fn: (e: T) => Promise<R>, enParallele = 5): Promise<R[]> {
  const resultats: R[] = new Array(elements.length);
  let suivant = 0;
  await Promise.all(Array.from({ length: Math.min(enParallele, elements.length) }, async () => {
    while (suivant < elements.length) {
      const i = suivant++;
      resultats[i] = await fn(elements[i]);
    }
  }));
  return resultats;
}

class Annulation extends Error {
  constructor(readonly rapport: Rapport) {
    super("essai annulé");
  }
}

/** Reprise dans une transaction en mode « replica » ; l'essai est annulé et rend son rapport. */
async function executer(sql: Sql, par: string, corps: Record<string, unknown>, essai: boolean): Promise<Rapport> {
  const idsPour = Array.isArray(corps.ids_pour) ? corps.ids_pour.filter((t): t is string => typeof t === "string") : [];
  try {
    return await sql.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`set local statement_timeout = '140s'`;
      const [ligne] = await tx`
        select private.reprendre(${texte(corps.annee)}, ${tx.json(corps.tables as never)}::jsonb, ${tx.json(corps.comptes as never)}::jsonb,
          ${par}::uuid, ${essai},
          (select coalesce(array_agg(t), '{}') from jsonb_array_elements_text(${tx.json(idsPour)}::jsonb) t)) as rapport`;
      if (essai) throw new Annulation(ligne.rapport as Rapport);
      return ligne.rapport as Rapport;
    }) as Rapport;
  } catch (erreur) {
    if (erreur instanceof Annulation) return erreur.rapport;
    throw erreur;
  }
}

/** Identités créées par une reprise (marquées) qui n'ont pas de compte : supprimées. */
async function supprimerIdentitesSansCompte(sql: Sql, serveur: SupabaseClient, ids?: string[]): Promise<number> {
  const lignes = await sql`
    select u.id::text as id from auth.users u
    where u.raw_app_meta_data ->> 'reprise' = 'true'
      and not exists (select 1 from public.comptes c where c.id = u.id)
      and (${ids ? sql.json(ids) : null}::jsonb is null or u.id::text in (select jsonb_array_elements_text(${ids ? sql.json(ids) : null}::jsonb)))`;
  const supprimees = await parLots(lignes.map((l) => String(l.id)), async (id) => !(await serveur.auth.admin.deleteUser(id)).error);
  return supprimees.filter(Boolean).length;
}

async function creerComptes(serveur: SupabaseClient, corps: Record<string, unknown>): Promise<Response> {
  const comptes = Array.isArray(corps.comptes) ? corps.comptes as Record<string, unknown>[] : [];
  if (comptes.length === 0 || comptes.length > COMPTES_PAR_LOT) return refuser(400, `Envoyez de 1 à ${COMPTES_PAR_LOT} comptes à la fois.`);
  const resultats = await parLots(comptes, async (c) => {
    const ancien = texte(c.ancien);
    const identifiant = texte(c.identifiant);
    if (!ancien || !identifiant) return { ancien, motif: "compte sans identifiant" };
    const { data, error } = await serveur.auth.admin.createUser({
      email: adresseTechnique(identifiant),
      password: motDePasseAleatoire(),
      email_confirm: true,
      app_metadata: { reprise: true },
    });
    if (error || !data.user) {
      console.error("creer_comptes : identité refusée", error?.code, error?.message);
      return { ancien, motif: "identité non créée" };
    }
    return { ancien, id: data.user.id };
  });
  const ids: Record<string, string> = {};
  const erreurs: { ancien: string; motif: string }[] = [];
  for (const r of resultats) {
    if ("id" in r && r.id) ids[r.ancien] = r.id;
    else erreurs.push({ ancien: r.ancien, motif: (r as { motif: string }).motif });
  }
  return repondre(200, { ids, erreurs });
}

/** data:<type>;base64,<contenu> → octets et type. */
function decoder(dataUrl: string): { octets: Uint8Array; type: string } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  if (!m[2]) return { octets: new TextEncoder().encode(decodeURIComponent(m[3])), type: m[1] };
  const binaire = atob(m[3]);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return { octets, type: m[1] };
}

async function deposer(sql: Sql, serveur: SupabaseClient, corps: Record<string, unknown>): Promise<Response> {
  const fichiers = Array.isArray(corps.fichiers) ? corps.fichiers as Record<string, unknown>[] : [];
  if (fichiers.length === 0) return refuser(400, "Aucun fichier à déposer.");
  const taille = fichiers.reduce((t, f) => t + (typeof f.contenu === "string" ? f.contenu.length : 0), 0);
  if (taille > OCTETS_PAR_LOT * 1.4) return refuser(413, "Trop de fichiers à la fois : envoyez-les en plusieurs fois.");
  const espaces = new Set((await sql`select id from storage.buckets`).map((b) => String(b.id)));
  const erreurs: { espace: string; chemin: string; motif: string }[] = [];
  let deposes = 0;
  await parLots(fichiers, async (f) => {
    const espace = texte(f.espace);
    const chemin = texte(f.chemin);
    const contenu = typeof f.contenu === "string" ? decoder(f.contenu) : null;
    if (!espaces.has(espace) || !CHEMIN.test(chemin) || chemin.length > 300 || !contenu) {
      erreurs.push({ espace, chemin, motif: "fichier illisible ou emplacement invalide" });
      return;
    }
    const { error } = await serveur.storage.from(espace).upload(chemin, contenu.octets, { contentType: contenu.type, upsert: false });
    if (error) {
      const texteErreur = `${(error as { statusCode?: string }).statusCode ?? ""} ${error.message}`;
      erreurs.push({ espace, chemin, motif: /size|too large|413/i.test(texteErreur) ? "fichier trop lourd"
        : /mime|not supported|415/i.test(texteErreur) ? "type de fichier refusé" : "dépôt impossible" });
      return;
    }
    deposes++;
  });
  return repondre(200, { deposes, erreurs });
}

async function retirerFichiers(serveur: SupabaseClient, fichiers: unknown): Promise<void> {
  if (!Array.isArray(fichiers)) return;
  const parEspace = new Map<string, string[]>();
  for (const f of fichiers as Record<string, unknown>[]) {
    const espace = texte(f.espace);
    const chemin = texte(f.chemin);
    if (!espace || !CHEMIN.test(chemin)) continue;
    parEspace.set(espace, [...(parEspace.get(espace) ?? []), chemin]);
  }
  for (const [espace, chemins] of parEspace) {
    for (let i = 0; i < chemins.length; i += 100) await serveur.storage.from(espace).remove(chemins.slice(i, i + 100));
  }
}

function refusBase(erreur: unknown): Response {
  const e = erreur as { code?: string; message?: string };
  if (e?.code && REFUS_LISIBLES.has(e.code) && e.message) return refuser(e.code === "42501" ? 403 : 400, e.message);
  console.error("reprise : erreur de la base", e?.code, e?.message);
  return refuser(500, INDISPONIBLE);
}

/** Accès du traitement : le client Supabase à clé secrète et la base, jointe en propriétaire. */
export interface Acces {
  serveur: SupabaseClient;
  sql: Sql;
}

export async function traiter(req: Request, ouvrir: () => Acces): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: ENTETES_CORS });
  if (req.method !== "POST") return refuser(405, "Méthode non prise en charge.");
  const jeton = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!jeton) return refuser(401, "Connectez-vous pour continuer.");
  const corps = await lireCorps(req);
  if (!corps) return refuser(400, "Requête illisible.");

  const { serveur, sql } = ouvrir();
  try {
    const { data, error } = await serveur.auth.getUser(jeton);
    if (error || !data.user) return refuser(401, "Votre session a expiré : reconnectez-vous.");
    const par = data.user.id;

    const [etat] = await sql`
      select exists (select 1 from public.comptes c where c.id = ${par}::uuid and c.actif and c.type_compte = 'administration' and c.role_id is null) as autorise,
             exists (select 1 from private.reprises) as faite`;
    if (!etat.autorise) return refuser(403, "La reprise est réservée à un administrateur à accès complet.");
    if (etat.faite) return refuser(409, "La reprise a déjà été faite : elle ne se refait pas.");

    switch (corps.action) {
      case "analyser":
        try {
          return repondre(200, { rapport: await executer(sql, par, corps, true) });
        } catch (erreur) {
          return refusBase(erreur);
        }
      case "nettoyer":
        return repondre(200, { supprimees: await supprimerIdentitesSansCompte(sql, serveur) });
      case "creer_comptes":
        return await creerComptes(serveur, corps);
      case "deposer":
        return await deposer(sql, serveur, corps);
      case "reprendre": {
        const crees = (Array.isArray(corps.comptes) ? corps.comptes as Record<string, unknown>[] : [])
          .map((c) => texte(c.id)).filter(Boolean);
        let rapport: Rapport;
        try {
          rapport = await executer(sql, par, corps, false);
        } catch (erreur) {
          // Rien n'est repris : les identités créées pour la reprise et les fichiers déposés partent.
          await supprimerIdentitesSansCompte(sql, serveur, crees);
          await retirerFichiers(serveur, corps.fichiers_deposes);
          return refusBase(erreur);
        }
        await supprimerIdentitesSansCompte(sql, serveur, rapport.ecartes_ids ?? []);
        const { ecartes_ids: _ecartes, ...visible } = rapport;
        return repondre(200, { rapport: visible });
      }
      default:
        return refuser(400, "Action inconnue.");
    }
  } catch (erreur) {
    console.error("reprise :", erreur);
    return refuser(500, INDISPONIBLE);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
