import * as XLSX from "xlsx";
import type { ArticleServiceRecord } from "@/data/financeSettingsStore";

const HEADERS = ["Code", "Intitulé", "Prix Unitaire"] as const;

const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .replace(/['’]/g, "'");
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

function mapRow(raw: Record<string, unknown>): Omit<ArticleServiceRecord, "id"> | null {
  const entries = Object.entries(raw).map(([k, v]) => [normalizeHeader(k), v] as const);
  const get = (...aliases: string[]) => {
    for (const a of aliases) {
      const hit = entries.find(([k]) => k === normalizeHeader(a) || k.includes(normalizeHeader(a)));
      if (hit) return hit[1];
    }
    return "";
  };

  const code = str(get("code"));
  const intitule = str(get("intitule", "intitulé", "libelle"));
  if (!code || !intitule) return null;

  return {
    code,
    intitule,
    prixUnitaire: num(get("prix unitaire", "prix", "montant")),
  };
}

export async function parseArticleServiceExcel(file: File): Promise<Omit<ArticleServiceRecord, "id">[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return json.map(mapRow).filter((r): r is Omit<ArticleServiceRecord, "id"> => !!r);
}

export function downloadArticleServiceTemplate() {
  const sample: (string | number)[][] = [
    [...HEADERS],
    ["PHOT", "Photocopie", 25],
    ["DUPL", "Duplicata de carte étudiant", 5000],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Articles");
  XLSX.writeFile(wb, "modele-import-articles-services.xlsx");
}
