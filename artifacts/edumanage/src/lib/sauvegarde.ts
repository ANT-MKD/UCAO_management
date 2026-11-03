import { appelerFonction } from "@/lib/supabase";
import { EcrivainSauvegarde } from "@/lib/archiveSauvegarde";

/** Sauvegarde hors de Supabase (partie 10, lot 3), faite par l'administrateur à accès complet :
 * données (script SQL, mots de passe chiffrés compris) et fichiers, réunis dans un seul fichier
 * chiffré avec sa phrase secrète, dans ce navigateur ; la phrase ne quitte jamais le poste. */

export interface FichierASauvegarder {
  espace: string;
  chemin: string;
  taille: number;
  type: string;
  url: string;
}

export interface EtapeSauvegarde {
  etape: "liste" | "donnees" | "fichiers" | "fin";
  fait: number;
  total: number;
}

export interface SauvegardeFaite {
  nom: string;
  blob: Blob;
  octets: number;
  fichiers: number;
}

/** Même ligne que la fonction serveur : son absence signale un script interrompu. */
export const FIN_DONNEES = "-- Fin de la sauvegarde.\n";

const deux = (n: number) => String(n).padStart(2, "0");

/** Nom du fichier : edumanage-sauvegarde-2026-11-03-14h05.edumanage */
export function nomSauvegarde(le: Date): string {
  return `edumanage-sauvegarde-${le.getFullYear()}-${deux(le.getMonth() + 1)}-${deux(le.getDate())}-${deux(le.getHours())}h${deux(le.getMinutes())}.edumanage`;
}

export async function faireSauvegarde(phrase: string, progression: (e: EtapeSauvegarde) => void = () => {},
  options: { iterations?: number; maintenant?: Date } = {}): Promise<SauvegardeFaite> {
  const maintenant = options.maintenant ?? new Date();
  // La phrase est vérifiée (longueur) avant tout appel au serveur.
  const ecrivain = await EcrivainSauvegarde.ouvrir(phrase, { iterations: options.iterations, maintenant });

  progression({ etape: "liste", fait: 0, total: 1 });
  const { fichiers } = await appelerFonction<{ fichiers: FichierASauvegarder[] }>("sauvegarde", { action: "fichiers" });

  progression({ etape: "donnees", fait: 0, total: 1 });
  const script = await appelerFonction<string>("sauvegarde", { action: "donnees" });
  if (typeof script !== "string" || !script.endsWith(FIN_DONNEES)) {
    throw new Error("La copie des données a été interrompue : la sauvegarde n'est pas faite. Réessayez.");
  }
  const donnees = new TextEncoder().encode(script);

  await ecrivain.ajouter("manifeste.json", new TextEncoder().encode(JSON.stringify({
    format: 1,
    application: "EduManage",
    cree_le: maintenant.toISOString(),
    projet: new URL(import.meta.env.VITE_SUPABASE_URL as string).host,
    donnees_octets: donnees.length,
    fichiers: fichiers.map(({ espace, chemin, taille, type }) => ({ espace, chemin, taille, type })),
  })));
  await ecrivain.ajouter("donnees.sql", donnees);

  for (const [i, f] of fichiers.entries()) {
    progression({ etape: "fichiers", fait: i, total: fichiers.length });
    let reponse: Response;
    try {
      reponse = await fetch(f.url);
    } catch {
      throw new Error(`Le fichier ${f.espace}/${f.chemin} n'a pas pu être téléchargé (connexion) : la sauvegarde n'est pas faite.`);
    }
    if (!reponse.ok) throw new Error(`Le fichier ${f.espace}/${f.chemin} n'a pas pu être téléchargé : la sauvegarde n'est pas faite.`);
    await ecrivain.ajouter(`fichiers/${f.espace}/${f.chemin}`, new Uint8Array(await reponse.arrayBuffer()));
  }
  progression({ etape: "fichiers", fait: fichiers.length, total: fichiers.length });

  const parties = await ecrivain.terminer();
  const blob = new Blob(parties as BlobPart[], { type: "application/octet-stream" });
  await appelerFonction("sauvegarde", { action: "noter", octets: blob.size, fichiers: fichiers.length });
  progression({ etape: "fin", fait: 1, total: 1 });
  return { nom: nomSauvegarde(maintenant), blob, octets: blob.size, fichiers: fichiers.length };
}
