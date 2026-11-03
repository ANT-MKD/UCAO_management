// Outil de restauration d'une sauvegarde EduManage (partie 10, lot 3). Procédure complète :
// supabase/README.md, « Restaurer une sauvegarde ». Trois étapes, chacune demande la phrase secrète :
//
//   deno run --config supabase/restauration/deno.json --allow-read --allow-write --allow-net --allow-env \
//     supabase/restauration/restaurer.ts <étape> <fichier.edumanage> [options]
//
//   lire      [--extraire <dossier>]   contenu de la sauvegarde ; copie en clair sur demande
//   base      --base <adresse postgresql>   données dans une base NEUVE (migrations appliquées)
//   fichiers  --projet <https://….supabase.co> --cle <sb_publishable_…> --identifiant <administrateur>
//
// Aucun mot de passe ni aucune phrase ne se passe en argument : l'outil les demande, sans les
// afficher.
import postgres from "npm:postgres@3.4.5";
import {
  connecterAdministrateur, decouperScript, dechiffrer, deposeurHttp, ErreurRestauration, restaurerBase, restaurerFichiers,
} from "./restauration.ts";

const encodeur = new TextEncoder();

function ecrire(texte: string): void {
  Deno.stdout.writeSync(encodeur.encode(texte));
}

/** Saisie masquée (phrase secrète, mots de passe). */
async function demanderSecret(question: string): Promise<string> {
  ecrire(question);
  const octets: number[] = [];
  const un = new Uint8Array(1);
  const terminal = Deno.stdin.isTerminal();
  if (terminal) Deno.stdin.setRaw(true);
  try {
    for (;;) {
      const n = await Deno.stdin.read(un);
      if (n === null) break;
      const c = un[0];
      if (c === 3) Deno.exit(130);
      if (c === 13 || c === 10) break;
      if (c === 127 || c === 8) {
        octets.pop();
        continue;
      }
      octets.push(c);
    }
  } finally {
    if (terminal) Deno.stdin.setRaw(false);
    ecrire("\n");
  }
  return new TextDecoder().decode(new Uint8Array(octets));
}

function option(nom: string): string | undefined {
  const i = Deno.args.indexOf(`--${nom}`);
  return i >= 0 ? Deno.args[i + 1] : undefined;
}

function exiger(nom: string): string {
  const valeur = option(nom);
  if (!valeur) throw new ErreurRestauration(`Option --${nom} manquante.`);
  return valeur;
}

const taille = (o: number) => (o >= 1e6 ? `${(o / 1e6).toFixed(1)} Mo` : `${Math.ceil(o / 1e3)} Ko`);

async function ouvrir(chemin: string) {
  const fichier = await Deno.readFile(chemin);
  const phrase = await demanderSecret("Phrase secrète de la sauvegarde : ");
  ecrire("Déchiffrement…\n");
  return await dechiffrer(fichier, phrase);
}

async function principal(): Promise<void> {
  const [etape, chemin] = Deno.args;
  if (!etape || !chemin || !["lire", "base", "fichiers"].includes(etape)) {
    ecrire("Usage : restaurer.ts lire|base|fichiers <fichier.edumanage> [options] (voir l'en-tête du fichier).\n");
    Deno.exit(2);
  }
  const sauvegarde = await ouvrir(chemin);
  const { manifeste } = sauvegarde;
  const copies = decouperScript(sauvegarde.script).filter((p) => p.type === "copy");
  ecrire([
    `Sauvegarde du ${new Date(manifeste.cree_le).toLocaleString("fr-FR")} (projet ${manifeste.projet})`,
    `  données : ${copies.length} tables, ${copies.reduce((s, p) => s + (p.type === "copy" ? p.lignes : 0), 0)} lignes (${taille(manifeste.donnees_octets)})`,
    `  fichiers : ${sauvegarde.fichiers.length} (${taille(sauvegarde.fichiers.reduce((s, f) => s + f.contenu.length, 0))})`,
    "",
  ].join("\n"));

  if (etape === "lire") {
    const dossier = option("extraire");
    if (dossier) {
      await Deno.mkdir(`${dossier}/fichiers`, { recursive: true });
      await Deno.writeTextFile(`${dossier}/donnees.sql`, sauvegarde.script);
      for (const f of sauvegarde.fichiers) {
        const cible = `${dossier}/fichiers/${f.espace}/${f.chemin}`;
        await Deno.mkdir(cible.slice(0, cible.lastIndexOf("/")), { recursive: true });
        await Deno.writeFile(cible, f.contenu);
      }
      ecrire(`Copie EN CLAIR écrite dans ${dossier} : à effacer dès qu'elle ne sert plus.\n`);
    }
    return;
  }

  if (etape === "base") {
    const adresse = new URL(exiger("base"));
    if (!adresse.password) adresse.password = encodeURIComponent(await demanderSecret("Mot de passe de la base cible : "));
    ecrire(`Base cible : ${adresse.hostname}${adresse.pathname}. Elle doit être neuve (migrations appliquées, personne d'installé).\n`);
    if (prompt("Tapez RESTAURER pour continuer :") !== "RESTAURER") {
      ecrire("Abandon : rien n'a été modifié.\n");
      return;
    }
    const sql = postgres(adresse.toString(), { prepare: false, max: 1, onnotice: () => {} });
    try {
      const lignes = await restaurerBase(sql, sauvegarde.script);
      ecrire(`Données restaurées : ${lignes.size} tables, ${[...lignes.values()].reduce((s, n) => s + n, 0)} lignes.\n`);
      ecrire("Étape suivante : les fichiers (étape « fichiers »).\n");
    } finally {
      await sql.end({ timeout: 5 });
    }
    return;
  }

  const projet = exiger("projet").replace(/\/+$/, "");
  const cle = exiger("cle");
  const identifiant = exiger("identifiant");
  const motDePasse = await demanderSecret(`Mot de passe de ${identifiant} : `);
  const jeton = await connecterAdministrateur(projet, cle, identifiant, motDePasse);
  const bilan = await restaurerFichiers(sauvegarde.fichiers, deposeurHttp(projet, cle, jeton),
    (fait, total) => ecrire(`\rFichiers : ${fait} sur ${total}`));
  ecrire(`\nDéposés : ${bilan.deposes} ; déjà présents : ${bilan.presents} ; échecs : ${bilan.echecs.length}.\n`);
  for (const e of bilan.echecs) ecrire(`  ${e.fichier} : ${e.motif}\n`);
  if (bilan.echecs.length > 0) Deno.exit(1);
}

try {
  await principal();
} catch (erreur) {
  ecrire(`\nRestauration arrêtée : ${erreur instanceof Error ? erreur.message : String(erreur)}\n`);
  Deno.exit(1);
}
