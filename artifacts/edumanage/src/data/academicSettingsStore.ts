import { createListStore } from "@/lib/createListStore";

export interface CycleRecord {
  id: string;
  code: string;
  intitule: string;
  ordre: number;
}

export interface EntiteRecord {
  id: string;
  code: string;
  intitule: string;
}

export interface CategorieCoursRecord {
  id: string;
  code: string;
  intitule: string;
}

const SEED_CYCLES: CycleRecord[] = [
  { id: "cy-seed-1", code: "BTS", intitule: "BTS", ordre: 0 },
  { id: "cy-seed-2", code: "LICENCE", intitule: "Licence", ordre: 1 },
  { id: "cy-seed-3", code: "MASTER", intitule: "Master", ordre: 2 },
  { id: "cy-seed-4", code: "DOCTORAT", intitule: "Doctorat", ordre: 3 },
];

const SEED_ENTITES: EntiteRecord[] = [];

// Reprend les valeurs déjà en usage (codées en dur) pour UeRecord.type — formalisées ici en
// une vraie liste paramétrable, sans changer le comportement existant.
const SEED_CATEGORIES_COURS: CategorieCoursRecord[] = [
  { id: "cc-seed-1", code: "OBLIGATOIRE", intitule: "Obligatoire" },
  { id: "cc-seed-2", code: "LIBRE", intitule: "Libre" },
  { id: "cc-seed-3", code: "FONDAMENTALE", intitule: "Fondamentale" },
  { id: "cc-seed-4", code: "SPECIALITE", intitule: "Spécialité" },
  { id: "cc-seed-5", code: "TRANSVERSALE", intitule: "Transversale" },
  { id: "cc-seed-6", code: "OPTIONNELLE", intitule: "Optionnelle" },
];

export const cycleStore = createListStore<CycleRecord>("edumanage-acad-cycle-v1", SEED_CYCLES);
export const entiteStore = createListStore<EntiteRecord>("edumanage-acad-entite-v1", SEED_ENTITES);
export const categorieCoursStore = createListStore<CategorieCoursRecord>("edumanage-acad-categorie-cours-v1", SEED_CATEGORIES_COURS);
