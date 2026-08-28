import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Scale, CheckCircle2, XCircle, AlertTriangle, Ban,
  ChevronDown, Lock, FileText, Download, Users, Award, TrendingUp
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { SEMESTRES, MOYENNES_PROMO, FILIERES } from "@/data/mockData";
import { useStudentStore } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useScolariteConfigs } from "@/hooks/useScolariteConfigStore";
import { cn } from "@/lib/utils";

type Decision = "admis" | "ajourne" | "rattrapage" | "exclu" | null;

interface JuryRow {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  moyenne: number;
  credits: number;
  absences: number;
  decision: Decision;
}

const DECISION_CONFIG: Record<NonNullable<Decision>, { label: string; color: string; bg: string; icon: React.ElementType; border: string }> = {
  admis: { label: "Admis", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50", icon: CheckCircle2, border: "border-emerald-200 dark:border-emerald-800" },
  ajourne: { label: "Ajourné", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/50", icon: XCircle, border: "border-red-200 dark:border-red-800" },
  rattrapage: { label: "Rattrapage", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50", icon: AlertTriangle, border: "border-amber-200 dark:border-amber-800" },
  exclu: { label: "Exclu", color: "text-zinc-700 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-900/50", icon: Ban, border: "border-zinc-300 dark:border-zinc-700" },
};

function autoDecide(moy: number, absences: number, moyennePassage: number, moyenneEliminatoire: number): Decision {
  if (absences > 10) return "exclu";
  if (moyenneEliminatoire > 0 && moy < moyenneEliminatoire) return "exclu";
  if (moy >= moyennePassage) return "admis";
  if (moy >= moyennePassage - 2) return "rattrapage";
  return "ajourne";
}

export default function DeliberationsPage() {
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  const CLASSES = useClasses();
  const scolariteConfigs = useScolariteConfigs();
  const [selectedSemestreId, setSelectedSemestreId] = useState<string>("");
  const [selectedClasseId, setSelectedClasseId] = useState<string>("");
  const [selectedFiliereId, setSelectedFiliereId] = useState<string>("");
  const [decisionFilter, setDecisionFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [moyenneMin, setMoyenneMin] = useState("");
  const [cloture, setCloture] = useState(false);
  const [rows, setRows] = useState<JuryRow[]>([]);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const semestre = SEMESTRES.find((s) => s.id === selectedSemestreId);
  const classe = CLASSES.find((c) => c.id === selectedClasseId);

  const filteredClasses = useMemo(() => {
    if (!selectedFiliereId) return CLASSES;
    return CLASSES.filter((c) => c.filiereId === selectedFiliereId);
  }, [selectedFiliereId]);

  const displayedRows = useMemo(() => {
    return rows.filter((r) => {
      if (decisionFilter && r.decision !== decisionFilter) return false;
      if (moyenneMin && r.moyenne < parseFloat(moyenneMin)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!`${r.prenom} ${r.nom}`.toLowerCase().includes(q) && !r.matricule.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, decisionFilter, moyenneMin, searchQuery]);

  const handleCharger = () => {
    if (!selectedSemestreId || !selectedClasseId) return;
    const config = scolariteConfigs.find((c) => c.filiereId === classe?.filiereId);
    const moyennePassage = config?.moyennePassage ?? 10;
    const moyenneEliminatoire = config?.moyenneEliminatoire ?? 0;
    const sample = etudiants.filter((e) => e.classeId === selectedClasseId).map((e, i) => {
      const moy = MOYENNES_PROMO[i % MOYENNES_PROMO.length]?.moyenneGenerale ?? (10 + Math.random() * 8);
      const absences = Math.floor(Math.random() * 14);
      const decision = autoDecide(moy, absences, moyennePassage, moyenneEliminatoire);
      return {
        id: e.id,
        matricule: e.matricule,
        nom: e.nom,
        prenom: e.prenom,
        moyenne: parseFloat(moy.toFixed(2)),
        credits: moy >= 10 ? 30 : Math.floor(moy * 2.5),
        absences,
        decision,
      } as JuryRow;
    });
    setRows(sample);
    setSessionLoaded(true);
    setCloture(false);
  };

  const setDecision = (id: string, decision: Decision) => {
    if (cloture) return;
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, decision } : r));
  };

  const stats = useMemo(() => {
    const total = displayedRows.length;
    const admis = displayedRows.filter((r) => r.decision === "admis").length;
    const ajourne = displayedRows.filter((r) => r.decision === "ajourne").length;
    const rattrapage = displayedRows.filter((r) => r.decision === "rattrapage").length;
    const exclu = displayedRows.filter((r) => r.decision === "exclu").length;
    const tauxReussite = total > 0 ? Math.round((admis / total) * 100) : 0;
    const moyGeneral = total > 0 ? (displayedRows.reduce((s, r) => s + r.moyenne, 0) / total).toFixed(2) : "—";
    return { total, admis, ajourne, rattrapage, exclu, tauxReussite, moyGeneral };
  }, [displayedRows]);

  const inputClass = "px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluations" }, { label: "Délibérations" }]}
        title="Session de Jury — Délibérations"
        subtitle="Examinez les moyennes et arrêtez les décisions du jury pour chaque étudiant"
        actions={
          sessionLoaded && !cloture ? (
            <button
              onClick={() => setCloture(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Lock size={14} /> Clôturer la session
            </button>
          ) : sessionLoaded && cloture ? (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              <Download size={14} /> Télécharger le PV
            </button>
          ) : null
        }
      />

      {/* Session selector */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-4">Configuration de la session</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière</label>
            <select value={selectedFiliereId} onChange={(e) => { setSelectedFiliereId(e.target.value); setSelectedClasseId(""); setSessionLoaded(false); setRows([]); }} className={`${inputClass} w-full`}>
              <option value="">Toutes</option>
              {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Semestre</label>
            <div className="relative">
              <select
                value={selectedSemestreId}
                onChange={(e) => { setSelectedSemestreId(e.target.value); setSessionLoaded(false); setRows([]); }}
                className={`${inputClass} w-full appearance-none pr-8`}
              >
                <option value="">Sélectionner un semestre</option>
                {SEMESTRES.map((s) => (
                  <option key={s.id} value={s.id}>{s.nom} — {s.filiere} ({s.niveau}) · {s.statut}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe</label>
            <div className="relative">
              <select
                value={selectedClasseId}
                onChange={(e) => { setSelectedClasseId(e.target.value); setSessionLoaded(false); setRows([]); }}
                className={`${inputClass} w-full appearance-none pr-8`}
              >
                <option value="">Sélectionner une classe</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom} — {c.inscrits} étudiants</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <button
            onClick={handleCharger}
            disabled={!selectedSemestreId || !selectedClasseId}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Charger la session
          </button>
        </div>

        {semestre && classe && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
              <FileText size={11} /> {semestre.nom} · {semestre.periode}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted px-3 py-1 rounded-full">
              <Users size={11} /> {classe.nom} · {classe.inscrits} inscrits
            </span>
            {(() => {
              const config = scolariteConfigs.find((c) => c.filiereId === classe.filiereId);
              const moyennePassage = config?.moyennePassage ?? 10;
              const moyenneEliminatoire = config?.moyenneEliminatoire ?? 0;
              return (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-1 rounded-full" data-testid="deliberation-seuils-filiere">
                  <Scale size={11} /> Passage ≥ {moyennePassage}{moyenneEliminatoire > 0 ? ` · Éliminatoire < ${moyenneEliminatoire}` : ""}
                </span>
              );
            })()}
            {cloture && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 px-3 py-1 rounded-full">
                <Lock size={11} /> Session clôturée
              </span>
            )}
          </div>
        )}
      </div>

      {sessionLoaded && rows.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5 bg-card border border-border rounded-xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)} className={inputClass}>
            <option value="">Toutes décisions</option>
            <option value="admis">Admis</option>
            <option value="ajourne">Ajourné</option>
            <option value="rattrapage">Rattrapage</option>
            <option value="exclu">Exclu</option>
          </select>
          <input type="number" min={0} max={20} step={0.5} value={moyenneMin} onChange={(e) => setMoyenneMin(e.target.value)} placeholder="Moy. min" className={inputClass + " w-28"} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher étudiant…" className={inputClass + " min-w-[200px] flex-1"} />
        </div>
      )}

      {/* Stats summary */}
      {sessionLoaded && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: "Total", value: stats.total, icon: Users, color: "#6366f1" },
            { label: "Admis", value: stats.admis, icon: CheckCircle2, color: "#10b981" },
            { label: "Rattrapage", value: stats.rattrapage, icon: AlertTriangle, color: "#f59e0b" },
            { label: "Ajournés", value: stats.ajourne, icon: XCircle, color: "#ef4444" },
            { label: "Exclus", value: stats.exclu, icon: Ban, color: "#71717a" },
            { label: "Taux réussite", value: `${stats.tauxReussite}%`, icon: TrendingUp, color: "#4f46e5" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
              <Icon size={18} style={{ color }} className="mx-auto mb-1.5" />
              <div className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Jury table */}
      {sessionLoaded && rows.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-foreground">Décisions du jury</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Moyenne générale :</span>
              <span className="font-bold text-foreground font-mono">{stats.moyGeneral}/20</span>
            </div>
          </div>

          {cloture && (
            <div className="mx-5 my-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <Lock size={14} />
              Session clôturée — les décisions sont définitives et ne peuvent plus être modifiées.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Étudiant</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Matricule</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Moyenne</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Crédits</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Absences</th>
                  <th className="text-center text-xs font-semibold text-muted-foreground px-5 py-3">Décision</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row, i) => {
                  const dec = row.decision;
                  const cfg = dec ? DECISION_CONFIG[dec] : null;
                  return (
                    <tr key={row.id} className={cn("border-b border-border last:border-0 transition-colors", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-sm text-foreground">{row.prenom} {row.nom}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-mono text-muted-foreground">{row.matricule}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn(
                          "text-sm font-bold font-mono",
                          row.moyenne >= 10 ? "text-emerald-600 dark:text-emerald-400" : row.moyenne >= 8 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                        )}>
                          {row.moyenne.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground">/20</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-sm font-semibold text-foreground">{row.credits}</span>
                        <span className="text-xs text-muted-foreground">/30</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn("text-sm font-semibold", row.absences > 10 ? "text-red-500" : "text-foreground")}>
                          {row.absences}h
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {cloture && cfg ? (
                          <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border", cfg.bg, cfg.color, cfg.border)}>
                            <cfg.icon size={12} />
                            {cfg.label}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 justify-center">
                            {(["admis", "rattrapage", "ajourne", "exclu"] as NonNullable<Decision>[]).map((d) => {
                              const c = DECISION_CONFIG[d];
                              const active = row.decision === d;
                              return (
                                <button
                                  key={d}
                                  onClick={() => setDecision(row.id, active ? null : d)}
                                  title={c.label}
                                  className={cn(
                                    "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all",
                                    active
                                      ? `${c.bg} ${c.color} ${c.border} shadow-sm`
                                      : "border-border text-muted-foreground hover:bg-muted"
                                  )}
                                >
                                  <c.icon size={12} />
                                  <span className="hidden sm:inline">{c.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-5 py-3 border-t border-border bg-muted/20 flex flex-wrap gap-4">
            {(Object.entries(DECISION_CONFIG) as [NonNullable<Decision>, typeof DECISION_CONFIG[keyof typeof DECISION_CONFIG]][]).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <cfg.icon size={12} className={cfg.color} />
                <span className="text-muted-foreground">{cfg.label}</span>
                <span className="font-bold text-foreground">{rows.filter((r) => r.decision === key).length}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!sessionLoaded && (
        <div className="bg-card border border-border rounded-2xl p-16 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Award size={32} className="text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
            Sélectionnez une session
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Choisissez un semestre et une classe, puis cliquez sur « Charger la session » pour démarrer la délibération.
          </p>
        </div>
      )}
    </div>
  );
}
