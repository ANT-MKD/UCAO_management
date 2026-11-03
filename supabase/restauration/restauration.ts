// Restauration d'une sauvegarde EduManage (partie 10, lot 3) : bibliothèque de l'outil
// restaurer.ts, testée sur une base locale (tests/restauration.test.ts).
//   dechiffrer        : fichier .edumanage + phrase secrète → manifeste, script des données, fichiers ;
//   decouperScript    : script → instructions et blocs COPY (format de pg_dump --data-only) ;
//   restaurerBase     : rejoue le script d'un bloc dans une base NEUVE (migrations appliquées,
//                       personne d'installé) ; rien n'est gardé en cas d'erreur ;
//   restaurerFichiers : redépose chaque fichier par la fonction serveur « sauvegarde », sans jamais
//                       remplacer un fichier présent.
import type postgres from "npm:postgres@3.4.5";
import { lireSauvegarde } from "../../artifacts/edumanage/src/lib/archiveSauvegarde.ts";

type Sql = ReturnType<typeof postgres>;

export const FIN_DONNEES = "-- Fin de la sauvegarde.";

export interface Manifeste {
  format: number;
  application: string;
  cree_le: string;
  projet: string;
  donnees_octets: number;
  fichiers: { espace: string; chemin: string; taille: number; type: string }[];
}

export interface FichierRestaure {
  espace: string;
  chemin: string;
  type: string;
  contenu: Uint8Array;
}

export interface SauvegardeDechiffree {
  manifeste: Manifeste;
  script: string;
  fichiers: FichierRestaure[];
}

export class ErreurRestauration extends Error {}

export async function dechiffrer(fichier: Uint8Array, phrase: string): Promise<SauvegardeDechiffree> {
  let manifeste: Manifeste | null = null;
  let script: string | null = null;
  const fichiers: FichierRestaure[] = [];
  for await (const { nom, contenu } of lireSauvegarde(fichier, phrase)) {
    if (nom === "manifeste.json") manifeste = JSON.parse(new TextDecoder().decode(contenu)) as Manifeste;
    else if (nom === "donnees.sql") script = new TextDecoder().decode(contenu);
    else if (nom.startsWith("fichiers/")) {
      const [espace, ...reste] = nom.slice("fichiers/".length).split("/");
      const chemin = reste.join("/");
      const decrit = manifeste?.fichiers.find((f) => f.espace === espace && f.chemin === chemin);
      fichiers.push({ espace, chemin, type: decrit?.type || "application/octet-stream", contenu });
    }
  }
  if (!manifeste || manifeste.format !== 1) throw new ErreurRestauration("Sauvegarde sans manifeste lisible.");
  if (script === null) throw new ErreurRestauration("Sauvegarde sans script des données.");
  if (fichiers.length !== manifeste.fichiers.length) {
    throw new ErreurRestauration(`Sauvegarde incomplète : ${fichiers.length} fichier(s) sur ${manifeste.fichiers.length} annoncés.`);
  }
  return { manifeste, script, fichiers };
}

export type Partie = { type: "sql"; texte: string } | { type: "copy"; table: string; entete: string; donnees: string; lignes: number };

const COPY = /^COPY ([a-z0-9_."]+) \((.+)\) FROM stdin;$/;

export function decouperScript(script: string): Partie[] {
  const lignes = script.split("\n");
  if (lignes.at(-1) === "") lignes.pop();
  if (lignes.at(-1) !== FIN_DONNEES) throw new ErreurRestauration("Script des données incomplet : la ligne de fin manque.");
  const parties: Partie[] = [];
  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    if (ligne === "" || ligne.startsWith("--")) continue;
    const copy = COPY.exec(ligne);
    if (copy) {
      const debut = i + 1;
      let fin = debut;
      while (fin < lignes.length && lignes[fin] !== "\\.") fin++;
      if (fin === lignes.length) throw new ErreurRestauration(`Bloc de ${copy[1]} sans fin.`);
      const donnees = lignes.slice(debut, fin);
      parties.push({ type: "copy", table: copy[1], entete: ligne.slice(0, -" FROM stdin;".length), donnees: donnees.map((l) => `${l}\n`).join(""), lignes: donnees.length });
      i = fin;
      continue;
    }
    if (!ligne.endsWith(";")) throw new ErreurRestauration(`Ligne inattendue dans le script : ${ligne.slice(0, 80)}`);
    parties.push({ type: "sql", texte: ligne });
  }
  return parties;
}

/** La base cible doit être neuve : personne d'installé, aucune identité. */
export async function baseNeuve(sql: Sql): Promise<boolean> {
  const [l] = await sql`select (select count(*) from public.comptes) + (select count(*) from auth.users) as n`;
  return Number(l.n) === 0;
}

/** Rejoue le script dans une transaction ; rend le nombre de lignes par table. */
export async function restaurerBase(sql: Sql, script: string): Promise<Map<string, number>> {
  const parties = decouperScript(script);
  if (!(await baseNeuve(sql))) {
    throw new ErreurRestauration("La base cible n'est pas neuve (des comptes y existent) : la restauration se fait sur un projet neuf, migrations appliquées.");
  }
  const lignes = new Map<string, number>();
  await sql.begin(async (tx) => {
    for (const p of parties) {
      if (p.type === "sql") {
        await tx.unsafe(p.texte);
        continue;
      }
      const flux = await tx.unsafe(`${p.entete} FROM STDIN`).writable();
      await new Promise<void>((ok, ko) => {
        flux.on("error", ko);
        flux.on("finish", ok);
        flux.end(p.donnees);
      });
      lignes.set(p.table, p.lignes);
    }
  });
  return lignes;
}

export type ResultatDepot = "depose" | "present";

export interface BilanFichiers {
  deposes: number;
  presents: number;
  echecs: { fichier: string; motif: string }[];
}

/** Redépose les fichiers un à un ; un fichier déjà présent est laissé tel quel. */
export async function restaurerFichiers(fichiers: FichierRestaure[], deposer: (f: FichierRestaure) => Promise<ResultatDepot>,
  progression: (fait: number, total: number) => void = () => {}): Promise<BilanFichiers> {
  const bilan: BilanFichiers = { deposes: 0, presents: 0, echecs: [] };
  for (const [i, f] of fichiers.entries()) {
    progression(i, fichiers.length);
    try {
      if ((await deposer(f)) === "depose") bilan.deposes++;
      else bilan.presents++;
    } catch (erreur) {
      bilan.echecs.push({ fichier: `${f.espace}/${f.chemin}`, motif: erreur instanceof Error ? erreur.message : String(erreur) });
    }
  }
  progression(fichiers.length, fichiers.length);
  return bilan;
}

/** Session de l'administrateur principal, par la fonction serveur « connexion » du projet. */
export async function connecterAdministrateur(projet: string, clePublique: string, identifiant: string, motDePasse: string,
  appel: typeof fetch = fetch): Promise<string> {
  const reponse = await appel(`${projet}/functions/v1/connexion`, {
    method: "POST",
    headers: { apikey: clePublique, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "connecter", identifiant, mot_de_passe: motDePasse }),
  });
  const corps = await reponse.json().catch(() => ({})) as { access_token?: string; message?: string };
  if (!reponse.ok || !corps.access_token) throw new ErreurRestauration(corps.message || `Connexion refusée (${reponse.status}).`);
  return corps.access_token;
}

/** Dépôt d'un fichier : lien de dépôt demandé à la fonction « sauvegarde », puis envoi du fichier. */
export function deposeurHttp(projet: string, clePublique: string, jeton: string, appel: typeof fetch = fetch) {
  return async (f: FichierRestaure): Promise<ResultatDepot> => {
    const demande = await appel(`${projet}/functions/v1/sauvegarde`, {
      method: "POST",
      headers: { apikey: clePublique, Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "url_depot", espace: f.espace, chemin: f.chemin }),
    });
    if (demande.status === 409) {
      await demande.body?.cancel();
      return "present";
    }
    const corps = await demande.json().catch(() => ({})) as { url?: string; message?: string };
    if (!demande.ok || !corps.url) throw new ErreurRestauration(corps.message || `Lien de dépôt refusé (${demande.status}).`);
    const envoi = await appel(corps.url, {
      method: "PUT",
      headers: { apikey: clePublique, "Content-Type": f.type, "x-upsert": "false" },
      body: f.contenu as BodyInit,
    });
    const reponse = await envoi.text();
    if (!envoi.ok) throw new ErreurRestauration(`Envoi refusé (${envoi.status}) : ${reponse.slice(0, 200)}`);
    return "depose";
  };
}
