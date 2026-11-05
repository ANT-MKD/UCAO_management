import { ecrireStockage, lireStockage } from "@/lib/stockageLocal";
import { copieModele, MODELES_PAR_DEFAUT, type ModeleAttestation, type ParagrapheModele, type TypeModele } from "@/lib/modelesAttestations";
import { logAudit } from "./studentStore";

/** Textes des attestations (Paramètres généraux → Textes des attestations), un par type. Avec la
 * base : table modeles_attestations, que la base contrôle et copie dans chaque attestation émise. */
const STORAGE_KEY = "edumanage-modeles-attestations-v1";

type EtatModeles = Record<TypeModele, ModeleAttestation>;
const TYPES: TypeModele[] = ["inscription", "scolarite", "reussite"];

function etatParDefaut(): EtatModeles {
  return { inscription: copieModele(MODELES_PAR_DEFAUT.inscription), scolarite: copieModele(MODELES_PAR_DEFAUT.scolarite), reussite: copieModele(MODELES_PAR_DEFAUT.reussite) };
}

function charger(): EtatModeles {
  const etat = etatParDefaut();
  if (typeof window === "undefined") return etat;
  try {
    const brut = lireStockage(STORAGE_KEY);
    if (!brut) return etat;
    const lu = JSON.parse(brut) as Partial<EtatModeles>;
    for (const t of TYPES) if (lu[t]?.titre && Array.isArray(lu[t]?.paragraphes)) etat[t] = copieModele(lu[t]!);
    return etat;
  } catch {
    return etat;
  }
}

let store: EtatModeles = charger();
const listeners = new Set<() => void>();

function persister() {
  store = { ...store };
  if (typeof window !== "undefined") ecrireStockage(STORAGE_KEY, JSON.stringify(store));
  listeners.forEach((fn) => fn());
}

export function subscribeModelesAttestations(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getModelesAttestations(): EtatModeles {
  return store;
}

/** Texte actuel d'une attestation : celui que la base copiera dans la prochaine émise. */
export function getModeleAttestation(type: TypeModele): ModeleAttestation {
  return store[type];
}

export function setModeleAttestation(type: TypeModele, modele: ModeleAttestation, actorId: string): void {
  store = { ...store, [type]: copieModele(modele) };
  logAudit(actorId, "update_modele_attestation", "modeles_attestations", type, modele.titre);
  persister();
}

/** Lignes de la base (une par type d'attestation). */
export type ModeleAttestationRecord = { id: TypeModele; titre: string; paragraphes: ParagrapheModele[] };

export function getModelesAttestationsLignes(): ModeleAttestationRecord[] {
  return TYPES.map((id) => ({ id, ...copieModele(store[id]) }));
}

/** Textes de la base ; un type absent garde son texte de départ. */
export function remplacerModelesAttestations(lignes: ModeleAttestationRecord[]) {
  const etat = etatParDefaut();
  for (const l of lignes) if (TYPES.includes(l.id) && l.titre && Array.isArray(l.paragraphes)) etat[l.id] = copieModele(l);
  store = etat;
  persister();
}
