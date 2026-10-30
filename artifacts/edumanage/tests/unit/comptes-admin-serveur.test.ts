import { afterEach, describe, expect, it, vi } from "vitest";
import { preparerEtablissement } from "../fixtures/etablissement";

const ADMIN = "00000000-0000-4000-8000-00000000000a";
const KANE = "00000000-0000-4000-8000-00000000000c";
const AWA = "00000000-0000-4000-8000-00000000000e";

/** Lignes renvoyées par la base, telles que les lit un administrateur à accès complet. */
const TABLES: Record<string, unknown[]> = {
  comptes: [
    { id: AWA, type_compte: "etudiant", identifiant: "2026-LQHSE-0001", nom_affiche: "Awa SECK", email: "awa.seck@mail.sn", telephone: "", fonction: "", lien_id: "et-awa", role_id: null, actif: true, doit_changer_mot_de_passe: false, mot_de_passe_change_le: "2026-10-30T10:00:00Z" },
    { id: ADMIN, type_compte: "administration", identifiant: "ADM-PRINCIPAL", nom_affiche: "Fatou DIOP", email: "f.diop@ucao.edu", telephone: "", fonction: "Administrateur principal", lien_id: null, role_id: null, actif: true, doit_changer_mot_de_passe: false, mot_de_passe_change_le: null },
    { id: KANE, type_compte: "enseignant", identifiant: "PROF-KANE", nom_affiche: "Mamadou KANE", email: "m.kane@ucao.edu", telephone: "77 000 00 01", fonction: "Professeur", lien_id: "en-kane", role_id: null, actif: false, doit_changer_mot_de_passe: true, mot_de_passe_change_le: null },
  ],
  codes_pin_suivi: [
    { id: 2, compte: AWA, auteur: ADMIN, cree_le: "2026-10-30T12:00:00Z", statut: "actif" },
    { id: 1, compte: AWA, auteur: ADMIN, cree_le: "2026-10-30T11:00:00Z", statut: "remplace" },
  ],
  demandes_reinitialisation: [{ id: 7, compte: AWA, cree_le: "2026-10-30T09:00:00Z" }],
  portails: [
    { type_compte: "administration", ouvert: true, message: "" },
    { type_compte: "enseignant", ouvert: true, message: "" },
    { type_compte: "etudiant", ouvert: false, message: "Saisie des notes en cours" },
  ],
  roles: [{ id: "r1", code: "ROLE_SECRETARIAT", description: "Secrétariat", pages: ["sec-users"], auteur: ADMIN, cree_le: "2026-10-30T08:00:00Z" }],
};

/** Requête de la base : chaque filtre renvoie la même requête, qui se résout avec les lignes. */
function requete(lignes: unknown[]) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "order", "eq", "in", "is", "limit"]) q[m] = () => q;
  q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve({ data: lignes, error: null }).then(ok, ko);
  return q;
}

async function avecBase(rpc: (nom: string, args: Record<string, unknown>) => { data: unknown; error: { message: string } | null } = () => ({ data: null, error: null })) {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://exemple.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_essai");
  const client = {
    from: vi.fn((table: string) => requete(TABLES[table] ?? [])),
    rpc: vi.fn(async (nom: string, args: Record<string, unknown>) => rpc(nom, args)),
    functions: { invoke: vi.fn(async () => ({ data: { id: KANE }, error: null })) },
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
  };
  vi.doMock("@supabase/supabase-js", async (original) => ({
    ...(await original<typeof import("@supabase/supabase-js")>()),
    createClient: () => client,
  }));
  return {
    client,
    actions: await import("@/data/comptesAdmin"),
    serveur: await import("@/data/comptesServeurStore"),
    mails: await import("@/data/mailEnvoyeStore"),
  };
}

/** Lit une liste du serveur comme le ferait un écran (abonnement, puis chargement). */
async function lireListe<T>(source: { abonner: (f: () => void) => () => void; lire: () => T }): Promise<T> {
  await new Promise<void>((fini) => {
    const fin = source.abonner(() => {
      fin();
      fini();
    });
  });
  return source.lire();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@supabase/supabase-js");
});

describe("écrans Utilisateurs, Portails et Codes PIN avec Supabase", () => {
  it("les comptes de la base s'affichent comme les comptes de l'application", async () => {
    const { serveur } = await avecBase();
    const comptes = await lireListe(serveur.comptesServeur);
    const kane = comptes.find((c) => c.identifier === "PROF-KANE")!;
    expect(kane).toMatchObject({ role: "teacher", displayName: "Mamadou KANE", linkedId: "en-kane", actif: false, doitChangerMotDePasse: true, telephone: "77 000 00 01" });
    expect(comptes.find((c) => c.identifier === "2026-LQHSE-0001")?.role).toBe("student");
    expect(kane.password).toBe("");
  });

  it("créer KANE passe par la fonction serveur « comptes », puis la liste est relue", async () => {
    const { client, actions } = await avecBase();
    await actions.creerCompte(
      { role: "teacher", prenom: " Mamadou ", nom: "KANE ", identifier: "PROF-KANE", email: "m.kane@ucao.edu", password: "Provisoire1", linkedId: "en-kane", photoDataUrl: "data:image/png;base64,xx" },
      ADMIN,
    );
    expect(client.functions.invoke).toHaveBeenCalledWith("comptes", {
      body: {
        action: "creer", type_compte: "enseignant", identifiant: "PROF-KANE", nom_affiche: "Mamadou KANE", email: "m.kane@ucao.edu",
        telephone: "", fonction: "", role_id: null, lien_id: "en-kane", mot_de_passe: "Provisoire1",
      },
    });
    expect(client.from).toHaveBeenCalledWith("comptes");
  });

  it("un refus de la base est montré avec son message", async () => {
    const { actions } = await avecBase(() => ({ data: null, error: { message: "Vous ne pouvez pas changer votre propre rôle." } }));
    await expect(actions.modifierCompte(KANE, { displayName: "Mamadou KANE", email: "m.kane@ucao.edu", roleId: "r1" }, ADMIN))
      .rejects.toThrow("Vous ne pouvez pas changer votre propre rôle.");
  });

  it("bloquer KANE et fermer le portail Étudiants appellent les fonctions de la base", async () => {
    const { client, actions } = await avecBase();
    await actions.definirCompteActif(KANE, false, ADMIN);
    expect(client.rpc).toHaveBeenCalledWith("definir_compte_actif", { p_compte: KANE, p_actif: false });
    await actions.definirPortail("student", false, "Saisie des notes en cours");
    expect(client.rpc).toHaveBeenCalledWith("definir_portail", { p_type_compte: "etudiant", p_ouvert: false, p_message: "Saisie des notes en cours" });
  });

  it("le portail fermé et son message sont relus de la base", async () => {
    const { serveur } = await avecBase();
    const vue = await lireListe(serveur.portailsServeur);
    expect(vue.ouverts).toEqual({ admin: true, teacher: true, student: false });
    expect(vue.messages.student).toBe("Saisie des notes en cours");
  });

  it("code PIN d'Awa : montré une fois, jamais copié dans un mail ; l'historique n'a pas le code", async () => {
    const { client, actions, serveur, mails } = await avecBase((nom) => (nom === "generer_code_pin"
      ? { data: { id: 3, code: "482913", expire_le: "2026-10-31T12:00:00Z" }, error: null }
      : { data: null, error: null }));
    const awa = (await lireListe(serveur.comptesServeur)).find((c) => c.identifier === "2026-LQHSE-0001")!;
    expect(await actions.genererCodePin(awa, { id: ADMIN, name: "Fatou DIOP" })).toEqual({ id: "", code: "482913" });
    expect(client.rpc).toHaveBeenCalledWith("generer_code_pin", { p_compte: AWA });
    expect(mails.getMailsEnvoyes()).toHaveLength(0);
    const codes = await lireListe(serveur.codesServeur);
    expect(codes.map((c) => [c.id, c.statut])).toEqual([["2", "actif"], ["1", "remplace"]]);
    expect(JSON.stringify(codes)).not.toContain("482913");
    await actions.revoquerCodePin("2", "Fatou DIOP");
    expect(client.rpc).toHaveBeenCalledWith("revoquer_code_pin", { p_code: 2 });
  });

  it("la demande « mot de passe oublié » d'Awa est lue de la base", async () => {
    const { serveur } = await avecBase();
    expect(await lireListe(serveur.demandesServeur)).toEqual([{ id: "7", compteId: AWA, createdAt: "2026-10-30T09:00:00Z" }]);
  });

  it("les rôles de la base gardent leurs pages", async () => {
    const { serveur } = await avecBase();
    expect(await lireListe(serveur.rolesServeur)).toEqual([
      { id: "r1", code: "ROLE_SECRETARIAT", description: "Secrétariat", accessibleItemIds: ["sec-users"], auteurId: ADMIN, createdAt: "2026-10-30T08:00:00Z" },
    ]);
  });
});

describe("mêmes écrans sans Supabase (données du navigateur)", () => {
  it("créer, bloquer, code PIN et portail : comme avant", async () => {
    vi.resetModules();
    const e = await preparerEtablissement();
    const actions = await import("@/data/comptesAdmin");
    const mails = await import("@/data/mailEnvoyeStore");
    const portails = await import("@/data/portalAccessStore");
    await actions.creerCompte(
      { role: "admin", prenom: "Aminata", nom: "NDIAYE", identifier: "SEC-2", email: "a.ndiaye@ucao.edu", password: "Provisoire1" },
      e.admin.id,
    );
    const compte = e.S.getUserAccounts().find((u) => u.identifier === "SEC-2")!;
    expect(compte.doitChangerMotDePasse).toBe(true);
    await actions.definirCompteActif(compte.id, false, e.admin.id);
    expect(e.S.getUserAccountById(compte.id)?.actif).toBe(false);
    const { code } = await actions.genererCodePin(compte, { id: e.admin.id, name: "Administrateur" });
    expect(code).toMatch(/^\d{6}$/);
    expect(mails.getMailsEnvoyes()[0]?.message).toContain(code);
    await actions.definirPortail("student", false);
    expect(portails.isPortalActif("student")).toBe(false);
    await expect(actions.definirPortail("admin", false)).rejects.toThrow("ne peut pas être désactivé");
  });
});
