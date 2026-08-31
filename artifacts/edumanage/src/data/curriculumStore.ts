import { UES as SEED_UES, ECS as SEED_ECS } from "./mockData";
import { getFiliereByCode } from "./filiereStore";

export interface UeRecord {
  id: string;
  code: string;
  libelle: string;
  credits: number;
  /** Coefficient de pondération de l'UE, distinct du crédit — utilisé par les méthodes de calcul
   * "coefficient" (Paramétrage bulletin). Optionnel : les méthodes qui en ont besoin retombent
   * sur `credits` si non renseigné. */
  coeff?: number;
  filiere: string;
  filiereId: string;
  niveau: string;
  semestre: string;
  /** Intitulé d'une catégorie configurée dans academicSettingsStore.ts (categorieCoursStore) */
  type: string;
  obligatoire: boolean;
  description?: string;
  nbEc: number;
}

export interface EcRecord {
  id: string;
  code: string;
  libelle: string;
  /** Intitulé abrégé, distinct du code (ex. code "1CPT1140", abrégé "ICPT") */
  abrege?: string;
  ue: string;
  ueId: string;
  coeff: number;
  credits: number;
  volCm: number;
  volTd: number;
  volTp: number;
  volTpe: number;
  vht: number;
  responsable: string;
  responsableId?: string;
}

interface CurriculumStore {
  ues: UeRecord[];
  ecs: EcRecord[];
}

const STORAGE_KEY = "edumanage-curriculum-store-v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeCurriculum(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function seedUes(): UeRecord[] {
  return SEED_UES.map((u) => ({
    ...u,
    // Rattachement réel à la filière par son code, plutôt qu'une correspondance codée en dur
    // sur seulement 3 filières (les autres tombaient toutes par erreur sur "f4"/COMPTA).
    filiereId: getFiliereByCode(u.filiere)?.id ?? "",
    type: (u.type as UeRecord["type"]) ?? "Obligatoire",
    obligatoire: u.type !== "Optionnelle",
    description: "",
  }));
}

function seedEcs(): EcRecord[] {
  return SEED_ECS.map((e) => {
    const volTp = 0;
    const volTpe = Math.max(0, Math.round((e.volCm + e.volTd) * 0.5));
    const vht = e.volCm + e.volTd + volTp + volTpe;
    return {
      ...e,
      volTp,
      volTpe,
      vht,
      responsableId: "",
    };
  });
}

function buildFresh(): CurriculumStore {
  return { ues: seedUes(), ecs: seedEcs() };
}

function load(): CurriculumStore {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<CurriculumStore>;
        const fresh = buildFresh();
        return {
          ues: parsed.ues ?? fresh.ues,
          ecs: parsed.ecs ?? fresh.ecs,
        };
      } catch {
        /* fallthrough */
      }
    }
  }
  return buildFresh();
}

let store = load();

function persist() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (err) {
      console.error("[EduManage] curriculum persist failed", err);
    }
  }
  notify();
}

if (typeof window !== "undefined") {
  persist();
}

function recalcUeNbEc(ueId: string) {
  const ue = store.ues.find((u) => u.id === ueId);
  if (ue) ue.nbEc = store.ecs.filter((e) => e.ueId === ueId).length;
}

export function getUes(): UeRecord[] {
  return store.ues;
}

export function getEcs(): EcRecord[] {
  return store.ecs;
}

export function getUeById(id: string): UeRecord | undefined {
  return store.ues.find((u) => u.id === id);
}

export function getEcById(id: string): EcRecord | undefined {
  return store.ecs.find((e) => e.id === id);
}

export function computeVht(cm: number, td: number, tp: number, tpe: number) {
  return (cm || 0) + (td || 0) + (tp || 0) + (tpe || 0);
}

export interface UePayload {
  code: string;
  libelle: string;
  credits: number;
  coeff?: number;
  filiere: string;
  filiereId: string;
  niveau: string;
  semestre: string;
  type: UeRecord["type"];
  obligatoire: boolean;
  description?: string;
}

export function upsertUe(payload: UePayload, id?: string): UeRecord {
  const existing = id ? store.ues.find((u) => u.id === id) : undefined;
  if (existing) {
    Object.assign(existing, payload);
    persist();
    return existing;
  }
  const ue: UeRecord = {
    id: `ue-${Date.now()}`,
    nbEc: 0,
    ...payload,
  };
  store.ues.unshift(ue);
  persist();
  return ue;
}

export function deleteUe(id: string) {
  store.ecs = store.ecs.filter((e) => e.ueId !== id);
  store.ues = store.ues.filter((u) => u.id !== id);
  persist();
}

export interface EcPayload {
  code: string;
  libelle: string;
  abrege?: string;
  ueId: string;
  coeff: number;
  credits: number;
  volCm: number;
  volTd: number;
  volTp: number;
  volTpe: number;
  responsable: string;
  responsableId?: string;
}

export function upsertEc(payload: EcPayload, id?: string): EcRecord {
  const ue = store.ues.find((u) => u.id === payload.ueId);
  const vht = computeVht(payload.volCm, payload.volTd, payload.volTp, payload.volTpe);
  const base = {
    ...payload,
    ue: ue?.code ?? "",
    vht,
  };

  const existing = id ? store.ecs.find((e) => e.id === id) : undefined;
  if (existing) {
    const oldUeId = existing.ueId;
    Object.assign(existing, base);
    recalcUeNbEc(oldUeId);
    recalcUeNbEc(payload.ueId);
    persist();
    return existing;
  }

  const ec: EcRecord = {
    id: `ec-${Date.now()}`,
    ...base,
  };
  store.ecs.unshift(ec);
  recalcUeNbEc(payload.ueId);
  persist();
  return ec;
}

export function deleteEc(id: string) {
  const ec = store.ecs.find((e) => e.id === id);
  store.ecs = store.ecs.filter((e) => e.id !== id);
  if (ec) recalcUeNbEc(ec.ueId);
  persist();
}

export interface CurriculumImportRow {
  codeUe: string;
  libelleUe: string;
  codeEc: string;
  libelleEc: string;
  cm: number;
  td: number;
  tp: number;
  tpe: number;
  vht?: number;
  credits: number;
  semestre?: string;
  obligatoire?: boolean;
  filiere?: string;
  niveau?: string;
}

export function importCurriculumRows(
  rows: CurriculumImportRow[],
  defaults: { filiere: string; filiereId: string; niveau: string; semestre: string },
): { ueCount: number; ecCount: number } {
  let ueCount = 0;
  let ecCount = 0;

  for (const row of rows) {
    if (!row.codeUe || !row.libelleUe) continue;

    let ue = store.ues.find((u) => u.code.toUpperCase() === row.codeUe.toUpperCase());
    if (!ue) {
      ue = upsertUe({
        code: row.codeUe.toUpperCase(),
        libelle: row.libelleUe,
        credits: row.credits || 6,
        filiere: row.filiere || defaults.filiere,
        filiereId: defaults.filiereId,
        niveau: row.niveau || defaults.niveau,
        semestre: row.semestre || defaults.semestre,
        type: row.obligatoire === false ? "Libre" : "Obligatoire",
        obligatoire: row.obligatoire !== false,
        description: "",
      });
      ueCount++;
    } else {
      ue.libelle = row.libelleUe;
      if (row.credits) ue.credits = row.credits;
      if (row.semestre) ue.semestre = row.semestre;
      if (row.obligatoire !== undefined) {
        ue.obligatoire = row.obligatoire;
        ue.type = row.obligatoire ? "Obligatoire" : "Libre";
      }
    }

    if (!row.codeEc || !row.libelleEc) continue;

    const existingEc = store.ecs.find((e) => e.code.toUpperCase() === row.codeEc.toUpperCase());
    const cm = row.cm || 0;
    const td = row.td || 0;
    const tp = row.tp || 0;
    const tpe = row.tpe || 0;

    upsertEc(
      {
        code: row.codeEc.toUpperCase(),
        libelle: row.libelleEc,
        ueId: ue.id,
        coeff: 1,
        credits: 0,
        volCm: cm,
        volTd: td,
        volTp: tp,
        volTpe: tpe,
        responsable: "",
      },
      existingEc?.id,
    );
    ecCount++;
  }

  persist();
  return { ueCount, ecCount };
}
