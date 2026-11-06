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
  const { FunctionsHttpError } = await import("@supabase/supabase-js");
  return {
    client,
    FunctionsHttpError,
    actions: await import("@/data/comptesAdmin"),
    serveur: await import("@/data/comptesServeurStore"),
    mails: await import("@/data/mailEnvoyeStore"),
    etudiants: await import("@/data/studentStore"),
  };
}

const OUSMANE = "00000000-0000-4000-8000-0000000000f2";

/** Fiche d'étudiant minimale pour les codes d'une classe. */
function fiche(id: string, prenom: string, nom: string, matricule: string, classeId: string, statut = "inscrit") {
  return { id, prenom, nom, matricule, classeId, statut, email: "", telephone: "", annee: "2026-2027" } as unknown as import("@/data/studentStore").EtudiantRecord;
}

/** Réponse de la base à generer_codes_pin : un code par compte demandé, dans l'ordre reçu. */
function codesDeLaBase(nom: string, args: Record<string, unknown>) {
  if (nom !== "generer_codes_pin") return { data: null, error: null };
  return {
    data: (args.p_comptes as string[]).map((id, i) => ({
      compte: id, identifiant: `MAT-${i}`, nom_affiche: `Compte ${i}`, code: String(100000 + i), expire_le: "2026-11-09T10:00:00Z",
    })),
    error: null,
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
});

describe("codes PIN pour toute une classe avec Supabase", () => {
  it("L1 QHSE : le compte d'Ousmane est ouvert, puis un seul appel donne les codes d'Ousmane et d'Awa", async () => {
    const { client, actions, mails, etudiants } = await avecBase(codesDeLaBase);
    client.functions.invoke.mockImplementation(async () => ({ data: { id: OUSMANE }, error: null }));
    etudiants.remplacerEtudiants([
      fiche("et-awa", "Awa", "SECK", "2026-LQHSE-0001", "cl-l1"),
      fiche("et-ousmane", "Ousmane", "DIALLO", "2026-LQHSE-0002", "cl-l1"),
      fiche("et-fatou", "Fatou", "SOW", "2026-LQHSE-0003", "cl-l1", "abandon"),
      fiche("et-ibrahima", "Ibrahima", "FALL", "2026-LQHSE-0004", "cl-l2"),
    ]);
    const progression = vi.fn();
    const lignes = await actions.genererCodesClasse("cl-l1", 7, { id: ADMIN, name: "Fatou DIOP" }, progression);

    expect(client.functions.invoke).toHaveBeenCalledTimes(1);
    expect(client.functions.invoke).toHaveBeenCalledWith("comptes", {
      body: expect.objectContaining({ action: "creer", type_compte: "etudiant", identifiant: "2026-LQHSE-0002", nom_affiche: "Ousmane DIALLO", lien_id: "et-ousmane" }),
    });
    const appels = client.rpc.mock.calls.filter(([nom]) => nom === "generer_codes_pin");
    expect(appels).toEqual([["generer_codes_pin", { p_comptes: [OUSMANE, AWA], p_validite_jours: 7 }]]);
    expect(lignes).toEqual([
      { etudiantId: "et-ousmane", matricule: "2026-LQHSE-0002", nomComplet: "DIALLO Ousmane", code: "100000", expireLe: "2026-11-09T10:00:00Z" },
      { etudiantId: "et-awa", matricule: "2026-LQHSE-0001", nomComplet: "SECK Awa", code: "100001", expireLe: "2026-11-09T10:00:00Z" },
    ]);
    expect(progression.mock.calls).toEqual([[0, 2], [2, 2]]);
    expect(mails.getMailsEnvoyes()).toHaveLength(0);
  });

  it("une classe de 120 étudiants part en trois envois (50, 50, 20)", async () => {
    const { client, actions, etudiants } = await avecBase(codesDeLaBase);
    let n = 0;
    client.functions.invoke.mockImplementation(async () => ({ data: { id: `compte-${String(++n).padStart(3, "0")}` }, error: null }));
    etudiants.remplacerEtudiants(Array.from({ length: 120 }, (_, i) =>
      fiche(`et-${i}`, "Prénom", `NOM${String(i).padStart(3, "0")}`, `2026-LQHSE-${String(i).padStart(4, "0")}`, "cl-grande")));
    const progression = vi.fn();
    const lignes = await actions.genererCodesClasse("cl-grande", 3, { id: ADMIN, name: "Fatou DIOP" }, progression);
    const envois = client.rpc.mock.calls.filter(([nom]) => nom === "generer_codes_pin").map(([, a]) => a as { p_comptes: string[]; p_validite_jours: number });
    expect(envois.map((a) => [a.p_comptes.length, a.p_validite_jours])).toEqual([[50, 3], [50, 3], [20, 3]]);
    expect(progression.mock.calls.at(-1)).toEqual([120, 120]);
    expect(lignes.filter((l) => l.code)).toHaveLength(120);
  });

  it("refus de droits : un seul essai d'ouverture, motif pour chacun ; Awa, qui a son compte, reçoit son code", async () => {
    const { client, FunctionsHttpError, actions, etudiants } = await avecBase(codesDeLaBase);
    client.functions.invoke.mockImplementation(async () => ({
      data: null, error: new FunctionsHttpError(new Response(JSON.stringify({ message: "Vous n'avez pas accès à la gestion des comptes." }), { status: 403 })),
    }));
    etudiants.remplacerEtudiants([
      fiche("et-awa", "Awa", "SECK", "2026-LQHSE-0001", "cl-l1"),
      fiche("et-ousmane", "Ousmane", "DIALLO", "2026-LQHSE-0002", "cl-l1"),
      fiche("et-fatou", "Fatou", "SOW", "2026-LQHSE-0003", "cl-l1"),
    ]);
    const lignes = await actions.genererCodesClasse("cl-l1", 7, { id: ADMIN, name: "Fatou DIOP" });
    expect(client.functions.invoke).toHaveBeenCalledTimes(1);
    const motif = "compte non ouvert : Vous n'avez pas accès à la gestion des comptes.";
    expect(lignes.map((l) => [l.nomComplet, l.code, l.motif])).toEqual([
      ["DIALLO Ousmane", null, motif],
      ["SECK Awa", "100000", undefined],
      ["SOW Fatou", null, motif],
    ]);
  });

  it("un refus propre à un étudiant (dossier pas encore dans la base) n'empêche pas d'ouvrir les autres", async () => {
    const { client, FunctionsHttpError, actions, etudiants } = await avecBase(codesDeLaBase);
    client.functions.invoke
      .mockImplementationOnce(async () => ({
        data: null, error: new FunctionsHttpError(new Response(JSON.stringify({ message: "Dossier introuvable." }), { status: 400 })),
      }))
      .mockImplementationOnce(async () => ({ data: { id: OUSMANE }, error: null }));
    etudiants.remplacerEtudiants([
      fiche("et-ousmane", "Ousmane", "DIALLO", "2026-LQHSE-0002", "cl-l1"),
      fiche("et-fatou", "Fatou", "SOW", "2026-LQHSE-0003", "cl-l1"),
    ]);
    const lignes = await actions.genererCodesClasse("cl-l1", 7, { id: ADMIN, name: "Fatou DIOP" });
    expect(client.functions.invoke).toHaveBeenCalledTimes(2);
    expect(lignes.map((l) => [l.nomComplet, l.code, l.motif])).toEqual([
      ["DIALLO Ousmane", null, "compte non ouvert : Dossier introuvable."],
      ["SOW Fatou", "100000", undefined],
    ]);
  });

  it("une classe sans étudiant est refusée avant tout appel", async () => {
    const { client, actions, etudiants } = await avecBase(codesDeLaBase);
    etudiants.remplacerEtudiants([fiche("et-fatou", "Fatou", "SOW", "2026-LQHSE-0003", "cl-l1", "abandon")]);
    await expect(actions.genererCodesClasse("cl-l1", 7, { id: ADMIN, name: "Fatou DIOP" })).rejects.toThrow("Aucun étudiant dans cette classe.");
    expect(client.functions.invoke).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

describe("codes PIN pour quelques étudiants choisis, avec Supabase", () => {
  const classeL1 = () => [
    fiche("et-awa", "Awa", "SECK", "2026-LQHSE-0001", "cl-l1"),
    fiche("et-ousmane", "Ousmane", "DIALLO", "2026-LQHSE-0002", "cl-l1"),
    fiche("et-fatou", "Fatou", "SOW", "2026-LQHSE-0003", "cl-l1", "abandon"),
    fiche("et-ibrahima", "Ibrahima", "FALL", "2026-LQHSE-0004", "cl-l2"),
  ];

  it("seul Ousmane est coché : son compte est ouvert et lui seul reçoit un code, Awa garde le sien", async () => {
    const { client, actions, etudiants } = await avecBase(codesDeLaBase);
    client.functions.invoke.mockImplementation(async () => ({ data: { id: OUSMANE }, error: null }));
    etudiants.remplacerEtudiants(classeL1());
    const lignes = await actions.genererCodesClasse("cl-l1", 3, { id: ADMIN, name: "Fatou DIOP" }, undefined, ["et-ousmane"]);
    expect(client.functions.invoke).toHaveBeenCalledTimes(1);
    expect(client.rpc.mock.calls.filter(([nom]) => nom === "generer_codes_pin"))
      .toEqual([["generer_codes_pin", { p_comptes: [OUSMANE], p_validite_jours: 3 }]]);
    expect(lignes).toEqual([
      { etudiantId: "et-ousmane", matricule: "2026-LQHSE-0002", nomComplet: "DIALLO Ousmane", code: "100000", expireLe: "2026-11-09T10:00:00Z" },
    ]);
  });

  it("un étudiant coché hors de la classe ou en abandon est écarté ; aucun retenu : refus avant tout appel", async () => {
    const { client, actions, etudiants } = await avecBase(codesDeLaBase);
    etudiants.remplacerEtudiants(classeL1());
    const lignes = await actions.genererCodesClasse("cl-l1", 7, { id: ADMIN, name: "Fatou DIOP" }, undefined, ["et-awa", "et-fatou", "et-ibrahima"]);
    expect(lignes.map((l) => l.etudiantId)).toEqual(["et-awa"]);
    expect(client.rpc.mock.calls.filter(([nom]) => nom === "generer_codes_pin"))
      .toEqual([["generer_codes_pin", { p_comptes: [AWA], p_validite_jours: 7 }]]);
    client.rpc.mockClear();
    await expect(actions.genererCodesClasse("cl-l1", 7, { id: ADMIN, name: "Fatou DIOP" }, undefined, ["et-fatou", "et-ibrahima"]))
      .rejects.toThrow("Choisissez au moins un étudiant de la classe.");
    await expect(actions.genererCodesClasse("cl-l1", 7, { id: ADMIN, name: "Fatou DIOP" }, undefined, []))
      .rejects.toThrow("Choisissez au moins un étudiant de la classe.");
    expect(client.rpc).not.toHaveBeenCalledWith("generer_codes_pin", expect.anything());
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });

  it("depuis le dossier d'Awa : un code pour elle seule, à la validité choisie ; refus pour un abandon", async () => {
    const { client, actions, etudiants, mails } = await avecBase(codesDeLaBase);
    etudiants.remplacerEtudiants(classeL1());
    const ligne = await actions.genererCodeEtudiant("et-awa", 1, { id: ADMIN, name: "Fatou DIOP" });
    expect(ligne).toEqual({ etudiantId: "et-awa", matricule: "2026-LQHSE-0001", nomComplet: "SECK Awa", code: "100000", expireLe: "2026-11-09T10:00:00Z" });
    expect(client.rpc.mock.calls.filter(([nom]) => nom === "generer_codes_pin"))
      .toEqual([["generer_codes_pin", { p_comptes: [AWA], p_validite_jours: 1 }]]);
    expect(mails.getMailsEnvoyes()).toHaveLength(0);
    client.rpc.mockClear();
    await expect(actions.genererCodeEtudiant("et-fatou", 1, { id: ADMIN, name: "Fatou DIOP" })).rejects.toThrow("en abandon");
    await expect(actions.genererCodeEtudiant("et-inconnu", 1, { id: ADMIN, name: "Fatou DIOP" })).rejects.toThrow("Étudiant introuvable.");
    expect(client.rpc).not.toHaveBeenCalledWith("generer_codes_pin", expect.anything());
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

  it("codes pour toute une classe : 14 jours, l'ancien code remplacé, aucun pour un compte désactivé", async () => {
    vi.resetModules();
    const e = await preparerEtablissement();
    const actions = await import("@/data/comptesAdmin");
    const pins = await import("@/data/pinActivationStore");
    const mails = await import("@/data/mailEnvoyeStore");
    const [awa, ousmane, fatou] = [e.inscrire("Awa", "SECK"), e.inscrire("Ousmane", "DIALLO"), e.inscrire("Fatou", "SOW")];
    const compteDe = (id: string) => e.S.getUserAccounts().find((u) => u.linkedId === id)!;
    e.S.setUserAccountActif(compteDe(fatou.id).id, false, e.admin.id);
    const ancien = await actions.genererCodePin(compteDe(ousmane.id), { id: e.admin.id, name: "Administrateur" });
    const mailsAvant = mails.getMailsEnvoyes().length;

    const lignes = await actions.genererCodesClasse(e.classe.id, 14, { id: e.admin.id, name: "Administrateur" });
    const classe = lignes.filter((l) => [awa.id, ousmane.id, fatou.id].includes(l.etudiantId));
    expect(classe.map((l) => l.nomComplet)).toEqual(["DIALLO Ousmane", "SECK Awa", "SOW Fatou"]);
    expect(classe[0].code).toMatch(/^\d{6}$/);
    expect(classe[1].code).toMatch(/^\d{6}$/);
    expect(classe[2]).toMatchObject({ code: null, motif: "compte désactivé" });
    const jours = (new Date(classe[1].expireLe!).getTime() - Date.now()) / 86_400_000;
    expect(jours).toBeGreaterThan(13.9);
    expect(jours).toBeLessThanOrEqual(14);
    const tous = pins.getPinsActivation();
    expect(pins.statutPin(tous.find((p) => p.pin === ancien.code && p.userId === compteDe(ousmane.id).id)!, tous)).toBe("remplace");
    expect(mails.getMailsEnvoyes()).toHaveLength(mailsAvant);
  });

  it("seule Awa est cochée : elle reçoit un code, celui d'Ousmane reste actif ; depuis le dossier, Ousmane a le sien pour 24 heures", async () => {
    vi.resetModules();
    const e = await preparerEtablissement();
    const actions = await import("@/data/comptesAdmin");
    const pins = await import("@/data/pinActivationStore");
    const [awa, ousmane] = [e.inscrire("Awa", "SECK"), e.inscrire("Ousmane", "DIALLO")];
    const compteDe = (id: string) => e.S.getUserAccounts().find((u) => u.linkedId === id)!;
    const ancien = await actions.genererCodePin(compteDe(ousmane.id), { id: e.admin.id, name: "Administrateur" });

    const lignes = await actions.genererCodesClasse(e.classe.id, 7, { id: e.admin.id, name: "Administrateur" }, undefined, [awa.id]);
    expect(lignes.map((l) => l.nomComplet)).toEqual(["SECK Awa"]);
    expect(lignes[0].code).toMatch(/^\d{6}$/);
    let tous = pins.getPinsActivation();
    expect(pins.statutPin(tous.find((p) => p.pin === ancien.code && p.userId === compteDe(ousmane.id).id)!, tous)).toBe("actif");

    const ligne = await actions.genererCodeEtudiant(ousmane.id, 1, { id: e.admin.id, name: "Administrateur" });
    expect(ligne).toMatchObject({ etudiantId: ousmane.id, nomComplet: "DIALLO Ousmane" });
    expect(ligne.code).toMatch(/^\d{6}$/);
    const heures = (new Date(ligne.expireLe!).getTime() - Date.now()) / 3_600_000;
    expect(heures).toBeGreaterThan(23.9);
    expect(heures).toBeLessThanOrEqual(24);
    tous = pins.getPinsActivation();
    expect(pins.statutPin(tous.find((p) => p.pin === ancien.code && p.userId === compteDe(ousmane.id).id)!, tous)).toBe("remplace");
    expect(pins.statutPin(tous.find((p) => p.pin === lignes[0].code && p.userId === compteDe(awa.id).id)!, tous)).toBe("actif");
  });
});

describe("liste imprimée des codes d'une classe", () => {
  it("donne la marche à suivre, le matricule et le code de chacun ; un nom ne peut pas injecter de HTML", async () => {
    vi.resetModules();
    const { htmlCodesClasse } = await import("@/lib/impressionCodes");
    const html = htmlCodesClasse("L1 QHSE <A>", [
      { etudiantId: "et-ousmane", matricule: "2026-LQHSE-0002", nomComplet: "DIALLO Ousmane", code: "482913", expireLe: "2026-11-09T10:00:00Z" },
      { etudiantId: "et-x", matricule: "2026-LQHSE-0009", nomComplet: "<img src=x onerror=alert(1)>", code: "130597", expireLe: "2026-11-09T10:00:00Z" },
      { etudiantId: "et-fatou", matricule: "2026-LQHSE-0003", nomComplet: "SOW Fatou", code: null, expireLe: null, motif: "compte désactivé" },
    ], "https://edumanage.vercel.app");
    expect(html).toContain("https://edumanage.vercel.app");
    expect(html).toContain("« Mot de passe oublié ? », puis sur « J'ai déjà un code »");
    expect(html).toContain("codes valables jusqu'au 09/11/2026");
    expect(html).toMatch(/2026-LQHSE-0002<\/td>\s*<td>DIALLO Ousmane<\/td>\s*<td class="code">482913<\/td>/);
    expect(html).toContain("<em>compte désactivé</em>");
    expect(html).toContain("Codes d'accès à EduManage — L1 QHSE &lt;A&gt;</h1>");
    expect(html).not.toContain("L1 QHSE <A>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
    expect(html).toContain("Signature");
  });
});
