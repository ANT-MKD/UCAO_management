import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";

/** Base de données Supabase de l'établissement (clé publique seulement : la clé secrète ne quitte
 * jamais les fonctions serveur). Sans ces deux variables (développement hors ligne, tests
 * automatiques), l'application garde ses données dans le navigateur, comme avant la migration. */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clePublique = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && clePublique ? createClient(url, clePublique) : null;

/** Vrai quand les comptes et la connexion passent par Supabase (partie 2 du plan de migration). */
export const modeSupabase = supabase !== null;

/** Refus d'une fonction serveur, avec son message déjà rédigé pour l'utilisateur. */
export class ErreurServeur extends Error {
  constructor(message: string, readonly statut: number) {
    super(message);
    this.name = "ErreurServeur";
  }
}

/** Appelle une fonction serveur (supabase/functions) ; une réponse d'erreur devient une
 * ErreurServeur portant le message renvoyé par le serveur. */
export async function appelerFonction<T = { ok: true }>(nom: "connexion" | "comptes", corps: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new ErreurServeur("La base de données n'est pas configurée.", 0);
  const { data, error } = await supabase.functions.invoke(nom, { body: corps });
  if (!error) return data as T;
  if (error instanceof FunctionsHttpError) {
    const reponse = error.context as Response;
    let message = "Le serveur a refusé la demande.";
    try {
      const lu = (await reponse.json()) as { message?: unknown };
      if (typeof lu.message === "string" && lu.message) message = lu.message;
    } catch {
      // réponse sans corps lisible : message par défaut
    }
    throw new ErreurServeur(message, reponse.status);
  }
  throw new ErreurServeur("Le serveur est injoignable. Vérifiez votre connexion internet.", 0);
}
