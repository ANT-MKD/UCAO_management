import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import { getRoles, remplacerRoles, type RoleRecord } from "./roleStore";
import { getPagesPortails, remplacerPagesPortails, type PagePortailRecord } from "./portalFeaturesStore";
import { getMotifsBlocage, remplacerMotifsBlocage, type MotifBlocageRecord } from "./motifBlocageStore";

/** Rôles, pages des portails et motifs de blocage reflétés dans la base (partie 3, lot 2 : tables
 * de la migration « roles_portails_motifs »). La base décide qui les modifie : accès complet pour
 * les rôles, « Portails » pour les pages, « Paramètres généraux » pour les motifs. */

enregistrerMiroir({
  cle: "edumanage-roles-v1",
  parties: [partie<RoleRecord>({
    table: "roles",
    colonnes: ["id", "code", "description", ["accessibleItemIds", "pages"], ["auteurId", "auteur"], ["createdAt", "cree_le"]],
    defauts: { description: "", accessibleItemIds: [] },
    lire: getRoles,
    remplacer: remplacerRoles,
  })],
});

enregistrerMiroir({
  cle: "edumanage-portal-features-v1",
  parties: [partie<PagePortailRecord>({
    table: "pages_portails",
    colonnes: ["id", "portail", "active"],
    lire: getPagesPortails,
    remplacer: remplacerPagesPortails,
  })],
});

enregistrerMiroir({
  cle: "edumanage-motifs-blocage-v1",
  parties: [partie<MotifBlocageRecord>({
    table: "motifs_blocage",
    colonnes: ["id", "code", "intitule", "actionsInterdites", ["createdAt", "cree_le"]],
    defauts: { actionsInterdites: [] },
    lire: getMotifsBlocage,
    remplacer: remplacerMotifsBlocage,
  })],
});
