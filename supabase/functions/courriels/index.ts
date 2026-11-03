// Fonction serveur « courriels » (partie 10, lot 4) : voir traitement.ts.
import postgres from "npm:postgres@3.4.5";
import { clientServeur } from "../_shared/commun.ts";
import { traiter } from "./traitement.ts";

Deno.serve((req) => traiter(req, () => ({
  serveur: clientServeur(),
  sql: postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 15 }),
  reglages: {
    cle: Deno.env.get("RESEND_API_KEY"),
    expediteur: Deno.env.get("EDUMANAGE_EXPEDITEUR"),
    alertes: Deno.env.get("EDUMANAGE_ALERTES"),
  },
  envoyer: async (corps, idempotence) => {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotence,
      },
      body: JSON.stringify(corps),
    });
    return { statut: reponse.status, corps: await reponse.json().catch(() => ({})) as Record<string, unknown> };
  },
  attendre: (ms) => new Promise((ok) => setTimeout(ok, ms)),
  maintenant: () => Date.now(),
})));
