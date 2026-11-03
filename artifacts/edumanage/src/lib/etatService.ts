import { supabase } from "@/lib/supabase";

/** État du service (partie 10, lot 3) : espace occupé face aux limites de l'offre gratuite de
 * Supabase, et dernière visite quotidienne (sans elle, la base est mise en pause après 7 jours
 * sans activité). Lu par l'administrateur à accès complet seulement. */
export interface EtatService {
  baseOctets: number;
  baseLimite: number;
  fichiersOctets: number;
  fichiersNombre: number;
  fichiersLimite: number;
  derniereVeille: string | null;
  derniereSauvegarde: string | null;
}

export type NiveauAlerte = "attention" | "critique";

export interface AlerteService {
  niveau: NiveauAlerte;
  titre: string;
  message: string;
}

/** Part occupée à partir de laquelle on prévient, puis on insiste. */
export const SEUIL_ATTENTION = 0.8;
export const SEUIL_CRITIQUE = 0.95;
/** Délai au-delà duquel la visite quotidienne est considérée comme arrêtée. */
export const RETARD_VEILLE_HEURES = 48;
/** Rappel de sauvegarde (offre gratuite : Supabase n'en fait aucune), puis insistance. */
export const RAPPEL_SAUVEGARDE_JOURS = 7;
export const ALERTE_SAUVEGARDE_JOURS = 30;

/** Tailles en unités décimales, comme les limites de l'offre (500 Mo, 1 Go). */
export function formatTaille(octets: number): string {
  if (octets >= 1e9) return `${(octets / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Go`;
  if (octets >= 1e6) return `${Math.round(octets / 1e6).toLocaleString("fr-FR")} Mo`;
  return `${Math.max(0, Math.round(octets / 1e3)).toLocaleString("fr-FR")} Ko`;
}

export function part(octets: number, limite: number): number {
  return limite > 0 ? octets / limite : 0;
}

function niveau(p: number): NiveauAlerte | null {
  if (p >= SEUIL_CRITIQUE) return "critique";
  if (p >= SEUIL_ATTENTION) return "attention";
  return null;
}

const pourcent = (p: number) => `${Math.floor(p * 100)} %`;
const date = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Ce que l'administrateur doit savoir, du plus grave au moins grave ; vide si tout va bien. */
export function alertesService(etat: EtatService, maintenant: Date = new Date()): AlerteService[] {
  const alertes: AlerteService[] = [];
  const pBase = part(etat.baseOctets, etat.baseLimite);
  const nBase = niveau(pBase);
  if (nBase) {
    alertes.push({
      niveau: nBase,
      titre: "Base de données presque pleine",
      message: `La base occupe ${formatTaille(etat.baseOctets)} sur ${formatTaille(etat.baseLimite)} (${pourcent(pBase)}). `
        + "Pleine, elle passe en lecture seule : plus aucune saisie possible. Prévoyez l'offre Pro de Supabase.",
    });
  }
  const pFichiers = part(etat.fichiersOctets, etat.fichiersLimite);
  const nFichiers = niveau(pFichiers);
  if (nFichiers) {
    alertes.push({
      niveau: nFichiers,
      titre: "Espace des fichiers presque plein",
      message: `Les fichiers (photos, pièces, documents) occupent ${formatTaille(etat.fichiersOctets)} sur ${formatTaille(etat.fichiersLimite)} (${pourcent(pFichiers)}). `
        + "Plein, il refuse tout nouveau dépôt. Retirez les fichiers inutiles ou prévoyez l'offre Pro de Supabase.",
    });
  }
  const derniere = etat.derniereVeille ? new Date(etat.derniereVeille) : null;
  if (!derniere || maintenant.getTime() - derniere.getTime() > RETARD_VEILLE_HEURES * 3600_000) {
    alertes.push({
      niveau: "attention",
      titre: "Visite quotidienne arrêtée",
      message: (derniere ? `Dernière visite quotidienne le ${date(derniere.toISOString())}. ` : "La visite quotidienne n'a encore jamais eu lieu. ")
        + "Sans elle, la base est mise en pause après 7 jours sans activité (vacances). "
        + "Vérifiez la tâche planifiée /api/veille dans Vercel (Settings → Cron Jobs).",
    });
  }
  const sauvegarde = etat.derniereSauvegarde ? new Date(etat.derniereSauvegarde) : null;
  const jours = sauvegarde ? Math.floor((maintenant.getTime() - sauvegarde.getTime()) / 86_400_000) : null;
  if (jours === null || jours >= RAPPEL_SAUVEGARDE_JOURS) {
    alertes.push({
      niveau: jours === null || jours >= ALERTE_SAUVEGARDE_JOURS ? "critique" : "attention",
      titre: "Sauvegarde à faire",
      message: (jours === null ? "Aucune sauvegarde n'a encore été faite. " : `Dernière sauvegarde il y a ${jours} jours. `)
        + "L'offre gratuite de Supabase n'en garde aucune : téléchargez-en une (Sécurité → Données et sauvegarde) "
        + "et rangez-la sur un ordinateur de l'université.",
    });
  }
  return alertes.sort((a, b) => (a.niveau === b.niveau ? 0 : a.niveau === "critique" ? -1 : 1));
}

/** État lu dans la base ; null sans base ou pour un compte sans accès complet. */
export async function lireEtatService(): Promise<EtatService | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("etat_service");
  if (error || !data) return null;
  const e = data as Record<string, unknown>;
  return {
    baseOctets: Number(e.base_octets),
    baseLimite: Number(e.base_limite),
    fichiersOctets: Number(e.fichiers_octets),
    fichiersNombre: Number(e.fichiers_nombre),
    fichiersLimite: Number(e.fichiers_limite),
    derniereVeille: typeof e.derniere_veille === "string" ? e.derniere_veille : null,
    derniereSauvegarde: typeof e.derniere_sauvegarde === "string" ? e.derniere_sauvegarde : null,
  };
}
