import { FILIERES, NIVEAUX } from "./mockData";
import { getClasses } from "./structureStore";
import type { EtudiantRecord } from "./studentStore";

const STORAGE_KEY = "edumanage-communication-groups-v1";

export interface ContactExterne {
  intitule: string;
  telephone: string;
  email: string;
}

export interface GroupeExterneRecord {
  id: string;
  nom: string;
  code: string;
  contacts: ContactExterne[];
}

export type TypeGroupeInterne = "programme" | "niveau" | "classe";

export interface GroupeInterneRecord {
  id: string;
  nom: string;
  type: TypeGroupeInterne;
  /** filiereId (programme/niveau) ou classeId (classe) selon le type. */
  refId: string;
  /** Alias de niveau — uniquement pour type "niveau", pour ne pas confondre avec refId (filiereId). */
  niveauAlias?: string;
  annee: string;
}

export type ChampRegleGroupe = "filiereId" | "niveau" | "classeId" | "statut" | "soldeDu";
export type OperateurRegleGroupe = "egal" | "different" | "superieurA" | "inferieurA";

export interface RegleGroupePersonnalise {
  champ: ChampRegleGroupe;
  operateur: OperateurRegleGroupe;
  valeur: string;
}

export interface GroupePersonnaliseRecord {
  id: string;
  nom: string;
  description: string;
  regles: RegleGroupePersonnalise[];
}

interface Persisted {
  externes: GroupeExterneRecord[];
  internes: GroupeInterneRecord[];
  personnalises: GroupePersonnaliseRecord[];
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function load(): Persisted {
  if (typeof window === "undefined") return { externes: [], internes: [], personnalises: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { externes: [], internes: [], personnalises: [] };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      externes: parsed.externes ?? [],
      internes: parsed.internes ?? [],
      personnalises: parsed.personnalises ?? [],
    };
  } catch {
    return { externes: [], internes: [], personnalises: [] };
  }
}

let store: Persisted = load();

function persist() {
  store = { externes: store.externes.slice(), internes: store.internes.slice(), personnalises: store.personnalises.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeCommunicationGroups(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ===== Groupes externes =====

export function getGroupesExternes(): GroupeExterneRecord[] {
  return store.externes;
}

export interface GroupeExternePayload {
  nom: string;
  code: string;
  contacts: ContactExterne[];
}

export function upsertGroupeExterne(payload: GroupeExternePayload, id?: string): GroupeExterneRecord {
  const existing = id ? store.externes.find((g) => g.id === id) : undefined;
  if (existing) {
    Object.assign(existing, payload);
    persist();
    return existing;
  }
  const record: GroupeExterneRecord = { id: `grp-ext-${Date.now()}`, ...payload };
  store.externes.unshift(record);
  persist();
  return record;
}

export function deleteGroupeExterne(id: string): void {
  store.externes = store.externes.filter((g) => g.id !== id);
  persist();
}

// ===== Groupes internes — générés en live depuis la vraie structure académique =====

/** Crée un groupe interne par programme/niveau/classe réellement présent dans les classes de
 * l'année donnée — jamais une liste figée, toujours dérivée de la structure académique réelle. */
export function genererGroupesInternes(annee: string, options: { programmes: boolean; niveaux: boolean; classes: boolean }): number {
  const classes = getClasses().filter((c) => c.annee === annee);
  let nbCrees = 0;

  if (options.programmes) {
    const filiereIds = new Set(classes.map((c) => c.filiereId));
    for (const filiereId of filiereIds) {
      const filiere = FILIERES.find((f) => f.id === filiereId);
      if (!filiere) continue;
      const existe = store.internes.some((g) => g.type === "programme" && g.refId === filiereId && g.annee === annee);
      if (existe) continue;
      store.internes.push({ id: `grp-int-${Date.now()}-${filiereId}`, nom: `${filiere.nom} — ${annee}`, type: "programme", refId: filiereId, annee });
      nbCrees += 1;
    }
  }

  if (options.niveaux) {
    const combos = new Set(classes.map((c) => `${c.filiereId}::${c.niveau}`));
    for (const combo of combos) {
      const [filiereId, niveauAlias] = combo.split("::");
      const filiere = FILIERES.find((f) => f.id === filiereId);
      const niveau = NIVEAUX.find((n) => n.filiereId === filiereId && n.alias === niveauAlias);
      if (!filiere || !niveau) continue;
      const existe = store.internes.some((g) => g.type === "niveau" && g.refId === filiereId && g.niveauAlias === niveauAlias && g.annee === annee);
      if (existe) continue;
      store.internes.push({ id: `grp-int-${Date.now()}-${filiereId}-${niveauAlias}`, nom: `${filiere.code} ${niveau.nom} — ${annee}`, type: "niveau", refId: filiereId, niveauAlias, annee });
      nbCrees += 1;
    }
  }

  if (options.classes) {
    for (const classe of classes) {
      const existe = store.internes.some((g) => g.type === "classe" && g.refId === classe.id && g.annee === annee);
      if (existe) continue;
      store.internes.push({ id: `grp-int-${Date.now()}-${classe.id}`, nom: `${classe.nom} — ${annee}`, type: "classe", refId: classe.id, annee });
      nbCrees += 1;
    }
  }

  persist();
  return nbCrees;
}

export function supprimerGroupesInternes(annee: string): number {
  const avant = store.internes.length;
  store.internes = store.internes.filter((g) => g.annee !== annee);
  persist();
  return avant - store.internes.length;
}

export function getGroupesInternes(): GroupeInterneRecord[] {
  return store.internes;
}

/** Résout les membres réels d'un groupe interne — toujours recalculé depuis les vrais étudiants,
 * jamais une liste d'ids figée qui pourrait devenir obsolète après une réinscription/un transfert. */
export function resolveMembresGroupeInterne(groupe: GroupeInterneRecord, etudiants: EtudiantRecord[]): EtudiantRecord[] {
  return etudiants.filter((e) => {
    if (e.annee !== groupe.annee) return false;
    if (groupe.type === "classe") return e.classeId === groupe.refId;
    if (groupe.type === "programme") return e.filiereId === groupe.refId;
    return e.filiereId === groupe.refId && e.niveau === groupe.niveauAlias;
  });
}

// ===== Groupes personnalisés — constructeur de règles (remplace la requête SQL de la référence) =====

export function getGroupesPersonnalises(): GroupePersonnaliseRecord[] {
  return store.personnalises;
}

export interface GroupePersonnalisePayload {
  nom: string;
  description: string;
  regles: RegleGroupePersonnalise[];
}

export function upsertGroupePersonnalise(payload: GroupePersonnalisePayload, id?: string): GroupePersonnaliseRecord {
  const existing = id ? store.personnalises.find((g) => g.id === id) : undefined;
  if (existing) {
    Object.assign(existing, payload);
    persist();
    return existing;
  }
  const record: GroupePersonnaliseRecord = { id: `grp-perso-${Date.now()}`, ...payload };
  store.personnalises.unshift(record);
  persist();
  return record;
}

export function deleteGroupePersonnalise(id: string): void {
  store.personnalises = store.personnalises.filter((g) => g.id !== id);
  persist();
}

function evaluerRegle(etudiant: EtudiantRecord, regle: RegleGroupePersonnalise): boolean {
  const champVal: string | number =
    regle.champ === "soldeDu" ? etudiant.soldeDu
      : regle.champ === "filiereId" ? etudiant.filiereId
      : regle.champ === "classeId" ? etudiant.classeId
      : regle.champ === "niveau" ? etudiant.niveau
      : etudiant.statut;

  if (regle.champ === "soldeDu") {
    const seuil = Number(regle.valeur);
    const val = Number(champVal);
    if (regle.operateur === "superieurA") return val > seuil;
    if (regle.operateur === "inferieurA") return val < seuil;
    if (regle.operateur === "egal") return val === seuil;
    return val !== seuil;
  }

  if (regle.operateur === "egal") return champVal === regle.valeur;
  if (regle.operateur === "different") return champVal !== regle.valeur;
  return String(champVal).localeCompare(regle.valeur) > 0 === (regle.operateur === "superieurA");
}

/** Toutes les règles doivent être vérifiées (ET) — combinaison simple et prévisible, calculée sur
 * les vrais étudiants à chaque consultation (jamais un instantané qui se périme). */
export function resolveMembresGroupePersonnalise(regles: RegleGroupePersonnalise[], etudiants: EtudiantRecord[]): EtudiantRecord[] {
  if (regles.length === 0) return [];
  return etudiants.filter((e) => regles.every((r) => evaluerRegle(e, r)));
}
