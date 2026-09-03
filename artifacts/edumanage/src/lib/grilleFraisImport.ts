import * as XLSX from "xlsx";
import { FILIERES, NIVEAUX } from "@/data/mockData";
import type { ModeleFraisRecord } from "@/data/financeSettingsStore";
import type { GrilleFraisRecord, LigneGrilleFrais, ModaliteFrais } from "@/data/grilleFraisStore";
import { makeGrilleFraisId, makeLigneGrilleFraisId } from "@/data/grilleFraisStore";

const HEADERS = [
  "Filière", "Niveau", "Année", "Modèle de frais",
  "Intitulé", "Montant", "Modalité", "Échéances", "Date début", "Date limite",
] as const;

const DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "").replace(/['’]/g, "'");
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

/** Analyse un fichier Excel et regroupe les lignes en grilles par filière/niveau/année/modèle de frais. Remplace intégralement chaque grille présente dans le fichier. */
export async function parseGrilleFraisExcel(file: File, modelesFrais: ModeleFraisRecord[]): Promise<GrilleFraisRecord[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const groups = new Map<string, { filiereId: string; niveau: string; annee: string; modeleFraisId: string; lignes: LigneGrilleFrais[] }>();

  for (const raw of json) {
    const filiereTxt = str(get(raw, "filiere", "filière"));
    const niveauTxt = str(get(raw, "niveau"));
    const annee = str(get(raw, "annee", "année"));
    const modeleTxt = str(get(raw, "modele de frais", "modèle de frais", "modele"));
    const intitule = str(get(raw, "intitule", "intitulé", "libelle"));
    const montant = num(get(raw, "montant"));
    if (!filiereTxt || !niveauTxt || !annee || !modeleTxt || !intitule || montant <= 0) continue;

    const filiere = FILIERES.find((f) => f.code.toLowerCase() === filiereTxt.toLowerCase() || f.nom.toLowerCase() === filiereTxt.toLowerCase());
    if (!filiere) continue;
    const niveauRec = NIVEAUX.find((n) => n.filiereId === filiere.id && (n.alias.toLowerCase() === niveauTxt.toLowerCase() || n.nom.toLowerCase() === niveauTxt.toLowerCase()));
    if (!niveauRec) continue;
    const modele = modelesFrais.find((m) => m.intitule.toLowerCase() === modeleTxt.toLowerCase() || m.code.toLowerCase() === modeleTxt.toLowerCase());
    if (!modele) continue;

    const modaliteTxt = str(get(raw, "modalite", "modalité")).toLowerCase();
    const modalite: ModaliteFrais = modaliteTxt.includes("echeance") || modaliteTxt.includes("échéance") ? "echeances" : "avant_inscription";
    const nbEcheances = modalite === "echeances" ? num(get(raw, "echeances", "échéances", "nb echeances")) || undefined : undefined;
    const dateDebut = modalite === "echeances" ? str(get(raw, "date debut", "date début")) || undefined : undefined;
    const dateLimite = modalite === "echeances" ? str(get(raw, "date limite")) || undefined : undefined;

    const key = makeGrilleFraisId(filiere.id, niveauRec.alias, annee, modele.id);
    let group = groups.get(key);
    if (!group) {
      group = { filiereId: filiere.id, niveau: niveauRec.alias, annee, modeleFraisId: modele.id, lignes: [] };
      groups.set(key, group);
    }
    group.lignes.push({ id: makeLigneGrilleFraisId(), intitule, montant, modalite, nbEcheances, dateDebut, dateLimite });
  }

  return Array.from(groups.entries()).map(([id, g]) => ({ id, ...g }));
}

export function downloadGrilleFraisTemplate() {
  const sample: (string | number)[][] = [
    [...HEADERS],
    ["LPIG", "L3", "2025-2026", "Privé", "Frais d'inscription", 120000, "Avant inscription", "", "", ""],
    ["LPIG", "L3", "2025-2026", "Privé", "Frais de scolarité", 520000, "Échéances", 8, "10/09", "10/06"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Grille tarifaire");
  XLSX.writeFile(wb, "modele-import-grille-tarifaire.xlsx");
}

export function exportGrillesFraisExcel(grilles: GrilleFraisRecord[], modelesFrais: ModeleFraisRecord[]) {
  const rows: (string | number)[][] = [[...HEADERS]];
  for (const g of grilles) {
    const filiere = FILIERES.find((f) => f.id === g.filiereId);
    const modele = modelesFrais.find((m) => m.id === g.modeleFraisId);
    for (const l of g.lignes) {
      rows.push([
        filiere?.code ?? g.filiereId,
        g.niveau,
        g.annee,
        modele?.intitule ?? g.modeleFraisId,
        l.intitule,
        l.montant,
        l.modalite === "echeances" ? "Échéances" : "Avant inscription",
        l.nbEcheances ?? "",
        l.dateDebut ?? "",
        l.dateLimite ?? "",
      ]);
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Grille tarifaire");
  XLSX.writeFile(wb, `grille-tarifaire-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
