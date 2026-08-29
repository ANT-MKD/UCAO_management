import { useState, useMemo, Fragment } from "react";
import { ChevronDown, ChevronRight, BarChart3, X } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { FILIERES, SEMESTRES, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { useStudentStore, useNotes } from "@/hooks/useStudentStore";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import { computeBulletin } from "@/data/bulletinEngine";
import { getMention, cn } from "@/lib/utils";

const MENTION_COLORS: Record<string, string> = {
  "Très Bien": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  "Bien": "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300",
  "Assez Bien": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
  "Passable": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  "Ajourné": "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300",
};

const inputClass = "px-3 py-2.5 text-sm border border-border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function MoyennesPage() {
  const classes = useClasses();
  const etudiants = useStudentStore();
  useNotes(); // souscription pour re-rendre quand les notes (dont le rattrapage) changent
  useEvaluations(); // souscription pour re-rendre quand les poids/évaluations changent

  const [selectedAnnee, setSelectedAnnee] = useState("2025-2026");
  const [selectedFiliere, setSelectedFiliere] = useState("");
  const [selectedClasse, setSelectedClasse] = useState("");
  const [selectedSemestreId, setSelectedSemestreId] = useState("");
  const [mentionFilter, setMentionFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [moyenneMin, setMoyenneMin] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const classeObj = classes.find((c) => c.id === selectedClasse);
  const semestre = SEMESTRES.find((s) => s.id === selectedSemestreId);

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => (!selectedFiliere || c.filiereId === selectedFiliere) && c.annee === selectedAnnee);
  }, [classes, selectedFiliere, selectedAnnee]);

  const semestresDisponibles = useMemo(() => {
    if (!classeObj) return [];
    return SEMESTRES.filter((s) => s.filiere === classeObj.filiere && s.niveau === classeObj.niveau);
  }, [classeObj]);

  // Classement réel calculé par le même moteur que Bulletin étudiants (vraies UE/EC, vraies
  // notes, vrais poids, rattrapage pris en compte) — remplace la promotion statique fabriquée.
  const classement = useMemo(() => {
    if (!classeObj || !semestre) return [];
    const roster = etudiants.filter((e) => e.classeId === selectedClasse);
    const rows = roster.map((e) => {
      const bulletin = computeBulletin(e.id, selectedClasse, classeObj.filiereId, classeObj.niveau, semestre.alias);
      const moyenneGenerale = bulletin.moyenneSession;
      const mention = moyenneGenerale !== undefined ? getMention(moyenneGenerale) : undefined;
      const statut = moyenneGenerale !== undefined ? (moyenneGenerale >= 10 ? "Admis" : "Ajourné") : undefined;
      return {
        id: e.id, etudiant: `${e.prenom} ${e.nom}`, matricule: e.matricule,
        moyenneGenerale, credits: bulletin.creditsObtenus, creditsTotal: bulletin.creditsTotal,
        mention, statut, ues: bulletin.ues,
      };
    });
    const classes_ = [...rows].filter((r) => r.moyenneGenerale !== undefined).sort((a, b) => b.moyenneGenerale! - a.moyenneGenerale!);
    const rangMap = new Map(classes_.map((r, i) => [r.id, i + 1]));
    return rows.map((r) => ({ ...r, rang: rangMap.get(r.id) }));
  }, [classeObj, semestre, etudiants, selectedClasse]);

  const filteredPromo = useMemo(() => {
    return classement.filter((m) => {
      if (mentionFilter && m.mention !== mentionFilter) return false;
      if (statutFilter && m.statut !== statutFilter) return false;
      if (moyenneMin && (m.moyenneGenerale ?? -1) < parseFloat(moyenneMin)) return false;
      if (searchQuery && !m.etudiant.toLowerCase().includes(searchQuery.toLowerCase()) && !m.matricule.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }).sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999));
  }, [classement, mentionFilter, statutFilter, moyenneMin, searchQuery]);

  const notes = filteredPromo.filter((m) => m.moyenneGenerale !== undefined);
  const admis = notes.filter((m) => m.statut === "Admis").length;
  const tb = notes.filter((m) => m.mention === "Très Bien").length;
  const avgPromo = notes.length > 0 ? notes.reduce((sum, m) => sum + m.moyenneGenerale!, 0) / notes.length : 0;
  const pctAdmis = notes.length > 0 ? Math.round((admis / notes.length) * 100) : 0;
  const pctAjournes = notes.length > 0 ? 100 - pctAdmis : 0;

  const canShowClassement = !!classeObj && !!semestre;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluation" }, { label: "Moyennes par promotion" }]}
        title="Moyennes par promotion"
        subtitle="Classement réel d'une classe pour une session, calculé à partir des vraies notes"
      />

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex flex-wrap gap-3">
          <select value={selectedAnnee} onChange={(e) => { setSelectedAnnee(e.target.value); setSelectedClasse(""); setSelectedSemestreId(""); }} className={inputClass}>
            {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
          </select>
          <select value={selectedFiliere} onChange={(e) => { setSelectedFiliere(e.target.value); setSelectedClasse(""); setSelectedSemestreId(""); }} className={inputClass}>
            <option value="">Toutes les filières</option>
            {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
          </select>
          <select value={selectedClasse} onChange={(e) => { setSelectedClasse(e.target.value); setSelectedSemestreId(""); }} className={inputClass} data-testid="moyennes-classe">
            <option value="">Sélectionner une classe</option>
            {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select value={selectedSemestreId} onChange={(e) => setSelectedSemestreId(e.target.value)} disabled={!classeObj} className={cn(inputClass, "disabled:opacity-50")} data-testid="moyennes-session">
            <option value="">Sélectionner une session</option>
            {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
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

      {!canShowClassement ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="font-semibold text-foreground mb-1">Choisissez une classe et une session</h3>
          <p className="text-sm text-muted-foreground">Le classement est calculé pour une classe et une session à la fois</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard icon={BarChart3} label="Moyenne promo" value={avgPromo.toFixed(2)} accentColor="#4f46e5" />
            <KPICard icon={BarChart3} label="% Admis" value={`${pctAdmis}%`} accentColor="#10b981" />
            <KPICard icon={BarChart3} label="% Ajournés" value={`${pctAjournes}%`} accentColor="#ef4444" />
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
                {filteredPromo.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">Aucun étudiant ne correspond aux filtres.</td></tr>
                ) : filteredPromo.map((m) => {
                  const isExpanded = expandedRow === m.id;
                  return (
                    <Fragment key={m.id}>
                      <tr
                        className={cn(
                          "border-b border-border transition-colors cursor-pointer hover:bg-muted/30",
                          m.statut === "Ajourné" && "bg-red-50/30 dark:bg-red-950/10",
                          m.mention === "Très Bien" && "bg-emerald-50/30 dark:bg-emerald-950/10",
                        )}
                        onClick={() => setExpandedRow(isExpanded ? null : m.id)}
                        data-testid={`row-${m.id}`}
                      >
                        <td className="px-4 py-3">
                          {m.rang ? (
                            <span className={cn(
                              "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
                              m.rang === 1 ? "bg-amber-100 text-amber-700" : m.rang === 2 ? "bg-slate-100 text-slate-600" : m.rang === 3 ? "bg-orange-100 text-orange-600" : "bg-muted text-muted-foreground",
                            )}>
                              {m.rang}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{m.etudiant}</div>
                          <div className="text-[10px] font-mono text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{m.matricule}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("font-bold text-base", m.moyenneGenerale === undefined ? "text-muted-foreground" : m.moyenneGenerale >= 10 ? "text-emerald-600" : "text-red-500")}>
                            {m.moyenneGenerale !== undefined ? m.moyenneGenerale.toFixed(2) : "En attente"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-medium text-foreground">{m.credits}/{m.creditsTotal}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.mention ? (
                            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", MENTION_COLORS[m.mention] ?? "bg-muted text-muted-foreground")}>{m.mention}</span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {m.statut ? (
                            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", m.statut === "Admis" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300")}>
                              {m.statut}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isExpanded ? <ChevronDown size={14} className="text-muted-foreground mx-auto" /> : <ChevronRight size={14} className="text-muted-foreground mx-auto" />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${m.id}-expand`} className="bg-muted/20 border-b border-border">
                          <td colSpan={7} className="px-8 py-4">
                            <div className="text-xs font-semibold text-muted-foreground mb-2">Détail par UE</div>
                            {m.ues.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Aucune UE programmée pour cette filière/niveau/session.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {m.ues.map((ue) => (
                                  <div key={ue.id} className="flex flex-col items-center gap-1 bg-card border border-border rounded-xl px-4 py-3">
                                    <div className="text-[10px] text-muted-foreground">{ue.code}</div>
                                    <div className={cn("font-bold text-base", ue.moyenne === undefined ? "text-muted-foreground" : ue.moyenne >= 10 ? "text-emerald-600" : "text-red-500")}>
                                      {ue.moyenne !== undefined ? ue.moyenne.toFixed(2) : "—"}
                                    </div>
                                    <div className={cn("text-[9px] font-medium px-1.5 rounded", ue.moyenne === undefined ? "text-muted-foreground" : ue.validee ? "text-emerald-600" : "text-red-500")}>
                                      {ue.moyenne === undefined ? "EN ATTENTE" : ue.validee ? "VALIDÉ" : "AJOURNÉ"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
