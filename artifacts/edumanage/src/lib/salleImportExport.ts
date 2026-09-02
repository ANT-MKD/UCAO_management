import * as XLSX from "xlsx";
import { upsertSalle, EQUIPEMENTS_PEDAGOGIQUES, type SallePhysiqueRecord } from "@/data/structureStore";

const HEADERS = ["Nom de la salle", "Type", "Capacité", "Bâtiment", "Étage", "Équipements (séparés par ,)", "Statut"] as const;

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

const STATUTS_VALIDES = new Set(["actif", "en_maintenance", "inactif"]);

export function downloadSalleTemplate() {
  const sample: (string | number)[][] = [
    [...HEADERS],
    ["RDC 2A", "Amphithéâtre", 80, "Bâtiment principal", "RDC", "Vidéoprojecteur,Écran", "actif"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Salles");
  XLSX.writeFile(wb, "modele-import-salles.xlsx");
}

export interface ParsedSalleRow {
  nom: string;
  type: string;
  capacite: number;
  batiment: string;
  etage?: string;
  equipements: string[];
  statut: SallePhysiqueRecord["statut"];
}

export async function parseSalleExcel(file: File): Promise<ParsedSalleRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const rows: ParsedSalleRow[] = [];
  for (const raw of json) {
    const nom = str(get(raw, "nom de la salle", "nom", "salle"));
    const type = str(get(raw, "type"));
    const batiment = str(get(raw, "batiment", "bâtiment"));
    if (!nom || !type || !batiment) continue;

    const capaciteTxt = str(get(raw, "capacite", "capacité"));
    const equipementsTxt = str(get(raw, "equipements", "équipements"));
    const statutTxt = str(get(raw, "statut")).toLowerCase();

    rows.push({
      nom,
      type,
      capacite: parseInt(capaciteTxt) || 0,
      batiment,
      etage: str(get(raw, "etage", "étage")) || undefined,
      equipements: equipementsTxt
        ? equipementsTxt.split(",").map((e) => e.trim()).filter((e) => EQUIPEMENTS_PEDAGOGIQUES.includes(e))
        : [],
      statut: (STATUTS_VALIDES.has(statutTxt) ? statutTxt : "actif") as SallePhysiqueRecord["statut"],
    });
  }
  return rows;
}

export function importSalleRows(rows: ParsedSalleRow[]): SallePhysiqueRecord[] {
  return rows.map((row) => upsertSalle(row));
}

export function exportSallesToExcel(salles: SallePhysiqueRecord[]) {
  const rows = salles.map((s) => ({
    "Nom de la salle": s.nom,
    Type: s.type,
    Capacité: s.capacite,
    Bâtiment: s.batiment,
    Étage: s.etage,
    Équipements: s.equipements.join(", "),
    Statut: s.statut,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Salles");
  XLSX.writeFile(wb, `salles-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
