import * as XLSX from "xlsx";
import { addTeacher, type TeacherRecord, type TeacherInput } from "@/data/teacherStore";
import { generateMatriculeEnseignant } from "@/lib/inscriptionConstants";

const HEADERS = ["Prénom", "Nom", "Sexe (M/F)", "Email", "Téléphone", "Spécialité", "Statut", "Adresse", "Niveau", "Dernier diplôme"] as const;

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

const STATUTS_VALIDES = new Set(["Permanent", "Vacataire", "Contractuel"]);

export function downloadTeacherTemplate() {
  const sample: (string | number)[][] = [
    [...HEADERS],
    ["Cheikh", "FALL", "M", "cheikh.fall@univ.sn", "77 123 45 67", "Algorithmique & IA", "Vacataire", "Dakar", "Master", "Master en Informatique"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Enseignants");
  XLSX.writeFile(wb, "modele-import-enseignants.xlsx");
}

export interface ParsedTeacherRow {
  payload: Omit<TeacherInput, "tauxHoraire">;
}

export async function parseTeacherExcel(file: File): Promise<ParsedTeacherRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const rows: ParsedTeacherRow[] = [];
  const matriculesReserves: string[] = [];
  for (const raw of json) {
    const prenom = str(get(raw, "prenom", "prénom"));
    const nom = str(get(raw, "nom"));
    const email = str(get(raw, "email"));
    const telephone = str(get(raw, "telephone", "téléphone"));
    const specialite = str(get(raw, "specialite", "spécialité"));
    if (!prenom || !nom || !email || !telephone || !specialite) continue;
    const statutTxt = str(get(raw, "statut", "grade"));
    const sexeTxt = str(get(raw, "sexe")).toUpperCase();
    const dernierDiplome = str(get(raw, "dernier diplome", "diplome"));
    const matricule = generateMatriculeEnseignant(matriculesReserves);
    matriculesReserves.push(matricule);

    rows.push({
      payload: {
        prenom,
        nom: nom.toUpperCase(),
        matricule,
        telephone,
        specialite,
        specialites: [specialite],
        grade: (STATUTS_VALIDES.has(statutTxt) ? statutTxt : "Vacataire") as TeacherInput["grade"],
        email,
        sexe: sexeTxt === "F" ? "F" : "M",
        adresse: str(get(raw, "adresse")) || undefined,
        niveauEtude: str(get(raw, "niveau")) || undefined,
        diplomes: dernierDiplome ? [dernierDiplome] : undefined,
      },
    });
  }
  return rows;
}

export function importTeacherRows(rows: ParsedTeacherRow[], actorId: string): TeacherRecord[] {
  return rows.map(({ payload }) => addTeacher({ ...payload, tauxHoraire: 0 }, actorId));
}

export function exportTeachersToExcel(teachers: TeacherRecord[]) {
  const rows = teachers.map((t) => ({
    Matricule: t.matricule,
    Prénom: t.prenom,
    Nom: t.nom,
    Email: t.email ?? "",
    Téléphone: t.telephone,
    Spécialité: t.specialite,
    Statut: t.grade,
    Niveau: t.niveauEtude ?? "",
    "Dernier diplôme": t.diplomes?.length ? t.diplomes[t.diplomes.length - 1] : "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Enseignants");
  XLSX.writeFile(wb, `enseignants-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
