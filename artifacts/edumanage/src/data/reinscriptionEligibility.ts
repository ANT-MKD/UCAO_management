import { getEtudiantById } from "./studentStore";
import { getDerogationsPaiement, derogationActivePour } from "./derogationPaiementStore";
import { getDeliberations, DECISION_LABELS, type DeliberationLigne } from "./deliberationStore";
import { computeCreditsCumulesParcours } from "./bulletinEngine";
import { getDettesActivesPourEtudiant } from "./creditDetteStore";
import { getDeliberationsAnnuelles, DECISION_ANNUELLE_LABELS, type DeliberationAnnuelleLigne } from "./deliberationAnnuelleStore";
import type { NiveauRecord } from "./niveauStore";
import { formatCFA } from "@/lib/utils";

export interface ReinscriptionEligibility {
  decision: "allowed" | "conditional" | "blocked";
  reasons: string[];
}

export const LIBELLE_DECISION_REINSCRIPTION: Record<ReinscriptionEligibility["decision"], string> = {
  allowed: "Autorisée",
  conditional: "Sous conditions",
  blocked: "Bloquée",
};

/** Dernière décision de jury connue pour cet étudiant, tous semestres/classes confondus —
 * la délibération la plus récente (par date) dans laquelle il apparaît. */
export function getDerniereLigneDeliberation(etudiantId: string): DeliberationLigne | undefined {
  const deliberationsAvecEtudiant = getDeliberations()
    .filter((d) => d.lignes.some((l) => l.etudiantId === etudiantId))
    .sort((a, b) => b.dateDeliberation.localeCompare(a.dateDeliberation));
  const derniere = deliberationsAvecEtudiant[0];
  return derniere?.lignes.find((l) => l.etudiantId === etudiantId);
}

/** checkReinscriptionEligibility vivait dans studentStore.ts mais utilisait MOYENNES_PROMO
 * (tableau fabriqué, jamais alimenté par une vraie délibération). Déplacé ici pour pouvoir
 * s'appuyer sur deliberationStore.ts sans créer de cycle d'import : deliberationStore importe
 * (via bulletinEngine/assiduiteEngine/declassementEngine) depuis studentStore.ts, donc
 * studentStore.ts ne peut pas importer deliberationStore.ts en retour. */
/** niveauCible : le niveau visé par la réinscription en cours — permet de vérifier le garde-fou
 * de crédits cumulés (NiveauRecord.creditsRequisEntree, ex. 120 crédits requis pour L3). Optionnel
 * pour ne pas casser les appels existants qui ne connaissent pas encore le niveau cible. */
/** Dernière délibération annuelle connue pour cet étudiant (la plus récente), avec son année :
 * c'est elle qui décide du passage, pas le jury de semestre. */
export function getDerniereDecisionAnnuelle(etudiantId: string): { annee: string; ligne: DeliberationAnnuelleLigne } | undefined {
  const derniere = getDeliberationsAnnuelles()
    .filter((d) => d.lignes.some((l) => l.etudiantId === etudiantId))
    .sort((a, b) => b.annee.localeCompare(a.annee) || b.dateDeliberation.localeCompare(a.dateDeliberation))[0];
  const ligne = derniere?.lignes.find((l) => l.etudiantId === etudiantId);
  return derniere && ligne ? { annee: derniere.annee, ligne } : undefined;
}

export function getDerniereLigneDeliberationAnnuelle(etudiantId: string): DeliberationAnnuelleLigne | undefined {
  return getDerniereDecisionAnnuelle(etudiantId)?.ligne;
}

export function checkReinscriptionEligibility(etudiantId: string, niveauCible?: NiveauRecord): ReinscriptionEligibility {
  const etudiant = getEtudiantById(etudiantId);
  if (!etudiant) return { decision: "blocked", reasons: ["Étudiant introuvable"] };
  const reasons: string[] = [];
  let blocked = false;
  let conditional = false;

  if (etudiant.statut === "suspendu") {
    blocked = true;
    reasons.push("Étudiant suspendu");
  }
  if (etudiant.statut === "abandon") {
    blocked = true;
    reasons.push("Étudiant en abandon — réintégration requise avant réinscription");
  }
  if (etudiant.soldeDu > 0) {
    const derogation = derogationActivePour(getDerogationsPaiement(), etudiantId, "reinscription");
    if (derogation) {
      reasons.push(`Impayés en cours (${formatCFA(etudiant.soldeDu)}) — dérogation ${derogation.reference} accordée jusqu'au ${new Date(derogation.dateFin).toLocaleDateString("fr-FR")}`);
    } else {
      conditional = true;
      reasons.push(`Impayés en cours (${formatCFA(etudiant.soldeDu)})`);
    }
  }
  // Règle UCAO : le passage se décide sur l'année (délibération annuelle) ; la délibération de
  // semestre ne sert de repère que si l'année n'a pas encore été délibérée.
  const monte = !!niveauCible && niveauCible.alias !== etudiant.niveau;
  const ligneAnnuelle = getDerniereLigneDeliberationAnnuelle(etudiantId);
  if (ligneAnnuelle) {
    const decision = ligneAnnuelle.decisionFinale;
    if (decision === "admis_avec_dette") {
      conditional = true;
      reasons.push(`Délibération annuelle : ${DECISION_ANNUELLE_LABELS[decision]} — ${ligneAnnuelle.creditsObtenus}/${ligneAnnuelle.creditsTotal} crédits`);
    } else if (decision !== "admis" && monte) {
      blocked = true;
      reasons.push(`Délibération annuelle : ${DECISION_ANNUELLE_LABELS[decision]} — passage au niveau supérieur impossible`);
    } else if (decision !== "admis") {
      conditional = true;
      reasons.push(`Délibération annuelle : ${DECISION_ANNUELLE_LABELS[decision]}`);
    }
  } else {
    const ligne = getDerniereLigneDeliberation(etudiantId);
    if (ligne && ligne.decisionFinale !== "admis") {
      conditional = true;
      reasons.push(`Délibération : ${DECISION_LABELS[ligne.decisionFinale]}`);
    }
  }

  // Règle UCAO : on monte avec une dette d'un seul niveau. Pour entrer en L3, la L1 doit être
  // entièrement validée (tous ses crédits), même si la L2 a été obtenue avec dette.
  if (monte) {
    const { detail } = computeCreditsCumulesParcours(etudiantId, etudiant.filiereId);
    for (const d of detail) {
      if (d.niveau === etudiant.niveau || d.niveau === niveauCible!.alias) continue;
      if (d.creditsTotal > 0 && d.creditsObtenus < d.creditsTotal) {
        blocked = true;
        reasons.push(`Entrée en ${niveauCible!.nom} impossible : ${d.niveau} n'est pas entièrement validé (${d.creditsObtenus}/${d.creditsTotal} crédits)`);
      }
    }
  }

  // Garde-fou de crédits cumulés (ex. 120 crédits requis pour L3) : un contrôle dur, jamais
  // contournable par dérogation contrairement aux impayés — sans quoi le passage conditionnel
  // (AJAC) n'aurait plus de plafond réel. Il ne vaut que pour entrer dans un niveau : un
  // redoublant qui reste dans le sien n'y est pas soumis.
  if (monte && niveauCible?.creditsRequisEntree !== undefined) {
    const { creditsObtenus } = computeCreditsCumulesParcours(etudiantId, etudiant.filiereId);
    if (creditsObtenus < niveauCible.creditsRequisEntree) {
      blocked = true;
      reasons.push(`Crédits cumulés insuffisants pour ${niveauCible.nom} (${creditsObtenus}/${niveauCible.creditsRequisEntree} crédits requis)`);
    }
  }

  const dettesActives = getDettesActivesPourEtudiant(etudiantId);
  if (dettesActives.length > 0) {
    conditional = true;
    reasons.push(`${dettesActives.length} UE en dette de crédit (${dettesActives.reduce((s, d) => s + d.ueCredits, 0)} crédits) à régulariser`);
  }

  if (blocked) return { decision: "blocked", reasons };
  if (conditional) return { decision: "conditional", reasons };
  return { decision: "allowed", reasons: ["Éligible à la réinscription"] };
}
