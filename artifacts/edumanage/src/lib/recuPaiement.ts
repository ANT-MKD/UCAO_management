import { buildPrintDocumentHtml } from "@/lib/printDocument";
import { formatDate } from "@/lib/utils";
import { montantQuittance, statutQuittance } from "@/pages/admin/PaiementsPage";
import type { EtudiantRecord, PaiementRecord } from "@/data/studentStore";

/** Reçu de paiement officiel (en-tête de l'établissement, gabarit commun des documents) — le même
 * document que l'on imprime depuis la caisse (Détail quittance) ou depuis le portail étudiant. */
export function buildQuittanceHtml(args: {
  numero: string;
  emise: string;
  limite: string;
  etudiant: string;
  matricule: string;
  classe: string;
  telephone: string;
  email: string;
  montantQuittance: number;
  montantPaye: number;
  statut: string;
  lignes: { label: string; montant: number }[];
  moyen: string;
  reference: string;
}): string {
  const resteAPayer = Math.max(0, args.montantQuittance - args.montantPaye);
  return buildPrintDocumentHtml({
    badge: "REÇU",
    numero: args.numero,
    date: args.emise,
    metaDroiteExtra: args.limite ? [{ label: "Date limite", valeur: args.limite }] : [],
    destinataireNom: args.etudiant,
    destinataireLignes: [
      `${args.matricule}${args.classe ? ` — ${args.classe}` : ""}`,
      ...(args.telephone ? [args.telephone] : []),
      ...(args.email ? [args.email] : []),
    ],
    metaDroiteLabel: "Statut",
    metaDroiteValeur: args.statut,
    lignes: args.lignes,
    encartLabel: "Méthode de paiement",
    encartLignes: [`Mode : ${args.moyen || "—"}`, `Référence : ${args.reference || "—"}`],
    summary: [
      { label: "Sous-total", montant: args.montantQuittance },
      { label: "Montant payé", montant: args.montantPaye },
      ...(resteAPayer > 0 ? [{ label: "Reste à payer", montant: resteAPayer, emphasis: "due" as const }] : []),
      { label: "Total", montant: args.montantQuittance, emphasis: "total" as const },
    ],
  });
}

/** Reçu officiel d'une quittance, prêt à imprimer : mêmes montants, statut et lignes que la caisse. */
export function recuOfficielHtml(record: PaiementRecord, etudiant?: Pick<EtudiantRecord, "matricule" | "telephone" | "email">): string {
  const lignes = record.lignes && record.lignes.length > 0 ? record.lignes : [{ label: record.rubrique, montant: record.montant }];
  return buildQuittanceHtml({
    numero: record.numeroRecu,
    emise: formatDate(record.date),
    limite: record.dateLimite ? formatDate(record.dateLimite) : "",
    etudiant: record.etudiant,
    matricule: etudiant?.matricule ?? "",
    classe: record.classe,
    telephone: etudiant?.telephone ?? "",
    email: etudiant?.email ?? "",
    montantQuittance: montantQuittance(record),
    montantPaye: record.montant,
    statut: statutQuittance(record),
    lignes,
    moyen: record.moyen,
    reference: record.reference,
  });
}
