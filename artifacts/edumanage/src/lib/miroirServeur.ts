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

export interface PartieMiroir<R extends { id: string }> {
  /** Table de la base. */
  table: string;
  /** Champs de la fiche envoyés à la base (en camelCase ; la colonne est en snake_case). */
  colonnes: readonly string[];
  /** Valeur envoyée quand le champ est absent de la fiche (colonne obligatoire côté base). */
  defauts?: Readonly<Record<string, unknown>>;
  /** Fiches actuelles du store. */
  lire: () => R[];
  /** Remplace les fiches du store par celles de la base (au chargement ou après un refus). */
  remplacer: (fiches: R[]) => void;
  /** Ordre d'envoi des lignes modifiées (ex. l'année « actuelle » en dernier). */
  ordreEnvoi?: (a: Ligne, b: Ligne) => number;
}

export interface Miroir {
  /** Clé de stockage écrite par le store à chaque enregistrement. */
  cle: string;
  /** Tables alimentées par cette clé, les parents d'abord (envoyées dans cet ordre, supprimées à
   * l'envers). */
  parties: readonly PartieMiroir<{ id: string }>[];
}

export const EVENEMENT_REFUS_SERVEUR = "edumanage:refus-serveur";

const versColonne = (champ: string) => champ.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

export function versLigne(partie: PartieMiroir<{ id: string }>, fiche: Fiche): Ligne {
  const ligne: Ligne = {};
  for (const champ of partie.colonnes) {
    const valeur = fiche[champ];
    ligne[versColonne(champ)] = valeur === undefined ? (partie.defauts?.[champ] ?? null) : valeur;
  }
  return ligne;
}

/** Ligne de la base → fiche ; les champs propres au navigateur (compteurs calculés) de la fiche
 * existante sont gardés. */
export function depuisLigne(partie: PartieMiroir<{ id: string }>, ligne: Ligne, existante?: Fiche): Fiche {
  const fiche: Fiche = { ...(existante ?? {}), id: String(ligne.id) };
  for (const champ of partie.colonnes) {
    const valeur = ligne[versColonne(champ)];
    fiche[champ] = valeur === null ? undefined : valeur;
  }
  return fiche;
}

const miroirs = new Map<string, Miroir>();
/** Dernier état connu de la base, par table puis par id (ligne sérialisée). */
const connu = new Map<string, Map<string, string>>();
let pret = false;
/** Vrai pendant qu'un store reprend le contenu de la base : cet enregistrement-là ne repart pas. */
let enRemplacement = false;
let file: Promise<void> = Promise.resolve();

export function enregistrerMiroir(miroir: Miroir): void {
  miroirs.set(miroir.cle, miroir);
}

/** Message lisible pour un refus de la base. */
export function motifRefus(erreur: { code?: string; message?: string }): string {
  switch (erreur.code) {
    case "23503":
      return "La base a refusé : cet élément est encore utilisé par d'autres données (ou dépend d'un élément absent). L'écran a été remis à jour.";
    case "42501":
      return "Vous n'avez pas le droit de modifier ces données. L'écran a été remis à jour.";
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

async function chargerMiroir(miroir: Miroir): Promise<void> {
  for (const partie of miroir.parties) {
    const lignes = await toutLire(partie.table);
    const existantes = new Map(partie.lire().map((f) => [f.id, f as Fiche]));
    const fiches = lignes.map((l) => depuisLigne(partie, l, existantes.get(String(l.id))));
    connu.set(partie.table, new Map(fiches.map((f) => [f.id, JSON.stringify(versLigne(partie, f))])));
    enRemplacement = true;
    try {
      partie.remplacer(fiches as { id: string }[]);
    } finally {
      enRemplacement = false;
    }
  }
}

/** Avant le premier chargement depuis la base, les données de ce navigateur sont mises de côté
 * (une seule fois) : rien de ce qui a été saisi hors ligne n'est perdu. */
function sauvegarderUneFois(): void {
  const CLE = "edumanage-sauvegarde-avant-supabase-v1";
  try {
    if (localStorage.getItem(CLE)) return;
    const copie: Record<string, string | null> = {};
    for (const cle of miroirs.keys()) copie[cle] = localStorage.getItem(cle);
    localStorage.setItem(CLE, JSON.stringify({ le: new Date().toISOString(), donnees: copie }));
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
  for (const miroir of miroirs.values()) await chargerMiroir(miroir);
  pret = true;
}

/** Fin de session : plus rien ne part tant qu'un nouveau chargement n'a pas eu lieu. */
export function arreterMiroirs(): void {
  pret = false;
}

/** Clés enregistrées depuis le dernier envoi. */
const modifiees = new Set<string>();

/** Envoie tout ce qui a changé, dans l'ordre des liens (ordre d'enregistrement des miroirs : les
 * parents d'abord), puis les suppressions à l'envers. Une action qui touche plusieurs stores
 * (ouvrir l'année suivante crée l'année puis ses classes) part donc dans le bon ordre. */
async function envoyer(): Promise<void> {
  if (modifiees.size === 0) return;
  const lot = [...miroirs.values()].filter((m) => modifiees.has(m.cle));
  modifiees.clear();
  const parties = lot.flatMap((m) => m.parties).map((partie) => {
    const lignes = partie.lire().map((f) => versLigne(partie, f as Fiche));
    return { partie, lignes, ids: new Set(lignes.map((l) => String(l.id))) };
  });
  try {
    for (const { partie, lignes } of parties) {
      const etat = connu.get(partie.table) ?? new Map<string, string>();
      const changees = lignes.filter((l) => etat.get(String(l.id)) !== JSON.stringify(l));
      if (partie.ordreEnvoi) changees.sort(partie.ordreEnvoi);
      // Par paquets (un import de maquette peut compter des centaines d'EC).
      for (let i = 0; i < changees.length; i += 500) {
        const paquet = changees.slice(i, i + 500);
        const { error } = await client().from(partie.table).upsert(paquet, { onConflict: "id" });
        if (error) throw error;
        paquet.forEach((l) => etat.set(String(l.id), JSON.stringify(l)));
      }
      connu.set(partie.table, etat);
    }
    for (const { partie, ids } of [...parties].reverse()) {
      const etat = connu.get(partie.table) ?? new Map<string, string>();
      const supprimees = [...etat.keys()].filter((id) => !ids.has(id));
      if (supprimees.length === 0) continue;
      const { error } = await client().from(partie.table).delete().in("id", supprimees);
      if (error) throw error;
      supprimees.forEach((id) => etat.delete(id));
    }
  } catch (erreur) {
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

if (typeof window !== "undefined" && modeSupabase) {
  observerEcritures((cle) => {
    if (!pret || enRemplacement || !miroirs.has(cle)) return;
    modifiees.add(cle);
    file = file.then(envoyer);
  });
}

/** Attend que toutes les modifications parties soient arrivées (tests, fermeture de session). */
export function attendreEnvois(): Promise<void> {
  return file;
}
