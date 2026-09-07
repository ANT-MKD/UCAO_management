import { createListStore } from "@/lib/createListStore";

export interface TypeSeanceRecord {
  id: string;
  code: string;
  intitule: string;
  categorie: "emploi_du_temps" | "evenement";
  couleur: string;
  trajet: boolean;
  /** Un évènement de ce type doit désigner un surveillant (ex. Examen) — configurable plutôt
   * que codé en dur sur le libellé du type, pour rester extensible sans toucher au code. */
  necessiteSurveillant: boolean;
}

export interface JourFerieRecord {
  id: string;
  intitule: string;
  dateDebut: string;
  dateFin: string;
}

const SEED_TYPES_SEANCE: TypeSeanceRecord[] = [
  { id: "ts-seed-1", code: "CM", intitule: "Cours magistral", categorie: "emploi_du_temps", couleur: "#4f46e5", trajet: false, necessiteSurveillant: false },
  { id: "ts-seed-2", code: "TD", intitule: "Travaux dirigés", categorie: "emploi_du_temps", couleur: "#10b981", trajet: false, necessiteSurveillant: false },
  { id: "ts-seed-3", code: "TP", intitule: "Travaux pratiques", categorie: "emploi_du_temps", couleur: "#8b5cf6", trajet: false, necessiteSurveillant: false },
  { id: "ts-seed-4", code: "EX", intitule: "Examen", categorie: "evenement", couleur: "#ef4444", trajet: false, necessiteSurveillant: true },
];

const SEED_JOURS_FERIES: JourFerieRecord[] = [];

export const typeSeanceStore = createListStore<TypeSeanceRecord>("edumanage-edt-type-seance-v1", SEED_TYPES_SEANCE);
export const jourFerieStore = createListStore<JourFerieRecord>("edumanage-edt-jour-ferie-v1", SEED_JOURS_FERIES);

/** Jour férié couvrant une date donnée, s'il en existe un — jamais bloquant, seulement
 * informatif (ex. bandeau dans le Cahier de textes) : on ne fabrique aucune restriction. */
export function getJourFerieCouvrant(date: string): JourFerieRecord | undefined {
  return jourFerieStore.getAll().find((j) => date >= j.dateDebut && date <= j.dateFin);
}
