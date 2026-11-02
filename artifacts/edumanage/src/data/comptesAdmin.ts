import { ErreurServeur, modeSupabase } from "@/lib/supabase";
import {
  creerCompteStaff,
  getEtudiants,
  getUserAccounts,
  setUserAccountActif,
  updateUserAccountInfo,
  type CreerCompteStaffPayload,
  type UpdateUserAccountInfoPayload,
  type UserAccountRecord,
  type UserRole,
} from "./studentStore";
import { setPortalActif } from "./portalAccessStore";
import { genererPin, revoquerPin } from "./pinActivationStore";
import { envoyerMailSysteme } from "./mailEnvoyeStore";
import {
  comptesServeur,
  creerCompteServeur,
  definirCompteActifServeur,
  definirPortailServeur,
  genererCodeServeur,
  genererCodesServeur,
  modifierCompteServeur,
  revoquerCodeServeur,
} from "./comptesServeurStore";
import { ouvrirCompteEtudiant } from "./inscriptionEtudiant";

/** Actions des écrans Sécurité (Utilisateurs, Portails, Codes PIN) : sur le serveur avec Supabase,
 * dans le navigateur sinon. Mêmes règles des deux côtés ; un refus est une Error au message lisible. */

/** Compte d'administration ou de professeur (Utilisateurs, fiche enseignant). */
export async function creerCompte(payload: CreerCompteStaffPayload, acteurId: string): Promise<void> {
  if (!modeSupabase) {
    creerCompteStaff(payload, acteurId);
    return;
  }
  await creerCompteServeur({
    typeCompte: payload.role === "admin" ? "administration" : "enseignant",
    identifiant: payload.identifier,
    nomAffiche: `${payload.prenom.trim()} ${payload.nom.trim()}`,
    email: payload.email,
    telephone: payload.telephone,
    fonction: payload.fonction,
    roleId: payload.roleId,
    lienId: payload.role === "teacher" ? payload.linkedId : undefined,
    motDePasse: payload.password,
  });
}

export async function modifierCompte(id: string, payload: UpdateUserAccountInfoPayload, acteurId: string): Promise<void> {
  if (!modeSupabase) {
    updateUserAccountInfo(id, payload, acteurId);
    return;
  }
  await modifierCompteServeur(id, payload);
}

export async function definirCompteActif(id: string, actif: boolean, acteurId: string): Promise<void> {
  if (!modeSupabase) {
    setUserAccountActif(id, actif, acteurId);
    return;
  }
  await definirCompteActifServeur(id, actif);
}

export async function definirPortail(role: UserRole, ouvert: boolean, message = ""): Promise<void> {
  if (!modeSupabase) {
    setPortalActif(role, ouvert);
    return;
  }
  await definirPortailServeur(role, ouvert, message);
}

/** Nouveau code PIN, à remettre en main propre. Avec Supabase, le code n'est montré qu'ici, une
 * seule fois : la base n'en garde qu'une empreinte, et il n'est copié dans aucun mail. */
export async function genererCodePin(compte: UserAccountRecord, acteur: { id: string; name: string }): Promise<{ id: string; code: string }> {
  if (modeSupabase) {
    const { code } = await genererCodeServeur(compte.id);
    return { id: "", code };
  }
  const record = genererPin(compte.id, compte.displayName, compte.identifier, acteur.id, acteur.name);
  envoyerMailSysteme({
    destinataireUserId: compte.id,
    destinataireLabel: compte.displayName,
    destinataireEmail: compte.email,
    objet: "Code de validation",
    message: `Votre code de réinitialisation de mot de passe : ${record.pin} (valable 24 heures).`,
  });
  return { id: record.id, code: record.pin };
}

export async function revoquerCodePin(id: string, acteurLabel: string): Promise<void> {
  if (!modeSupabase) {
    revoquerPin(id, acteurLabel);
    return;
  }
  await revoquerCodeServeur(id);
}

/** Code d'un étudiant, pour la liste imprimée d'une classe. */
export interface CodeEtudiant {
  etudiantId: string;
  matricule: string;
  nomComplet: string;
  code: string | null;
  expireLe: string | null;
  motif?: string;
}

/** Comptes envoyés par appel au serveur (il en accepte 100). */
export const CODES_PAR_ENVOI = 50;

/** Codes de toute une classe, en une fois (démarrage, rentrée) : chaque étudiant (hors abandon)
 * reçoit un code valable « jours » jours, qui remplace le précédent. Avec Supabase, le compte d'un
 * étudiant qui n'en a pas encore est d'abord ouvert ; un compte désactivé, ou qui n'a pu être ouvert,
 * figure dans la liste sans code, avec le motif. Les codes ne sont montrés qu'ici, une fois. */
export async function genererCodesClasse(classeId: string, jours: number, acteur: { id: string; name: string },
  progression: (fait: number, total: number) => void = () => {}): Promise<CodeEtudiant[]> {
  const etudiants = getEtudiants()
    .filter((e) => e.classeId === classeId && e.statut !== "abandon")
    .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr"));
  if (etudiants.length === 0) throw new Error("Aucun étudiant dans cette classe.");
  const ligne = (e: (typeof etudiants)[number], code: string | null, expireLe: string | null, motif?: string): CodeEtudiant => ({
    etudiantId: e.id, matricule: e.matricule, nomComplet: `${e.nom} ${e.prenom}`, code, expireLe, ...(motif ? { motif } : {}),
  });
  // Avec Supabase, la liste à jour de la base : un compte ouvert depuis un autre poste n'est pas recréé.
  if (modeSupabase) await comptesServeur.rafraichir();
  const comptes = modeSupabase ? comptesServeur.lire() : getUserAccounts();
  const compteDe = new Map(comptes.filter((u) => u.role === "student" && u.linkedId).map((u) => [u.linkedId!, u]));

  if (!modeSupabase) {
    return etudiants.map((e) => {
      const compte = compteDe.get(e.id);
      if (!compte) return ligne(e, null, null, "pas de compte");
      if (compte.actif === false) return ligne(e, null, null, "compte désactivé");
      const pin = genererPin(compte.id, compte.displayName, compte.identifier, acteur.id, acteur.name, jours * 24 * 60);
      return ligne(e, pin.pin, pin.expiresAt);
    });
  }

  const idDe = new Map<string, string>();
  const nonOuverts = new Map<string, string>();
  // Un refus de droits vaut pour toute la classe : inutile de le redemander pour chaque étudiant.
  let refusDeDroits: string | null = null;
  for (const e of etudiants) {
    const compte = compteDe.get(e.id);
    if (compte) {
      idDe.set(e.id, compte.id);
      continue;
    }
    if (refusDeDroits) {
      nonOuverts.set(e.id, refusDeDroits);
      continue;
    }
    try {
      const id = await ouvrirCompteEtudiant(e);
      if (id) idDe.set(e.id, id);
    } catch (err) {
      const motif = `compte non ouvert : ${err instanceof Error ? err.message : "refus du serveur"}`;
      nonOuverts.set(e.id, motif);
      if (err instanceof ErreurServeur && err.statut === 403) refusDeDroits = motif;
    }
  }
  const ids = etudiants.map((e) => idDe.get(e.id)).filter((id): id is string => !!id);
  const codes = new Map<string, { code: string | null; expireLe: string | null; motif?: string }>();
  progression(0, ids.length);
  for (let i = 0; i < ids.length; i += CODES_PAR_ENVOI) {
    for (const c of await genererCodesServeur(ids.slice(i, i + CODES_PAR_ENVOI), jours)) codes.set(c.compteId, c);
    progression(Math.min(i + CODES_PAR_ENVOI, ids.length), ids.length);
  }
  return etudiants.map((e) => {
    const id = idDe.get(e.id);
    const c = id ? codes.get(id) : undefined;
    if (!c) return ligne(e, null, null, nonOuverts.get(e.id) ?? "pas de compte");
    return ligne(e, c.code, c.expireLe, c.motif);
  });
}
