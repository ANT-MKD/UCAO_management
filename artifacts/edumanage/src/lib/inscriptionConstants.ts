import { peekNextMatricule } from "@/data/studentStore";

export const SERIES_BAC = ["S1", "S2", "S3", "L", "L1", "L2", "G1", "G2", "STI", "STEG", "Autre"] as const;

export const STATUTS_INSCRIPTION = [
  { value: "actif", label: "Actif" },
  { value: "preinscrit", label: "Préinscrit" },
  { value: "en_attente", label: "En attente" },
] as const;

export const TYPES_ADMISSION = [
  { value: "nouveau", label: "Nouveau bachelier" },
  { value: "transfert", label: "Transfert (équivalence)" },
] as const;

export const DOCUMENTS_INSCRIPTION = [
  { id: "extraitNaissance", label: "Extrait de naissance" },
  { id: "cni", label: "CNI / Passeport" },
  { id: "releveBac", label: "Relevé de notes BAC" },
  { id: "diplomeBac", label: "Diplôme BAC" },
  { id: "relevesNotes", label: "Relevés de notes (transfert)" },
  { id: "justificatifPaiement", label: "Justificatif de paiement" },
] as const;

export const STATUTS_PAIEMENT = [
  { value: "paye", label: "Payé" },
  { value: "annule", label: "Annulé" },
] as const;

export const TYPES_FRAIS_INSCRIPTION = [
  { id: "inscription", label: "Inscription unique" },
  { id: "scolarite", label: "Scolarité" },
  { id: "mutuelle", label: "Mutuelle santé" },
  { id: "tenue", label: "Tenue / frais divers" },
  { id: "pack_complet", label: "Pack complet (inscription + tenue)" },
] as const;

export const MODES_SCOLARITE = [
  { value: "mensualite", label: "Mensualité" },
  { value: "annuelle", label: "Annuelle (totalité de l'année)" },
] as const;

export const NIVEAUX_ETUDE = [
  "Licence",
  "Master",
  "Doctorat",
  "BTS / DUT",
  "CAP / BEP",
  "Certification professionnelle",
  "Autre",
] as const;

/** Prévisualisation — le matricule définitif est réservé à la confirmation via allocateMatricule */
export function generateMatriculeEtudiant(filiereCode?: string): string {
  return peekNextMatricule(filiereCode ?? "XXX");
}

export function generateMatriculeEnseignant(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 900) + 100).padStart(3, "0");
  return `ENS-${year}-${seq}`;
}

export function generateMotDePasseEtudiant(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}
