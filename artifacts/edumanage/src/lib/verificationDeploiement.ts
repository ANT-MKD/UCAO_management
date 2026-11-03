/** Contrôle de la configuration au moment de construire l'application (vite build, sur Vercel ou
 * ailleurs) : la construction échoue plutôt que de publier une application mal branchée.
 * - Une clé secrète mise par erreur à la place de la clé publique serait lisible par tous dans le
 *   code de l'application : refus, toujours.
 * - La mise en ligne de production (Vercel, VERCEL_ENV=production) sans base ferait travailler
 *   l'université dans le navigateur de chaque poste : refus.
 * Sans aucune variable, hors production (tests, aperçus), l'application reste en mode navigateur. */

export interface EnvConstruction {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Fourni par Vercel pendant la construction : production, preview ou development. */
  VERCEL_ENV?: string;
}

/** Rôle porté par une ancienne clé au format JWT (anon, service_role), sinon null. */
function roleDuJeton(cle: string): string | null {
  const parties = cle.split(".");
  if (parties.length !== 3) return null;
  try {
    const charge = JSON.parse(atob(parties[1].replace(/-/g, "+").replace(/_/g, "/"))) as { role?: unknown };
    return typeof charge.role === "string" ? charge.role : null;
  } catch {
    return null;
  }
}

export function erreursDeConfiguration(env: EnvConstruction): string[] {
  const url = env.VITE_SUPABASE_URL?.trim() ?? "";
  const cle = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  const erreurs: string[] = [];
  if (cle.startsWith("sb_secret_") || roleDuJeton(cle) === "service_role") {
    erreurs.push("VITE_SUPABASE_PUBLISHABLE_KEY contient une clé secrète, qui serait lisible par tous dans l'application. "
      + "Mettez la clé publique (sb_publishable_…) et, par précaution, remplacez la clé secrète dans Supabase.");
  }
  if (!url !== !cle) {
    erreurs.push("Il faut les deux variables VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY, ou aucune des deux.");
  }
  if (url && !/^https:\/\/[a-z0-9.-]+$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) {
    erreurs.push("VITE_SUPABASE_URL doit être l'adresse du projet, sans chemin ni barre finale : https://<référence>.supabase.co.");
  }
  if (env.VERCEL_ENV === "production" && !url) {
    erreurs.push("La mise en ligne de production exige la base : renseignez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY "
      + "dans les variables d'environnement du projet Vercel (environnement « Production »), puis relancez le déploiement.");
  }
  return erreurs;
}
