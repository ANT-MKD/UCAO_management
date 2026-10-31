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
  /** Ce qu'un déclencheur de la base change à une ligne écrite (ex. le numéro d'une génération). */
  declencheur?: (table: string, ligne: Ligne) => Ligne,
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
  /** Compteurs de changements de la base (versions_donnees), que le test fait avancer. */
  const compteurs: Record<string, number> = {};
  /** Tables lues, dans l'ordre (une entrée par page lue). */
  const lectures: string[] = [];
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
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    rpc: async (nom: string, args: Record<string, unknown>) => {
      if (nom === "versions_donnees") return { data: { ...compteurs }, error: null };
      appels.push({ nom, donnees: args, envoisAvant: envois.length });
      if (nom === "attribuer_matricule") return { data: `2026-LQHSE-${String(prochainMatricule++).padStart(4, "0")}`, error: null };
      if (nom === "apercu_matricule") return { data: `2026-LQHSE-${String(prochainMatricule).padStart(4, "0")}`, error: null };
      if (nom === "attribuer_numero_contrat") return { data: "CTR-0007", error: null };
      if (nom === "attribuer_numero_attestation") return { data: "ATT-2026-007", error: null };
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
        // Portée : colonne de la table, ou de la table liée (« cahiers.annee » : par cahier_id ;
        // « deliberations_annuelles.annee » : par deliberation_id).
        let garder: ((l: Ligne) => boolean) | undefined;
        const q = {
          in: (colonne: string, valeurs: string[]) => {
            const [liee, champ] = colonne.includes(".") ? colonne.split(".") : [undefined, colonne];
            garder = (l) => {
              const cle = liee?.startsWith("deliberations") ? "deliberation_id" : `${liee?.replace(/s$/, "")}_id`;
              const source = liee ? (tables[liee] ?? []).find((p) => p.id === l[cle]) : l;
              return !!source && valeurs.includes(String(source[champ]));
            };
            return q;
          },
          order: () => q,
          range: async (debut: number, fin: number) => {
            lectures.push(table);
            return { data: (tables[table] ?? []).filter((l) => !garder || garder(l)).slice(debut, fin + 1), error: null };
          },
        };
        return q;
      },
      upsert: async (lignes: Ligne[]) => {
        envois.push({ table, operation: "upsert", donnees: lignes });
        const e = refus?.(table, "upsert") ?? null;
        if (!e) {
          const t = (tables[table] ??= []);
          for (const envoyee of lignes) {
            const l = declencheur ? declencheur(table, { ...envoyee }) : envoyee;
            const i = t.findIndex((x) => x.id === l.id);
            if (i >= 0) t[i] = l; else t.push(l);
          }
        }
        return { error: e };
      },
      insert: async (lignes: Ligne[]) => {
        envois.push({ table, operation: "insert", donnees: lignes });
        const e = refus?.(table, "insert") ?? null;
        if (!e) {
          const t = (tables[table] ??= []);
          for (const envoyee of lignes) t.push(declencheur ? declencheur(table, { ...envoyee }) : envoyee);
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
    compteurs,
    lectures,
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
    // Le solde ne part pas avec la fiche : il part en mouvement, que la base additionne (partie 7).
    expect(b.envois.map((x) => x.table)).toEqual(["etudiants", "etudiants_dossiers", "inscriptions", "mouvements_solde"]);
    expect(b.envois[0].donnees).toEqual([expect.objectContaining({ id: e.id, matricule: "2026-LQHSE-0001", classe_id: null, statut: "preinscrit" })]);
    expect(JSON.stringify(b.envois.slice(0, 3))).not.toContain("solde");
    expect(b.envois[3]).toEqual({ table: "mouvements_solde", operation: "insert", donnees: [expect.objectContaining({ etudiant_id: e.id, delta_du: 150000,
      delta_avoir: 0, delta_paye: 0, quittance_id: null, motif: "Inscription" })] });
    expect(b.envois[1].donnees).toEqual([expect.objectContaining({ id: e.id, cni: "1 111 2006 00001", type_admission: "nouveau", modele_frais_id: null })]);
    expect(b.envois[2].donnees).toEqual([expect.objectContaining({ etudiant_id: e.id, classe_id: null, type: "premiere" })]);
    const compte = b.appels.find((a) => a.nom === "comptes")!;
    expect(compte.donnees).toMatchObject({ action: "creer", type_compte: "etudiant", identifiant: "2026-LQHSE-0001", lien_id: e.id, mot_de_passe: "Provisoire1" });
    expect(compte.envoisAvant).toBe(4);
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

  it("la cloche d'Awa : notifications de la base à la connexion ; « lue » seule repart ; une notification écrite sur un poste part par la base, sauf un message", async () => {
    const b = await avecBase({ ...base(), notifications: [
      { id: 7, destinataire: AWA_COMPTE, message: "Emploi du temps : 2 nouveaux créneaux ajoutés — dernier : Qualité le lundi 09/11 à 08:00", cree_le: "2026-10-31T08:00:00+00:00",
        lue: false, lue_le: null, archivee: false, groupe: "edt-nouveaux-creneaux", nombre: 2 },
    ] });
    await b.miroir.chargerMiroirs();
    expect(b.S.getNotifications()).toEqual([{ id: "7", userId: AWA_COMPTE, message: "Emploi du temps : 2 nouveaux créneaux ajoutés — dernier : Qualité le lundi 09/11 à 08:00",
      createdAt: "2026-10-31T08:00:00+00:00", read: false, readAt: undefined, archived: false, groupe: "edt-nouveaux-creneaux", nombre: 2 }]);
    b.S.markNotificationRead("7", AWA_COMPTE);
    b.S.pushNotificationEtPersister(AWA_COMPTE, "Affecté à la classe LQHSE1-26/27");
    // Les messages ne passent par la base qu'avec la partie Communication : leur notification reste ici.
    b.S.pushNotificationEtPersister(AWA_COMPTE, "Nouveau message : réunion de rentrée", true);
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "notifications", operation: "update", donnees: { lue: true, archivee: false } }]);
    expect(b.appels).toEqual([expect.objectContaining({ nom: "notifier",
      donnees: { p_destinataire: AWA_COMPTE, p_message: "Affecté à la classe LQHSE1-26/27", p_groupe: null, p_message_groupe: null } })]);
    await b.miroir.chargerMiroirs();
    expect(b.S.getNotifications().map((n) => n.message)).toEqual([expect.stringContaining("2 nouveaux créneaux"), "Nouveau message : réunion de rentrée"]);
    expect(b.S.getNotifications()[0].read).toBe(true);
  });
});

describe("miroir des cahiers de séance, de l'appel et des pointages", () => {
  const CLASSE = { id: "cl-l1", nom: "LQHSE1-26/27", filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", niveau_id: "niv-l1", max: 40, delegue: "", annee: "2026-2027", salle_par_defaut_id: null, cloturee: null, date_cloture: null, cloturee_par: null, observation_cloture: null };
  const SALLE = { id: "salle-a1", nom: "RDC 1A", type: "", capacite: 40, batiment: "", etage: "", equipements: [], statut: "actif" };
  const UE = { id: "ue-l1", code: "UE11", libelle: "Fondamentaux QHSE", credits: 6, filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", semestre: "S1", type: "", obligatoire: true, description: null };
  const EC = { id: "ec-qualite", code: "QHSE111", libelle: "Qualité", abrege: null, ue: "UE11", ue_id: "ue-l1", credits: 3, vol_cm: 20, vol_td: 10, vol_tp: 0, vol_tpe: 0, vht: 30, responsable: "", responsable_id: null };
  const AWA = { id: "et-awa", matricule: "2026-LQHSE-0001", prenom: "Awa", nom: "SECK", sexe: "F", filiere: "LQHSE", filiere_id: "fil-qhse", classe: "LQHSE1-26/27", classe_id: "cl-l1", niveau: "L1", statut: "inscrit", annee: "2026-2027", annee_premiere_inscription: 2026 };
  const OUSMANE = { ...AWA, id: "et-ousmane", matricule: "2026-LQHSE-0002", prenom: "Ousmane", nom: "DIALLO", sexe: "M" };
  const SEANCE = { id: "se-kane", ec: "Qualité", ec_id: "ec-qualite", classe: "LQHSE1-26/27", classe_id: "cl-l1", jour: 1, semaine_du: "2024-09-02", heure_debut: "08:00", heure_fin: "10:00",
    salle: "RDC 1A", salle_id: "salle-a1", prof: "Mamadou KANE", prof_id: "en-kane", type: "CM", annee: "2026-2027" };
  const base = (): Record<string, Ligne[]> => ({ annees_academiques: [ANNEE], filieres: [FILIERE], niveaux: [NIVEAU], classes: [CLASSE], salles: [SALLE], ues: [UE], ecs: [EC],
    etudiants: [AWA, OUSMANE], seances: [SEANCE] });
  const CAHIER = { id: "cah-kane", seance_id: "se-kane", annee: "2026-2027", semestre: "S1", departement: "Direction des études", filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1",
    ue: "UE11 — Fondamentaux QHSE", ue_id: "ue-l1", ec: "QHSE111 — Qualité", ec_id: "ec-qualite", classe_id: "cl-l1", classe: "LQHSE1-26/27", prof: "Mamadou KANE", prof_id: "en-kane",
    salle: "RDC 1A", salle_id: "salle-a1", date: "2024-09-02", heure_debut: "08:00", heure_fin: "10:00", type_seance: "CM", sujet: "Norme ISO 9001", resume: "Principes",
    competences: "", liens_externes: [], travail: null, evaluation: null, taux_presence: 50, etat_seance: "realisee", motif_annulation: null, statut: "soumis", valide_par: null,
    cree_le: "2024-09-02T10:00:00+00:00", modifie_le: "2024-09-02T10:00:00+00:00" };

  it("KANE soumet son cahier : le cahier, puis l'appel, puis la photo du tableau, déposée d'abord ; la base prévient, pas le poste", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: [{ id: "u-admin", role: "admin", displayName: "Fatou DIOP", email: "f.diop@ucao.edu", identifiant: "ADM", actif: true }] }));
    const b = await avecBase(base());
    await b.miroir.chargerMiroirs();
    const cahier = b.S.submitCahierSeance({ seanceId: "se-kane", prof: "Mamadou KANE", date: "2024-09-02", sujet: "Norme ISO 9001", resume: "Principes du management de la qualité",
      photosTableau: ["data:image/jpeg;base64,VEFCTEVBVQ=="], etatSeance: "realisee",
      presences: [{ etudiantId: "et-awa", nom: "Awa SECK", statut: "absent" }, { etudiantId: "et-ousmane", nom: "Ousmane DIALLO", statut: "present" }] });
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["cahiers", "presences", "cahiers_fichiers"]);
    expect(b.envois[0].donnees).toEqual([expect.objectContaining({ id: cahier.id, seance_id: "se-kane", prof_id: "en-kane", statut: "soumis", date: "2024-09-02", taux_presence: 50, valide_par: null })]);
    expect(b.envois[1].donnees).toEqual([
      { id: `${cahier.id}:et-awa`, cahier_id: cahier.id, etudiant_id: "et-awa", nom: "Awa SECK", statut: "absent", justification: null, retard_minutes: null, ordre: 0 },
      { id: `${cahier.id}:et-ousmane`, cahier_id: cahier.id, etudiant_id: "et-ousmane", nom: "Ousmane DIALLO", statut: "present", justification: null, retard_minutes: null, ordre: 1 },
    ]);
    const photo = b.stockage[0]?.chemins[0];
    expect(b.stockage).toEqual([{ espace: "cahiers", operation: "depot", chemins: [expect.stringMatching(new RegExp(`^${cahier.id}/[\\w-]+\\.jpg$`))], envoisAvant: 2, type: "image/jpeg" }]);
    expect(b.envois[2].donnees).toEqual([{ id: `${cahier.id}:photo:0`, cahier_id: cahier.id, genre: "photo", ordre: 0, nom: "Photo 1", type: "", taille_ko: null, ref: null, chemin: photo }]);
    expect(b.S.getNotifications()).toEqual([]);
  });

  it("la validation d'un cahier : le pointage n'est pas créé par le poste, il arrive de la base juste après", async () => {
    const tables = { ...base(), cahiers: [CAHIER] as Ligne[], presences: [] as Ligne[] };
    const b = await avecBase(tables);
    await b.miroir.chargerMiroirs();
    const P = await import("@/data/pointageStore");
    expect(b.S.validateCahier("cah-kane", ADMIN, true)).toEqual({ volumePointe: 2 });
    // Ce que fait la base à la validation : le pointage du cahier, à confirmer.
    tables.pointages = [{ id: "ptg-cah-kane", teacher_id: "en-kane", ec_id: "ec-qualite", classe_id: "cl-l1", annee: "2026-2027", seance_id: "se-kane", cahier_id: "cah-kane",
      date: "2024-09-02", heure_debut: "08:00", heure_fin: "10:00", type: "CM", salle_id: "salle-a1", volume_pointe: 2, remarque: "Créé depuis le cahier de séance validé — QHSE111 — Qualité",
      statut: "soumis", motif_rejet: null, cree_le: "2024-09-03T08:00:00+00:00" }];
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "cahiers", operation: "upsert", donnees: [expect.objectContaining({ id: "cah-kane", statut: "valide", valide_par: ADMIN })] }]);
    expect(P.getPointages()).toEqual([expect.objectContaining({ id: "ptg-cah-kane", teacherId: "en-kane", cahierId: "cah-kane", volumePointe: 2, statut: "soumis" })]);
    P.updatePointageStatut("ptg-cah-kane", "valide");
    await b.miroir.attendreEnvois();
    expect(b.envois.at(-1)).toEqual({ table: "pointages", operation: "upsert", donnees: [expect.objectContaining({ id: "ptg-cah-kane", statut: "valide" })] });
  });

  it("sur le poste d'Awa : le cahier soumis de sa classe, sa seule présence, la photo du tableau en lien signé ; rien ne repart", async () => {
    const b = await avecBase({ ...base(), etudiants: [AWA], cahiers: [CAHIER],
      presences: [{ id: "cah-kane:et-awa", cahier_id: "cah-kane", etudiant_id: "et-awa", nom: "Awa SECK", statut: "absent", justification: null, retard_minutes: null, ordre: 0 }],
      cahiers_fichiers: [{ id: "cah-kane:photo:0", cahier_id: "cah-kane", genre: "photo", ordre: 0, nom: "Photo 1", type: "", taille_ko: null, ref: null, chemin: "cah-kane/tableau.jpg" },
        { id: "cah-kane:piece:pj-1", cahier_id: "cah-kane", genre: "piece", ordre: 0, nom: "Cours.pdf", type: "application/pdf", taille_ko: 120, ref: "Cours.pdf", chemin: "cah-kane/cours.pdf" }] },
      undefined, new Map([["cahiers/cah-kane/tableau.jpg", "data:image/jpeg;base64,VEFCTEVBVQ=="], ["cahiers/cah-kane/cours.pdf", "data:application/pdf;base64,JVBERi0="]]));
    await b.miroir.chargerMiroirs();
    const cahier = b.S.getCahierById("cah-kane")!;
    expect(cahier).toMatchObject({ sujet: "Norme ISO 9001", statut: "soumis", absents: ["et-awa"],
      presences: [{ etudiantId: "et-awa", nom: "Awa SECK", statut: "absent", justification: undefined, retardMinutes: undefined }],
      photosTableau: ["https://exemple.supabase.co/storage/v1/object/sign/cahiers/cah-kane/tableau.jpg?token=essai"],
      piecesJointes: [{ id: "pj-1", nom: "Cours.pdf", type: "application/pdf", tailleKo: 120, ref: "Cours.pdf", dataUrl: "https://exemple.supabase.co/storage/v1/object/sign/cahiers/cah-kane/cours.pdf?token=essai" }] });
    b.S.logAudit("u-awa", "consultation", "cahier", "cah-kane");
    await b.miroir.attendreEnvois();
    expect(b.envois).toHaveLength(0);
  });

  it("seuls les cahiers et l'appel de l'année en cours sont chargés ; une année passée l'est à la demande, sans rien supprimer", async () => {
    const ANCIEN = { ...CAHIER, id: "cah-2025", annee: "2025-2026", date: "2025-11-03" };
    const b = await avecBase({ ...base(), annees_academiques: [{ ...ANNEE, id: "annee-2025", libelle: "2025-2026", actuelle: false }, ANNEE],
      cahiers: [CAHIER, ANCIEN],
      presences: [{ id: "cah-kane:et-awa", cahier_id: "cah-kane", etudiant_id: "et-awa", nom: "Awa SECK", statut: "absent", justification: null, retard_minutes: null, ordre: 0 },
        { id: "cah-2025:et-awa", cahier_id: "cah-2025", etudiant_id: "et-awa", nom: "Awa SECK", statut: "retard", justification: null, retard_minutes: 10, ordre: 0 }] });
    await b.miroir.chargerMiroirs();
    expect(b.S.getCahiers().map((c) => c.id)).toEqual(["cah-kane"]);
    // Un cahier de l'année en cours validé : rien de l'année passée n'est supprimé.
    b.S.validateCahier("cah-kane", ADMIN, false);
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.operation)).toEqual(["upsert"]);
    b.S.demanderCahiersAnnee("2025-2026");
    await b.miroir.attendreEnvois();
    expect(b.S.getCahiers().map((c) => c.id).sort()).toEqual(["cah-2025", "cah-kane"]);
    expect(b.S.getCahierById("cah-2025")?.presences).toEqual([{ etudiantId: "et-awa", nom: "Awa SECK", statut: "retard", justification: undefined, retardMinutes: 10 }]);
  });

  it("absence par période et portefeuille de cours : en colonnes de la base, la dernière action du portefeuille en tête au retour", async () => {
    const b = await avecBase({ ...base(), portefeuille_cours: [
      { id: "pf-1700000000000-0-aaaa", etudiant_id: "et-awa", etudiant: "Awa SECK", matricule: "2026-LQHSE-0001", classe_id: "cl-l1", classe: "LQHSE1-26/27", ec_id: "ec-qualite", ec: "Qualité", action: "ajout", date_action: "2026-10-01", effectue_par: "Scolarité", motif: null },
      { id: "pf-1800000000000-0-bbbb", etudiant_id: "et-awa", etudiant: "Awa SECK", matricule: "2026-LQHSE-0001", classe_id: "cl-l1", classe: "LQHSE1-26/27", ec_id: "ec-qualite", ec: "Qualité", action: "retrait", date_action: "2026-10-05", effectue_par: "Scolarité", motif: null },
    ] });
    await b.miroir.chargerMiroirs();
    const Pf = await import("@/data/portefeuilleCoursStore");
    expect(Pf.estEcRetireePourEtudiant("et-awa", "cl-l1", "ec-qualite")).toBe(true);
    const Ap = await import("@/data/absencePeriodeStore");
    Ap.declarerAbsencesPeriode({ etudiants: [{ etudiantId: "et-ousmane", etudiant: "Ousmane DIALLO", matricule: "2026-LQHSE-0002", justifie: true, justificatif: "Certificat médical" }],
      classeId: "cl-l1", classe: "LQHSE1-26/27", filiereId: "fil-qhse", filiere: "LQHSE", niveau: "L1", annee: "2026-2027", dateDebut: "2026-11-02", dateFin: "2026-11-06",
      motif: "Hospitalisation", declarePar: "Scolarité" });
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "absences_periodes", operation: "upsert", donnees: [expect.objectContaining({
      etudiant_id: "et-ousmane", classe_id: "cl-l1", date_debut: "2026-11-02", date_fin: "2026-11-06", justifie: true, justificatif: "Certificat médical" })] }]);
  });
});

describe("miroir du dossier administratif des enseignants", () => {
  const COURS = { teacher_id: "en-kane", ec_id: "ec-qualite", classe_id: "cl-l1", annee: "2026-2027" };
  const ABSENCE = { id: "abs-kane", ...COURS, seance_id: null, date: "2026-11-02", type: "absence", duree_minutes: null, motif: "Absent au cours de 8 h", justifie: false,
    cree_par: "u-admin", cree_le: "2026-11-02T10:00:00+00:00", justificatif_motif: null, justificatif_piece_nom: null, justificatif_piece: null, justificatif_envoye_le: null,
    refus_motif: null, refus_motif_refus: null, refus_le: null };
  const KANE = { id: "u-kane", role: "teacher", displayName: "Mamadou KANE", email: "m.kane@ucao.edu", identifiant: "KANE", actif: true, linkedId: "en-kane" };

  it("un constat saisi par l'administration part en colonnes de la base ; c'est la base qui prévient KANE", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: [KANE] }));
    const b = await avecBase({ annees_academiques: [ANNEE] });
    await b.miroir.chargerMiroirs();
    const A = await import("@/data/teacherAbsenceStore");
    const constat = A.addTeacherAbsence({ teacherId: "en-kane", ecId: "ec-qualite", classeId: "cl-l1", annee: "2026-2027", date: "2026-11-02", type: "retard", dureeMinutes: 20,
      motif: "Retard au cours de 8 h", justifie: false, createdBy: "u-admin" });
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "absences_enseignants", operation: "upsert", donnees: [{ id: constat.id, ...COURS, seance_id: null, date: "2026-11-02", type: "retard",
      duree_minutes: 20, motif: "Retard au cours de 8 h", justifie: false, cree_par: "u-admin", cree_le: constat.createdAt, justificatif_motif: null, justificatif_piece_nom: null,
      justificatif_piece: null, justificatif_envoye_le: null, refus_motif: null, refus_motif_refus: null, refus_le: null }] }]);
    expect(b.S.getNotifications()).toEqual([]);
  });

  it("KANE justifie son absence : la pièce est déposée dans son dossier, puis simple mise à jour ; refusée, la pièce est retirée et le refus revient à l'écran", async () => {
    const tables: Record<string, Ligne[]> = { annees_academiques: [ANNEE], absences_enseignants: [{ ...ABSENCE }] };
    const b = await avecBase(tables, (table, operation) => (table === "absences_enseignants" && operation === "upsert" && localStorage.getItem("essai-poste") === "kane"
      ? { code: "42501", message: "new row violates row-level security policy" } : null));
    localStorage.setItem("essai-poste", "kane");
    await b.miroir.chargerMiroirs();
    const A = await import("@/data/teacherAbsenceStore");
    A.envoyerJustificatifAbsence("abs-kane", { motif: "Certificat médical", pieceJointe: { nom: "certificat.pdf", dataUrl: "data:application/pdf;base64,JVBERi0=" } }, "u-kane");
    await b.miroir.attendreEnvois();
    const piece = b.stockage[0]?.chemins[0];
    expect(b.stockage).toEqual([{ espace: "justificatifs", operation: "depot", chemins: [expect.stringMatching(/^en-kane\/abs-kane\/[\w-]+\.pdf$/)], envoisAvant: 0, type: "application/pdf" }]);
    expect(b.envois.map((e) => e.operation)).toEqual(["upsert", "update"]);
    expect(b.envois[1].donnees).toMatchObject({ justificatif_motif: "Certificat médical", justificatif_piece_nom: "certificat.pdf", justificatif_piece: piece });
    expect(b.S.getNotifications()).toEqual([]);

    // Le secrétariat refuse le justificatif : le constat repart sans pièce, la pièce est retirée.
    localStorage.setItem("essai-poste", "admin");
    await b.miroir.chargerMiroirs();
    expect(A.getTeacherAbsences()[0].justificatif?.pieceJointe).toEqual({ nom: "certificat.pdf", dataUrl: `https://exemple.supabase.co/storage/v1/object/sign/justificatifs/${piece}?token=essai` });
    A.deciderJustificatifAbsence("abs-kane", "refuser", "u-admin", "Certificat illisible");
    await b.miroir.attendreEnvois();
    expect(b.envois.at(-1)).toEqual({ table: "absences_enseignants", operation: "upsert", donnees: [expect.objectContaining({ id: "abs-kane", justificatif_motif: null,
      justificatif_piece: null, refus_motif: "Certificat médical", refus_motif_refus: "Certificat illisible" })] });
    expect(b.stockage.at(-1)).toEqual({ espace: "justificatifs", operation: "retrait", chemins: [piece], envoisAvant: 3 });
    expect(A.statutJustificationAbsence(A.getTeacherAbsences()[0])).toBe("justificatif_refuse");
  });

  it("rallonge validée : seule la décision part ; le nouveau volume du cours vient de la base, pas du poste", async () => {
    const RALLONGE = { id: "rlg-kane", ...COURS, vh_actuel: 30, vh_supplementaire: 6, motif: "Chapitre ajouté", statut: "soumis", motif_rejet: null, origine: "prof",
      cree_le: "2026-11-02T10:00:00+00:00", date_traitement: null };
    const tables: Record<string, Ligne[]> = { annees_academiques: [ANNEE], rallonges: [RALLONGE], volumes_enseignants: [] };
    const b = await avecBase(tables);
    await b.miroir.chargerMiroirs();
    const R = await import("@/data/rallongeStore");
    const V = await import("@/data/teacherVolumeStore");
    R.updateRallongeStatut("rlg-kane", "valide");
    // Ce que fait la base à la validation : 30 h + 6 h.
    tables.volumes_enseignants = [{ id: "en-kane:2026-2027:ec-qualite:cl-l1", ...COURS, nouveau_vh: 36 }];
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "rallonges", operation: "upsert", donnees: [expect.objectContaining({ id: "rlg-kane", statut: "valide", vh_supplementaire: 6 })] }]);
    expect(V.getTeacherVolumes()).toEqual([{ id: "en-kane:2026-2027:ec-qualite:cl-l1", teacherId: "en-kane", ecId: "ec-qualite", classeId: "cl-l1", annee: "2026-2027", nouveauVh: 36 }]);
    expect(b.S.getNotifications()).toEqual([]);
  });

  it("nouveau contrat : numéro attribué par la base, lignes et avenants en JSON ; c'est la base qui prévient KANE", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: [KANE] }));
    const b = await avecBase({ annees_academiques: [ANNEE] });
    await b.miroir.chargerMiroirs();
    const C = await import("@/data/teacherContractStore");
    const numero = await C.reserverNumeroContrat();
    expect(b.appels).toEqual([{ nom: "attribuer_numero_contrat", donnees: undefined, envoisAvant: 0 }]);
    const lignes = [{ ecId: "ec-qualite", classeId: "cl-l1", modePaiement: "taux_horaire" as const, montant: 15000 }];
    C.addTeacherContract({ teacherId: "en-kane", annee: "2026-2027", dateDebut: "2026-11-02", dateFin: "2027-07-31", lignes }, numero);
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "contrats_enseignants", operation: "upsert", donnees: [expect.objectContaining({ id: "CTR-0007", teacher_id: "en-kane",
      date_debut: "2026-11-02", date_fin: "2027-07-31", lignes, avenants: [], resilie: false, date_resiliation: null })] }]);
    expect(b.S.getNotifications()).toEqual([]);
  });

  it("taux, statut du cours et vacation payée : en colonnes de la base, sans notification du poste", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: [KANE] }));
    const b = await avecBase({ annees_academiques: [ANNEE], vacations: [{ id: "va-kane", mois: "Novembre 2026", enseignant: "Mamadou KANE", enseignant_id: "en-kane",
      modules: ["Qualité"], heures_cm: 10, heures_td: 2, taux_horaire: 15000, montant_total: 180000, statut: "valide", moyen: "", observations: null }] });
    await b.miroir.chargerMiroirs();
    const T = await import("@/data/teacherRateStore");
    const St = await import("@/data/teacherCourseStatusStore");
    const Va = await import("@/data/vacationStore");
    T.upsertTeacherRates([{ id: "en-kane:2026-2027:ec-qualite:cl-l1", teacherId: "en-kane", ecId: "ec-qualite", classeId: "cl-l1", annee: "2026-2027", modePaiement: "taux_horaire", montant: 15000, tauxAbatt: 5 }]);
    St.upsertTeacherCourseStatuses([{ id: "en-kane:2026-2027:ec-qualite:cl-l1", teacherId: "en-kane", ecId: "ec-qualite", classeId: "cl-l1", annee: "2026-2027", typeComptabilisation: "a_terme" }]);
    Va.markVacationPaid("va-kane", "Virement", "u-admin");
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([
      { table: "taux_enseignants", operation: "upsert", donnees: [{ id: "en-kane:2026-2027:ec-qualite:cl-l1", ...COURS, mode_paiement: "taux_horaire", montant: 15000, taux_abatt: 5 }] },
      { table: "statuts_cours_enseignants", operation: "upsert", donnees: [{ id: "en-kane:2026-2027:ec-qualite:cl-l1", ...COURS, type_comptabilisation: "a_terme" }] },
      { table: "vacations", operation: "upsert", donnees: [expect.objectContaining({ id: "va-kane", statut: "paye", moyen: "Virement", montant_total: 180000, modules: ["Qualité"] })] },
    ]);
    expect(b.S.getNotifications()).toEqual([]);
  });
});

describe("suivi des changements faits ailleurs", () => {
  const POINTAGE = { id: "ptg-cah-kane", teacher_id: "en-kane", ec_id: "ec-qualite", classe_id: "cl-l1", annee: "2026-2027", seance_id: null, cahier_id: null,
    date: "2026-11-02", heure_debut: "08:00", heure_fin: "10:00", type: "CM", salle_id: null, volume_pointe: 2, remarque: "", statut: "soumis", motif_rejet: null,
    cree_le: "2026-11-02T10:00:00+00:00" };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("un pointage créé par la base (cahier validé sur un autre poste) arrive à l'écran : seule cette table est relue", async () => {
    const tables: Record<string, Ligne[]> = { annees_academiques: [ANNEE], pointages: [] };
    const b = await avecBase(tables);
    await b.miroir.chargerMiroirs();
    const P = await import("@/data/pointageStore");
    await b.miroir.verifierChangements();
    b.lectures.length = 0;
    tables.pointages = [POINTAGE];
    b.compteurs.pointages = 1;
    await b.miroir.verifierChangements();
    expect(b.lectures).toEqual(["pointages"]);
    expect(P.getPointages()).toEqual([expect.objectContaining({ id: "ptg-cah-kane", teacherId: "en-kane", volumePointe: 2, statut: "soumis" })]);
    // Plus rien n'a changé : rien n'est relu.
    b.lectures.length = 0;
    await b.miroir.verifierChangements();
    expect(b.lectures).toEqual([]);
    expect(b.envois).toEqual([]);
  });

  it("une modification saisie sur ce poste pendant le tour n'est pas écrasée : elle part, la table est relue au tour suivant", async () => {
    const tables: Record<string, Ligne[]> = { annees_academiques: [ANNEE], pointages: [{ ...POINTAGE }] };
    const b = await avecBase(tables);
    await b.miroir.chargerMiroirs();
    const P = await import("@/data/pointageStore");
    // Un autre poste a touché aux pointages ; ici, le pointage est validé au même moment.
    b.compteurs.pointages = 1;
    const tour = b.miroir.verifierChangements();
    P.updatePointageStatut("ptg-cah-kane", "valide");
    await tour;
    await b.miroir.attendreEnvois();
    expect(P.getPointages()[0].statut).toBe("valide");
    expect(b.envois).toEqual([{ table: "pointages", operation: "upsert", donnees: [expect.objectContaining({ id: "ptg-cah-kane", statut: "valide" })] }]);
    b.lectures.length = 0;
    b.compteurs.pointages = 2;
    await b.miroir.verifierChangements();
    expect(b.lectures).toEqual(["pointages"]);
    expect(P.getPointages()[0].statut).toBe("valide");
  });

  it("une grosse table (l'appel de toute l'université) se relit au plus toutes les quelques minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T08:00:00Z"));
    const pointages = Array.from({ length: 6000 }, (_, i) => ({ ...POINTAGE, id: `ptg-${String(i).padStart(5, "0")}` }));
    const tables: Record<string, Ligne[]> = { annees_academiques: [ANNEE], pointages };
    const b = await avecBase(tables);
    await b.miroir.chargerMiroirs();
    b.compteurs.pointages = 1;
    b.lectures.length = 0;
    vi.setSystemTime(new Date("2026-11-02T08:00:30Z"));
    await b.miroir.verifierChangements();
    expect(b.lectures).toEqual([]);
    vi.setSystemTime(new Date("2026-11-02T08:01:01Z"));
    await b.miroir.verifierChangements();
    // 6 000 lignes : 6 pages pleines, puis une page vide.
    expect(b.lectures.filter((t) => t === "pointages")).toHaveLength(7);
  });

  it("envoi refusé après le dépôt d'un fichier : le fichier déposé est retiré de l'espace de fichiers", async () => {
    const ABSENCE = { id: "abs-kane", teacher_id: "en-kane", ec_id: "ec-qualite", classe_id: "cl-l1", annee: "2026-2027", seance_id: null, date: "2026-11-02", type: "absence",
      duree_minutes: null, motif: "", justifie: false, cree_par: "u-admin", cree_le: "2026-11-02T10:00:00+00:00", justificatif_motif: null, justificatif_piece_nom: null,
      justificatif_piece: null, justificatif_envoye_le: null, refus_motif: null, refus_motif_refus: null, refus_le: null };
    // Le constat a été justifié entre-temps : la base ne laisse plus KANE y joindre un justificatif.
    const b = await avecBase({ annees_academiques: [ANNEE], absences_enseignants: [ABSENCE] },
      (table, operation) => (table === "absences_enseignants" ? { code: operation === "update" ? "0 lignes" : "42501", message: "new row violates row-level security policy" } : null));
    await b.miroir.chargerMiroirs();
    const A = await import("@/data/teacherAbsenceStore");
    A.envoyerJustificatifAbsence("abs-kane", { motif: "Certificat médical", pieceJointe: { nom: "certificat.pdf", dataUrl: "data:application/pdf;base64,JVBERi0=" } }, "u-kane");
    await b.miroir.attendreEnvois();
    const depot = b.stockage.find((s) => s.operation === "depot");
    expect(depot?.chemins[0]).toMatch(/^en-kane\/abs-kane\/[\w-]+\.pdf$/);
    expect(b.stockage.at(-1)).toEqual({ espace: "justificatifs", operation: "retrait", chemins: depot!.chemins, envoisAvant: 2 });
    expect(b.fichiers.size).toBe(0);
    expect(A.getTeacherAbsences()[0].justificatif).toBeUndefined();
  });

  it("pièces et blocage : avec la base, le poste n'écrit plus ces notifications (c'est la base qui prévient)", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: [
      { id: "u-admin", role: "admin", displayName: "Secrétariat", email: "secretariat@ucao.edu", identifiant: "ADM", actif: true },
      { id: "u-awa", role: "student", displayName: "Awa SECK", email: "awa@ucao.edu", identifiant: "2026-LQHSE-0001", actif: true, linkedId: "et-awa" },
    ] }));
    const AWA = { id: "et-awa", matricule: "2026-LQHSE-0001", prenom: "Awa", nom: "SECK", sexe: "F", filiere: "LQHSE", filiere_id: "fil-qhse", classe: "", classe_id: null,
      niveau: "L1", statut: "preinscrit", annee: "2026-2027", annee_premiere_inscription: 2026 };
    const b = await avecBase({ annees_academiques: [ANNEE], filieres: [FILIERE], niveaux: [NIVEAU], etudiants: [AWA] });
    await b.miroir.chargerMiroirs();
    b.S.deposerDocumentEtudiant("et-awa", "cni", "data:application/pdf;base64,JVBERi0=", "u-awa", "CNI / Passeport");
    b.S.verifierPieceEtudiant("et-awa", "cni", "refuser", "u-admin", { motif: "Illisible", libellePiece: "CNI / Passeport" });
    b.S.setEtudiantMotifBlocage("et-awa", "mb-frais", "u-admin");
    await b.miroir.attendreEnvois();
    expect(b.S.getNotifications()).toEqual([]);
  });
});

describe("miroir des évaluations, des notes et des demandes de correction", () => {
  const CLASSE = { id: "cl-l1", nom: "LQHSE1-26/27", filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", niveau_id: "niv-l1", max: 40, delegue: "", annee: "2026-2027", salle_par_defaut_id: null, cloturee: null, date_cloture: null, cloturee_par: null, observation_cloture: null };
  const UE = { id: "ue-l1", code: "UE11", libelle: "Fondamentaux QHSE", credits: 6, filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", semestre: "S1", type: "", obligatoire: true, description: null };
  const EC = { id: "ec-qualite", code: "QHSE111", libelle: "Qualité", abrege: null, ue: "UE11", ue_id: "ue-l1", credits: 3, vol_cm: 20, vol_td: 10, vol_tp: 0, vol_tpe: 0, vht: 30, responsable: "", responsable_id: null };
  const AWA = { id: "et-awa", matricule: "2026-LQHSE-0001", prenom: "Awa", nom: "SECK", sexe: "F", filiere: "LQHSE", filiere_id: "fil-qhse", classe: "LQHSE1-26/27", classe_id: "cl-l1", niveau: "L1", statut: "inscrit", annee: "2026-2027", annee_premiere_inscription: 2026 };
  const EVALUATION = { id: "ev-devoir", code: "100000001", filiere_id: "fil-qhse", filiere: "LQHSE", annee: "2026-2027", niveau_id: "niv-l1", niveau: "L1", classe_id: "cl-l1",
    classe: "LQHSE1-26/27", semestre_id: null, semestre: "S1", ec_id: "ec-qualite", cours: "QHSE111 — Qualité", professeur_id: "en-kane", professeur: "Mamadou KANE",
    type: "devoir", poids: 40, type_evaluation_id: null, description: null, cree_par: null, date_creation: "2026-11-02", modifie_par: null, modifie_le: null, session: null };
  const NOTE = { id: "no-awa-cc", etudiant: "Awa SECK", etudiant_id: "et-awa", matricule: "2026-LQHSE-0001", ec: "Qualité", ec_id: "ec-qualite", type: "CC", note: 12.5,
    absent: false, statut: "publie", classe_id: "cl-l1", annee: "2026-2027", session: null, evaluation_id: "ev-devoir", date_creation: "2026-11-02T10:00:00+00:00", date_modification: null };
  const base = (): Record<string, Ligne[]> => ({ annees_academiques: [ANNEE], filieres: [FILIERE], niveaux: [NIVEAU], classes: [CLASSE], ues: [UE], ecs: [EC],
    etudiants: [AWA], evaluations: [EVALUATION] });
  const COMPTES = [
    { id: "u-admin", role: "admin", displayName: "Saisie des notes", email: "notes@ucao.edu", identifiant: "ADM", actif: true },
    { id: "u-kane", role: "teacher", displayName: "Mamadou KANE", email: "m.kane@ucao.edu", identifiant: "KANE", actif: true, linkedId: "en-kane" },
    { id: "u-awa", role: "student", displayName: "Awa SECK", email: "awa@ucao.edu", identifiant: "2026-LQHSE-0001", actif: true, linkedId: "et-awa" },
  ];

  it("KANE saisit puis soumet : la note part en colonnes de la base, après son évaluation ; c'est la base qui prévient la scolarité", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: COMPTES }));
    const b = await avecBase(base());
    await b.miroir.chargerMiroirs();
    b.S.saveNoteEvaluationGrid("cl-l1", "ec-qualite", "Qualité", "ev-devoir", "devoir", undefined, [{ etudiantId: "et-awa", absent: true }], false, { respecterVerrou: true });
    b.S.submitNotesForValidation("cl-l1", "ec-qualite");
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["notes"]);
    expect(b.envois[0].donnees).toEqual([expect.objectContaining({ etudiant_id: "et-awa", evaluation_id: "ev-devoir", type: "CC", note: 0, absent: true,
      statut: "soumis_admin", classe_id: "cl-l1", annee: "2026-2027", session: null })]);
    expect(b.S.getNotifications()).toEqual([]);
  });

  it("une note publiée reste telle quelle dans la saisie : rien ne part ; seule une correction acceptée la change, la décision partant avant la note", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: COMPTES }));
    const b = await avecBase({ ...base(), notes: [NOTE] });
    await b.miroir.chargerMiroirs();
    b.S.saveNoteEvaluationGrid("cl-l1", "ec-qualite", "Qualité", "ev-devoir", "devoir", undefined, [{ etudiantId: "et-awa", note: 18 }], false);
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([]);
    expect(b.S.getNotes()[0]).toMatchObject({ note: 12.5, statut: "publie" });

    const C = await import("@/data/correctionNoteStore");
    const demande = C.demanderCorrectionNote({ noteId: "no-awa-cc", nouvelleNote: 14, motif: "Erreur de report" }, "u-kane");
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "demandes_correction", operation: "upsert", donnees: [expect.objectContaining({ id: demande.id, note_id: "no-awa-cc",
      ancienne_note: 12.5, ancien_absent: false, nouvelle_note: 14, nouvel_absent: false, demande_par_id: "u-kane", statut: "en_attente" })] }]);
    C.traiterDemandeCorrection(demande.id, "accepter", "u-admin");
    await b.miroir.attendreEnvois();
    expect(b.envois.slice(1).map((e) => e.table)).toEqual(["demandes_correction", "notes"]);
    expect(b.envois[1].donnees).toEqual([expect.objectContaining({ id: demande.id, statut: "acceptee" })]);
    expect(b.envois[2].donnees).toEqual([expect.objectContaining({ id: "no-awa-cc", note: 14, statut: "publie" })]);
    expect(b.S.getNotifications()).toEqual([]);
  });

  it("une évaluation supprimée avec ses notes en brouillon : les notes partent d'abord, puis l'évaluation", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: COMPTES }));
    const b = await avecBase({ ...base(), notes: [{ ...NOTE, statut: "brouillon_prof" }] });
    await b.miroir.chargerMiroirs();
    const R = await import("@/data/suppressionReferentiel");
    expect(R.supprimerEvaluation("ev-devoir", "u-admin").ok).toBe(true);
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => [e.operation, e.table])).toEqual([["delete", "notes"], ["delete", "evaluations"]]);
  });
});

describe("miroir des relevés, délibérations, résultats figés et attestations", () => {
  const CLASSE = { id: "cl-l1", nom: "LQHSE1-26/27", filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", niveau_id: "niv-l1", max: 40, delegue: "", annee: "2026-2027", salle_par_defaut_id: null, cloturee: null, date_cloture: null, cloturee_par: null, observation_cloture: null };
  const SEMESTRE = { id: "sem-s1", nom: "Semestre 1", alias: "S1", niveau: "L1", niveau_id: "niv-l1", filiere: "LQHSE", statut: "actif" };
  const UE = { id: "ue-l1", code: "UE11", libelle: "Fondamentaux QHSE", credits: 6, filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", semestre: "S1", type: "", obligatoire: true, description: null };
  const EC = { id: "ec-qualite", code: "QHSE111", libelle: "Qualité", abrege: null, ue: "UE11", ue_id: "ue-l1", credits: 3, vol_cm: 20, vol_td: 10, vol_tp: 0, vol_tpe: 0, vht: 30, responsable: "", responsable_id: null };
  const ETUDIANT = (id: string, matricule: string, prenom: string, nom: string, annee = "2026-2027") => ({ id, matricule, prenom, nom, sexe: "F", filiere: "LQHSE", filiere_id: "fil-qhse",
    classe: "LQHSE1-26/27", classe_id: "cl-l1", niveau: "L1", statut: "inscrit", annee, annee_premiere_inscription: 2026 });
  const AWA = ETUDIANT("et-awa", "2026-LQHSE-0001", "Awa", "SECK");
  const OUSMANE = ETUDIANT("et-ousmane", "2026-LQHSE-0002", "Ousmane", "DIALLO");
  const EVAL = (id: string, type: string, poids: number) => ({ id, code: id, filiere_id: "fil-qhse", filiere: "LQHSE", annee: "2026-2027", niveau_id: "niv-l1", niveau: "L1", classe_id: "cl-l1",
    classe: "LQHSE1-26/27", semestre_id: "sem-s1", semestre: "S1", ec_id: "ec-qualite", cours: "QHSE111 — Qualité", professeur_id: null, professeur: "", type, poids,
    type_evaluation_id: null, description: null, cree_par: null, date_creation: "2026-11-02", modifie_par: null, modifie_le: null, session: null });
  const NOTE = (etudiant: typeof AWA, evaluation: string, type: string, note: number) => ({ id: `no-${etudiant.id}-${evaluation}`, etudiant: `${etudiant.prenom} ${etudiant.nom}`,
    etudiant_id: etudiant.id, matricule: etudiant.matricule, ec: "Qualité", ec_id: "ec-qualite", type, note, absent: false, statut: "publie", classe_id: "cl-l1", annee: "2026-2027",
    session: null, evaluation_id: evaluation, date_creation: "2026-11-02T10:00:00+00:00", date_modification: null });
  const DELIB = { id: "delib-s1", filiere_id: "fil-qhse", filiere: "LQHSE", annee: "2026-2027", niveau: "L1", niveau_label: "Licence 1", classe_id: "cl-l1", classe: "LQHSE1-26/27",
    semestre_id: "sem-s1", semestre: "Semestre 1 (S1)", effectue_par: "Jury", date_deliberation: "2027-02-10", statut: "en_cours", seuil_override: null, seuil_override_raison: null,
    seuil_override_modifie_par: null, seuil_override_modifie_le: null };
  const LIGNE = (e: typeof AWA, ordre: number, moyenne: number, decision: string) => ({ id: `delib-s1:${e.id}`, deliberation_id: "delib-s1", etudiant_id: e.id,
    etudiant: `${e.prenom} ${e.nom}`, matricule: e.matricule, ordre, moyenne, credits_obtenus: decision === "admis" ? 6 : 0, credits_total: 6, absences: 0, decision_auto: decision,
    decision_finale: decision, override_raison: null, override_modifie_par: null, raisons_declassement: null });
  const base = (): Record<string, Ligne[]> => ({ annees_academiques: [ANNEE], filieres: [FILIERE], niveaux: [NIVEAU], semestres: [SEMESTRE], classes: [CLASSE], ues: [UE], ecs: [EC],
    etudiants: [AWA, OUSMANE], evaluations: [EVAL("ev-cc", "devoir", 40), EVAL("ev-ef", "examen", 60)],
    notes: [NOTE(AWA, "ev-cc", "CC", 12), NOTE(AWA, "ev-ef", "EF", 14), NOTE(OUSMANE, "ev-cc", "CC", 6), NOTE(OUSMANE, "ev-ef", "EF", 9)],
    deliberations: [DELIB], deliberations_lignes: [LIGNE(OUSMANE, 1, 7.8, "ajourne"), LIGNE(AWA, 0, 13.2, "admis")] });

  const COMPTES = [
    { id: "u-admin", role: "admin", displayName: "Scolarité", email: "scolarite@ucao.edu", identifiant: "ADM", actif: true },
    { id: "u-awa", role: "student", displayName: "Awa SECK", email: "awa@ucao.edu", identifiant: "2026-LQHSE-0001", actif: true, linkedId: "et-awa" },
  ];

  it("à la connexion, les lignes du jury rejoignent leur délibération dans l'ordre ; une décision corrigée ne renvoie que sa ligne", async () => {
    const b = await avecBase(base());
    await b.miroir.chargerMiroirs();
    const D = await import("@/data/deliberationStore");
    const [delib] = D.getDeliberations();
    expect(delib).toMatchObject({ id: "delib-s1", classeId: "cl-l1", semestreId: "sem-s1", statut: "en_cours" });
    expect(delib.lignes.map((l) => [l.etudiant, l.moyenne, l.decisionFinale])).toEqual([["Awa SECK", 13.2, "admis"], ["Ousmane DIALLO", 7.8, "ajourne"]]);
    expect(delib.lignes[0]).not.toHaveProperty("ordre");
    expect(b.envois).toEqual([]);

    D.overrideDecision("delib-s1", "et-ousmane", "rattrapage", "Session de rattrapage", "Jury");
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "deliberations_lignes", operation: "upsert", donnees: [expect.objectContaining({ id: "delib-s1:et-ousmane",
      deliberation_id: "delib-s1", ordre: 1, decision_auto: "ajourne", decision_finale: "rattrapage", override_raison: "Session de rattrapage" })] }]);
  });

  it("l'exemple d'Awa : clôture, la délibération part avant les bulletins figés ; réouverture, avant leur retrait ; son poste relit la même moyenne", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: COMPTES }));
    const tables = base();
    const b = await avecBase(tables);
    await b.miroir.chargerMiroirs();
    const D = await import("@/data/deliberationStore");
    const E = await import("@/data/bulletinEngine");
    // Moyenne d'Awa calculée sur les notes lues dans la base : 40 % × 12 + 60 % × 14.
    expect(E.computeBulletinPourClasse("et-awa", "cl-l1", "S1")?.moyenneSession).toBeCloseTo(13.2, 6);

    D.cloturerDeliberation("delib-s1");
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => [e.operation, e.table])).toEqual([["upsert", "deliberations"], ["upsert", "resultats_figes"]]);
    expect(b.envois[0].donnees).toEqual([expect.objectContaining({ id: "delib-s1", statut: "cloturee" })]);
    const figes = b.envois[1].donnees as Ligne[];
    expect(figes.map((l) => l.id)).toEqual(["cl-l1|S1|et-awa", "cl-l1|S1|et-ousmane"]);
    expect(figes[0]).toMatchObject({ deliberation_id: "delib-s1", classe_id: "cl-l1", semestre_alias: "S1", etudiant_id: "et-awa" });
    expect((figes[0].bulletin as { moyenneSession: number }).moyenneSession).toBeCloseTo(13.2, 6);

    // Sur le poste d'Awa (elle ne lit que son bulletin figé) : la même moyenne, relue de la base.
    const surSonPoste = await avecBase({ ...tables, resultats_figes: tables.resultats_figes.filter((l) => l.etudiant_id === "et-awa"),
      deliberations_lignes: tables.deliberations_lignes.filter((l) => l.etudiant_id === "et-awa") });
    await surSonPoste.miroir.chargerMiroirs();
    const F = await import("@/data/resultatsFigesStore");
    expect(F.bulletinFige("et-awa", "cl-l1", "S1")?.moyenneSession).toBeCloseTo(13.2, 6);
    expect(F.bulletinFige("et-ousmane", "cl-l1", "S1")).toBeUndefined();
    expect(surSonPoste.envois).toEqual([]);

    const D2 = await import("@/data/deliberationStore");
    expect(D2.getDeliberations()[0].lignes.map((l) => l.etudiantId)).toEqual(["et-awa"]);
  });

  it("réouverture d'un jury clôturé : la délibération rouverte part d'abord, puis le retrait des bulletins figés", async () => {
    const tables = base();
    tables.deliberations = [{ ...DELIB, statut: "cloturee" }];
    tables.resultats_figes = [{ id: "cl-l1|S1|et-awa", deliberation_id: "delib-s1", classe_id: "cl-l1", semestre_alias: "S1", etudiant_id: "et-awa",
      fige_le: "2027-02-10T12:00:00+00:00", bulletin: { moyenneSession: 13.2 } }];
    const b = await avecBase(tables);
    await b.miroir.chargerMiroirs();
    const D = await import("@/data/deliberationStore");
    D.reouvrirDeliberation("delib-s1");
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([
      { table: "deliberations", operation: "upsert", donnees: [expect.objectContaining({ id: "delib-s1", statut: "reouverte" })] },
      { table: "resultats_figes", operation: "delete", donnees: ["cl-l1|S1|et-awa"] },
    ]);
  });

  it("génération de relevés : le relevé puis la génération ; le numéro est celui de la base, et c'est la base qui prévient Awa", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: COMPTES }));
    const b = await avecBase(base(), undefined, undefined, (table, l) => (table === "bulletin_generations" ? { ...l, numero: "GB-2027-042" } : l));
    await b.miroir.chargerMiroirs();
    const G = await import("@/data/bulletinGenerationStore");
    const g = G.creerGeneration({ filiereId: "fil-qhse", filiere: "LQHSE", annee: "2026-2027", niveauAlias: "L1", niveauLabel: "Licence 1", classeId: "cl-l1",
      classe: "LQHSE1-26/27", semestreId: "sem-s1", semestreAlias: "S1", semestreLabel: "Semestre 1 (S1)", effectuePar: "Scolarité",
      etudiants: [{ id: "et-awa", prenom: "Awa", nom: "SECK", matricule: "2026-LQHSE-0001", classeId: "cl-l1", classe: "LQHSE1-26/27" }] });
    expect(g.statut).toBe("succes");
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["releves", "bulletin_generations"]);
    expect(b.envois[0].donnees).toEqual([expect.objectContaining({ etudiant_id: "et-awa", semestre_id: "sem-s1", annee: "2026-2027", statut: "genere" })]);
    expect(b.envois[1].donnees).toEqual([expect.objectContaining({ id: g.id, classe_id: "cl-l1", nb_succes: 1,
      etudiants_concernes: [expect.objectContaining({ etudiantId: "et-awa", statut: "succes" })] })]);
    expect(G.getGenerations()[0]).toMatchObject({ id: g.id, numero: "GB-2027-042" });
    expect(b.S.getNotifications()).toEqual([]);
    expect(b.envois).toHaveLength(2);
  });

  it("attestation de réussite : numéro réservé par la base, moyenne et décision du jury clôturé ; Ousmane, ajourné, n'en obtient pas", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: COMPTES }));
    const tables = base();
    tables.deliberations = [{ ...DELIB, statut: "cloturee" }];
    const b = await avecBase(tables);
    await b.miroir.chargerMiroirs();
    const A = await import("@/data/attestationStore");
    const entree = { classeId: "cl-l1", classe: "LQHSE1-26/27", filiereId: "fil-qhse", filiere: "LQHSE", annee: "2026-2027", soldeDu: 0, type: "reussite" as const,
      semestreId: "sem-s1", semestreLabel: "Semestre 1 (S1)", effectuePar: "Scolarité" };
    expect(() => A.genererAttestation({ ...entree, etudiantId: "et-ousmane", etudiant: "Ousmane DIALLO", matricule: "2026-LQHSE-0002" }, "ATT-2026-001"))
      .toThrow(/n'est pas admis/);
    const numero = await A.reserverNumeroAttestation();
    expect(numero).toBe("ATT-2026-007");
    expect(b.appels.map((a) => a.nom)).toEqual(["attribuer_numero_attestation"]);
    const att = A.genererAttestation({ ...entree, etudiantId: "et-awa", etudiant: "Awa SECK", matricule: "2026-LQHSE-0001" }, numero);
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "attestations", operation: "upsert", donnees: [expect.objectContaining({ id: att.id, numero: "ATT-2026-007",
      etudiant_id: "et-awa", type: "reussite", semestre_id: "sem-s1", moyenne_constatee: 13.2, decision_constatee: "admis", statut: "genere" })] }]);
    expect(b.S.getNotifications()).toEqual([]);
  });

  it("seules les notes et délibérations des années utiles sont lues ; celles d'un ancien étudiant le sont à la demande, sans rien renvoyer", async () => {
    const ANNEE_2024 = { ...ANNEE, id: "annee-2024", libelle: "2024-2025", actuelle: false, cloturee: true };
    const ANNEE_2025 = { ...ANNEE, id: "annee-2025", libelle: "2025-2026", actuelle: false, cloturee: true };
    const FALL = ETUDIANT("et-fall", "2024-LQHSE-0007", "Ibrahima", "FALL", "2024-2025");
    const inscription = (id: string, etudiant: string, annee: string) => ({ id, etudiant_id: etudiant, annee, filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1",
      classe: "LQHSE1-26/27", classe_id: "cl-l1", statut: "inscrit", type: "premiere", date_inscription: "2024-10-31", specialite: null, modele_frais_id: null,
      modele_frais: null, motif: null, effectue_par: null });
    const tables = base();
    tables.annees_academiques = [ANNEE_2024, ANNEE_2025, ANNEE];
    tables.etudiants = [AWA, FALL];
    tables.inscriptions = [inscription("ins-awa-2025", "et-awa", "2025-2026"), inscription("ins-awa-2026", "et-awa", "2026-2027"), inscription("ins-fall-2024", "et-fall", "2024-2025")];
    tables.notes = [NOTE(AWA, "ev-cc", "CC", 12), { ...NOTE(AWA, "ev-cc", "CC", 15), id: "no-awa-2025", annee: "2025-2026" }, { ...NOTE(FALL, "ev-cc", "CC", 11), annee: "2024-2025" }];
    tables.deliberations = [DELIB, { ...DELIB, id: "delib-2024", annee: "2024-2025", statut: "cloturee" }];
    tables.deliberations_lignes = [LIGNE(AWA, 0, 13.2, "admis"), { ...LIGNE(FALL, 0, 11, "admis"), id: "delib-2024:et-fall", deliberation_id: "delib-2024" }];
    const b = await avecBase(tables);
    await b.miroir.chargerMiroirs();
    const D = await import("@/data/deliberationStore");
    expect(b.S.getAnneesNotesChargees()).toEqual(["2025-2026", "2026-2027"]);
    expect(b.S.getNotes().map((n) => n.id).sort()).toEqual(["no-awa-2025", "no-et-awa-ev-cc"]);
    expect(D.getDeliberations().map((d) => [d.id, d.lignes.length])).toEqual([["delib-s1", 1]]);

    b.S.demanderNotesAnnees(["2024-2025"]);
    await b.miroir.attendreEnvois();
    expect(b.S.getNotes().map((n) => n.id).sort()).toEqual(["no-awa-2025", "no-et-awa-ev-cc", "no-et-fall-ev-cc"]);
    expect(D.getDeliberations().map((d) => [d.id, d.lignes.map((l) => l.etudiantId)]).sort()).toEqual([["delib-2024", ["et-fall"]], ["delib-s1", ["et-awa"]]]);
    expect(b.envois).toEqual([]);
    const lectures = b.lectures.length;
    b.S.demanderNotesAnnees(["2024-2025", "2026-2027"]);
    await b.miroir.attendreEnvois();
    expect(b.lectures).toHaveLength(lectures);
  });
});

describe("miroir des finances : quittances, encaissements, frais et soldes tenus par la base", () => {
  const CLASSE = { id: "cl-l1", nom: "LQHSE1-26/27", filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1", niveau_id: "niv-l1", max: 40, delegue: "", annee: "2026-2027", salle_par_defaut_id: null, cloturee: null, date_cloture: null, cloturee_par: null, observation_cloture: null };
  const ETUDIANT = (id: string, matricule: string, prenom: string, nom: string) => ({ id, matricule, prenom, nom, sexe: "F", filiere: "LQHSE", filiere_id: "fil-qhse",
    classe: "LQHSE1-26/27", classe_id: "cl-l1", niveau: "L1", statut: "inscrit", annee: "2026-2027", annee_premiere_inscription: 2026 });
  const INSCRIPTION = (etudiant: string) => ({ id: `ins-${etudiant}`, etudiant_id: etudiant, annee: "2026-2027", filiere: "LQHSE", filiere_id: "fil-qhse", niveau: "L1",
    classe: "LQHSE1-26/27", classe_id: "cl-l1", statut: "inscrit", type: "premiere", date_inscription: "2026-10-01", specialite: null, modele_frais_id: null, modele_frais: null, motif: null, effectue_par: null });
  const QUITTANCE = { id: "q-awa", numero_recu: "RECU-2026-001", date: "2026-10-15", etudiant_id: "et-awa", etudiant: "Awa SECK", classe: "LQHSE1-26/27",
    rubrique: "Facture unique (2 rubriques)", lignes: [{ label: "Scolarité", montant: 90000 }, { label: "APE", montant: 10000 }], montant: 40000, moyen: "Espèce",
    reference: "RECU-2026-001", solde_restant: 60000, statut: "paye", date_limite: "2026-12-15" };
  const ENCAISSEMENT = { id: "enc-awa", reference: "OP-2026-001", date: "2026-10-15", quittance_id: "q-awa", quittance_reference: "RECU-2026-001",
    quittance_date_emission: "2026-10-15", quittance_date_limite: "2026-12-15", montant_quittance_total: 100000, etudiant_id: "et-awa", payeur: "2026-LQHSE-0001 - Awa SECK",
    filiere: "LQHSE", annee: "2026-2027", montant: 40000, moyen: "Espèce", reference_bancaire: null, encaisse_par: "Caisse", annulee: false,
    lignes: [{ label: "Scolarité", montantApplique: 40000, montantLigneTotal: 90000 }] };
  const COMPTES = [
    { id: "u-caisse", role: "admin", displayName: "Caisse", email: "caisse@ucao.edu", identifiant: "CAISSE", actif: true },
    { id: "u-awa", role: "student", displayName: "Awa SECK", email: "awa@ucao.edu", identifiant: "2026-LQHSE-0001", actif: true, linkedId: "et-awa" },
  ];
  const base = (): Record<string, Ligne[]> => ({ annees_academiques: [ANNEE], filieres: [FILIERE], niveaux: [NIVEAU], classes: [CLASSE],
    etudiants: [ETUDIANT("et-awa", "2026-LQHSE-0001", "Awa", "SECK"), ETUDIANT("et-ousmane", "2026-LQHSE-0002", "Ousmane", "DIALLO")],
    inscriptions: [INSCRIPTION("et-awa"), INSCRIPTION("et-ousmane")], quittances: [{ ...QUITTANCE }], encaissements: [{ ...ENCAISSEMENT }],
    soldes_etudiants: [{ id: "et-awa", solde_du: 60000, solde_avoir: 0 }, { id: "et-ousmane", solde_du: 0, solde_avoir: 5000 }] });

  /** Ce que font les déclencheurs de la base : numéros des quittances et des encaissements, montant
   * réglé et soldes tenus à partir des mouvements. */
  function commeLaBase(tables: Record<string, Ligne[]>) {
    let recu = 6;
    let op = 41;
    return (table: string, l: Ligne): Ligne => {
      const existante = (tables[table] ?? []).find((x) => x.id === l.id);
      if (table === "quittances") {
        if (existante) return { ...l, numero_recu: existante.numero_recu, montant: existante.montant };
        const numero = `RECU-2026-${String(++recu).padStart(3, "0")}`;
        return { ...l, numero_recu: numero, reference: l.reference === l.numero_recu ? numero : l.reference, montant: 0 };
      }
      if (table === "encaissements") {
        if (existante) return { ...existante, annulee: l.annulee };
        const quittance = tables.quittances.find((q) => q.id === l.quittance_id);
        return { ...l, reference: `OP-2026-${String(++op).padStart(3, "0")}`, quittance_reference: quittance?.numero_recu };
      }
      if (table === "mouvements_solde") {
        if (Number(l.delta_paye)) {
          const q = tables.quittances.find((x) => x.id === l.quittance_id)!;
          q.montant = Number(q.montant) + Number(l.delta_paye);
        }
        if (Number(l.delta_du) || Number(l.delta_avoir)) {
          let s = (tables.soldes_etudiants ??= []).find((x) => x.id === l.etudiant_id);
          if (!s) tables.soldes_etudiants.push((s = { id: l.etudiant_id, solde_du: 0, solde_avoir: 0 }));
          s.solde_du = Math.max(0, Number(s.solde_du) + Number(l.delta_du));
          s.solde_avoir = Number(s.solde_avoir) + Number(l.delta_avoir);
        }
      }
      return l;
    };
  }

  it("à la connexion : quittances, encaissements et soldes de la base ; l'inscription de l'année porte le solde ; rien ne repart", async () => {
    const b = await avecBase(base());
    await b.miroir.chargerMiroirs();
    const E = await import("@/data/encaissementStore");
    expect(b.S.getPaiements()).toEqual([expect.objectContaining({ id: "q-awa", numeroRecu: "RECU-2026-001", montant: 40000, statut: "paye", dateLimite: "2026-12-15",
      lignes: [{ label: "Scolarité", montant: 90000 }, { label: "APE", montant: 10000 }] })]);
    expect(E.getEncaissements()).toEqual([expect.objectContaining({ reference: "OP-2026-001", quittanceReference: "RECU-2026-001", montant: 40000 })]);
    expect(b.S.getEtudiantById("et-awa")).toMatchObject({ soldeDu: 60000, soldeAvoir: 0 });
    expect(b.S.getEtudiantById("et-ousmane")).toMatchObject({ soldeDu: 0, soldeAvoir: 5000 });
    expect(b.S.getInscriptionsByEtudiant("et-awa")[0].soldeDu).toBe(60000);
    expect(b.S.getMouvementsSolde()).toEqual([]);
    expect(b.envois).toEqual([]);
  });

  it("deuxième versement d'Awa sur sa quittance : seuls les écarts partent, le reçu OP et le solde viennent de la base", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: COMPTES }));
    const tables = base();
    const b = await avecBase(tables, undefined, undefined, commeLaBase(tables));
    await b.miroir.chargerMiroirs();
    const E = await import("@/data/encaissementStore");
    const q = b.S.getPaiements()[0];
    // Comme la page « Nouvelle quittance » sur une quittance existante.
    b.S.payerQuittance({ id: q.id, montant: 30000, moyen: "Wave", reference: "W-778", date: "2026-11-02" });
    E.enregistrerEncaissement({ quittanceId: q.id, quittanceReference: q.numeroRecu, quittanceDateEmission: q.date, quittanceDateLimite: q.dateLimite,
      montantQuittanceTotal: 100000, quittanceLignes: q.lignes!, dejaPayeAvant: q.montant, etudiantId: "et-awa", payeur: "2026-LQHSE-0001 - Awa SECK",
      filiere: "LQHSE", annee: "2026-2027", montant: 30000, moyen: "Wave", referenceBancaire: "W-778", date: "2026-11-02", encaissePar: "Caisse" });
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => [e.operation, e.table])).toEqual([["upsert", "quittances"], ["insert", "mouvements_solde"], ["upsert", "encaissements"]]);
    expect(b.envois[1].donnees).toEqual([
      expect.objectContaining({ etudiant_id: "et-awa", quittance_id: "q-awa", delta_paye: 30000, delta_du: 0, motif: "Règlement sur quittance" }),
      expect.objectContaining({ etudiant_id: "et-awa", quittance_id: null, delta_du: -30000, delta_avoir: 0, delta_paye: 0 }),
    ]);
    expect(E.getEncaissements().find((e) => e.id !== "enc-awa")).toMatchObject({ reference: "OP-2026-042", quittanceReference: "RECU-2026-001", montant: 30000 });
    expect(b.S.getPaiements()[0]).toMatchObject({ montant: 70000, moyen: "Wave" });
    expect(b.S.getEtudiantById("et-awa")!.soldeDu).toBe(30000);
    expect(b.S.getMouvementsSolde()).toEqual([]);
    expect(b.S.getNotifications()).toEqual([]);
    expect(b.envois.some((e) => e.operation === "delete")).toBe(false);
    expect(b.lectures).not.toContain("mouvements_solde");
  });

  it("nouvelle quittance encaissée : numéro RECU donné par la base, que l'encaissement reprend ; le montant réglé part en mouvement", async () => {
    const tables = base();
    const b = await avecBase(tables, undefined, undefined, commeLaBase(tables));
    await b.miroir.chargerMiroirs();
    const E = await import("@/data/encaissementStore");
    const lignes = [{ label: "Frais d'examen", montant: 15000 }];
    const q = b.S.registerPaiement({ etudiantId: "et-ousmane", rubrique: "Facture unique", montant: 15000, moyen: "Espèce", reference: "", date: "2026-11-03",
      statut: "paye", lignes });
    expect(q.numeroRecu).toMatch(/^RECU-2026-/);
    E.enregistrerEncaissement({ quittanceId: q.id, quittanceReference: q.numeroRecu, quittanceDateEmission: q.date, montantQuittanceTotal: 15000, quittanceLignes: lignes,
      dejaPayeAvant: 0, etudiantId: "et-ousmane", payeur: "Ousmane DIALLO", filiere: "LQHSE", annee: "2026-2027", montant: 15000, moyen: "Espèce", date: "2026-11-03",
      encaissePar: "Caisse" });
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["quittances", "mouvements_solde", "encaissements"]);
    expect(b.envois[1].donnees).toEqual([expect.objectContaining({ quittance_id: q.id, delta_paye: 15000, motif: "Quittance et encaissement" })]);
    const relue = b.S.getPaiements().find((p) => p.id === q.id)!;
    expect(relue).toMatchObject({ numeroRecu: "RECU-2026-007", reference: "RECU-2026-007", montant: 15000 });
    expect(E.getEncaissements().find((e) => e.quittanceId === q.id)).toMatchObject({ reference: "OP-2026-042", quittanceReference: "RECU-2026-007" });
  });

  it("avoir déjà dépensé depuis un autre poste : la base refuse, l'écran le dit et reprend le solde de la base", async () => {
    const tables = base();
    const b = await avecBase(tables, (table, operation) => (table === "mouvements_solde" && operation === "insert"
      ? { code: "23514", message: "Avoir insuffisant : il a déjà été utilisé (il reste 0 F)." } : null));
    await b.miroir.chargerMiroirs();
    const motifs: string[] = [];
    window.addEventListener(b.miroir.EVENEMENT_REFUS_SERVEUR, (e) => motifs.push((e as CustomEvent<{ message: string }>).detail.message));
    tables.soldes_etudiants[1].solde_avoir = 0; // dépensé sur l'autre poste
    expect(b.S.debiterAvoir("et-ousmane", 3000)).toBe(true);
    await b.miroir.attendreEnvois();
    expect(motifs.join(" ")).toContain("Avoir insuffisant");
    expect(b.S.getEtudiantById("et-ousmane")!.soldeAvoir).toBe(0);
    expect(b.S.getMouvementsSolde()).toEqual([]);
  });

  it("frais ajouté et quittancé aussitôt : la quittance, son mouvement, puis le frais ; un frais annulé part annulé, jamais supprimé", async () => {
    const tables = base();
    const b = await avecBase(tables, undefined, undefined, commeLaBase(tables));
    await b.miroir.chargerMiroirs();
    const Fr = await import("@/data/fraisEtudiantStore");
    const [ligne] = Fr.ajouterFraisEtudiant("et-awa", "2026-2027", [{ typeFraisId: "tf-ape", montant: 5000, obligatoire: true, echeance: false }], true, () => "APE");
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["quittances", "mouvements_solde", "frais_etudiants"]);
    expect(b.envois[1].donnees).toEqual([expect.objectContaining({ etudiant_id: "et-awa", delta_du: 5000, motif: "Quittance émise" })]);
    expect(b.envois[2].donnees).toEqual([expect.objectContaining({ id: ligne.id, type_frais_id: "tf-ape", montant: 5000, quittance_id: expect.any(String), annulee: false })]);
    expect(b.S.getEtudiantById("et-awa")!.soldeDu).toBe(65000);
    b.envois.length = 0;
    expect(Fr.annulerFraisEtudiantQuittance(ligne.id, "Doublon").ok).toBe(true);
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => [e.operation, e.table])).toEqual([["upsert", "quittances"], ["insert", "mouvements_solde"], ["upsert", "frais_etudiants"]]);
    expect(b.envois[1].donnees).toEqual([expect.objectContaining({ delta_du: -5000, motif: "Annulation de quittance émise" })]);
    expect(b.envois[2].donnees).toEqual([expect.objectContaining({ id: ligne.id, annulee: true, motif_annulation: "Doublon" })]);
    expect(b.S.getEtudiantById("et-awa")!.soldeDu).toBe(60000);
  });

  it("encaissement annulé : le règlement retiré part en mouvement, puis l'annulation de l'encaissement", async () => {
    const tables = base();
    const b = await avecBase(tables, undefined, undefined, commeLaBase(tables));
    await b.miroir.chargerMiroirs();
    const E = await import("@/data/encaissementStore");
    // Comme la fiche d'un encaissement : « Annuler cet encaissement ».
    b.S.reverserReglementQuittance("q-awa", 40000);
    E.annulerEncaissement("enc-awa");
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => [e.operation, e.table])).toEqual([["upsert", "quittances"], ["insert", "mouvements_solde"], ["upsert", "encaissements"]]);
    expect(b.envois[1].donnees).toEqual([
      expect.objectContaining({ quittance_id: "q-awa", delta_paye: -40000, motif: "Règlement retiré" }),
      expect.objectContaining({ etudiant_id: "et-awa", delta_du: 40000 }),
    ]);
    expect(b.S.getPaiements()[0].montant).toBe(0);
    expect(b.S.getEtudiantById("et-awa")!.soldeDu).toBe(100000);
    expect(E.getEncaissements()[0]).toMatchObject({ reference: "OP-2026-001", annulee: true });
  });

  /** Les déclencheurs de la base pour les lots 2 à 4 : numéros, quittances renvoyées au numéro
   * définitif, décompte recalculé. */
  function commeLaBaseLots234(tables: Record<string, Ligne[]>) {
    const lot1 = commeLaBase(tables);
    return (table: string, l: Ligne): Ligne => {
      const existante = (tables[table] ?? []).find((x) => x.id === l.id);
      if (table === "reductions_frais" && !existante) return { ...l, reference: "RED-2026-014" };
      if (table === "prises_en_charge" && !existante) {
        for (const ligne of l.lignes as { quittanceId: string }[]) {
          const q = tables.quittances.find((x) => x.id === ligne.quittanceId);
          if (q && q.reference === l.reference) q.reference = "PEC-2026-001";
        }
        return { ...l, reference: "PEC-2026-001", montant_encaisse: 0 };
      }
      if (table === "decomptes" && !existante) {
        const lignes = (l.lignes as Ligne[]).map((x) => ({ ...x, montantBrut: 20000, abattementPct: 5, abattementMontant: 1000, montantNet: 19000 }));
        return { ...l, reference: "DC-2026-001", lignes, montant_decompte: 60000, net_a_payer: 57000, montant_paye: 0 };
      }
      return lot1(table, l);
    };
  }

  it("réduction accordée par la caisse : le mouvement du solde, puis la réduction, numérotée par la base", async () => {
    const tables = base();
    const b = await avecBase(tables, undefined, undefined, commeLaBaseLots234(tables));
    await b.miroir.chargerMiroirs();
    const R = await import("@/data/reductionFraisStore");
    R.genererReductionFrais({ date: "2026-11-02", etudiantId: "et-awa", personnelId: "u-caisse", tauxApplique: 20, totalReduit: 12000 });
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => [e.operation, e.table])).toEqual([["insert", "mouvements_solde"], ["upsert", "reductions_frais"]]);
    expect(b.envois[0].donnees).toEqual([expect.objectContaining({ etudiant_id: "et-awa", delta_du: -12000, motif: "Réduction" })]);
    expect(b.envois[1].donnees).toEqual([expect.objectContaining({ etudiant_id: "et-awa", personnel_id: "u-caisse", taux_applique: 20, total_reduit: 12000 })]);
    expect(R.getReductionsFrais()[0].reference).toBe("RED-2026-014");
    expect(b.S.getEtudiantById("et-awa")!.soldeDu).toBe(48000);
  });

  it("prise en charge : la quittance réglée par l'organisme et son mouvement, puis la prise en charge ; numéro et versé viennent de la base", async () => {
    const tables = base();
    tables.organismes_pec = [{ id: "org-1", intitule: "Fondation Sonatel", adresse: "", telephone: null, email: null, remarques: null, contact_nom: "M. NDIAYE",
      contact_telephone: null, contact_email: null }];
    const b = await avecBase(tables, undefined, undefined, commeLaBaseLots234(tables));
    await b.miroir.chargerMiroirs();
    const P = await import("@/data/priseEnChargeStore");
    const pec = P.addPriseEnCharge({ type: "montant", dateSaisie: "2026-11-05", organismeId: "org-1", organisme: "Fondation Sonatel", etudiantId: "et-awa",
      etudiant: "Awa SECK", filiere: "LQHSE", annee: "2026-2027", debut: "2026-10-01", fin: "2027-07-31", dateLimite: "2026-12-31", montant: 50000, ajouteePar: "Caisse",
      lignes: [{ quittanceId: "q-awa", label: "Scolarité", montantFrais: 100000, montantPEC: 50000 }] });
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["quittances", "mouvements_solde", "prises_en_charge"]);
    expect(b.envois[0].donnees).toEqual([expect.objectContaining({ id: "q-awa", moyen: "Prise en charge", reference: pec.reference })]);
    expect(b.envois[1].donnees).toEqual([
      expect.objectContaining({ quittance_id: "q-awa", delta_paye: 50000, motif: "Prise en charge" }),
      expect.objectContaining({ etudiant_id: "et-awa", delta_du: -50000 }),
    ]);
    expect(P.getPrisesEnCharge()[0]).toMatchObject({ reference: "PEC-2026-001", montantEncaisse: 0 });
    expect(b.S.getEtudiantById("et-awa")!.soldeDu).toBe(10000);
  });

  it("paiement déclaré par Awa sur son poste : la déclaration seule part, sans notification du poste (c'est la base qui prévient la caisse)", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: [COMPTES[1], { ...COMPTES[0], id: "u-admin" }] }));
    const tables = base();
    const b = await avecBase(tables);
    await b.miroir.chargerMiroirs();
    const D = await import("@/data/paiementDeclareStore");
    D.declarerPaiement({ quittanceId: "q-awa", etudiantId: "et-awa", montant: 30000, moyen: "Wave", telephone: "770000001", referenceTransaction: "WV-4521" });
    await b.miroir.attendreEnvois();
    expect(b.envois).toEqual([{ table: "paiements_declares", operation: "upsert", donnees: [expect.objectContaining({ quittance_id: "q-awa", etudiant_id: "et-awa",
      montant: 30000, moyen: "Wave", reference_transaction: "WV-4521", statut: "a_verifier", traite_le: null })] }]);
    expect(b.appels.filter((a) => a.nom === "notifier")).toEqual([]);
    expect(b.S.getNotifications()).toEqual([]);
  });

  it("décompte de KANE : le poste propose, la base recalcule ; l'écran affiche les 57 000 F de la base et c'est elle qui prévient KANE", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: [COMPTES[0], { id: "u-kane", role: "teacher", displayName: "Mamadou KANE", email: "kane@ucao.edu",
      identifiant: "KANE", actif: true, linkedId: "en-kane" }] }));
    const tables = base();
    tables.enseignants = [{ id: "en-kane", matricule: "ENS-2026-100", prenom: "Mamadou", nom: "KANE", grade: "Vacataire", specialites: [], statut: "actif" }];
    const b = await avecBase(tables, undefined, undefined, commeLaBaseLots234(tables));
    await b.miroir.chargerMiroirs();
    const Dc = await import("@/data/decompteStore");
    const ligne = (pointageId: string) => ({ pointageId, ecId: "ec-qualite", classeId: "cl-l1", coursLabel: "Qualité", duree: 2, date: "2026-11-02", niveauLabel: "Licence 1",
      classeLabel: "LQHSE1-26/27", anneeLabel: "2026-2027", semestreLabel: "S1", montantBrut: 18000, abattementPct: 5, abattementMontant: 900, montantNet: 17100 });
    // Le poste calcule avec un taux périmé (9 000 F) : la base recalcule au taux en vigueur.
    Dc.genererDecompte({ teacherId: "en-kane", professeur: "Mamadou KANE", type: "taux_horaire", annee: "2026-2027", date: "2026-11-30", ajouteePar: "Comptabilité",
      lignes: [ligne("pt-1"), ligne("pt-2"), ligne("pt-3")] });
    await b.miroir.attendreEnvois();
    expect(b.envois.map((e) => e.table)).toEqual(["decomptes"]);
    expect(Dc.getDecomptes()[0]).toMatchObject({ reference: "DC-2026-001", montantDecompte: 60000, netAPayer: 57000, montantPaye: 0 });
    expect(Dc.getDecomptes()[0].lignes.map((l) => l.montantNet)).toEqual([19000, 19000, 19000]);
    expect(b.appels.filter((a) => a.nom === "notifier")).toEqual([]);
  });

  it("rappel de paiement depuis la caisse : chaque étudiante concernée est prévenue par la base, avec le numéro de sa quittance", async () => {
    localStorage.setItem("edumanage-app-store-v2", JSON.stringify({ users: COMPTES }));
    const b = await avecBase(base());
    await b.miroir.chargerMiroirs();
    expect(b.S.relancerQuittances(["q-awa"])).toBe(1);
    await b.miroir.attendreEnvois();
    expect(b.appels).toEqual([expect.objectContaining({ nom: "notifier", donnees: expect.objectContaining({ p_destinataire: "u-awa",
      p_message: "Rappel — quittance RECU-2026-001 en attente de règlement (date limite : 2026-12-15)" }) })]);
    expect(b.S.getNotifications()).toEqual([]);
  });
});
