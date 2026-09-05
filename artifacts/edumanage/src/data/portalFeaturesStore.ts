export type PortalWithFeatures = "student" | "teacher";

export interface PortalFeatureItem {
  id: string;
  label: string;
  href: string;
}

/** Reflète exactement STUDENT_NAV_ITEMS de StudentLayout.tsx — jamais une liste de fonctionnalités
 * inventée séparément du vrai menu du portail. */
export const STUDENT_PORTAL_FEATURES: PortalFeatureItem[] = [
  { id: "student-dashboard", label: "Dashboard", href: "/student/dashboard" },
  { id: "student-schedule", label: "Emploi du temps", href: "/student/schedule" },
  { id: "student-cours", label: "Cours", href: "/student/cours" },
  { id: "student-cahier", label: "Cahier de texte", href: "/student/cahier" },
  { id: "student-ressources", label: "Ressources pédagogiques", href: "/student/ressources" },
  { id: "student-notes", label: "Notes", href: "/student/notes" },
  { id: "student-releves", label: "Relevés & bulletins", href: "/student/releves" },
  { id: "student-absences", label: "Absences/retards", href: "/student/absences" },
  { id: "student-frais-paye", label: "Frais payé", href: "/student/frais-paye" },
  { id: "student-frais-impaye", label: "Frais impayé", href: "/student/frais-impaye" },
  { id: "student-payer-factures", label: "Payer factures", href: "/student/payer-factures" },
  { id: "student-messages", label: "Messagerie", href: "/student/messages" },
  { id: "student-requests", label: "Mes demandes", href: "/student/requests" },
  { id: "student-documents", label: "Mes documents", href: "/student/documents" },
  { id: "student-profile", label: "Profil", href: "/student/profile" },
];

/** Reflète exactement NAV de TeacherLayout.tsx. */
export const TEACHER_PORTAL_FEATURES: PortalFeatureItem[] = [
  { id: "teacher-dashboard", label: "Tableau de bord", href: "/teacher/dashboard" },
  { id: "teacher-schedule", label: "Mon EDT", href: "/teacher/schedule" },
  { id: "teacher-modules", label: "Mes modules", href: "/teacher/modules" },
  { id: "teacher-grades", label: "Saisie notes", href: "/teacher/grades" },
  { id: "teacher-cahier", label: "Cahier de séance", href: "/teacher/cahier" },
  { id: "teacher-ressources", label: "Ressources pédagogiques", href: "/teacher/ressources" },
  { id: "teacher-rallonge", label: "Demande de rallonge", href: "/teacher/rallonge" },
  { id: "teacher-contract", label: "Mon contrat", href: "/teacher/contract" },
];

/** Item toujours accessible dans chaque portail : c'est là que le login redirige, le désactiver
 * verrouillerait le portail entier sans passer par le coupe-circuit global. */
const HOME_FEATURE_ID: Record<PortalWithFeatures, string> = {
  student: "student-dashboard",
  teacher: "teacher-dashboard",
};

export function getFeaturesForPortal(portal: PortalWithFeatures): PortalFeatureItem[] {
  return portal === "student" ? STUDENT_PORTAL_FEATURES : TEACHER_PORTAL_FEATURES;
}

export function isHomeFeature(portal: PortalWithFeatures, featureId: string): boolean {
  return HOME_FEATURE_ID[portal] === featureId;
}

const STORAGE_KEY = "edumanage-portal-features-v1";

type FeaturesState = Record<string, boolean>;

function defaultState(): FeaturesState {
  const state: FeaturesState = {};
  [...STUDENT_PORTAL_FEATURES, ...TEACHER_PORTAL_FEATURES].forEach((f) => { state[f.id] = true; });
  return state;
}

function load(): FeaturesState {
  const state = defaultState();
  if (typeof window === "undefined") return state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return state;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const key of Object.keys(state)) {
      if (typeof parsed[key] === "boolean") state[key] = parsed[key] as boolean;
    }
    return state;
  } catch {
    return state;
  }
}

let store: FeaturesState = load();

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function persist() {
  store = { ...store };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribePortalFeatures(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPortalFeaturesState(): FeaturesState {
  return store;
}

/** Valeur par défaut sûre : un id absent (ex. legacy) reste actif — jamais de blocage silencieux
 * après une évolution du catalogue. */
export function isFeatureActif(featureId: string): boolean {
  return store[featureId] !== false;
}

export function setFeatureActif(portal: PortalWithFeatures, featureId: string, actif: boolean): void {
  if (!actif && isHomeFeature(portal, featureId)) {
    throw new Error("Cette page est la page d'accueil du portail — elle ne peut pas être désactivée (risque de verrouillage).");
  }
  store = { ...store, [featureId]: actif };
  persist();
}

/** Retrouve l'id de fonctionnalité correspondant à l'URL courante — même logique de résolution par
 * préfixe que resolveNavFromLocation (adminNavConfig), pour le garde-fou de route des portails
 * Étudiant/Professeur. */
export function resolveFeatureIdFromLocation(portal: PortalWithFeatures, location: string): string | null {
  const features = getFeaturesForPortal(portal);
  let best: { id: string; score: number } | null = null;
  for (const f of features) {
    const matches = location === f.href || location.startsWith(f.href + "/");
    if (matches && (!best || f.href.length > best.score)) {
      best = { id: f.id, score: f.href.length };
    }
  }
  return best?.id ?? null;
}
