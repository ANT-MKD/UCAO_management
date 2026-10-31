import { modeSupabase, supabase } from "@/lib/supabase";
import { observerEcritures } from "@/lib/stockageLocal";

/** Miroir Supabase des données de référence (partie 3 du plan de migration).
 *
 * Les écrans continuent de lire les stores du navigateur, de façon synchrone. Avec Supabase :
 *   - à la connexion, chaque store est rempli avec ce que la base contient (chargerMiroirs) ;
 *   - à chaque enregistrement d'un store, les lignes ajoutées, modifiées ou supprimées partent vers
 *     la base, dans l'ordre des actions ;
 *   - si la base refuse (droit manquant, élément encore utilisé, valeur hors limites), le store est
 *     recalé sur la base et l'écran affiche le motif.
 * La base reste seule juge : ses règles d'accès et ses liens s'appliquent à chaque envoi. */

type Ligne = Record<string, unknown>;
type Fiche = { id: string } & Record<string, unknown>;

/** Champ qui désigne un fichier de l'espace de fichiers (partie 4) : la fiche garde de quoi
 * l'afficher, la base garde son chemin. Un fichier choisi sur le poste (data URL) est déposé avant
 * l'envoi de sa ligne, sous un nouveau chemin (un fichier déposé ne se réécrit jamais). */
export interface ChampFichier<R> {
  /** Espace de fichiers (bucket). */
  espace: string;
  /** Dossier du fichier dans l'espace, terminé par « / » (ex. etudiants/<id>/). */
  dossier: (fiche: R) => string;
  /** « url » (défaut) : lien signé, pour l'affichage ; « donnees » : contenu (data URL), pour ce
   * qui s'imprime sans attendre le réseau (logo, signatures). */
  forme?: "url" | "donnees";
}

export interface PartieMiroir<R extends { id: string }> {
  /** Table de la base. */
  table: string;
  /** Champs de la fiche envoyés à la base : « champ » (en camelCase ; la colonne est en
   * snake_case) ou [champ, colonne] quand la base le nomme autrement. */
  colonnes: readonly (string | readonly [string, string])[];
  /** Valeur envoyée quand le champ est absent de la fiche (colonne obligatoire côté base). */
  defauts?: Readonly<Record<string, unknown>>;
  /** Fiches actuelles du store. */
  lire: () => R[];
  /** Remplace les fiches du store par celles de la base (au chargement ou après un refus). */
  remplacer: (fiches: R[]) => void;
  /** Ordre d'envoi des lignes modifiées (ex. l'année « actuelle » en dernier). */
  ordreEnvoi?: (a: Ligne, b: Ligne) => number;
  /** Fiches qui partent vers la base ; les autres restent propres au navigateur (ex. valeurs par
   * défaut jamais réglées par un administrateur). */
  envoyable?: (fiche: R) => boolean;
  /** Table que la base écrit elle-même (ex. historique) : lue à la connexion, jamais envoyée. */
  lectureSeule?: boolean;
  /** Ligne créée par la base (ex. établissement, à l'installation) : seulement mise à jour, ni
   * ajoutée ni supprimée depuis le navigateur. */
  miseAJourSeule?: boolean;
  /** Avec miseAJourSeule : seuls ces champs partent (ex. « lue » d'une notification) ; les autres
   * sont écrits par la base. */
  champsModifiables?: readonly string[];
  /** Table qui complète une table principale du même miroir, ligne pour ligne (ex. dossier
   * personnel d'une fiche), et que tous les comptes ne lisent pas. Une ligne n'en part que si elle
   * était connue (lue à la connexion) ou si sa ligne principale part en même temps : un poste ne
   * renvoie jamais, vide, le dossier qu'il n'a pas le droit de lire. */
  complementDe?: string;
  /** Champs dont la valeur vide ("") part comme « aucune valeur » (ex. classe d'un étudiant en
   * attente d'affectation, qui renvoie à une classe qui doit exister) et revient vide. */
  nulSiVide?: readonly string[];
  /** Champs qui désignent un fichier (photo, pièce, logo…), avec leur espace et leur dossier. */
  fichiers?: Readonly<Record<string, ChampFichier<R>>>;
}

export interface Miroir {
  /** Clé de stockage écrite par le store à chaque enregistrement. Une même clé peut alimenter
   * plusieurs miroirs, chacun envoyé à son rang (ex. années, puis étudiants après les classes). */
  cle: string;
  /** Tables alimentées par cette clé, les parents d'abord (envoyées dans cet ordre, supprimées à
   * l'envers). */
  parties: readonly PartieMiroir<{ id: string }>[];
}

export const EVENEMENT_REFUS_SERVEUR = "edumanage:refus-serveur";

/** Partie typée par sa fiche, rangée avec les autres parties d'un miroir. */
export function partie<R extends { id: string }>(p: PartieMiroir<R>): PartieMiroir<{ id: string }> {
  return p as unknown as PartieMiroir<{ id: string }>;
}

const champsEtColonnes = (partie: PartieMiroir<{ id: string }>) =>
  partie.colonnes.map((c) => (typeof c === "string" ? [c, c.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)] : c));

// ——— Fichiers ———————————————————————————————————————————————————————————————————————————————

/** Chemin de chaque fichier connu, par dossier puis par valeur de la fiche (lien signé ou contenu). */
const chemins = new Map<string, Map<string, string>>();
/** Fichiers choisis sur ce poste, pas encore déposés : « espace/chemin » → contenu. */
const aDeposer = new Map<string, string>();
/** Liens signés obtenus, réutilisés tant qu'il leur reste plus d'une heure (le chargement est
 * refait à chaque renouvellement du jeton, toutes les heures). */
const liensSignes = new Map<string, { url: string; expire: number }>();
/** Contenu des fichiers téléchargés : un chemin désigne toujours le même fichier. */
const contenus = new Map<string, string>();
const DUREE_LIEN_S = 6 * 3600;

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" };
const typeDe = (dataUrl: string) => /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? "application/octet-stream";

function nouvelIdentifiant(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function retenirChemin(dossier: string, valeur: string, chemin: string): void {
  if (!chemins.has(dossier)) chemins.set(dossier, new Map());
  chemins.get(dossier)!.set(valeur, chemin);
}

/** Chemin à enregistrer pour la valeur d'un champ fichier ; un fichier choisi sur le poste reçoit
 * un nouveau chemin et attend d'être déposé. */
function cheminDuFichier(fichier: ChampFichier<Fiche>, fiche: Fiche, valeur: unknown): string | null {
  if (typeof valeur !== "string" || valeur === "") return null;
  const dossier = fichier.dossier(fiche);
  const connuIci = chemins.get(dossier)?.get(valeur);
  if (connuIci) return connuIci;
  if (valeur.startsWith("data:")) {
    const chemin = `${dossier}${nouvelIdentifiant()}.${EXTENSIONS[typeDe(valeur)] ?? "bin"}`;
    retenirChemin(dossier, valeur, chemin);
    aDeposer.set(`${fichier.espace}/${chemin}`, valeur);
    return chemin;
  }
  // Lien signé d'une session précédente : il porte son chemin.
  const lien = /\/object\/sign\/([^/]+)\/([^?]+)/.exec(valeur);
  return lien && lien[1] === fichier.espace ? decodeURIComponent(lien[2]) : null;
}

function enBlob(dataUrl: string): Blob {
  const virgule = dataUrl.indexOf(",");
  const entete = dataUrl.slice(0, virgule);
  const corps = dataUrl.slice(virgule + 1);
  if (!entete.endsWith(";base64")) return new Blob([decodeURIComponent(corps)], { type: typeDe(dataUrl) });
  const binaire = atob(corps);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return new Blob([octets], { type: typeDe(dataUrl) });
}

function enDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsDataURL(blob);
  });
}

/** Refus de l'espace de fichiers, rendu lisible par motifRefus. */
function refusFichier(erreur: { message?: string; statusCode?: string | number }): { code: string; message: string } {
  const texte = `${erreur.statusCode ?? ""} ${erreur.message ?? ""}`;
  if (/row-level security|unauthorized|403/i.test(texte)) return { code: "42501", message: erreur.message ?? "" };
  if (/maximum allowed size|too large|413/i.test(texte)) return { code: "fichier", message: "fichier trop lourd." };
  if (/mime|not supported|415/i.test(texte)) {
    return { code: "fichier", message: "ce type de fichier n'est pas accepté (images JPEG, PNG, WebP ou GIF ; PDF pour les pièces)." };
  }
  return { code: "fichier", message: erreur.message ?? "dépôt impossible." };
}

export function versLigne(partie: PartieMiroir<{ id: string }>, fiche: Fiche): Ligne {
  const ligne: Ligne = {};
  for (const [champ, colonne] of champsEtColonnes(partie)) {
    const valeur = fiche[champ];
    const fichier = partie.fichiers?.[champ];
    if (fichier) ligne[colonne] = cheminDuFichier(fichier as ChampFichier<Fiche>, fiche, valeur);
    else ligne[colonne] = valeur === undefined || (valeur === "" && partie.nulSiVide?.includes(champ)) ? (partie.defauts?.[champ] ?? null) : valeur;
  }
  return ligne;
}

/** Ligne de la base → fiche ; les champs propres au navigateur (compteurs calculés) de la fiche
 * existante sont gardés. Un champ fichier reçoit ce que donne « affichage » pour son chemin. */
export function depuisLigne(partie: PartieMiroir<{ id: string }>, ligne: Ligne, existante?: Fiche, affichage?: ReadonlyMap<string, string>): Fiche {
  const fiche: Fiche = { ...(existante ?? {}), id: String(ligne.id) };
  for (const [champ, colonne] of champsEtColonnes(partie)) {
    const valeur = ligne[colonne];
    const fichier = partie.fichiers?.[champ];
    if (fichier) fiche[champ] = typeof valeur === "string" ? affichage?.get(`${fichier.espace}/${valeur}`) ?? valeur : undefined;
    else fiche[champ] = valeur === null ? (partie.nulSiVide?.includes(champ) ? "" : undefined) : valeur;
  }
  // Identifiant toujours en texte, même numéroté par la base (notifications).
  fiche.id = String(ligne.id);
  return fiche;
}

const miroirs: Miroir[] = [];
/** Dernier état connu de la base, par table puis par id (ligne sérialisée). */
const connu = new Map<string, Map<string, string>>();
let pret = false;
/** Vrai pendant qu'un store reprend le contenu de la base ou se complète lui-même : ces
 * enregistrements-là ne partent pas. */
let enRemplacement = false;
let file: Promise<void> = Promise.resolve();

export function enregistrerMiroir(miroir: Miroir): void {
  miroirs.push(miroir);
}

/** Message lisible pour un refus de la base. */
export function motifRefus(erreur: { code?: string; message?: string }): string {
  // Refus rédigé par la base elle-même (année clôturée, filière qui a déjà un règlement…).
  if (erreur.message && /^(23|P0)/.test(erreur.code ?? "") && !/violates|permission denied/i.test(erreur.message)) {
    return `La base a refusé : ${erreur.message} L'écran a été remis à jour.`;
  }
  switch (erreur.code) {
    case "fichier":
      return `La base a refusé le fichier : ${erreur.message} L'écran a été remis à jour.`;
    case "23503":
      return "La base a refusé : cet élément est encore utilisé par d'autres données (ou dépend d'un élément absent). L'écran a été remis à jour.";
    case "42501":
      return "Vous n'avez pas le droit de modifier ces données. L'écran a été remis à jour.";
    case "23505":
      return "La base a refusé : cet élément existe déjà (enregistré depuis un autre poste ?). L'écran a été remis à jour.";
    case "23P01": {
      const conflit = /salle_libre/.test(erreur.message ?? "") ? "la salle est déjà occupée"
        : /professeur_libre/.test(erreur.message ?? "") ? "le professeur a déjà cours"
        : /classe_libre/.test(erreur.message ?? "") ? "la classe a déjà cours"
        : "le créneau est déjà pris";
      return `La base a refusé : ${conflit} sur ce créneau (enregistré depuis un autre poste ?). L'écran a été remis à jour.`;
    }
    case "23514":
    case "23502":
      return "La base a refusé une valeur hors des limites autorisées. L'écran a été remis à jour.";
    default:
      return erreur.message ? `La base a refusé l'enregistrement : ${erreur.message}` : "La base a refusé l'enregistrement. L'écran a été remis à jour.";
  }
}

function client() {
  if (!supabase) throw new Error("La base de données n'est pas configurée.");
  return supabase;
}

/** Toutes les lignes d'une table (par pages : la base en renvoie au plus 1 000 à la fois). */
async function toutLire(table: string): Promise<Ligne[]> {
  const lignes: Ligne[] = [];
  const page = 1000;
  for (let debut = 0; ; debut += page) {
    const { data, error } = await client().from(table).select("*").order("id").range(debut, debut + page - 1);
    if (error) throw error;
    lignes.push(...((data ?? []) as Ligne[]));
    if (!data || data.length < page) return lignes;
  }
}

/** Ce que les fiches affichent pour les fichiers de ces lignes : un lien signé, ou le contenu pour
 * ce qui s'imprime. Un fichier introuvable garde son chemin (la fiche ne le perd pas). */
async function preparerFichiers(partie: PartieMiroir<{ id: string }>, lignes: Ligne[]): Promise<Map<string, string>> {
  const affichage = new Map<string, string>();
  for (const [champ, colonne] of champsEtColonnes(partie)) {
    const fichier = partie.fichiers?.[champ];
    if (!fichier) continue;
    const cheminsUtiles = [...new Set(lignes.map((l) => l[colonne]).filter((c): c is string => typeof c === "string" && c !== ""))];
    if (cheminsUtiles.length === 0) continue;
    const espace = client().storage.from(fichier.espace);
    if (fichier.forme === "donnees") {
      for (const chemin of cheminsUtiles) {
        const cle = `${fichier.espace}/${chemin}`;
        if (!contenus.has(cle)) {
          const { data, error } = await espace.download(chemin);
          if (error || !data) continue;
          contenus.set(cle, await enDataUrl(data));
        }
        affichage.set(cle, contenus.get(cle)!);
      }
      continue;
    }
    const maintenant = Date.now();
    const aSigner = cheminsUtiles.filter((c) => (liensSignes.get(`${fichier.espace}/${c}`)?.expire ?? 0) - maintenant < 3600_000);
    for (let i = 0; i < aSigner.length; i += 500) {
      const { data, error } = await espace.createSignedUrls(aSigner.slice(i, i + 500), DUREE_LIEN_S);
      if (error) throw error;
      for (const lien of data ?? []) {
        if (lien.path && lien.signedUrl) liensSignes.set(`${fichier.espace}/${lien.path}`, { url: lien.signedUrl, expire: maintenant + DUREE_LIEN_S * 1000 });
      }
    }
    for (const chemin of cheminsUtiles) {
      const lien = liensSignes.get(`${fichier.espace}/${chemin}`);
      if (lien) affichage.set(`${fichier.espace}/${chemin}`, lien.url);
    }
  }
  return affichage;
}

/** Recharge une table dans son store. « garde » est vérifiée juste avant de remplacer le store :
 * fausse (modification locale survenue pendant la lecture), le store n'est pas touché. */
async function chargerPartie(partie: PartieMiroir<{ id: string }>, garde?: () => boolean): Promise<boolean> {
  const lignes = await toutLire(partie.table);
  const affichage = await preparerFichiers(partie, lignes);
  if (garde && !garde()) return false;
  chargements.set(partie.table, { le: Date.now(), lignes: lignes.length });
  const existantes = new Map(partie.lire().map((f) => [f.id, f as Fiche]));
  const fiches = lignes.map((l) => depuisLigne(partie, l, existantes.get(String(l.id)), affichage));
  fiches.forEach((f, i) => {
    for (const [champ, colonne] of champsEtColonnes(partie)) {
      const fichier = partie.fichiers?.[champ];
      const chemin = lignes[i][colonne];
      if (fichier && typeof chemin === "string" && typeof f[champ] === "string") retenirChemin(fichier.dossier(f), f[champ] as string, chemin);
    }
  });
  connu.set(partie.table, new Map(fiches.map((f) => [f.id, JSON.stringify(versLigne(partie, f))])));
  sansEnvoi(() => partie.remplacer(fiches as { id: string }[]));
  return true;
}

/** Recharge les tables d'un miroir, à partir de la partie « depuis » (les suivantes complètent
 * les précédentes : elles sont rechargées avec elles). */
async function chargerMiroir(miroir: Miroir, depuis = 0, garde?: () => boolean): Promise<boolean> {
  for (const partie of miroir.parties.slice(depuis)) {
    if (!(await chargerPartie(partie, garde))) return false;
  }
  return true;
}

/** Exécute fn sans que ses enregistrements partent vers la base : compléments que l'application
 * calcule à l'identique sur chaque poste (configuration d'une nouvelle filière…). Ils partent avec
 * le prochain enregistrement de ce store par un compte qui en a le droit. */
export function sansEnvoi<T>(fn: () => T): T {
  const avant = enRemplacement;
  enRemplacement = true;
  try {
    return fn();
  } finally {
    enRemplacement = avant;
  }
}

/** Avant le premier chargement depuis la base, les données de ce navigateur sont mises de côté
 * (une seule fois par store, y compris pour un store reflété plus tard) : rien de ce qui a été
 * saisi hors ligne n'est perdu. */
function sauvegarderUneFois(): void {
  const CLE = "edumanage-sauvegarde-avant-supabase-v1";
  try {
    const sauvegarde = (JSON.parse(localStorage.getItem(CLE) ?? "null") as { le: string; donnees: Record<string, string | null> } | null)
      ?? { le: new Date().toISOString(), donnees: {} };
    const nouvelles = [...new Set(miroirs.map((m) => m.cle))].filter((cle) => !(cle in sauvegarde.donnees));
    if (nouvelles.length === 0) return;
    for (const cle of nouvelles) sauvegarde.donnees[cle] = localStorage.getItem(cle);
    localStorage.setItem(CLE, JSON.stringify(sauvegarde));
  } catch {
    // stockage plein : la sauvegarde est sautée, le chargement continue
  }
}

/** Remplit tous les stores reflétés avec le contenu de la base. À appeler à la connexion ;
 * rejette si la base est injoignable (les modifications ne partent alors pas). */
export async function chargerMiroirs(): Promise<void> {
  if (!modeSupabase) return;
  // Les modifications déjà parties arrivent d'abord : le chargement ne les écrase pas.
  await file;
  pret = false;
  sauvegarderUneFois();
  // Compteurs lus avant les tables : ce qui change pendant le chargement sera vu au tour suivant.
  const compteurs = await lireCompteurs();
  for (const miroir of miroirs) await chargerMiroir(miroir);
  versions.clear();
  Object.entries(compteurs ?? {}).forEach(([table, version]) => versions.set(table, version));
  pret = true;
  demarrerSuivi();
}

/** Fin de session : plus rien ne part tant qu'un nouveau chargement n'a pas eu lieu. */
export function arreterMiroirs(): void {
  pret = false;
  if (minuterie !== undefined) clearInterval(minuterie);
  minuterie = undefined;
}

// ——— Suivi des changements faits ailleurs ————————————————————————————————————————————————————
// La base tient un compteur de changements par table (versions_donnees). Toutes les 30 secondes
// (et au retour sur l'onglet), le poste compare ces compteurs aux siens et recharge les tables qui
// ont changé : un pointage créé par la base, une notification, un cahier validé ailleurs…

export const INTERVALLE_SUIVI_MS = 30_000;
/** Compteur de chaque table au dernier chargement de ce poste. */
const versions = new Map<string, number>();
/** Dernier chargement de chaque table et son nombre de lignes. */
const chargements = new Map<string, { le: number; lignes: number }>();
let minuterie: ReturnType<typeof setInterval> | undefined;

async function lireCompteurs(): Promise<Record<string, number> | undefined> {
  try {
    const { data, error } = await client().rpc("versions_donnees");
    return !error && data && typeof data === "object" ? (data as Record<string, number>) : undefined;
  } catch {
    return undefined;
  }
}

/** Une grosse table (l'appel de toute l'université pour l'administration…) se recharge au plus
 * toutes les quelques minutes : au-delà de 1 000 lignes, 10 ms par ligne, jamais plus de 10 minutes. */
function rechargeableMaintenant(table: string, maintenant: number): boolean {
  const dernier = chargements.get(table);
  return !dernier || dernier.lignes < 1000 || maintenant - dernier.le >= Math.min(600_000, dernier.lignes * 10);
}

/** Recharge les tables que d'autres postes, ou la base elle-même, ont changées. Un miroir qui a
 * des modifications pas encore parties attend leur envoi (rien de ce qui est saisi n'est écrasé). */
export function verifierChangements(): Promise<void> {
  if (!modeSupabase) return Promise.resolve();
  file = file.then(async () => {
    if (!pret) return;
    const compteurs = await lireCompteurs();
    if (!compteurs) return;
    const maintenant = Date.now();
    for (const miroir of miroirs) {
      if (modifiees.has(miroir.cle)) continue;
      const depuis = miroir.parties.findIndex((p) => (compteurs[p.table] ?? 0) !== (versions.get(p.table) ?? 0));
      if (depuis < 0) continue;
      const parties = miroir.parties.slice(depuis);
      if (!parties.every((p) => rechargeableMaintenant(p.table, maintenant))) continue;
      try {
        if (await chargerMiroir(miroir, depuis, () => !modifiees.has(miroir.cle))) {
          parties.forEach((p) => versions.set(p.table, compteurs[p.table] ?? 0));
        }
      } catch {
        // base injoignable : le prochain tour recommencera
      }
    }
  });
  return file;
}

function demarrerSuivi(): void {
  if (typeof window === "undefined" || minuterie !== undefined) return;
  minuterie = setInterval(() => {
    if (document.visibilityState !== "hidden") void verifierChangements();
  }, INTERVALLE_SUIVI_MS);
}

if (typeof document !== "undefined" && modeSupabase) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && minuterie !== undefined) void verifierChangements();
  });
}

/** Clés enregistrées depuis le dernier envoi. */
const modifiees = new Set<string>();

/** Dépose les fichiers choisis sur ce poste que ces lignes désignent. */
/** Dépose les nouveaux fichiers de ces lignes, ajoutés au fur et à mesure à « deposes ». */
async function deposerFichiers(partie: PartieMiroir<{ id: string }>, lignes: Ligne[], deposes: { espace: string; chemin: string }[]): Promise<void> {
  for (const [champ, colonne] of champsEtColonnes(partie)) {
    const fichier = partie.fichiers?.[champ];
    if (!fichier) continue;
    for (const ligne of lignes) {
      const chemin = ligne[colonne];
      const cle = `${fichier.espace}/${chemin}`;
      const contenu = typeof chemin === "string" ? aDeposer.get(cle) : undefined;
      if (contenu === undefined) continue;
      const { error } = await client().storage.from(fichier.espace).upload(chemin as string, enBlob(contenu), { contentType: typeDe(contenu), upsert: false });
      // Déjà déposé (envoi précédent interrompu juste après) : c'est le même fichier.
      if (error && !/already exists|duplicate/i.test(error.message ?? "")) throw refusFichier(error as { message?: string; statusCode?: string });
      aDeposer.delete(cle);
      deposes.push({ espace: fichier.espace, chemin: chemin as string });
      if (fichier.forme === "donnees") contenus.set(cle, contenu);
    }
  }
}

/** Fichiers qu'une ligne désignait et ne désigne plus (photo remplacée, pièce refusée…). */
function fichiersQuittes(partie: PartieMiroir<{ id: string }>, avant: string | undefined, apres?: Ligne): { espace: string; chemin: string }[] {
  if (!partie.fichiers || !avant) return [];
  const ancienne = JSON.parse(avant) as Ligne;
  const colonnes = champsEtColonnes(partie).filter(([champ]) => partie.fichiers?.[champ]);
  const gardes = new Set(colonnes.map(([, colonne]) => apres?.[colonne]).filter(Boolean));
  return colonnes.flatMap(([champ, colonne]) => {
    const chemin = ancienne[colonne];
    return typeof chemin === "string" && !gardes.has(chemin) ? [{ espace: partie.fichiers![champ].espace, chemin }] : [];
  });
}

async function mettreAJour(table: string, ligne: Ligne): Promise<void> {
  const { id, ...valeurs } = ligne;
  const { data, error } = await client().from(table).update(valeurs).eq("id", id).select("id");
  if (error) throw error;
  // Une ligne que les règles d'accès ne laissent pas modifier n'est simplement pas touchée.
  if (!data?.length) throw { code: "42501" };
}

/** Envoie tout ce qui a changé, dans l'ordre des liens (ordre d'enregistrement des miroirs : les
 * parents d'abord), puis les suppressions à l'envers. Une action qui touche plusieurs stores
 * (ouvrir l'année suivante crée l'année puis ses classes) part donc dans le bon ordre. */
async function envoyer(): Promise<void> {
  if (modifiees.size === 0) return;
  const lot = miroirs.filter((m) => modifiees.has(m.cle));
  modifiees.clear();
  const parties = lot.flatMap((m) => m.parties).filter((p) => !p.lectureSeule).map((partie) => {
    const fiches = partie.lire();
    const lignes = fiches.filter((f) => !partie.envoyable || partie.envoyable(f)).map((f) => versLigne(partie, f as Fiche));
    return { partie, lignes, ids: new Set(fiches.map((f) => f.id)) };
  });
  /** Lignes ajoutées ou modifiées dans cet envoi, par table. */
  const envoyees = new Map<string, Set<string>>();
  /** Fichiers que plus rien ne désigne, retirés une fois l'envoi réussi. */
  const aRetirer: { espace: string; chemin: string }[] = [];
  /** Fichiers déposés dont la ligne n'est pas encore enregistrée : retirés si l'envoi est refusé. */
  const enSuspens: { espace: string; chemin: string }[] = [];
  try {
    for (const { partie, lignes } of parties) {
      const etat = connu.get(partie.table) ?? new Map<string, string>();
      const principales = partie.complementDe ? envoyees.get(partie.complementDe) : undefined;
      const changees = lignes.filter((l) => etat.get(String(l.id)) !== JSON.stringify(l)
        && (!partie.complementDe || etat.has(String(l.id)) || !!principales?.has(String(l.id))));
      envoyees.set(partie.table, new Set(changees.map((l) => String(l.id))));
      if (partie.ordreEnvoi) changees.sort(partie.ordreEnvoi);
      const retenir = (l: Ligne) => {
        aRetirer.push(...fichiersQuittes(partie, etat.get(String(l.id)), l));
        etat.set(String(l.id), JSON.stringify(l));
        // Ses fichiers sont désormais désignés par une ligne enregistrée.
        const valeurs = new Set(Object.values(l));
        for (let k = enSuspens.length - 1; k >= 0; k--) if (valeurs.has(enSuspens[k].chemin)) enSuspens.splice(k, 1);
      };
      if (partie.miseAJourSeule) {
        await deposerFichiers(partie, changees, enSuspens);
        const modifiables = partie.champsModifiables
          && new Set(champsEtColonnes(partie).filter(([champ]) => partie.champsModifiables!.includes(champ)).map(([, colonne]) => colonne));
        for (const ligne of changees) {
          await mettreAJour(partie.table, modifiables ? Object.fromEntries(Object.entries(ligne).filter(([c]) => c === "id" || modifiables.has(c))) : ligne);
          retenir(ligne);
        }
        connu.set(partie.table, etat);
        continue;
      }
      // Par paquets (un import de maquette peut compter des centaines d'EC).
      for (let i = 0; i < changees.length; i += 500) {
        const paquet = changees.slice(i, i + 500);
        await deposerFichiers(partie, paquet, enSuspens);
        const { error } = await client().from(partie.table).upsert(paquet, { onConflict: "id" });
        if (error) {
          // Un compte qui ne crée pas de lignes dans cette table modifie les siennes (l'étudiant son
          // dossier, le professeur le sien) : simple mise à jour des lignes déjà en base.
          if (error.code !== "42501" || paquet.some((l) => !etat.has(String(l.id)))) throw error;
          for (const ligne of paquet) {
            await mettreAJour(partie.table, ligne);
            retenir(ligne);
          }
        } else {
          paquet.forEach(retenir);
        }
      }
      connu.set(partie.table, etat);
    }
    for (const { partie, ids } of [...parties].reverse()) {
      if (partie.miseAJourSeule) continue;
      const etat = connu.get(partie.table) ?? new Map<string, string>();
      const supprimees = [...etat.keys()].filter((id) => !ids.has(id));
      if (supprimees.length === 0) continue;
      const { error } = await client().from(partie.table).delete().in("id", supprimees);
      if (error) throw error;
      supprimees.forEach((id) => {
        aRetirer.push(...fichiersQuittes(partie, etat.get(id)));
        etat.delete(id);
      });
    }
    await retirerFichiers(aRetirer);
  } catch (erreur) {
    // Un fichier déposé pour une ligne refusée ne reste pas dans l'espace de fichiers.
    if (enSuspens.length > 0) await retirerFichiers(enSuspens);
    const e = erreur as { code?: string; message?: string };
    window.dispatchEvent(new CustomEvent(EVENEMENT_REFUS_SERVEUR, { detail: { message: motifRefus(e) } }));
    // Les stores concernés reprennent l'état de la base.
    for (const miroir of lot) {
      try {
        await chargerMiroir(miroir);
      } catch {
        // base injoignable : le prochain chargement recalera
      }
    }
  }
}

/** Retire de l'espace de fichiers ce que plus rien ne désigne, quand le compte en a le droit (un
 * étudiant ne retire pas la pièce qu'il a déposée) ; un échec laisse simplement le fichier. */
async function retirerFichiers(fichiers: { espace: string; chemin: string }[]): Promise<void> {
  for (const espace of new Set(fichiers.map((f) => f.espace))) {
    try {
      await client().storage.from(espace).remove(fichiers.filter((f) => f.espace === espace).map((f) => f.chemin));
    } catch {
      // fichier laissé en place
    }
  }
}

if (typeof window !== "undefined" && modeSupabase) {
  observerEcritures((cle) => {
    if (!pret || enRemplacement || !miroirs.some((m) => m.cle === cle)) return;
    modifiees.add(cle);
    file = file.then(envoyer);
  });
}

/** Recharge depuis la base, après les envois en cours, les stores de cette clé : ce que la base
 * vient d'écrire elle-même (ex. le pointage créé à la validation d'un cahier) arrive à l'écran. */
export function rechargerApres(cle: string): Promise<void> {
  if (!modeSupabase) return Promise.resolve();
  file = file.then(async () => {
    if (!pret) return;
    for (const miroir of miroirs.filter((m) => m.cle === cle)) {
      try {
        await chargerMiroir(miroir);
      } catch {
        // base injoignable : le prochain chargement recalera
      }
    }
  });
  return file;
}

/** Attend que toutes les modifications parties soient arrivées (tests, fermeture de session). */
export function attendreEnvois(): Promise<void> {
  return file;
}
