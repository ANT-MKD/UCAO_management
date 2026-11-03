// Tests de la fonction serveur « sauvegarde » (partie 10, lot 3), sur un PostgreSQL ordinaire :
// deux bases neuves avec les migrations (lancer-fonctions.sh), Supabase Auth et l'espace de
// fichiers imités. Ibrahima FALL (administrateur principal) sauvegarde ; la scolarité ne le peut
// pas. Aller-retour complet : script exporté, rejoué par psql dans la seconde base, comparé table
// par table.
import postgres from "npm:postgres@3.4.5";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { FIN_DONNEES, traiter } from "../functions/sauvegarde/traitement.ts";

const FALL = "00000000-0000-4000-8000-0000000000c1";
const SCOL = "00000000-0000-4000-8000-0000000000c2";
const AWA = "00000000-0000-4000-8000-0000000000c3";
const SOURCE = Deno.env.get("BASE_SOURCE") ?? "edumanage_sauvegarde";
const CIBLE = Deno.env.get("BASE_CIBLE") ?? "edumanage_restauration";
const EXCLUES = ["private.environnement", "private.mesures_service", "private.tentatives_connexion"];

function connexion(base: string) {
  const hote = Deno.env.get("PGHOST") ?? "localhost";
  const port = Number(Deno.env.get("PGPORT") ?? 5432);
  const commun = { database: base, username: Deno.env.get("PGUSER") ?? "postgres", password: Deno.env.get("PGPASSWORD"),
    prepare: false, max: 2, onnotice: () => {} };
  return hote.startsWith("/") ? postgres({ ...commun, path: `${hote}/.s.PGSQL.${port}` }) : postgres({ ...commun, host: hote, port });
}

const signes: string[][] = [];
const depots: string[] = [];
/** Supabase Auth et l'espace de fichiers, tels que la fonction les utilise. */
const serveur = {
  auth: {
    getUser: async (jeton: string) =>
      jeton === "jeton-fall" ? { data: { user: { id: FALL } }, error: null }
        : jeton === "jeton-scol" ? { data: { user: { id: SCOL } }, error: null }
        : { data: { user: null }, error: { message: "jeton invalide" } },
  },
  storage: {
    from: (espace: string) => ({
      createSignedUrls: async (chemins: string[], duree: number) => {
        signes.push(chemins.map((c) => `${espace}/${c}@${duree}`));
        return { data: chemins.map((c) => ({ path: c, signedUrl: `https://stockage.essai/sign/${espace}/${c}?token=t`, error: null })), error: null };
      },
      createSignedUploadUrl: async (chemin: string) => {
        depots.push(`${espace}/${chemin}`);
        return { data: { signedUrl: `https://stockage.essai/upload/sign/${espace}/${chemin}?token=d`, token: "d", path: chemin }, error: null };
      },
    }),
  },
} as unknown as SupabaseClient;

async function appeler(corps: Record<string, unknown>, jeton: string | null = "jeton-fall"): Promise<Response> {
  const req = new Request("http://localhost/functions/v1/sauvegarde", {
    method: "POST",
    headers: { ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}), "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  return await traiter(req, () => ({ serveur, sql: connexion(SOURCE) }));
}

function verifier(condition: boolean, message: string, detail?: unknown): void {
  if (!condition) throw new Error(`ÉCHEC : ${message}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  console.log(`  ok  ${message}`);
}

/** Empreinte de chaque table sauvegardée : nombre de lignes et contenu, ligne par ligne. */
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

const GENEREE = "create table public.essai_genere (id integer primary key, libelle text, double integer generated always as (id * 2) stored)";

Deno.test("fonction serveur « sauvegarde » : accès, script des données rejoué à l'identique, fichiers, trace", async () => {
  const source = connexion(SOURCE);
  const cible = connexion(CIBLE);
  try {
    // ——— Données de l'établissement (avec des textes piégeux) ———
    await source.unsafe(`
      ${GENEREE};
      insert into public.essai_genere (id, libelle) values (1, 'un'), (2, null);
      insert into auth.users (id, email, raw_app_meta_data) values
        ('${FALL}', 'adm.c1@comptes.edumanage.invalid', '{"provider":"email"}'),
        ('${SCOL}', 'scol.c2@comptes.edumanage.invalid', '{}'),
        ('${AWA}', 'awa.c3@comptes.edumanage.invalid', '{"note":"Awa ✓ «SECK»"}');
      insert into public.roles (id, code, pages) values ('role-scol-c', 'ROLE_SCOL_C', array['sec-users', 'scol-notes']);
      insert into public.annees_academiques (id, libelle, actuelle) values ('an-2026-c', '2026-2027', true);
      insert into public.filieres (id, code, nom) values ('fil-qhse-c', 'LQHSEC', 'Licence QHSE — Santé & Sécurité');
      insert into public.etudiants (id, matricule, prenom, nom, filiere_id, statut, annee) values
        ('et-awa-c', '2026-LQHSEC-0001', 'Awa', 'SECK', 'fil-qhse-c', 'inscrit', '2026-2027');
      insert into public.comptes (id, type_compte, identifiant, nom_affiche, role_id, lien_id, doit_changer_mot_de_passe) values
        ('${FALL}', 'administration', 'ADM-C', 'Ibrahima FALL', null, null, false),
        ('${SCOL}', 'administration', 'SCOL-C', 'Scolarité', 'role-scol-c', null, false),
        ('${AWA}', 'etudiant', '2026-LQHSEC-0001', 'Awa SECK', null, 'et-awa-c', true);
      insert into public.journal_audit (acteur, action, details) values
        ('${FALL}', 'essai', E'tabulation\\tici, retour\\nà la ligne, barre \\\\ oblique, fin \\\\.'),
        ('${FALL}', 'essai', E'\\\\.'), (null, 'essai', null);
      insert into private.compteurs (cle, valeur) values ('matricule:2026-LQHSEC', 1);
      insert into private.environnement (nom) values ('test');
      insert into storage.buckets (id, name) values ('essai-sauvegarde', 'essai-sauvegarde') on conflict do nothing;
      insert into storage.objects (bucket_id, name, metadata) values
        ('essai-sauvegarde', 'etudiants/et-awa-c/photo.jpg', '{"size": 150000, "mimetype": "image/jpeg"}'),
        ('essai-sauvegarde', 'divers/note.txt', '{"size": 12}');
    `);

    // ——— Accès ———
    let r = await appeler({ action: "donnees" }, null);
    verifier(r.status === 401, "sans session : refus");
    r = await appeler({ action: "donnees" }, "jeton-perime");
    verifier(r.status === 401, "session expirée : refus");
    r = await appeler({ action: "donnees" }, "jeton-scol");
    verifier(r.status === 403 && (await r.json()).message.includes("accès complet"), "la scolarité ne sauvegarde pas");
    r = await appeler({ action: "effacer" });
    verifier(r.status === 400, "action inconnue : refus");

    // ——— Script des données ———
    r = await appeler({ action: "donnees" });
    verifier(r.status === 200 && r.headers.get("content-type")!.startsWith("text/plain") && r.headers.get("cache-control") === "no-store",
      "le script des données arrive en texte, jamais gardé en cache");
    const script = await r.text();
    verifier(script.endsWith(FIN_DONNEES), "il se termine par la ligne de fin (une sauvegarde interrompue se voit)");
    verifier(script.includes("SET session_replication_role = replica;") && script.includes("COPY auth.users (") && script.includes("COPY public.etudiants ("),
      "il contient les identités et les tables de l'établissement, rejouées sans déclencher les règles");
    verifier(!EXCLUES.some((t) => script.includes(`COPY ${t} `)) && !/TRUNCATE[^;]*auth\./.test(script),
      "ni la marque d'environnement, ni la veille, ni les tentatives de connexion ; les identités ne sont jamais vidées");
    verifier(/COPY public\.essai_genere \(id, libelle\) FROM stdin;/.test(script), "une colonne calculée n'est pas copiée : la base la recalcule");
    verifier(Number((await source`select count(*) from public.journal_audit where action = 'export_sauvegarde' and acteur = ${FALL}::uuid`)[0].count) === 1,
      "l'export est inscrit au journal");

    // ——— Rejoué dans une base neuve ———
    await cible.unsafe(`
      ${GENEREE};
      insert into public.filieres (id, code, nom) values ('fil-parasite', 'PARA', 'Ligne de la base neuve');
      insert into private.environnement (nom) values ('production');
      insert into private.mesures_service (jour, base_octets, fichiers_octets, fichiers_nombre) values (current_date, 1, 2, 3);
    `);
    const fichier = await Deno.makeTempFile({ suffix: ".sql" });
    await Deno.writeTextFile(fichier, script);
    const hote = Deno.env.get("PGHOST") ?? "localhost";
    const psql = await new Deno.Command("psql", {
      args: ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-1", "-h", hote, "-p", Deno.env.get("PGPORT") ?? "5432", "-U", Deno.env.get("PGUSER") ?? "postgres", "-d", CIBLE, "-f", fichier],
      stdout: "piped", stderr: "piped",
    }).output();
    await Deno.remove(fichier);
    verifier(psql.success, "psql rejoue le script d'un bloc, sans erreur", new TextDecoder().decode(psql.stderr));

    // L'export est noté au journal avant l'instantané : les deux bases ont cette ligne.
    const [avant, apres] = [await empreintes(source), await empreintes(cible)];
    const differentes = [...avant.keys()].filter((t) => avant.get(t) !== apres.get(t));
    verifier(differentes.length === 0 && avant.size === apres.size && avant.size > 100,
      `les ${avant.size} tables sauvegardées sont identiques, ligne à ligne`, differentes);
    verifier((await cible`select nom from private.environnement`).map((l) => l.nom).join() === "production"
      && Number((await cible`select count(*) from private.mesures_service`)[0].count) === 1,
      "la marque d'environnement et la veille de la base restaurée restent les siennes");
    verifier(Number((await cible`select count(*) from public.filieres where id = 'fil-parasite'`)[0].count) === 0,
      "les lignes propres à la base neuve sont remplacées");
    const [{ max }] = await cible`select max(id) from public.journal_audit`;
    const [{ id: suivant }] = await cible`insert into public.journal_audit (action) values ('apres-restauration') returning id`;
    verifier(Number(suivant) > Number(max), "les compteurs automatiques reprennent après les lignes restaurées");
    verifier((await cible`select double from public.essai_genere where id = 1`)[0].double === 2, "la colonne calculée est recalculée");

    // ——— Fichiers ———
    r = await appeler({ action: "fichiers" });
    const { fichiers } = await r.json() as { fichiers: Record<string, unknown>[] };
    const essai = fichiers.filter((f) => f.espace === "essai-sauvegarde");
    verifier(r.status === 200 && JSON.stringify(essai) === JSON.stringify([
      { espace: "essai-sauvegarde", chemin: "divers/note.txt", taille: 12, type: "", url: "https://stockage.essai/sign/essai-sauvegarde/divers/note.txt?token=t" },
      { espace: "essai-sauvegarde", chemin: "etudiants/et-awa-c/photo.jpg", taille: 150000, type: "image/jpeg", url: "https://stockage.essai/sign/essai-sauvegarde/etudiants/et-awa-c/photo.jpg?token=t" },
    ]), "la liste des fichiers donne taille, type et un lien de téléchargement", essai);
    verifier(signes.flat().every((s) => s.endsWith("@3600")), "chaque lien vaut une heure");

    // ——— Trace de la sauvegarde ———
    r = await appeler({ action: "noter", octets: 0, fichiers: 2 });
    verifier(r.status === 400, "une sauvegarde vide n'est pas notée");
    r = await appeler({ action: "noter", octets: 52_000_000, fichiers: 2 });
    verifier(r.status === 200 && Number((await source`select count(*) from private.sauvegardes where par = ${FALL}::uuid and octets = 52000000`)[0].count) === 1,
      "la sauvegarde terminée est notée");

    // ——— Dépôt (restauration) ———
    r = await appeler({ action: "url_depot", espace: "essai-sauvegarde", chemin: "../secret" });
    verifier(r.status === 400, "un chemin hors de l'espace est refusé");
    r = await appeler({ action: "url_depot", espace: "inconnu", chemin: "a/b.jpg" });
    verifier(r.status === 400, "un espace inconnu est refusé");
    r = await appeler({ action: "url_depot", espace: "essai-sauvegarde", chemin: "etudiants/et-awa-c/photo.jpg" });
    verifier(r.status === 409 && depots.length === 0, "jamais de dépôt par-dessus un fichier existant");
    r = await appeler({ action: "url_depot", espace: "essai-sauvegarde", chemin: "etudiants/et-awa-c/piece.pdf" });
    verifier(r.status === 200 && (await r.json()).url.includes("/upload/sign/essai-sauvegarde/etudiants/et-awa-c/piece.pdf")
      && depots.join() === "essai-sauvegarde/etudiants/et-awa-c/piece.pdf", "un fichier absent reçoit un lien de dépôt");
  } finally {
    await source.end();
    await cible.end();
  }
});
