import { afterEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;

/** Faux serveur : tables en mémoire, journal des envois, refus programmables. */
async function avecBase(tables: Record<string, Ligne[]>, refus?: (table: string, operation: string) => { code: string; message: string } | null) {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://exemple.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_essai");
  const envois: { table: string; operation: string; donnees: unknown }[] = [];
  const client = {
    from: (table: string) => ({
      select: () => {
        const q = {
          order: () => q,
          range: async (debut: number, fin: number) => ({ data: (tables[table] ?? []).slice(debut, fin + 1), error: null }),
        };
        return q;
      },
      upsert: async (lignes: Ligne[]) => {
        envois.push({ table, operation: "upsert", donnees: lignes });
        const e = refus?.(table, "upsert") ?? null;
        if (!e) {
          const t = (tables[table] ??= []);
          for (const l of lignes) {
            const i = t.findIndex((x) => x.id === l.id);
            if (i >= 0) t[i] = l; else t.push(l);
          }
        }
        return { error: e };
      },
      delete: () => ({
        in: async (_col: string, ids: string[]) => {
          envois.push({ table, operation: "delete", donnees: ids });
          const e = refus?.(table, "delete") ?? null;
          if (!e) tables[table] = (tables[table] ?? []).filter((l) => !ids.includes(String(l.id)));
          return { error: e };
        },
      }),
    }),
  };
  vi.doMock("@supabase/supabase-js", async (original) => ({
    ...(await original<typeof import("@supabase/supabase-js")>()),
    createClient: () => client,
  }));
  const miroir = await import("@/lib/miroirServeur");
  await import("@/data/miroirsStructure");
  return {
    envois,
    miroir,
    filieres: await import("@/data/filiereStore"),
    niveaux: await import("@/data/niveauStore"),
    structure: await import("@/data/structureStore"),
    curriculum: await import("@/data/curriculumStore"),
    S: await import("@/data/studentStore"),
  };
}

const FILIERE = { id: "fil-qhse", code: "LQHSE", nom: "Licence QHSE", responsable: "", responsable_id: null, statut: "actif", cycle_id: null, cycle: null, entite_id: null, entite: null, type_programme: null, annees_actives: ["2026-2027"], specialite: null, informations_complementaires: null };
const NIVEAU = { id: "niv-l1", nom: "Licence 1", alias: "L1", cycle: "Licence", cycle_id: null, filiere: "LQHSE", filiere_id: "fil-qhse", passage_conditionnel_autorise: null, credit_dette_min: null, credits_requis_entree: 0 };
const ANNEE = { id: "annee-2026", libelle: "2026-2027", actuelle: true, cloturee: false, archivee: false, date_debut: "2026-11-02", date_fin: "2027-07-31", cree_le: "2026-10-30T10:00:00Z" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@supabase/supabase-js");
});

describe("miroir de la structure académique dans Supabase", () => {
  it("à la connexion, les écrans reçoivent la structure de la base", async () => {
    const b = await avecBase({ filieres: [FILIERE], niveaux: [NIVEAU], annees_academiques: [ANNEE] });
    await b.miroir.chargerMiroirs();
    expect(b.filieres.getFilieres()).toEqual([expect.objectContaining({ id: "fil-qhse", code: "LQHSE", anneesActives: ["2026-2027"], nbClasses: 0, nbEtudiants: 0 })]);
    expect(b.filieres.getFilieres()[0]).not.toHaveProperty("cycleId", null);
    expect(b.niveaux.getNiveaux()[0]).toMatchObject({ alias: "L1", filiereId: "fil-qhse", creditsRequisEntree: 0 });
    expect(b.S.getAnneesAcademiques()).toEqual([{ id: "annee-2026", libelle: "2026-2027", actuelle: true, cloturee: false, archivee: false, dateDebut: "2026-11-02", dateFin: "2027-07-31" }]);
    expect(b.envois).toHaveLength(0);
  });

  it("une filière créée, modifiée puis supprimée part vers la base, en colonnes de la base", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE] });
    await b.miroir.chargerMiroirs();
    const f = b.filieres.addFiliere({ code: "LGL", nom: "Licence Génie logiciel", responsable: "", nbClasses: 0, nbEtudiants: 0, statut: "actif" });
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "filieres", operation: "upsert", donnees: [expect.objectContaining({ id: f.id, code: "LGL", nom: "Licence Génie logiciel", responsable_id: null, annees_actives: null })] }]);
    expect(JSON.stringify(b.envois[0].donnees)).not.toContain("nb_classes");
    b.filieres.updateFiliere(f.id, { nom: "Licence en génie logiciel" });
    b.filieres.deleteFiliere(f.id);
    await b.miroir.attendreEnvois();
    expect(b.envois.at(-1)).toEqual({ table: "filieres", operation: "delete", donnees: [f.id] });
  });

  it("un compteur calculé (effectif d'une classe) ne part pas vers la base", async () => {
    const b = await avecBase({
      annees_academiques: [ANNEE], filieres: [FILIERE], niveaux: [NIVEAU],
      classes: [{ id: "cl-l1", nom: "LQHSE1-26/27", filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", niveau_id: "niv-l1", max: 40, delegue: "", annee: "2026-2027", salle_par_defaut_id: null, cloturee: null, date_cloture: null, cloturee_par: null, observation_cloture: null }],
    });
    await b.miroir.chargerMiroirs();
    expect(b.structure.getClasseById("cl-l1")?.inscrits).toBe(0);
    b.structure.incrementClasseEffectif("cl-l1", 1);
    await b.miroir.attendreEnvois();
    expect(b.structure.getClasseById("cl-l1")?.inscrits).toBe(1);
    expect(b.envois).toHaveLength(0);
  });

  it("nouvelle année puis sa classe dans la même action : l'année part d'abord", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE], filieres: [FILIERE], niveaux: [NIVEAU] });
    await b.miroir.chargerMiroirs();
    b.structure.upsertClasse({ nom: "LQHSE1-27/28", filiereId: "fil-qhse", niveauId: "niv-l1", max: 40, annee: "2027-2028" });
    b.S.addAnneeAcademique("2027-2028", { dateDebut: "2027-11-01", dateFin: "2028-07-31" });
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["annees_academiques", "classes"]);
  });

  it("refus de la base : l'écran reprend l'état de la base et dit pourquoi", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE], filieres: [FILIERE], niveaux: [NIVEAU] },
      (table, operation) => (table === "filieres" && operation === "delete" ? { code: "23503", message: "violates foreign key constraint" } : null));
    await b.miroir.chargerMiroirs();
    const motifs: string[] = [];
    window.addEventListener(b.miroir.EVENEMENT_REFUS_SERVEUR, (e) => motifs.push((e as CustomEvent<{ message: string }>).detail.message));
    b.filieres.deleteFiliere("fil-qhse");
    expect(b.filieres.getFilieres()).toHaveLength(0);
    await b.miroir.attendreEnvois();
    expect(motifs).toEqual([expect.stringContaining("encore utilisé")]);
    expect(b.filieres.getFilieres().map((f) => f.code)).toEqual(["LQHSE"]);
  });

  it("une UE et ses EC : l'UE part avant ses EC, et le nombre d'EC est recompté au chargement", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE], filieres: [FILIERE] });
    await b.miroir.chargerMiroirs();
    const ue = b.curriculum.upsertUe({ code: "UE-MGT", libelle: "Management de la qualité", credits: 6, filiere: "LQHSE", filiereId: "fil-qhse", niveau: "L1", semestre: "S1", type: "Obligatoire", obligatoire: true });
    b.curriculum.upsertEc({ code: "SMQ", libelle: "Système de management", ueId: ue.id, credits: 3, volCm: 20, volTd: 10, volTp: 0, volTpe: 15, responsable: "Mamadou KANE" });
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["ues", "ecs"]);
    await b.miroir.chargerMiroirs();
    expect(b.curriculum.getUes()[0].nbEc).toBe(1);
  });

  it("une grande maquette se lit par pages de 1 000 lignes", async () => {
    const ues = Array.from({ length: 1005 }, (_, i) => ({ id: `ue-${String(i).padStart(4, "0")}`, code: `UE${i}`, libelle: `UE ${i}`, credits: 3, filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", semestre: "S1", type: "", obligatoire: true, description: null }));
    const b = await avecBase({ annees_academiques: [ANNEE], filieres: [FILIERE], ues });
    await b.miroir.chargerMiroirs();
    expect(b.curriculum.getUes()).toHaveLength(1005);
  });

  it("sans Supabase, rien ne part", async () => {
    vi.resetModules();
    const miroir = await import("@/lib/miroirServeur");
    await import("@/data/miroirsStructure");
    const { addFiliere, getFilieres } = await import("@/data/filiereStore");
    await miroir.chargerMiroirs();
    addFiliere({ code: "LGL", nom: "Licence Génie logiciel", responsable: "", nbClasses: 0, nbEtudiants: 0, statut: "actif" });
    await miroir.attendreEnvois();
    expect(getFilieres().map((f) => f.code)).toContain("LGL");
  });
});
