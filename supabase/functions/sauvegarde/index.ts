// Fonction serveur « sauvegarde » (partie 10, lot 3) : voir traitement.ts.
import postgres from "npm:postgres@3.4.5";
import { clientServeur } from "../_shared/commun.ts";
import { traiter } from "./traitement.ts";

Deno.serve((req) => traiter(req, () => ({
  serveur: clientServeur(),
  sql: postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2, idle_timeout: 5, connect_timeout: 15 }),
})));
