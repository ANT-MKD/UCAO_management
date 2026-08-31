import * as XLSX from "xlsx";
import type { EncaissementRecord } from "@/data/encaissementStore";
import type { DecomptePaiementRecord } from "@/data/decomptePaiementStore";
import type { AvoirDepotRecord } from "@/data/avoirDepotStore";
import type { RemboursementAvoirRecord } from "@/data/remboursementAvoirStore";
import type { ReductionFraisRecord } from "@/data/reductionFraisStore";
import type { PriseEnChargeRecord } from "@/data/priseEnChargeStore";
import type { FactureAutreServiceRecord } from "@/data/factureAutreServiceStore";

export type CategorieExport =
  | "encaissements"
  | "paiements_professeur"
  | "avoirs_depots"
  | "avoirs_remboursements"
  | "reductions"
  | "prises_en_charge"
  | "factures_autres_services";

export const CATEGORIE_LABELS: Record<CategorieExport, string> = {
  encaissements: "Encaissements",
  paiements_professeur: "Paiements professeur",
  avoirs_depots: "Avoirs — dépôts",
  avoirs_remboursements: "Avoirs — remboursements",
  reductions: "Réductions",
  prises_en_charge: "Prises en charge",
  factures_autres_services: "Factures autres services",
};

export const TOUTES_CATEGORIES = Object.keys(CATEGORIE_LABELS) as CategorieExport[];

export interface LigneComptable {
  categorie: CategorieExport;
  sens: "recette" | "depense" | "ajustement";
  date: string;
  reference: string;
  tiers: string;
  libelle: string;
  modeReglement: string;
  referenceBancaire: string;
  montant: number;
  statut: "Validé" | "Annulé";
}

function inPeriode(date: string, debut: string, fin: string): boolean {
  return date >= debut && date <= fin;
}

export interface SourcesExportComptable {
  encaissements: EncaissementRecord[];
  paiementsProfesseur: DecomptePaiementRecord[];
  avoirsDepots: AvoirDepotRecord[];
  avoirsRemboursements: RemboursementAvoirRecord[];
  reductions: ReductionFraisRecord[];
  prisesEnCharge: PriseEnChargeRecord[];
  facturesAutresServices: FactureAutreServiceRecord[];
  etudiantLabel: (id: string) => string;
  personnelLabel: (id: string) => string;
}

export function construireLignesComptables(
  sources: SourcesExportComptable,
  periodeDebut: string,
  periodeFin: string,
  categories: CategorieExport[],
): LigneComptable[] {
  const lignes: LigneComptable[] = [];

  if (categories.includes("encaissements")) {
    for (const e of sources.encaissements) {
      if (!inPeriode(e.date, periodeDebut, periodeFin)) continue;
      lignes.push({
        categorie: "encaissements", sens: "recette", date: e.date, reference: e.reference,
        tiers: e.payeur, libelle: `Encaissement quittance ${e.quittanceReference}`,
        modeReglement: e.moyen, referenceBancaire: e.referenceBancaire ?? "",
        montant: e.montant, statut: e.annulee ? "Annulé" : "Validé",
      });
    }
  }

  if (categories.includes("paiements_professeur")) {
    for (const p of sources.paiementsProfesseur) {
      if (!inPeriode(p.date, periodeDebut, periodeFin)) continue;
      lignes.push({
        categorie: "paiements_professeur", sens: "depense", date: p.date, reference: p.reference,
        tiers: p.professeur, libelle: `Paiement décompte ${p.decompteReference}`,
        modeReglement: p.moyen, referenceBancaire: p.referenceBancaire ?? "",
        montant: p.montant, statut: p.annulee ? "Annulé" : "Validé",
      });
    }
  }

  if (categories.includes("avoirs_depots")) {
    for (const a of sources.avoirsDepots) {
      if (!inPeriode(a.date, periodeDebut, periodeFin)) continue;
      lignes.push({
        categorie: "avoirs_depots", sens: "recette", date: a.date, reference: a.reference,
        tiers: a.payeur, libelle: `Dépôt d'avoir — ${a.motif}`,
        modeReglement: a.moyenOrigine, referenceBancaire: a.referenceBancaire ?? "",
        montant: a.montant, statut: a.annulee ? "Annulé" : "Validé",
      });
    }
  }

  if (categories.includes("avoirs_remboursements")) {
    for (const r of sources.avoirsRemboursements) {
      if (!inPeriode(r.date, periodeDebut, periodeFin)) continue;
      lignes.push({
        categorie: "avoirs_remboursements", sens: "depense", date: r.date, reference: r.reference,
        tiers: r.payeur, libelle: `Remboursement d'avoir — ${r.motif}`,
        modeReglement: r.moyenRemboursement, referenceBancaire: r.referenceBancaire ?? "",
        montant: r.montant, statut: r.annulee ? "Annulé" : "Validé",
      });
    }
  }

  if (categories.includes("reductions")) {
    for (const red of sources.reductions) {
      if (!inPeriode(red.date, periodeDebut, periodeFin)) continue;
      lignes.push({
        categorie: "reductions", sens: "ajustement", date: red.date, reference: red.reference,
        tiers: sources.etudiantLabel(red.etudiantId), libelle: `Réduction ${red.tauxApplique}% — accordée par ${sources.personnelLabel(red.personnelId)}`,
        modeReglement: "", referenceBancaire: "",
        montant: red.totalReduit, statut: red.annulee ? "Annulé" : "Validé",
      });
    }
  }

  if (categories.includes("prises_en_charge")) {
    for (const pec of sources.prisesEnCharge) {
      if (!inPeriode(pec.dateSaisie, periodeDebut, periodeFin)) continue;
      lignes.push({
        categorie: "prises_en_charge", sens: "recette", date: pec.dateSaisie, reference: pec.reference,
        tiers: pec.organisme, libelle: `Prise en charge — ${pec.etudiant}`,
        modeReglement: "Prise en charge", referenceBancaire: pec.referenceExterne ?? "",
        montant: pec.montantEncaisse, statut: pec.annulee ? "Annulé" : "Validé",
      });
    }
  }

  if (categories.includes("factures_autres_services")) {
    for (const f of sources.facturesAutresServices) {
      if (f.montant <= 0) continue; // rien d'encaissé sur cette facture pour l'instant
      const date = f.datePaiement ?? f.date;
      if (!inPeriode(date, periodeDebut, periodeFin)) continue;
      lignes.push({
        categorie: "factures_autres_services", sens: "recette", date, reference: f.reference,
        tiers: f.beneficiaire, libelle: `Facture autre service — ${f.remarque || f.reference}`,
        modeReglement: f.moyen ?? "", referenceBancaire: f.referenceBancairePaiement ?? "",
        montant: f.montant, statut: f.statut === "annule" ? "Annulé" : "Validé",
      });
    }
  }

  return lignes.sort((a, b) => a.date.localeCompare(b.date));
}

export function calculerTotaux(lignes: LigneComptable[]) {
  const actives = lignes.filter((l) => l.statut === "Validé");
  const totalRecettes = actives.filter((l) => l.sens === "recette").reduce((s, l) => s + l.montant, 0);
  const totalDepenses = actives.filter((l) => l.sens === "depense").reduce((s, l) => s + l.montant, 0);
  const totalAjustements = actives.filter((l) => l.sens === "ajustement").reduce((s, l) => s + l.montant, 0);
  return { totalRecettes, totalDepenses, totalAjustements, soldeNet: totalRecettes - totalDepenses };
}

export interface CategorieDetail {
  categorie: CategorieExport;
  label: string;
  nbLignes: number;
  montant: number;
}

export function calculerTotauxParCategorie(lignes: LigneComptable[]): CategorieDetail[] {
  return (Object.entries(CATEGORIE_LABELS) as [CategorieExport, string][]).map(([cat, label]) => {
    const catLignes = lignes.filter((l) => l.categorie === cat && l.statut === "Validé");
    return { categorie: cat, label, nbLignes: catLignes.length, montant: catLignes.reduce((s, l) => s + l.montant, 0) };
  });
}

export function genererExcelComptable(lignes: LigneComptable[], periodeDebut: string, periodeFin: string) {
  const wb = XLSX.utils.book_new();
  const totaux = calculerTotaux(lignes);

  const synthese: (string | number)[][] = [
    ["Export comptable", `${periodeDebut} au ${periodeFin}`],
    [],
    ["Total recettes", totaux.totalRecettes],
    ["Total dépenses", totaux.totalDepenses],
    ["Solde net (recettes - dépenses)", totaux.soldeNet],
    ["Total ajustements (réductions, hors trésorerie)", totaux.totalAjustements],
    [],
    ["Catégorie", "Nb lignes", "Total"],
    ...calculerTotauxParCategorie(lignes).map((c) => [c.label, c.nbLignes, c.montant]),
  ];
  const wsSynthese = XLSX.utils.aoa_to_sheet(synthese);
  XLSX.utils.book_append_sheet(wb, wsSynthese, "Synthèse");

  for (const [cat, label] of Object.entries(CATEGORIE_LABELS) as [CategorieExport, string][]) {
    const catLignes = lignes.filter((l) => l.categorie === cat);
    if (catLignes.length === 0) continue;
    const rows = catLignes.map((l) => ({
      Date: l.date,
      Référence: l.reference,
      Tiers: l.tiers,
      Libellé: l.libelle,
      "Mode de règlement": l.modeReglement,
      "Référence bancaire": l.referenceBancaire,
      Montant: l.montant,
      Statut: l.statut,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31));
  }

  XLSX.writeFile(wb, `export-comptable-${periodeDebut}_${periodeFin}.xlsx`);
}
