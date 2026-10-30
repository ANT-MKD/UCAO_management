// Fonction serveur « connexion » : tout ce qui se fait avant d'être connecté.
//   connecter     : matricule ou identifiant + mot de passe → session (verrouillage après 5 échecs) ;
//   installer     : première ouverture (premier administrateur, établissement, année en cours) ;
//   demander      : « mot de passe oublié », l'administration est prévenue ;
//   reinitialiser : code PIN remis par l'administration + nouveau mot de passe.
// Appelée sans session (verify_jwt = false) : chaque action fait ses propres contrôles.
import {
  ENTETES_CORS, adresseTechnique, clientServeur, clientSession, lireCorps, messageBase, motifMotDePasse,
  refuser, repondre, texte,
} from "../_shared/commun.ts";

const INDISPONIBLE = "Connexion impossible pour le moment. Réessayez dans quelques instants.";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function verrouille(minutes: unknown): Response {
  const n = Math.max(1, Number(minutes) || 15);
  return refuser(429, `Trop de tentatives échouées. Réessayez dans ${n} minute(s).`);
}

async function connecter(req: Request, corps: Record<string, unknown>): Promise<Response> {
  const identifiant = texte(corps.identifiant);
  const motDePasse = typeof corps.mot_de_passe === "string" ? corps.mot_de_passe : "";
  if (!identifiant || !motDePasse) return refuser(400, "Saisissez votre identifiant et votre mot de passe.");

  const serveur = clientServeur();
  const { data: etat, error } = await serveur.rpc("connexion_preparer", { p_identifiant: identifiant });
  if (error) return refuser(500, INDISPONIBLE);
  if (etat.verrouille) return verrouille(etat.minutes);

  const echec = async (): Promise<Response> => {
    const { data } = await serveur.rpc("connexion_echec", { p_identifiant: identifiant });
    return data?.verrouille ? verrouille(data.minutes) : refuser(401, "Identifiants incorrects.");
  };
  if (!etat.email) return await echec();

  const { data, error: erreurAuth } = await clientSession(req).auth.signInWithPassword({ email: etat.email, password: motDePasse });
  if (erreurAuth || !data.session) {
    if (erreurAuth?.code === "invalid_credentials") return await echec();
    console.error("connexion : refus de Supabase Auth", erreurAuth?.code, erreurAuth?.status);
    return refuser(503, INDISPONIBLE);
  }

  const { data: controle, error: erreurControle } = await serveur.rpc("connexion_reussie", {
    p_compte: data.user.id, p_identifiant: identifiant,
  });
  if (erreurControle || !controle?.autorise) {
    await serveur.auth.admin.signOut(data.session.access_token, "local");
    return refuser(403, controle?.message ?? INDISPONIBLE);
  }
  return repondre(200, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    doit_changer_mot_de_passe: controle.doit_changer_mot_de_passe,
  });
}

async function installer(corps: Record<string, unknown>): Promise<Response> {
  const motDePasse = corps.mot_de_passe;
  const motif = motifMotDePasse(motDePasse, 8);
  if (motif) return refuser(400, motif.replace("Le mot de passe", "Le mot de passe de l'administrateur principal"));
  const dateDebut = texte(corps.date_debut);
  const dateFin = texte(corps.date_fin);
  if (!DATE.test(dateDebut) || !DATE.test(dateFin)) return refuser(400, "Renseignez la date de début et la date de fin.");
  const parametres = {
    p_identifiant: texte(corps.identifiant),
    p_prenom: texte(corps.prenom),
    p_nom: texte(corps.nom),
    p_email: texte(corps.email),
    p_annee: texte(corps.annee),
    p_date_debut: dateDebut,
    p_date_fin: dateFin,
    p_etablissement: texte(corps.etablissement) || null,
  };

  const serveur = clientServeur();
  // Contrôle d'abord (sans rien créer), puis l'identité Supabase, puis l'enregistrement.
  const controle = await serveur.rpc("installation_enregistrer", { p_compte: null, ...parametres });
  if (controle.error) return refuser(400, messageBase(controle.error, "Installation impossible."));

  const { data: cree, error: erreurCreation } = await serveur.auth.admin.createUser({
    email: adresseTechnique(parametres.p_identifiant),
    password: motDePasse as string,
    email_confirm: true,
  });
  if (erreurCreation || !cree.user) {
    console.error("installer : création de l'identité refusée", erreurCreation?.code, erreurCreation?.message);
    return refuser(erreurCreation?.code === "weak_password" ? 400 : 500,
      erreurCreation?.code === "weak_password" ? "Ce mot de passe est trop faible : choisissez-en un autre." : "Installation impossible pour le moment.");
  }
  const enregistrement = await serveur.rpc("installation_enregistrer", { p_compte: cree.user.id, ...parametres });
  if (enregistrement.error) {
    await serveur.auth.admin.deleteUser(cree.user.id);
    return refuser(400, messageBase(enregistrement.error, "Installation impossible."));
  }
  return repondre(201, { ok: true });
}

async function demander(corps: Record<string, unknown>): Promise<Response> {
  const identifiant = texte(corps.identifiant);
  if (!identifiant) return refuser(400, "Saisissez votre matricule ou votre identifiant.");
  const { error } = await clientServeur().rpc("demande_reinitialisation", { p_identifiant: identifiant });
  if (error) return refuser(500, INDISPONIBLE);
  // Même réponse que le compte existe ou non.
  return repondre(200, { ok: true });
}

async function reinitialiser(corps: Record<string, unknown>): Promise<Response> {
  const identifiant = texte(corps.identifiant);
  const code = texte(corps.code);
  const motDePasse = corps.mot_de_passe;
  if (!identifiant) return refuser(400, "Saisissez votre matricule ou votre identifiant.");
  if (!code) return refuser(400, "Saisissez le code remis par l'administration.");
  const motif = motifMotDePasse(motDePasse);
  if (motif) return refuser(400, motif);

  const serveur = clientServeur();
  const { data: verification, error } = await serveur.rpc("code_pin_utiliser", { p_identifiant: identifiant, p_code: code });
  if (error) return refuser(500, INDISPONIBLE);
  if (!verification?.ok) return refuser(400, verification?.message ?? "Code invalide ou expiré.");

  const { error: erreurMaj } = await serveur.auth.admin.updateUserById(verification.compte, { password: motDePasse as string });
  if (erreurMaj) {
    console.error("reinitialiser : mot de passe refusé", erreurMaj.code, erreurMaj.message);
    return refuser(400, erreurMaj.code === "weak_password"
      ? "Ce mot de passe est trop faible : demandez un nouveau code et choisissez-en un autre."
      : "Le mot de passe n'a pas pu être changé : demandez un nouveau code à l'administration.");
  }
  await serveur.rpc("mot_de_passe_definitif", { p_compte: verification.compte, p_action: "reset_password_pin" });
  return repondre(200, { ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: ENTETES_CORS });
  if (req.method !== "POST") return refuser(405, "Méthode non prise en charge.");
  const corps = await lireCorps(req);
  if (!corps) return refuser(400, "Requête illisible.");
  try {
    switch (corps.action) {
      case "connecter": return await connecter(req, corps);
      case "installer": return await installer(corps);
      case "demander": return await demander(corps);
      case "reinitialiser": return await reinitialiser(corps);
      default: return refuser(400, "Action inconnue.");
    }
  } catch (erreur) {
    console.error("connexion :", erreur);
    return refuser(500, INDISPONIBLE);
  }
});
