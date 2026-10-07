import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearch } from "wouter";
import { Save, Plus, Pencil, Trash2, Copy, Info, ChevronDown, ChevronRight, Lock, GitCompareArrows, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { CarteEtape } from "@/components/admin/CarteFormule";
import { useAuth } from "@/contexts/AuthContext";
import { useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useScolariteConfigs } from "@/hooks/useScolariteConfigStore";
import { useReglesValidation } from "@/hooks/useReglesValidationStore";
import {
  getReglements, subscribeReglements, enregistrerReglement, supprimerReglement, copierReglements, verifierReglement,
  type ReglementCalcul,
} from "@/data/reglementCalculStore";
import { comparerReglement, type ComparaisonReglement } from "@/data/comparaisonReglement";
import { ETAPES_FORMULES, validerFormule, type CleFormule, type FormulesCalcul } from "@/data/formulesCalcul";
import { formuleEquivalente } from "@/data/formulesEquivalentes";
import { FONCTIONS } from "@/lib/formules";
import { cn, formatDate } from "@/lib/utils";

const inputClass = "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

interface Brouillon {
  id?: string;
  nom: string;
  filiereIds: string[];
  formules: FormulesCalcul;
}

/** Règlements de calcul — un ensemble de formules nommé, valable pour une année académique et
 * appliqué à une ou plusieurs filières. Avant tout enregistrement, l'écran montre quels étudiants
 * verraient leur résultat changer. Les jurys clôturés gardent leurs résultats figés. */
export default function FormulesCalculPage() {
  const { currentUser } = useAuth();
  const annees = useAnneesAcademiques();
  const configs = useScolariteConfigs();
  useReglesValidation();
  const reglements = useSyncExternalStore(subscribeReglements, getReglements, getReglements);
  const params = new URLSearchParams(useSearch());
  const anneeActuelle = annees.find((a) => a.actuelle)?.libelle ?? annees[0]?.libelle ?? "";
  const [annee, setAnnee] = useState(anneeActuelle);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [comparaison, setComparaison] = useState<{ cle: string; resultat: ComparaisonReglement } | null>(null);
  const [aideOuverte, setAideOuverte] = useState(false);
  const peutModifier = currentUser?.role === "admin" && !currentUser.roleId;
  const anneeRecord = annees.find((a) => a.libelle === annee);
  const anneeFermee = !!anneeRecord?.cloturee;
  const modifiable = peutModifier && !anneeFermee;
  const nomFiliere = (id: string) => configs.find((c) => c.filiereId === id)?.filiere ?? id;

  const reglementsAnnee = reglements.filter((r) => r.annee === annee);
  const filieresSansReglement = configs.filter((c) => !reglementsAnnee.some((r) => r.filiereIds.includes(c.filiereId)));
  const anneePrecedente = useMemo(() => {
    const triees = annees.map((a) => a.libelle).sort();
    return triees[triees.indexOf(annee) - 1];
  }, [annees, annee]);
  const aCopier = anneePrecedente ? reglements.filter((r) => r.annee === anneePrecedente) : [];

  // Bouton Σ de Paramétrage scolarité : ouvre le règlement de la filière, ou en prépare un.
  useEffect(() => {
    const filiere = params.get("filiere");
    if (!filiere || brouillon || !annee) return;
    const existant = reglements.find((r) => r.annee === annee && r.filiereIds.includes(filiere));
    setBrouillon(existant ? { id: existant.id, nom: existant.nom, filiereIds: existant.filiereIds, formules: { ...existant.formules } } : { nom: `Règlement ${annee}`, filiereIds: [filiere], formules: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lecture du paramètre une seule fois
  }, [annee]);

  const ouvrir = (r?: ReglementCalcul) => {
    setComparaison(null);
    setBrouillon(r ? { id: r.id, nom: r.nom, filiereIds: [...r.filiereIds], formules: { ...r.formules } } : { nom: `Règlement ${annee}`, filiereIds: [], formules: {} });
  };

  const supprimer = (r: ReglementCalcul) => {
    if (!window.confirm(`Supprimer le règlement « ${r.nom} » ? Ses filières suivront à nouveau leurs réglages pour ${r.annee}.`)) return;
    const res = supprimerReglement(r.id, currentUser?.name ?? "Administration");
    if (res.ok) toast.success("Règlement supprimé"); else toast.error(res.reason);
  };

  const copier = () => {
    if (!anneePrecedente) return;
    const n = copierReglements(anneePrecedente, annee, currentUser?.name ?? "Administration");
    if (n > 0) toast.success(`${n} règlement(s) de ${anneePrecedente} recopié(s) pour ${annee}`); else toast.info("Rien à recopier : ces filières ont déjà un règlement cette année.");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Règlements de calcul" }]}
        title="Règlements de calcul"
        subtitle="Des formules écrites comme dans Excel, valables pour une année et une ou plusieurs filières. Sans règlement, une filière suit ses réglages."
        actions={!brouillon && modifiable ? (
          <button onClick={() => ouvrir()} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90" data-testid="reglement-nouveau">
            <Plus size={14} /> Nouveau règlement
          </button>
        ) : undefined}
      />

      {!peutModifier && (
        <div className="flex items-start gap-2 p-3 mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200 text-sm" data-testid="formules-lecture-seule">
          <Lock size={15} className="mt-0.5 flex-shrink-0" />
          Consultation seulement : les règlements ne peuvent être modifiés que par un administrateur à accès complet.
        </div>
      )}

      {brouillon ? (
        <EditeurReglement
          annee={annee}
          brouillon={brouillon}
          setBrouillon={setBrouillon}
          comparaison={comparaison}
          setComparaison={setComparaison}
          reglementsAnnee={reglementsAnnee}
          configs={configs}
          modifiable={modifiable}
          auteur={currentUser?.name ?? "Administration"}
          onFermer={() => { setBrouillon(null); setComparaison(null); }}
        />
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl p-4 mb-4 flex flex-wrap items-end gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="min-w-[220px]">
              <label htmlFor="reglement-annee" className="block text-xs font-medium text-muted-foreground mb-1.5">Année académique</label>
              <select id="reglement-annee" value={annee} onChange={(e) => setAnnee(e.target.value)} className={inputClass} data-testid="reglement-annee">
                {annees.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}{a.actuelle ? " (en cours)" : ""}{a.cloturee ? " — clôturée" : ""}</option>)}
              </select>
            </div>
            {modifiable && aCopier.length > 0 && (
              <button onClick={copier} className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-sm hover:bg-muted" data-testid="reglement-copier">
                <Copy size={14} /> Recopier les règlements de {anneePrecedente}
              </button>
            )}
            {anneeFermee && <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock size={12} /> Année clôturée : ses règlements sont conservés tels quels.</span>}
          </div>

          <div className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-primary/5 border border-primary/20 text-sm text-foreground">
            <Info size={15} className="mt-0.5 flex-shrink-0 text-primary" />
            <div>
              Un règlement ne vaut que pour <strong>son année</strong> : préparer celui de l&apos;année suivante ne change rien à l&apos;année en cours.
              À la clôture d&apos;un jury, les résultats du semestre sont <strong>figés</strong> : un relevé déjà délivré ne change plus, même si une règle change ensuite.{" "}
              <button onClick={() => setAideOuverte((o) => !o)} className="inline-flex items-center gap-1 text-primary font-semibold hover:underline" data-testid="formules-aide">
                {aideOuverte ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Comment écrire une formule
              </button>
              {aideOuverte && <AideFormules />}
            </div>
          </div>

          {reglementsAnnee.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center text-sm text-muted-foreground" data-testid="reglement-aucun">
              Aucun règlement pour {annee || "cette année"} : toutes les filières suivent leurs réglages (Paramétrage scolarité).
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {reglementsAnnee.map((r) => (
                <div key={r.id} className="bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }} data-testid={`reglement-carte-${r.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-foreground">{r.nom}</h2>
                      <p className="text-xs text-muted-foreground">{r.annee} · {Object.keys(r.formules).length} formule(s)</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => ouvrir(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" aria-label="Ouvrir" data-testid={`reglement-ouvrir-${r.id}`}><Pencil size={14} /></button>
                      {modifiable && <button onClick={() => supprimer(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-600" aria-label="Supprimer"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {r.filiereIds.map((f) => <span key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{nomFiliere(f)}</span>)}
                  </div>
                  <ul className="mt-3 space-y-0.5 text-[11px] text-muted-foreground">
                    {ETAPES_FORMULES.filter((e) => r.formules[e.cle]).map((e) => <li key={e.cle}><strong className="text-foreground">{e.titre} :</strong> <code>{r.formules[e.cle]}</code></li>)}
                  </ul>
                  <p className="mt-3 text-[11px] text-muted-foreground">{r.modifiePar ? `Modifié par ${r.modifiePar} le ${formatDate(r.modifieLe!)}` : `Créé par ${r.creePar} le ${formatDate(r.creeLe)}`}</p>
                </div>
              ))}
            </div>
          )}

          {filieresSansReglement.length > 0 && reglementsAnnee.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">Suivent leurs réglages en {annee} : {filieresSansReglement.map((c) => c.filiere).join(", ")}.</p>
          )}
        </>
      )}
    </div>
  );
}

function AideFormules() {
  return (
    <div className="mt-3 grid md:grid-cols-2 gap-4 text-xs">
      <ul className="space-y-1 list-disc pl-4">
        <li>Comme dans Excel : le « = » du début est facultatif.</li>
        <li>Séparez les valeurs par <code>;</code> et écrivez les décimales avec une virgule : <code>0,3</code>.</li>
        <li>Les textes s&apos;écrivent entre guillemets : <code>&quot;VALIDÉ&quot;</code>.</li>
        <li>Opérations : <code>+ - × ÷</code> (ou <code>* /</code>), <code>30%</code>, comparaisons <code>&gt;= &lt;= &gt; &lt; = &lt;&gt;</code>.</li>
        <li>Une note pas encore saisie est <strong>vide</strong> : le résultat reste « en attente », il ne compte jamais pour 0.</li>
        <li>Majuscules, minuscules et accents sont indifférents.</li>
      </ul>
      <ul className="space-y-1">
        {Object.values(FONCTIONS).map((f) => <li key={f.aide}><code className="text-[11px]">{f.aide}</code></li>)}
      </ul>
    </div>
  );
}

function EditeurReglement({ annee, brouillon, setBrouillon, comparaison, setComparaison, reglementsAnnee, configs, modifiable, auteur, onFermer }: {
  annee: string;
  brouillon: Brouillon;
  setBrouillon: (b: Brouillon) => void;
  comparaison: { cle: string; resultat: ComparaisonReglement } | null;
  setComparaison: (c: { cle: string; resultat: ComparaisonReglement } | null) => void;
  reglementsAnnee: ReglementCalcul[];
  configs: ReturnType<typeof useScolariteConfigs>;
  modifiable: boolean;
  auteur: string;
  onFermer: () => void;
}) {
  const erreurs = useMemo(
    () => Object.fromEntries(ETAPES_FORMULES.map((e) => [e.cle, brouillon.formules[e.cle]?.trim() ? validerFormule(e.cle, brouillon.formules[e.cle]!) : null])) as Record<CleFormule, string | null>,
    [brouillon.formules],
  );
  const payload = { nom: brouillon.nom, annee, filiereIds: brouillon.filiereIds, formules: brouillon.formules };
  const motif = verifierReglement(payload, brouillon.id);
  // La comparaison n'est valable que pour le brouillon exact qui a été comparé.
  const cle = JSON.stringify(payload);
  const comparaisonAJour = comparaison?.cle === cle ? comparaison.resultat : null;
  const filiereReference = brouillon.filiereIds[0] ?? configs[0]?.filiereId;
  const prisAilleurs = (filiereId: string) => reglementsAnnee.find((r) => r.id !== brouillon.id && r.filiereIds.includes(filiereId));

  const comparer = () => setComparaison({ cle, resultat: comparerReglement(payload) });
  const enregistrer = () => {
    const res = enregistrerReglement(payload, brouillon.id, auteur);
    if (!res.ok) { toast.error(res.reason); return; }
    toast.success(`Règlement « ${res.reglement!.nom} » enregistré pour ${annee}`);
    onFermer();
  };

  return (
    <div className="space-y-4">
      <button onClick={onFermer} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="reglement-retour"><ArrowLeft size={14} /> Retour aux règlements de {annee}</button>

      <div className="bg-card border border-border rounded-2xl p-5 grid md:grid-cols-2 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label htmlFor="reglement-nom" className="block text-xs font-medium text-muted-foreground mb-1.5">Nom du règlement</label>
          <input id="reglement-nom" value={brouillon.nom} readOnly={!modifiable} onChange={(e) => setBrouillon({ ...brouillon, nom: e.target.value })} className={inputClass} data-testid="reglement-nom" />
          <p className="text-xs text-muted-foreground mt-1.5">Année : <strong className="text-foreground">{annee}</strong></p>
        </div>
        <div>
          <span className="block text-xs font-medium text-muted-foreground mb-1.5">Filières concernées</span>
          <div className="flex flex-wrap gap-2">
            {configs.map((c) => {
              const autre = prisAilleurs(c.filiereId);
              const coche = brouillon.filiereIds.includes(c.filiereId);
              return (
                <label key={c.filiereId} className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border", coche ? "border-primary bg-primary/5" : "border-border", autre && "opacity-50")} title={autre ? `Déjà dans « ${autre.nom} »` : undefined}>
                  <input
                    type="checkbox"
                    checked={coche}
                    disabled={!modifiable || !!autre}
                    onChange={(e) => setBrouillon({ ...brouillon, filiereIds: e.target.checked ? [...brouillon.filiereIds, c.filiereId] : brouillon.filiereIds.filter((f) => f !== c.filiereId) })}
                    data-testid={`reglement-filiere-${c.filiereId}`}
                  />
                  {c.filiere}{autre ? ` (dans « ${autre.nom} »)` : ""}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {ETAPES_FORMULES.map((etape, i) => (
        <CarteEtape
          key={`${brouillon.id ?? "nouveau"}-${etape.cle}`}
          numero={i + 1}
          etape={etape}
          texte={brouillon.formules[etape.cle] ?? ""}
          erreur={erreurs[etape.cle]}
          equivalente={filiereReference ? formuleEquivalente(etape.cle, filiereReference) : undefined}
          lectureSeule={!modifiable}
          onChange={(t) => setBrouillon({ ...brouillon, formules: { ...brouillon.formules, [etape.cle]: t } })}
        />
      ))}

      {modifiable && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3" style={{ boxShadow: "var(--shadow-sm)" }} data-testid="reglement-validation">
          <h2 className="font-bold text-foreground flex items-center gap-2"><GitCompareArrows size={16} className="text-primary" /> Vérifier puis enregistrer</h2>
          {motif ? (
            <p className="text-sm text-red-600" data-testid="reglement-motif">{motif}</p>
          ) : !comparaisonAJour ? (
            <>
              <p className="text-sm text-muted-foreground">Avant d&apos;enregistrer, voyez quels étudiants inscrits en {annee} dans ces filières verraient leur résultat changer.</p>
              <button onClick={comparer} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90" data-testid="reglement-comparer">
                <GitCompareArrows size={14} /> Comparer avec les résultats actuels
              </button>
            </>
          ) : (
            <>
              <TableauComparaison c={comparaisonAJour} />
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={enregistrer} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90" data-testid="reglement-enregistrer">
                  <Save size={14} /> {comparaisonAJour.nbEtudiantsChanges > 0 ? `Enregistrer (${comparaisonAJour.nbEtudiantsChanges} étudiant(s) changent)` : "Enregistrer"}
                </button>
                <button onClick={onFermer} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">Annuler</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TableauComparaison({ c }: { c: ComparaisonReglement }) {
  return (
    <div data-testid="comparaison-resultat">
      <p className="text-sm text-foreground" data-testid="comparaison-resume">
        {c.nbEtudiants === 0
          ? "Aucun étudiant inscrit dans ces filières pour cette année : rien ne change pour l'instant."
          : c.nbEtudiantsChanges === 0
            ? <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={15} /> Aucun résultat ne change ({c.nbEtudiants} étudiant(s) vérifié(s)).</span>
            : <><strong>{c.nbEtudiantsChanges}</strong> étudiant(s) sur {c.nbEtudiants} verraient leur résultat changer :</>}
      </p>
      {c.sessionsFigees > 0 && <p className="text-xs text-muted-foreground mt-1">{c.sessionsFigees} session(s) au jury clôturé : leurs résultats sont figés et ne changeront pas.</p>}
      {c.changements.length > 0 && (
        <div className="mt-3 max-h-80 overflow-auto border border-border rounded-xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Étudiant</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Période</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Résultat</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Aujourd&apos;hui</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Avec ce règlement</th>
              </tr>
            </thead>
            <tbody>
              {c.changements.map((x, i) => (
                <tr key={i} className="border-t border-border" data-testid={`comparaison-ligne-${x.etudiantId}-${x.periode}-${x.quoi}`}>
                  <td className="px-3 py-2"><div className="font-medium text-foreground">{x.etudiant}</div><div className="text-[11px] text-muted-foreground font-mono">{x.matricule}</div></td>
                  <td className="px-3 py-2 text-xs">{x.periode}</td>
                  <td className="px-3 py-2 text-xs">{x.quoi}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{x.avant}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-foreground">{x.apres}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
