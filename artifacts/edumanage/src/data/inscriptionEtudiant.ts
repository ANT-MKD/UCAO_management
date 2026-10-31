import { useEffect, useState } from "react";
import { modeSupabase, supabase } from "@/lib/supabase";
import { attendreEnvois } from "@/lib/miroirServeur";
import { generateMotDePasse } from "@/lib/inscriptionConstants";
import { FILIERES } from "./mockData";
import { allocateMatricule, peekNextMatricule, type EtudiantRecord } from "./studentStore";
import { creerCompteServeur } from "./comptesServeurStore";

/** Inscription d'un étudiant (ajout, import, conversion d'un devis), avec Supabase ou dans le
 * navigateur : le matricule est réservé par le serveur (jamais deux fois le même, même pour deux
 * postes au même instant), le dossier part vers la base, puis le serveur ouvre le compte. */

const codeFiliere = (filiereId: string) => FILIERES.find((f) => f.id === filiereId)?.code ?? "XXX";

async function rpcTexte(nom: string, args: Record<string, unknown>): Promise<string> {
  if (!supabase) throw new Error("La base de données n'est pas configurée.");
  const { data, error } = await supabase.rpc(nom, args);
  if (error) throw new Error(error.message || "Le serveur n'a pas pu attribuer le matricule.");
  return data as string;
}

/** Réserve le matricule définitif (à l'enregistrement, jamais pendant la saisie). */
export async function reserverMatricule(filiereId: string, annee: string): Promise<string> {
  if (!modeSupabase) return allocateMatricule(codeFiliere(filiereId), annee);
  return rpcTexte("attribuer_matricule", { p_filiere_id: filiereId, p_annee: annee });
}

/** Prochain matricule, affiché pendant la saisie sans être réservé. */
export async function apercuMatricule(filiereId: string, annee: string): Promise<string> {
  if (!modeSupabase) return peekNextMatricule(codeFiliere(filiereId), annee);
  return rpcTexte("apercu_matricule", { p_filiere_id: filiereId, p_annee: annee });
}

export function useApercuMatricule(filiereId: string | undefined, annee: string): string {
  const [apercu, setApercu] = useState("—");
  useEffect(() => {
    if (!filiereId || !modeSupabase) return;
    let actif = true;
    apercuMatricule(filiereId, annee)
      .then((m) => actif && setApercu(m))
      .catch(() => actif && setApercu("attribué à l'enregistrement"));
    return () => {
      actif = false;
    };
  }, [filiereId, annee]);
  if (!filiereId) return "—";
  return modeSupabase ? apercu : peekNextMatricule(codeFiliere(filiereId), annee);
}

/** Ouvre le compte de connexion d'un étudiant inscrit. Avec Supabase, une fois son dossier arrivé
 * dans la base (le serveur refuse un compte sans dossier) ; sans mot de passe remis, le compte
 * attend un code PIN. Dans le navigateur, registerNewEtudiant l'a déjà ouvert. */
export async function ouvrirCompteEtudiant(etudiant: EtudiantRecord, motDePasse?: string): Promise<void> {
  if (!modeSupabase) return;
  await attendreEnvois();
  await creerCompteServeur({
    typeCompte: "etudiant",
    identifiant: etudiant.matricule,
    nomAffiche: `${etudiant.prenom} ${etudiant.nom}`,
    email: etudiant.email,
    telephone: etudiant.telephone,
    lienId: etudiant.id,
    motDePasse: motDePasse || generateMotDePasse(),
  });
}
