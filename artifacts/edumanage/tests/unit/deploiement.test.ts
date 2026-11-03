import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { erreursDeConfiguration } from "@/lib/verificationDeploiement";

const URL_BASE = "https://mrexzmmkvcusfpqhpowk.supabase.co";
const CLE_PUBLIQUE = "sb_publishable_qaz0ZX6J2mJsBuT9fOuA5w_PB-C8Tfs";
/** Ancienne clé au format JWT (en-tête.charge.signature), pour le rôle donné. */
const jeton = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ iss: "supabase", role })).replace(/=+$/, "")}.signature`;

describe("contrôle de la configuration à la construction", () => {
  it("la configuration de production attendue passe", () => {
    expect(erreursDeConfiguration({ VITE_SUPABASE_URL: URL_BASE, VITE_SUPABASE_PUBLISHABLE_KEY: CLE_PUBLIQUE, VERCEL_ENV: "production" })).toEqual([]);
  });

  it("sans variable, hors production (tests, aperçus) : mode navigateur, accepté", () => {
    expect(erreursDeConfiguration({})).toEqual([]);
    expect(erreursDeConfiguration({ VERCEL_ENV: "preview" })).toEqual([]);
  });

  it("production sans base : refusée", () => {
    const [erreur] = erreursDeConfiguration({ VERCEL_ENV: "production" });
    expect(erreur).toContain("La mise en ligne de production exige la base");
  });

  it("clé secrète à la place de la clé publique : refusée, même hors production", () => {
    expect(erreursDeConfiguration({ VITE_SUPABASE_URL: URL_BASE, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abcdef" })[0]).toContain("clé secrète");
    expect(erreursDeConfiguration({ VITE_SUPABASE_URL: URL_BASE, VITE_SUPABASE_PUBLISHABLE_KEY: jeton("service_role") })[0]).toContain("clé secrète");
    expect(erreursDeConfiguration({ VITE_SUPABASE_URL: URL_BASE, VITE_SUPABASE_PUBLISHABLE_KEY: jeton("anon") })).toEqual([]);
  });

  it("une seule des deux variables : refusée", () => {
    expect(erreursDeConfiguration({ VITE_SUPABASE_URL: URL_BASE })[0]).toContain("ou aucune des deux");
    expect(erreursDeConfiguration({ VITE_SUPABASE_PUBLISHABLE_KEY: CLE_PUBLIQUE })[0]).toContain("ou aucune des deux");
  });

  it("adresse de la base mal recopiée : refusée ; base locale de développement acceptée", () => {
    for (const url of [`${URL_BASE}/`, `${URL_BASE}/rest/v1`, "mrexzmmkvcusfpqhpowk.supabase.co", "http://mrexzmmkvcusfpqhpowk.supabase.co"]) {
      expect(erreursDeConfiguration({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: CLE_PUBLIQUE })[0]).toContain("sans chemin ni barre finale");
    }
    expect(erreursDeConfiguration({ VITE_SUPABASE_URL: "http://127.0.0.1:54321", VITE_SUPABASE_PUBLISHABLE_KEY: CLE_PUBLIQUE })).toEqual([]);
  });
});

describe("réglages Vercel (vercel.json)", () => {
  const racine = path.resolve(import.meta.dirname, "../..");
  const vercel = JSON.parse(readFileSync(path.join(racine, "vercel.json"), "utf8")) as {
    installCommand: string; buildCommand: string; outputDirectory: string;
    rewrites: { source: string; destination: string }[];
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  /** Une règle « source » de Vercel, pour les motifs utilisés ici. */
  const motif = (source: string) => new RegExp(`^${source}$`);

  it("publie le dossier que construit Vite", () => {
    expect(readFileSync(path.join(racine, "vite.config.ts"), "utf8")).toContain('"dist/public"');
    expect(vercel.outputDirectory).toBe("dist/public");
  });

  it("une adresse interne (lien direct, page rechargée) ouvre l'application ; un fichier manquant reste introuvable", () => {
    const [regle] = vercel.rewrites;
    expect(regle.destination).toBe("/index.html");
    for (const chemin of ["/", "/login", "/admin/security/pin-activation", "/student/dashboard"]) expect(motif(regle.source).test(chemin)).toBe(true);
    expect(motif(regle.source).test("/assets/index-ancien.js")).toBe(false);
    expect(motif(regle.source).test("/api/veille")).toBe(false);
  });

  it("la visite quotidienne est planifiée une fois par jour (offre gratuite de Vercel)", () => {
    const { crons } = vercel as unknown as { crons: { path: string; schedule: string }[] };
    expect(crons).toEqual([{ path: "/api/veille", schedule: expect.stringMatching(/^\d{1,2} \d{1,2} \* \* \*$/) }]);
    expect(readFileSync(path.join(racine, "api/veille.ts"), "utf8")).toContain("export async function GET");
  });

  it("en-têtes de sécurité sur toutes les pages ; fichiers construits gardés en cache", () => {
    const tout = vercel.headers.find((h) => h.source === "/(.*)")!;
    const valeur = (cle: string) => tout.headers.find((h) => h.key === cle)?.value;
    expect(valeur("X-Content-Type-Options")).toBe("nosniff");
    expect(valeur("X-Frame-Options")).toBe("DENY");
    expect(valeur("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(valeur("X-Robots-Tag")).toContain("noindex");
    expect(valeur("Strict-Transport-Security")).toMatch(/max-age=\d{8}/);
    const cache = vercel.headers.find((h) => h.source === "/assets/(.*)")!.headers[0];
    expect(cache).toEqual({ key: "Cache-Control", value: "public, max-age=31536000, immutable" });
  });

  it("installe avec la même version de pnpm que les vérifications GitHub, sans toucher au fichier de versions", () => {
    const ci = readFileSync(path.resolve(racine, "../../.github/workflows/verifications.yml"), "utf8");
    const majeure = /pnpm\/action-setup@v\d+\s+with:\s+version:\s*(\d+)/.exec(ci)?.[1];
    expect(majeure).toBeTruthy();
    for (const commande of [vercel.installCommand, vercel.buildCommand]) expect(commande).toContain(`pnpm@${majeure}.`);
    expect(vercel.installCommand).toContain("--frozen-lockfile");
  });
});

describe("le contrôle est branché sur la construction (vite.config.ts)", () => {
  it("la construction de production sans base s'arrête ; avec la clé publique, elle passe", async () => {
    const { default: config } = await import("../../vite.config");
    const etape = (config.plugins ?? []).flat().find((p) => p && typeof p === "object" && "name" in p && p.name === "verification-deploiement") as
      { apply?: string; configResolved: (c: { env: Record<string, string> }) => void } | undefined;
    expect(etape?.apply).toBe("build");
    const ancien = process.env.VERCEL_ENV;
    try {
      process.env.VERCEL_ENV = "production";
      expect(() => etape!.configResolved({ env: {} })).toThrow("La mise en ligne de production exige la base");
      expect(() => etape!.configResolved({ env: { VITE_SUPABASE_URL: URL_BASE, VITE_SUPABASE_PUBLISHABLE_KEY: CLE_PUBLIQUE } })).not.toThrow();
      delete process.env.VERCEL_ENV;
      expect(() => etape!.configResolved({ env: {} })).not.toThrow();
    } finally {
      if (ancien === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = ancien;
    }
  });
});
