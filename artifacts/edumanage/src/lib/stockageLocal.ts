/** Toutes les données d'EduManage vivent dans le stockage du navigateur (localStorage), limité à
 * environ 5 millions de caractères pour tout le site. Une fois plein, chaque enregistrement échoue :
 * sans ce module, l'échec passait inaperçu et tout ce qui était saisi ensuite était perdu au
 * rechargement. Ici, chaque écriture est surveillée et un échec est signalé à l'écran. */

/** Capacité usuelle du stockage d'un site (Chrome, Edge, Firefox), en caractères. */
export const CAPACITE_STOCKAGE = 5_000_000;
/** Marge gardée libre pour que les enregistrements courants (notes, présences…) passent toujours. */
const MARGE_STOCKAGE = 250_000;

export const EVENEMENT_STOCKAGE_PLEIN = "edumanage:stockage-plein";

/** Écrit une valeur ; en cas d'échec (stockage plein), prévient l'écran au lieu d'échouer en silence. */
export function ecrireStockage(cle: string, valeur: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(cle, valeur);
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

function placeDisponible(): number {
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
