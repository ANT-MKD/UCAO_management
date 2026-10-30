// Fonction serveur « comptes » : actions d'un compte connecté qui touchent aux identités Supabase.
//   creer                : l'administration crée un compte (administration, professeur, étudiant) ;
//   changer_mot_de_passe : le titulaire change son mot de passe (obligatoire après un mot de passe
//                          initial, ou volontaire avec l'ancien).
// La session est vérifiée ici (verify_jwt = false) ; les droits, par les fonctions de la base.
import {
  ENTETES_CORS, adresseTechnique, clientPublic, clientServeur, lireCorps, messageBase, motifMotDePasse,
  refuser, repondre, texte,
} from "../_shared/commun.ts";
import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2.118.0";

const INDISPONIBLE = "Action impossible pour le moment. Réessayez dans quelques instants.";

async function creer(serveur: SupabaseClient, acteur: User, corps: Record<string, unknown>): Promise<Response> {
  const motDePasse = corps.mot_de_passe;
  const motif = motifMotDePasse(motDePasse);
  if (motif) return refuser(400, motif);
  const parametres = {
    p_acteur: acteur.id,
    p_type_compte: texte(corps.type_compte),
    p_identifiant: texte(corps.identifiant),
    p_nom_affiche: texte(corps.nom_affiche),
    p_email: texte(corps.email),
    p_telephone: texte(corps.telephone),
    p_fonction: texte(corps.fonction),
    p_role_id: texte(corps.role_id) || null,
    p_lien_id: texte(corps.lien_id) || null,
  };

  // Contrôle des droits et des doublons d'abord, pour ne créer aucune identité Supabase pour rien.
  const controle = await serveur.rpc("compte_enregistrer", { ...parametres, p_compte: null });
  if (controle.error) return refuser(controle.error.code === "42501" ? 403 : 400, messageBase(controle.error, INDISPONIBLE));

  const { data: cree, error: erreurCreation } = await serveur.auth.admin.createUser({
    email: adresseTechnique(parametres.p_identifiant),
    password: motDePasse as string,
    email_confirm: true,
  });
  if (erreurCreation || !cree.user) {
    console.error("creer : création de l'identité refusée", erreurCreation?.code, erreurCreation?.message);
    return erreurCreation?.code === "weak_password"
      ? refuser(400, "Ce mot de passe initial est trop faible : choisissez-en un autre.")
      : refuser(500, INDISPONIBLE);
  }
  const enregistrement = await serveur.rpc("compte_enregistrer", { ...parametres, p_compte: cree.user.id });
  if (enregistrement.error) {
    await serveur.auth.admin.deleteUser(cree.user.id);
    return refuser(enregistrement.error.code === "42501" ? 403 : 400, messageBase(enregistrement.error, INDISPONIBLE));
  }
  return repondre(201, { id: cree.user.id });
}

async function changerMotDePasse(serveur: SupabaseClient, titulaire: User, jeton: string, corps: Record<string, unknown>): Promise<Response> {
  const nouveau = corps.nouveau;
  const actuel = typeof corps.actuel === "string" ? corps.actuel : "";
  const motif = motifMotDePasse(nouveau);
  if (motif) return refuser(400, motif);

  const { data: compte, error } = await serveur.from("comptes")
    .select("doit_changer_mot_de_passe, actif").eq("id", titulaire.id).maybeSingle();
  if (error) return refuser(500, INDISPONIBLE);
  if (!compte?.actif) return refuser(403, "Ce compte a été désactivé. Contactez l'administration de l'établissement.");

  // Un mot de passe est-il le bon ? (session d'essai aussitôt fermée)
  const estLeMotDePasse = async (motDePasse: string): Promise<boolean> => {
    const { data, error: refus } = await clientPublic().auth.signInWithPassword({ email: titulaire.email!, password: motDePasse });
    if (data.session) await serveur.auth.admin.signOut(data.session.access_token, "local");
    return !refus && !!data.session;
  };
  // Changement volontaire : l'ancien mot de passe est exigé. Changement obligatoire (mot de passe
  // initial remis par l'administration) : la session suffit.
  if (!compte.doit_changer_mot_de_passe) {
    if (!actuel) return refuser(400, "Saisissez votre mot de passe actuel.");
    if (!(await estLeMotDePasse(actuel))) return refuser(400, "Mot de passe actuel incorrect.");
  }
  if (nouveau === actuel || await estLeMotDePasse(nouveau as string)) {
    return refuser(400, "Le nouveau mot de passe doit être différent de l'actuel.");
  }

  const { error: erreurMaj } = await serveur.auth.admin.updateUserById(titulaire.id, { password: nouveau as string });
  if (erreurMaj) {
    console.error("changer_mot_de_passe : refusé", erreurMaj.code, erreurMaj.message);
    return erreurMaj.code === "weak_password"
      ? refuser(400, "Ce mot de passe est trop faible : choisissez-en un autre.")
      : refuser(500, INDISPONIBLE);
  }
  const { error: erreurBase } = await serveur.rpc("mot_de_passe_definitif", { p_compte: titulaire.id, p_action: "update_password" });
  if (erreurBase) return refuser(500, INDISPONIBLE);
  // Les autres sessions ouvertes (autre appareil) se ferment : seul celui qui a changé reste connecté.
  await serveur.auth.admin.signOut(jeton, "others");
  return repondre(200, { ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: ENTETES_CORS });
  if (req.method !== "POST") return refuser(405, "Méthode non prise en charge.");
  const jeton = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!jeton) return refuser(401, "Connectez-vous pour continuer.");
  const corps = await lireCorps(req);
  if (!corps) return refuser(400, "Requête illisible.");
  try {
    const serveur = clientServeur();
    const { data, error } = await serveur.auth.getUser(jeton);
    if (error || !data.user) return refuser(401, "Votre session a expiré : reconnectez-vous.");
    switch (corps.action) {
      case "creer": return await creer(serveur, data.user, corps);
      case "changer_mot_de_passe": return await changerMotDePasse(serveur, data.user, jeton, corps);
      default: return refuser(400, "Action inconnue.");
    }
  } catch (erreur) {
    console.error("comptes :", erreur);
    return refuser(500, INDISPONIBLE);
  }
});
