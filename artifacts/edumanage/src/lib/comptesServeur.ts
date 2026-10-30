import { changeOwnPassword, type UserRole } from "@/data/studentStore";
import { PORTAL_LABELS } from "@/data/portalAccessStore";
import { appelerFonction, ErreurServeur, supabase } from "@/lib/supabase";

/** Ligne de public.comptes telle que la lit le compte connecté (le sien). */
export interface CompteServeur {
  id: string;
  type_compte: "administration" | "enseignant" | "etudiant";
  identifiant: string;
  nom_affiche: string;
  email: string;
  lien_id: string | null;
  role_id: string | null;
  actif: boolean;
  doit_changer_mot_de_passe: boolean;
}

export const PORTAIL_DU_TYPE: Record<CompteServeur["type_compte"], UserRole> = {
  administration: "admin",
  enseignant: "teacher",
  etudiant: "student",
};

/** Compte connecté, dans la forme qu'utilise l'application (AuthContext). */
export interface UtilisateurServeur {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  identifier: string;
  linkedId?: string;
  roleId?: string;
  doitChangerMotDePasse: boolean;
}

export function utilisateurDuCompte(compte: CompteServeur): UtilisateurServeur {
  return {
    id: compte.id,
    name: compte.nom_affiche,
    email: compte.email,
    role: PORTAIL_DU_TYPE[compte.type_compte],
    identifier: compte.identifiant,
    linkedId: compte.lien_id ?? undefined,
    roleId: compte.role_id ?? undefined,
    doitChangerMotDePasse: compte.doit_changer_mot_de_passe,
  };
}

const COLONNES_COMPTE = "id, type_compte, identifiant, nom_affiche, email, lien_id, role_id, actif, doit_changer_mot_de_passe";

/** Compte de la session ouverte, s'il peut encore entrer : actif et portail ouvert. Sinon, le motif
 * du refus (la session est alors à fermer). */
export async function compteDeLaSession(): Promise<{ compte: CompteServeur } | { refus: string } | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  const id = session.session?.user.id;
  if (!id) return null;
  const { data: compte, error } = await supabase.from("comptes").select(COLONNES_COMPTE).eq("id", id).maybeSingle<CompteServeur>();
  if (error) throw new Error("Impossible de lire votre compte. Vérifiez votre connexion internet.");
  if (!compte) return { refus: "Ce compte n'est relié à aucun portail. Contactez l'administration." };
  if (!compte.actif) return { refus: "Ce compte a été désactivé. Contactez l'administration de l'établissement." };
  const { data: portail } = await supabase.from("portails").select("ouvert, message").eq("type_compte", compte.type_compte).maybeSingle<{ ouvert: boolean; message: string }>();
  if (portail && !portail.ouvert) {
    const libelle = PORTAL_LABELS[PORTAIL_DU_TYPE[compte.type_compte]];
    return { refus: `Le portail ${libelle} est actuellement fermé${portail.message ? ` : ${portail.message}` : ""}. Contactez l'administration.` };
  }
  return { compte };
}

/** Connexion par matricule ou identifiant. null : identifiants incorrects ; une erreur porte le
 * motif d'un refus (verrouillage, compte désactivé, portail fermé). */
export async function connecterServeur(identifiant: string, motDePasse: string): Promise<CompteServeur | null> {
  if (!supabase) return null;
  let jetons: { access_token: string; refresh_token: string };
  try {
    jetons = await appelerFonction("connexion", { action: "connecter", identifiant, mot_de_passe: motDePasse });
  } catch (erreur) {
    if (erreur instanceof ErreurServeur && erreur.statut === 401) return null;
    throw erreur;
  }
  const { error } = await supabase.auth.setSession(jetons);
  if (error) throw new Error("Connexion impossible pour le moment. Réessayez dans quelques instants.");
  const etat = await compteDeLaSession();
  if (!etat) throw new Error("Connexion impossible pour le moment. Réessayez dans quelques instants.");
  if ("refus" in etat) {
    await supabase.auth.signOut();
    throw new Error(etat.refus);
  }
  return etat.compte;
}

export interface InstallationServeur {
  etablissement: string;
  prenom: string;
  nom: string;
  identifiant: string;
  email: string;
  motDePasse: string;
  annee: string;
  dateDebut: string;
  dateFin: string;
}

/** Première ouverture : établissement, administrateur principal et année en cours, sur le serveur. */
export async function installerServeur(p: InstallationServeur): Promise<void> {
  await appelerFonction("connexion", {
    action: "installer",
    etablissement: p.etablissement,
    prenom: p.prenom,
    nom: p.nom,
    identifiant: p.identifiant,
    email: p.email,
    mot_de_passe: p.motDePasse,
    annee: p.annee,
    date_debut: p.dateDebut,
    date_fin: p.dateFin,
  });
}

/** L'application est-elle déjà installée sur le serveur ? (lisible sans être connecté) */
export async function installationFaiteServeur(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("etat_installation");
  if (error) throw new Error("Le serveur est injoignable. Vérifiez votre connexion internet.");
  return (data as { installee?: boolean } | null)?.installee === true;
}

/** « Mot de passe oublié » : l'administration est prévenue (même réponse que le compte existe ou non). */
export async function demanderCodeServeur(identifiant: string): Promise<void> {
  await appelerFonction("connexion", { action: "demander", identifiant });
}

/** Nouveau mot de passe avec le code PIN remis par l'administration. */
export async function reinitialiserServeur(identifiant: string, code: string, motDePasse: string): Promise<void> {
  await appelerFonction("connexion", { action: "reinitialiser", identifiant, code, mot_de_passe: motDePasse });
}

/** Changement de mot de passe par son titulaire (l'ancien est exigé hors changement obligatoire). */
export async function changerMotDePasseServeur(nouveau: string, actuel?: string): Promise<void> {
  await appelerFonction("comptes", { action: "changer_mot_de_passe", nouveau, actuel });
}

/** Changement volontaire depuis le profil : sur le serveur avec Supabase, sinon dans le navigateur.
 * false : mot de passe actuel incorrect ; une erreur porte tout autre refus. */
export async function changerMonMotDePasse(compteId: string, actuel: string, nouveau: string): Promise<boolean> {
  if (!supabase) return changeOwnPassword(compteId, actuel, nouveau);
  try {
    await changerMotDePasseServeur(nouveau, actuel);
    return true;
  } catch (erreur) {
    if (erreur instanceof ErreurServeur && erreur.message === "Mot de passe actuel incorrect.") return false;
    throw erreur;
  }
}
