import * as XLSX from "xlsx";
import type { CurriculumImportRow } from "@/data/curriculumStore";

const HEADERS = [
  "Code UE",
  "Unité d'enseignement",
  "Code EC",
  "Élément constitutif",
  "CM",
  "TD",
  "TP",
  "TPE",
  "VHT",
  "Crédits",
  "Semestre",
  "Obligatoire",
] as const;

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "'");
}

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function mapRow(raw: Record<string, unknown>): CurriculumImportRow | null {
  const entries = Object.entries(raw).map(([k, v]) => [normalizeHeader(k), v] as const);
  const get = (...aliases: string[]) => {
    for (const a of aliases) {
      const hit = entries.find(([k]) => k === normalizeHeader(a) || k.includes(normalizeHeader(a)));
      if (hit) return hit[1];
    }
    return "";
  };

  const codeUe = str(get("code ue", "code_ue"));
  const libelleUe = str(get("unite d'enseignement", "unite denseignement", "ue", "libelle ue"));
  const codeEc = str(get("code ec", "code_ec"));
  const libelleEc = str(get("element constitutif", "elements constitutifs", "ec", "libelle ec"));

  if (!codeUe && !codeEc) return null;

  const obligatoireRaw = str(get("obligatoire")).toLowerCase();
  const obligatoire =
    obligatoireRaw === ""
      ? true
      : !["non", "no", "0", "false", "libre"].includes(obligatoireRaw);

  return {
    codeUe,
    libelleUe,
    codeEc,
    libelleEc,
    cm: num(get("cm")),
    td: num(get("td")),
    tp: num(get("tp")),
    tpe: num(get("tpe")),
    vht: num(get("vht")),
    credits: num(get("credits", "credit", "ects")),
    semestre: str(get("semestre")) || undefined,
    obligatoire,
  };
}

export async function parseCurriculumExcel(file: File): Promise<CurriculumImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return json.map(mapRow).filter((r): r is CurriculumImportRow => !!r && (!!r.codeUe || !!r.codeEc));
}

export function downloadCurriculumTemplate() {
  const sample: (string | number)[][] = [
    [...HEADERS],
    ["LPIG351", "Génie logiciel 5", "LPIG3511", "Concepts et fondamentaux de la POO Java", 20, 10, 20, 50, 100, 6, "S5", "Oui"],
    ["LPIG351", "Génie logiciel 5", "LPIG3512", "Outils de développement et POO Java", 20, 10, 20, 50, 100, 6, "S5", "Oui"],
    ["LPIG351", "Génie logiciel 5", "LPIG3513", "Séminaire Machine Learning et IA", 20, 0, 0, 0, 20, 6, "S5", "Oui"],
    ["LPIG355", "Professionnalisation 4", "LPIG3552", "Anglais technique 5", 20, 20, 0, 40, 80, 6, "S5", "Oui"],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Programme");
  XLSX.writeFile(wb, "modele-import-ue-ec.xlsx");
}
