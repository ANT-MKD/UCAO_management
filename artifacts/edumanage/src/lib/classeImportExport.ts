import * as XLSX from "xlsx";
import { FILIERES, NIVEAUX } from "@/data/mockData";
import { upsertClasse, type ClassePedagogiqueRecord } from "@/data/structureStore";

const HEADERS = ["Nom de la classe", "Filière (code)", "Niveau", "Effectif max", "Année", "Délégué"] as const;

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

export function downloadClasseTemplate() {
  const sample: (string | number)[][] = [
    [...HEADERS],
    ["L1-INFO-C", "LPIG", "L1", 40, "2025-2026", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Classes");
  XLSX.writeFile(wb, "modele-import-classes.xlsx");
}

export interface ParsedClasseRow {
  nom: string;
  filiereId: string;
  niveauId: string;
  max: number;
  annee: string;
  delegue?: string;
}

export async function parseClasseExcel(file: File): Promise<ParsedClasseRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const rows: ParsedClasseRow[] = [];
  for (const raw of json) {
    const nom = str(get(raw, "nom de la classe", "nom", "classe"));
    const filiereCode = str(get(raw, "filiere", "filière"));
    const niveauAlias = str(get(raw, "niveau"));
    const annee = str(get(raw, "annee", "année"));
    if (!nom || !filiereCode || !niveauAlias || !annee) continue;

    const filiere = FILIERES.find((f) => f.code.toLowerCase() === filiereCode.toLowerCase());
    if (!filiere) continue;
    const niveau = NIVEAUX.find((n) => n.filiereId === filiere.id && n.alias.toLowerCase() === niveauAlias.toLowerCase());
    if (!niveau) continue;

    const maxTxt = str(get(raw, "effectif max", "max"));
    rows.push({
      nom,
      filiereId: filiere.id,
      niveauId: niveau.id,
      max: parseInt(maxTxt) || 40,
      annee,
      delegue: str(get(raw, "delegue", "délégué")) || undefined,
    });
  }
  return rows;
}

export function importClasseRows(rows: ParsedClasseRow[]): ClassePedagogiqueRecord[] {
  return rows.map((row) => upsertClasse(row));
}

export function exportClassesToExcel(classes: ClassePedagogiqueRecord[]) {
  const rows = classes.map((c) => ({
    "Nom de la classe": c.nom,
    Filière: c.filiere,
    Niveau: c.niveau,
    Effectif: c.inscrits,
    "Effectif max": c.max,
    Année: c.annee,
    Délégué: c.delegue ?? "",
    Statut: c.cloturee ? "Clôturée" : "Ouverte",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Classes");
  XLSX.writeFile(wb, `classes-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
