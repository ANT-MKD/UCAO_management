import * as XLSX from "xlsx";
import { FILIERES, NIVEAUX } from "@/data/mockData";
import { registerNewEtudiant, type EtudiantRecord, type NewEtudiantPayload } from "@/data/studentStore";
import { ouvrirCompteEtudiant, reserverMatricule } from "@/data/inscriptionEtudiant";

const HEADERS = [
  "Prénom", "Nom", "Sexe (M/F)", "Date de naissance (AAAA-MM-JJ)", "Lieu de naissance",
  "Pays", "Nationalité", "CNI", "Email", "Téléphone", "Adresse", "Filière (code)", "Niveau", "Année",
] as const;

const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "").replace(/['’]/g, "'");
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function get(raw: Record<string, unknown>, ...aliases: string[]): unknown {
  const entries = Object.entries(raw).map(([k, v]) => [normalizeHeader(k), v] as const);
  for (const a of aliases) {
    const hit = entries.find(([k]) => k === normalizeHeader(a) || k.includes(normalizeHeader(a)));
    if (hit) return hit[1];
  }
  return "";
}

export function downloadStudentTemplate() {
  const sample: (string | number)[][] = [
    [...HEADERS],
    ["Moussa", "SY", "M", "2003-04-15", "Dakar", "Sénégal", "Sénégalaise", "1234567890123", "moussa.sy@edu.sn", "77 123 45 67", "Parcelles Assainies, Dakar", "LPIG", "L1", "2025-2026"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Étudiants");
  XLSX.writeFile(wb, "modele-import-etudiants.xlsx");
}

export interface ParsedStudentRow {
  payload: NewEtudiantPayload;
}

/** Import en masse : préinscrit chaque ligne valide (statut "preinscrit", sans paiement) — même
 * fonction de création que le formulaire Ajouter étudiant, juste sans les étapes pièces/paiement,
 * cohérent avec un usage d'import en lot suivi d'un traitement individuel des dossiers. */
export async function parseStudentExcel(file: File): Promise<ParsedStudentRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const rows: ParsedStudentRow[] = [];
  for (const raw of json) {
    const prenom = str(get(raw, "prenom", "prénom"));
    const nom = str(get(raw, "nom"));
    const sexeTxt = str(get(raw, "sexe")).toUpperCase();
    const dateNaissance = str(get(raw, "date de naissance", "naissance"));
    const email = str(get(raw, "email"));
    const filiereTxt = str(get(raw, "filiere", "filière"));
    const niveauTxt = str(get(raw, "niveau"));
    const annee = str(get(raw, "annee", "année"));
    if (!prenom || !nom || !email || !filiereTxt || !niveauTxt || !annee) continue;

    const filiere = FILIERES.find((f) => f.code.toLowerCase() === filiereTxt.toLowerCase());
    if (!filiere) continue;
    const niveauRec = NIVEAUX.find((n) => n.filiereId === filiere.id && n.alias.toLowerCase() === niveauTxt.toLowerCase());
    if (!niveauRec) continue;

    rows.push({
      payload: {
        prenom,
        nom,
        sexe: sexeTxt === "F" ? "F" : "M",
        dateNaissance,
        email,
        telephone: str(get(raw, "telephone", "téléphone")) || undefined,
        filiereId: filiere.id,
        classeId: "",
        niveau: niveauRec.alias,
        statut: "preinscrit",
        annee,
        soldeDu: 0,
        inscriptionUniquePayee: false,
        lieuNaissance: str(get(raw, "lieu de naissance")) || undefined,
        pays: str(get(raw, "pays")) || undefined,
        nationalite: str(get(raw, "nationalite", "nationalité")) || undefined,
        cni: str(get(raw, "cni")) || undefined,
        adresse: str(get(raw, "adresse")) || undefined,
      },
    });
  }
  return rows;
}

export interface ImportStudentResult {
  created: EtudiantRecord[];
  echecs: number;
  /** Dossiers enregistrés dont le compte de connexion n'a pas pu être ouvert (avec Supabase). */
  comptesNonOuverts: number;
}

/** Préinscrit chaque ligne : matricule réservé (par le serveur avec Supabase), dossier enregistré,
 * puis compte de connexion ouvert, en attente d'un code PIN (aucun mot de passe n'est importé). */
export async function importStudentRows(rows: ParsedStudentRow[]): Promise<ImportStudentResult> {
  const created: EtudiantRecord[] = [];
  let echecs = 0;
  for (const { payload } of rows) {
    try {
      const matricule = await reserverMatricule(payload.filiereId, payload.annee);
      created.push(registerNewEtudiant(payload, matricule));
    } catch {
      echecs++;
    }
  }
  let comptesNonOuverts = 0;
  for (const etudiant of created) {
    await ouvrirCompteEtudiant(etudiant).catch(() => comptesNonOuverts++);
  }
  return { created, echecs, comptesNonOuverts };
}

export function exportStudentsToExcel(students: EtudiantRecord[]) {
  const rows = students.map((e) => ({
    Matricule: e.matricule,
    Prénom: e.prenom,
    Nom: e.nom,
    Sexe: e.sexe,
    "Date de naissance": e.dateNaissance,
    Email: e.email,
    Téléphone: e.telephone,
    Adresse: e.adresse ?? "",
    Filière: e.filiere,
    Classe: e.classe,
    Niveau: e.niveau,
    Année: e.annee,
    Statut: e.statut,
    "Solde dû": e.soldeDu,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Étudiants");
  XLSX.writeFile(wb, `etudiants-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
