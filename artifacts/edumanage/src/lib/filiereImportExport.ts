import * as XLSX from "xlsx";
import { addFiliere, type FiliereRecord, type FiliereInput } from "@/data/filiereStore";

const HEADERS = ["Code", "Nom", "Responsable", "Statut (actif/inactif)"] as const;

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

export function downloadFiliereTemplate() {
  const sample: (string | number)[][] = [
    [...HEADERS],
    ["MKTG", "Licence Pro Marketing Digital", "Aminata DIALLO", "actif"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Filières");
  XLSX.writeFile(wb, "modele-import-filieres.xlsx");
}

export interface ParsedFiliereRow {
  payload: Omit<FiliereInput, "nbClasses" | "nbEtudiants">;
}

export async function parseFiliereExcel(file: File): Promise<ParsedFiliereRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const rows: ParsedFiliereRow[] = [];
  for (const raw of json) {
    const code = str(get(raw, "code"));
    const nom = str(get(raw, "nom"));
    if (!code || !nom) continue;
    const statutTxt = str(get(raw, "statut")).toLowerCase();

    rows.push({
      payload: {
        code: code.toUpperCase(),
        nom,
        responsable: str(get(raw, "responsable")),
        statut: statutTxt === "inactif" ? "inactif" : "actif",
      },
    });
  }
  return rows;
}

export function importFiliereRows(rows: ParsedFiliereRow[]): FiliereRecord[] {
  return rows.map(({ payload }) => addFiliere({ ...payload, nbClasses: 0, nbEtudiants: 0 }));
}

export function exportFilieresToExcel(filieres: FiliereRecord[], nbClassesDe: (id: string) => number, nbEtudiantsDe: (id: string) => number) {
  const rows = filieres.map((f) => ({
    Code: f.code,
    Nom: f.nom,
    Responsable: f.responsable,
    Classes: nbClassesDe(f.id),
    Étudiants: nbEtudiantsDe(f.id),
    Statut: f.statut,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Filières");
  XLSX.writeFile(wb, `filieres-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
