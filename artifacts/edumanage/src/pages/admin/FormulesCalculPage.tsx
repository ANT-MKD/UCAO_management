import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "wouter";
import { Sigma, Save, RotateCcw, Wand2, CheckCircle2, AlertCircle, Info, ChevronDown, ChevronRight, Lock, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useScolariteConfigs } from "@/hooks/useScolariteConfigStore";
import { useReglesValidation } from "@/hooks/useReglesValidationStore";
import { updateFormulesCalcul } from "@/data/scolariteConfigStore";
import { ETAPES_FORMULES, essayerFormule, validerFormule, type CleFormule, type EtapeFormule, type FormulesCalcul } from "@/data/formulesCalcul";
import { formuleEquivalente } from "@/data/formulesEquivalentes";
import { FONCTIONS, type Valeur } from "@/lib/formules";
import { cn, formatDate } from "@/lib/utils";

const inputClass = "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

/** Valeur d'exemple → texte modifiable (« 12,6 ; 7,3 » pour une liste, vide si absente). */
function versTexte(v: Valeur): string {
  if (v === undefined) return "";
  if (Array.isArray(v)) return v.map(versTexte).join(" ; ");
  return String(v).replace(".", ",");
}

function depuisTexte(texte: string, liste: boolean): Valeur {
  const nombre = (s: string) => {
    const t = s.trim().replace(",", ".");
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : s.trim();
  };
  if (liste) return texte.split(";").map(nombre).filter((x) => x !== undefined) as Valeur[];
  return nombre(texte);
}

const nettoyer = (f: FormulesCalcul): FormulesCalcul =>
  Object.fromEntries(Object.entries(f).filter(([, t]) => t && t.trim()).map(([k, t]) => [k, t!.trim()]));

/** Formules de calcul — l'établissement écrit lui-même une étape du calcul, comme dans Excel.
 * Une étape sans formule suit les réglages de la filière. Réservé aux administrateurs à accès
 * complet ; chaque formule est vérifiée et essayée sur un exemple avant d'être enregistrée. */
export default function FormulesCalculPage() {
  const { currentUser } = useAuth();
  const configs = useScolariteConfigs();
  useReglesValidation();
  const params = new URLSearchParams(useSearch());
  const [filiereId, setFiliereId] = useState(params.get("filiere") ?? "");
  const config = configs.find((c) => c.filiereId === filiereId) ?? configs[0];
  const [brouillon, setBrouillon] = useState<FormulesCalcul>({});
  const [aideOuverte, setAideOuverte] = useState(false);
  const peutModifier = currentUser?.role === "admin" && !currentUser.roleId;

  useEffect(() => {
    setBrouillon({ ...(config?.formulesCalcul ?? {}) });
  }, [config?.id, config?.formulesModifieesLe]);

  const erreurs = useMemo(
    () => Object.fromEntries(ETAPES_FORMULES.map((e) => [e.cle, brouillon[e.cle]?.trim() ? validerFormule(e.cle, brouillon[e.cle]!) : null])) as Record<CleFormule, string | null>,
    [brouillon],
  );
  const nbErreurs = Object.values(erreurs).filter(Boolean).length;
  const modifie = JSON.stringify(nettoyer(brouillon)) !== JSON.stringify(nettoyer(config?.formulesCalcul ?? {}));

  const enregistrer = () => {
    if (!config) return;
    const res = updateFormulesCalcul(config.id, brouillon, currentUser?.name ?? "Administration");
    if (!res.ok) { toast.error(res.reason); return; }
    toast.success(`Formules de ${config.filiere} enregistrées — bulletins et délibérations non clôturées recalculés`);
  };

  if (!config) {
    return (
      <div>
        <PageHeader breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Formules de calcul" }]} title="Formules de calcul" subtitle="Créez d'abord une filière (Académique → Filières)." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Formules de calcul" }]}
        title="Formules de calcul"
        subtitle="Écrivez vos propres règles, comme dans Excel. Une étape sans formule suit les réglages de la filière."
        actions={
          <button
            onClick={enregistrer}
            disabled={!peutModifier || !modifie || nbErreurs > 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="formules-enregistrer"
          >
            <Save size={14} /> Enregistrer les formules
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-4 mb-4 flex flex-wrap items-end gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="min-w-[260px] flex-1">
          <label htmlFor="formules-filiere" className="block text-xs font-medium text-muted-foreground mb-1.5">Filière</label>
          <select id="formules-filiere" value={config.filiereId} onChange={(e) => setFiliereId(e.target.value)} className={inputClass} data-testid="formules-filiere">
            {configs.map((c) => <option key={c.id} value={c.filiereId}>{c.filiere}</option>)}
          </select>
        </div>
        <div className="text-xs text-muted-foreground">
          {config.formulesModifieesPar
            ? <>Dernière modification : <strong className="text-foreground">{config.formulesModifieesPar}</strong>, le {formatDate(config.formulesModifieesLe!)}</>
            : "Aucune formule enregistrée : toutes les étapes suivent les réglages."}
        </div>
      </div>

      {!peutModifier && (
        <div className="flex items-start gap-2 p-3 mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200 text-sm" data-testid="formules-lecture-seule">
          <Lock size={15} className="mt-0.5 flex-shrink-0" />
          Consultation seulement : les formules ne peuvent être modifiées que par un administrateur à accès complet.
        </div>
      )}

      <div className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-primary/5 border border-primary/20 text-sm text-foreground">
        <Info size={15} className="mt-0.5 flex-shrink-0 text-primary" />
        <div>
          Une formule enregistrée s&apos;applique aussitôt aux bulletins, relevés et délibérations <strong>non clôturées</strong> de la filière ; une délibération clôturée ne change jamais.{" "}
          <button onClick={() => setAideOuverte((o) => !o)} className="inline-flex items-center gap-1 text-primary font-semibold hover:underline" data-testid="formules-aide">
            {aideOuverte ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Comment écrire une formule
          </button>
          {aideOuverte && (
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
          )}
        </div>
      </div>

      <div className="space-y-4">
        {ETAPES_FORMULES.map((etape, i) => (
          <CarteEtape
            key={`${config.id}-${etape.cle}`}
            numero={i + 1}
            etape={etape}
            texte={brouillon[etape.cle] ?? ""}
            erreur={erreurs[etape.cle]}
            equivalente={formuleEquivalente(etape.cle, config.filiereId)}
            lectureSeule={!peutModifier}
            onChange={(t) => setBrouillon((b) => ({ ...b, [etape.cle]: t }))}
          />
        ))}
      </div>

      {modifie && peutModifier && (
        <div className="sticky bottom-4 mt-4 flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card shadow-lg" data-testid="formules-barre">
          <span className="text-sm text-foreground">{nbErreurs > 0 ? `${nbErreurs} formule(s) à corriger avant d'enregistrer.` : "Modifications non enregistrées."}</span>
          <div className="flex gap-2">
            <button onClick={() => setBrouillon({ ...(config.formulesCalcul ?? {}) })} className="px-3 py-2 border border-border rounded-xl text-sm hover:bg-muted">Annuler</button>
            <button onClick={enregistrer} disabled={nbErreurs > 0} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
              <Save size={14} /> Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CarteEtape({ numero, etape, texte, erreur, equivalente, lectureSeule, onChange }: {
  numero: number;
  etape: EtapeFormule;
  texte: string;
  erreur: string | null;
  equivalente?: string;
  lectureSeule: boolean;
  onChange: (t: string) => void;
}) {
  const zone = useRef<HTMLTextAreaElement>(null);
  const [essai, setEssai] = useState<Record<string, string>>(() => Object.fromEntries(etape.variables.map((v) => [v.nom, versTexte(v.exemple)])));
  const actif = texte.trim().length > 0;

  const resultat = useMemo(() => {
    if (!actif || erreur) return undefined;
    const contexte = Object.fromEntries(etape.variables.map((v) => [v.nom, depuisTexte(essai[v.nom] ?? "", Array.isArray(v.exemple))]));
    return essayerFormule(etape.cle, texte, contexte);
  }, [actif, erreur, essai, etape, texte]);

  const inserer = (nom: string) => {
    if (lectureSeule) return;
    const el = zone.current;
    const debut = el?.selectionStart ?? texte.length;
    const fin = el?.selectionEnd ?? texte.length;
    const nouveau = `${texte.slice(0, debut)}${nom}${texte.slice(fin)}`;
    onChange(nouveau);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(debut + nom.length, debut + nom.length); });
  };

  return (
    <section className="bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }} data-testid={`formule-etape-${etape.cle}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">{numero}</span>
          <div>
            <h2 className="font-bold text-foreground">{etape.titre}</h2>
            <p className="text-xs text-muted-foreground">{etape.question} {etape.aideResultat}</p>
          </div>
        </div>
        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", actif ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
          {actif ? "Formule de l'établissement" : "Réglages de la filière"}
        </span>
      </div>

      <div className="text-xs text-muted-foreground mb-2">
        Sans formule, aujourd&apos;hui :{" "}
        {equivalente ? <code className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-foreground">{equivalente}</code> : <span>méthode choisie dans Paramétrage bulletins (sans équivalent en formule)</span>}
        {etape.cle === "decisionAnnee" && <span className="block mt-1">Avec une formule, le seuil de passage avec dette propre à un niveau (Académique → Niveaux) n&apos;est plus utilisé.</span>}
      </div>

      <textarea
        ref={zone}
        value={texte}
        onChange={(e) => onChange(e.target.value)}
        readOnly={lectureSeule}
        rows={2}
        spellCheck={false}
        placeholder={equivalente ? `Ex. ${equivalente}` : "Écrivez une formule…"}
        className={cn(inputClass, "font-mono text-[13px]", erreur && "border-red-400 focus:ring-red-300")}
        data-testid={`formule-${etape.cle}`}
        aria-label={`Formule : ${etape.titre}`}
      />

      <div className="flex flex-wrap items-center gap-2 mt-2">
        {!lectureSeule && equivalente && (
          <button onClick={() => onChange(equivalente)} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted" data-testid={`formule-partir-${etape.cle}`}>
            <Wand2 size={12} /> Partir de la règle actuelle
          </button>
        )}
        {!lectureSeule && actif && (
          <button onClick={() => onChange("")} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted" data-testid={`formule-effacer-${etape.cle}`}>
            <RotateCcw size={12} /> Effacer (revenir aux réglages)
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-1">Valeurs :</span>
        {etape.variables.map((v) => (
          <button
            key={v.nom}
            onClick={() => inserer(v.nom)}
            title={v.description}
            disabled={lectureSeule}
            className="text-[11px] font-mono px-2 py-1 rounded-md bg-primary/5 text-primary hover:bg-primary/15 disabled:cursor-default"
          >
            {v.nom}
          </button>
        ))}
      </div>

      {actif && (
        <div className={cn("mt-3 flex items-start gap-2 text-sm", erreur ? "text-red-600" : "text-emerald-700 dark:text-emerald-400")} data-testid={`formule-statut-${etape.cle}`}>
          {erreur ? <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />}
          <span>{erreur ?? "Formule correcte."}</span>
        </div>
      )}

      {actif && !erreur && (
        <div className="mt-3 p-3 rounded-xl bg-muted/40 border border-border">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-2">
            <FlaskConical size={13} className="text-primary" /> Essai sur l&apos;exemple d&apos;Awa — modifiez les valeurs pour tester d&apos;autres cas
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {etape.variables.map((v) => (
              <label key={v.nom} className="block" title={v.description}>
                <span className="block text-[10px] font-mono text-muted-foreground mb-0.5">{v.nom}</span>
                <input
                  value={essai[v.nom] ?? ""}
                  onChange={(e) => setEssai((x) => ({ ...x, [v.nom]: e.target.value }))}
                  placeholder={Array.isArray(v.exemple) ? "12,6 ; 7,3" : "vide"}
                  className="w-full px-2 py-1 text-xs border border-border rounded-lg bg-background font-mono"
                  data-testid={`essai-${etape.cle}-${v.nom}`}
                />
              </label>
            ))}
          </div>
          <div className="mt-2 text-sm" data-testid={`resultat-${etape.cle}`}>
            Résultat :{" "}
            {resultat?.ok
              ? <strong className="text-foreground">{resultat.libelle}</strong>
              : <span className="text-red-600">{resultat?.erreur}</span>}
          </div>
        </div>
      )}
      {!actif && (
        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5"><Sigma size={12} /> Sans formule : cette étape suit les réglages de la filière.</p>
      )}
    </section>
  );
}
