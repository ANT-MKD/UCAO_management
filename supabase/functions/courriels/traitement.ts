// Traitement de la fonction serveur « courriels » (partie 10, lot 4) : envoi par Resend des
// e-mails de la file (private.courriels).
//   envoyer : sans session ; vide la file (appelé par l'application après un mail, et chaque
//             jour par la visite quotidienne) ; ne fait qu'envoyer ce que la base a mis en file ;
//   etat    : réglages (sans la clé) et état de la file, pour l'administrateur à accès complet.
// Secrets du serveur, réglés par l'établissement : RESEND_API_KEY ; EDUMANAGE_ALERTES (adresse des
// alertes) ; EDUMANAGE_EXPEDITEUR (« Nom <adresse@domaine> », une fois le domaine vérifié chez
// Resend). Sans domaine vérifié, Resend n'accepte que l'adresse du titulaire du compte : seules
// les alertes partent, les mails de l'établissement attendent le domaine (mis de côté, motif noté).
import type postgres from "npm:postgres@3.4.5";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { ENTETES_CORS, lireCorps, refuser, repondre } from "../_shared/commun.ts";

type Sql = ReturnType<typeof postgres>;

export interface Reglages {
  cle?: string;
  expediteur?: string;
  alertes?: string;
}

export interface ReponseResend {
  statut: number;
  corps: Record<string, unknown>;
}

export interface Acces {
  serveur: SupabaseClient;
  sql: Sql;
  reglages: Reglages;
  /** Appel à l'API Resend (POST /emails) ; une erreur réseau lève une exception. */
  envoyer: (corps: Record<string, unknown>, idempotence: string) => Promise<ReponseResend>;
  attendre: (ms: number) => Promise<void>;
  maintenant: () => number;
}

/** Expéditeur de test de Resend : n'envoie qu'à l'adresse du titulaire du compte. */
export const EXPEDITEUR_ESSAI = "EduManage <onboarding@resend.dev>";
const LOT = 40;
/** Un passage dure au plus 45 s : la visite quotidienne (Vercel) attend sa fin. */
const BUDGET_MS = 45_000;
/** Resend accepte 2 requêtes par seconde par défaut. */
const ESPACEMENT_MS = 550;
const ATTENTES_MINUTES = [5, 30, 120, 720, 1440];

export function domainePropre(expediteur?: string): boolean {
  return !!expediteur?.trim() && !/@resend\.dev\s*>?\s*$/i.test(expediteur.trim());
}

interface Ligne {
  id: number;
  nature: "mail" | "alerte";
  destinataire: string | null;
  objet: string;
  texte: string;
  tentatives: number;
  cree_le: Date;
}

type Verdict =
  | { resultat: "envoye"; resendId: string }
  | { resultat: "refuse" | "ignore"; motif: string }
  | { resultat: "reessayer"; motif: string; minutes: number; arreter?: boolean };

/** Que faire d'une réponse de Resend. */
export function juger(reponse: ReponseResend, tentatives: number): Verdict {
  const { statut, corps } = reponse;
  const message = String(corps.message ?? "");
  const nom = String(corps.name ?? "");
  if (statut >= 200 && statut < 300 && typeof corps.id === "string") return { resultat: "envoye", resendId: corps.id };
  if (statut === 401 || (statut === 403 && !/testing emails|verify a domain|own email/i.test(message))) {
    return { resultat: "reessayer", minutes: 60, arreter: true,
      motif: `Resend refuse l'envoi (${statut}) : vérifiez RESEND_API_KEY et EDUMANAGE_EXPEDITEUR dans les secrets du serveur.` };
  }
  if (statut === 403) {
    return { resultat: "refuse", motif: "Domaine d'envoi non vérifié : Resend n'accepte que l'adresse du titulaire du compte." };
  }
  if (statut === 422 || statut === 400) return { resultat: "refuse", motif: `Refusé par Resend : ${message || nom || statut}`.slice(0, 300) };
  if (statut === 429 && /quota/i.test(`${nom} ${message}`)) {
    return { resultat: "reessayer", minutes: 720, arreter: true, motif: "Quota d'envoi de Resend atteint : la suite part plus tard." };
  }
  if (statut === 429) return { resultat: "reessayer", minutes: 2, arreter: true, motif: "Trop d'envois à la fois : la suite part dans quelques minutes." };
  return { resultat: "reessayer", minutes: ATTENTES_MINUTES[Math.min(Math.max(tentatives, 1), ATTENTES_MINUTES.length) - 1],
    motif: `Resend indisponible (${statut}) : nouvel essai plus tard.` };
}

async function noter(sql: Sql, id: number, v: Verdict): Promise<void> {
  if (v.resultat === "envoye") await sql`select private.courriel_resultat(${id}, 'envoye', ${v.resendId}, null)`;
  else if (v.resultat === "reessayer") await sql`select private.courriel_resultat(${id}, 'reessayer', null, ${v.motif}, ${v.minutes})`;
  else await sql`select private.courriel_resultat(${id}, ${v.resultat}, null, ${v.motif})`;
}

/** Vide la file dans le temps imparti ; rend le bilan. */
export async function envoyerFile(acces: Acces): Promise<Record<string, number>> {
  const { sql, reglages } = acces;
  const bilan = { envoyes: 0, refuses: 0, ignores: 0, reportes: 0 };
  const debut = acces.maintenant();
  const propre = domainePropre(reglages.expediteur);
  const expediteur = propre ? reglages.expediteur!.trim() : EXPEDITEUR_ESSAI;
  const [etab] = await sql`select nom from public.etablissement where id = 1`;
  const signature = String(etab?.nom ?? "").trim() || "EduManage";
  let arret: Verdict | null = null;
  let premier = true;

  while (!arret && acces.maintenant() - debut < BUDGET_MS) {
    const lot = await sql`select * from private.courriels_reserver(${LOT})` as unknown as Ligne[];
    if (lot.length === 0) break;
    for (const l of lot) {
      if (arret || acces.maintenant() - debut >= BUDGET_MS) {
        const v: Verdict = arret && arret.resultat === "reessayer" ? arret : { resultat: "reessayer", minutes: 0, motif: "Reporté au prochain envoi." };
        await noter(sql, l.id, v);
        bilan.reportes++;
        continue;
      }
      const age = acces.maintenant() - new Date(l.cree_le).getTime();
      let v: Verdict | null = null;
      if (l.nature === "mail" && !propre) {
        v = { resultat: "ignore", motif: "Envoi des mails par e-mail pas encore ouvert : un domaine d'envoi doit être vérifié chez Resend (EDUMANAGE_EXPEDITEUR)." };
      } else if (l.nature === "mail" && age > 7 * 86_400_000) {
        v = { resultat: "ignore", motif: "Trop ancien : non envoyé après 7 jours d'attente." };
      } else if (l.nature === "alerte" && !reglages.alertes?.trim()) {
        v = { resultat: "ignore", motif: "Adresse des alertes non réglée (EDUMANAGE_ALERTES)." };
      } else if (l.nature === "alerte" && age > 3 * 86_400_000) {
        v = { resultat: "ignore", motif: "Alerte dépassée : remplacée par une plus récente." };
      }
      if (!v) {
        if (!premier) await acces.attendre(ESPACEMENT_MS);
        premier = false;
        const corps = {
          from: l.nature === "alerte" ? (propre ? expediteur : EXPEDITEUR_ESSAI) : expediteur,
          to: [l.nature === "alerte" ? reglages.alertes!.trim() : l.destinataire],
          subject: l.objet,
          text: l.nature === "alerte"
            ? `${l.texte}\n\n—\nAlerte automatique d'EduManage (visite quotidienne).`
            : `${l.texte}\n\n—\n${signature}\nMessage envoyé par EduManage : pour répondre, utilisez la messagerie de votre espace.`,
        };
        const idempotence = `edumanage-courriel-${l.id}-${l.tentatives}`;
        try {
          let reponse = await acces.envoyer(corps, idempotence);
          if (reponse.statut === 429 && !/quota/i.test(`${reponse.corps.name ?? ""} ${reponse.corps.message ?? ""}`)) {
            await acces.attendre(1000);
            reponse = await acces.envoyer(corps, idempotence);
          }
          v = juger(reponse, l.tentatives);
        } catch {
          v = juger({ statut: 0, corps: {} }, l.tentatives);
        }
      }
      await noter(sql, l.id, v);
      if (v.resultat === "envoye") bilan.envoyes++;
      else if (v.resultat === "refuse") bilan.refuses++;
      else if (v.resultat === "ignore") bilan.ignores++;
      else if (v.resultat === "reessayer") {
        bilan.reportes++;
        if (v.arreter) arret = v;
      }
    }
  }
  return bilan;
}

async function etat(sql: Sql, reglages: Reglages): Promise<Response> {
  const [file] = await sql`
    select count(*) filter (where etat = 'en_attente') as en_attente,
           count(*) filter (where etat = 'envoye' and traite_le > now() - interval '7 days') as envoyes,
           count(*) filter (where etat = 'refuse' and traite_le > now() - interval '7 days') as refuses,
           count(*) filter (where etat = 'ignore' and traite_le > now() - interval '7 days') as ignores
    from private.courriels`;
  const motifs = await sql`
    select motif, count(*)::int as nombre from private.courriels
    where etat in ('refuse', 'ignore') and traite_le > now() - interval '7 days' and motif is not null
    group by motif order by count(*) desc limit 3`;
  return repondre(200, {
    configure: !!reglages.cle?.trim(),
    expediteur: domainePropre(reglages.expediteur) ? reglages.expediteur!.trim() : EXPEDITEUR_ESSAI,
    domaine_propre: domainePropre(reglages.expediteur),
    alertes: reglages.alertes?.trim() || null,
    file: { en_attente: Number(file.en_attente), envoyes: Number(file.envoyes), refuses: Number(file.refuses), ignores: Number(file.ignores) },
    motifs: motifs.map((m) => ({ motif: String(m.motif), nombre: Number(m.nombre) })),
  });
}

export async function traiter(req: Request, ouvrir: () => Acces): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: ENTETES_CORS });
  if (req.method !== "POST") return refuser(405, "Méthode non prise en charge.");
  const corps = await lireCorps(req) ?? {};
  const acces = ouvrir();
  try {
    if (corps.action === "etat") {
      const jeton = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
      const { data, error } = jeton ? await acces.serveur.auth.getUser(jeton) : { data: { user: null }, error: null };
      if (error || !data.user) return refuser(401, "Connectez-vous pour continuer.");
      const [droit] = await acces.sql`
        select exists (select 1 from public.comptes c where c.id = ${data.user.id}::uuid and c.actif
                       and c.type_compte = 'administration' and c.role_id is null) as autorise`;
      if (!droit.autorise) return refuser(403, "L'état des e-mails est réservé à un administrateur à accès complet.");
      return await etat(acces.sql, acces.reglages);
    }
    if (corps.action !== undefined && corps.action !== "envoyer") return refuser(400, "Action inconnue.");
    if (!acces.reglages.cle?.trim()) return repondre(200, { ok: true, configure: false });
    return repondre(200, { ok: true, configure: true, ...(await envoyerFile(acces)) });
  } catch (erreur) {
    console.error("courriels :", erreur);
    return refuser(500, "Envoi des e-mails impossible pour le moment.");
  } finally {
    await acces.sql.end({ timeout: 5 });
  }
}
