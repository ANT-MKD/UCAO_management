import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { alertesService, formatTaille, type EtatService } from "@/lib/etatService";
import { BandeauService, VueEspaceService } from "@/components/admin/EtatServicePanels";

const MAINTENANT = new Date("2026-11-10T08:00:00Z");
/** État d'un projet sain : 42 Mo de base, 120 Mo de fichiers, visite ce matin. */
const SAIN: EtatService = {
  baseOctets: 42_000_000, baseLimite: 500_000_000,
  fichiersOctets: 120_000_000, fichiersNombre: 310, fichiersLimite: 1_000_000_000,
  derniereVeille: "2026-11-10T06:17:00Z",
  derniereSauvegarde: "2026-11-07T16:00:00Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.doUnmock("@supabase/supabase-js");
});

describe("alertes de l'offre gratuite", () => {
  it("projet sain : aucune alerte", () => {
    expect(alertesService(SAIN, MAINTENANT)).toEqual([]);
  });

  it("base à 82 % : attention, avec les tailles et la conséquence", () => {
    const [a] = alertesService({ ...SAIN, baseOctets: 412_000_000 }, MAINTENANT);
    expect(a.niveau).toBe("attention");
    expect(a.message).toContain("412 Mo sur 500 Mo (82 %)");
    expect(a.message).toContain("lecture seule");
  });

  it("à 79 % rien ; à 95 % critique, placé avant les autres alertes", () => {
    expect(alertesService({ ...SAIN, baseOctets: 395_000_000 }, MAINTENANT)).toEqual([]);
    const alertes = alertesService({ ...SAIN, fichiersOctets: 850_000_000, baseOctets: 475_000_000 }, MAINTENANT);
    expect(alertes.map((a) => [a.niveau, a.titre])).toEqual([
      ["critique", "Base de données presque pleine"],
      ["attention", "Espace des fichiers presque plein"],
    ]);
    expect(alertes[1].message).toContain("850 Mo sur 1 Go (85 %)");
    const inverse = alertesService({ ...SAIN, baseOctets: 410_000_000, fichiersOctets: 980_000_000 }, MAINTENANT);
    expect(inverse.map((a) => a.niveau)).toEqual(["critique", "attention"]);
  });

  it("visite quotidienne : jamais passée, ou plus de 48 heures, alerte ; 47 heures, rien", () => {
    expect(alertesService({ ...SAIN, derniereVeille: null }, MAINTENANT)[0].message).toContain("n'a encore jamais eu lieu");
    const retard = alertesService({ ...SAIN, derniereVeille: "2026-11-08T07:00:00Z" }, MAINTENANT);
    expect(retard[0].titre).toBe("Visite quotidienne arrêtée");
    expect(retard[0].message).toContain("Dernière visite quotidienne le 08/11/2026");
    expect(retard[0].message).toContain("Settings → Cron Jobs");
    expect(alertesService({ ...SAIN, derniereVeille: "2026-11-08T09:00:00Z" }, MAINTENANT)).toEqual([]);
  });

  it("sauvegarde : rappel après 7 jours, critique après 30 jours ou s'il n'y en a jamais eu", () => {
    expect(alertesService({ ...SAIN, derniereSauvegarde: "2026-11-04T09:00:00Z" }, MAINTENANT)).toEqual([]);
    const [rappel] = alertesService({ ...SAIN, derniereSauvegarde: "2026-11-02T07:00:00Z" }, MAINTENANT);
    expect(rappel).toMatchObject({ niveau: "attention", titre: "Sauvegarde à faire" });
    expect(rappel.message).toContain("il y a 8 jours");
    expect(rappel.message).toContain("Sécurité → Données et sauvegarde");
    expect(alertesService({ ...SAIN, derniereSauvegarde: "2026-10-10T07:00:00Z" }, MAINTENANT)[0].niveau).toBe("critique");
    const [jamais] = alertesService({ ...SAIN, derniereSauvegarde: null }, MAINTENANT);
    expect(jamais).toMatchObject({ niveau: "critique" });
    expect(jamais.message).toContain("Aucune sauvegarde n'a encore été faite");
  });

  it("tailles en unités décimales, comme les limites de l'offre", () => {
    expect(formatTaille(500_000_000)).toBe("500 Mo");
    expect(formatTaille(1_000_000_000)).toBe("1 Go");
    expect(formatTaille(1_250_000_000)).toBe("1,25 Go");
    expect(formatTaille(150_000)).toBe("150 Ko");
  });
});

describe("affichage pour l'administrateur principal", () => {
  it("le bandeau du tableau de bord n'apparaît que s'il y a quelque chose à faire", () => {
    expect(renderToStaticMarkup(createElement(BandeauService, { etat: SAIN, maintenant: MAINTENANT }))).toBe("");
    const html = renderToStaticMarkup(createElement(BandeauService, { etat: { ...SAIN, fichiersOctets: 960_000_000 }, maintenant: MAINTENANT }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Espace des fichiers presque plein");
    expect(html).toContain("bg-red-50");
  });

  it("l'encadré de la page des données montre les deux jauges et la dernière visite", () => {
    const html = renderToStaticMarkup(createElement(VueEspaceService, { etat: SAIN, maintenant: MAINTENANT }));
    expect(html).toContain("42 Mo sur 500 Mo");
    expect(html).toContain("120 Mo sur 1 Go");
    expect(html).toContain("310 fichiers");
    expect(html).toContain('aria-valuenow="42000000"');
    expect(html).toContain("Dernière visite quotidienne");
    expect(html).not.toContain('role="alert"');
  });

  it("l'état est lu dans la base ; un refus (compte sans accès complet) n'affiche rien", async () => {
    for (const [reponse, attendu] of [
      [{ data: { base_octets: 42000000, base_limite: 500000000, fichiers_octets: 0, fichiers_nombre: 0, fichiers_limite: 1000000000, derniere_veille: null }, error: null },
        { baseOctets: 42000000, baseLimite: 500000000, fichiersOctets: 0, fichiersNombre: 0, fichiersLimite: 1000000000, derniereVeille: null, derniereSauvegarde: null }],
      [{ data: null, error: { message: "L'état du service est réservé à un administrateur à accès complet." } }, null],
    ] as const) {
      vi.resetModules();
      vi.stubEnv("VITE_SUPABASE_URL", "https://exemple.supabase.co");
      vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_essai");
      const rpc = vi.fn(async () => reponse);
      vi.doMock("@supabase/supabase-js", async (original) => ({
        ...(await original<typeof import("@supabase/supabase-js")>()),
        createClient: () => ({ rpc, auth: { getSession: async () => ({ data: { session: null } }) } }),
      }));
      const { lireEtatService } = await import("@/lib/etatService");
      expect(await lireEtatService()).toEqual(attendu);
      expect(rpc).toHaveBeenCalledWith("etat_service");
    }
  });
});

describe("visite quotidienne (fonction Vercel /api/veille)", () => {
  const base = () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://mrexzmmkvcusfpqhpowk.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_essai");
  };
  const appel = (entetes: Record<string, string> = {}) => new Request("https://ucao-kairos.vercel.app/api/veille", { headers: entetes });

  it("appelle la fonction veille de la base avec la clé publique seulement", async () => {
    base();
    const fetchFn = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetchFn);
    const { GET } = await import("../../api/veille");
    const reponse = await GET(appel());
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true, courriels: "ok" });
    expect(fetchFn).toHaveBeenNthCalledWith(1, "https://mrexzmmkvcusfpqhpowk.supabase.co/rest/v1/rpc/veille", {
      method: "POST", headers: { apikey: "sb_publishable_essai", "Content-Type": "application/json" }, body: "{}",
    });
    expect(fetchFn).toHaveBeenNthCalledWith(2, "https://mrexzmmkvcusfpqhpowk.supabase.co/functions/v1/courriels", {
      method: "POST", headers: { apikey: "sb_publishable_essai", "Content-Type": "application/json" }, body: '{"action":"envoyer"}',
    });
  });

  it("la file des e-mails ne fait jamais échouer la visite : son état est seulement rapporté", async () => {
    base();
    const { GET } = await import("../../api/veille");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.endsWith("/courriels") ? new Response("{}", { status: 500 }) : new Response("{}", { status: 200 }))));
    let reponse = await GET(appel());
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true, courriels: "réponse 500" });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { if (url.endsWith("/courriels")) throw new TypeError("fetch failed"); return new Response("{}"); }));
    reponse = await GET(appel());
    expect(await reponse.json()).toEqual({ ok: true, courriels: "injoignable" });
    const veilleSeule = vi.fn(async () => new Response("pause", { status: 503 }));
    vi.stubGlobal("fetch", veilleSeule);
    expect((await GET(appel())).status).toBe(502);
    expect(veilleSeule).toHaveBeenCalledTimes(1);
  });

  it("avec CRON_SECRET, un appel sans le bon jeton est refusé sans toucher à la base", async () => {
    base();
    vi.stubEnv("CRON_SECRET", "secret-de-la-tache");
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFn);
    const { GET } = await import("../../api/veille");
    expect((await GET(appel())).status).toBe(401);
    expect((await GET(appel({ authorization: "Bearer autre" }))).status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
    expect((await GET(appel({ authorization: "Bearer secret-de-la-tache" }))).status).toBe(200);
  });

  it("base non configurée, refusée ou injoignable : échec visible dans le suivi des tâches Vercel", async () => {
    const { GET } = await import("../../api/veille");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect((await GET(appel())).status).toBe(500);
    base();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("pause", { status: 503 })));
    const refus = await GET(appel());
    expect(refus.status).toBe(502);
    expect(await refus.json()).toEqual({ ok: false, erreur: "Base : réponse 503" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    expect((await GET(appel())).status).toBe(502);
  });
});
