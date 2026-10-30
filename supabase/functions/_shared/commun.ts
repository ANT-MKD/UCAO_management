// Outils communs aux fonctions serveur d'EduManage : réponses, clients Supabase, adresse de
// connexion technique, règles de mot de passe.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

export const ENTETES_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function repondre(statut: number, corps: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...ENTETES_CORS, "Content-Type": "application/json" },
  });
}

export function refuser(statut: number, message: string): Response {
  return repondre(statut, { message });
}

/** Clé « default » des nouvelles clés (JSON), ou à défaut l'ancienne clé du même rôle. */
function cle(nouvelles: string, ancienne: string): string {
  const json = Deno.env.get(nouvelles);
  if (json) {
    const valeur = (JSON.parse(json) as Record<string, string>)["default"];
    if (valeur) return valeur;
  }
  const valeur = Deno.env.get(ancienne);
  if (!valeur) throw new Error(`Clé absente : ${nouvelles}`);
  return valeur;
}

const SANS_SESSION = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Clé secrète : contourne les règles d'accès. Ne sort jamais de la fonction serveur. */
export function clientServeur(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, cle("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), SANS_SESSION);
}

/** Clé publique : ouvre une session avec un mot de passe, comme le ferait le navigateur. */
export function clientPublic(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, cle("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), SANS_SESSION);
}

/** Client qui ouvre une session au nom d'un utilisateur. Avec la clé secrète et l'en-tête
 * Sb-Forwarded-For, Supabase Auth compte ses limites par adresse IP de l'utilisateur (si le réglage
 * « IP Address Forwarding » est activé) plutôt que par celle de la fonction serveur, partagée par tous. */
export function clientSession(req: Request): SupabaseClient {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const secretes = Deno.env.get("SUPABASE_SECRET_KEYS");
  const cleSecrete = secretes ? (JSON.parse(secretes) as Record<string, string>)["default"] : undefined;
  if (!ip || !cleSecrete) return clientPublic();
  return createClient(Deno.env.get("SUPABASE_URL")!, cleSecrete, {
    ...SANS_SESSION,
    global: { headers: { "Sb-Forwarded-For": ip } },
  });
}

/** Domaine réservé (RFC 2606) : ces adresses ne reçoivent jamais de courrier. */
export const DOMAINE_TECHNIQUE = "comptes.edumanage.invalid";

/** Adresse de connexion d'un nouveau compte, jamais montrée. Le suffixe aléatoire empêche de la
 * déduire de l'identifiant, donc de contourner le verrouillage en s'adressant directement à
 * Supabase Auth. */
export function adresseTechnique(identifiant: string): string {
  const base = identifiant.trim().toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-").replace(/\.{2,}/g, ".").replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 40) || "compte";
  const suffixe = Array.from(crypto.getRandomValues(new Uint8Array(6)), (o) => o.toString(16).padStart(2, "0")).join("");
  return `${base}.${suffixe}@${DOMAINE_TECHNIQUE}`;
}

/** Mêmes règles que l'application (lib/passwordPolicy.ts) : 6 caractères au moins, hors espaces
 * autour ; 8 pour l'administrateur principal. */
export function motifMotDePasse(motDePasse: unknown, minimum = 6): string | null {
  if (typeof motDePasse !== "string" || motDePasse.trim().length < minimum) {
    return `Le mot de passe doit contenir au moins ${minimum} caractères (hors espaces).`;
  }
  if (motDePasse.length > 72) return "Le mot de passe ne peut pas dépasser 72 caractères.";
  return null;
}

/** Message d'une erreur renvoyée par une fonction de la base (déjà rédigé pour l'utilisateur). */
export function messageBase(erreur: { message?: string } | null, defaut: string): string {
  return erreur?.message?.trim() || defaut;
}

/** Corps JSON de la requête (objet), ou null s'il est illisible. */
export async function lireCorps(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const corps = await req.json();
    return corps && typeof corps === "object" && !Array.isArray(corps) ? corps as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim() : "";
}
