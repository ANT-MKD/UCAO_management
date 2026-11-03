import { appelerFonction, modeSupabase, supabase } from "@/lib/supabase";

/** E-mails par Resend (partie 10, lot 4). La base met en file chaque mail qui part (une ligne par
 * adresse) ; la fonction serveur « courriels » vide la file. L'application la déclenche juste après
 * un envoi ; la visite quotidienne la déclenche aussi chaque matin (ce qui reste, ou ce qui a
 * échoué, repart alors). */

let enCours: Promise<void> | null = null;
let encore = false;

/** Vide la file en arrière-plan, une fois les envois de ce poste arrivés dans la base. Des appels
 * rapprochés n'en font qu'un (plus un dernier pour ce qui est arrivé entre-temps). */
export function declencherEnvoiCourriels(): Promise<void> {
  if (!modeSupabase) return Promise.resolve();
  if (enCours) {
    encore = true;
    return enCours;
  }
  enCours = (async () => {
    do {
      encore = false;
      try {
        const { attendreEnvois } = await import("@/lib/miroirServeur");
        await attendreEnvois();
        await appelerFonction("courriels", { action: "envoyer" });
      } catch {
        // Rien de perdu : la file reste dans la base, la visite quotidienne la reprendra.
      }
    } while (encore);
  })().finally(() => {
    enCours = null;
  });
  return enCours;
}

export interface LivraisonCourriels {
  envoyes: number;
  en_attente: number;
  refuses: number;
  ignores: number;
  motif?: string | null;
}

/** Ce que chaque mail a donné par e-mail (administration). */
export async function lireLivraisons(ids: string[]): Promise<Record<string, LivraisonCourriels>> {
  if (!supabase || ids.length === 0) return {};
  const { data, error } = await supabase.rpc("livraison_courriels", { p_mails: ids.slice(0, 500) });
  if (error || !data) return {};
  return data as Record<string, LivraisonCourriels>;
}

export function resumeLivraison(l: LivraisonCourriels | undefined): string {
  if (!l) return "—";
  const parties = [
    l.envoyes > 0 && `${l.envoyes} envoyé${l.envoyes > 1 ? "s" : ""}`,
    l.en_attente > 0 && `${l.en_attente} en attente`,
    l.refuses > 0 && `${l.refuses} refusé${l.refuses > 1 ? "s" : ""}`,
    l.ignores > 0 && `${l.ignores} non envoyé${l.ignores > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return parties.length > 0 ? parties.join(" · ") : "—";
}

export interface EtatCourriels {
  configure: boolean;
  expediteur: string;
  domaine_propre: boolean;
  alertes: string | null;
  file: { en_attente: number; envoyes: number; refuses: number; ignores: number };
  motifs: { motif: string; nombre: number }[];
}

/** Réglages et état de la file (administrateur à accès complet) ; null sinon. */
export async function lireEtatCourriels(): Promise<EtatCourriels | null> {
  if (!modeSupabase) return null;
  try {
    return await appelerFonction<EtatCourriels>("courriels", { action: "etat" });
  } catch {
    return null;
  }
}
