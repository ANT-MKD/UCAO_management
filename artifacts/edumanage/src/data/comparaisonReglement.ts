import { computeBulletin, ueAcquise, type BulletinEtudiant } from "./bulletinEngine";
import { getInscriptions, getEtudiantById } from "./studentStore";
import { getHeuresAbsenceNonJustifieePourEtudiant } from "./assiduiteEngine";
import { getRegleValidation } from "./reglesValidationStore";
import { getNiveaux } from "./niveauStore";
import { decisionSemestre, DECISION_LABELS } from "./deliberationStore";
import { decisionAnnee, DECISION_ANNUELLE_LABELS, type SemestreAnnuel } from "./deliberationAnnuelleStore";
import { formulesPour } from "./reglementCalculStore";
import { sessionFigee } from "./resultatsFigesStore";
import { NIVEAUX, SEMESTRES } from "./mockData";
import { formatNote } from "@/lib/notes";
import type { FormulesCalcul } from "./formulesCalcul";

export interface ChangementResultat {
  etudiantId: string;
  etudiant: string;
  matricule: string;
  periode: string;
  quoi: "Moyenne" | "Crédits" | "Décision";
  avant: string;
  apres: string;
}

export interface ComparaisonReglement {
  nbEtudiants: number;
  nbEtudiantsChanges: number;
  changements: ChangementResultat[];
  /** Sessions dont le jury est clôturé : leurs résultats sont figés, le projet ne les touche pas. */
  sessionsFigees: number;
}

/** Compare, pour chaque étudiant inscrit cette année dans ces filières, les résultats actuels et
 * ceux qu'il aurait avec les formules proposées : moyenne et crédits de chaque semestre, décision
 * du semestre et décision de l'année. Ne modifie rien. */
export function comparerReglement(projet: { annee: string; filiereIds: string[]; formules: FormulesCalcul }): ComparaisonReglement {
  const inscriptions = getInscriptions().filter((i) => i.annee === projet.annee && projet.filiereIds.includes(i.filiereId));
  const vus = new Set<string>();
  const changements: ChangementResultat[] = [];
  const etudiantsChanges = new Set<string>();
  let sessionsFigees = 0;
  const figeesVues = new Set<string>();

  for (const insc of inscriptions) {
    const cle = `${insc.etudiantId}|${insc.classeId}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    const etudiant = getEtudiantById(insc.etudiantId);
    if (!etudiant) continue;
    const niveau = NIVEAUX.find((n) => n.filiereId === insc.filiereId && n.alias === insc.niveau);
    const semestres = niveau ? SEMESTRES.filter((s) => s.niveauId === niveau.id).map((s) => s.alias) : [];
    const regleSemestre = getRegleValidation(insc.filiereId, "semestre");
    const regleAnnee = getRegleValidation(insc.filiereId, "annee");
    const actuelles = formulesPour(insc.filiereId, projet.annee);
    const ajouter = (periode: string, quoi: ChangementResultat["quoi"], avant: string, apres: string) => {
      if (avant === apres) return;
      changements.push({ etudiantId: etudiant.id, etudiant: `${etudiant.prenom} ${etudiant.nom}`, matricule: etudiant.matricule, periode, quoi, avant, apres });
      etudiantsChanges.add(etudiant.id);
    };

    const annuelAvant: SemestreAnnuel[] = [];
    const annuelApres: SemestreAnnuel[] = [];
    let absencesAnnee = 0;
    let ueNonAcquisesAvant = 0;
    let ueNonAcquisesApres = 0;
    for (const alias of semestres) {
      const avant = computeBulletin(etudiant.id, insc.classeId, insc.filiereId, insc.niveau, alias);
      const fige = sessionFigee(insc.classeId, alias);
      if (fige && !figeesVues.has(`${insc.classeId}|${alias}`)) { figeesVues.add(`${insc.classeId}|${alias}`); sessionsFigees++; }
      const apres: BulletinEtudiant = fige ? avant : computeBulletin(etudiant.id, insc.classeId, insc.filiereId, insc.niveau, alias, { formules: projet.formules });
      const absences = getHeuresAbsenceNonJustifieePourEtudiant(etudiant.id, insc.classeId, alias);
      absencesAnnee += absences;
      annuelAvant.push({ semestreAlias: alias, moyenne: avant.moyenneSession, creditsObtenus: avant.creditsObtenus, creditsTotal: avant.creditsTotal });
      annuelApres.push({ semestreAlias: alias, moyenne: apres.moyenneSession, creditsObtenus: apres.creditsObtenus, creditsTotal: apres.creditsTotal });
      ueNonAcquisesAvant += avant.ues.filter((u) => !ueAcquise(u)).length;
      ueNonAcquisesApres += apres.ues.filter((u) => !ueAcquise(u)).length;
      if (avant.moyenneSession === undefined && apres.moyenneSession === undefined) continue;
      ajouter(alias, "Moyenne", formatNote(avant.moyenneSession), formatNote(apres.moyenneSession));
      ajouter(alias, "Crédits", `${avant.creditsObtenus}/${avant.creditsTotal}`, `${apres.creditsObtenus}/${apres.creditsTotal}`);
      if (regleSemestre) {
        ajouter(alias, "Décision",
          DECISION_LABELS[decisionSemestre(avant, absences, regleSemestre, actuelles)],
          DECISION_LABELS[decisionSemestre(apres, absences, regleSemestre, projet.formules)]);
      }
    }
    if (regleAnnee && annuelAvant.some((s) => s.moyenne !== undefined)) {
      const niveauRecord = getNiveaux().find((n) => n.filiereId === insc.filiereId && n.alias === insc.niveau);
      const moyenneDe = (l: SemestreAnnuel[]) => { const m = l.filter((x) => x.moyenne !== undefined).map((x) => x.moyenne!); return m.length ? m.reduce((s, x) => s + x, 0) / m.length : undefined; };
      const commun = { absences: absencesAnnee, regle: regleAnnee, niveau: niveauRecord };
      ajouter("Année", "Décision",
        DECISION_ANNUELLE_LABELS[decisionAnnee({ ...commun, moyenne: moyenneDe(annuelAvant), semestres: annuelAvant, nbUeNonAcquises: ueNonAcquisesAvant, formules: actuelles })],
        DECISION_ANNUELLE_LABELS[decisionAnnee({ ...commun, moyenne: moyenneDe(annuelApres), semestres: annuelApres, nbUeNonAcquises: ueNonAcquisesApres, formules: projet.formules })]);
    }
  }

  return { nbEtudiants: new Set(inscriptions.map((i) => i.etudiantId)).size, nbEtudiantsChanges: etudiantsChanges.size, changements, sessionsFigees };
}
