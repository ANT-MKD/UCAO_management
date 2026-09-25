/** Données de démarrage de l'application — volontairement vides pour tout ce qui est propre à
 * un établissement (filières, classes, étudiants, professeurs, notes, paiements...). Rien de
 * fictif n'est préchargé : chaque store se remplit uniquement avec ce que l'administrateur
 * saisit réellement, et tout est ensuite persisté en local (localStorage du navigateur).
 * ANNEES_ACADEMIQUES garde une seule entrée : sans au moins une année en cours, la quasi-totalité
 * des formulaires (inscription, classe, paiement...) n'aurait aucune année à proposer. */
export const ANNEES_ACADEMIQUES = [
  { id: "aa1", libelle: "2025-2026", actuelle: true },
];

export const FILIERES: {
  id: string; code: string; nom: string; responsable: string;
  nbClasses: number; nbEtudiants: number; statut: string;
}[] = [];

export const NIVEAUX: {
  id: string; nom: string; alias: string; cycle: string; filiere: string; filiereId: string;
}[] = [];

export const SEMESTRES: {
  id: string; nom: string; alias: string; niveau: string; niveauId: string; filiere: string;
  statut: string;
}[] = [];

export const CLASSES: {
  id: string; nom: string; filiere: string; filiereId: string; niveau: string;
  inscrits: number; max: number; delegue: string; annee: string;
}[] = [];

export const SALLES: {
  id: string; nom: string; type: string; capacite: number; batiment: string;
  equipements: string[]; statut: string;
}[] = [];

export const UES: {
  id: string; code: string; libelle: string; credits: number; filiere: string; niveau: string;
  semestre: string; type: string; nbEc: number;
}[] = [];

export const ECS: {
  id: string; code: string; libelle: string; ue: string; ueId: string; coeff: number;
  credits: number; volCm: number; volTd: number; responsable: string;
}[] = [];

export const ENSEIGNANTS: {
  id: string; prenom: string; nom: string; matricule: string; telephone: string;
  specialite: string; grade: string; tauxHoraire: number; modulesAssignes: number; heuresMois: number;
}[] = [];

export const VACATIONS: {
  id: string; mois: string; enseignant: string; enseignantId: string; modules: string[];
  heuresCm: number; heuresTd: number; tauxHoraire: number; montantTotal: number; statut: string; moyen: string;
}[] = [];
