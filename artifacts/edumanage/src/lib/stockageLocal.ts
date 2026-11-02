import { modeSupabase } from "@/lib/supabase";

/** Sans base de données, toutes les données d'EduManage vivent dans le stockage du navigateur
 * (localStorage), limité à environ 5 millions de caractères pour tout le site. Une fois plein,
 * chaque enregistrement échoue : sans ce module, l'échec passait inaperçu et tout ce qui était
 * saisi ensuite était perdu au rechargement. Ici, chaque écriture est surveillée et un échec est
 * signalé à l'écran.
 *
 * Avec la base de données (partie 9), plus aucune donnée n'est écrite dans le navigateur : les
 * stores gardent la leur en mémoire, le temps de la page, et la base en reste la seule copie.
 * Ne restent sur le poste que le thème, la session (tenue par Supabase), deux préférences
 * d'affichage sans donnée personnelle et, jusqu'à sa reprise, la sauvegarde d'avant la base. */

/** Données de ce poste d'avant la base, mises de côté une fois pour la reprise. */
export const CLE_SAUVEGARDE = "edumanage-sauvegarde-avant-supabase-v1";
/** Ce que le poste garde avec la base : thème, sauvegarde, préférences d'affichage. */
const CLES_DU_POSTE = new Set(["edumanage-theme", CLE_SAUVEGARDE, "edumanage-fiche-inscription-filiere-defaut"]);
const PREFIXES_DU_POSTE = ["edumanage-requests-lastseen-"];
/** Session de l'ancienne connexion sans base : sans objet avec Supabase, effacée sans être gardée. */
const ANCIENNE_SESSION = "edumanage-auth-session";

/** Vrai pour une clé que le poste garde même avec la base (thème, préférences, sauvegarde). */
export function cleDuPoste(cle: string): boolean {
  return CLES_DU_POSTE.has(cle) || PREFIXES_DU_POSTE.some((p) => cle.startsWith(p));
}

/** Avec la base : contenu des stores, en mémoire seulement. */
const memoire = new Map<string, string>();
const enMemoire = (cle: string) => modeSupabase && !cleDuPoste(cle);

/** Lit une valeur enregistrée (null si absente). Avec la base, une donnée n'est lue qu'en mémoire :
 * ce que le navigateur aurait gardé d'une session précédente n'est jamais relu. */
export function lireStockage(cle: string): string | null {
  if (typeof window === "undefined") return null;
  if (enMemoire(cle)) return memoire.get(cle) ?? null;
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

/** Retire une valeur enregistrée. */
export function retirerStockage(cle: string): void {
  if (typeof window === "undefined") return;
  if (enMemoire(cle)) {
    memoire.delete(cle);
    return;
  }
  try {
    localStorage.removeItem(cle);
  } catch {
    // stockage indisponible : rien à retirer
  }
}

interface Sauvegarde {
  le: string;
  donnees: Record<string, string | null>;
}

/** Lit la sauvegarde d'avant la base laissée sur ce poste (null s'il n'y en a pas). */
export function lireSauvegarde(): Sauvegarde | null {
  if (typeof window === "undefined") return null;
  try {
    const lu = JSON.parse(localStorage.getItem(CLE_SAUVEGARDE) ?? "null") as Sauvegarde | null;
    return lu && typeof lu === "object" && lu.donnees && typeof lu.donnees === "object" ? lu : null;
  } catch {
    return null;
  }
}

/** Avec la base, au chargement de la page : les données que le navigateur garde encore (usage sans
 * base, ou copies écrites par une version précédente) sont mises de côté une fois dans la
 * sauvegarde, pour la reprise, puis effacées. Une clé déjà mise de côté ne contient plus qu'une
 * copie de la base : elle est effacée d'abord, ce qui libère la place de la sauvegarde. Si la
 * sauvegarde ne peut pas s'écrire (stockage plein), rien n'est effacé de ce qui n'y est pas encore :
 * la reprise le lira là où il est. */
export function mettreDeCoteLesDonneesDuPoste(): void {
  if (typeof window === "undefined") return;
  try {
    const cles: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i);
      if (cle && cle.startsWith("edumanage-") && !cleDuPoste(cle)) cles.push(cle);
    }
    if (cles.length === 0) return;
    const sauvegarde = lireSauvegarde() ?? { le: new Date().toISOString(), donnees: {} };
    const nouvelles = cles.filter((cle) => cle !== ANCIENNE_SESSION && !(cle in sauvegarde.donnees));
    cles.filter((cle) => !nouvelles.includes(cle)).forEach((cle) => localStorage.removeItem(cle));
    if (nouvelles.length === 0) return;
    for (const cle of nouvelles) sauvegarde.donnees[cle] = localStorage.getItem(cle);
    localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(sauvegarde));
    nouvelles.forEach((cle) => localStorage.removeItem(cle));
  } catch (err) {
    console.error("[EduManage] Données du poste non mises de côté :", err);
  }
}

if (typeof window !== "undefined" && modeSupabase) mettreDeCoteLesDonneesDuPoste();

/** Capacité usuelle du stockage d'un site (Chrome, Edge, Firefox), en caractères. */
export const CAPACITE_STOCKAGE = 5_000_000;
/** Marge gardée libre pour que les enregistrements courants (notes, présences…) passent toujours. */
const MARGE_STOCKAGE = 250_000;

export const EVENEMENT_STOCKAGE_PLEIN = "edumanage:stockage-plein";

type ObservateurEcriture = (cle: string) => void;
const observateurs = new Set<ObservateurEcriture>();

/** Prévient à chaque enregistrement réussi d'une clé (le miroir Supabase y envoie les modifications). */
export function observerEcritures(fn: ObservateurEcriture): () => void {
  observateurs.add(fn);
  return () => {
    observateurs.delete(fn);
  };
}

/** Écrit une valeur (avec la base : en mémoire) ; en cas d'échec (stockage plein), prévient l'écran
 * au lieu d'échouer en silence. */
export function ecrireStockage(cle: string, valeur: string): boolean {
  if (typeof window === "undefined") return false;
  if (enMemoire(cle)) {
    memoire.set(cle, valeur);
    observateurs.forEach((fn) => fn(cle));
    return true;
  }
  try {
    localStorage.setItem(cle, valeur);
    observateurs.forEach((fn) => fn(cle));
    return true;
  } catch (err) {
    console.error(`[EduManage] Enregistrement impossible (${cle}) :`, err);
    window.dispatchEvent(new CustomEvent(EVENEMENT_STOCKAGE_PLEIN, { detail: { cle } }));
    return false;
  }
}

/** Nombre de caractères actuellement occupés par le site. */
export function stockageUtilise(): number {
  if (typeof window === "undefined") return 0;
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i) ?? "";
      total += cle.length + (localStorage.getItem(cle)?.length ?? 0);
    }
  } catch {
    return 0;
  }
  return total;
}

export function pourcentageStockage(): number {
  return Math.min(100, Math.round((stockageUtilise() / CAPACITE_STOCKAGE) * 100));
}

/** Avec la base, un fichier part dans l'espace de fichiers du serveur : le navigateur ne le garde
 * pas, sa place n'y compte donc pas (la taille de chaque espace reste limitée par la base). */
function placeDisponible(): number {
  if (modeSupabase) return Number.POSITIVE_INFINITY;
  return CAPACITE_STOCKAGE - MARGE_STOCKAGE - stockageUtilise();
}

function enKo(caracteres: number): string {
  return `${Math.max(0, Math.round(caracteres / 1024)).toLocaleString("fr-FR")} Ko`;
}

export interface OptionsFichier {
  /** Taille maximale d'un fichier qui n'est pas une photo (les photos sont recompressées). */
  maxOctets?: number;
  /** "portrait" : photo d'identité (petite) ; "document" : photo du tableau, scan… */
  usagePhoto?: "portrait" | "document";
}

function compresserImage(file: File, coteMax: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const echelle = Math.min(1, coteMax / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * echelle));
      canvas.height = Math.max(1, Math.round(img.height * echelle));
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) { reject(new Error("Image illisible.")); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible.")); };
    img.src = url;
  });
}

function lireBrut(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Fichier illisible."));
    reader.readAsDataURL(file);
  });
}

/** Ouvre dans un nouvel onglet un fichier enregistré : son contenu (choisi sur ce poste) ou son lien
 * signé dans l'espace de fichiers privé. */
export function ouvrirFichier(fichier: string): void {
  const win = window.open("", "_blank");
  if (!win) return;
  if (!fichier.startsWith("data:") || fichier.startsWith("data:application/pdf")) {
    win.location.href = fichier;
  } else {
    win.document.write(`<!DOCTYPE html><html><body style="margin:0"><img src="${fichier}" style="max-width:100%" /></body></html>`);
    win.document.close();
  }
}

/** Prépare un fichier avant de l'enregistrer : les photos sont réduites et recompressées (une photo
 * de téléphone de 3 Mo tombe à environ 150 Ko), les autres fichiers sont limités en taille, et
 * aucun fichier n'est accepté s'il ne tient plus dans le stockage restant. Rejette avec un message
 * prêt à afficher. */
export async function lireFichierPourStockage(file: File, options: OptionsFichier = {}): Promise<string> {
  const photo = /^image\/(jpeg|png|webp|bmp|heic|heif)$/i.test(file.type);
  let dataUrl: string;
  if (photo) {
    dataUrl = await compresserImage(file, options.usagePhoto === "portrait" ? 480 : 1600);
  } else {
    if (options.maxOctets && file.size > options.maxOctets) {
      throw new Error(`Fichier trop lourd (${Math.round(file.size / 1024).toLocaleString("fr-FR")} Ko, maximum ${Math.round(options.maxOctets / 1024).toLocaleString("fr-FR")} Ko).`);
    }
    dataUrl = await lireBrut(file);
  }
  const place = placeDisponible();
  if (dataUrl.length > place) {
    throw new Error(`Espace de stockage insuffisant : ce fichier demande ${enKo(dataUrl.length)}, il reste ${enKo(place)}. Supprimez des pièces jointes ou photos devenues inutiles.`);
  }
  return dataUrl;
}
