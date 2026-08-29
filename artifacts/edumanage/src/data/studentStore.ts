import {
  ETUDIANTS as SEED_ETUDIANTS,
  FILIERES,
  ANNEES_ACADEMIQUES,
  PAIEMENTS as SEED_PAIEMENTS,
  NOTES as SEED_NOTES,
  SEANCES as SEED_SEANCES,
  ENSEIGNANTS,
  MOYENNES_PROMO,
  SEMESTRES,
} from "./mockData";
import { getEcs, getUes } from "./curriculumStore";
import { findClassePedagogique, getClasseById, getSalleById, incrementClasseEffectif } from "./structureStore";
import { detectScheduleConflicts, type SeanceSlot } from "@/lib/scheduleUtils";
import { getDerogationsPaiement, derogationActivePour } from "./derogationPaiementStore";
import { getEvaluations } from "./evaluationStore";

export interface EtudiantRecord {
  id: string;
  prenom: string;
  nom: string;
  matricule: string;
  sexe: "M" | "F";
  dateNaissance: string;
  email: string;
  telephone: string;
  filiere: string;
  filiereId: string;
  classe: string;
  classeId: string;
  niveau: string;
  statut: string;
  soldeDu: number;
  /** Crédit disponible (avoir) — utilisable comme moyen de paiement "AVOIR" sur une quittance. */
  soldeAvoir: number;
  annee: string;
  anneePremiereInscription: number;
  inscriptionUniquePayee: boolean;
  /** Dossier inscription enrichi (optionnel) */
  lieuNaissance?: string;
  pays?: string;
  nationalite?: string;
  cni?: string;
  typeAdmission?: "nouveau" | "transfert";
  documentsFournis?: string[];
}

export interface InscriptionRecord {
  id: string;
  etudiantId: string;
  annee: string;
  filiere: string;
  filiereId: string;
  niveau: string;
  classe: string;
  classeId: string;
  statut: string;
  type: "premiere" | "reinscription" | "correction" | "bascule";
  dateInscription: string;
  soldeDu: number;
  specialite?: string;
  modeleFraisId?: string;
  modeleFrais?: string;
  motif?: string;
  effectuePar?: string;
}

export interface PaiementLigne {
  label: string;
  montant: number;
}

export interface PaiementRecord {
  id: string;
  date: string;
  etudiant: string;
  etudiantId: string;
  classe: string;
  /** Libellé synthèse (ex. "Facture unique") */
  rubrique: string;
  /** Détail multi-rubriques sur un seul reçu */
  lignes?: PaiementLigne[];
  montant: number;
  moyen: string;
  reference: string;
  numeroRecu: string;
  soldeRestant: number;
  statut: "paye" | "annule" | string;
  /** Date limite de règlement de la quittance */
  dateLimite?: string;
}

export interface AnneeAcademiqueRecord {
  id: string;
  libelle: string;
  actuelle: boolean;
  cloturee?: boolean;
}

export interface CahierPresenceEntry {
  etudiantId: string;
  nom: string;
  statut: "present" | "absent" | "retard";
  justification?: string;
}

export interface CahierAttachment {
  id: string;
  nom: string;
  type: string;
  tailleKo?: number;
  /** Référence locale (nom fichier) — pas de stockage binaire lourd */
  ref: string;
}

export interface CahierTravail {
  devoirDonne: string;
  dateLimite: string;
  fichierARemettre: string;
  bareme: string;
  statutRemises: "non_ouvert" | "ouvert" | "partiel" | "clos";
}

export interface CahierEvaluation {
  types: ("quiz" | "controle" | "tp" | "projet" | "examen")[];
  detail: string;
}

export interface CahierSeanceRecord {
  id: string;
  seanceId: string;
  /** Infos générales (corrélées app) */
  annee: string;
  semestre: string;
  departement: string;
  filiere: string;
  filiereId: string;
  niveau: string;
  ue: string;
  ueId: string;
  ec: string;
  ecId: string;
  classeId: string;
  classe: string;
  prof: string;
  salle: string;
  salleId: string;
  /** Séance */
  date: string;
  heureDebut: string;
  heureFin: string;
  typeSeance: string;
  sujet: string;
  resume: string;
  /** @deprecated alias résumé pour anciens cahiers */
  activite?: string;
  competences: string;
  liensExternes: string[];
  photosTableau: string[];
  piecesJointes: CahierAttachment[];
  /** Présences */
  presences: CahierPresenceEntry[];
  absents: string[];
  retards: string[];
  tauxPresence: number;
  /** Travaux & évaluations */
  travail?: CahierTravail;
  evaluation?: CahierEvaluation;
  /** Validation pédagogique */
  etatSeance: "preparee" | "realisee" | "annulee";
  motifAnnulation?: string;
  statut: "brouillon" | "soumis" | "valide" | "rejete";
  validatedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface NoteRecord {
  id: string;
  etudiant: string;
  etudiantId: string;
  matricule: string;
  ec: string;
  ecId: string;
  type: string;
  note: number;
  statut: "brouillon_prof" | "soumis_admin" | "valide_admin" | "publie";
  classeId: string;
  annee: string;
  /** Note d'examen retentée en session de rattrapage : distincte de l'EF normal (jamais
   * écrasé), mais la plus récente fait foi pour le calcul de la moyenne finale. */
  session?: "rattrapage";
}

export type UserRole = "admin" | "teacher" | "student";

export interface UserAccountRecord {
  id: string;
  role: UserRole;
  email: string;
  password: string;
  identifier: string;
  displayName: string;
  linkedId?: string;
}

export interface StudentRequestRecord {
  id: string;
  studentId: string;
  type: "justificatif_absence" | "attestation" | "reclamation_note";
  subject: string;
  message: string;
  status: "nouveau" | "en_cours" | "valide" | "rejete";
  createdAt: string;
  handledBy?: string;
  resolution?: string;
}

export interface MessageRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  subject: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface AuditLogRecord {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  meta?: string;
}

export interface SeanceRecord {
  id: string;
  ec: string;
  ecId: string;
  classe: string;
  classeId: string;
  jour: number;
  heureDebut: string;
  heureFin: string;
  salle: string;
  salleId: string;
  prof: string;
  type: string;
  annee: string;
}

export interface ReleveRecord {
  id: string;
  etudiantId: string;
  etudiant: string;
  matricule: string;
  classe: string;
  filiere: string;
  semestre: string;
  statut: "genere" | "envoye" | "en_attente";
  dateGeneration: string;
  ecId: string;
}

interface StoreData {
  etudiants: EtudiantRecord[];
  inscriptions: InscriptionRecord[];
  matriculeCounters: Record<string, number>;
  annees: AnneeAcademiqueRecord[];
  paiements: PaiementRecord[];
  notes: NoteRecord[];
  seances: SeanceRecord[];
  releves: ReleveRecord[];
  users: UserAccountRecord[];
  requests: StudentRequestRecord[];
  messages: MessageRecord[];
  notifications: NotificationRecord[];
  auditLogs: AuditLogRecord[];
  cahiers: CahierSeanceRecord[];
  receiptCounter: number;
}

const STORAGE_KEY = "edumanage-app-store-v2";
const LEGACY_STORAGE_KEY = "edumanage-student-store-v1";
const AUTH_STORAGE_KEY = "edumanage-auth-session";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function parseMatriculeYear(matricule: string): number {
  const m = matricule.match(/^(\d{4})-/);
  return m ? Number(m[1]) : new Date().getFullYear();
}

function buildSeedInscriptions(etudiants: EtudiantRecord[]): InscriptionRecord[] {
  const rows: InscriptionRecord[] = [];
  for (const e of etudiants) {
    rows.push({
      id: `ins-${e.id}-2025`,
      etudiantId: e.id,
      annee: e.annee,
      filiere: e.filiere,
      filiereId: e.filiereId,
      niveau: e.niveau,
      classe: e.classe,
      classeId: e.classeId,
      statut: e.statut,
      type: "premiere",
      dateInscription: "2025-09-01",
      soldeDu: e.soldeDu,
    });
    if (e.id === "et15") {
      rows.push({
        id: `ins-${e.id}-2024`,
        etudiantId: e.id,
        annee: "2024-2025",
        filiere: e.filiere,
        filiereId: e.filiereId,
        niveau: "L2",
        classe: "L2-INFO-A",
        classeId: "cl3",
        statut: "inscrit",
        type: "premiere",
        dateInscription: "2024-09-01",
        soldeDu: 0,
      });
    }
    if (e.id === "et7" || e.id === "et11") {
      rows.push({
        id: `ins-${e.id}-2024`,
        etudiantId: e.id,
        annee: "2024-2025",
        filiere: e.filiere,
        filiereId: e.filiereId,
        niveau: "L1",
        classe: e.id === "et7" ? "L1-INFO-A" : "L1-INFO-B",
        classeId: e.id === "et7" ? "cl1" : "cl2",
        statut: "inscrit",
        type: "premiere",
        dateInscription: "2024-09-01",
        soldeDu: 0,
      });
    }
  }
  return rows;
}

function buildMatriculeCounters(etudiants: EtudiantRecord[]): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const e of etudiants) {
    const parts = e.matricule.match(/^(\d{4})-([A-Z]+)-(\d+)$/);
    if (!parts) continue;
    const key = `${parts[1]}-${parts[2]}`;
    const seq = Number(parts[3]);
    counters[key] = Math.max(counters[key] ?? 0, seq);
  }
  return counters;
}

function seedEtudiants(): EtudiantRecord[] {
  return SEED_ETUDIANTS.map((e) => ({
    ...e,
    sexe: e.sexe as "M" | "F",
    anneePremiereInscription: parseMatriculeYear(e.matricule),
    inscriptionUniquePayee: e.soldeDu === 0 || !["et2", "et3", "et5", "et7", "et8", "et11", "et12"].includes(e.id),
    soldeAvoir: 0,
  }));
}

function seedSeances(): SeanceRecord[] {
  return SEED_SEANCES.map((s) => ({ ...s, annee: "2025-2026" }));
}

function seedNotes(): NoteRecord[] {
  return SEED_NOTES.map((n) => ({
    ...n,
    statut: n.statut === "publie" ? "publie" : "brouillon_prof",
    classeId: SEED_ETUDIANTS.find((e) => e.id === n.etudiantId)?.classeId ?? "",
    annee: "2025-2026",
  }));
}

function seedUsers(etudiants: EtudiantRecord[]): UserAccountRecord[] {
  const users: UserAccountRecord[] = [
    {
      id: "u-admin-1",
      role: "admin",
      email: "admin@edumanage.com",
      password: "demo123",
      identifier: "ADM-0001",
      displayName: "Ousmane DIALLO",
    },
    {
      id: "u-teacher-1",
      role: "teacher",
      email: "prof@edumanage.com",
      password: "demo123",
      identifier: "ENS-0001",
      displayName: "Cheikh FALL",
      linkedId: ENSEIGNANTS[0]?.id,
    },
  ];

  for (const e of etudiants) {
    users.push({
      id: `u-student-${e.id}`,
      role: "student",
      email: e.email,
      password: "demo123",
      identifier: e.matricule,
      displayName: `${e.prenom} ${e.nom}`,
      linkedId: e.id,
    });
  }

  // Compte démo étudiant (login page + tests rapides)
  const demoStudent = etudiants.find((e) => e.id === "et1");
  if (demoStudent) {
    users.push({
      id: "u-student-demo",
      role: "student",
      email: "etu@edumanage.com",
      password: "demo123",
      identifier: demoStudent.matricule,
      displayName: `${demoStudent.prenom} ${demoStudent.nom}`,
      linkedId: demoStudent.id,
    });
  }

  return users;
}

function mergeUsersWithSeed(existing: UserAccountRecord[], seed: UserAccountRecord[]): UserAccountRecord[] {
  const byEmail = new Map(seed.map((u) => [u.email.toLowerCase(), u]));
  const byId = new Map(seed.map((u) => [u.id, u]));
  for (const u of existing) {
    byEmail.set(u.email.toLowerCase(), u);
    byId.set(u.id, u);
  }
  return [...byId.values()];
}

function seedNotifications(): NotificationRecord[] {
  return [
    {
      id: "nt-1",
      userId: "u-admin-1",
      message: "Bienvenue dans la messagerie interne.",
      createdAt: new Date().toISOString(),
      read: false,
    },
  ];
}

function seedPaiements(): PaiementRecord[] {
  return SEED_PAIEMENTS.map((p, i) => ({
    ...p,
    numeroRecu: `RECU-2025-${String(i + 1).padStart(3, "0")}`,
  }));
}

function seedReleves(etudiants: EtudiantRecord[]): ReleveRecord[] {
  return etudiants.slice(0, 8).map((e, i) => ({
    id: `rel-${e.id}`,
    etudiantId: e.id,
    etudiant: `${e.prenom} ${e.nom}`,
    matricule: e.matricule,
    classe: e.classe,
    filiere: e.filiere,
    semestre: "S1 2025-2026",
    statut: i < 3 ? "envoye" : i < 6 ? "genere" : "en_attente",
    dateGeneration: i < 6 ? "2026-01-20" : "",
    ecId: "ec3",
  }));
}

function buildFreshStore(): StoreData {
  const etudiants = seedEtudiants();
  return {
    etudiants,
    inscriptions: buildSeedInscriptions(etudiants),
    matriculeCounters: buildMatriculeCounters(etudiants),
    annees: ANNEES_ACADEMIQUES.map((a) => ({ ...a, cloturee: !a.actuelle && a.libelle < "2025-2026" })),
    paiements: seedPaiements(),
    notes: seedNotes(),
    seances: seedSeances(),
    releves: seedReleves(etudiants),
    users: seedUsers(etudiants),
    requests: [],
    messages: [],
    notifications: seedNotifications(),
    auditLogs: [],
    cahiers: [],
    receiptCounter: SEED_PAIEMENTS.length,
  };
}

function loadStore(): StoreData {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<StoreData>;
        const fresh = buildFreshStore();
        const paiements = (parsed.paiements ?? fresh.paiements).map((p, i) => ({
          ...p,
          numeroRecu: p.numeroRecu || `RECU-2025-${String(i + 1).padStart(3, "0")}`,
        }));
        const etudiants = (parsed.etudiants ?? fresh.etudiants).map((e) => ({ ...e, soldeAvoir: e.soldeAvoir ?? 0 }));
        return {
          ...fresh,
          ...parsed,
          etudiants,
          inscriptions: parsed.inscriptions ?? fresh.inscriptions,
          matriculeCounters: parsed.matriculeCounters ?? fresh.matriculeCounters,
          annees: (parsed.annees ?? fresh.annees).map((a) => ({ ...a, cloturee: a.cloturee ?? false })),
          paiements,
          notes: parsed.notes ?? fresh.notes,
          seances: parsed.seances ?? fresh.seances,
          releves: parsed.releves ?? fresh.releves,
          users: mergeUsersWithSeed(parsed.users ?? [], fresh.users),
          requests: parsed.requests ?? fresh.requests,
          messages: parsed.messages ?? fresh.messages,
          notifications: parsed.notifications ?? fresh.notifications,
          auditLogs: parsed.auditLogs ?? fresh.auditLogs,
          cahiers: parsed.cahiers ?? fresh.cahiers,
          receiptCounter: parsed.receiptCounter ?? paiements.length,
        };
      } catch {
        /* fall through */
      }
    }
  }
  return buildFreshStore();
}

function writeStoreToLocalStorage(data: StoreData): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return true;
  } catch (err) {
    console.error("[EduManage] Impossible d'enregistrer dans localStorage:", err);
    return false;
  }
}

let store: StoreData = loadStore();
let inscriptionsCache = new Map<string, InscriptionRecord[]>();
let paiementsByEtudiantCache = new Map<string, PaiementRecord[]>();
let cahiersCache: CahierSeanceRecord[] | null = null;

function invalidateDerivedCaches() {
  inscriptionsCache.clear();
  paiementsByEtudiantCache.clear();
  cahiersCache = null;
}

function persist() {
  writeStoreToLocalStorage(store);
  invalidateDerivedCaches();
  notify();
}

/** Première écriture après chargement : garantit que le store fusionné reste en local */
if (typeof window !== "undefined") {
  writeStoreToLocalStorage(store);
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as StoreData;
      store = { ...buildFreshStore(), ...parsed };
      invalidateDerivedCaches();
      notify();
    } catch {
      /* ignore corrupt payload from another tab */
    }
  });
}

export function resetStudentStore() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  store = buildFreshStore();
  persist();
}

export interface AuthSessionSnapshot {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  identifier: string;
  linkedId?: string;
}

export function saveAuthSession(user: AuthSessionSnapshot) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {
    console.error("[EduManage] Impossible de sauvegarder la session:", err);
  }
}

export function loadAuthSession(): AuthSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSessionSnapshot;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getEtudiants(): EtudiantRecord[] {
  return store.etudiants;
}

export function getEtudiantById(id: string): EtudiantRecord | undefined {
  return store.etudiants.find((e) => e.id === id);
}

export function getEtudiantByMatricule(matricule: string): EtudiantRecord | undefined {
  const q = matricule.trim().toUpperCase();
  return store.etudiants.find((e) => e.matricule.toUpperCase() === q);
}

export function getUserAccounts(): UserAccountRecord[] {
  return store.users;
}

export function authenticateUser(identifierOrEmail: string, password: string): UserAccountRecord | null {
  const freshUsers = seedUsers(store.etudiants);
  const beforeCount = store.users.length;
  store.users = mergeUsersWithSeed(store.users, freshUsers);
  if (store.users.length !== beforeCount) {
    writeStoreToLocalStorage(store);
  }

  const q = identifierOrEmail.trim().toLowerCase();
  const qMatricule = identifierOrEmail.trim().toUpperCase();
  const user = store.users.find(
    (u) =>
      u.email.toLowerCase() === q ||
      u.identifier.toLowerCase() === q ||
      u.identifier.toUpperCase() === qMatricule,
  );
  if (!user || user.password !== password) return null;
  return user;
}

function pushNotification(userId: string, message: string) {
  store.notifications.unshift({
    id: `nt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  });
}

function logAudit(actorUserId: string, action: string, targetType: string, targetId: string, meta?: string) {
  store.auditLogs.unshift({
    id: `au-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actorUserId,
    action,
    targetType,
    targetId,
    createdAt: new Date().toISOString(),
    meta,
  });
}

export function getInscriptionsByEtudiant(etudiantId: string): InscriptionRecord[] {
  if (!inscriptionsCache.has(etudiantId)) {
    const sorted = store.inscriptions
      .filter((i) => i.etudiantId === etudiantId)
      .sort((a, b) => b.annee.localeCompare(a.annee));
    inscriptionsCache.set(etudiantId, sorted);
  }
  return inscriptionsCache.get(etudiantId)!;
}

export function getInscriptions(): InscriptionRecord[] {
  return store.inscriptions;
}

export function getAnneesAcademiques() {
  return store.annees;
}

export function allocateMatricule(filiereCode: string, anneePremiere?: number): string {
  const year = anneePremiere ?? new Date().getFullYear();
  const key = `${year}-${filiereCode}`;
  const next = (store.matriculeCounters[key] ?? 0) + 1;
  store.matriculeCounters[key] = next;
  persist();
  return `${year}-${filiereCode}-${String(next).padStart(4, "0")}`;
}

export function peekNextMatricule(filiereCode: string, anneePremiere?: number): string {
  const year = anneePremiere ?? new Date().getFullYear();
  const key = `${year}-${filiereCode}`;
  const next = (store.matriculeCounters[key] ?? 0) + 1;
  return `${year}-${filiereCode}-${String(next).padStart(4, "0")}`;
}

function nextAnneeLabel(annee: string): string {
  const [d, f] = annee.split("-").map(Number);
  return `${d + 1}-${f + 1}`;
}

function nextNiveau(niveau: string): string {
  const map: Record<string, string> = {
    L1: "L2",
    L2: "L3",
    L3: "L3",
    BTS1: "BTS2",
    BTS2: "BTS2",
    M1: "M2",
    M2: "M2",
  };
  return map[niveau] ?? niveau;
}

function findClasse(filiereId: string, niveau: string, annee: string) {
  return findClassePedagogique(filiereId, niveau, annee);
}

export interface NewEtudiantPayload {
  prenom: string;
  nom: string;
  sexe: "M" | "F";
  dateNaissance: string;
  email: string;
  telephone?: string;
  filiereId: string;
  /** Vide = affectation après paiement */
  classeId: string;
  niveau: string;
  statut: string;
  annee: string;
  soldeDu: number;
  inscriptionUniquePayee: boolean;
  lieuNaissance?: string;
  pays?: string;
  nationalite?: string;
  cni?: string;
  typeAdmission?: "nouveau" | "transfert";
  documentsFournis?: string[];
}

export function registerNewEtudiant(payload: NewEtudiantPayload, matricule: string): EtudiantRecord {
  const filiere = FILIERES.find((f) => f.id === payload.filiereId);
  const classe = payload.classeId ? getClasseById(payload.classeId) : undefined;
  const anneePremiere = parseMatriculeYear(matricule);

  const etudiant: EtudiantRecord = {
    id: `et-${Date.now()}`,
    prenom: payload.prenom,
    nom: payload.nom,
    matricule,
    sexe: payload.sexe,
    dateNaissance: payload.dateNaissance,
    email: payload.email,
    telephone: payload.telephone ?? "",
    filiere: filiere?.code ?? "",
    filiereId: payload.filiereId,
    classe: classe?.nom ?? "En attente d'affectation",
    classeId: payload.classeId || "",
    niveau: payload.niveau,
    statut: payload.classeId ? payload.statut : "preinscrit",
    soldeDu: payload.soldeDu,
    soldeAvoir: 0,
    annee: payload.annee,
    anneePremiereInscription: anneePremiere,
    inscriptionUniquePayee: payload.inscriptionUniquePayee,
    lieuNaissance: payload.lieuNaissance,
    pays: payload.pays,
    nationalite: payload.nationalite,
    cni: payload.cni,
    typeAdmission: payload.typeAdmission,
    documentsFournis: payload.documentsFournis,
  };

  store.etudiants.push(etudiant);
  store.users.push({
    id: `u-student-${etudiant.id}`,
    role: "student",
    email: etudiant.email,
    password: "demo123",
    identifier: etudiant.matricule,
    displayName: `${etudiant.prenom} ${etudiant.nom}`,
    linkedId: etudiant.id,
  });
  if (payload.classeId) incrementClasseEffectif(payload.classeId, 1);
  store.inscriptions.push({
    id: `ins-${etudiant.id}-${payload.annee}`,
    etudiantId: etudiant.id,
    annee: payload.annee,
    filiere: etudiant.filiere,
    filiereId: payload.filiereId,
    niveau: payload.niveau,
    classe: etudiant.classe,
    classeId: payload.classeId || "",
    statut: etudiant.statut,
    type: "premiere",
    dateInscription: new Date().toISOString().slice(0, 10),
    soldeDu: payload.soldeDu,
  });

  persist();
  return etudiant;
}

export interface ReinscriptionPayload {
  etudiantId: string;
  annee: string;
  filiereId: string;
  classeId: string;
  niveau: string;
  statut: string;
  soldeDu: number;
  specialite?: string;
  modeleFraisId?: string;
  modeleFrais?: string;
  effectuePar?: string;
}

export interface ReinscriptionEligibility {
  decision: "allowed" | "conditional" | "blocked";
  reasons: string[];
}

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
  const moyenne = MOYENNES_PROMO.find((m) => m.etudiantId === etudiantId);
  if (moyenne && moyenne.statut !== "Admis") {
    conditional = true;
    reasons.push("Délibération non admise");
  }

  if (blocked) return { decision: "blocked", reasons };
  if (conditional) return { decision: "conditional", reasons };
  return { decision: "allowed", reasons: ["Éligible à la réinscription"] };
}

function creerInscriptionEtMettreAJourEtudiant(
  payload: ReinscriptionPayload,
  type: InscriptionRecord["type"],
  motif?: string,
): InscriptionRecord {
  const etudiant = getEtudiantById(payload.etudiantId);
  if (!etudiant) throw new Error("Étudiant introuvable");

  const filiere = FILIERES.find((f) => f.id === payload.filiereId);
  const classe = getClasseById(payload.classeId);

  const inscription: InscriptionRecord = {
    id: `ins-${payload.etudiantId}-${payload.annee}-${Date.now()}`,
    etudiantId: payload.etudiantId,
    annee: payload.annee,
    filiere: filiere?.code ?? etudiant.filiere,
    filiereId: payload.filiereId,
    niveau: payload.niveau,
    classe: classe?.nom ?? "",
    classeId: payload.classeId,
    statut: payload.statut,
    type,
    dateInscription: new Date().toISOString().slice(0, 10),
    soldeDu: payload.soldeDu,
    specialite: payload.specialite,
    modeleFraisId: payload.modeleFraisId,
    modeleFrais: payload.modeleFrais,
    motif,
    effectuePar: payload.effectuePar,
  };

  store.inscriptions.push(inscription);

  etudiant.annee = payload.annee;
  etudiant.filiere = inscription.filiere;
  etudiant.filiereId = payload.filiereId;
  etudiant.niveau = payload.niveau;
  etudiant.classe = inscription.classe;
  etudiant.classeId = payload.classeId;
  etudiant.statut = payload.statut;
  etudiant.soldeDu = payload.soldeDu;

  persist();
  return inscription;
}

export function registerReinscription(payload: ReinscriptionPayload): InscriptionRecord {
  return creerInscriptionEtMettreAJourEtudiant(payload, "reinscription");
}

export function registerBasculeAnnee(payload: ReinscriptionPayload): InscriptionRecord {
  return creerInscriptionEtMettreAJourEtudiant(payload, "bascule");
}

export function registerInscriptionCorrection(payload: ReinscriptionPayload, motif: string): InscriptionRecord {
  return creerInscriptionEtMettreAJourEtudiant(payload, "correction", motif);
}

export function promoteAcademicYear(sourceAnneeId: string): { count: number; nextLabel: string } {
  const source = store.annees.find((a) => a.id === sourceAnneeId);
  if (!source) return { count: 0, nextLabel: "" };

  const nextLabel = nextAnneeLabel(source.libelle);
  const exists = store.annees.some((a) => a.libelle === nextLabel);
  if (!exists) {
    store.annees.push({
      id: `aa-${Date.now()}`,
      libelle: nextLabel,
      actuelle: false,
    });
  }

  const actifs = store.etudiants.filter(
    (e) => e.annee === source.libelle && e.statut !== "suspendu",
  );

  let count = 0;
  for (const e of actifs) {
    const already = store.inscriptions.some(
      (i) => i.etudiantId === e.id && i.annee === nextLabel,
    );
    if (already) continue;

    const niveau = nextNiveau(e.niveau);
    const classe = findClasse(e.filiereId, niveau, nextLabel) ?? findClasse(e.filiereId, niveau, source.libelle);

    store.inscriptions.push({
      id: `ins-pre-${e.id}-${nextLabel}`,
      etudiantId: e.id,
      annee: nextLabel,
      filiere: e.filiere,
      filiereId: e.filiereId,
      niveau,
      classe: classe?.nom ?? e.classe,
      classeId: classe?.id ?? e.classeId,
      statut: "preinscrit",
      type: "reinscription",
      dateInscription: new Date().toISOString().slice(0, 10),
      soldeDu: 0,
    });
    count++;
  }

  persist();
  return { count, nextLabel };
}

export function setAnneeActuelle(id: string) {
  store.annees = store.annees.map((a) => ({ ...a, actuelle: a.id === id }));
  persist();
}

export function addAnneeAcademique(libelle: string) {
  store.annees.push({ id: `aa-${Date.now()}`, libelle, actuelle: false });
  persist();
}

export function archiveAnnee(id: string) {
  store.annees = store.annees.filter((a) => a.id !== id);
  persist();
}

export function getAnneeActuelle(): string {
  return store.annees.find((a) => a.actuelle)?.libelle ?? "2025-2026";
}

// ——— Paiements ———

export function getPaiements(): PaiementRecord[] {
  return store.paiements;
}

export function getPaiementsByEtudiant(etudiantId: string): PaiementRecord[] {
  if (!paiementsByEtudiantCache.has(etudiantId)) {
    const sorted = store.paiements
      .filter((p) => p.etudiantId === etudiantId)
      .sort((a, b) => b.date.localeCompare(a.date));
    paiementsByEtudiantCache.set(etudiantId, sorted);
  }
  return paiementsByEtudiantCache.get(etudiantId)!;
}

export interface RegisterPaiementPayload {
  etudiantId: string;
  rubrique: string;
  montant: number;
  moyen: string;
  reference: string;
  date: string;
  statut: string;
  montantAttendu?: number;
  /** Ne pas recalculer le solde (déjà fait à l'inscription) */
  recordOnly?: boolean;
  /** Affectation classe pédagogique après règlement */
  classeId?: string;
  /** Lignes de la facture unique */
  lignes?: PaiementLigne[];
  /** Date limite de règlement de la quittance */
  dateLimite?: string;
}

export function registerPaiement(payload: RegisterPaiementPayload): PaiementRecord {
  const etudiant = getEtudiantById(payload.etudiantId);
  if (!etudiant) throw new Error("Étudiant introuvable");

  const year = new Date(payload.date || Date.now()).getFullYear();
  store.receiptCounter = (store.receiptCounter ?? 0) + 1;
  const numeroRecu = `RECU-${year}-${String(store.receiptCounter).padStart(3, "0")}`;

  const statut = payload.statut === "annule" ? "annule" : "paye";

  const lignes =
    payload.lignes && payload.lignes.length > 0
      ? payload.lignes
      : [{ label: payload.rubrique, montant: payload.montant }];

  const factureTotal = lignes.reduce((s, l) => s + l.montant, 0);
  /** Montant réellement versé (peut être partiel) — les lignes détaillent la facture */
  const montantPaye = payload.montant > 0 ? payload.montant : factureTotal;
  const rubriqueSynthese =
    lignes.length > 1 ? `Facture unique (${lignes.length} rubriques)` : lignes[0]?.label || payload.rubrique;

  const soldeRestant = payload.recordOnly
    ? etudiant.soldeDu
    : statut === "paye"
      ? Math.max(0, etudiant.soldeDu - montantPaye)
      : etudiant.soldeDu;

  const paiement: PaiementRecord = {
    id: `pa-${Date.now()}`,
    date: payload.date,
    etudiant: `${etudiant.prenom} ${etudiant.nom}`,
    etudiantId: etudiant.id,
    classe: etudiant.classe,
    rubrique: rubriqueSynthese,
    lignes,
    montant: montantPaye,
    moyen: payload.moyen,
    reference: payload.reference || numeroRecu,
    numeroRecu,
    soldeRestant,
    statut,
    dateLimite: payload.dateLimite || undefined,
  };

  store.paiements.unshift(paiement);

  if (statut === "paye") {
    if (!payload.recordOnly) {
      etudiant.soldeDu = Math.max(0, etudiant.soldeDu - montantPaye);
      const hasInscription = lignes.some((l) => l.label.toLowerCase().includes("inscription") || l.label.toLowerCase().includes("pack"));
      if (hasInscription || payload.rubrique.toLowerCase().includes("inscription")) {
        etudiant.inscriptionUniquePayee = true;
      }
      const ins = store.inscriptions.find(
        (i) => i.etudiantId === etudiant.id && i.annee === etudiant.annee,
      );
      if (ins) ins.soldeDu = etudiant.soldeDu;

      const studentUser = store.users.find((u) => u.linkedId === etudiant.id && u.role === "student");
      if (studentUser) {
        pushNotification(studentUser.id, `Paiement validé — reçu ${numeroRecu} (${montantPaye} FCFA)`);
      }
    } else {
      const hasInscription = lignes.some((l) => l.label.toLowerCase().includes("inscription") || l.label.toLowerCase().includes("pack"));
      if (hasInscription) etudiant.inscriptionUniquePayee = true;
    }

    if (payload.classeId) {
      const classe = getClasseById(payload.classeId);
      const ins = store.inscriptions.find(
        (i) => i.etudiantId === etudiant.id && i.annee === etudiant.annee,
      );
      const studentUser = store.users.find((u) => u.linkedId === etudiant.id && u.role === "student");
      if (classe) {
        if (etudiant.classeId && etudiant.classeId !== payload.classeId) {
          incrementClasseEffectif(etudiant.classeId, -1);
        }
        if (etudiant.classeId !== payload.classeId) {
          incrementClasseEffectif(payload.classeId, 1);
        }
        etudiant.classeId = payload.classeId;
        etudiant.classe = classe.nom;
        etudiant.niveau = classe.niveau;
        if (etudiant.statut === "preinscrit") etudiant.statut = "inscrit";
        paiement.classe = classe.nom;
        if (ins) {
          ins.classeId = payload.classeId;
          ins.classe = classe.nom;
          ins.niveau = classe.niveau;
          ins.statut = etudiant.statut;
        }
        if (studentUser) {
          pushNotification(studentUser.id, `Affecté à la classe ${classe.nom}`);
        }
      }
    }
  }

  persist();
  return paiement;
}

/** Annule une quittance déjà enregistrée : retire sa part encore impayée du solde élève (la part déjà réglée n'est pas remboursée automatiquement — voir crediterAvoir côté appelant pour la part réglée par avoir). */
export function cancelPaiement(id: string): void {
  const idx = store.paiements.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const p = store.paiements[idx];
  if (p.statut !== "annule") {
    const etudiant = getEtudiantById(p.etudiantId);
    if (etudiant) {
      const montantFacture = p.lignes && p.lignes.length > 0 ? p.lignes.reduce((s, l) => s + l.montant, 0) : p.montant;
      const resteDu = Math.max(0, montantFacture - p.montant);
      etudiant.soldeDu = Math.max(0, etudiant.soldeDu - resteDu);
      const ins = store.inscriptions.find((i) => i.etudiantId === etudiant.id && i.annee === etudiant.annee);
      if (ins) ins.soldeDu = etudiant.soldeDu;
    }
  }
  // Nouvelle référence de tableau : useSyncExternalStore compare par Object.is
  // et ne re-rend pas si getPaiements() renvoie la même référence.
  store.paiements = store.paiements.map((pp) => (pp.id === id ? { ...pp, statut: "annule" } : pp));
  persist();
}

export interface EmettreQuittanceBrutePayload {
  etudiantId: string;
  date: string;
  dateLimite?: string;
  lignes: PaiementLigne[];
  reference: string;
}

/** Émet une quittance non encaissée (facturation) : le montant payé est nul, le solde de l'étudiant est augmenté d'autant. */
export function emettreQuittanceBrute(payload: EmettreQuittanceBrutePayload): PaiementRecord {
  const etudiant = getEtudiantById(payload.etudiantId);
  if (!etudiant) throw new Error("Étudiant introuvable");

  const year = new Date(payload.date || Date.now()).getFullYear();
  store.receiptCounter = (store.receiptCounter ?? 0) + 1;
  const numeroRecu = `RECU-${year}-${String(store.receiptCounter).padStart(3, "0")}`;
  const montantFacture = payload.lignes.reduce((s, l) => s + l.montant, 0);

  const paiement: PaiementRecord = {
    id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: payload.date,
    etudiant: `${etudiant.prenom} ${etudiant.nom}`,
    etudiantId: etudiant.id,
    classe: etudiant.classe,
    rubrique: payload.lignes.length > 1 ? `Facture unique (${payload.lignes.length} rubriques)` : payload.lignes[0]?.label ?? "Frais",
    lignes: payload.lignes,
    montant: 0,
    moyen: "",
    reference: payload.reference,
    numeroRecu,
    soldeRestant: etudiant.soldeDu + montantFacture,
    statut: "paye",
    dateLimite: payload.dateLimite,
  };

  store.paiements = [paiement, ...store.paiements];

  etudiant.soldeDu = etudiant.soldeDu + montantFacture;
  const ins = store.inscriptions.find((i) => i.etudiantId === etudiant.id && i.annee === etudiant.annee);
  if (ins) ins.soldeDu = etudiant.soldeDu;

  persist();
  return paiement;
}

/** Annule une quittance émise en masse et jamais payée : contrairement à cancelPaiement(), rembourse le solde élève. */
export function cancelQuittanceEmise(id: string): void {
  const idx = store.paiements.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const p = store.paiements[idx];
  if (p.statut !== "annule" && p.montant === 0) {
    const etudiant = getEtudiantById(p.etudiantId);
    if (etudiant) {
      const montantFacture = p.lignes && p.lignes.length > 0 ? p.lignes.reduce((s, l) => s + l.montant, 0) : p.montant;
      etudiant.soldeDu = Math.max(0, etudiant.soldeDu - montantFacture);
      const ins = store.inscriptions.find((i) => i.etudiantId === etudiant.id && i.annee === etudiant.annee);
      if (ins) ins.soldeDu = etudiant.soldeDu;
    }
  }
  store.paiements = store.paiements.map((pp) => (pp.id === id ? { ...pp, statut: "annule" } : pp));
  persist();
}

export interface PayerQuittancePayload {
  id: string;
  montant: number;
  moyen: string;
  reference: string;
  date: string;
}

/** Encaisse un règlement (total ou partiel) sur une quittance déjà émise (Impayé/Acompte). */
export function payerQuittance(payload: PayerQuittancePayload): PaiementRecord | undefined {
  const p = store.paiements.find((pp) => pp.id === payload.id);
  if (!p || p.statut === "annule") return undefined;

  const montantFacture = p.lignes && p.lignes.length > 0 ? p.lignes.reduce((s, l) => s + l.montant, 0) : p.montant;
  const nouveauMontantPaye = Math.min(montantFacture, p.montant + Math.max(0, payload.montant));
  const diff = nouveauMontantPaye - p.montant;

  const etudiant = getEtudiantById(p.etudiantId);
  if (etudiant && diff > 0) {
    etudiant.soldeDu = Math.max(0, etudiant.soldeDu - diff);
    const ins = store.inscriptions.find((i) => i.etudiantId === etudiant.id && i.annee === etudiant.annee);
    if (ins) ins.soldeDu = etudiant.soldeDu;
    const studentUser = store.users.find((u) => u.linkedId === etudiant.id && u.role === "student");
    if (studentUser) {
      pushNotification(studentUser.id, `Paiement validé — reçu ${p.numeroRecu} (${nouveauMontantPaye} FCFA au total)`);
    }
  }

  const updated: PaiementRecord = {
    ...p,
    montant: nouveauMontantPaye,
    moyen: payload.moyen || p.moyen,
    reference: payload.reference || p.reference,
    date: payload.date || p.date,
  };
  store.paiements = store.paiements.map((pp) => (pp.id === payload.id ? updated : pp));
  persist();
  return updated;
}

/** Retire un règlement appliqué sur une quittance (ex. annulation d'une prise en charge) : opération symétrique de payerQuittance(). */
export function reverserReglementQuittance(id: string, montant: number): void {
  const p = store.paiements.find((pp) => pp.id === id);
  if (!p) return;

  const nouveauMontantPaye = Math.max(0, p.montant - Math.max(0, montant));
  const diff = p.montant - nouveauMontantPaye;

  const etudiant = getEtudiantById(p.etudiantId);
  if (etudiant && diff > 0) {
    etudiant.soldeDu = etudiant.soldeDu + diff;
    const ins = store.inscriptions.find((i) => i.etudiantId === etudiant.id && i.annee === etudiant.annee);
    if (ins) ins.soldeDu = etudiant.soldeDu;
  }

  store.paiements = store.paiements.map((pp) => (pp.id === id ? { ...pp, montant: nouveauMontantPaye } : pp));
  persist();
}

/** Crédite le solde d'avoir d'un étudiant (ex. dépôt avoir, annulation d'un règlement payé par avoir). */
export function crediterAvoir(etudiantId: string, montant: number): void {
  const etudiant = getEtudiantById(etudiantId);
  if (!etudiant || montant <= 0) return;
  etudiant.soldeAvoir = etudiant.soldeAvoir + montant;
  persist();
}

/** Débite le solde d'avoir d'un étudiant (ex. règlement d'une quittance payé par avoir). Renvoie false si le solde est insuffisant. */
export function debiterAvoir(etudiantId: string, montant: number): boolean {
  const etudiant = getEtudiantById(etudiantId);
  if (!etudiant || montant <= 0) return false;
  if (etudiant.soldeAvoir < montant) return false;
  etudiant.soldeAvoir = etudiant.soldeAvoir - montant;
  persist();
  return true;
}

/** Applique une réduction définitive sur le solde dû d'un étudiant (contrairement à l'avoir, non remboursable). */
export function appliquerReductionSolde(etudiantId: string, montant: number): void {
  const etudiant = getEtudiantById(etudiantId);
  if (!etudiant || montant <= 0) return;
  etudiant.soldeDu = Math.max(0, etudiant.soldeDu - montant);
  persist();
}

/** Annule une réduction déjà appliquée : restaure le montant sur le solde dû de l'étudiant. */
export function annulerReductionSolde(etudiantId: string, montant: number): void {
  const etudiant = getEtudiantById(etudiantId);
  if (!etudiant || montant <= 0) return;
  etudiant.soldeDu = etudiant.soldeDu + montant;
  persist();
}

/** Pousse une notification de relance au portail étudiant pour chaque quittance non soldée et non annulée. Renvoie le nombre de relances envoyées. */
export function relancerQuittances(ids: string[]): number {
  let count = 0;
  for (const id of ids) {
    const p = store.paiements.find((pp) => pp.id === id);
    if (!p || p.statut === "annule") continue;
    const montantFacture = p.lignes && p.lignes.length > 0 ? p.lignes.reduce((s, l) => s + l.montant, 0) : p.montant;
    if (p.montant >= montantFacture) continue;
    const studentUser = store.users.find((u) => u.linkedId === p.etudiantId && u.role === "student");
    if (!studentUser) continue;
    const limite = p.dateLimite ? ` (date limite : ${p.dateLimite})` : "";
    pushNotification(studentUser.id, `Rappel — quittance ${p.numeroRecu} en attente de règlement${limite}`);
    count++;
  }
  if (count > 0) persist();
  return count;
}

/** Reporte la date limite d'un lot de quittances déjà émises et non soldées. Renvoie le nombre modifié. */
export function reporterEcheanceQuittances(ids: string[], nouvelleDateLimite: string): number {
  let count = 0;
  for (const id of ids) {
    const p = store.paiements.find((pp) => pp.id === id);
    if (!p || p.statut === "annule") continue;
    p.dateLimite = nouvelleDateLimite;
    count++;
  }
  if (count > 0) persist();
  return count;
}

/**
 * Autorise ou interdit l'accès portail des étudiants.
 * Interdit → statut `suspendu` (déjà utilisé dans le store / réinscription).
 * Autorisé → restaure `inscrit` si l'étudiant était suspendu.
 */
export function setEtudiantsAccess(
  etudiantIds: string[],
  access: "autorise" | "interdit",
): number {
  const ids = new Set(etudiantIds);
  let count = 0;
  for (const e of store.etudiants) {
    if (!ids.has(e.id)) continue;
    if (access === "interdit") {
      if (e.statut === "suspendu") continue;
      e.statut = "suspendu";
    } else {
      if (e.statut !== "suspendu") continue;
      e.statut = "inscrit";
    }
    const ins = store.inscriptions.find((i) => i.etudiantId === e.id && i.annee === e.annee);
    if (ins) ins.statut = e.statut;
    count++;
  }
  if (count > 0) persist();
  return count;
}

/** Bascule le statut d'un étudiant en "abandon" (dossier créé via Nouvel abandon) — mémorise
 * le statut précédent pour permettre à reintegrerEtudiantStatut() de le restaurer exactement. */
export function marquerEtudiantAbandon(etudiantId: string): string | undefined {
  const etudiant = store.etudiants.find((e) => e.id === etudiantId);
  if (!etudiant) return undefined;
  const statutAvant = etudiant.statut;
  etudiant.statut = "abandon";
  const ins = store.inscriptions.find((i) => i.etudiantId === etudiantId && i.annee === etudiant.annee);
  if (ins) ins.statut = "abandon";
  persist();
  return statutAvant;
}

/** Restaure le statut d'un étudiant après réintégration d'un dossier d'abandon. */
export function reintegrerEtudiantStatut(etudiantId: string, statutAvant: string): void {
  const etudiant = store.etudiants.find((e) => e.id === etudiantId);
  if (!etudiant) return;
  etudiant.statut = statutAvant || "actif";
  const ins = store.inscriptions.find((i) => i.etudiantId === etudiantId && i.annee === etudiant.annee);
  if (ins) ins.statut = etudiant.statut;
  persist();
}

/** Affecte l'étudiant à une classe pédagogique après paiement confirmé */
export function assignEtudiantToClasse(etudiantId: string, classeId: string) {
  const etudiant = getEtudiantById(etudiantId);
  const classe = getClasseById(classeId);
  if (!etudiant || !classe) return;
  if (etudiant.classeId && etudiant.classeId !== classeId) {
    incrementClasseEffectif(etudiant.classeId, -1);
  }
  if (etudiant.classeId !== classeId) {
    incrementClasseEffectif(classeId, 1);
  }
  etudiant.classeId = classeId;
  etudiant.classe = classe.nom;
  etudiant.niveau = classe.niveau;
  if (etudiant.statut === "preinscrit") etudiant.statut = "inscrit";
  const ins = store.inscriptions.find((i) => i.etudiantId === etudiantId && i.annee === etudiant.annee);
  if (ins) {
    ins.classeId = classeId;
    ins.classe = classe.nom;
    ins.niveau = classe.niveau;
    ins.statut = etudiant.statut;
  }
  persist();
}

export function cloturerAnnee(id: string) {
  const annee = store.annees.find((a) => a.id === id);
  if (!annee) return;
  annee.cloturee = true;
  annee.actuelle = false;
  persist();
}

export function isAnneeCloturee(libelle?: string): boolean {
  const label = libelle ?? getAnneeActuelle();
  return !!store.annees.find((a) => a.libelle === label)?.cloturee;
}

// ——— Notes & relevés ———

export function getNotes(): NoteRecord[] {
  return store.notes;
}

export function getNotesByClasseEc(classeId: string, ecId: string): NoteRecord[] {
  return store.notes.filter((n) => n.classeId === classeId && n.ecId === ecId);
}

/** La note qui doit compter pour le calcul final : pour un EF, la reprise de rattrapage si
 * elle existe l'emporte toujours sur l'examen normal (jamais l'inverse), sans jamais effacer
 * l'historique — les deux NoteRecord coexistent dans le store. */
export function getEffectiveNote(etudiantId: string, classeId: string, ecId: string, type: "CC" | "EF"): NoteRecord | undefined {
  const matches = store.notes.filter((n) => n.etudiantId === etudiantId && n.classeId === classeId && n.ecId === ecId && n.type === type);
  if (type === "EF") {
    return matches.find((n) => n.session === "rattrapage") ?? matches.find((n) => n.session === undefined);
  }
  return matches.find((n) => n.session === undefined) ?? matches[0];
}

export function deleteNote(id: string): void {
  store.notes = store.notes.filter((n) => n.id !== id);
  persist();
}

export interface GridNoteInput {
  etudiantId: string;
  cc?: number;
  examen?: number;
  absent?: boolean;
}

export function saveNotesGrid(
  classeId: string,
  ecId: string,
  ecLabel: string,
  inputs: GridNoteInput[],
  publish: boolean,
  session?: "rattrapage",
): void {
  const annee = getAnneeActuelle();
  for (const input of inputs) {
    const etudiant = getEtudiantById(input.etudiantId);
    if (!etudiant || input.absent) continue;

    const pairs: { type: string; note: number }[] = [];
    if (input.cc !== undefined && !Number.isNaN(input.cc)) pairs.push({ type: "CC", note: input.cc });
    if (input.examen !== undefined && !Number.isNaN(input.examen)) pairs.push({ type: "EF", note: input.examen });

    for (const { type, note } of pairs) {
      // La note de rattrapage ne doit jamais matcher (ni écraser) l'EF normal : elle vit dans
      // un NoteRecord distinct, retrouvé uniquement par le même triplet + session.
      const existing = store.notes.find(
        (n) => n.etudiantId === input.etudiantId && n.ecId === ecId && n.type === type && n.session === session,
      );
      const statut = publish ? "publie" as const : "brouillon_prof" as const;
      if (existing) {
        existing.note = note;
        existing.statut = statut;
      } else {
        store.notes.push({
          id: `no-${input.etudiantId}-${ecId}-${type}-${session ?? "normale"}-${Date.now()}`,
          etudiant: `${etudiant.prenom} ${etudiant.nom}`,
          etudiantId: etudiant.id,
          matricule: etudiant.matricule,
          ec: ecLabel,
          ecId,
          type,
          note,
          statut,
          classeId,
          annee,
          session,
        });
      }
    }
  }

  if (publish) {
    generateRelevesForClasseEc(classeId, ecId);
  }
  persist();
}

export function publishNotesForClasseEc(classeId: string, ecId: string, session?: "rattrapage"): number {
  let count = 0;
  for (const n of store.notes) {
    if (n.classeId === classeId && n.ecId === ecId && n.statut === "valide_admin" && n.session === session) {
      n.statut = "publie";
      count++;
    }
  }
  if (count > 0) generateRelevesForClasseEc(classeId, ecId);
  persist();
  return count;
}

export function submitNotesForValidation(classeId: string, ecId: string, session?: "rattrapage"): number {
  let count = 0;
  for (const n of store.notes) {
    if (n.classeId === classeId && n.ecId === ecId && n.statut === "brouillon_prof" && n.session === session) {
      n.statut = "soumis_admin";
      count++;
    }
  }
  if (count > 0) {
    const admin = store.users.find((u) => u.role === "admin");
    if (admin) pushNotification(admin.id, "De nouvelles notes attendent validation.");
  }
  persist();
  return count;
}

export function validateNotesByAdmin(classeId: string, ecId: string, actorUserId: string, session?: "rattrapage"): number {
  let count = 0;
  for (const n of store.notes) {
    if (n.classeId === classeId && n.ecId === ecId && n.statut === "soumis_admin" && n.session === session) {
      n.statut = "valide_admin";
      count++;
    }
  }
  if (count > 0) logAudit(actorUserId, "validate_notes", "ec", ecId, `classe:${classeId}`);
  persist();
  return count;
}

export function getReleves(): ReleveRecord[] {
  return store.releves;
}

export function generateRelevesForClasseEc(classeId: string, ecId: string): void {
  const published = store.notes.filter(
    (n) => n.classeId === classeId && n.ecId === ecId && n.statut === "publie",
  );
  const studentIds = [...new Set(published.map((n) => n.etudiantId))];

  // La session réelle est déduite de l'évaluation posée pour cette classe/EC (Nouvelle évaluation),
  // jamais d'une chaîne fabriquée — sans quoi resolveBulletin() ne peut plus faire correspondre
  // ce relevé à un vrai semestre (voir RelevesPage.tsx).
  const evaluation = getEvaluations().find((e) => e.classeId === classeId && e.ecId === ecId);
  const semestreObj = evaluation ? SEMESTRES.find((s) => s.id === evaluation.semestreId) : undefined;
  const semestre = semestreObj ? `${semestreObj.nom} (${semestreObj.alias})` : "Semestre inconnu";

  for (const etudiantId of studentIds) {
    const etudiant = getEtudiantById(etudiantId);
    if (!etudiant) continue;
    const existing = store.releves.find((r) => r.etudiantId === etudiantId && r.ecId === ecId);
    if (existing) {
      existing.statut = "genere";
      existing.dateGeneration = new Date().toISOString().slice(0, 10);
    } else {
      store.releves.push({
        id: `rel-${etudiantId}-${ecId}`,
        etudiantId,
        etudiant: `${etudiant.prenom} ${etudiant.nom}`,
        matricule: etudiant.matricule,
        classe: etudiant.classe,
        filiere: etudiant.filiere,
        semestre,
        statut: "genere",
        dateGeneration: new Date().toISOString().slice(0, 10),
        ecId,
      });
    }
  }
}

// ——— Emploi du temps ———

export function getSeances(): SeanceRecord[] {
  return store.seances;
}

export function checkSeanceConflicts(candidate: SeanceSlot, excludeId?: string) {
  return detectScheduleConflicts(store.seances, candidate, excludeId);
}

export interface NewSeancePayload {
  ecId: string;
  classeId: string;
  salleId: string;
  prof: string;
  jour: number;
  heureDebut: string;
  heureFin: string;
  type: string;
}

export function addSeance(payload: NewSeancePayload): { seance?: SeanceRecord; conflicts: ReturnType<typeof detectScheduleConflicts> } {
  const ec = getEcs().find((e) => e.id === payload.ecId);
  const classe = getClasseById(payload.classeId);
  const salle = getSalleById(payload.salleId);
  const candidate: SeanceSlot = {
    id: `se-${Date.now()}`,
    ...payload,
    ec: ec?.libelle,
    classe: classe?.nom,
    salle: salle?.nom,
  };
  const conflicts = detectScheduleConflicts(store.seances, candidate);
  if (conflicts.length > 0) return { conflicts };

  const seance: SeanceRecord = {
    id: candidate.id,
    ec: ec?.libelle ?? "",
    ecId: payload.ecId,
    classe: classe?.nom ?? "",
    classeId: payload.classeId,
    jour: payload.jour,
    heureDebut: payload.heureDebut,
    heureFin: payload.heureFin,
    salle: salle?.nom ?? "",
    salleId: payload.salleId,
    prof: payload.prof,
    type: payload.type,
    annee: getAnneeActuelle(),
  };
  store.seances.push(seance);

  // Notifier étudiants de la classe + enseignant
  const studentUsers = store.users.filter(
    (u) => u.role === "student" && store.etudiants.some((e) => e.id === u.linkedId && e.classeId === payload.classeId),
  );
  for (const u of studentUsers) {
    pushNotification(u.id, `EDT mis à jour : ${seance.ec} (${seance.jour}/${seance.heureDebut}) — ${seance.salle}`);
  }
  const teacherUser = store.users.find(
    (u) => u.role === "teacher" && (u.displayName.includes(payload.prof.split(" ").slice(-1)[0] ?? "") || payload.prof.includes(u.displayName.split(" ").slice(-1)[0] ?? "")),
  );
  if (teacherUser) {
    pushNotification(teacherUser.id, `Nouveau créneau : ${seance.ec} — ${seance.classe} — ${seance.salle}`);
  }

  persist();
  return { seance, conflicts: [] };
}

export function updateSeancePosition(
  id: string,
  jour: number,
  heureDebut: string,
  heureFin: string,
): { ok: boolean; conflicts: ReturnType<typeof detectScheduleConflicts> } {
  const seance = store.seances.find((s) => s.id === id);
  if (!seance) return { ok: false, conflicts: [] };

  const candidate: SeanceSlot = { ...seance, jour, heureDebut, heureFin };
  const conflicts = detectScheduleConflicts(store.seances, candidate, id);
  if (conflicts.length > 0) return { ok: false, conflicts };

  seance.jour = jour;
  seance.heureDebut = heureDebut;
  seance.heureFin = heureFin;
  persist();
  return { ok: true, conflicts: [] };
}

export function getStudentRequests(): StudentRequestRecord[] {
  return store.requests;
}

export function addStudentRequest(payload: Omit<StudentRequestRecord, "id" | "createdAt" | "status">): StudentRequestRecord {
  const req: StudentRequestRecord = {
    id: `req-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "nouveau",
    ...payload,
  };
  store.requests.unshift(req);
  const admin = store.users.find((u) => u.role === "admin");
  if (admin) pushNotification(admin.id, `Nouvelle demande étudiant: ${req.subject}`);
  persist();
  return req;
}

export function updateStudentRequestStatus(id: string, status: StudentRequestRecord["status"], handledBy: string, resolution?: string) {
  const req = store.requests.find((r) => r.id === id);
  if (!req) return;
  req.status = status;
  req.handledBy = handledBy;
  req.resolution = resolution;
  const studentUser = store.users.find((u) => u.linkedId === req.studentId && u.role === "student");
  if (studentUser) pushNotification(studentUser.id, `Votre demande "${req.subject}" est ${status}.`);
  logAudit(handledBy, "update_request", "request", id, status);
  persist();
}

export function getMessagesForUser(userId: string): MessageRecord[] {
  return store.messages
    .filter((m) => m.toUserId === userId || m.fromUserId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getMessages(): MessageRecord[] {
  return store.messages;
}

export function sendMessage(fromUserId: string, toUserId: string, subject: string, content: string): MessageRecord {
  const msg: MessageRecord = {
    id: `msg-${Date.now()}`,
    fromUserId,
    toUserId,
    subject,
    content,
    createdAt: new Date().toISOString(),
    read: false,
  };
  store.messages.unshift(msg);
  pushNotification(toUserId, `Nouveau message: ${subject}`);
  logAudit(fromUserId, "send_message", "message", msg.id, `to:${toUserId}`);
  persist();
  return msg;
}

export function markMessageAsRead(messageId: string, userId: string) {
  const msg = store.messages.find((m) => m.id === messageId && m.toUserId === userId);
  if (!msg) return;
  msg.read = true;
  persist();
}

export function getNotificationsByUser(userId: string): NotificationRecord[] {
  return store.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getNotifications(): NotificationRecord[] {
  return store.notifications;
}

export function markNotificationRead(notificationId: string, userId: string) {
  const n = store.notifications.find((x) => x.id === notificationId && x.userId === userId);
  if (!n) return;
  n.read = true;
  persist();
}

export function getAuditLogs(): AuditLogRecord[] {
  return store.auditLogs;
}

export function getCahiers(): CahierSeanceRecord[] {
  if (!cahiersCache) {
    cahiersCache = store.cahiers.map(normalizeCahier);
  }
  return cahiersCache;
}

export function getCahierById(id: string): CahierSeanceRecord | undefined {
  const row = store.cahiers.find((c) => c.id === id);
  return row ? normalizeCahier(row) : undefined;
}

function normalizeCahier(c: CahierSeanceRecord): CahierSeanceRecord {
  const absents = c.absents ?? [];
  const retards = c.retards ?? [];
  const resume = c.resume || c.activite || "";
  const presences = c.presences?.length
    ? c.presences
    : [
        ...absents.map((id) => ({ etudiantId: id, nom: id, statut: "absent" as const })),
        ...retards.map((id) => ({ etudiantId: id, nom: id, statut: "retard" as const })),
      ];
  return {
    ...c,
    annee: c.annee || getAnneeActuelle(),
    semestre: c.semestre || "",
    departement: c.departement || "Études",
    filiere: c.filiere || "",
    filiereId: c.filiereId || "",
    niveau: c.niveau || "",
    ue: c.ue || "",
    ueId: c.ueId || "",
    ecId: c.ecId || "",
    salle: c.salle || "",
    salleId: c.salleId || "",
    heureDebut: c.heureDebut || "",
    heureFin: c.heureFin || "",
    typeSeance: c.typeSeance || "CM",
    sujet: c.sujet || resume.slice(0, 80),
    resume,
    activite: resume,
    competences: c.competences || "",
    liensExternes: c.liensExternes || [],
    photosTableau: c.photosTableau || [],
    piecesJointes: c.piecesJointes || [],
    presences,
    absents,
    retards,
    tauxPresence: c.tauxPresence ?? 0,
    etatSeance: c.etatSeance || "realisee",
    travail: c.travail,
    evaluation: c.evaluation,
  };
}

function durationHours(debut: string, fin: string): number {
  const [sh, sm] = debut.split(":").map(Number);
  const [eh, em] = fin.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 2;
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

export function getCahierStatsForEc(ecId: string): {
  heuresEffectuees: number;
  heuresRestantes: number;
  vht: number;
  pctProgramme: number;
  seancesRealisees: number;
  tauxPresenceMoyen: number;
} {
  const ec = getEcs().find((e) => e.id === ecId);
  const vht = ec?.vht ?? 0;
  const done = store.cahiers
    .map(normalizeCahier)
    .filter((c) => c.ecId === ecId && c.etatSeance === "realisee" && (c.statut === "soumis" || c.statut === "valide"));
  const heuresEffectuees = done.reduce((s, c) => s + durationHours(c.heureDebut, c.heureFin), 0);
  const tauxPresenceMoyen = done.length
    ? done.reduce((s, c) => s + (c.tauxPresence || 0), 0) / done.length
    : 0;
  return {
    heuresEffectuees: Math.round(heuresEffectuees * 10) / 10,
    heuresRestantes: Math.max(0, Math.round((vht - heuresEffectuees) * 10) / 10),
    vht,
    pctProgramme: vht > 0 ? Math.min(100, Math.round((heuresEffectuees / vht) * 100)) : 0,
    seancesRealisees: done.length,
    tauxPresenceMoyen: Math.round(tauxPresenceMoyen * 10) / 10,
  };
}

export interface CahierSubmitPayload {
  seanceId: string;
  prof: string;
  date?: string;
  sujet: string;
  resume: string;
  competences?: string;
  liensExternes?: string[];
  photosTableau?: string[];
  piecesJointes?: CahierAttachment[];
  presences: CahierPresenceEntry[];
  travail?: CahierTravail;
  evaluation?: CahierEvaluation;
  etatSeance: "preparee" | "realisee" | "annulee";
  motifAnnulation?: string;
  asDraft?: boolean;
  cahierId?: string;
}

export function submitCahierSeance(payload: CahierSubmitPayload): CahierSeanceRecord {
  const seance = store.seances.find((s) => s.id === payload.seanceId);
  if (!seance) throw new Error("Séance introuvable");

  const ec = getEcs().find((e) => e.id === seance.ecId);
  const ue = getUes().find((u) => u.id === ec?.ueId);
  const classe = getClasseById(seance.classeId);
  const salle = getSalleById(seance.salleId);

  const presents = payload.presences.filter((p) => p.statut === "present").length;
  const total = payload.presences.length || 1;
  const tauxPresence = Math.round((presents / total) * 1000) / 10;
  const absents = payload.presences.filter((p) => p.statut === "absent").map((p) => p.etudiantId);
  const retards = payload.presences.filter((p) => p.statut === "retard").map((p) => p.etudiantId);

  const base: CahierSeanceRecord = {
    id: payload.cahierId || `cah-${Date.now()}`,
    seanceId: payload.seanceId,
    annee: seance.annee || getAnneeActuelle(),
    semestre: ue?.semestre || "",
    departement: "Direction des études",
    filiere: classe?.filiere || ue?.filiere || "",
    filiereId: classe?.filiereId || ue?.filiereId || "",
    niveau: classe?.niveau || ue?.niveau || "",
    ue: ue ? `${ue.code} — ${ue.libelle}` : "",
    ueId: ue?.id || "",
    ec: ec ? `${ec.code} — ${ec.libelle}` : seance.ec,
    ecId: seance.ecId,
    classeId: seance.classeId,
    classe: seance.classe,
    prof: payload.prof,
    salle: salle?.nom || seance.salle,
    salleId: seance.salleId,
    date: payload.date || new Date().toISOString().slice(0, 10),
    heureDebut: seance.heureDebut,
    heureFin: seance.heureFin,
    typeSeance: seance.type,
    sujet: payload.sujet,
    resume: payload.resume,
    activite: payload.resume,
    competences: payload.competences || "",
    liensExternes: payload.liensExternes || [],
    photosTableau: payload.photosTableau || [],
    piecesJointes: payload.piecesJointes || [],
    presences: payload.presences,
    absents,
    retards,
    tauxPresence,
    travail: payload.travail,
    evaluation: payload.evaluation,
    etatSeance: payload.etatSeance,
    motifAnnulation: payload.motifAnnulation,
    statut: payload.asDraft ? "brouillon" : "soumis",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const existingIdx = store.cahiers.findIndex((c) => c.id === base.id || (!payload.cahierId && c.seanceId === payload.seanceId && c.statut === "brouillon"));
  if (existingIdx >= 0) {
    base.id = store.cahiers[existingIdx].id;
    base.createdAt = store.cahiers[existingIdx].createdAt;
    store.cahiers[existingIdx] = base;
  } else {
    store.cahiers.unshift(base);
  }

  if (!payload.asDraft) {
    const admin = store.users.find((u) => u.role === "admin");
    if (admin) pushNotification(admin.id, `Cahier de texte soumis : ${base.ec} — ${base.classe} (${base.date})`);
  }
  persist();
  return normalizeCahier(base);
}

export function validateCahier(id: string, actorUserId: string, approve: boolean) {
  const row = store.cahiers.find((c) => c.id === id);
  if (!row) return;
  row.statut = approve ? "valide" : "rejete";
  row.validatedBy = actorUserId;
  const teacher = store.users.find((u) => u.role === "teacher" && u.displayName.includes(row.prof.split(" ").slice(-1)[0] ?? ""));
  if (teacher) {
    pushNotification(teacher.id, `Cahier ${row.ec} ${approve ? "validé" : "rejeté"} — transmission comptabilité ${approve ? "possible" : "bloquée"}`);
  }
  logAudit(actorUserId, approve ? "validate_cahier" : "reject_cahier", "cahier", id);
  persist();
}
