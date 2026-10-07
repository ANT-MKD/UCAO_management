import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OptionRecherche {
  value: string;
  label: string;
  /** Précision affichée sous le libellé (filière · niveau · semestre, spécialité…). */
  hint?: string;
  /** Mots supplémentaires pris en compte par la recherche. */
  motsCles?: string;
}

const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MAX_RESULTATS = 50;

/** Liste de choix avec recherche : on tape quelques lettres (code, intitulé, nom, filière…) au lieu
 * de parcourir une longue liste déroulante. Accents et majuscules indifférents ; flèches + Entrée
 * au clavier ; « aucunLabel » permet de laisser le champ vide (ex. « Non assigné »). */
export function RechercheSelect({ options, value, onChange, placeholder = "Rechercher…", aucunLabel, invalide, testId, id }: {
  options: OptionRecherche[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  aucunLabel?: string;
  invalide?: boolean;
  testId?: string;
  id?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [requete, setRequete] = useState("");
  const [actif, setActif] = useState(0);
  const conteneur = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  const listeId = useId();
  const choisie = options.find((o) => o.value === value);

  const resultats = useMemo(() => {
    const mots = normaliser(requete).split(/\s+/).filter(Boolean);
    const trouvees = mots.length === 0 ? options : options.filter((o) => {
      const texte = normaliser(`${o.label} ${o.hint ?? ""} ${o.motsCles ?? ""}`);
      return mots.every((m) => texte.includes(m));
    });
    return trouvees;
  }, [options, requete]);
  const visibles = resultats.slice(0, MAX_RESULTATS);
  // « Non assigné » n'est proposé que sans recherche : Entrée choisit alors le premier résultat trouvé.
  const lignes: (OptionRecherche | null)[] = aucunLabel && !requete.trim() ? [null, ...visibles] : visibles;

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => { if (!conteneur.current?.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [ouvert]);

  const choisir = (o: OptionRecherche | null) => {
    onChange(o?.value ?? "");
    setOuvert(false);
    setRequete("");
  };

  const clavier = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOuvert(true); setActif((i) => Math.min(i + 1, lignes.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActif((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { if (ouvert && lignes.length > 0) { e.preventDefault(); choisir(lignes[actif] ?? null); } }
    else if (e.key === "Escape") { setOuvert(false); setRequete(""); }
  };

  return (
    <div ref={conteneur} className="relative">
      <div className={cn("flex items-center gap-2 w-full px-3 py-2 text-sm border rounded-xl bg-background focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary", invalide ? "border-red-400" : "border-border")}>
        <Search size={14} className="text-muted-foreground flex-shrink-0" />
        <input
          ref={champ}
          id={id}
          role="combobox"
          aria-expanded={ouvert}
          aria-controls={listeId}
          aria-autocomplete="list"
          value={ouvert ? requete : choisie ? `${choisie.label}${choisie.hint ? ` · ${choisie.hint}` : ""}` : ""}
          placeholder={choisie ? choisie.label : value === "" && aucunLabel ? aucunLabel : placeholder}
          onFocus={() => { setOuvert(true); setRequete(""); setActif(0); }}
          onChange={(e) => { setRequete(e.target.value); setOuvert(true); setActif(0); }}
          onKeyDown={clavier}
          className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
          data-testid={testId}
        />
        {value && (
          <button type="button" onClick={() => { choisir(null); champ.current?.focus(); }} className="text-muted-foreground hover:text-foreground" aria-label="Effacer le choix">
            <X size={14} />
          </button>
        )}
        <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
      </div>
      {ouvert && (
        <ul id={listeId} role="listbox" className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-border bg-card shadow-lg py-1" data-testid={testId ? `${testId}-liste` : undefined}>
          {lignes.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat pour « {requete} »</li>}
          {lignes.map((o, i) => (
            <li
              key={o?.value ?? "__aucun"}
              role="option"
              aria-selected={(o?.value ?? "") === value}
              onMouseDown={(e) => { e.preventDefault(); choisir(o); }}
              onMouseEnter={() => setActif(i)}
              className={cn("px-3 py-2 cursor-pointer text-sm", i === actif && "bg-primary/10", (o?.value ?? "") === value && "font-semibold")}
            >
              {o ? (
                <>
                  <div className="text-foreground">{o.label}</div>
                  {o.hint && <div className="text-[11px] text-muted-foreground">{o.hint}</div>}
                </>
              ) : (
                <div className="text-muted-foreground italic">{aucunLabel}</div>
              )}
            </li>
          ))}
          {resultats.length > MAX_RESULTATS && (
            <li className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">{resultats.length - MAX_RESULTATS} autre(s) résultat(s) : précisez la recherche.</li>
          )}
        </ul>
      )}
    </div>
  );
}
