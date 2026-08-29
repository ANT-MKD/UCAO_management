import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Check, X, NotebookPen, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useCahiers } from "@/hooks/useStudentStore";
import { validateCahier } from "@/data/studentStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUT_CLS: Record<string, string> = {
  soumis: "bg-amber-50 text-amber-700",
  valide: "bg-emerald-50 text-emerald-700",
  rejete: "bg-red-50 text-red-700",
  brouillon: "bg-slate-100 text-slate-600",
};

export default function CahiersAdminPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const cahiers = useCahiers();
  const [filtre, setFiltre] = useState<"soumis" | "tous" | "valide" | "rejete">("soumis");
  const [showFilters, setShowFilters] = useState(false);
  const [classeFilter, setClasseFilter] = useState("");
  const [profFilter, setProfFilter] = useState("");
  const [filiereFilter, setFiliereFilter] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  // Dimensions du filtre avancé — toujours dérivées des cahiers réellement soumis, jamais
  // d'une liste fabriquée : une classe/prof/filière n'apparaît que si un cahier existe déjà.
  const classes = useMemo(() => Array.from(new Set(cahiers.map((c) => c.classe).filter(Boolean))).sort(), [cahiers]);
  const profs = useMemo(() => Array.from(new Set(cahiers.map((c) => c.prof).filter(Boolean))).sort(), [cahiers]);
  const filieres = useMemo(() => Array.from(new Set(cahiers.map((c) => c.filiere).filter(Boolean))).sort(), [cahiers]);

  const list = useMemo(() => {
    let l = filtre === "tous" ? cahiers : cahiers.filter((c) => c.statut === filtre);
    if (classeFilter) l = l.filter((c) => c.classe === classeFilter);
    if (profFilter) l = l.filter((c) => c.prof === profFilter);
    if (filiereFilter) l = l.filter((c) => c.filiere === filiereFilter);
    if (dateDebut) l = l.filter((c) => c.date >= dateDebut);
    if (dateFin) l = l.filter((c) => c.date <= dateFin);
    return l;
  }, [cahiers, filtre, classeFilter, profFilter, filiereFilter, dateDebut, dateFin]);

  const pending = cahiers.filter((c) => c.statut === "soumis");
  const nbFiltresActifs = [classeFilter, profFilter, filiereFilter, dateDebut, dateFin].filter(Boolean).length;

  function act(id: string, approve: boolean) {
    if (!currentUser) return;
    validateCahier(id, currentUser.id, approve);
    toast.success(approve ? "Cahier validé — prêt pour vacations" : "Cahier rejeté");
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Cahiers de séance" }]}
        title="Cahiers de texte"
        subtitle="Détail complet des séances — validation avant transmission comptabilité / vacations"
        actions={
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium transition-colors",
              nbFiltresActifs > 0 ? "border-amber-300 text-amber-700 bg-amber-50" : "border-amber-300 text-amber-700 hover:bg-amber-50",
            )}
          >
            <Search size={14} /> Recherche avancée{nbFiltresActifs > 0 ? ` (${nbFiltresActifs})` : ""}
          </button>
        }
      />

      {showFilters && (
        <div className="bg-card border border-border rounded-xl mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Classe</label>
              <select value={classeFilter} onChange={(e) => setClasseFilter(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
                <option value="">Toutes</option>
                {classes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Professeur</label>
              <select value={profFilter} onChange={(e) => setProfFilter(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
                <option value="">Tous</option>
                {profs.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Filière</label>
              <select value={filiereFilter} onChange={(e) => setFiliereFilter(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
                <option value="">Toutes</option>
                {filieres.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Du</label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Au</label>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
            </div>
          </div>
          {nbFiltresActifs > 0 && (
            <div className="px-4 pb-3">
              <button
                onClick={() => { setClasseFilter(""); setProfFilter(""); setFiliereFilter(""); setDateDebut(""); setDateFin(""); }}
                className="text-xs text-muted-foreground underline"
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
          <NotebookPen className="w-5 h-5 text-primary" />
          <p className="text-sm"><span className="font-bold">{pending.length}</span> en attente</p>
        </div>
        <div className="flex gap-1">
          {([
            ["soumis", "À valider"],
            ["valide", "Validés"],
            ["rejete", "Rejetés"],
            ["tous", "Tous"],
          ] as const).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFiltre(k)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                filtre === k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
              )}
            >
              {lab}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {list.map((c) => (
          <div
            key={c.id}
            onClick={() => setLocation(`/admin/cahiers/${c.id}`)}
            className={cn("rounded-xl border bg-card p-4 cursor-pointer hover:border-primary/40 transition-colors", c.statut === "soumis" ? "border-amber-200" : "border-border")}
            data-testid={`cahier-row-${c.id}`}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-bold text-sm">{c.sujet || c.ec}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.date} · {c.classe} · {c.prof} · {c.typeSeance} · {c.heureDebut}–{c.heureFin}
                </p>
              </div>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium h-fit", STATUT_CLS[c.statut] || "bg-muted")}>
                {c.statut} · {c.etatSeance}
              </span>
            </div>
            <p className="text-sm mt-2 line-clamp-2 text-muted-foreground">{c.resume || c.activite}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Présence {c.tauxPresence}% · {(c.absents || []).length} absent(s) · {(c.retards || []).length} retard(s)
            </p>

            {c.statut === "soumis" && (
              <div className="flex gap-2 mt-3">
                <button type="button" onClick={(e) => { e.stopPropagation(); act(c.id, true); }} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white">
                  <Check size={12} /> Valider
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); act(c.id, false); }} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600">
                  <X size={12} /> Rejeter
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); setLocation(`/admin/cahiers/${c.id}`); }} className="text-xs px-3 py-1.5 rounded-lg border border-border">
                  Voir le détail
                </button>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun cahier dans ce filtre.</p>
        )}
      </div>
    </div>
  );
}
