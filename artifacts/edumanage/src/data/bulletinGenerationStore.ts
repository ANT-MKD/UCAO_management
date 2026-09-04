import { computeBulletin } from "./bulletinEngine";
import { upsertReleve } from "./studentStore";
import { detecterDeclassementEtudiant, type RaisonDeclassement } from "./declassementEngine";

const STORAGE_KEY = "edumanage-bulletin-generation-store-v1";

export interface EtudiantConcerneGeneration {
  etudiantId: string;
  etudiant: string;
  matricule: string;
  statut: "succes" | "echec" | "a_declasser";
  motifEchec?: string;
  /** Détail des EC/type d'évaluation insuffisamment notés — présent uniquement si statut est "a_declasser". */
  raisonsDeclassement?: RaisonDeclassement[];
  /** Relevé réellement créé/mis à jour pour cet étudiant — absent si échec ou à déclasser : un
   * bulletin officiel n'est jamais émis pour un étudiant insuffisamment noté. */
  releveId?: string;
}

export interface BulletinGenerationRecord {
  id: string;
  numero: string;
  filiereId: string;
  filiere: string;
  annee: string;
  niveau: string;
  niveauLabel: string;
  classeId: string;
  classe: string;
  semestreId: string;
  semestre: string;
  effectueLe: string;
  effectuePar: string;
  statut: "succes" | "echec" | "partiel";
  nbSucces: number;
  nbEchec: number;
  nbDeclasses: number;
  etudiantsConcernes: EtudiantConcerneGeneration[];
}

interface Persisted {
  generations: BulletinGenerationRecord[];
  compteur: number;
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): Persisted {
  if (typeof window === "undefined") return { generations: [], compteur: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { generations: [], compteur: 0 };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return { generations: parsed.generations ?? [], compteur: parsed.compteur ?? 0 };
  } catch {
    return { generations: [], compteur: 0 };
  }
}

let store: Persisted = load();

function persist() {
  store = { ...store, generations: store.generations.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeBulletinGenerations(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getGenerations(): BulletinGenerationRecord[] {
  return store.generations;
}

export function getGenerationById(id: string): BulletinGenerationRecord | undefined {
  return store.generations.find((g) => g.id === id);
}

function nextNumero(): string {
  store.compteur += 1;
  const annee = new Date().getFullYear();
  return `GB-${annee}-${String(store.compteur).padStart(3, "0")}`;
}

export interface GenerationEtudiantInput {
  id: string;
  prenom: string;
  nom: string;
  matricule: string;
  classeId: string;
  classe: string;
}

export interface CreerGenerationInput {
  filiereId: string;
  filiere: string;
  annee: string;
  niveauAlias: string;
  niveauLabel: string;
  classeId: string;
  classe: string;
  semestreId: string;
  semestreAlias: string;
  semestreLabel: string;
  etudiants: GenerationEtudiantInput[];
  effectuePar: string;
}

/** Lance une génération réelle : vérifie d'abord le déclassement (assez de notes du bon type pour
 * chaque EC, Paramétrage bulletins) puis appelle computeBulletin() pour chaque étudiant restant —
 * jamais de succès/échec fabriqué — et crée/actualise le relevé de chacun (upsertReleve, un seul
 * par étudiant et par semestre). Un étudiant à déclasser ou en échec n'obtient jamais de relevé
 * officiel. Échec = moyenneSession indéfinie (notes manquantes pour cette session), exactement le
 * même critère que resolveBulletin() dans Relevés & Bulletins. */
export function creerGeneration(input: CreerGenerationInput): BulletinGenerationRecord {
  const etudiantsConcernes: EtudiantConcerneGeneration[] = input.etudiants.map((e) => {
    const declassement = detecterDeclassementEtudiant(e.id, e.classeId, input.filiereId, input.niveauAlias, input.annee, input.semestreAlias);
    if (declassement) {
      return {
        etudiantId: e.id,
        etudiant: `${e.prenom} ${e.nom}`,
        matricule: e.matricule,
        statut: "a_declasser" as const,
        motifEchec: "Nombre de notes insuffisant pour un ou plusieurs éléments constitutifs",
        raisonsDeclassement: declassement.raisons,
      };
    }

    const bulletin = computeBulletin(e.id, e.classeId, input.filiereId, input.niveauAlias, input.semestreAlias);
    const succes = bulletin.moyenneSession !== undefined;
    let releveId: string | undefined;
    if (succes) {
      const releve = upsertReleve({
        etudiantId: e.id,
        etudiant: `${e.prenom} ${e.nom}`,
        matricule: e.matricule,
        classe: e.classe,
        filiere: input.filiere,
        semestreId: input.semestreId,
        semestre: input.semestreLabel,
        statut: "genere",
        annee: input.annee,
      });
      releveId = releve.id;
    }
    return {
      etudiantId: e.id,
      etudiant: `${e.prenom} ${e.nom}`,
      matricule: e.matricule,
      statut: succes ? ("succes" as const) : ("echec" as const),
      motifEchec: succes ? undefined : "Notes insuffisantes pour cette session",
      releveId,
    };
  });

  const nbSucces = etudiantsConcernes.filter((e) => e.statut === "succes").length;
  const nbDeclasses = etudiantsConcernes.filter((e) => e.statut === "a_declasser").length;
  const nbEchec = etudiantsConcernes.length - nbSucces - nbDeclasses;
  const statut: BulletinGenerationRecord["statut"] = nbEchec + nbDeclasses === 0 ? "succes" : nbSucces === 0 ? "echec" : "partiel";

  const record: BulletinGenerationRecord = {
    id: `gen-${Date.now()}`,
    numero: nextNumero(),
    filiereId: input.filiereId,
    filiere: input.filiere,
    annee: input.annee,
    niveau: input.niveauAlias,
    niveauLabel: input.niveauLabel,
    classeId: input.classeId,
    classe: input.classe,
    semestreId: input.semestreId,
    semestre: input.semestreLabel,
    effectueLe: new Date().toISOString(),
    effectuePar: input.effectuePar,
    statut,
    nbSucces,
    nbEchec,
    nbDeclasses,
    etudiantsConcernes,
  };
  store.generations.unshift(record);
  persist();
  return record;
}
