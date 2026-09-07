import { getEtudiantById, getPaiementsByEtudiant, marquerEtudiantAbandon, reintegrerEtudiantStatut } from "./studentStore";

const STORAGE_KEY = "edumanage-abandons-v1";

/** Dossier d'abandon : fige la situation réelle de l'étudiant au moment de l'abandon (comme
 * DerogationPaiementRecord fige déjà soldeDuConstate) — jamais recalculée après coup, sinon le
 * dossier officiel changerait de valeur au fil du temps. Jamais de suppression : reintegre passe
 * simplement à true, l'historique reste consultable. */
export interface AbandonRecord {
  id: string;
  etudiantId: string;
  matricule: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  dateNaissance: string;
  lieuNaissance?: string;
  nationalite?: string;
  // Situation figée au moment de l'abandon
  filiere: string;
  filiereId: string;
  niveau: string;
  classe: string;
  classeId: string;
  annee: string;
  sessionsAbandonnees: string[];
  cumulPaye: number;
  cumulImpaye: number;
  statutAvant: string;
  // Le dossier lui-même
  dateAbandon: string;
  motif: string;
  valideParId: string;
  valideParLabel: string;
  reintegre: boolean;
  dateReintegration?: string;
  reintegreParLabel?: string;
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeAbandons(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

interface Persisted {
  records: AbandonRecord[];
}

function load(): Persisted {
  if (typeof window === "undefined") return { records: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [] };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return { records: parsed.records ?? [] };
  } catch {
    return { records: [] };
  }
}

let store: Persisted = load();

function persist() {
  store = { records: store.records.slice() };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function getAbandons(): AbandonRecord[] {
  return store.records;
}

/** Dossier d'abandon actif (non réintégré) pour un étudiant — un étudiant déjà en abandon ne
 * doit pas pouvoir être sélectionné à nouveau depuis Nouvel abandon. */
export function getAbandonActifPourEtudiant(etudiantId: string): AbandonRecord | undefined {
  return store.records.find((r) => r.etudiantId === etudiantId && !r.reintegre);
}

export interface NouvelAbandonPayload {
  etudiantId: string;
  sessionsAbandonnees: string[];
  dateAbandon: string;
  motif: string;
  valideParId: string;
  valideParLabel: string;
}

export function creerAbandon(payload: NouvelAbandonPayload): AbandonRecord | undefined {
  const etudiant = getEtudiantById(payload.etudiantId);
  if (!etudiant) return undefined;
  const cumulPaye = getPaiementsByEtudiant(etudiant.id).reduce((sum, p) => sum + p.montant, 0);
  const statutAvant = marquerEtudiantAbandon(etudiant.id);
  if (statutAvant === undefined) return undefined;

  const record: AbandonRecord = {
    id: `aband-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    etudiantId: etudiant.id,
    matricule: etudiant.matricule,
    nom: etudiant.nom,
    prenom: etudiant.prenom,
    email: etudiant.email,
    telephone: etudiant.telephone,
    dateNaissance: etudiant.dateNaissance,
    lieuNaissance: etudiant.lieuNaissance,
    nationalite: etudiant.nationalite,
    filiere: etudiant.filiere,
    filiereId: etudiant.filiereId,
    niveau: etudiant.niveau,
    classe: etudiant.classe,
    classeId: etudiant.classeId,
    annee: etudiant.annee,
    sessionsAbandonnees: payload.sessionsAbandonnees,
    cumulPaye,
    cumulImpaye: etudiant.soldeDu,
    statutAvant,
    dateAbandon: payload.dateAbandon,
    motif: payload.motif,
    valideParId: payload.valideParId,
    valideParLabel: payload.valideParLabel,
    reintegre: false,
  };
  store.records = [record, ...store.records];
  persist();
  return record;
}

export function reintegrerAbandon(id: string, reintegreParLabel: string): AbandonRecord | undefined {
  const idx = store.records.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  const record = store.records[idx];
  if (record.reintegre) return record;

  reintegrerEtudiantStatut(record.etudiantId, record.statutAvant);

  const updated: AbandonRecord = {
    ...record,
    reintegre: true,
    dateReintegration: new Date().toISOString().slice(0, 10),
    reintegreParLabel,
  };
  store.records = store.records.map((r, i) => (i === idx ? updated : r));
  persist();
  return updated;
}
