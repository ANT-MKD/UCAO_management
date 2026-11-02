// Tests de la fonction serveur « reprise » (partie 9, lot 3), sur un PostgreSQL ordinaire : base
// neuve avec les migrations (lancer-fonctions.sh), Supabase Auth et l'espace de fichiers imités.
// La base vient d'être installée par Ibrahima FALL ; le poste avait Awa SECK (inscrite cette
// année) et Fatou SOW (l'an passé seulement).
import postgres from "npm:postgres@3.4.5";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { traiter } from "../functions/reprise/traitement.ts";

const FALL = "00000000-0000-4000-8000-0000000000b1";
const INCONNU = "00000000-0000-4000-8000-0000000000b2";

function connexion() {
  const hote = Deno.env.get("PGHOST") ?? "localhost";
  const port = Number(Deno.env.get("PGPORT") ?? 5432);
  const commun = { database: Deno.env.get("BASE_FONCTIONS") ?? "edumanage_fonctions", username: Deno.env.get("PGUSER") ?? "postgres",
    password: Deno.env.get("PGPASSWORD"), prepare: false, max: 1, onnotice: () => {} };
  return hote.startsWith("/") ? postgres({ ...commun, path: `${hote}/.s.PGSQL.${port}` }) : postgres({ ...commun, host: hote, port });
}

const sql = connexion();
const depots = new Map<string, number>();
const retraits: string[] = [];

/** Supabase Auth et l'espace de fichiers, tels que la fonction les utilise. */
const serveur = {
  auth: {
    getUser: async (jeton: string) =>
      jeton === "jeton-fall" ? { data: { user: { id: FALL } }, error: null }
        : jeton === "jeton-inconnu" ? { data: { user: { id: INCONNU } }, error: null }
        : { data: { user: null }, error: { message: "jeton invalide" } },
    admin: {
      createUser: async (o: { email: string; app_metadata: Record<string, unknown> }) => {
        const [u] = await sql`insert into auth.users (email, raw_app_meta_data) values (${o.email}, ${sql.json(o.app_metadata as never)}) returning id::text`;
        return { data: { user: { id: u.id } }, error: null };
      },
      deleteUser: async (id: string) => {
        await sql`delete from auth.users where id = ${id}::uuid`;
        return { error: null };
      },
    },
  },
  storage: {
    from: (espace: string) => ({
      upload: async (chemin: string, octets: Uint8Array) => {
        if (depots.has(`${espace}/${chemin}`)) return { data: null, error: { message: "The resource already exists", statusCode: "409" } };
        depots.set(`${espace}/${chemin}`, octets.length);
        return { data: { path: chemin }, error: null };
      },
      remove: async (chemins: string[]) => {
        chemins.forEach((c) => {
          depots.delete(`${espace}/${c}`);
          retraits.push(`${espace}/${c}`);
        });
        return { data: [], error: null };
      },
    }),
  },
} as unknown as SupabaseClient;

async function appeler(corps: Record<string, unknown>, jeton = "jeton-fall"): Promise<{ statut: number; reponse: Record<string, unknown> }> {
  const req = new Request("http://localhost/functions/v1/reprise", {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  const res = await traiter(req, () => ({ serveur, sql: connexion() }));
  return { statut: res.status, reponse: await res.json() };
}

function verifier(condition: boolean, message: string, detail?: unknown): void {
  if (!condition) throw new Error(`ÉCHEC : ${message}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  console.log(`  ok  ${message}`);
}

const POSTE = {
  annees_academiques: [
    { id: "an-2025", libelle: "2025-2026", actuelle: false },
    { id: "an-2026", libelle: "2026-2027", actuelle: true },
  ],
  filieres: [{ id: "fil-qhse", code: "LQHSE", nom: "Licence QHSE" }],
  niveaux: [{ id: "niv-l1", nom: "Licence 1", alias: "L1", filiere_id: "fil-qhse" }],
  etudiants: [
    { id: "et-awa", matricule: "2026-LQHSE-0001", prenom: "Awa", nom: "SECK", filiere_id: "fil-qhse", niveau: "L1", statut: "inscrit", annee: "2026-2027" },
    { id: "et-fatou", matricule: "2025-LQHSE-0003", prenom: "Fatou", nom: "SOW", filiere_id: "fil-qhse", niveau: "L1", statut: "inscrit", annee: "2025-2026" },
  ],
  etudiants_dossiers: [{ id: "et-awa", email: "awa.seck@mail.sn", telephone: "770000001", photo_chemin: "etudiants/et-awa/photo-awa.jpg" }],
};
const COMPTES = [
  { ancien: "u-fall", type_compte: "administration", identifiant: "ADM", nom_affiche: "Ibrahima FALL" },
  { ancien: "u-awa", type_compte: "etudiant", identifiant: "2026-LQHSE-0001", nom_affiche: "Awa SECK", lien_id: "et-awa" },
  { ancien: "u-fatou", type_compte: "etudiant", identifiant: "2025-LQHSE-0003", nom_affiche: "Fatou SOW", lien_id: "et-fatou" },
];
const PHOTO = { espace: "photos", chemin: "etudiants/et-awa/photo-awa.jpg", contenu: "data:image/jpeg;base64,QUJD" };

async function creerComptes(anciens: string[]): Promise<Record<string, string>> {
  const { statut, reponse } = await appeler({ action: "creer_comptes", comptes: COMPTES.filter((c) => anciens.includes(c.ancien)) });
  verifier(statut === 200, "les identités des comptes repris sont créées", reponse);
  return reponse.ids as Record<string, string>;
}
const avecIds = (ids: Record<string, string>) => COMPTES.map((c) => (ids[c.ancien] ? { ...c, id: ids[c.ancien] } : c));
const identitesDeReprise = async () => Number((await sql`select count(*) from auth.users where raw_app_meta_data ->> 'reprise' = 'true'`)[0].count);

Deno.test("fonction serveur « reprise » : essai, comptes, fichiers, échec annulé, reprise, puis plus jamais", async () => {
  try {
    await sql`insert into auth.users (id, email) values (${FALL}::uuid, 'adm.fall@comptes.edumanage.invalid'), (${INCONNU}::uuid, 'inconnu@comptes.edumanage.invalid')`;
    await sql`insert into public.comptes (id, type_compte, identifiant, nom_affiche, doit_changer_mot_de_passe) values (${FALL}::uuid, 'administration', 'ADM', 'Ibrahima FALL', false)`;
    await sql`insert into public.annees_academiques (libelle, actuelle) values ('2026-2027', true)`;

    let r = await appeler({ action: "analyser" }, "jeton-perime");
    verifier(r.statut === 401, "sans session valide, rien", r.reponse);
    r = await appeler({ action: "analyser", annee: "2026-2027", tables: POSTE, comptes: COMPTES }, "jeton-inconnu");
    verifier(r.statut === 403, "un compte qui n'est pas administrateur à accès complet est refusé", r.reponse);
    r = await appeler({ action: "creer_comptes", comptes: COMPTES.slice(1, 2) }, "jeton-inconnu");
    const d = await appeler({ action: "deposer", fichiers: [PHOTO] }, "jeton-inconnu");
    verifier(r.statut === 403 && d.statut === 403 && await identitesDeReprise() === 0 && depots.size === 0,
      "il ne crée pas d'identité et ne dépose aucun fichier", { comptes: r.reponse, fichiers: d.reponse });

    r = await appeler({ action: "analyser", annee: "2026-2027", tables: POSTE, comptes: COMPTES, ids_pour: ["etudiants_dossiers"] });
    const essai = r.reponse.rapport as Record<string, any>;
    verifier(r.statut === 200 && essai.essai === true && essai.tables.etudiants.reprises === 1 && essai.tables.etudiants.autre_annee === 1,
      "essai : le rapport de contrôle arrive (Awa reprise, Fatou de l'an passé écartée)", r.reponse);
    verifier(JSON.stringify(essai.comptes.a_creer) === '["u-awa"]' && JSON.stringify(essai.gardes) === '{"etudiants_dossiers":["et-awa"]}',
      "essai : le compte d'Awa est à créer, son dossier (et sa photo) est gardé", essai);
    verifier(Number((await sql`select count(*) from public.etudiants`)[0].count) === 0, "après l'essai, rien n'est resté dans la base");

    // Reprise interrompue : l'identité créée reste sans compte, « nettoyer » la supprime.
    await creerComptes(["u-awa"]);
    verifier(await identitesDeReprise() === 1, "l'identité est marquée comme créée par la reprise");
    r = await appeler({ action: "nettoyer" });
    verifier(r.statut === 200 && r.reponse.supprimees === 1 && await identitesDeReprise() === 0, "« nettoyer » supprime les identités laissées sans compte", r.reponse);

    // Fichiers : un emplacement inconnu ou douteux est refusé, le reste est déposé.
    r = await appeler({ action: "deposer", fichiers: [PHOTO, { ...PHOTO, espace: "inconnu" }, { ...PHOTO, chemin: "../etudiants/x.jpg" }] });
    verifier(r.statut === 200 && r.reponse.deposes === 1 && (r.reponse.erreurs as unknown[]).length === 2 && depots.has("photos/etudiants/et-awa/photo-awa.jpg"),
      "dépôt : la photo d'Awa est déposée, un espace inconnu et un chemin remontant sont refusés", r.reponse);

    // Échec de la reprise : rien n'est repris, identités et fichiers de la tentative disparaissent.
    let ids = await creerComptes(["u-awa", "u-fatou"]);
    r = await appeler({ action: "reprendre", annee: "2026-2027", tables: { ...POSTE, journal_audit: [] }, comptes: avecIds(ids), fichiers_deposes: [PHOTO] });
    verifier(r.statut === 400 && String(r.reponse.message).includes("ne se reprennent pas"), "une reprise refusée par la base rend son motif", r.reponse);
    verifier(await identitesDeReprise() === 0 && retraits.includes("photos/etudiants/et-awa/photo-awa.jpg") && !depots.size,
      "après l'échec, les identités créées et la photo déposée sont retirées");

    // Reprise réelle.
    await appeler({ action: "deposer", fichiers: [PHOTO] });
    ids = await creerComptes(["u-awa", "u-fatou"]);
    r = await appeler({ action: "reprendre", annee: "2026-2027", tables: POSTE, comptes: avecIds(ids), fichiers_deposes: [PHOTO] });
    const rapport = r.reponse.rapport as Record<string, any>;
    verifier(r.statut === 200 && rapport.essai === false && rapport.comptes.crees === 1 && !("ecartes_ids" in rapport),
      "reprise : Awa et son compte sont repris", r.reponse);
    verifier((await sql`select c.identifiant, d.photo_chemin from public.comptes c join public.etudiants_dossiers d on d.id = c.lien_id where c.id = ${ids["u-awa"]}::uuid`)[0]?.photo_chemin
      === "etudiants/et-awa/photo-awa.jpg", "reprise : le compte d'Awa est relié à sa fiche, sa photo à son dossier");
    verifier(await identitesDeReprise() === 1 && Number((await sql`select count(*) from auth.users where id = ${ids["u-fatou"]}::uuid`)[0].count) === 0,
      "reprise : l'identité créée pour Fatou (fiche de l'an passé) est supprimée");

    r = await appeler({ action: "analyser", annee: "2026-2027", tables: POSTE, comptes: COMPTES });
    verifier(r.statut === 409, "une fois la reprise faite, la fonction ne fait plus rien", r.reponse);
  } finally {
    await sql.end();
  }
});
