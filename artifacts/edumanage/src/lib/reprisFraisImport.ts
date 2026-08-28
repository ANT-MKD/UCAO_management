import * as XLSX from "xlsx";
import type { EtudiantRecord } from "@/data/studentStore";
import type { NouvelleReprisLigne } from "@/data/reprisFraisStore";

const HEADERS = ["ancien_code", "nom", "prenom", "libelle_annee_scolaire", "montant"] as const;

const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "").replace(/['’]/g, "'");
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "");
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

function get(raw: Record<string, unknown>, ...aliases: string[]): unknown {
  const entries = Object.entries(raw).map(([k, v]) => [normalizeHeader(k), v] as const);
  for (const a of aliases) {
    const hit = entries.find(([k]) => k === normalizeHeader(a) || k.includes(normalizeHeader(a)));
    if (hit) return hit[1];
  }
  return "";
}

/** Retrouve un étudiant par nom+prénom (insensible à la casse/accents) parmi la base actuelle.
 * Renvoie undefined si aucune correspondance ou si plusieurs étudiants portent le même nom. */
export function matchEtudiantParNom(nom: string, prenom: string, etudiants: EtudiantRecord[]): EtudiantRecord | undefined {
  const n = normalizeName(nom);
  const p = normalizeName(prenom);
  const matches = etudiants.filter((e) => normalizeName(e.nom) === n && normalizeName(e.prenom) === p);
  return matches.length === 1 ? matches[0] : undefined;
}

/** Analyse un fichier CSV ou Excel de reprise de frais (ancien_code, nom, prenom, libelle_annee_scolaire, montant). */
export async function parseReprisFraisFile(file: File): Promise<NouvelleReprisLigne[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const lignes: NouvelleReprisLigne[] = [];
  for (const raw of json) {
    const ancienCode = str(get(raw, "ancien_code", "ancien code", "code"));
    const nom = str(get(raw, "nom"));
    const prenom = str(get(raw, "prenom", "prénom"));
    const libelleAnneeScolaire = str(get(raw, "libelle_annee_scolaire", "libellé année scolaire", "annee scolaire", "année scolaire"));
    const montant = num(get(raw, "montant"));
    if (!ancienCode || !nom || !prenom || !libelleAnneeScolaire || montant <= 0) continue;
    lignes.push({ ancienCode, nom, prenom, libelleAnneeScolaire, montant });
  }
  return lignes;
}

export function downloadReprisFraisTemplate() {
  const sample: (string | number)[][] = [
    [...HEADERS],
    ["218549", "BA", "Mactar", "2020-2021", 145000],
    ["33547", "SAMBE", "Papa Sidya", "2020-2021", 100000],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reprise frais");
  XLSX.writeFile(wb, "modele-reprise-frais-etudiant.xlsx");
}
