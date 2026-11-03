// Tests de la fonction serveur « courriels » (partie 10, lot 4), sur une base locale neuve avec les
// migrations (lancer-fonctions.sh) et un Resend imité qui répond selon le destinataire.
import postgres from "npm:postgres@3.4.5";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { EXPEDITEUR_ESSAI, traiter, type Reglages, type ReponseResend } from "../functions/courriels/traitement.ts";

const FALL = "00000000-0000-4000-8000-0000000000a1";
const SCOL = "00000000-0000-4000-8000-0000000000a2";
const BASE = Deno.env.get("BASE_COURRIELS") ?? "edumanage_courriels";
const PROPRE = "UCAO Dakar <noreply@mail.ucao.sn>";

function connexion() {
  const hote = Deno.env.get("PGHOST") ?? "localhost";
  const port = Number(Deno.env.get("PGPORT") ?? 5432);
  const commun = { database: BASE, username: Deno.env.get("PGUSER") ?? "postgres", password: Deno.env.get("PGPASSWORD"),
    prepare: false, max: 1, onnotice: () => {} };
  return hote.startsWith("/") ? postgres({ ...commun, path: `${hote}/.s.PGSQL.${port}` }) : postgres({ ...commun, host: hote, port });
}

function verifier(condition: boolean, message: string, detail?: unknown): void {
  if (!condition) throw new Error(`ÉCHEC : ${message}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  console.log(`  ok  ${message}`);
}

const serveur = {
  auth: {
    getUser: async (jeton: string) =>
      jeton === "jeton-fall" ? { data: { user: { id: FALL } }, error: null }
        : jeton === "jeton-scol" ? { data: { user: { id: SCOL } }, error: null }
        : { data: { user: null }, error: { message: "jeton invalide" } },
  },
} as unknown as SupabaseClient;

/** Resend imité : la réponse dépend du destinataire. */
const appels: { corps: Record<string, unknown>; idempotence: string }[] = [];
const pauses: number[] = [];
let horloge = Date.parse("2026-11-03T08:00:00Z");
const deja429 = new Set<string>();
async function resend(corps: Record<string, unknown>, idempotence: string): Promise<ReponseResend> {
  appels.push({ corps, idempotence });
  const a = (corps.to as string[])[0];
  if (a === "invalide@exemple.sn") return { statut: 422, corps: { name: "validation_error", message: "Invalid `to` field." } };
  if (a === "kane@exemple.sn") return { statut: 403, corps: { name: "validation_error", message: "You can only send testing emails to your own email address." } };
  if (a === "panne@exemple.sn") return { statut: 503, corps: {} };
  if (a === "reseau@exemple.sn") throw new TypeError("fetch failed");
  if (a === "debit@exemple.sn" && !deja429.has(idempotence)) {
    deja429.add(idempotence);
    return { statut: 429, corps: { name: "rate_limit_exceeded", message: "Too many requests." } };
  }
  if (a === "aaa.quota@exemple.sn") return { statut: 429, corps: { name: "daily_quota_exceeded", message: "You have reached your daily email sending quota." } };
  if (a === "clef@exemple.sn") return { statut: 401, corps: { name: "invalid_api_key", message: "API key is invalid" } };
  return { statut: 200, corps: { id: `re_${appels.length}` } };
}

async function appeler(reglages: Reglages, corps: Record<string, unknown> = {}, jeton?: string): Promise<{ statut: number; reponse: Record<string, unknown> }> {
  const req = new Request("http://localhost/functions/v1/courriels", {
    method: "POST",
    headers: { ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}), "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  const res = await traiter(req, () => ({
    serveur, sql: connexion(), reglages, envoyer: resend,
    attendre: async (ms) => { pauses.push(ms); },
    maintenant: () => horloge,
  }));
  return { statut: res.status, reponse: await res.json() };
}

Deno.test("fonction serveur « courriels » : alertes, mails selon le domaine, refus, reprises, état", async () => {
  const sql = connexion();
  try {
    await sql.unsafe(`
      insert into auth.users (id, email) values ('${FALL}', 'adm.a1@comptes.edumanage.invalid'), ('${SCOL}', 'scol.a2@comptes.edumanage.invalid');
      insert into public.roles (id, code, pages) values ('role-scol-a', 'ROLE_SCOL_A', array['sec-users']);
      insert into public.comptes (id, type_compte, identifiant, nom_affiche, role_id, doit_changer_mot_de_passe) values
        ('${FALL}', 'administration', 'ADM-A', 'Ibrahima FALL', null, false), ('${SCOL}', 'administration', 'SCOL-A', 'Scolarité', 'role-scol-a', false);
      insert into public.etablissement (id, nom) values (1, 'Université Catholique de l''Afrique de l''Ouest')
        on conflict (id) do update set nom = excluded.nom;
    `);
    /** Mail du système, envoyé depuis la session d'Ibrahima FALL (seule l'administration envoie). */
    const mettreEnFile = async (id: string, adresses: string[]) => {
      await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: FALL, role: "authenticated" })}, true)`;
        await tx`insert into public.mails_envoyes (id, auteur_id, objet, message, destinataires, statut)
          values (${id}, 'system', ${`Objet ${id}`}, ${`Message ${id}`},
          ${tx.json(adresses.map((email) => ({ label: email, email })) as never)}, 'traite')`;
      });
    };
    const etats = async () => Object.fromEntries((await sql`select destinataire, etat, motif, tentatives, prochain_essai > now() as plus_tard
      from private.courriels where nature = 'mail' order by id`).map((l) => [l.destinataire, l]));

    // ——— Sans clé : rien ne bouge ———
    await mettreEnFile("mail-a1", ["awa.seck@exemple.sn", "kane@exemple.sn"]);
    await sql`select private.alerter('sauvegarde', 'EduManage : sauvegarde à faire', 'Aucune sauvegarde n''a encore été faite.')`;
    let r = await appeler({});
    verifier(r.statut === 200 && r.reponse.configure === false && appels.length === 0, "sans clé Resend : rien n'est envoyé, la file attend");
    verifier(Number((await sql`select count(*) from private.courriels where etat = 'en_attente'`)[0].count) === 3, "les trois e-mails restent en attente");

    // ——— Clé, sans domaine vérifié : l'alerte part, les mails attendent le domaine ———
    r = await appeler({ cle: "re_essai", alertes: "direction@exemple.sn" });
    verifier(r.statut === 200 && r.reponse.envoyes === 1 && r.reponse.ignores === 2, "seule l'alerte part tant qu'aucun domaine n'est vérifié", r.reponse);
    verifier(JSON.stringify(appels[0].corps) === JSON.stringify({
      from: EXPEDITEUR_ESSAI, to: ["direction@exemple.sn"], subject: "EduManage : sauvegarde à faire",
      text: "Aucune sauvegarde n'a encore été faite.\n\n—\nAlerte automatique d'EduManage (visite quotidienne).",
    }), "l'alerte part de l'adresse d'essai de Resend vers l'adresse des alertes", appels[0].corps);
    verifier(/^edumanage-courriel-\d+-1$/.test(appels[0].idempotence), "chaque envoi porte une clé d'unicité (pas de doublon si Resend est rappelé)");
    let e = await etats();
    verifier(e["awa.seck@exemple.sn"].etat === "ignore" && String(e["awa.seck@exemple.sn"].motif).includes("domaine d'envoi doit être vérifié"),
      "les mails sont mis de côté avec le motif (domaine à vérifier)");

    // ——— Domaine vérifié : chaque cas de Resend ———
    appels.length = 0;
    await mettreEnFile("mail-a2", ["awa.seck@exemple.sn", "invalide@exemple.sn", "kane@exemple.sn", "panne@exemple.sn", "reseau@exemple.sn", "debit@exemple.sn"]);
    r = await appeler({ cle: "re_essai", alertes: "direction@exemple.sn", expediteur: PROPRE });
    verifier(r.reponse.envoyes === 2 && r.reponse.refuses === 2 && r.reponse.reportes === 2, "bilan : 2 envoyés, 2 refusés, 2 reportés", r.reponse);
    const awa = appels.find((a) => (a.corps.to as string[])[0] === "awa.seck@exemple.sn")!;
    verifier(awa.corps.from === PROPRE && awa.corps.subject === "Objet mail-a2"
      && awa.corps.text === "Message mail-a2\n\n—\nUniversité Catholique de l'Afrique de l'Ouest\nMessage envoyé par EduManage : pour répondre, utilisez la messagerie de votre espace.",
      "le mail part du domaine de l'établissement, signé de son nom", awa.corps);
    e = await etats();
    verifier(e["invalide@exemple.sn"].etat === "refuse" && String(e["invalide@exemple.sn"].motif).startsWith("Refusé par Resend"), "adresse refusée par Resend : abandonnée");
    verifier(e["kane@exemple.sn"].etat === "refuse" && String(e["kane@exemple.sn"].motif).startsWith("Domaine d'envoi non vérifié"), "restriction du compte d'essai : motif clair");
    verifier(e["panne@exemple.sn"].etat === "en_attente" && e["panne@exemple.sn"].plus_tard && e["reseau@exemple.sn"].etat === "en_attente",
      "panne de Resend ou du réseau : nouvel essai plus tard");
    verifier(e["debit@exemple.sn"].etat === "envoye" && pauses.includes(1000), "trop d'envois à la fois : une seconde d'attente, puis l'envoi");
    verifier(pauses.filter((p) => p === 550).length >= 4, "les envois sont espacés (2 par seconde au plus)");

    // ——— Quota du jour : arrêt, la suite part plus tard (sans être refusée) ———
    appels.length = 0;
    await mettreEnFile("mail-a3", ["aaa.quota@exemple.sn", "ousmane.diallo@exemple.sn", "fatou.sow@exemple.sn"]);
    r = await appeler({ cle: "re_essai", alertes: "direction@exemple.sn", expediteur: PROPRE });
    e = await etats();
    verifier(appels.length === 1 && r.reponse.reportes === 3 && ["aaa.quota@exemple.sn", "ousmane.diallo@exemple.sn", "fatou.sow@exemple.sn"].every((a) => e[a].etat === "en_attente" && e[a].plus_tard),
      "quota du jour atteint : on s'arrête, tout le reste attend plus tard", r.reponse);

    // ——— Clé refusée : arrêt, rien n'est perdu ———
    await sql`update private.courriels set prochain_essai = now() where etat = 'en_attente'`;
    await sql`update private.courriels set etat = 'envoye', traite_le = now() where destinataire in ('aaa.quota@exemple.sn', 'panne@exemple.sn', 'reseau@exemple.sn')`;
    await mettreEnFile("mail-a4", ["clef@exemple.sn"]);
    await sql`update private.courriels set prochain_essai = now() - interval '1 hour' where destinataire = 'clef@exemple.sn'`;
    appels.length = 0;
    r = await appeler({ cle: "re_mauvaise", alertes: "direction@exemple.sn", expediteur: PROPRE });
    e = await etats();
    verifier(appels.length === 1 && e["clef@exemple.sn"].etat === "en_attente" && String(e["clef@exemple.sn"].motif).includes("RESEND_API_KEY")
      && e["ousmane.diallo@exemple.sn"].etat === "en_attente", "clé refusée : arrêt, motif clair, les e-mails restent en attente", r.reponse);

    // ——— Mail trop ancien ———
    await sql`update private.courriels set prochain_essai = now(), cree_le = now() - interval '8 days' where destinataire = 'ousmane.diallo@exemple.sn'`;
    horloge = Date.now();
    r = await appeler({ cle: "re_essai", alertes: "direction@exemple.sn", expediteur: PROPRE });
    e = await etats();
    verifier(e["ousmane.diallo@exemple.sn"].etat === "ignore" && String(e["ousmane.diallo@exemple.sn"].motif).startsWith("Trop ancien"),
      "un mail en attente depuis plus de 7 jours n'est plus envoyé");

    // ——— État, pour l'administrateur principal ———
    r = await appeler({ cle: "re_essai", alertes: "direction@exemple.sn", expediteur: PROPRE }, { action: "etat" });
    verifier(r.statut === 401, "état sans session : refus");
    r = await appeler({ cle: "re_essai" }, { action: "etat" }, "jeton-scol");
    verifier(r.statut === 403, "la scolarité ne lit pas l'état des e-mails");
    r = await appeler({ cle: "re_essai", alertes: "direction@exemple.sn" }, { action: "etat" }, "jeton-fall");
    const file = r.reponse.file as Record<string, number>;
    verifier(r.statut === 200 && r.reponse.configure === true && r.reponse.domaine_propre === false && r.reponse.expediteur === EXPEDITEUR_ESSAI
      && r.reponse.alertes === "direction@exemple.sn" && file.envoyes >= 3 && Array.isArray(r.reponse.motifs) && !JSON.stringify(r.reponse).includes("re_essai"),
      "l'état donne les réglages (jamais la clé) et le bilan de la semaine", r.reponse);
    r = await appeler({ cle: "re_essai", expediteur: "EduManage <onboarding@resend.dev>" }, { action: "etat" }, "jeton-fall");
    verifier(r.reponse.domaine_propre === false && r.reponse.expediteur === EXPEDITEUR_ESSAI,
      "un expéditeur réglé sur l'adresse d'essai de Resend n'est pas pris pour un domaine vérifié");
    r = await appeler({ cle: "re_essai" }, { action: "effacer" });
    verifier(r.statut === 400, "action inconnue : refus");
  } finally {
    await sql.end();
  }
});
