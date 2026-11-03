import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resumeLivraison, type EtatCourriels } from "@/lib/courriels";
import { VueEtatCourriels } from "@/components/admin/CourrielsPanel";

/** Base imitée : fonction serveur « courriels » et suivi des e-mails. */
async function avecBase() {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://mrexzmmkvcusfpqhpowk.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_essai");
  const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }));
  const rpc = vi.fn(async () => ({ data: { "mail-1": { envoyes: 12, en_attente: 3, refuses: 1, ignores: 0, motif: "Refusé par Resend : Invalid `to` field." } }, error: null }));
  vi.doMock("@supabase/supabase-js", async (original) => ({
    ...(await original<typeof import("@supabase/supabase-js")>()),
    createClient: () => ({ functions: { invoke }, rpc, auth: { getSession: async () => ({ data: { session: null } }) } }),
  }));
  let liberer: () => void = () => {};
  const attente = vi.fn(() => new Promise<void>((ok) => { liberer = ok; }));
  vi.doMock("@/lib/miroirServeur", () => ({ attendreEnvois: attente }));
  return { invoke, rpc, attente, liberer: () => liberer(), courriels: await import("@/lib/courriels") };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@supabase/supabase-js");
  vi.doUnmock("@/lib/miroirServeur");
});

describe("envoi des e-mails après un mail (avec la base)", () => {
  it("attend que les envois du poste soient arrivés, puis vide la file ; des appels rapprochés n'en font que deux", async () => {
    const { invoke, attente, liberer, courriels } = await avecBase();
    const premier = courriels.declencherEnvoiCourriels();
    void courriels.declencherEnvoiCourriels();
    void courriels.declencherEnvoiCourriels();
    await vi.waitFor(() => expect(attente).toHaveBeenCalledTimes(1));
    expect(invoke).not.toHaveBeenCalled();
    liberer();
    await vi.waitFor(() => expect(attente).toHaveBeenCalledTimes(2));
    liberer();
    await premier;
    expect(invoke.mock.calls).toEqual([
      ["courriels", { body: { action: "envoyer" } }],
      ["courriels", { body: { action: "envoyer" } }],
    ]);
  });

  it("un mail envoyé, validé, ou une relance déclenche l'envoi des e-mails", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_SUPABASE_URL", "https://mrexzmmkvcusfpqhpowk.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_essai");
    const declencher = vi.fn(async () => {});
    vi.doMock("@/lib/courriels", () => ({ declencherEnvoiCourriels: declencher }));
    try {
      const mails = await import("@/data/mailEnvoyeStore");
      mails.envoyerMail({ auteurId: "00000000-0000-4000-8000-0000000000e1", auteurLabel: "Ibrahima FALL", selections: [],
        emailsSupplementaires: ["parents.kane@exemple.sn"], objet: "Rentrée", message: "Lundi.", fichiers: [] });
      expect(declencher).toHaveBeenCalledTimes(1);
      mails.envoyerMailSysteme({ destinataireUserId: "u-awa", destinataireLabel: "Awa SECK", destinataireEmail: "awa@exemple.sn", objet: "Identifiant", message: "…" });
      expect(declencher).toHaveBeenCalledTimes(2);
    } finally {
      vi.doUnmock("@/lib/courriels");
    }
  });

  it("le suivi par mail est lu dans la base et résumé", async () => {
    const { rpc, courriels } = await avecBase();
    const livraisons = await courriels.lireLivraisons(["mail-1", "mail-2"]);
    expect(rpc).toHaveBeenCalledWith("livraison_courriels", { p_mails: ["mail-1", "mail-2"] });
    expect(courriels.resumeLivraison(livraisons["mail-1"])).toBe("12 envoyés · 3 en attente · 1 refusé");
    expect(courriels.resumeLivraison(livraisons["mail-2"])).toBe("—");
    expect(resumeLivraison({ envoyes: 0, en_attente: 0, refuses: 0, ignores: 2 })).toBe("2 non envoyés");
  });
});

describe("encadré « E-mails (Resend) »", () => {
  const ETAT: EtatCourriels = {
    configure: true, expediteur: "EduManage <onboarding@resend.dev>", domaine_propre: false, alertes: "direction@exemple.sn",
    file: { en_attente: 2, envoyes: 5, refuses: 1, ignores: 40 }, motifs: [{ motif: "Envoi des mails par e-mail pas encore ouvert", nombre: 40 }],
  };

  it("sans clé : dit que l'envoi n'est pas réglé et où se trouve la procédure", () => {
    const html = renderToStaticMarkup(createElement(VueEtatCourriels, { etat: { ...ETAT, configure: false } }));
    expect(html).toContain("Envoi d&#x27;e-mails non réglé");
    expect(html).toContain("RESEND_API_KEY");
    expect(html).toContain("MISE-EN-LIGNE.md");
  });

  it("adresse d'essai : seules les alertes partent ; bilan de la semaine et motifs", () => {
    const html = renderToStaticMarkup(createElement(VueEtatCourriels, { etat: ETAT }));
    expect(html).toContain("seules les alertes du service partent");
    expect(html).toContain("direction@exemple.sn");
    expect(html).toContain("5 envoyés, 1 refusé, 40 non envoyés ; en attente : 2.");
    expect(html).toContain("Envoi des mails par e-mail pas encore ouvert (40)");
  });

  it("domaine de l'établissement et adresse des alertes manquante", () => {
    const html = renderToStaticMarkup(createElement(VueEtatCourriels, {
      etat: { ...ETAT, expediteur: "UCAO <noreply@mail.ucao.sn>", domaine_propre: true, alertes: null, motifs: [] },
    }));
    expect(html).toContain("les mails partent aussi par e-mail à leurs destinataires");
    expect(html).toContain("Adresse des alertes non réglée (EDUMANAGE_ALERTES)");
  });
});
