import { afterEach, describe, expect, it, vi } from "vitest";

/** Reprise des données d'un poste (partie 9, lot 3). Le poste d'Ibrahima FALL avait, avant la
 * base : Awa SECK (inscrite cette année) et Fatou SOW (l'an passé), un contact et des documents
 * dans leurs dossiers. La fonction serveur « reprise » est imitée : ses réponses sont réglées par
 * le test, ses appels relevés. */

const CLE = "edumanage-sauvegarde-avant-supabase-v1";
const PDF = (texte: string) => `data:application/pdf;base64,${btoa(texte)}`;
const DOC = (id: string, entiteId: string, contenu: string) => ({ id, entiteType: "etudiant", entiteId, nom: `${id}.pdf`, dataUrl: PDF(contenu),
  tailleOctets: contenu.length, ajouteLe: "2026-10-15", ajoutePar: "Scolarité" });

const POSTE = {
  "edumanage-app-store-v2": JSON.stringify({
    annees: [{ id: "an-2025", libelle: "2025-2026", actuelle: false }, { id: "an-2026", libelle: "2026-2027", actuelle: true }],
    // Awa a redéposé sa CNI telle quelle : la pièce validée et celle à vérifier sont le même fichier.
    etudiants: [{ id: "et-awa", matricule: "2026-LQHSE-0001", prenom: "Awa", nom: "SECK", annee: "2026-2027", statut: "inscrit",
      documentsFichiers: { cni: PDF("cni d'Awa") }, piecesEnVerification: { cni: { dataUrl: PDF("cni d'Awa"), deposeLe: "2026-10-20" } } }],
    users: [
      { id: "u-fall", role: "admin", displayName: "Ibrahima FALL", email: "i.fall@ucao.edu", identifier: "ADM", actif: true },
      { id: "u-scol", role: "admin", displayName: "Scolarité", email: "", identifier: "SCOL-1", actif: true, roleId: "role-scol", fonction: "Secrétariat" },
      { id: "u-awa", role: "student", displayName: "Awa SECK", email: "awa.seck@mail.sn", identifier: "2026-LQHSE-0001", actif: true, linkedId: "et-awa",
        roleId: "role-ancien" },
    ],
  }),
  "edumanage-contact-store-v1": JSON.stringify([{ id: "ct-awa", etudiantId: "et-awa", role: "pere", nomComplet: "Moussa SECK", telephone: "+221 77 000 00 10" }]),
  "edumanage-document-store-v1": JSON.stringify([DOC("doc-awa-cni", "et-awa", "cni"), DOC("doc-awa-bac", "et-awa", "relevé du bac"), DOC("doc-fatou", "et-fatou", "cni de Fatou")]),
};

type Appel = { action: string; corps: Record<string, unknown> };

async function posteEnReprise(reponses: Record<string, (corps: Record<string, unknown>) => unknown>, avecReprise = true) {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://exemple.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_essai");
  window.history.replaceState({}, "", avecReprise ? "/?reprise=poste" : "/");
  localStorage.setItem(CLE, JSON.stringify({ le: "2026-10-30T10:00:00Z", donnees: { ...POSTE, "edumanage-theme": null } }));
  const appels: Appel[] = [];
  const client = {
    functions: {
      invoke: async (nom: string, options: { body: Record<string, unknown> }) => {
        const action = String(options.body.action);
        appels.push({ action, corps: JSON.parse(JSON.stringify(options.body)) });
        if (nom !== "reprise" || !reponses[action]) return { data: null, error: new Error(`appel inattendu : ${nom}/${action}`) };
        return { data: reponses[action](options.body), error: null };
      },
    },
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  };
  vi.doMock("@supabase/supabase-js", async (original) => ({ ...(await original<typeof import("@supabase/supabase-js")>()), createClient: () => client }));
  const reprise = await import("@/lib/reprise");
  return { reprise, appels, stockage: await import("@/lib/stockageLocal") };
}

const RAPPORT = (gardes: Record<string, string[]>, aCreer: string[]) => ({
  annee: "2026-2027", essai: true, tables: {}, liens: {}, refus: [], lignes_reprises: 12, compteurs: {}, gardes,
  comptes: { recus: 3, existants: 1, crees: aCreer.length, ecartes: [], a_creer: aCreer },
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@supabase/supabase-js");
  window.history.replaceState({}, "", "/");
});

describe("reprise des données d'un poste (partie 9, lot 3)", () => {
  it("ouverte en mode reprise, la page relit la sauvegarde du poste (et n'écrit rien dans le navigateur) ; sinon, jamais", async () => {
    const { stockage } = await posteEnReprise({});
    expect(stockage.modeReprise).toBe(true);
    const C = await import("@/data/contactStore");
    expect(C.getContacts().map((c) => c.nomComplet)).toEqual(["Moussa SECK"]);
    expect(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))).toEqual([CLE]);

    const hors = await posteEnReprise({}, false);
    expect(hors.stockage.modeReprise).toBe(false);
    expect((await import("@/data/contactStore")).getContacts()).toEqual([]);
  });

  it("les données du poste sont écrites comme les lignes de la base : comptes à recréer, fichiers à déposer à leur chemin", async () => {
    const { reprise } = await posteEnReprise({});
    const d = reprise.donneesDuPoste();
    expect(d.annee).toBe("2026-2027");
    expect(d.tables.contacts_etudiants).toEqual([expect.objectContaining({ id: "ct-awa", etudiant_id: "et-awa", nom_complet: "Moussa SECK" })]);
    expect(d.tables.annees_academiques.map((a) => a.libelle)).toEqual(["2025-2026", "2026-2027"]);
    for (const table of ["comptes", "notifications", "mouvements_solde", "journal_audit"]) expect(d.tables[table]).toBeUndefined();

    const cni = d.tables.documents_dossiers.find((l) => l.id === "doc-awa-cni")!;
    expect(String(cni.fichier_chemin)).toMatch(/^etudiants\/et-awa\/doc-awa-cni\/[^/]+\.pdf$/);
    expect(d.fichiers.filter((f) => f.table === "documents_dossiers")).toHaveLength(3);
    // Un même fichier pour deux champs d'une fiche : un seul dépôt, un seul chemin.
    const piece = d.tables.pieces_etudiants.find((l) => l.id === "et-awa:cni")!;
    expect(piece.en_verification).toBe(piece.fichier);
    expect(d.fichiers.filter((f) => f.espace === "pieces")).toEqual([expect.objectContaining({ chemin: piece.fichier, table: "pieces_etudiants" })]);
    expect(d.fichiers.find((f) => f.id === "doc-awa-cni")).toEqual({ espace: "dossiers", chemin: cni.fichier_chemin, dataUrl: PDF("cni"),
      table: "documents_dossiers", id: "doc-awa-cni", colonne: "fichier_chemin" });

    expect(d.comptes).toEqual([
      { ancien: "u-fall", type_compte: "administration", identifiant: "ADM", nom_affiche: "Ibrahima FALL", email: "i.fall@ucao.edu", telephone: "", fonction: "",
        role_id: null, lien_id: null, actif: true },
      expect.objectContaining({ ancien: "u-scol", type_compte: "administration", role_id: "role-scol", fonction: "Secrétariat" }),
      expect.objectContaining({ ancien: "u-awa", type_compte: "etudiant", identifiant: "2026-LQHSE-0001", lien_id: "et-awa", role_id: null }),
    ]);
    // Une seconde préparation (nouvel essai) redonne tous les fichiers.
    expect(reprise.donneesDuPoste().fichiers).toHaveLength(4);
  });

  it("l'essai envoie tout le poste et demande les lignes gardées des tables à fichiers", async () => {
    const { reprise, appels } = await posteEnReprise({ analyser: () => ({ rapport: RAPPORT({ documents_dossiers: ["doc-awa-cni"] }, ["u-scol", "u-awa"]) }) });
    const d = reprise.donneesDuPoste();
    const rapport = await reprise.essayerReprise(d);
    expect(rapport.comptes.a_creer).toEqual(["u-scol", "u-awa"]);
    expect(appels).toEqual([{ action: "analyser", corps: expect.objectContaining({ annee: "2026-2027" }) }]);
    expect([...(appels[0].corps.ids_pour as string[])].sort()).toEqual(["documents_dossiers", "pieces_etudiants"]);
    expect((appels[0].corps.tables as Record<string, unknown[]>).documents_dossiers).toHaveLength(3);
    expect((appels[0].corps.comptes as unknown[])).toHaveLength(3);
  });

  it("reprise réelle : comptes à créer seulement, fichiers des lignes gardées seulement ; un fichier refusé laisse sa ligne sans fichier", async () => {
    const { reprise, appels } = await posteEnReprise({
      nettoyer: () => ({ supprimees: 0 }),
      creer_comptes: (c) => ({ ids: Object.fromEntries((c.comptes as { ancien: string }[]).map((x) => [x.ancien, `id-${x.ancien}`])), erreurs: [] }),
      deposer: (c) => {
        const fichiers = c.fichiers as { espace: string; chemin: string }[];
        const lourd = fichiers.filter((f) => f.chemin.includes("doc-awa-bac"));
        return { deposes: fichiers.length - lourd.length, erreurs: lourd.map((f) => ({ ...f, motif: "fichier trop lourd" })) };
      },
      reprendre: () => ({ rapport: { ...RAPPORT({}, []), essai: false, comptes: { recus: 3, existants: 1, crees: 2, ecartes: [], a_creer: [] } } }),
    });
    const d = reprise.donneesDuPoste();
    const progression: string[] = [];
    const rapport = await reprise.reprendre(d, RAPPORT({ documents_dossiers: ["doc-awa-cni", "doc-awa-bac"] }, ["u-scol", "u-awa"]),
      (etape, fait, total) => progression.push(`${etape} ${fait}/${total}`));

    expect(appels.map((a) => a.action)).toEqual(["nettoyer", "creer_comptes", "deposer", "reprendre"]);
    expect(appels[1].corps.comptes).toEqual([{ ancien: "u-scol", identifiant: "SCOL-1" }, { ancien: "u-awa", identifiant: "2026-LQHSE-0001" }]);
    const deposes = (appels[2].corps.fichiers as { chemin: string; contenu: string }[]);
    expect(deposes.map((f) => f.chemin.split("/")[2]).sort()).toEqual(["doc-awa-bac", "doc-awa-cni"]);
    expect(deposes.find((f) => f.chemin.includes("doc-awa-cni"))!.contenu).toBe(PDF("cni"));

    const final = appels[3].corps;
    expect(final.comptes).toEqual([expect.objectContaining({ ancien: "u-fall" }), expect.objectContaining({ ancien: "u-scol", id: "id-u-scol" }),
      expect.objectContaining({ ancien: "u-awa", id: "id-u-awa" })]);
    expect((final.comptes as { ancien: string; id?: string }[])[0].id).toBeUndefined();
    const docs = final.tables as Record<string, { id: string; fichier_chemin: string | null }[]>;
    expect(docs.documents_dossiers.find((l) => l.id === "doc-awa-bac")!.fichier_chemin).toBeNull();
    expect(docs.documents_dossiers.find((l) => l.id === "doc-awa-cni")!.fichier_chemin).toMatch(/^etudiants\/et-awa\/doc-awa-cni\//);
    expect(final.fichiers_deposes).toEqual([{ espace: "dossiers", chemin: expect.stringContaining("doc-awa-cni") }]);
    expect(d.tables.documents_dossiers.find((l) => l.id === "doc-awa-bac")!.fichier_chemin).not.toBeNull();

    expect(rapport.fichiers_refuses).toEqual([expect.objectContaining({ motif: "fichier trop lourd" })]);
    expect(progression).toEqual(["comptes 0/2", "comptes 2/2", "fichiers 0/2", "fichiers 2/2", "reprise 0/1", "reprise 1/1"]);
  });

  it("un compte dont l'identité n'a pu être créée n'est pas repris (ses lignes sont jugées par la base comme d'un compte inconnu)", async () => {
    const { reprise, appels } = await posteEnReprise({
      nettoyer: () => ({ supprimees: 0 }),
      creer_comptes: () => ({ ids: { "u-scol": "id-u-scol" }, erreurs: [{ ancien: "u-awa", motif: "identité non créée" }] }),
      reprendre: () => ({ rapport: { ...RAPPORT({}, []), essai: false } }),
    });
    const rapport = await reprise.reprendre(reprise.donneesDuPoste(), RAPPORT({}, ["u-scol", "u-awa"]));
    expect(appels.map((a) => a.action)).toEqual(["nettoyer", "creer_comptes", "reprendre"]);
    expect((appels[2].corps.comptes as { ancien: string }[]).map((c) => c.ancien)).toEqual(["u-fall", "u-scol"]);
    expect(rapport.comptes_non_crees).toEqual([{ ancien: "u-awa", motif: "identité non créée" }]);
  });

  it("lots : comptes par 50, fichiers par taille (un fichier plus gros que le lot part seul)", async () => {
    const { reprise } = await posteEnReprise({});
    expect(reprise.enLots(Array.from({ length: 120 }, (_, i) => i), () => 1, 50).map((l) => l.length)).toEqual([50, 50, 20]);
    expect(reprise.enLots([3, 2, 9, 1, 1], (n) => n, 5)).toEqual([[3, 2], [9], [1, 1]]);
    expect(reprise.enLots([9, 1], (n) => n, 5)).toEqual([[9], [1]]);
  });
});
