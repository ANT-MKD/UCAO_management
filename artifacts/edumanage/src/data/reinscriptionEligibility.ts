import { getEtudiantById } from "./studentStore";
import { getDerogationsPaiement, derogationActivePour } from "./derogationPaiementStore";
import { getDeliberations, DECISION_LABELS, type DeliberationLigne } from "./deliberationStore";

export interface ReinscriptionEligibility {
  decision: "allowed" | "conditional" | "blocked";
  reasons: string[];
}

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
export function checkReinscriptionEligibility(etudiantId: string): ReinscriptionEligibility {
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
      reasons.push(`Impayés en cours (${etudiant.soldeDu} FCFA) — dérogation ${derogation.reference} accordée jusqu'au ${derogation.dateFin}`);
    } else {
      conditional = true;
      reasons.push(`Impayés en cours (${etudiant.soldeDu} FCFA)`);
    }
  }
  const ligne = getDerniereLigneDeliberation(etudiantId);
  if (ligne && ligne.decisionFinale !== "admis") {
    conditional = true;
    reasons.push(`Délibération : ${DECISION_LABELS[ligne.decisionFinale]}`);
  }

  if (blocked) return { decision: "blocked", reasons };
  if (conditional) return { decision: "conditional", reasons };
  return { decision: "allowed", reasons: ["Éligible à la réinscription"] };
}
