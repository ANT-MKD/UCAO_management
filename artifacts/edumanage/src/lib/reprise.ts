import { appelerFonction } from "@/lib/supabase";
import { preparerReprise, type FichierRepris } from "@/lib/miroirServeur";
import { getAnneeActuelle, getUserAccounts, type UserRole } from "@/data/studentStore";
import "@/data/miroirs";

/** Reprise des données d'un poste (partie 9, lot 3). La page est ouverte en mode reprise : les
 * stores contiennent les données du poste d'avant la base. Elles sont écrites comme les lignes de
 * la base, essayées (rapport de contrôle), puis reprises par la fonction serveur « reprise » :
 * comptes créés, fichiers déposés, puis tout en une transaction. */

type Ligne = Record<string, unknown>;

export interface CompteRepris {
  ancien: string;
  type_compte: "administration" | "enseignant" | "etudiant";
  identifiant: string;
  nom_affiche: string;
  email: string;
  telephone: string;
  fonction: string;
  role_id: string | null;
  lien_id: string | null;
  actif: boolean;
  id?: string;
}

export interface DonneesDuPoste {
  annee: string;
  tables: Record<string, Ligne[]>;
  fichiers: FichierRepris[];
  comptes: CompteRepris[];
}

export interface DetailTable {
  recues: number;
  comptes_inconnus: number;
  refusees: number;
  autre_annee: number;
  liens_manquants: number;
  reprises: number;
}

export interface RapportReprise {
  annee: string;
  essai: boolean;
  tables: Record<string, DetailTable>;
  liens: Record<string, number>;
  refus: { table: string; id: string | null; motif: string }[];
  lignes_reprises: number;
  comptes: { recus: number; existants: number; crees: number; ecartes: { ancien?: string; identifiant: string; motif: string }[]; a_creer: string[] };
  compteurs: Record<string, number>;
  gardes?: Record<string, string[]>;
  /** Ajoutés par le poste : ce qui n'a pu être préparé côté serveur. */
  comptes_non_crees?: { ancien: string; motif: string }[];
  fichiers_refuses?: { espace: string; chemin: string; motif: string }[];
}

export type Etape = "comptes" | "fichiers" | "reprise";

const TYPE_DU_ROLE: Record<UserRole, CompteRepris["type_compte"]> = { admin: "administration", teacher: "enseignant", student: "etudiant" };
export const COMPTES_PAR_LOT = 50;
/** Taille (en caractères de data URL) des fichiers envoyés en une fois. */
export const TAILLE_PAR_LOT = 3_500_000;

/** Données du poste, prêtes pour la reprise. */
export function donneesDuPoste(): DonneesDuPoste {
  const { tables, fichiers } = preparerReprise();
  const comptes = getUserAccounts().map((u): CompteRepris => ({
    ancien: u.id,
    type_compte: TYPE_DU_ROLE[u.role],
    identifiant: u.identifier ?? "",
    nom_affiche: u.displayName ?? "",
    email: u.email ?? "",
    telephone: u.telephone ?? "",
    fonction: u.fonction ?? "",
    role_id: u.role === "admin" ? u.roleId ?? null : null,
    lien_id: u.role === "admin" ? null : u.linkedId ?? null,
    actif: u.actif !== false,
  }));
  return { annee: getAnneeActuelle(), tables, fichiers, comptes };
}

const tablesAvecFichiers = (d: DonneesDuPoste) => [...new Set(d.fichiers.map((f) => f.table))];

/** Essai complet dans la base, annulé : le rapport de contrôle. */
export async function essayerReprise(d: DonneesDuPoste): Promise<RapportReprise> {
  const { rapport } = await appelerFonction<{ rapport: RapportReprise }>("reprise", {
    action: "analyser", annee: d.annee, tables: d.tables, comptes: d.comptes, ids_pour: tablesAvecFichiers(d),
  });
  return rapport;
}

/** Lots dont la taille cumulée ne dépasse pas « max » (un élément plus gros forme son lot). */
export function enLots<T>(elements: T[], taille: (e: T) => number, max: number): T[][] {
  const lots: T[][] = [];
  let courant: T[] = [];
  let cumul = 0;
  for (const e of elements) {
    const t = taille(e);
    if (courant.length > 0 && cumul + t > max) {
      lots.push(courant);
      courant = [];
      cumul = 0;
    }
    courant.push(e);
    cumul += t;
  }
  if (courant.length > 0) lots.push(courant);
  return lots;
}

/** Reprise réelle, d'après l'essai : identités des comptes à créer, fichiers des lignes gardées,
 * puis tout en une transaction. Un compte dont l'identité n'a pu être créée n'est pas repris ; un
 * fichier refusé (trop lourd, type refusé) laisse sa ligne sans fichier. */
export async function reprendre(d: DonneesDuPoste, essai: RapportReprise, progression: (etape: Etape, fait: number, total: number) => void = () => {}): Promise<RapportReprise> {
  await appelerFonction("reprise", { action: "nettoyer" });

  const aCreer = new Set(essai.comptes.a_creer);
  const lotsComptes = enLots(d.comptes.filter((c) => aCreer.has(c.ancien)), () => 1, COMPTES_PAR_LOT);
  const ids: Record<string, string> = {};
  const comptesNonCrees: { ancien: string; motif: string }[] = [];
  progression("comptes", 0, aCreer.size);
  for (const lot of lotsComptes) {
    const r = await appelerFonction<{ ids: Record<string, string>; erreurs: { ancien: string; motif: string }[] }>("reprise", {
      action: "creer_comptes", comptes: lot.map((c) => ({ ancien: c.ancien, identifiant: c.identifiant })),
    });
    Object.assign(ids, r.ids);
    comptesNonCrees.push(...r.erreurs);
    progression("comptes", Object.keys(ids).length + comptesNonCrees.length, aCreer.size);
  }
  const echecs = new Set(comptesNonCrees.map((e) => e.ancien));
  const comptes = d.comptes.filter((c) => !echecs.has(c.ancien)).map((c) => (ids[c.ancien] ? { ...c, id: ids[c.ancien] } : c));

  const gardes = essai.gardes ?? {};
  const aDeposer = d.fichiers.filter((f) => gardes[f.table]?.includes(f.id));
  const tables: Record<string, Ligne[]> = Object.fromEntries(Object.entries(d.tables).map(([t, lignes]) => [t, lignes.map((l) => ({ ...l }))]));
  const deposes: { espace: string; chemin: string }[] = [];
  const fichiersRefuses: { espace: string; chemin: string; motif: string }[] = [];
  progression("fichiers", 0, aDeposer.length);
  for (const lot of enLots(aDeposer, (f) => f.dataUrl.length, TAILLE_PAR_LOT)) {
    const r = await appelerFonction<{ deposes: number; erreurs: { espace: string; chemin: string; motif: string }[] }>("reprise", {
      action: "deposer", fichiers: lot.map((f) => ({ espace: f.espace, chemin: f.chemin, contenu: f.dataUrl })),
    });
    const refuses = new Set(r.erreurs.map((e) => `${e.espace}/${e.chemin}`));
    for (const f of lot) {
      if (!refuses.has(`${f.espace}/${f.chemin}`)) {
        deposes.push({ espace: f.espace, chemin: f.chemin });
        continue;
      }
      const ligne = tables[f.table]?.find((l) => l.id === f.id);
      if (ligne) ligne[f.colonne] = null;
    }
    fichiersRefuses.push(...r.erreurs);
    progression("fichiers", deposes.length + fichiersRefuses.length, aDeposer.length);
  }

  progression("reprise", 0, 1);
  const { rapport } = await appelerFonction<{ rapport: RapportReprise }>("reprise", {
    action: "reprendre", annee: d.annee, tables, comptes, fichiers_deposes: deposes,
  });
  progression("reprise", 1, 1);
  return { ...rapport, comptes_non_crees: comptesNonCrees, fichiers_refuses: fichiersRefuses };
}
