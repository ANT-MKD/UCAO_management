import {
  getGroupesExternes,
  getGroupesInternes,
  getGroupesPersonnalises,
  resolveMembresGroupeInterne,
  resolveMembresGroupePersonnalise,
} from "./communicationGroupsStore";
import { estAutorise } from "./communicationRolesStore";
import { getEtudiants, getUserAccounts, pushNotificationEtPersister } from "./studentStore";

const STORAGE_KEY = "edumanage-mails-envoyes-v1";

export type TypeDestinataireMail = "groupe_externe" | "groupe_interne" | "groupe_personnalise" | "compte";

/** Ce que l'auteur a choisi dans le composeur — conservé pour l'affichage en consultation, distinct
 * de la résolution réelle (un groupe peut évoluer après l'envoi, la résolution est un instantané). */
export interface SelectionDestinataireMail {
  type: TypeDestinataireMail;
  id: string;
  label: string;
}

export interface DestinataireResoluMail {
  label: string;
  email?: string;
  telephone?: string;
  /** Compte in-app lié — permet une vraie notification, pas seulement un log. */
  userId?: string;
}

export type StatutMail = "traite" | "en_attente_validation" | "rejete";

export interface MailEnvoyeRecord {
  id: string;
  auteurId: string;
  auteurLabel: string;
  date: string;
  selections: SelectionDestinataireMail[];
  destinataires: DestinataireResoluMail[];
  emailsSupplementaires: string[];
  objet: string;
  message: string;
  /** Référence locale (nom fichier) — pas de stockage binaire lourd. */
  fichiers: string[];
  statut: StatutMail;
  validateurId?: string;
  validateurLabel?: string;
  dateTraitement?: string;
  motifRejet?: string;
}

let store: MailEnvoyeRecord[] = load();

function load(): MailEnvoyeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MailEnvoyeRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((fn) => fn());
}

function persist() {
  store = store.slice();
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
  notify();
}

export function subscribeMailsEnvoyes(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getMailsEnvoyes(): MailEnvoyeRecord[] {
  return store;
}

export function getMailById(id: string): MailEnvoyeRecord | undefined {
  return store.find((m) => m.id === id);
}

/** Résout une sélection de groupes/comptes en destinataires réels — toujours recalculé au moment de
 * l'envoi contre les vrais étudiants/comptes, jamais une copie qui pourrait devenir obsolète. */
export function resolveDestinataires(selections: SelectionDestinataireMail[]): DestinataireResoluMail[] {
  const etudiants = getEtudiants();
  const comptes = getUserAccounts();
  const out: DestinataireResoluMail[] = [];
  const seen = new Set<string>();

  const push = (d: DestinataireResoluMail) => {
    const key = d.userId ?? d.email ?? d.telephone ?? d.label;
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(d);
  };

  for (const sel of selections) {
    if (sel.type === "groupe_externe") {
      const groupe = getGroupesExternes().find((g) => g.id === sel.id);
      groupe?.contacts.forEach((c) => push({ label: c.intitule, email: c.email, telephone: c.telephone }));
    } else if (sel.type === "groupe_interne") {
      const groupe = getGroupesInternes().find((g) => g.id === sel.id);
      if (groupe) {
        resolveMembresGroupeInterne(groupe, etudiants).forEach((e) => {
          const compte = comptes.find((c) => c.role === "student" && c.linkedId === e.id);
          push({ label: `${e.prenom} ${e.nom}`, email: e.email, telephone: e.telephone, userId: compte?.id });
        });
      }
    } else if (sel.type === "groupe_personnalise") {
      const groupe = getGroupesPersonnalises().find((g) => g.id === sel.id);
      if (groupe) {
        resolveMembresGroupePersonnalise(groupe.regles, etudiants).forEach((e) => {
          const compte = comptes.find((c) => c.role === "student" && c.linkedId === e.id);
          push({ label: `${e.prenom} ${e.nom}`, email: e.email, telephone: e.telephone, userId: compte?.id });
        });
      }
    } else if (sel.type === "compte") {
      const compte = comptes.find((c) => c.id === sel.id);
      if (compte) push({ label: compte.displayName, email: compte.email, userId: compte.id });
    }
  }

  return out;
}

/** Notifie réellement, in-app, chaque destinataire résolu qui a un compte lié — c'est la seule
 * livraison réelle possible tant qu'aucune passerelle mail externe n'est branchée (voir
 * communicationApiConfigStore). Les contacts externes / comptes sans lien restent dans le log mais
 * ne reçoivent rien de plus qu'une trace. */
function notifierDestinataires(mail: MailEnvoyeRecord) {
  for (const d of mail.destinataires) {
    if (d.userId) pushNotificationEtPersister(d.userId, `Nouveau message : ${mail.objet}`);
  }
}

export interface EnvoyerMailPayload {
  auteurId: string;
  auteurLabel: string;
  selections: SelectionDestinataireMail[];
  emailsSupplementaires: string[];
  objet: string;
  message: string;
  fichiers: string[];
}

/** Un mail envoyé par un validateur désigné (Paramétrage communication → Validateur Messages) part
 * immédiatement ; sinon il passe par la file de validation, exactement comme la demande de rallonge
 * exige un validateur désigné avant de créer une vraie dérogation. */
export function envoyerMail(payload: EnvoyerMailPayload): MailEnvoyeRecord {
  const destinataires = resolveDestinataires(payload.selections);
  const autorise = estAutorise("validateur_message", payload.auteurId);
  const now = new Date().toISOString();

  const mail: MailEnvoyeRecord = {
    id: `mail-${Date.now()}`,
    auteurId: payload.auteurId,
    auteurLabel: payload.auteurLabel,
    date: now,
    selections: payload.selections,
    destinataires,
    emailsSupplementaires: payload.emailsSupplementaires,
    objet: payload.objet,
    message: payload.message,
    fichiers: payload.fichiers,
    statut: autorise ? "traite" : "en_attente_validation",
  };

  if (autorise) {
    mail.validateurId = payload.auteurId;
    mail.validateurLabel = payload.auteurLabel;
    mail.dateTraitement = now;
  }

  store = [mail, ...store];
  persist();

  if (autorise) notifierDestinataires(mail);

  return mail;
}

export function validerMail(id: string, validateurId: string, validateurLabel: string): void {
  const mail = store.find((m) => m.id === id);
  if (!mail) return;
  if (!estAutorise("validateur_message", validateurId)) {
    throw new Error("Seul un validateur désigné (Paramétrage communication) peut valider un mail.");
  }
  mail.statut = "traite";
  mail.validateurId = validateurId;
  mail.validateurLabel = validateurLabel;
  mail.dateTraitement = new Date().toISOString();
  persist();
  notifierDestinataires(mail);
}

export function rejeterMail(id: string, validateurId: string, validateurLabel: string, motif: string): void {
  const mail = store.find((m) => m.id === id);
  if (!mail) return;
  if (!estAutorise("validateur_message", validateurId)) {
    throw new Error("Seul un validateur désigné (Paramétrage communication) peut rejeter un mail.");
  }
  mail.statut = "rejete";
  mail.validateurId = validateurId;
  mail.validateurLabel = validateurLabel;
  mail.dateTraitement = new Date().toISOString();
  mail.motifRejet = motif;
  persist();
}
