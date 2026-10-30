import { useMemo, useRef, useState } from "react";
import { Sigma, RotateCcw, Wand2, CheckCircle2, AlertCircle, FlaskConical } from "lucide-react";
import { essayerFormule, type EtapeFormule } from "@/data/formulesCalcul";
import type { Valeur } from "@/lib/formules";
import { cn } from "@/lib/utils";

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

/** Une étape du calcul : sa formule, la règle actuelle équivalente, les valeurs à insérer, la
 * vérification immédiate et un essai modifiable sur l'exemple d'Awa. */
export function CarteEtape({ numero, etape, texte, erreur, equivalente, lectureSeule, onChange }: {
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
