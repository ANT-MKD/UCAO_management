import { modeSupabase } from "@/lib/supabase";
import {
  creerCompteStaff,
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
  creerCompteServeur,
  definirCompteActifServeur,
  definirPortailServeur,
  genererCodeServeur,
  modifierCompteServeur,
  revoquerCodeServeur,
} from "./comptesServeurStore";

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
