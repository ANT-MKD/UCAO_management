// Fonction serveur « reprise » : reprise, une fois, des données d'un poste (partie 9, lot 3).
//   analyser      : essai complet dans la base, annulé ; rend le rapport de contrôle ;
//   nettoyer      : supprime les identités laissées par une reprise interrompue ;
//   creer_comptes : crée les identités Supabase des comptes repris (par lots) ;
//   deposer       : dépose les fichiers repris dans leurs espaces (par lots) ;
//   reprendre     : reprise réelle, en une transaction ; ensuite, les identités des comptes
//                   écartés sont supprimées (en cas d'échec : toutes, et les fichiers déposés).
// Réservée à un administrateur à accès complet, tant qu'aucune reprise n'a été faite. La session
// est vérifiée ici (verify_jwt = false). La base est jointe en propriétaire (SUPABASE_DB_URL) :
// la transaction de reprise passe en mode « replica », que seul le propriétaire peut demander.
import postgres from "npm:postgres@3.4.5";
import { clientServeur } from "../_shared/commun.ts";
import { traiter } from "./traitement.ts";

Deno.serve((req) => traiter(req, () => ({
  serveur: clientServeur(),
  sql: postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 15 }),
})));
