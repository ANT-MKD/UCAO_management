import { ecrireStockage } from "@/lib/stockageLocal";
import { getPaiements, getEtudiants, getUserAccounts, payerQuittance, pushNotificationEtPersister, logAudit, type PaiementRecord } from "./studentStore";
import { enregistrerEncaissement } from "./encaissementStore";

/** Montant total facturé d'une quittance (même règle que PaiementsPage.montantQuittance). */
function montantQuittance(p: PaiementRecord): number {
  return p.lignes && p.lignes.length > 0 ? p.lignes.reduce((s, l) => s + l.montant, 0) : p.montant;
}

const STORAGE_KEY = "edumanage-paiements-declares-v1";

export type StatutPaiementDeclare = "a_verifier" | "confirme" | "rejete";

/** Paiement Wave / Orange Money déclaré par l'étudiant depuis son portail. Tant qu'aucune passerelle
 * de paiement n'est branchée, rien ne prouve que l'argent est arrivé : la déclaration n'efface donc
 * aucune dette. Elle attend que la caisse la rapproche de son relevé, et c'est seulement à la
 * confirmation qu'elle devient un vrai règlement (quittance + encaissement). */
export interface PaiementDeclareRecord {
  id: string;
  quittanceId: string;
  quittanceReference: string;
  rubrique: string;
  etudiantId: string;
  etudiantLabel: string;
  montant: number;
  moyen: string;
  telephone: string;
  referenceTransaction: string;
  declareLe: string;
  statut: StatutPaiementDeclare;
  traiteLe?: string;
  traitePar?: string;
  motifRejet?: string;
}

let store: PaiementDeclareRecord[] = load();
const listeners = new Set<() => void>();

function load(): PaiementDeclareRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as PaiementDeclareRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") ecrireStockage(STORAGE_KEY, JSON.stringify(store));
  listeners.forEach((fn) => fn());
}

export function subscribePaiementsDeclares(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPaiementsDeclares(): PaiementDeclareRecord[] {
  return store;
}

/** Montant déjà déclaré et encore en vérification sur une facture : il ne peut pas être déclaré
 * une seconde fois, sinon la même somme serait comptée deux fois à la confirmation. */
export function montantEnVerification(quittanceId: string): number {
  return store.filter((d) => d.quittanceId === quittanceId && d.statut === "a_verifier").reduce((s, d) => s + d.montant, 0);
}

function resteAPayer(quittanceId: string): number {
  const q = getPaiements().find((p) => p.id === quittanceId);
  return q ? montantQuittance(q) - q.montant : 0;
}

export interface DeclarerPaiementPayload {
  quittanceId: string;
  etudiantId: string;
  montant: number;
  moyen: string;
  telephone: string;
  referenceTransaction: string;
}

export function declarerPaiement(payload: DeclarerPaiementPayload): PaiementDeclareRecord {
  const q = getPaiements().find((p) => p.id === payload.quittanceId && p.etudiantId === payload.etudiantId);
  if (!q || q.statut === "annule") throw new Error("Facture introuvable.");
  const disponible = resteAPayer(q.id) - montantEnVerification(q.id);
  if (payload.montant <= 0 || payload.montant > disponible) {
    throw new Error(`Montant invalide : au plus ${disponible.toLocaleString("fr-FR")} F CFA peuvent encore être déclarés sur cette facture.`);
  }
  const etudiant = getEtudiants().find((e) => e.id === payload.etudiantId);
  const record: PaiementDeclareRecord = {
    id: `pdecl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    quittanceId: q.id,
    quittanceReference: q.numeroRecu || q.reference,
    rubrique: q.rubrique,
    etudiantId: payload.etudiantId,
    etudiantLabel: etudiant ? `${etudiant.matricule} - ${etudiant.prenom} ${etudiant.nom}` : payload.etudiantId,
    montant: payload.montant,
    moyen: payload.moyen,
    telephone: payload.telephone.trim(),
    referenceTransaction: payload.referenceTransaction.trim(),
    declareLe: new Date().toISOString(),
    statut: "a_verifier",
  };
  store = [record, ...store];
  persist();
  for (const admin of getUserAccounts().filter((u) => u.role === "admin" && u.actif !== false)) {
    pushNotificationEtPersister(admin.id, `Paiement en ligne à vérifier : ${record.etudiantLabel} — ${record.montant.toLocaleString("fr-FR")} F CFA (${record.moyen}, réf. ${record.referenceTransaction}).`);
  }
  return record;
}

function compteEtudiant(etudiantId: string) {
  return getUserAccounts().find((u) => u.role === "student" && u.linkedId === etudiantId);
}

/** La caisse a retrouvé la transaction sur son relevé : la déclaration devient un vrai règlement,
 * exactement comme un encaissement saisi au guichet. */
export function confirmerPaiementDeclare(id: string, acteur: { id: string; name: string }): void {
  const d = store.find((x) => x.id === id);
  if (!d || d.statut !== "a_verifier") throw new Error("Ce paiement n'est plus à vérifier.");
  const q = getPaiements().find((p) => p.id === d.quittanceId);
  if (!q || q.statut === "annule") throw new Error("La facture a été annulée entre-temps.");
  if (d.montant > resteAPayer(q.id)) throw new Error("La facture a déjà été réglée entre-temps : rejetez cette déclaration.");
  const etudiant = getEtudiants().find((e) => e.id === d.etudiantId);
  const date = new Date().toISOString().slice(0, 10);
  const reference = `${d.moyen.toUpperCase().replace(/\s+/g, "-")}-${d.referenceTransaction}`;
  const dejaPayeAvant = q.montant;
  const quittanceLignes = q.lignes && q.lignes.length > 0 ? q.lignes : [{ label: q.rubrique, montant: montantQuittance(q) }];
  payerQuittance({ id: q.id, montant: d.montant, moyen: d.moyen, reference, date });
  enregistrerEncaissement({
    quittanceId: q.id,
    quittanceReference: q.numeroRecu,
    quittanceDateEmission: q.date,
    quittanceDateLimite: q.dateLimite,
    montantQuittanceTotal: montantQuittance(q),
    quittanceLignes,
    dejaPayeAvant,
    etudiantId: d.etudiantId,
    payeur: d.etudiantLabel,
    filiere: etudiant?.filiere ?? "",
    annee: etudiant?.annee ?? "",
    montant: d.montant,
    moyen: d.moyen,
    referenceBancaire: reference,
    date,
    encaissePar: `${acteur.name} (paiement en ligne vérifié)`,
  });
  d.statut = "confirme";
  d.traiteLe = new Date().toISOString();
  d.traitePar = acteur.name;
  persist();
  logAudit(acteur.id, "confirmer_paiement_declare", "paiement", d.quittanceId, `${d.montant} ${d.moyen} ${d.referenceTransaction}`);
  const compte = compteEtudiant(d.etudiantId);
  if (compte) pushNotificationEtPersister(compte.id, `Votre paiement de ${d.montant.toLocaleString("fr-FR")} F CFA (${d.moyen}) a été vérifié et enregistré.`);
}

/** Transaction introuvable sur le relevé (ou montant différent) : rien n'est enregistré et
 * l'étudiant est prévenu du motif. */
export function rejeterPaiementDeclare(id: string, acteur: { id: string; name: string }, motif: string): void {
  const d = store.find((x) => x.id === id);
  if (!d || d.statut !== "a_verifier") throw new Error("Ce paiement n'est plus à vérifier.");
  if (!motif.trim()) throw new Error("Indiquez le motif du rejet.");
  d.statut = "rejete";
  d.traiteLe = new Date().toISOString();
  d.traitePar = acteur.name;
  d.motifRejet = motif.trim();
  persist();
  logAudit(acteur.id, "rejeter_paiement_declare", "paiement", d.quittanceId, motif.trim());
  const compte = compteEtudiant(d.etudiantId);
  if (compte) pushNotificationEtPersister(compte.id, `Votre paiement déclaré de ${d.montant.toLocaleString("fr-FR")} F CFA n'a pas pu être vérifié : ${d.motifRejet}. Contactez la caisse.`);
}
