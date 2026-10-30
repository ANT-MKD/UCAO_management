import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompteServeur } from "@/lib/comptesServeur";

const AWA: CompteServeur = {
  id: "00000000-0000-4000-8000-00000000000e",
  type_compte: "etudiant",
  identifiant: "2026-LQHSE-0001",
  nom_affiche: "Awa SECK",
  email: "awa.seck@mail.sn",
  lien_id: "et-awa",
  role_id: null,
  actif: true,
  doit_changer_mot_de_passe: true,
};

/** Faux serveur Supabase : réponses des fonctions serveur et lignes lues par l'application. */
async function avecFauxServeur(options: {
  reponse: () => Promise<{ data: unknown; error: unknown }>;
  compte?: CompteServeur | null;
  portail?: { ouvert: boolean; message: string };
}) {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://exemple.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_essai");
  const lignes: Record<string, unknown> = {
    comptes: options.compte === undefined ? AWA : options.compte,
    portails: options.portail ?? { ouvert: true, message: "" },
  };
  const client = {
    functions: { invoke: vi.fn(options.reponse) },
    auth: {
      setSession: vi.fn(async () => ({ error: null })),
      getSession: vi.fn(async () => ({ data: { session: { user: { id: AWA.id } } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: lignes[table], error: null }) }) }) }),
  };
  vi.doMock("@supabase/supabase-js", async (original) => ({
    ...(await original<typeof import("@supabase/supabase-js")>()),
    createClient: () => client,
  }));
  const { FunctionsHttpError } = await import("@supabase/supabase-js");
  return { client, FunctionsHttpError, serveur: await import("@/lib/comptesServeur"), lib: await import("@/lib/supabase") };
}

function refus(Erreur: new (contexte: unknown) => Error, statut: number, message: string) {
  return async () => ({ data: null, error: new Erreur(new Response(JSON.stringify({ message }), { status: statut })) });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@supabase/supabase-js");
});

describe("comptes sur le serveur (partie 2)", () => {
  it("sans adresse de projet, l'application reste sur ses données locales", async () => {
    vi.resetModules();
    const { modeSupabase } = await import("@/lib/supabase");
    expect(modeSupabase).toBe(false);
  });

  it("le compte d'Awa SECK devient une étudiante du portail Étudiants", async () => {
    const { utilisateurDuCompte } = await import("@/lib/comptesServeur");
    expect(utilisateurDuCompte(AWA)).toEqual({
      id: AWA.id, name: "Awa SECK", email: "awa.seck@mail.sn", role: "student", identifier: "2026-LQHSE-0001",
      linkedId: "et-awa", roleId: undefined, doitChangerMotDePasse: true,
    });
    expect(utilisateurDuCompte({ ...AWA, type_compte: "enseignant", nom_affiche: "Mamadou KANE" }).role).toBe("teacher");
    expect(utilisateurDuCompte({ ...AWA, type_compte: "administration", role_id: "role-secretariat" }).roleId).toBe("role-secretariat");
  });

  it("Awa se connecte avec son matricule : la session reçue est ouverte dans le navigateur", async () => {
    const { client, serveur } = await avecFauxServeur({ reponse: async () => ({ data: { access_token: "a", refresh_token: "r" }, error: null }) });
    expect(await serveur.connecterServeur("2026-lqhse-0001", "provisoire")).toEqual(AWA);
    expect(client.functions.invoke).toHaveBeenCalledWith("connexion", {
      body: { action: "connecter", identifiant: "2026-lqhse-0001", mot_de_passe: "provisoire" },
    });
    expect(client.auth.setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
  });

  it("identifiants incorrects : aucune session, pas d'erreur (« Identifiants incorrects. »)", async () => {
    const f = await avecFauxServeur({ reponse: async () => ({ data: null, error: null }) });
    f.client.functions.invoke.mockImplementation(refus(f.FunctionsHttpError, 401, "Identifiants incorrects."));
    expect(await f.serveur.connecterServeur("2026-LQHSE-0001", "mauvais")).toBeNull();
    expect(f.client.auth.setSession).not.toHaveBeenCalled();
  });

  it("verrouillage : le message du serveur est montré tel quel", async () => {
    const f = await avecFauxServeur({ reponse: async () => ({ data: null, error: null }) });
    f.client.functions.invoke.mockImplementation(refus(f.FunctionsHttpError, 429, "Trop de tentatives échouées. Réessayez dans 15 minute(s)."));
    const erreur = await f.serveur.connecterServeur("PROF-KANE", "mauvais").catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(f.lib.ErreurServeur);
    expect((erreur as Error).message).toBe("Trop de tentatives échouées. Réessayez dans 15 minute(s).");
    expect((erreur as InstanceType<typeof f.lib.ErreurServeur>).statut).toBe(429);
  });

  it("portail fermé entre-temps : la session est refermée avec le message de l'administration", async () => {
    const { client, serveur } = await avecFauxServeur({
      reponse: async () => ({ data: { access_token: "a", refresh_token: "r" }, error: null }),
      portail: { ouvert: false, message: "Saisie des notes en cours" },
    });
    await expect(serveur.connecterServeur("2026-LQHSE-0001", "provisoire"))
      .rejects.toThrow("Le portail Étudiants est actuellement fermé : Saisie des notes en cours. Contactez l'administration.");
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it("compte désactivé : la session retrouvée au chargement est refusée", async () => {
    const { serveur } = await avecFauxServeur({ reponse: async () => ({ data: null, error: null }), compte: { ...AWA, actif: false } });
    expect(await serveur.compteDeLaSession()).toEqual({ refus: "Ce compte a été désactivé. Contactez l'administration de l'établissement." });
  });

  it("serveur injoignable : message clair plutôt qu'une erreur technique", async () => {
    const { serveur } = await avecFauxServeur({ reponse: async () => ({ data: null, error: new Error("Failed to fetch") }) });
    await expect(serveur.demanderCodeServeur("2026-LQHSE-0001")).rejects.toThrow("Le serveur est injoignable. Vérifiez votre connexion internet.");
  });

  it("changement volontaire : un mauvais mot de passe actuel répond « incorrect », pas une erreur", async () => {
    const f = await avecFauxServeur({ reponse: async () => ({ data: null, error: null }) });
    f.client.functions.invoke.mockImplementation(refus(f.FunctionsHttpError, 400, "Mot de passe actuel incorrect."));
    expect(await f.serveur.changerMonMotDePasse(AWA.id, "mauvais", "Nouveau2026")).toBe(false);
    f.client.functions.invoke.mockImplementation(async () => ({ data: { ok: true }, error: null }));
    expect(await f.serveur.changerMonMotDePasse(AWA.id, "provisoire", "Nouveau2026")).toBe(true);
    expect(f.client.functions.invoke).toHaveBeenLastCalledWith("comptes", {
      body: { action: "changer_mot_de_passe", nouveau: "Nouveau2026", actuel: "provisoire" },
    });
  });

  it("le compte connecté est recopié localement pour les écrans pas encore branchés, sans mot de passe local", async () => {
    vi.resetModules();
    const S = await import("@/data/studentStore");
    S.refleterCompteServeur({
      id: "00000000-0000-4000-8000-00000000000a", role: "admin", email: "f.diop@ucao.edu", identifier: "ADM-PRINCIPAL",
      displayName: "Fatou DIOP", actif: true, doitChangerMotDePasse: false,
    });
    expect(S.aAccesComplet("00000000-0000-4000-8000-00000000000a")).toBe(true);
    expect(S.authenticateUser("ADM-PRINCIPAL", "")).toBeNull();
    S.refleterCompteServeur({
      id: "00000000-0000-4000-8000-00000000000a", role: "admin", email: "f.diop@ucao.edu", identifier: "ADM-PRINCIPAL",
      displayName: "Fatou DIOP", roleId: "role-secretariat", actif: true, doitChangerMotDePasse: false,
    });
    expect(S.getUserAccounts().filter((u) => u.identifier === "ADM-PRINCIPAL")).toHaveLength(1);
    expect(S.aAccesComplet("00000000-0000-4000-8000-00000000000a")).toBe(false);
  });
});
