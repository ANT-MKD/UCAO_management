import type { CahierSeanceRecord } from "@/data/studentStore";

/** Libellés lisibles des statuts d'un cahier de séance et de l'état de la séance. */
export const LIBELLE_STATUT_CAHIER: Record<CahierSeanceRecord["statut"], string> = {
  brouillon: "Brouillon",
  soumis: "À valider",
  valide: "Validé",
  rejete: "Rejeté",
};

export const LIBELLE_ETAT_SEANCE: Record<CahierSeanceRecord["etatSeance"], string> = {
  preparee: "Séance préparée",
  realisee: "Séance réalisée",
  annulee: "Séance annulée",
};
