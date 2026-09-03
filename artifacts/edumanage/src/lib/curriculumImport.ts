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
    .replace(/[̀-ͯ]/g, "")
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

/** Correspondance colonne → champ, réutilisée par les 3 formats d'import (Excel, Word, PDF) — un
 * seul endroit qui connaît les alias de colonnes acceptés, jamais trois logiques divergentes. */
export function mapRow(raw: Record<string, unknown>): CurriculumImportRow | null {
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

function rowsFromHtmlTable(table: HTMLTableElement): CurriculumImportRow[] {
  const trs = Array.from(table.querySelectorAll("tr"));
  if (trs.length < 2) return [];
  const headerCells = Array.from(trs[0].querySelectorAll("th,td")).map((c) => (c.textContent ?? "").trim());
  const rows: CurriculumImportRow[] = [];
  for (const tr of trs.slice(1)) {
    const cells = Array.from(tr.querySelectorAll("th,td")).map((c) => (c.textContent ?? "").trim());
    if (cells.every((c) => !c)) continue;
    const raw: Record<string, unknown> = {};
    headerCells.forEach((h, i) => { raw[h] = cells[i] ?? ""; });
    const mapped = mapRow(raw);
    if (mapped) rows.push(mapped);
  }
  return rows;
}

/** Importe une maquette depuis un fichier Word (.docx) — le document doit contenir un (ou
 * plusieurs) tableau(x) avec les mêmes colonnes que le modèle Excel. Mammoth (chargé à la demande,
 * jamais dans le bundle principal) convertit le .docx en HTML en conservant la structure des
 * tableaux, ce qui permet de réutiliser exactement la même correspondance de colonnes (mapRow) que
 * pour l'Excel. Le format .doc historique (binaire, pré-2007) n'est pas supporté par Mammoth. */
export async function parseCurriculumWord(file: File): Promise<CurriculumImportRow[]> {
  const mammoth = await import("mammoth");
  const buffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  return tables.flatMap((t) => rowsFromHtmlTable(t as HTMLTableElement));
}

const HEADER_ALIASES: string[][] = [
  ["code ue", "code_ue"],
  ["unite d'enseignement", "unite denseignement", "ue", "libelle ue"],
  ["code ec", "code_ec"],
  ["element constitutif", "elements constitutifs", "ec", "libelle ec"],
  ["cm"],
  ["td"],
  ["tp"],
  ["tpe"],
  ["vht"],
  ["credits", "credit", "ects"],
  ["semestre"],
  ["obligatoire"],
];

interface PdfTextItem {
  text: string;
  x: number;
  y: number;
}

/** Importe une maquette depuis un PDF texte (non scanné) contenant un tableau. PDF.js (chargé à la
 * demande) ne donne accès qu'à des positions de texte, pas à une vraie structure de tableau — les
 * colonnes sont donc reconstruites à partir de la position horizontale de la ligne d'en-tête
 * (mêmes intitulés que le modèle Excel/Word), puis chaque texte des lignes suivantes est assigné à
 * la colonne dont l'en-tête est la plus proche. Nettement moins fiable qu'Excel ou Word — dépend
 * d'un vrai calque de texte (pas une image scannée) et d'une mise en page tabulaire propre. */
export async function parseCurriculumPdf(file: File): Promise<CurriculumImportRow[]> {
  const pdfjsLib = await import("pdfjs-dist");
  const pdfWorkerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const allItems: PdfTextItem[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items as { str?: string; transform?: number[] }[]) {
      if (typeof it.str === "string" && it.str.trim() !== "" && Array.isArray(it.transform)) {
        allItems.push({ text: it.str, x: it.transform[4], y: it.transform[5] - p * 1e6 });
      }
    }
  }
  if (allItems.length === 0) return [];

  // Regroupe les items en lignes par proximité verticale (tolérance 3pt), page par page (le décalage
  // -p*1e6 empêche deux pages différentes de se regrouper par coïncidence de coordonnées locales).
  const sorted = [...allItems].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PdfTextItem[][] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - it.y) < 3) {
      last.push(it);
    } else {
      rows.push([it]);
    }
  }
  rows.forEach((r) => r.sort((a, b) => a.x - b.x));

  let headerRowIndex = -1;
  let headerItems: PdfTextItem[] = [];
  for (let i = 0; i < rows.length; i++) {
    const matched = rows[i].filter((it) => HEADER_ALIASES.some((aliases) => aliases.some((a) => normalizeHeader(it.text).includes(a))));
    if (matched.length >= 3) {
      headerRowIndex = i;
      headerItems = rows[i];
      break;
    }
  }
  if (headerRowIndex === -1) return [];

  const columnLabels = headerItems.map((it) => it.text.trim());
  const columnX = headerItems.map((it) => it.x);

  const dataRows: CurriculumImportRow[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const cells: string[] = columnLabels.map(() => "");
    for (const it of rows[i]) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < columnX.length; c++) {
        const d = Math.abs(it.x - columnX[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      cells[best] = cells[best] ? `${cells[best]} ${it.text.trim()}` : it.text.trim();
    }
    if (cells.every((c) => !c)) continue;
    const raw: Record<string, unknown> = {};
    columnLabels.forEach((h, idx) => { raw[h] = cells[idx]; });
    const mapped = mapRow(raw);
    if (mapped) dataRows.push(mapped);
  }
  return dataRows;
}
