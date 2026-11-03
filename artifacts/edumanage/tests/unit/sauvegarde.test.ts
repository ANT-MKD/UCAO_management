import { act } from "react";
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lireSauvegarde, type EntreeSauvegarde } from "@/lib/archiveSauvegarde";

const PHRASE = "baobab lagune pirogue 2026";
const SCRIPT = "SET session_replication_role = replica;\nCOPY public.etudiants (id, nom) FROM stdin;\net-awa\tSECK\n\\.\n\n-- Fin de la sauvegarde.\n";
const FICHIERS = [
  { espace: "pieces-etudiants", chemin: "etudiants/et-awa/photo.jpg", taille: 3, type: "image/jpeg", url: "https://stockage.essai/sign/photo?token=t" },
  { espace: "documents", chemin: "releves/kane.pdf", taille: 4, type: "application/pdf", url: "https://stockage.essai/sign/releve?token=t" },
];
const CONTENUS: Record<string, number[]> = { "https://stockage.essai/sign/photo?token=t": [1, 2, 3], "https://stockage.essai/sign/releve?token=t": [4, 5, 6, 7] };

/** Base imitée : fonction serveur « sauvegarde » et état du service. */
async function avecBase(options: { script?: string; manquant?: string } = {}) {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://mrexzmmkvcusfpqhpowk.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_essai");
  const invoke = vi.fn(async (_nom: string, { body }: { body: Record<string, unknown> }) => {
    if (body.action === "fichiers") return { data: { fichiers: FICHIERS }, error: null };
    if (body.action === "donnees") return { data: options.script ?? SCRIPT, error: null };
    return { data: { ok: true }, error: null };
  });
  const rpc = vi.fn(async () => ({
    data: { base_octets: 42000000, base_limite: 500000000, fichiers_octets: 7, fichiers_nombre: 2, fichiers_limite: 1000000000,
      derniere_veille: new Date().toISOString(), derniere_sauvegarde: null }, error: null,
  }));
  vi.doMock("@supabase/supabase-js", async (original) => ({
    ...(await original<typeof import("@supabase/supabase-js")>()),
    createClient: () => ({ functions: { invoke }, rpc, auth: { getSession: async () => ({ data: { session: null } }) } }),
  }));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => (url === options.manquant
    ? new Response("introuvable", { status: 404 })
    : new Response(new Uint8Array(CONTENUS[url]), { status: 200 }))));
  return { invoke, rpc, module: await import("@/lib/sauvegarde") };
}

async function relire(blob: Blob, phrase = PHRASE): Promise<EntreeSauvegarde[]> {
  const entrees: EntreeSauvegarde[] = [];
  for await (const e of lireSauvegarde(new Uint8Array(await blob.arrayBuffer()), phrase)) entrees.push(e);
  return entrees;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.doUnmock("@supabase/supabase-js");
});

describe("sauvegarde chiffrée (navigateur de l'administrateur principal)", () => {
  it("réunit manifeste, données et fichiers dans un fichier chiffré, puis note la sauvegarde", async () => {
    const { invoke, module } = await avecBase();
    const etapes: string[] = [];
    const maintenant = new Date(2026, 10, 3, 14, 5);
    const faite = await module.faireSauvegarde(PHRASE, (e) => etapes.push(`${e.etape} ${e.fait}/${e.total}`), { iterations: 1000, maintenant });
    expect(faite.nom).toBe("edumanage-sauvegarde-2026-11-03-14h05.edumanage");
    expect(faite.fichiers).toBe(2);
    expect(faite.octets).toBe(faite.blob.size);
    expect(etapes).toEqual(["liste 0/1", "donnees 0/1", "fichiers 0/2", "fichiers 1/2", "fichiers 2/2", "fin 1/1"]);
    expect(invoke.mock.calls.map(([nom, { body }]) => [nom, body.action])).toEqual([
      ["sauvegarde", "fichiers"], ["sauvegarde", "donnees"], ["sauvegarde", "noter"],
    ]);
    expect(invoke.mock.calls[2][1].body).toEqual({ action: "noter", octets: faite.blob.size, fichiers: 2 });

    const entrees = await relire(faite.blob);
    expect(entrees.map((e) => e.nom)).toEqual(["manifeste.json", "donnees.sql", "fichiers/pieces-etudiants/etudiants/et-awa/photo.jpg", "fichiers/documents/releves/kane.pdf"]);
    const manifeste = JSON.parse(new TextDecoder().decode(entrees[0].contenu));
    expect(manifeste).toEqual({
      format: 1, application: "EduManage", cree_le: maintenant.toISOString(), projet: "mrexzmmkvcusfpqhpowk.supabase.co",
      donnees_octets: new TextEncoder().encode(SCRIPT).length,
      fichiers: FICHIERS.map(({ espace, chemin, taille, type }) => ({ espace, chemin, taille, type })),
    });
    expect(new TextDecoder().decode(entrees[1].contenu)).toBe(SCRIPT);
    expect([...entrees[2].contenu]).toEqual([1, 2, 3]);
    expect([...entrees[3].contenu]).toEqual([4, 5, 6, 7]);
    expect(JSON.stringify(manifeste)).not.toContain("token");
  });

  it("copie des données interrompue : pas de sauvegarde, rien de noté", async () => {
    const { invoke, module } = await avecBase({ script: SCRIPT.replace("-- Fin de la sauvegarde.\n", "") });
    await expect(module.faireSauvegarde(PHRASE, () => {}, { iterations: 1000 })).rejects.toThrow("interrompue");
    expect(invoke.mock.calls.some(([, { body }]) => body.action === "noter")).toBe(false);
  });

  it("un fichier introuvable : pas de sauvegarde partielle, rien de noté", async () => {
    const { invoke, module } = await avecBase({ manquant: "https://stockage.essai/sign/releve?token=t" });
    await expect(module.faireSauvegarde(PHRASE, () => {}, { iterations: 1000 })).rejects.toThrow("documents/releves/kane.pdf");
    expect(invoke.mock.calls.some(([, { body }]) => body.action === "noter")).toBe(false);
  });

  it("phrase trop courte : refusée avant tout appel au serveur", async () => {
    const { invoke, module } = await avecBase();
    await expect(module.faireSauvegarde("trop court", () => {}, { iterations: 1000 })).rejects.toThrow("au moins 12 caractères");
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("encadré « Sauvegarde chiffrée »", () => {
  /** Saisie dans un champ contrôlé par React. */
  function saisir(champ: HTMLInputElement, valeur: string) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("le bouton n'est actif qu'avec deux phrases identiques assez longues et la case cochée ; le fichier se télécharge", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { invoke } = await avecBase();
    const telechargements: string[] = [];
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:essai", revokeObjectURL: () => {} }));
    const clic = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { telechargements.push(this.download); });
    const { SauvegardeEtEspace } = await import("@/components/admin/SauvegardePanel");
    const archive = await import("@/lib/archiveSauvegarde");
    const ouvrir = archive.EcrivainSauvegarde.ouvrir.bind(archive.EcrivainSauvegarde);
    vi.spyOn(archive.EcrivainSauvegarde, "ouvrir").mockImplementation((phrase, options) => ouvrir(phrase, { ...options, iterations: 1000 }));

    const hote = document.createElement("div");
    document.body.appendChild(hote);
    const racine = createRoot(hote);
    await act(async () => { racine.render(createElement(SauvegardeEtEspace)); });
    await act(async () => {});
    const q = (id: string) => hote.querySelector(`[data-testid="${id}"]`) as HTMLInputElement & HTMLButtonElement;
    expect(hote.textContent).toContain("Aucune sauvegarde n'a encore été faite.");
    expect(hote.textContent).toContain("Espace occupé");

    await act(async () => { q("sauvegarde-ouvrir").click(); });
    const lancer = () => q("sauvegarde-lancer");
    expect(lancer().disabled).toBe(true);
    await act(async () => { saisir(q("sauvegarde-phrase"), "court"); });
    expect(hote.textContent).toContain("au moins 12 caractères");
    await act(async () => { saisir(q("sauvegarde-phrase"), PHRASE); saisir(q("sauvegarde-confirmation"), PHRASE + "x"); });
    expect(hote.textContent).toContain("Les deux phrases ne sont pas identiques.");
    await act(async () => { saisir(q("sauvegarde-confirmation"), PHRASE); });
    expect(lancer().disabled).toBe(true);
    await act(async () => { q("sauvegarde-notee").click(); });
    expect(lancer().disabled).toBe(false);
    await act(async () => { saisir(q("sauvegarde-confirmation"), PHRASE.toUpperCase()); });
    expect(lancer().disabled).toBe(true);
    await act(async () => { saisir(q("sauvegarde-confirmation"), PHRASE); });
    expect(lancer().disabled).toBe(false);

    await act(async () => { lancer().click(); });
    await vi.waitFor(() => expect(q("sauvegarde-faite")).not.toBeNull());
    expect(telechargements).toHaveLength(1);
    expect(telechargements[0]).toMatch(/^edumanage-sauvegarde-\d{4}-\d{2}-\d{2}-\d{2}h\d{2}\.edumanage$/);
    expect(q("sauvegarde-faite").textContent).toContain("2 fichiers");
    // L'encadré lit aussi l'état des e-mails (« etat ») ; la sauvegarde, elle, fait ses trois appels dans l'ordre.
    expect(invoke.mock.calls.map(([, { body }]) => body.action).filter((a) => a !== "etat")).toEqual(["fichiers", "donnees", "noter"]);
    expect(q("sauvegarde-phrase")).toBeNull();
    clic.mockRestore();
    act(() => racine.unmount());
  });
});
