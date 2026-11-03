// Tests de l'outil de restauration (partie 10, lot 3), sur deux bases locales neuves
// (lancer-fonctions.sh) : une sauvegarde chiffrée est produite comme dans l'application (script de
// la fonction « sauvegarde » + fichier .edumanage), puis déchiffrée et rejouée dans la base neuve ;
// les fichiers sont redéposés auprès d'un serveur imitant Supabase.
import postgres from "npm:postgres@3.4.5";
import { EcrivainSauvegarde } from "../../artifacts/edumanage/src/lib/archiveSauvegarde.ts";
import { produireDonnees } from "../functions/sauvegarde/traitement.ts";
import {
  connecterAdministrateur, decouperScript, dechiffrer, deposeurHttp, restaurerBase, restaurerFichiers,
} from "../restauration/restauration.ts";

const FALL = "00000000-0000-4000-8000-0000000000d1";
const SOURCE = Deno.env.get("BASE_REST_SOURCE") ?? "edumanage_rest_source";
const CIBLE = Deno.env.get("BASE_REST_CIBLE") ?? "edumanage_rest_cible";
const PHRASE = "baobab lagune pirogue 2026";
const EXCLUES = ["private.environnement", "private.mesures_service", "private.tentatives_connexion"];
const GENEREE = "create table public.essai_genere (id integer primary key, libelle text, double integer generated always as (id * 2) stored)";

function connexion(base: string) {
  const hote = Deno.env.get("PGHOST") ?? "localhost";
  const port = Number(Deno.env.get("PGPORT") ?? 5432);
  const commun = { database: base, username: Deno.env.get("PGUSER") ?? "postgres", password: Deno.env.get("PGPASSWORD"),
    prepare: false, max: 2, onnotice: () => {} };
  return hote.startsWith("/") ? postgres({ ...commun, path: `${hote}/.s.PGSQL.${port}` }) : postgres({ ...commun, host: hote, port });
}

function verifier(condition: boolean, message: string, detail?: unknown): void {
  if (!condition) throw new Error(`ÉCHEC : ${message}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  console.log(`  ok  ${message}`);
}

async function echoue(promesse: Promise<unknown>, motif: string, message: string): Promise<void> {
  try {
    await promesse;
  } catch (erreur) {
    const texte = erreur instanceof Error ? erreur.message : String(erreur);
    verifier(texte.includes(motif), message, texte);
    return;
  }
  verifier(false, `${message} (aucune erreur)`);
}

async function empreintes(sql: ReturnType<typeof connexion>): Promise<Map<string, string>> {
  const tables = await sql`
    select format('%I.%I', n.nspname, c.relname) as nom from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and (n.nspname in ('public', 'private') or (n.nspname = 'auth' and c.relname in ('users', 'identities')))
    order by 1`;
  const resultat = new Map<string, string>();
  for (const { nom } of tables) {
    if (EXCLUES.includes(String(nom))) continue;
    const [l] = await sql.unsafe(`select count(*)::text || ':' || md5(coalesce(string_agg(t::text, E'\\n' order by t::text), '')) as e from ${nom} t`);
    resultat.set(String(nom), String(l.e));
  }
  return resultat;
}

const PHOTO = { espace: "pieces-etudiants", chemin: "etudiants/et-awa-d/photo.jpg", taille: 3, type: "image/jpeg", contenu: new Uint8Array([1, 2, 3]) };
const RELEVE = { espace: "documents", chemin: "releves/kane.pdf", taille: 4, type: "application/pdf", contenu: new Uint8Array([4, 5, 6, 7]) };
const REFUSE = { espace: "documents", chemin: "releves/refuse.pdf", taille: 1, type: "application/pdf", contenu: new Uint8Array([9]) };

async function archive(script: string, fichiers: typeof PHOTO[], annonces = fichiers): Promise<Uint8Array> {
  const e = await EcrivainSauvegarde.ouvrir(PHRASE, { iterations: 1000 });
  const enc = new TextEncoder();
  await e.ajouter("manifeste.json", enc.encode(JSON.stringify({
    format: 1, application: "EduManage", cree_le: "2026-11-03T14:05:00.000Z", projet: "mrexzmmkvcusfpqhpowk.supabase.co",
    donnees_octets: enc.encode(script).length, fichiers: annonces.map(({ espace, chemin, taille, type }) => ({ espace, chemin, taille, type })),
  })));
  await e.ajouter("donnees.sql", enc.encode(script));
  for (const f of fichiers) await e.ajouter(`fichiers/${f.espace}/${f.chemin}`, f.contenu);
  const parties = await e.terminer();
  return Uint8Array.from(parties.flatMap((p) => [...p]));
}

Deno.test("outil de restauration : déchiffrement, base neuve rejouée d'un bloc, fichiers redéposés", async () => {
  const source = connexion(SOURCE);
  const cible = connexion(CIBLE);
  try {
    await source.unsafe(`
      ${GENEREE};
      insert into public.essai_genere (id, libelle) values (7, E'tab\\there');
      insert into auth.users (id, email) values ('${FALL}', 'adm.d1@comptes.edumanage.invalid');
      insert into public.comptes (id, type_compte, identifiant, nom_affiche, doit_changer_mot_de_passe) values ('${FALL}', 'administration', 'ADM-D', 'Ibrahima FALL', false);
      insert into public.annees_academiques (id, libelle, actuelle) values ('an-2026-d', '2026-2027', true);
      insert into public.filieres (id, code, nom) values ('fil-qhse-d', 'LQHSED', 'Licence QHSE');
      insert into public.etudiants (id, matricule, prenom, nom, filiere_id, statut, annee) values ('et-awa-d', '2026-LQHSED-0001', 'Awa', 'SECK', 'fil-qhse-d', 'inscrit', '2026-2027');
      insert into public.journal_audit (acteur, action, details) values ('${FALL}', 'essai', E'ligne\\nsuivante \\\\ fin');
      insert into private.compteurs (cle, valeur) values ('matricule:2026-LQHSED', 1);
    `);
    const morceaux: Uint8Array[] = [];
    for await (const m of produireDonnees(connexion(SOURCE))) morceaux.push(m);
    const script = new TextDecoder().decode(Uint8Array.from(morceaux.flatMap((m) => [...m])));

    // ——— Déchiffrement ———
    const fichier = await archive(script, [PHOTO, RELEVE]);
    const lue = await dechiffrer(fichier, PHRASE);
    verifier(lue.script === script && lue.manifeste.projet === "mrexzmmkvcusfpqhpowk.supabase.co",
      "la sauvegarde se déchiffre : manifeste et script des données intacts");
    verifier(JSON.stringify(lue.fichiers.map((f) => [f.espace, f.chemin, f.type, [...f.contenu]])) === JSON.stringify([
      ["pieces-etudiants", "etudiants/et-awa-d/photo.jpg", "image/jpeg", [1, 2, 3]], ["documents", "releves/kane.pdf", "application/pdf", [4, 5, 6, 7]],
    ]), "les fichiers reviennent avec leur espace, leur chemin et leur type");
    await echoue(dechiffrer(fichier, "baobab lagune pirogue 2025"), "Phrase secrète incorrecte", "mauvaise phrase : refus");
    await echoue(dechiffrer(await archive(script, [PHOTO], [PHOTO, RELEVE]), PHRASE), "1 fichier(s) sur 2", "fichier manquant dans la sauvegarde : refus");
    const parties = decouperScript(script);
    verifier(parties.filter((p) => p.type === "copy").length > 100 && parties.some((p) => p.type === "sql" && p.texte.startsWith("TRUNCATE")),
      "le script se découpe en instructions et en blocs de données");
    await echoue(Promise.resolve().then(() => decouperScript(script.replace("-- Fin de la sauvegarde.\n", ""))), "ligne de fin manque",
      "script tronqué : refus avant de toucher à la base");

    // ——— Base neuve ———
    await cible.unsafe(`${GENEREE}; insert into public.filieres (id, code, nom) values ('fil-parasite', 'PARA', 'Base neuve');`);
    const casse = script.replace("COPY public.etudiants (", "COPY public.etudiants (colonne_inconnue, ");
    await echoue(restaurerBase(cible, casse), "colonne_inconnue", "une erreur en cours de route arrête la restauration");
    verifier(Number((await cible`select count(*) from public.filieres where id = 'fil-parasite'`)[0].count) === 1
      && Number((await cible`select count(*) from auth.users`)[0].count) === 0,
      "et rien n'est gardé : la base cible est comme avant");
    const lignes = await restaurerBase(cible, lue.script);
    verifier(lignes.get("public.etudiants") === 1 && lignes.get("auth.users") === 1, "la restauration compte les lignes par table", Object.fromEntries(lignes));
    const [avant, apres] = [await empreintes(source), await empreintes(cible)];
    const differentes = [...avant.keys()].filter((t) => avant.get(t) !== apres.get(t));
    verifier(differentes.length === 0 && avant.size === apres.size, `les ${avant.size} tables restaurées sont identiques à la base sauvegardée`, differentes);
    await echoue(restaurerBase(cible, lue.script), "n'est pas neuve", "une base où des comptes existent n'est jamais écrasée");
    verifier(JSON.stringify([...(await empreintes(cible)).entries()]) === JSON.stringify([...apres.entries()]), "et elle reste intacte");

    // ——— Fichiers (serveur imitant Supabase) ———
    const recus: { chemin: string; type: string | null; upsert: string | null; octets: number[] }[] = [];
    const serveurEssai = Deno.serve({ port: 0, hostname: "127.0.0.1", onListen: () => {} }, async (req) => {
      const url = new URL(req.url);
      if (req.headers.get("apikey") !== "sb_publishable_essai") return new Response("{}", { status: 401 });
      if (url.pathname === "/functions/v1/connexion") {
        const corps = await req.json();
        return corps.action === "connecter" && corps.identifiant === "ADM-D" && corps.mot_de_passe === "Direction2026"
          ? Response.json({ access_token: "jeton-essai", refresh_token: "r" })
          : Response.json({ message: "Identifiant ou mot de passe incorrect." }, { status: 401 });
      }
      if (url.pathname === "/functions/v1/sauvegarde") {
        if (req.headers.get("authorization") !== "Bearer jeton-essai") return Response.json({ message: "session" }, { status: 401 });
        const corps = await req.json();
        if (corps.action !== "url_depot") return Response.json({ message: "action" }, { status: 400 });
        if (corps.chemin === RELEVE.chemin) return Response.json({ message: "Ce fichier existe déjà." }, { status: 409 });
        return Response.json({ url: `${url.origin}/storage/v1/object/upload/sign/${corps.espace}/${corps.chemin}?token=d` });
      }
      if (req.method === "PUT" && url.pathname.startsWith("/storage/v1/object/upload/sign/")) {
        const chemin = url.pathname.slice("/storage/v1/object/upload/sign/".length);
        if (chemin.endsWith("refuse.pdf")) return Response.json({ message: "trop gros" }, { status: 400 });
        recus.push({ chemin, type: req.headers.get("content-type"), upsert: req.headers.get("x-upsert"), octets: [...new Uint8Array(await req.arrayBuffer())] });
        return Response.json({ Key: chemin });
      }
      return new Response("introuvable", { status: 404 });
    });
    try {
      const projet = `http://127.0.0.1:${serveurEssai.addr.port}`;
      await echoue(connecterAdministrateur(projet, "sb_publishable_essai", "ADM-D", "mauvais"), "Identifiant ou mot de passe incorrect",
        "mauvais mot de passe de l'administrateur : refus, avec le message du serveur");
      const jeton = await connecterAdministrateur(projet, "sb_publishable_essai", "ADM-D", "Direction2026");
      const etapes: string[] = [];
      const bilan = await restaurerFichiers([PHOTO, RELEVE, { ...REFUSE }], deposeurHttp(projet, "sb_publishable_essai", jeton),
        (fait, total) => etapes.push(`${fait}/${total}`));
      verifier(bilan.deposes === 1 && bilan.presents === 1 && bilan.echecs.length === 1 && bilan.echecs[0].fichier === "documents/releves/refuse.pdf",
        "bilan : un fichier déposé, un déjà présent laissé tel quel, un refus signalé", bilan);
      verifier(JSON.stringify(recus) === JSON.stringify([
        { chemin: "pieces-etudiants/etudiants/et-awa-d/photo.jpg", type: "image/jpeg", upsert: "false", octets: [1, 2, 3] },
      ]), "le fichier est envoyé tel quel, avec son type, sans jamais remplacer", recus);
      verifier(etapes.join() === "0/3,1/3,2/3,3/3", "la progression est donnée fichier par fichier");
    } finally {
      await serveurEssai.shutdown();
    }
  } finally {
    await source.end();
    await cible.end();
  }
});
