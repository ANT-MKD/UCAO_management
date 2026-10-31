import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;

/** Faux serveur : tables en mémoire, journal des envois, refus programmables (un refus
 * { code: "0 lignes" } imite une mise à jour que les règles d'accès filtrent sans erreur), et
 * espace de fichiers (« espace/chemin » → contenu en data URL ; un dépôt refusé se programme sur
 * la table « stockage:<espace> »). */
async function avecBase(
  tables: Record<string, Ligne[]>,
  refus?: (table: string, operation: string) => { code?: string; message: string; statusCode?: string } | null,
  fichiers: Map<string, string> = new Map(),
) {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://exemple.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_essai");
  const envois: { table: string; operation: string; donnees: unknown }[] = [];
  /** Appels des fonctions de la base (rpc) et des fonctions serveur, dans l'ordre, avec les envois. */
  const appels: { nom: string; donnees: unknown; envoisAvant: number }[] = [];
  /** Opérations sur l'espace de fichiers, avec le nombre d'envois de lignes déjà faits. */
  const stockage: { espace: string; operation: string; chemins: string[]; envoisAvant: number; type?: string }[] = [];
  let prochainMatricule = 1;
  const client = {
    storage: {
      from: (espace: string) => ({
        upload: async (chemin: string, contenu: Blob, options: { contentType?: string }) => {
          stockage.push({ espace, operation: "depot", chemins: [chemin], envoisAvant: envois.length, type: options.contentType });
          const e = refus?.(`stockage:${espace}`, "depot") ?? null;
          if (e) return { data: null, error: e };
          if (fichiers.has(`${espace}/${chemin}`)) return { data: null, error: { message: "The resource already exists", statusCode: "409" } };
          const octets = new Uint8Array(await contenu.arrayBuffer());
          fichiers.set(`${espace}/${chemin}`, `data:${options.contentType};base64,${btoa(String.fromCharCode(...octets))}`);
          return { data: { path: chemin }, error: null };
        },
        createSignedUrls: async (chemins: string[]) => ({
          data: chemins.map((c) => (fichiers.has(`${espace}/${c}`)
            ? { path: c, signedUrl: `https://exemple.supabase.co/storage/v1/object/sign/${espace}/${c}?token=essai`, error: null }
            : { path: c, signedUrl: null, error: "Object not found" })),
          error: null,
        }),
        download: async (chemin: string) => {
          const contenu = fichiers.get(`${espace}/${chemin}`);
          if (!contenu) return { data: null, error: { message: "Object not found" } };
          return { data: await (await fetch(contenu)).blob(), error: null };
        },
        remove: async (chemins: string[]) => {
          stockage.push({ espace, operation: "retrait", chemins, envoisAvant: envois.length });
          chemins.forEach((c) => fichiers.delete(`${espace}/${c}`));
          return { data: [], error: null };
        },
      }),
    },
    rpc: async (nom: string, args: Record<string, unknown>) => {
      appels.push({ nom, donnees: args, envoisAvant: envois.length });
      if (nom === "attribuer_matricule") return { data: `2026-LQHSE-${String(prochainMatricule++).padStart(4, "0")}`, error: null };
      if (nom === "apercu_matricule") return { data: `2026-LQHSE-${String(prochainMatricule).padStart(4, "0")}`, error: null };
      return { data: null, error: null };
    },
    functions: {
      invoke: async (nom: string, { body }: { body: unknown }) => {
        appels.push({ nom, donnees: body, envoisAvant: envois.length });
        return { data: { id: "00000000-0000-4000-8000-0000000000e1" }, error: null };
      },
    },
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
      update: (valeurs: Ligne) => ({
        eq: (_col: string, id: unknown) => ({
          select: async () => {
            envois.push({ table, operation: "update", donnees: valeurs });
            const e = refus?.(table, "update") ?? null;
            const ligne = (tables[table] ?? []).find((l) => String(l.id) === String(id));
            if (e?.code === "0 lignes" || !ligne) return { data: [], error: null };
            if (e) return { data: null, error: e };
            Object.assign(ligne, valeurs);
            return { data: [{ id }], error: null };
          },
        }),
      }),
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
  await import("@/data/miroirs");
  return {
    envois,
    appels,
    stockage,
    fichiers,
    miroir,
    roles: await import("@/data/roleStore"),
    pages: await import("@/data/portalFeaturesStore"),
    motifs: await import("@/data/motifBlocageStore"),
    filieres: await import("@/data/filiereStore"),
    niveaux: await import("@/data/niveauStore"),
    structure: await import("@/data/structureStore"),
    curriculum: await import("@/data/curriculumStore"),
    S: await import("@/data/studentStore"),
  };
}

const FILIERE = { id: "fil-qhse", code: "LQHSE", nom: "Licence QHSE", responsable: "", responsable_id: null, statut: "actif", cycle_id: null, cycle: null, entite_id: null, entite: null, type_programme: null, annees_actives: ["2026-2027"], specialite: null, informations_complementaires: null };
const NIVEAU = { id: "niv-l1", nom: "Licence 1", alias: "L1", cycle: "Licence", cycle_id: null, filiere: "LQHSE", filiere_id: "fil-qhse", passage_conditionnel_autorise: null, credit_dette_min: null, credits_requis_entree: 0 };
const ADMIN = "00000000-0000-4000-8000-00000000000a";
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
    await import("@/data/miroirs");
    const { addFiliere, getFilieres } = await import("@/data/filiereStore");
    await miroir.chargerMiroirs();
    addFiliere({ code: "LGL", nom: "Licence Génie logiciel", responsable: "", nbClasses: 0, nbEtudiants: 0, statut: "actif" });
    await miroir.attendreEnvois();
    expect(getFilieres().map((f) => f.code)).toContain("LGL");
  });
});

describe("miroir des rôles, des pages des portails et des motifs de blocage", () => {
  it("à la connexion, les rôles, pages et motifs de la base remplacent ceux du navigateur", async () => {
    const b = await avecBase({
      annees_academiques: [ANNEE],
      roles: [{ id: "role-caisse", code: "ROLE_CAISSE", description: "Caisse", pages: ["fin-enc-liste", "fin-enc-declares"], auteur: ADMIN, cree_le: "2026-10-30T08:00:00+00:00" }],
      pages_portails: [{ id: "student-notes", portail: "etudiant", active: false }],
      motifs_blocage: [{ id: "motif-impaye", code: "IMPAYE", intitule: "Impayé de scolarité", actions_interdites: ["portail_etudiant"], cree_le: "2026-10-30T09:00:00+00:00" }],
    });
    expect(b.roles.getRoles().map((r) => r.id)).toContain("role-secretariat");
    await b.miroir.chargerMiroirs();
    expect(b.roles.getRoles()).toEqual([
      { id: "role-caisse", code: "ROLE_CAISSE", description: "Caisse", accessibleItemIds: ["fin-enc-liste", "fin-enc-declares"], auteurId: ADMIN, createdAt: "2026-10-30T08:00:00+00:00" },
    ]);
    expect(b.pages.isFeatureActif("student-notes")).toBe(false);
    expect(b.pages.isFeatureActif("student-cours")).toBe(true);
    expect(b.motifs.getMotifsBlocage()).toEqual([
      { id: "motif-impaye", code: "IMPAYE", intitule: "Impayé de scolarité", actionsInterdites: ["portail_etudiant"], createdAt: "2026-10-30T09:00:00+00:00" },
    ]);
    expect(b.envois).toHaveLength(0);
  });

  it("un rôle créé par l'administrateur part avec ses pages, en colonnes de la base", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE] });
    b.S.refleterCompteServeur({ id: ADMIN, role: "admin", email: "f.diop@ucao.edu", identifier: "ADM-PRINCIPAL", displayName: "Fatou DIOP", actif: true, doitChangerMotDePasse: false });
    await b.miroir.chargerMiroirs();
    const role = b.roles.upsertRole({ code: "ROLE_CAISSE", description: "Caisse" }, ADMIN);
    b.roles.setRoleAccess(role.id, ["fin-enc-liste"], ADMIN);
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "roles", operation: "upsert", donnees: [
      { id: role.id, code: "ROLE_CAISSE", description: "Caisse", pages: ["fin-enc-liste"], auteur: ADMIN, cree_le: role.createdAt },
    ] }]);
  });

  it("fermer puis rouvrir une page du portail Étudiant : chaque page reste à son portail", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE] });
    await b.miroir.chargerMiroirs();
    b.pages.setFeatureActif("student", "student-notes", false);
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["pages_portails"]);
    const lignes = b.envois[0].donnees as { id: string; portail: string; active: boolean }[];
    expect(lignes.find((l) => l.id === "student-notes")).toEqual({ id: "student-notes", portail: "etudiant", active: false });
    expect(lignes.every((l) => (l.portail === "etudiant") === l.id.startsWith("student-"))).toBe(true);
    b.pages.setFeatureActif("student", "student-notes", true);
    await b.miroir.attendreEnvois();
    expect(b.envois[1].donnees).toEqual([{ id: "student-notes", portail: "etudiant", active: true }]);
  });

  it("motif de blocage refusé (compte sans « Paramètres généraux ») : l'écran reprend la base et dit pourquoi", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE] },
      (table) => (table === "motifs_blocage" ? { code: "42501", message: "new row violates row-level security policy" } : null));
    await b.miroir.chargerMiroirs();
    const motifs: string[] = [];
    window.addEventListener(b.miroir.EVENEMENT_REFUS_SERVEUR, (e) => motifs.push((e as CustomEvent<{ message: string }>).detail.message));
    b.motifs.upsertMotifBlocage({ code: "IMPAYE", intitule: "Impayé de scolarité", actionsInterdites: ["portail_etudiant"] }, ADMIN);
    expect(b.motifs.getMotifsBlocage()).toHaveLength(1);
    await b.miroir.attendreEnvois();
    expect(b.envois[0].donnees).toEqual([expect.objectContaining({ code: "IMPAYE", actions_interdites: ["portail_etudiant"] })]);
    expect(motifs).toEqual([expect.stringContaining("pas le droit")]);
    expect(b.motifs.getMotifsBlocage()).toEqual([]);
  });

  it("même code de motif créé depuis deux postes : la base garde le premier et l'écran dit pourquoi", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE] },
      (table) => (table === "motifs_blocage" ? { code: "23505", message: "duplicate key value violates unique constraint \"motifs_blocage_code_unique\"" } : null));
    await b.miroir.chargerMiroirs();
    const motifs: string[] = [];
    window.addEventListener(b.miroir.EVENEMENT_REFUS_SERVEUR, (e) => motifs.push((e as CustomEvent<{ message: string }>).detail.message));
    b.motifs.upsertMotifBlocage({ code: "impaye", intitule: "Impayé", actionsInterdites: [] }, ADMIN);
    await b.miroir.attendreEnvois();
    expect(motifs).toEqual([expect.stringContaining("existe déjà")]);
  });

  it("un store reflété après une première connexion est lui aussi mis de côté avant d'être remplacé", async () => {
    const CLE = "edumanage-sauvegarde-avant-supabase-v1";
    localStorage.setItem(CLE, JSON.stringify({ le: "2026-10-30T10:00:00Z", donnees: { "edumanage-filiere-store-v1": "[]" } }));
    localStorage.setItem("edumanage-motifs-blocage-v1", JSON.stringify([{ id: "motif-local", code: "DOSSIER", intitule: "Dossier incomplet", actionsInterdites: [], createdAt: "2026-10-01T00:00:00Z" }]));
    const b = await avecBase({ annees_academiques: [ANNEE] });
    await b.miroir.chargerMiroirs();
    const sauvegarde = JSON.parse(localStorage.getItem(CLE)!);
    expect(sauvegarde.le).toBe("2026-10-30T10:00:00Z");
    expect(sauvegarde.donnees["edumanage-filiere-store-v1"]).toBe("[]");
    expect(JSON.parse(sauvegarde.donnees["edumanage-motifs-blocage-v1"])).toEqual([expect.objectContaining({ id: "motif-local" })]);
    expect(b.motifs.getMotifsBlocage()).toEqual([]);
  });
});

describe("miroir du paramétrage de la scolarité et des bulletins", () => {
  const REGLEMENT = { id: "reg-qhse", nom: "Règlement LQHSE", annee: "2026-2027", filiere_ids: ["fil-qhse"], formules: {}, cree_par: "Ibrahima FALL", cree_le: "2026-10-30T10:00:00+00:00", modifie_par: "Ibrahima FALL", modifie_le: "2026-10-30T11:00:00+00:00", depuis_version: null };
  const version = (numero: number, action: string, nom: string) => ({ id: `version-reg-qhse-${numero}`, reglement_id: "reg-qhse", numero, action, nom, annee: "2026-2027", filiere_ids: ["fil-qhse"], formules: {}, par: "Ibrahima FALL", le: "2026-10-30T10:00:00+00:00", depuis_version: null });

  it("à la connexion : le paramétrage de la base, complété sur le poste pour ce qu'elle n'a pas encore", async () => {
    const b = await avecBase({
      annees_academiques: [ANNEE], filieres: [FILIERE],
      scolarite_valeurs_defaut: [{ id: "etablissement", note_bareme: 20, cumul_credit: false, moyenne_passage: 12, moyenne_eliminatoire: 5, modifie_par: "Ibrahima FALL", modifie_le: "2026-10-30T00:00:00+00:00" }],
      methodes_calcul: [{ id: "meth-moyenneUe-calculMoyenneCredit", code: "calculMoyenneCredit", intitule: "Moyenne au prorata des crédits", niveau: "moyenneUe", description: null, actif: true }],
      reglements_calcul: [REGLEMENT],
      reglements_calcul_versions: [version(1, "creation", "Règlement QHSE"), version(2, "modification", "Règlement LQHSE")],
    });
    await b.miroir.chargerMiroirs();
    const Sc = await import("@/data/scolariteConfigStore");
    const Rv = await import("@/data/reglesValidationStore");
    const Me = await import("@/data/mentionsStore");
    const Mc = await import("@/data/bulletinMethodesStore");
    const Rc = await import("@/data/reglementCalculStore");
    expect(Sc.getConfigForFiliere("fil-qhse")).toMatchObject({ moyennePassage: 12, moyenneEliminatoire: 5, cumulCredit: false });
    expect(Rv.getRegleValidation("fil-qhse", "annee")).toMatchObject({ validationParMoyenne: true, validationParCredit: false, moyennePassage: 12 });
    expect(Me.getMentions()).toHaveLength(20);
    expect(Mc.getMethodesCalcul().find((m) => m.id === "meth-moyenneUe-calculMoyenneCredit")?.intitule).toBe("Moyenne au prorata des crédits");
    expect(Mc.getMethodesCalculParNiveau("moyenneSession").length).toBeGreaterThan(0);
    expect(Rc.reglementPour("fil-qhse", "2026-2027")?.nom).toBe("Règlement LQHSE");
    expect(Rc.getHistoriqueReglement("reg-qhse").map((v) => v.numero)).toEqual([2, 1]);
    expect(b.envois).toHaveLength(0);
  });

  it("une filière créée sans « Paramétrage scolarité » : sa configuration est calculée sur le poste, seule la filière part", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE], filieres: [FILIERE] });
    await b.miroir.chargerMiroirs();
    const Sc = await import("@/data/scolariteConfigStore");
    const Rv = await import("@/data/reglesValidationStore");
    const f = b.filieres.addFiliere({ code: "LGL", nom: "Licence Génie logiciel", responsable: "", nbClasses: 0, nbEtudiants: 0, statut: "actif" });
    await b.miroir.attendreEnvois();
    expect(Sc.getConfigForFiliere(f.id)).toMatchObject({ moyennePassage: 10 });
    expect(Rv.getRegleValidation(f.id, "semestre")).toBeDefined();
    expect(b.envois.map((e) => e.table)).toEqual(["filieres"]);

    // Ibrahima FALL relève la moyenne de passage de LQHSE : la configuration et les règles de
    // validation qui la suivaient partent, avec les compléments calculés ; pas les valeurs par
    // défaut, jamais réglées.
    Sc.updateScolariteConfig("scol-cfg-fil-qhse", { noteBareme: 20, cumulCredit: true, moyennePassage: 12, moyenneEliminatoire: 0 }, "Ibrahima FALL");
    await b.miroir.attendreEnvois();
    expect(b.envois.slice(1).map((e) => e.table)).toEqual(["scolarite_configs", "regles_validation"]);
    const configs = b.envois[1].donnees as { id: string; filiere_id: string; moyenne_passage: number }[];
    expect(configs.find((c) => c.filiere_id === "fil-qhse")?.moyenne_passage).toBe(12);
    expect(configs.map((c) => c.filiere_id)).toContain(f.id);
    const regles = b.envois[2].donnees as { filiere_id: string; moyenne_passage: number }[];
    expect(regles.filter((r) => r.filiere_id === "fil-qhse").every((r) => r.moyenne_passage === 12)).toBe(true);
  });

  it("un règlement enregistré part seul : son historique, la base l'écrit elle-même", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE], filieres: [FILIERE] });
    await b.miroir.chargerMiroirs();
    const Rc = await import("@/data/reglementCalculStore");
    const res = Rc.enregistrerReglement({ nom: "Règlement LQHSE", annee: "2026-2027", filiereIds: ["fil-qhse"], formules: {} }, undefined, "Ibrahima FALL");
    expect(res.ok).toBe(true);
    const id = res.reglement!.id;
    Rc.enregistrerReglement({ nom: "Règlement LQHSE 2026", annee: "2026-2027", filiereIds: ["fil-qhse"], formules: {} }, id, "Ibrahima FALL");
    Rc.enregistrerReglement({ nom: "Règlement LQHSE", annee: "2026-2027", filiereIds: ["fil-qhse"], formules: {} }, id, "Ibrahima FALL", { depuisVersion: 1 });
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["reglements_calcul"]);
    expect(b.envois[0].donnees).toEqual([expect.objectContaining({ id, nom: "Règlement LQHSE", filiere_ids: ["fil-qhse"], formules: {}, cree_par: "Ibrahima FALL", depuis_version: 1 })]);
    expect(Rc.getHistoriqueReglement(id).map((v) => v.action)).toEqual(["retour", "modification", "creation"]);
  });

  it("refus rédigé par la base (filière qui a déjà un règlement) : l'écran affiche son message et se recale", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE], filieres: [FILIERE] },
      (table) => (table === "reglements_calcul" ? { code: "23505", message: "Licence QHSE a déjà le règlement « Règlement LQHSE » pour 2026-2027." } : null));
    await b.miroir.chargerMiroirs();
    const motifs: string[] = [];
    window.addEventListener(b.miroir.EVENEMENT_REFUS_SERVEUR, (e) => motifs.push((e as CustomEvent<{ message: string }>).detail.message));
    const Rc = await import("@/data/reglementCalculStore");
    Rc.enregistrerReglement({ nom: "Doublon", annee: "2026-2027", filiereIds: ["fil-qhse"], formules: {} }, undefined, "Ibrahima FALL");
    await b.miroir.attendreEnvois();
    expect(motifs).toEqual(["La base a refusé : Licence QHSE a déjà le règlement « Règlement LQHSE » pour 2026-2027. L'écran a été remis à jour."]);
    expect(Rc.getReglements()).toEqual([]);
  });
});

describe("miroir du paramétrage de l'emploi du temps, des finances, de la communication et de l'établissement", () => {
  const KANE = "00000000-0000-4000-8000-00000000000c";
  const ETABLISSEMENT = { id: 1, nom: "Université Catholique de l'Afrique de l'Ouest", adresse: "Dakar, Sénégal", telephone: "", email: "", site_web: "", agrement: "", logo_chemin: null, modifie_le: "2026-10-30T10:00:00+00:00", modifie_par: null };

  it("à la connexion : listes et identité de la base ; le logo et l'image de signature viennent de l'espace de fichiers, en contenu pour l'impression", async () => {
    localStorage.setItem("edumanage-etablissement-v1", JSON.stringify({ nom: "Ancien nom", adresse: "", logoDataUrl: "data:image/png;base64,QU5DSUVO" }));
    localStorage.setItem("edumanage-signature-config-v1", JSON.stringify({ inscription: { actif: false, signataireNom: "", signataireQualite: "", imageDataUrl: "data:image/png;base64,QU5DSUVO" } }));
    const b = await avecBase({
      annees_academiques: [ANNEE],
      types_seance: [{ id: "ts-seed-1", code: "CM", intitule: "Cours magistral", categorie: "emploi_du_temps", couleur: "#4f46e5", trajet: false, necessite_surveillant: false }],
      jours_feries: [{ id: "jf-tabaski", intitule: "Tabaski", date_debut: "2027-05-17", date_fin: "2027-05-18" }],
      etablissement: [{ ...ETABLISSEMENT, logo_chemin: "logo/ucao.png" }],
      signatures_documents: [{ id: "bulletin", actif: true, signataire_nom: "Pr Jean NDIAYE", signataire_qualite: "Le Recteur", image_chemin: "signatures/bulletin/recteur.png" }],
    }, undefined, new Map([["etablissement/logo/ucao.png", "data:image/png;base64,TE9HTw=="], ["etablissement/signatures/bulletin/recteur.png", "data:image/png;base64,U0lHTg=="]]));
    await b.miroir.chargerMiroirs();
    const Edt = await import("@/data/scheduleSettingsStore");
    const Et = await import("@/data/etablissementStore");
    const Sig = await import("@/data/signatureConfigStore");
    expect(Edt.typeSeanceStore.getAll().map((t) => t.code)).toEqual(["CM"]);
    expect(Edt.getJourFerieCouvrant("2027-05-18")?.intitule).toBe("Tabaski");
    expect(Et.getEtablissement()).toMatchObject({ nom: "Université Catholique de l'Afrique de l'Ouest", adresse: "Dakar, Sénégal", logoDataUrl: "data:image/png;base64,TE9HTw==" });
    expect(Sig.getSignatureConfig("bulletin")).toEqual({ actif: true, signataireNom: "Pr Jean NDIAYE", signataireQualite: "Le Recteur", imageDataUrl: "data:image/png;base64,U0lHTg==" });
    expect(Sig.getSignatureConfig("inscription").actif).toBe(false);
    expect(Sig.getSignatureConfig("inscription").imageDataUrl).toBeUndefined();
    expect(b.envois).toHaveLength(0);
    expect(b.stockage).toHaveLength(0);
  });

  it("l'identité de l'établissement est mise à jour avec un nouveau logo, déposé d'abord ; sans le droit, l'écran reprend la base", async () => {
    const refus = { actif: false };
    const b = await avecBase({ annees_academiques: [ANNEE], etablissement: [ETABLISSEMENT] },
      (table, operation) => (refus.actif && table === "etablissement" && operation === "update" ? { code: "0 lignes", message: "" } : null));
    await b.miroir.chargerMiroirs();
    const Et = await import("@/data/etablissementStore");
    Et.updateEtablissement({ ...Et.getEtablissement(), telephone: "33 800 00 00", logoDataUrl: "data:image/png;base64,TE9HTw==" }, ADMIN);
    await b.miroir.attendreEnvois();
    const logo = b.stockage[0]?.chemins[0];
    expect(b.stockage).toEqual([{ espace: "etablissement", operation: "depot", chemins: [expect.stringMatching(/^logo\/[\w-]+\.png$/)], envoisAvant: 0, type: "image/png" }]);
    expect(b.envois).toEqual([{ table: "etablissement", operation: "update", donnees: {
      nom: "Université Catholique de l'Afrique de l'Ouest", adresse: "Dakar, Sénégal", telephone: "33 800 00 00", email: "", site_web: "", agrement: "", logo_chemin: logo,
    } }]);
    refus.actif = true;
    const motifs: string[] = [];
    window.addEventListener(b.miroir.EVENEMENT_REFUS_SERVEUR, (e) => motifs.push((e as CustomEvent<{ message: string }>).detail.message));
    Et.updateEtablissement({ ...Et.getEtablissement(), nom: "Nom pirate" }, ADMIN);
    await b.miroir.attendreEnvois();
    expect(motifs).toEqual([expect.stringContaining("pas le droit")]);
    expect(Et.getEtablissement()).toMatchObject({ nom: "Université Catholique de l'Afrique de l'Ouest", logoDataUrl: "data:image/png;base64,TE9HTw==" });
    expect(b.stockage).toHaveLength(1);
  });

  it("Mamadou KANE désigné validateur des messages : son compte part en colonnes de la base", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE] });
    await b.miroir.chargerMiroirs();
    const Cr = await import("@/data/communicationRolesStore");
    const r = Cr.ajouterCommunicationRole({ role: "validateur_message", userId: KANE, userLabel: "Mamadou KANE" });
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "roles_communication", operation: "upsert", donnees: [
      { id: r.id, role: "validateur_message", compte_id: KANE, compte_libelle: "Mamadou KANE", remarque: null, action: null },
    ] }]);
  });

  it("nouveau modèle de frais et sa grille dans la même action : le modèle part avant la grille", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE], filieres: [FILIERE] });
    await b.miroir.chargerMiroirs();
    const Fin = await import("@/data/financeSettingsStore");
    const Gr = await import("@/data/grilleFraisStore");
    const m = Fin.modeleFraisStore.add({ code: "BRS", intitule: "Boursier" });
    Gr.upsertGrilleFrais({ filiereId: "fil-qhse", niveau: "L1", annee: "2026-2027", modeleFraisId: m.id,
      lignes: [{ id: "l1", typeFraisId: "tf-seed-4", intitule: "Frais généraux", montant: 350000, modalite: "echeances", nbEcheances: 8 }] });
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["modeles_frais", "grilles_frais"]);
    expect(b.envois[1].donnees).toEqual([expect.objectContaining({ filiere_id: "fil-qhse", modele_frais_id: m.id, lignes: [expect.objectContaining({ montant: 350000 })] })]);
  });
});

describe("listes de départ posées par la base à l'installation", () => {
  it("sont celles de l'application : mêmes identifiants, codes et intitulés", async () => {
    // Les tests se lancent depuis artifacts/edumanage (en local comme dans les vérifications GitHub).
    const dossier = resolve(process.cwd(), "../../supabase/migrations");
    const sql = readdirSync(dossier).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(join(dossier, f), "utf8")).join("\n");
    const corps = sql.slice(sql.indexOf("create function private.poser_valeurs_depart()"));
    const A = await import("@/data/academicSettingsStore");
    const Te = await import("@/data/typeEvaluationStore");
    const Rg = await import("@/data/regroupementDevoirStore");
    const Edt = await import("@/data/scheduleSettingsStore");
    const Fin = await import("@/data/financeSettingsStore");
    const listes: { id: string; code: string; intitule: string }[][] = [
      A.cycleStore.getAll(), A.categorieCoursStore.getAll(), Te.getTypesEvaluation(), Rg.getRegroupementsDevoir(),
      Edt.typeSeanceStore.getAll(), Fin.typeFraisStore.getAll(), Fin.modePaiementFinanceStore.getAll(), Fin.modeleFraisStore.getAll(),
    ];
    for (const liste of listes) {
      expect(liste.length).toBeGreaterThan(0);
      for (const v of liste) expect(corps).toContain(`('${v.id}', '${v.code}', '${v.intitule.replace(/'/g, "''")}'`);
    }
    for (const r of Rg.getRegroupementsDevoir()) expect(corps).toContain(`array[${r.typeEvaluationIds.map((t) => `'${t}'`).join(", ")}]`);
  });
});

describe("miroir des enseignants : fiche publique et dossier personnel", () => {
  const KANE = { id: "en-kane", prenom: "Mamadou", nom: "KANE", matricule: "ENS-2026-100", sexe: "M", grade: "Vacataire", specialite: "QHSE", specialites: ["QHSE"] };
  const FALL = { id: "en-fall", prenom: "Ibrahima", nom: "FALL", matricule: "ENS-2026-101", sexe: "M", grade: "Permanent", specialite: "Génie logiciel", specialites: ["Génie logiciel"] };
  const DOSSIER_KANE = { id: "en-kane", telephone: "77 000 00 01", email: "m.kane@ucao.edu", date_naissance: null, pays_naissance: null, lieu_naissance: null, nationalite: null, cni: "1 234 1980 00012", adresse: null, niveau_etude: null, rib: "SN012 01201 000000000001 01", diplomes: ["Master QHSE"], taux_horaire: 10000 };

  it("sur le poste de KANE : le RIB de FALL d'une ancienne session est effacé, et aucun dossier vide ne part", async () => {
    localStorage.setItem("edumanage-teacher-store-v1", JSON.stringify([{ ...FALL, telephone: "77 000 00 03", rib: "SN-ANCIEN", tauxHoraire: 5000, modulesAssignes: 0, heuresMois: 0 }]));
    const b = await avecBase({ annees_academiques: [ANNEE], enseignants: [KANE, FALL], enseignants_dossiers: [DOSSIER_KANE] });
    await b.miroir.chargerMiroirs();
    const T = await import("@/data/teacherStore");
    expect(T.getTeacherById("en-fall")).toMatchObject({ nom: "FALL", telephone: "", tauxHoraire: 0 });
    expect(T.getTeacherById("en-fall")?.rib).toBeUndefined();
    expect(T.getTeacherById("en-kane")).toMatchObject({ rib: "SN012 01201 000000000001 01", tauxHoraire: 10000, diplomes: ["Master QHSE"] });
    T.updateTeacher("en-kane", { specialite: "Management QHSE" }, "u-kane");
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "enseignants", operation: "upsert", donnees: [expect.objectContaining({ id: "en-kane", specialite: "Management QHSE" })] }]);
  });

  it("un enseignant créé part avec sa fiche puis son dossier ; un RIB modifié ne renvoie que le dossier", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE], enseignants: [KANE], enseignants_dossiers: [DOSSIER_KANE] });
    await b.miroir.chargerMiroirs();
    const T = await import("@/data/teacherStore");
    const fall = T.addTeacher({ prenom: "Ibrahima", nom: "FALL", matricule: "ENS-2026-101", telephone: "77 000 00 03", specialite: "Génie logiciel", grade: "Permanent", tauxHoraire: 0, rib: "SN012 01201 000000000003 03" }, ADMIN);
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["enseignants", "enseignants_dossiers"]);
    expect(b.envois[0].donnees).toEqual([expect.objectContaining({ id: fall.id, matricule: "ENS-2026-101", grade: "Permanent" })]);
    expect(JSON.stringify(b.envois[0].donnees)).not.toContain("SN012");
    expect(b.envois[1].donnees).toEqual([expect.objectContaining({ id: fall.id, rib: "SN012 01201 000000000003 03", telephone: "77 000 00 03" })]);
    T.updateTeacher("en-kane", { rib: "SN012 01201 000000000009 09" }, ADMIN);
    await b.miroir.attendreEnvois();
    expect(b.envois.slice(2)).toEqual([{ table: "enseignants_dossiers", operation: "upsert", donnees: [expect.objectContaining({ id: "en-kane", rib: "SN012 01201 000000000009 09" })] }]);
  });

  it("KANE change son téléphone et sa photo depuis son profil : photo déposée dans son dossier, puis simple mise à jour (il ne crée pas de dossier)", async () => {
    const b = await avecBase({ annees_academiques: [ANNEE], enseignants: [KANE], enseignants_dossiers: [DOSSIER_KANE] },
      (table, operation) => (table === "enseignants_dossiers" && operation === "upsert" ? { code: "42501", message: "new row violates row-level security policy" } : null));
    await b.miroir.chargerMiroirs();
    const T = await import("@/data/teacherStore");
    const motifs: string[] = [];
    window.addEventListener(b.miroir.EVENEMENT_REFUS_SERVEUR, (e) => motifs.push((e as CustomEvent<{ message: string }>).detail.message));
    T.updateTeacher("en-kane", { telephone: "77 000 00 09", adresse: "Dakar, Fann", photoDataUrl: "data:image/jpeg;base64,S0FORQ==" }, "u-kane");
    await b.miroir.attendreEnvois();
    const photo = b.stockage[0]?.chemins[0];
    expect(b.stockage).toEqual([{ espace: "photos", operation: "depot", chemins: [expect.stringMatching(/^enseignants\/en-kane\/[\w-]+\.jpg$/)], envoisAvant: 0, type: "image/jpeg" }]);
    expect(b.envois).toEqual([
      { table: "enseignants_dossiers", operation: "upsert", donnees: [expect.objectContaining({ id: "en-kane", photo_chemin: photo })] },
      { table: "enseignants_dossiers", operation: "update", donnees: expect.objectContaining({ telephone: "77 000 00 09", adresse: "Dakar, Fann", photo_chemin: photo, rib: "SN012 01201 000000000001 01" }) },
    ]);
    expect(motifs).toEqual([]);
  });
});

describe("espace de fichiers : photos et pièces d'inscription des étudiants", () => {
  const AWA = { id: "et-awa", matricule: "2026-LQHSE-0001", prenom: "Awa", nom: "SECK", sexe: "F", filiere: "LQHSE", filiere_id: "fil-qhse", classe: "", classe_id: null, niveau: "L1", statut: "inscrit", annee: "2026-2027", annee_premiere_inscription: 2026 };
  const OUSMANE = { ...AWA, id: "et-ousmane", matricule: "2026-LQHSE-0002", prenom: "Ousmane", nom: "DIALLO", sexe: "M" };
  const dossier = (id: string, autres: Ligne = {}) => ({ id, email: "", telephone: "770000001", date_naissance: null, lieu_naissance: null, pays: null, nationalite: null, cni: null, adresse: null,
    nom_tuteur: null, tel_tuteur: null, type_admission: null, documents_fournis: [], inscription_unique_payee: false, modele_frais_id: null, motif_blocage_id: null, photo_chemin: null, ...autres });
  const base = (): Record<string, Ligne[]> => ({ annees_academiques: [ANNEE], filieres: [FILIERE], niveaux: [NIVEAU], etudiants: [AWA, OUSMANE],
    etudiants_dossiers: [dossier("et-awa", { photo_chemin: "etudiants/et-awa/ancienne.jpg" }), dossier("et-ousmane")] });
  const ANCIENNE_PHOTO = (): Map<string, string> => new Map([["photos/etudiants/et-awa/ancienne.jpg", "data:image/jpeg;base64,QU5DSUVOTkU="]]);
  const lien = (espace: string, chemin: string) => `https://exemple.supabase.co/storage/v1/object/sign/${espace}/${chemin}?token=essai`;

  it("Awa change sa photo : déposée dans son dossier, puis son dossier part en simple mise à jour (elle n'en crée pas) ; l'ancienne photo est retirée", async () => {
    const b = await avecBase(base(), (table, operation) => (table === "etudiants_dossiers" && operation === "upsert" ? { code: "42501", message: "new row violates row-level security policy" } : null), ANCIENNE_PHOTO());
    await b.miroir.chargerMiroirs();
    expect(b.S.getEtudiantById("et-awa")?.photoDataUrl).toBe(lien("photos", "etudiants/et-awa/ancienne.jpg"));
    b.S.updateEtudiantInfos("et-awa", { telephone: "771234567", photoDataUrl: "data:image/jpeg;base64,Tk9VVkVMTEU=" }, "u-awa");
    await b.miroir.attendreEnvois();
    const photo = b.stockage[0]?.chemins[0];
    expect(photo).toMatch(/^etudiants\/et-awa\/[\w-]+\.jpg$/);
    expect(b.stockage).toEqual([
      { espace: "photos", operation: "depot", chemins: [photo], envoisAvant: 0, type: "image/jpeg" },
      { espace: "photos", operation: "retrait", chemins: ["etudiants/et-awa/ancienne.jpg"], envoisAvant: 2 },
    ]);
    expect(b.envois).toEqual([
      { table: "etudiants_dossiers", operation: "upsert", donnees: [expect.objectContaining({ id: "et-awa", photo_chemin: photo })] },
      { table: "etudiants_dossiers", operation: "update", donnees: expect.objectContaining({ telephone: "771234567", photo_chemin: photo }) },
    ]);
    // La même photo n'est pas redéposée quand Awa change ensuite son téléphone.
    b.S.updateEtudiantInfos("et-awa", { telephone: "771234568" }, "u-awa");
    await b.miroir.attendreEnvois();
    expect(b.stockage).toHaveLength(2);
    expect(b.envois.at(-1)).toEqual({ table: "etudiants_dossiers", operation: "update", donnees: expect.objectContaining({ telephone: "771234568", photo_chemin: photo }) });
  });

  it("une photo d'un type refusé par l'espace de fichiers : motif lisible, rien n'est enregistré, l'écran reprend la base", async () => {
    const b = await avecBase(base(), (table) => (table === "stockage:photos" ? { message: "mime type image/svg+xml is not supported", statusCode: "415" } : null), ANCIENNE_PHOTO());
    await b.miroir.chargerMiroirs();
    const motifs: string[] = [];
    window.addEventListener(b.miroir.EVENEMENT_REFUS_SERVEUR, (e) => motifs.push((e as CustomEvent<{ message: string }>).detail.message));
    b.S.updateEtudiantInfos("et-awa", { photoDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }, "u-awa");
    await b.miroir.attendreEnvois();
    expect(motifs).toEqual([expect.stringContaining("type de fichier n'est pas accepté")]);
    expect(b.envois).toHaveLength(0);
    expect(b.S.getEtudiantById("et-awa")?.photoDataUrl).toBe(lien("photos", "etudiants/et-awa/ancienne.jpg"));
  });

  it("Awa dépose sa CNI ; le secrétariat l'ouvre et l'accepte sans nouveau dépôt, refuse celle d'Ousmane et en retire le fichier ; Awa la voit fournie", async () => {
    const tables = { ...base(), pieces_etudiants: [{ id: "et-ousmane:cni", etudiant_id: "et-ousmane", piece: "cni", fichier: null, en_verification: "et-ousmane/cni/depot-1.jpg",
      depose_le: "2026-10-30T09:00:00+00:00", motif_refus: null, refuse_le: null }] };
    const fichiers = new Map([...ANCIENNE_PHOTO(), ["pieces/et-ousmane/cni/depot-1.jpg", "data:image/jpeg;base64,RkxPVQ=="]]);

    const awa = await avecBase(tables, undefined, fichiers);
    await awa.miroir.chargerMiroirs();
    awa.S.deposerDocumentEtudiant("et-awa", "cni", "data:application/pdf;base64,JVBERi0=", "u-awa", "CNI");
    await awa.miroir.attendreEnvois();
    const cni = awa.stockage[0]?.chemins[0];
    expect(awa.stockage).toEqual([{ espace: "pieces", operation: "depot", chemins: [expect.stringMatching(/^et-awa\/cni\/[\w-]+\.pdf$/)], envoisAvant: 0, type: "application/pdf" }]);
    expect(awa.envois).toEqual([{ table: "pieces_etudiants", operation: "upsert", donnees: [
      expect.objectContaining({ id: "et-awa:cni", etudiant_id: "et-awa", piece: "cni", fichier: null, en_verification: cni, motif_refus: null }),
    ] }]);

    const sec = await avecBase(tables, undefined, fichiers);
    await sec.miroir.chargerMiroirs();
    expect(sec.S.getEtudiantById("et-awa")?.piecesEnVerification?.cni?.dataUrl).toBe(lien("pieces", cni));
    sec.S.verifierPieceEtudiant("et-awa", "cni", "accepter", ADMIN, { libellePiece: "CNI" });
    sec.S.verifierPieceEtudiant("et-ousmane", "cni", "refuser", ADMIN, { motif: "Scan illisible", libellePiece: "CNI" });
    await sec.miroir.attendreEnvois();
    expect(sec.stockage).toEqual([{ espace: "pieces", operation: "retrait", chemins: ["et-ousmane/cni/depot-1.jpg"], envoisAvant: expect.any(Number) }]);
    expect(sec.envois.filter((e) => e.table === "pieces_etudiants").flatMap((e) => e.donnees as Ligne[])).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "et-awa:cni", fichier: cni, en_verification: null }),
      expect.objectContaining({ id: "et-ousmane:cni", en_verification: null, motif_refus: "Scan illisible" }),
    ]));
    expect(sec.envois).toContainEqual({ table: "etudiants_dossiers", operation: "upsert", donnees: [expect.objectContaining({ id: "et-awa", documents_fournis: ["cni"] })] });

    const awa2 = await avecBase(tables, undefined, fichiers);
    await awa2.miroir.chargerMiroirs();
    expect(awa2.S.getEtudiantById("et-awa")).toMatchObject({ documentsFournis: ["cni"], documentsFichiers: { cni: lien("pieces", cni) }, piecesEnVerification: {} });
    expect(awa2.S.getEtudiantById("et-ousmane")).toMatchObject({ piecesRefusees: { cni: expect.objectContaining({ motif: "Scan illisible" }) } });
    expect(awa2.envois).toHaveLength(0);
  });

  it("un compte qui ne lit pas les pièces (la caisse) n'en garde aucune sur son poste et n'en renvoie aucune", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ etudiants: [{ id: "et-awa", documentsFichiers: { cni: "data:image/jpeg;base64,QU5DSUVO" } }] }));
    const b = await avecBase(base(), undefined, ANCIENNE_PHOTO());
    await b.miroir.chargerMiroirs();
    expect(b.S.getEtudiantById("et-awa")?.documentsFichiers).toEqual({});
    b.S.updateEtudiantInfos("et-awa", { telephone: "771234569" }, ADMIN);
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["etudiants_dossiers"]);
    expect(b.stockage).toHaveLength(0);
  });
});

describe("miroir des étudiants : fiche, dossier personnel, inscriptions et matricules du serveur", () => {
  const CLASSE = { id: "cl-l1", nom: "LQHSE1-26/27", filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", niveau_id: "niv-l1", max: 40, delegue: "", annee: "2026-2027", salle_par_defaut_id: null, cloturee: null, date_cloture: null, cloturee_par: null, observation_cloture: null };
  const AWA = { id: "et-awa", matricule: "2026-LQHSE-0001", prenom: "Awa", nom: "SECK", sexe: "F", filiere: "LQHSE", filiere_id: "fil-qhse", classe: "LQHSE1-26/27", classe_id: "cl-l1", niveau: "L1", statut: "inscrit", annee: "2026-2027", annee_premiere_inscription: 2026 };
  const OUSMANE = { ...AWA, id: "et-ousmane", matricule: "2026-LQHSE-0002", prenom: "Ousmane", nom: "DIALLO", sexe: "M", classe: "", classe_id: null, statut: "preinscrit" };
  const DOSSIER_AWA = { id: "et-awa", email: "awa.seck@mail.sn", telephone: "770000001", date_naissance: "2005-03-12", lieu_naissance: "Dakar", pays: "Sénégal", nationalite: "Sénégalaise", cni: "2 345 2005 00067", adresse: "Dakar, Sicap", nom_tuteur: "Mme SECK", tel_tuteur: "770000009", type_admission: "nouveau", documents_fournis: ["acte_naissance"], inscription_unique_payee: true, modele_frais_id: null, motif_blocage_id: null };
  const INSCRIPTION_AWA = { id: "ins-awa-2026", etudiant_id: "et-awa", annee: "2026-2027", filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", classe: "LQHSE1-26/27", classe_id: "cl-l1", statut: "inscrit", type: "premiere", date_inscription: "2026-10-31", specialite: null, modele_frais_id: null, modele_frais: null, motif: null, effectue_par: null };
  const base = () => ({ annees_academiques: [ANNEE], filieres: [FILIERE], niveaux: [NIVEAU], classes: [CLASSE], etudiants: [AWA, OUSMANE], inscriptions: [INSCRIPTION_AWA] });

  it("à la connexion : fiches, dossiers lisibles et inscriptions de la base ; l'effectif de la classe est recompté", async () => {
    const b = await avecBase({ ...base(), etudiants_dossiers: [DOSSIER_AWA] });
    await b.miroir.chargerMiroirs();
    expect(b.S.getEtudiantById("et-awa")).toMatchObject({ cni: "2 345 2005 00067", classeId: "cl-l1", soldeDu: 0, inscriptionUniquePayee: true });
    expect(b.S.getEtudiantById("et-ousmane")).toMatchObject({ classeId: "", statut: "preinscrit", email: "", inscriptionUniquePayee: false });
    expect(b.S.getEtudiantById("et-ousmane")?.cni).toBeUndefined();
    expect(b.S.getInscriptionsByEtudiant("et-awa")).toEqual([expect.objectContaining({ id: "ins-awa-2026", classeId: "cl-l1", soldeDu: 0 })]);
    expect(b.structure.getClasseById("cl-l1")?.inscrits).toBe(1);
    expect(b.envois).toHaveLength(0);
  });

  it("inscription : matricule réservé par le serveur, fiche puis dossier puis inscription, et le compte ensuite", async () => {
    const b = await avecBase(base());
    await b.miroir.chargerMiroirs();
    const I = await import("@/data/inscriptionEtudiant");
    expect(await I.apercuMatricule("fil-qhse", "2026-2027")).toBe("2026-LQHSE-0001");
    const matricule = await I.reserverMatricule("fil-qhse", "2026-2027");
    expect(matricule).toBe("2026-LQHSE-0001");
    const e = b.S.registerNewEtudiant({ prenom: "Fatou", nom: "SOW", sexe: "F", dateNaissance: "2006-01-05", email: "fatou.sow@mail.sn", telephone: "770000003",
      filiereId: "fil-qhse", classeId: "", niveau: "L1", statut: "preinscrit", annee: "2026-2027", soldeDu: 150000, inscriptionUniquePayee: false, typeAdmission: "nouveau", cni: "1 111 2006 00001" }, matricule);
    await I.ouvrirCompteEtudiant(e, "Provisoire1");
    expect(b.envois.map((x) => x.table)).toEqual(["etudiants", "etudiants_dossiers", "inscriptions"]);
    expect(b.envois[0].donnees).toEqual([expect.objectContaining({ id: e.id, matricule: "2026-LQHSE-0001", classe_id: null, statut: "preinscrit" })]);
    expect(JSON.stringify(b.envois)).not.toContain("solde");
    expect(b.envois[1].donnees).toEqual([expect.objectContaining({ id: e.id, cni: "1 111 2006 00001", type_admission: "nouveau", modele_frais_id: null })]);
    expect(b.envois[2].donnees).toEqual([expect.objectContaining({ etudiant_id: e.id, classe_id: null, type: "premiere" })]);
    const compte = b.appels.find((a) => a.nom === "comptes")!;
    expect(compte.donnees).toMatchObject({ action: "creer", type_compte: "etudiant", identifiant: "2026-LQHSE-0001", lien_id: e.id, mot_de_passe: "Provisoire1" });
    expect(compte.envoisAvant).toBe(3);
  });

  it("un compte qui lit les fiches sans les dossiers (les professeurs, pour leurs classes, à la partie 5) : aucun dossier gardé ni renvoyé vide", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ etudiants: [{ id: "et-awa", cni: "ANCIENNE-CNI", telephone: "770000001" }] }));
    const b = await avecBase(base());
    await b.miroir.chargerMiroirs();
    expect(b.S.getEtudiantById("et-awa")?.cni).toBeUndefined();
    b.S.logAudit("u-kane", "consultation", "classe", "cl-l1");
    await b.miroir.attendreEnvois();
    expect(b.envois).toHaveLength(0);
  });

  it("Awa met à jour son téléphone : seul son dossier part", async () => {
    const b = await avecBase({ ...base(), etudiants: [AWA], etudiants_dossiers: [DOSSIER_AWA] });
    await b.miroir.chargerMiroirs();
    b.S.updateEtudiantInfos("et-awa", { telephone: "771234567", adresse: "Dakar, Mermoz" }, "u-awa");
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "etudiants_dossiers", operation: "upsert", donnees: [expect.objectContaining({ id: "et-awa", telephone: "771234567", adresse: "Dakar, Mermoz", cni: "2 345 2005 00067" })] }]);
  });
});


describe("miroir de l'emploi du temps : séances et événements", () => {
  const CLASSE = { id: "cl-l1", nom: "LQHSE1-26/27", filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", niveau_id: "niv-l1", max: 40, delegue: "", annee: "2026-2027", salle_par_defaut_id: null, cloturee: null, date_cloture: null, cloturee_par: null, observation_cloture: null };
  const SALLE = { id: "salle-a1", nom: "RDC 1A", type: "", capacite: 40, batiment: "", etage: "", equipements: [], statut: "actif" };
  const UE = { id: "ue-l1", code: "UE11", libelle: "Fondamentaux QHSE", credits: 6, filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", semestre: "S1", type: "", obligatoire: true, description: null };
  const EC = { id: "ec-qualite", code: "QHSE111", libelle: "Qualité", abrege: null, ue: "UE11", ue_id: "ue-l1", credits: 3, vol_cm: 20, vol_td: 10, vol_tp: 0, vol_tpe: 0, vht: 30, responsable: "", responsable_id: null };
  const KANE = { id: "en-kane", prenom: "Mamadou", nom: "KANE", matricule: "ENS-2026-100", sexe: "M", grade: "Vacataire", specialite: "QHSE", specialites: ["QHSE"] };
  const SEANCE = { id: "se-kane-1", ec: "Qualité", ec_id: "ec-qualite", classe: "LQHSE1-26/27", classe_id: "cl-l1", jour: 1, semaine_du: "2026-11-02", heure_debut: "08:00", heure_fin: "10:00",
    salle: "RDC 1A", salle_id: "salle-a1", prof: "Mamadou KANE", prof_id: "en-kane", type: "CM", annee: "2026-2027" };
  const base = (): Record<string, Ligne[]> => ({ annees_academiques: [ANNEE], filieres: [FILIERE], niveaux: [NIVEAU], classes: [CLASSE], salles: [SALLE], ues: [UE], ecs: [EC], enseignants: [KANE] });

  it("à la connexion : les séances lisibles par ce compte arrivent à l'écran, sans rien renvoyer", async () => {
    const b = await avecBase({ ...base(), seances: [SEANCE] });
    await b.miroir.chargerMiroirs();
    expect(b.S.getSeances()).toEqual([{ id: "se-kane-1", ec: "Qualité", ecId: "ec-qualite", classe: "LQHSE1-26/27", classeId: "cl-l1", jour: 1, semaineDu: "2026-11-02",
      heureDebut: "08:00", heureFin: "10:00", salle: "RDC 1A", salleId: "salle-a1", prof: "Mamadou KANE", profId: "en-kane", type: "CM", annee: "2026-2027" }]);
    expect(b.envois).toHaveLength(0);
  });

  it("la planification crée puis annule un créneau de KANE : il part en colonnes de la base, puis il est retiré", async () => {
    const b = await avecBase(base());
    await b.miroir.chargerMiroirs();
    const { seance } = b.S.addSeance({ ecId: "ec-qualite", classeId: "cl-l1", salleId: "salle-a1", prof: "Mamadou KANE", profId: "en-kane", jour: 3, semaineDu: "2026-11-02", heureDebut: "14:00", heureFin: "16:00", type: "TD" });
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "seances", operation: "upsert", donnees: [{ id: seance!.id, ec: "Qualité", ec_id: "ec-qualite", classe: "LQHSE1-26/27", classe_id: "cl-l1", jour: 3,
      semaine_du: "2026-11-02", heure_debut: "14:00", heure_fin: "16:00", salle: "RDC 1A", salle_id: "salle-a1", prof: "Mamadou KANE", prof_id: "en-kane", type: "TD", annee: "2026-2027" }] }]);
    expect(b.S.annulerSeance(seance!.id, "Professeur en mission", ADMIN).ok).toBe(true);
    await b.miroir.attendreEnvois();
    expect(b.envois.at(-1)).toEqual({ table: "seances", operation: "delete", donnees: [seance!.id] });
  });

  it("un événement sans classe ni salle part avec des liens vides, et revient tel quel", async () => {
    const b = await avecBase(base());
    await b.miroir.chargerMiroirs();
    const Ev = await import("@/data/evenementStore");
    const { evenement } = Ev.ajouterEvenement({ objet: "Journée portes ouvertes", date: "2026-11-07", typeId: "ts-seed-4", type: "Examen", heureDebut: "09:00", heureFin: "12:00" });
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "evenements", operation: "upsert", donnees: [expect.objectContaining({
      id: evenement!.id, objet: "Journée portes ouvertes", date: "2026-11-07", type_id: "ts-seed-4", classe_id: null, salle_id: null, surveillant: null, cree_le: evenement!.createdAt,
    })] }]);
    const autre = await avecBase({ ...base(), evenements: b.envois[0].donnees as Ligne[] });
    await autre.miroir.chargerMiroirs();
    const Ev2 = await import("@/data/evenementStore");
    expect(Ev2.getEvenements()).toEqual([expect.objectContaining({ id: evenement!.id, objet: "Journée portes ouvertes", classeId: "", salleId: "" })]);
    expect(autre.envois).toHaveLength(0);
  });
});

describe("emploi du temps et notifications tenus par la base", () => {
  const CLASSE = { id: "cl-l1", nom: "LQHSE1-26/27", filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", niveau_id: "niv-l1", max: 40, delegue: "", annee: "2026-2027", salle_par_defaut_id: null, cloturee: null, date_cloture: null, cloturee_par: null, observation_cloture: null };
  const SALLE = { id: "salle-a1", nom: "RDC 1A", type: "", capacite: 40, batiment: "", etage: "", equipements: [], statut: "actif" };
  const UE = { id: "ue-l1", code: "UE11", libelle: "Fondamentaux QHSE", credits: 6, filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", semestre: "S1", type: "", obligatoire: true, description: null };
  const EC = { id: "ec-qualite", code: "QHSE111", libelle: "Qualité", abrege: null, ue: "UE11", ue_id: "ue-l1", credits: 3, vol_cm: 20, vol_td: 10, vol_tp: 0, vol_tpe: 0, vht: 30, responsable: "", responsable_id: null };
  const AWA = { id: "et-awa", matricule: "2026-LQHSE-0001", prenom: "Awa", nom: "SECK", sexe: "F", filiere: "LQHSE", filiere_id: "fil-qhse", classe: "LQHSE1-26/27", classe_id: "cl-l1", niveau: "L1", statut: "inscrit", annee: "2026-2027", annee_premiere_inscription: 2026 };
  const base = (): Record<string, Ligne[]> => ({ annees_academiques: [ANNEE], filieres: [FILIERE], niveaux: [NIVEAU], classes: [CLASSE], salles: [SALLE], ues: [UE], ecs: [EC], etudiants: [AWA] });
  const CRENEAU = { ecId: "ec-qualite", classeId: "cl-l1", salleId: "salle-a1", prof: "Mamadou KANE", profId: "en-kane", jour: 1, semaineDu: "2026-11-02", heureDebut: "08:00", heureFin: "10:00", type: "CM" };
  const AWA_COMPTE = "00000000-0000-4000-8000-00000000000e";

  it("salle prise depuis un autre poste : la base refuse, l'écran dit pourquoi et reprend l'emploi du temps de la base", async () => {
    const b = await avecBase(base(), (table, operation) => (table === "seances" && operation === "upsert"
      ? { code: "23P01", message: "conflicting key value violates exclusion constraint \"seances_salle_libre\"" } : null));
    await b.miroir.chargerMiroirs();
    const motifs: string[] = [];
    window.addEventListener(b.miroir.EVENEMENT_REFUS_SERVEUR, (e) => motifs.push((e as CustomEvent<{ message: string }>).detail.message));
    b.S.addSeance(CRENEAU);
    await b.miroir.attendreEnvois();
    expect(motifs).toEqual(["La base a refusé : la salle est déjà occupée sur ce créneau (enregistré depuis un autre poste ?). L'écran a été remis à jour."]);
    expect(b.S.getSeances()).toEqual([]);
  });

  it("avec la base, l'application n'écrit plus elle-même les notifications d'emploi du temps : c'est la base qui prévient Awa", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: [{ id: "u-awa", role: "student", linkedId: "et-awa", displayName: "Awa SECK", email: "awa.seck@mail.sn", identifiant: "2026-LQHSE-0001", actif: true }] }));
    const b = await avecBase(base());
    await b.miroir.chargerMiroirs();
    b.S.addSeance(CRENEAU);
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["seances"]);
    expect(b.S.getNotifications()).toEqual([]);
  });

  it("la cloche d'Awa : notifications de la base à la connexion ; « lue » seule repart ; une notification du poste reste et ne part pas", async () => {
    const b = await avecBase({ ...base(), notifications: [
      { id: 7, destinataire: AWA_COMPTE, message: "Emploi du temps : 2 nouveaux créneaux ajoutés — dernier : Qualité le lundi 09/11 à 08:00", cree_le: "2026-10-31T08:00:00+00:00",
        lue: false, lue_le: null, archivee: false, groupe: "edt-nouveaux-creneaux", nombre: 2 },
    ] });
    await b.miroir.chargerMiroirs();
    expect(b.S.getNotifications()).toEqual([{ id: "7", userId: AWA_COMPTE, message: "Emploi du temps : 2 nouveaux créneaux ajoutés — dernier : Qualité le lundi 09/11 à 08:00",
      createdAt: "2026-10-31T08:00:00+00:00", read: false, readAt: undefined, archived: false, groupe: "edt-nouveaux-creneaux", nombre: 2 }]);
    b.S.markNotificationRead("7", AWA_COMPTE);
    b.S.pushNotificationEtPersister(AWA_COMPTE, "Message créé sur ce poste");
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "notifications", operation: "update", donnees: { lue: true, archivee: false } }]);
    await b.miroir.chargerMiroirs();
    expect(b.S.getNotifications().map((n) => n.message)).toEqual([expect.stringContaining("2 nouveaux créneaux"), "Message créé sur ce poste"]);
    expect(b.S.getNotifications()[0].read).toBe(true);
  });
});
