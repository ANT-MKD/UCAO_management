import { logAudit } from "./studentStore";

const STORAGE_KEY = "edumanage-signature-config-v1";

/** Reflète les types de documents réellement générés par l'appli : "bulletin" couvre à la fois
 * relevé et bulletin de notes (même génération, RelevesPage.tsx) ; les 3 autres sont les types
 * réels d'attestationStore.ts. Jamais une catégorie inventée sans document derrière. */
export type SignatureDocType = "bulletin" | "inscription" | "reussite" | "scolarite";

export const SIGNATURE_DOC_LABELS: Record<SignatureDocType, string> = {
  bulletin: "Bulletin / Relevé de notes",
  inscription: "Attestation d'inscription",
  reussite: "Attestation de réussite",
  scolarite: "Certificat de scolarité",
};

export interface SignatureConfig {
  actif: boolean;
  signataireNom: string;
  signataireQualite: string;
  imageDataUrl?: string;
}

type SignatureState = Record<SignatureDocType, SignatureConfig>;

const DEFAULT_CONFIG: SignatureConfig = { actif: false, signataireNom: "", signataireQualite: "Le Directeur" };

function defaultState(): SignatureState {
  return {
    bulletin: { ...DEFAULT_CONFIG },
    inscription: { ...DEFAULT_CONFIG },
    reussite: { ...DEFAULT_CONFIG },
    scolarite: { ...DEFAULT_CONFIG },
  };
}

function load(): SignatureState {
  const state = defaultState();
  if (typeof window === "undefined") return state;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return state;
    const parsed = JSON.parse(raw) as Partial<SignatureState>;
    (Object.keys(state) as SignatureDocType[]).forEach((key) => {
      if (parsed[key]) state[key] = { ...state[key], ...parsed[key] };
    });
    return state;
  } catch {
    return state;
  }
}

let store: SignatureState = load();

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

export function subscribeSignatureConfig(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSignatureConfigState(): SignatureState {
  return store;
}

/** Consultée directement par les générateurs de documents (printDocument.ts pour les attestations,
 * RelevesPage.tsx pour les bulletins) — s'il n'y a pas d'image ou que le type n'est pas activé, le
 * document imprime simplement une ligne de signature vide comme avant. */
export function getSignatureConfig(docType: SignatureDocType): SignatureConfig {
  return store[docType];
}

export function setSignatureConfig(docType: SignatureDocType, config: SignatureConfig, actorId: string): void {
  store = { ...store, [docType]: config };
  logAudit(actorId, "update_signature_config", "signature_config", docType, config.actif ? "activée" : "désactivée");
  persist();
}
