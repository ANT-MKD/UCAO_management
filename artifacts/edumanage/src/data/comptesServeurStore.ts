import { supabase, appelerFonction, modeSupabase } from "@/lib/supabase";
import { PORTAIL_DU_TYPE, type CompteServeur } from "@/lib/comptesServeur";
import type { UserAccountRecord, UserRole } from "./studentStore";
import type { StatutPin } from "./pinActivationStore";

/** Mode Supabase : comptes, portails, codes PIN et demandes « mot de passe oublié » lus dans
 * la base (chacun ne reçoit que ce que ses droits lui ouvrent) et modifiés par les fonctions du
 * serveur, qui vérifient elles-mêmes les droits. Chaque liste se charge à la première lecture et se
 * recharge après chaque modification. */

/** Liste lue sur le serveur, au même modèle d'abonnement que les autres stores de l'application. */
function sourceServeur<T>(vide: T, charger: () => Promise<T>) {
  let valeur = vide;
  let demandee = false;
  const ecouteurs = new Set<() => void>();
  const rafraichir = async (): Promise<void> => {
    try {
      valeur = await charger();
    } catch (erreur) {
      console.error("[EduManage] Lecture sur le serveur impossible :", erreur);
      return;
    }
    ecouteurs.forEach((f) => f());
  };
  return {
    lire: () => valeur,
    abonner: (f: () => void) => {
      ecouteurs.add(f);
      if (modeSupabase && !demandee) {
        demandee = true;
        void rafraichir();
      }
      return () => {
        ecouteurs.delete(f);
      };
    },
    rafraichir,
  };
}

function client() {
  if (!supabase) throw new Error("La base de données n'est pas configurée.");
  return supabase;
}

/** Erreur d'une lecture ou d'une fonction de la base : son message est déjà rédigé pour l'utilisateur. */
function verifier<T>(resultat: { data: T; error: { message: string } | null }): T {
  if (resultat.error) throw new Error(resultat.error.message);
  return resultat.data;
}

// ——— Comptes ———

interface LigneCompte extends CompteServeur {
  telephone: string;
  fonction: string;
  mot_de_passe_change_le: string | null;
}

/** Compte de la base, dans la forme qu'utilisent les écrans (sans mot de passe : il reste chez
 * Supabase Auth). */
export function compteVersRecord(c: LigneCompte): UserAccountRecord {
  return {
    id: c.id,
    role: PORTAIL_DU_TYPE[c.type_compte],
    email: c.email,
    password: "",
    identifier: c.identifiant,
    displayName: c.nom_affiche,
    linkedId: c.lien_id ?? undefined,
    fonction: c.fonction || undefined,
    telephone: c.telephone || undefined,
    actif: c.actif,
    roleId: c.role_id ?? undefined,
    passwordUpdatedAt: c.mot_de_passe_change_le ?? undefined,
    doitChangerMotDePasse: c.doit_changer_mot_de_passe,
  };
}

export const comptesServeur = sourceServeur<UserAccountRecord[]>([], async () => {
  const lignes = verifier(await client().from("comptes")
    .select("id, type_compte, identifiant, nom_affiche, email, telephone, fonction, lien_id, role_id, actif, doit_changer_mot_de_passe, mot_de_passe_change_le")
    .order("nom_affiche"));
  return (lignes as LigneCompte[]).map(compteVersRecord);
});

export interface NouveauCompteServeur {
  typeCompte: "administration" | "enseignant" | "etudiant";
  identifiant: string;
  nomAffiche: string;
  email: string;
  telephone?: string;
  fonction?: string;
  roleId?: string;
  lienId?: string;
  motDePasse: string;
}

/** Création par la fonction serveur « comptes » (identité Supabase + compte, ou rien). */
export async function creerCompteServeur(c: NouveauCompteServeur): Promise<string> {
  const { id } = await appelerFonction<{ id: string }>("comptes", {
    action: "creer",
    type_compte: c.typeCompte,
    identifiant: c.identifiant,
    nom_affiche: c.nomAffiche,
    email: c.email,
    telephone: c.telephone ?? "",
    fonction: c.fonction ?? "",
    role_id: c.roleId ?? null,
    lien_id: c.lienId ?? null,
    mot_de_passe: c.motDePasse,
  });
  await comptesServeur.rafraichir();
  return id;
}

export async function modifierCompteServeur(
  id: string,
  p: { displayName: string; email: string; telephone?: string; fonction?: string; roleId?: string },
): Promise<void> {
  verifier(await client().rpc("modifier_compte", {
    p_compte: id,
    p_nom_affiche: p.displayName,
    p_email: p.email,
    p_telephone: p.telephone ?? "",
    p_fonction: p.fonction ?? "",
    p_role_id: p.roleId || null,
  }));
  await comptesServeur.rafraichir();
}

export async function definirCompteActifServeur(id: string, actif: boolean): Promise<void> {
  verifier(await client().rpc("definir_compte_actif", { p_compte: id, p_actif: actif }));
  await comptesServeur.rafraichir();
}

/** Création et dernière connexion d'un compte, lues au journal (si le compte connecté a la page
 * « Journal d'audit » ; sinon rien). */
export async function historiqueCompteServeur(id: string): Promise<{ creePar?: string; creeLe?: string; derniereConnexion?: string }> {
  const lignes = verifier(await client().from("journal_audit")
    .select("acteur, action, cree_le")
    .eq("cible_type", "compte").eq("cible_id", id)
    .in("action", ["create_user_account", "installation", "login"])
    .order("cree_le", { ascending: false })
    .limit(50)) as { acteur: string | null; action: string; cree_le: string }[];
  const creation = lignes.find((l) => l.action !== "login");
  return {
    creePar: creation?.acteur ?? undefined,
    creeLe: creation?.cree_le,
    derniereConnexion: lignes.find((l) => l.action === "login")?.cree_le,
  };
}

// ——— Portails ———

export interface PortailsVue {
  ouverts: Record<UserRole, boolean>;
  messages: Record<UserRole, string>;
}

export const portailsServeur = sourceServeur<PortailsVue>(
  { ouverts: { admin: true, teacher: true, student: true }, messages: { admin: "", teacher: "", student: "" } },
  async () => {
    const lignes = verifier(await client().from("portails").select("type_compte, ouvert, message")) as {
      type_compte: CompteServeur["type_compte"]; ouvert: boolean; message: string;
    }[];
    const vue: PortailsVue = { ouverts: { admin: true, teacher: true, student: true }, messages: { admin: "", teacher: "", student: "" } };
    for (const l of lignes) {
      vue.ouverts[PORTAIL_DU_TYPE[l.type_compte]] = l.ouvert;
      vue.messages[PORTAIL_DU_TYPE[l.type_compte]] = l.message;
    }
    return vue;
  },
);

const TYPE_DU_PORTAIL: Record<UserRole, CompteServeur["type_compte"]> = { admin: "administration", teacher: "enseignant", student: "etudiant" };

export async function definirPortailServeur(role: UserRole, ouvert: boolean, message = ""): Promise<void> {
  verifier(await client().rpc("definir_portail", { p_type_compte: TYPE_DU_PORTAIL[role], p_ouvert: ouvert, p_message: message }));
  await portailsServeur.rafraichir();
}

// ——— Codes PIN et demandes « mot de passe oublié » ———

export interface CodeServeur {
  id: string;
  compteId: string;
  auteurId?: string;
  createdAt: string;
  statut: StatutPin;
}

export const codesServeur = sourceServeur<CodeServeur[]>([], async () => {
  const lignes = verifier(await client().from("codes_pin_suivi").select("id, compte, auteur, cree_le, statut").order("id", { ascending: false })) as {
    id: number; compte: string; auteur: string | null; cree_le: string; statut: StatutPin;
  }[];
  return lignes.map((l) => ({ id: String(l.id), compteId: l.compte, auteurId: l.auteur ?? undefined, createdAt: l.cree_le, statut: l.statut }));
});

export interface DemandeServeur {
  id: string;
  compteId: string;
  createdAt: string;
}

export const demandesServeur = sourceServeur<DemandeServeur[]>([], async () => {
  const lignes = verifier(await client().from("demandes_reinitialisation").select("id, compte, cree_le").is("traitee_le", null).order("cree_le")) as {
    id: number; compte: string; cree_le: string;
  }[];
  return lignes.map((l) => ({ id: String(l.id), compteId: l.compte, createdAt: l.cree_le }));
});

/** Nouveau code pour un compte : le code en clair n'est renvoyé qu'ici, une seule fois (la base n'en
 * garde qu'une empreinte). */
export async function genererCodeServeur(compteId: string): Promise<{ code: string; expireLe: string }> {
  const r = verifier(await client().rpc("generer_code_pin", { p_compte: compteId })) as { code: string; expire_le: string };
  await Promise.all([codesServeur.rafraichir(), demandesServeur.rafraichir()]);
  return { code: r.code, expireLe: r.expire_le };
}

export async function revoquerCodeServeur(id: string): Promise<void> {
  verifier(await client().rpc("revoquer_code_pin", { p_code: Number(id) }));
  await codesServeur.rafraichir();
}
