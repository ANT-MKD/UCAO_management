import { peekNextMatricule } from "@/data/studentStore";
import { getTeachers } from "@/data/teacherStore";

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

/** Séquentiel et garanti unique (contre les fiches existantes + les matricules déjà réservés dans
 * le même lot d'import) — un tirage au hasard pouvait produire un matricule déjà pris par un autre
 * compte, ce qui bloquait silencieusement la création du compte de connexion lié. */
export function generateMatriculeEnseignant(reserved: string[] = []): string {
  const year = new Date().getFullYear();
  const prefix = `ENS-${year}-`;
  const existing = [...getTeachers().map((t) => t.matricule), ...reserved];
  let maxSeq = 99;
  for (const m of existing) {
    if (!m.startsWith(prefix)) continue;
    const seq = Number(m.slice(prefix.length));
    if (!Number.isNaN(seq)) maxSeq = Math.max(maxSeq, seq);
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

export function generateMotDePasse(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}
