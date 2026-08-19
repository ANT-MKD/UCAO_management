import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Download, Send, BarChart3, X } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { MOYENNES_PROMO, FILIERES, CLASSES } from "@/data/mockData";
import { getMention, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const MENTION_COLORS: Record<string, string> = {
  "Très Bien": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  "Bien": "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300",
  "Assez Bien": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
  "Passable": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  "Ajourné": "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300",
};

export default function MoyennesPage() {
  const [selectedFiliere, setSelectedFiliere] = useState("f1");
  const [selectedClasse, setSelectedClasse] = useState("cl1");
  const [selectedSemestre, setSelectedSemestre] = useState("");
  const [selectedAnnee, setSelectedAnnee] = useState("2025-2026");
  const [mentionFilter, setMentionFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [moyenneMin, setMoyenneMin] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filteredPromo = useMemo(() => {
    return MOYENNES_PROMO.filter((m) => {
      if (mentionFilter && m.mention !== mentionFilter) return false;
      if (statutFilter && m.statut !== statutFilter) return false;
      if (moyenneMin && m.moyenneGenerale < parseFloat(moyenneMin)) return false;
      if (searchQuery && !m.etudiant.toLowerCase().includes(searchQuery.toLowerCase()) && !m.matricule.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [mentionFilter, statutFilter, moyenneMin, searchQuery]);

  const admis = filteredPromo.filter((m) => m.statut === "Admis").length;
  const tb = filteredPromo.filter((m) => m.mention === "Très Bien").length;
  const avgPromo = filteredPromo.length > 0 ? filteredPromo.reduce((sum, m) => sum + m.moyenneGenerale, 0) / filteredPromo.length : 0;
  const pctAdmis = filteredPromo.length > 0 ? Math.round((admis / filteredPromo.length) * 100) : 0;

  const filteredClasses = CLASSES.filter((c) => {
    if (selectedFiliere && c.filiereId !== selectedFiliere) return false;
    if (selectedAnnee && c.annee !== selectedAnnee) return false;
    return true;
  });

  const inputClass = "px-3 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluations" }, { label: "Moyennes & Délibérations" }]}
        title="Moyennes & Délibérations"
        subtitle="Résultats par promotion et saisie des délibérations"
        actions={
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
              <Download size={14} /> Générer PV
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Send size={14} /> Notifier tous
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex flex-wrap gap-3">
          <select value={selectedAnnee} onChange={(e) => setSelectedAnnee(e.target.value)} className={inputClass}>
            <option value="2025-2026">2025-2026</option>
            <option value="2024-2025">2024-2025</option>
          </select>
          <select value={selectedFiliere} onChange={(e) => { setSelectedFiliere(e.target.value); setSelectedClasse(""); }} className={inputClass}>
            <option value="">Toutes les filières</option>
            {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
          </select>
          <select value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)} className={inputClass}>
            <option value="">Toutes les classes</option>
            {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select value={selectedSemestre} onChange={(e) => setSelectedSemestre(e.target.value)} className={inputClass}>
            <option value="">Tous semestres</option>
            <option value="S1">Semestre 1</option>
            <option value="S2">Semestre 2</option>
          </select>
          <select value={mentionFilter} onChange={(e) => setMentionFilter(e.target.value)} className={inputClass}>
            <option value="">Toutes mentions</option>
            {["Très Bien", "Bien", "Assez Bien", "Passable", "Ajourné"].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className={inputClass}>
            <option value="">Tous statuts</option>
            <option value="Admis">Admis</option>
            <option value="Ajourné">Ajourné</option>
          </select>
          <input type="number" min={0} max={20} step={0.5} value={moyenneMin} onChange={(e) => setMoyenneMin(e.target.value)} placeholder="Moy. min" className={inputClass + " w-28"} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher étudiant…" className={inputClass + " min-w-[180px]"} />
          {(mentionFilter || statutFilter || moyenneMin || searchQuery) && (
            <button onClick={() => { setMentionFilter(""); setStatutFilter(""); setMoyenneMin(""); setSearchQuery(""); }} className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-xl">
              <X size={12} /> Effacer
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard icon={BarChart3} label="Moyenne promo" value={avgPromo.toFixed(2)} accentColor="#4f46e5" />
        <KPICard icon={BarChart3} label="% Admis" value={`${pctAdmis}%`} accentColor="#10b981" />
        <KPICard icon={BarChart3} label="% Ajournés" value={`${100 - pctAdmis}%`} accentColor="#ef4444" />
        <KPICard icon={BarChart3} label="Mentions TB" value={tb} accentColor="#f59e0b" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase w-10">Rang</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Étudiant</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Moy. Gen.</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Crédits</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Mention</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Statut</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {filteredPromo.map((m) => {
              const isExpanded = expandedRow === m.id;
              return (
                <>
                  <tr
                    key={m.id}
                    className={cn(
                      "border-b border-border transition-colors cursor-pointer hover:bg-muted/30",
                      m.statut === "Ajourné" && "bg-red-50/30 dark:bg-red-950/10",
                      m.mention === "Très Bien" && "bg-emerald-50/30 dark:bg-emerald-950/10"
                    )}
                    onClick={() => setExpandedRow(isExpanded ? null : m.id)}
                    data-testid={`row-${m.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
                        m.rang === 1 ? "bg-amber-100 text-amber-700" : m.rang === 2 ? "bg-slate-100 text-slate-600" : m.rang === 3 ? "bg-orange-100 text-orange-600" : "bg-muted text-muted-foreground"
                      )}>
                        {m.rang}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{m.etudiant}</div>
                      <div className="text-[10px] font-mono text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{m.matricule}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "font-bold text-base",
                        m.moyenneGenerale >= 10 ? "text-emerald-600" : "text-red-500"
                      )}>
                        {m.moyenneGenerale.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-foreground">{m.credits}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", MENTION_COLORS[m.mention] ?? "bg-muted text-muted-foreground")}>
                        {m.mention}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full",
                        m.statut === "Admis" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300"
                      )}>
                        {m.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isExpanded ? <ChevronDown size={14} className="text-muted-foreground mx-auto" /> : <ChevronRight size={14} className="text-muted-foreground mx-auto" />}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${m.id}-expand`} className="bg-muted/20 border-b border-border">
                      <td colSpan={7} className="px-8 py-4">
                        <div className="text-xs font-semibold text-muted-foreground mb-2">Détail par UE</div>
                        <div className="flex flex-wrap gap-2">
                          {m.moyennes.map((moy, i) => (
                            <div key={i} className="flex flex-col items-center gap-1 bg-card border border-border rounded-xl px-4 py-3">
                              <div className="text-[10px] text-muted-foreground">UE {i + 1}</div>
                              <div className={cn("font-bold text-base", moy >= 10 ? "text-emerald-600" : "text-red-500")}>{moy.toFixed(2)}</div>
                              <div className={cn("text-[9px] font-medium px-1.5 rounded", moy >= 10 ? "text-emerald-600" : "text-red-500")}>
                                {moy >= 10 ? "VALIDÉ" : "AJOURNÉ"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
