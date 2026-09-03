import { addTeacher } from "@/data/teacherStore";
import { addFiliere, getFiliereByCode } from "@/data/filiereStore";
import { addNiveau, getNiveaux } from "@/data/niveauStore";
import { addSemestre, getSemestres } from "@/data/semestreStore";
import { importCurriculumRows } from "@/data/curriculumStore";
import { cycleStore } from "@/data/academicSettingsStore";
import { upsertClasse, upsertSalle, getSalles, findClassePedagogique } from "@/data/structureStore";
import { nomClasseStandard } from "@/data/studentStore";

const ANNEE_DEMO = "2025-2026";

/** Bâtiment unique : RDC (administration, aucune salle de cours dédiée) + 1er étage (R1-01..05)
 * + 2e étage (R2-01..05). Idempotent — une salle dont le nom existe déjà n'est pas recréée. */
const SALLES_DEMO = [
  ...Array.from({ length: 5 }, (_, i) => ({
    nom: `R1-0${i + 1}`,
    etage: "1er étage",
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    nom: `R2-0${i + 1}`,
    etage: "2ème étage",
  })),
];

/** 6 filières types d'un établissement UCAO, avec leur responsable pédagogique. Sert de base au
 * générateur de données de démonstration — jamais utilisé ailleurs dans l'app (pas de mock caché
 * en dehors de ce fichier explicitement dédié à la démo). */
const FILIERES_DEMO = [
  { code: "LPIG", nom: "Licence Informatique de Gestion", responsable: { prenom: "Ibrahima", nom: "SARR", specialite: "Génie logiciel", sexe: "M" as const } },
  { code: "LAGB", nom: "Licence Agrobusiness", responsable: { prenom: "Aminata", nom: "DIOP", specialite: "Agroéconomie", sexe: "F" as const } },
  { code: "LSG", nom: "Licence Sciences de Gestion", responsable: { prenom: "Moussa", nom: "NDIAYE", specialite: "Management", sexe: "M" as const } },
  { code: "LCF", nom: "Licence Comptabilité Finance", responsable: { prenom: "Fatou", nom: "FALL", specialite: "Finance d'entreprise", sexe: "F" as const } },
  { code: "LPSPRI", nom: "Licence Sciences Politiques et Relations Internationales", responsable: { prenom: "Cheikh", nom: "GUEYE", specialite: "Relations internationales", sexe: "M" as const } },
  { code: "LQHSE", nom: "Licence Qualité Hygiène Sécurité Environnement", responsable: { prenom: "Awa", nom: "BA", specialite: "Management QHSE", sexe: "F" as const } },
] as const;

/** 3 UE par semestre (18 par filière sur les 6 semestres), thématisées par domaine. */
const CURRICULUM_DEMO: Record<string, string[][]> = {
  LPIG: [
    ["Algorithmique & Programmation", "Mathématiques Appliquées", "Bureautique & Environnement Numérique"],
    ["Bases de Données", "Réseaux Informatiques", "Anglais des Affaires"],
    ["Programmation Orientée Objet", "Systèmes d'Exploitation", "Analyse Économique"],
    ["Génie Logiciel", "Gestion de Projets Informatiques", "Droit du Numérique"],
    ["Développement Web", "Sécurité des Systèmes d'Information", "Management des SI"],
    ["Projet Tutoré", "Intelligence Artificielle Appliquée", "Entrepreneuriat Numérique"],
  ],
  LAGB: [
    ["Introduction à l'Agronomie", "Mathématiques & Statistiques", "Économie Générale"],
    ["Sciences du Sol", "Comptabilité Générale", "Anglais Agricole"],
    ["Agroéconomie", "Techniques de Production Végétale", "Marketing Agroalimentaire"],
    ["Élevage & Productions Animales", "Gestion des Exploitations Agricoles", "Droit Rural"],
    ["Agro-industrie & Transformation", "Chaîne de Valeur Agricole", "Financement Agricole"],
    ["Projet Tutoré", "Développement Durable & Environnement", "Entrepreneuriat Agricole"],
  ],
  LSG: [
    ["Introduction au Management", "Mathématiques pour la Gestion", "Microéconomie"],
    ["Comptabilité Générale", "Droit des Affaires", "Anglais des Affaires"],
    ["Gestion des Ressources Humaines", "Marketing Fondamental", "Macroéconomie"],
    ["Contrôle de Gestion", "Comportement Organisationnel", "Statistiques Appliquées"],
    ["Management Stratégique", "Gestion de la Qualité", "Techniques de Négociation"],
    ["Projet Tutoré", "Système d'Information de Gestion", "Entrepreneuriat"],
  ],
  LCF: [
    ["Comptabilité Générale I", "Mathématiques Financières", "Économie Générale"],
    ["Comptabilité Générale II", "Droit des Sociétés", "Anglais des Affaires"],
    ["Comptabilité Analytique", "Fiscalité Générale", "Statistiques Appliquées"],
    ["Comptabilité des Sociétés", "Analyse Financière", "Droit Fiscal"],
    ["Audit & Contrôle Interne", "Gestion Financière", "Normes IFRS"],
    ["Projet Tutoré", "Trésorerie & Financement", "Fiscalité Approfondie"],
  ],
  LPSPRI: [
    ["Introduction aux Sciences Politiques", "Histoire des Relations Internationales", "Méthodologie du Travail Universitaire"],
    ["Institutions Politiques Comparées", "Droit International Public", "Anglais Diplomatique"],
    ["Géopolitique Mondiale", "Organisations Internationales", "Économie Internationale"],
    ["Diplomatie & Négociation Internationale", "Droits de l'Homme", "Sociologie Politique"],
    ["Sécurité Internationale & Conflits", "Politique Étrangère Comparée", "Coopération Internationale"],
    ["Projet Tutoré", "Enjeux Géostratégiques Contemporains", "Communication Diplomatique"],
  ],
  LQHSE: [
    ["Introduction au Management QHSE", "Chimie Générale & Environnement", "Mathématiques Appliquées"],
    ["Hygiène Industrielle", "Normes Qualité (ISO 9001)", "Anglais Technique"],
    ["Sécurité au Travail", "Gestion des Risques Industriels", "Législation QHSE"],
    ["Management Environnemental (ISO 14001)", "Ergonomie & Conditions de Travail", "Audit QHSE"],
    ["Prévention des Risques Majeurs", "Développement Durable", "Système de Management Intégré"],
    ["Projet Tutoré", "Gestion de Crise & Continuité d'Activité", "Certification QHSE"],
  ],
};

const NIVEAUX_PAR_SEMESTRE = ["L1", "L1", "L2", "L2", "L3", "L3"] as const;

export interface ResultatSeedFiliere {
  filiere: string;
  cree: boolean;
  niveaux: number;
  semestres: number;
  ueCount: number;
  ecCount: number;
  classes: number;
}

/** Crée les 10 salles types (R1-01..05, R2-01..05) si elles n'existent pas encore. Le RDC n'a
 * volontairement aucune salle de cours générée ici (administration). */
export function genererSallesDemo(): { crees: number } {
  const existantes = new Set(getSalles().map((s) => s.nom));
  let crees = 0;
  for (const s of SALLES_DEMO) {
    if (existantes.has(s.nom)) continue;
    upsertSalle({
      nom: s.nom,
      type: "Salle de cours",
      capacite: 40,
      batiment: "Bâtiment principal",
      etage: s.etage,
      equipements: ["Vidéoprojecteur", "Tableau blanc"],
      statut: "actif",
    });
    crees++;
  }
  return { crees };
}

/** Vrai si au moins une des 10 salles de démo existe déjà. */
export function sallesDemoDejaGenerees(): boolean {
  const existantes = new Set(getSalles().map((s) => s.nom));
  return SALLES_DEMO.some((s) => existantes.has(s.nom));
}

/** Étape 1 du générateur de données de démonstration : socle académique complet pour les 6
 * filières types (responsable pédagogique, niveaux L1/L2/L3 avec règles de passage conditionnel
 * AJAC, semestres S1..S6, maquette UE/EC réaliste par domaine, une classe par niveau pour
 * 2025-2026) plus les 10 salles types. Idempotent — une filière dont le code existe déjà est
 * laissée intacte (jamais de doublon si le bouton est cliqué plusieurs fois). */
export function genererDonneesAcademiques(actorId: string): ResultatSeedFiliere[] {
  const cycleLicence = cycleStore.getAll().find((c) => c.code === "LICENCE");
  const resultats: ResultatSeedFiliere[] = [];

  genererSallesDemo();

  for (const f of FILIERES_DEMO) {
    if (getFiliereByCode(f.code)) {
      resultats.push({ filiere: f.code, cree: false, niveaux: 0, semestres: 0, ueCount: 0, ecCount: 0, classes: 0 });
      continue;
    }

    const teacher = addTeacher({
      prenom: f.responsable.prenom,
      nom: f.responsable.nom,
      matricule: `ENS-2025-${f.code}`,
      telephone: "77" + String(Math.floor(1000000 + Math.random() * 8999999)),
      specialite: f.responsable.specialite,
      specialites: [f.responsable.specialite],
      grade: "Permanent",
      tauxHoraire: 0,
      email: `${f.responsable.prenom.toLowerCase()}.${f.responsable.nom.toLowerCase()}@ucao.edu`,
      sexe: f.responsable.sexe,
      dateNaissance: "1978-01-01",
      paysNaissance: "Sénégal",
      lieuNaissance: "Dakar",
      nationalite: "Sénégalaise",
      niveauEtude: "Doctorat",
      diplomes: [`Doctorat en ${f.responsable.specialite}`],
    }, actorId);

    const filiere = addFiliere({
      nom: f.nom,
      code: f.code,
      responsable: `${teacher.prenom} ${teacher.nom}`,
      responsableId: teacher.id,
      statut: "actif",
      cycleId: cycleLicence?.id,
      cycle: cycleLicence?.intitule,
      typeProgramme: "semestriel",
      anneesActives: [ANNEE_DEMO],
      nbClasses: 0,
      nbEtudiants: 0,
    });

    const niveauxDef = [
      { alias: "L1", nom: "Licence 1", passageConditionnelAutorise: true, creditDetteMin: 42, creditsRequisEntree: undefined as number | undefined },
      { alias: "L2", nom: "Licence 2", passageConditionnelAutorise: true, creditDetteMin: 42, creditsRequisEntree: undefined as number | undefined },
      { alias: "L3", nom: "Licence 3", passageConditionnelAutorise: true, creditDetteMin: 42, creditsRequisEntree: 100 as number | undefined },
    ];
    const niveauxCrees: Record<string, ReturnType<typeof addNiveau>> = {};
    for (const nd of niveauxDef) {
      niveauxCrees[nd.alias] = addNiveau({
        nom: nd.nom,
        alias: nd.alias,
        cycle: cycleLicence?.intitule ?? "Licence",
        cycleId: cycleLicence?.id,
        filiere: filiere.code,
        filiereId: filiere.id,
        passageConditionnelAutorise: nd.passageConditionnelAutorise,
        creditDetteMin: nd.creditDetteMin,
        creditsRequisEntree: nd.creditsRequisEntree,
      });
    }

    const semAliasParNiveau: Record<string, string[]> = { L1: ["S1", "S2"], L2: ["S3", "S4"], L3: ["S5", "S6"] };
    let semestresCount = 0;
    for (const [niveauAlias, aliases] of Object.entries(semAliasParNiveau)) {
      for (const alias of aliases) {
        addSemestre({
          nom: `Semestre ${alias.slice(1)}`,
          alias,
          niveau: niveauAlias,
          niveauId: niveauxCrees[niveauAlias].id,
          filiere: filiere.code,
          statut: "actif",
        });
        semestresCount++;
      }
    }

    let classesCount = 0;
    for (const nd of niveauxDef) {
      if (findClassePedagogique(filiere.id, nd.alias, ANNEE_DEMO)) continue;
      upsertClasse({
        nom: nomClasseStandard(filiere.code, nd.alias, ANNEE_DEMO),
        filiereId: filiere.id,
        niveauId: niveauxCrees[nd.alias].id,
        max: 40,
        annee: ANNEE_DEMO,
      });
      classesCount++;
    }

    const rows: Parameters<typeof importCurriculumRows>[0] = [];
    const semestresList = CURRICULUM_DEMO[f.code] ?? [];
    semestresList.forEach((ueNoms, semIdx) => {
      const semAlias = `S${semIdx + 1}`;
      const niveauAlias = NIVEAUX_PAR_SEMESTRE[semIdx];
      ueNoms.forEach((ueNom, ueIdx) => {
        const codeUe = `${f.code}S${semIdx + 1}U${ueIdx + 1}`;
        for (let ecIdx = 1; ecIdx <= 2; ecIdx++) {
          rows.push({
            codeUe,
            libelleUe: ueNom,
            codeEc: `${codeUe}E${ecIdx}`,
            libelleEc: ecIdx === 1 ? `${ueNom} — Fondamentaux` : `${ueNom} — Application`,
            cm: ecIdx === 1 ? 20 : 10,
            td: ecIdx === 1 ? 10 : 15,
            tp: ecIdx === 1 ? 0 : 5,
            tpe: 20,
            credits: 10,
            semestre: semAlias,
            niveau: niveauAlias,
            obligatoire: true,
            filiere: filiere.code,
          });
        }
      });
    });
    const { ueCount, ecCount } = importCurriculumRows(rows, {
      filiere: filiere.code, filiereId: filiere.id, niveau: "L1", semestre: "S1",
    });

    resultats.push({ filiere: f.code, cree: true, niveaux: Object.keys(niveauxCrees).length, semestres: semestresCount, ueCount, ecCount, classes: classesCount });
  }

  return resultats;
}

/** Vrai si au moins une des 6 filières de démo existe déjà (permet à la page de désactiver le
 * bouton "socle académique" une fois généré, plutôt que de laisser croire qu'un second clic ferait
 * quelque chose). */
export function socleAcademiqueDemoDejaGenere(): boolean {
  return FILIERES_DEMO.some((f) => !!getFiliereByCode(f.code));
}

/** Utilisé par l'UI pour afficher un résumé avant génération (nombre de niveaux/semestres/UE/EC
 * qui seront créés au total si aucune filière n'existe encore). */
export function apercuSocleAcademiqueDemo() {
  const totalUe = FILIERES_DEMO.reduce((s, f) => s + (CURRICULUM_DEMO[f.code]?.flat().length ?? 0), 0);
  return {
    filieres: FILIERES_DEMO.length,
    niveaux: FILIERES_DEMO.length * 3,
    semestres: FILIERES_DEMO.length * 6,
    classes: FILIERES_DEMO.length * 3,
    salles: SALLES_DEMO.length,
    ueEstime: totalUe,
    ecEstime: totalUe * 2,
  };
}

// Exposées pour de futures étapes du générateur (étudiants, finances, communication...) qui
// s'appuieront sur les mêmes filières/niveaux/semestres.
export { FILIERES_DEMO, NIVEAUX_PAR_SEMESTRE, getNiveaux, getSemestres };
