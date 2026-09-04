import { Fragment, useMemo, useState } from "react";
import { Link } from "wouter";
import { Eye, CreditCard, ShieldAlert, ChevronLeft, ChevronRight, Search, Clock, Library, BookOpen, GraduationCap, LayoutGrid, List, Table2, SlidersHorizontal, ChevronDown, ChevronUp, X, Award, FileText, PieChart as PieChartIcon, Trophy, CheckCircle2, MapPin, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore, useSeances, useNotes, usePaiementsByEtudiant, useReleves, useCahiers, useAnneeActuelle, useInscriptions } from "@/hooks/useStudentStore";
import { FILIERES, SEMESTRES } from "@/data/mockData";
import { useUes, useEcs } from "@/hooks/useCurriculumStore";
import type { UeRecord, EcRecord } from "@/data/curriculumStore";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { computeBulletin } from "@/data/bulletinEngine";
import { KPICard } from "@/components/admin/KPICard";
import { useModesPaiementFinance } from "@/hooks/useFinanceSettingsStore";
import { useTypesSeance, useJoursFeries } from "@/hooks/useScheduleSettingsStore";
import { useEvenements } from "@/hooks/useEvenementStore";
import { useRessourcesPourClasse } from "@/hooks/useRessourcePedagogiqueStore";
import { getJourFerieCouvrant } from "@/data/scheduleSettingsStore";
import { getCahierStatsForEc } from "@/data/studentStore";
import { formatCFA, formatDate, formatShortDate, moyenPaiementColor, cn } from "@/lib/utils";
import { mondayOf } from "@/lib/teacherUtils";
import { DOCUMENTS_INSCRIPTION } from "@/lib/inscriptionConstants";
import { resolveBulletin, BulletinPreviewModal } from "@/pages/admin/RelevesPage";
import { montantQuittance } from "@/pages/admin/PaiementsPage";
import { useMentions } from "@/hooks/useMentionsStore";
import { useDeliberations } from "@/hooks/useDeliberationStore";
import { payerQuittance } from "@/data/studentStore";
import { enregistrerEncaissement } from "@/data/encaissementStore";
import { getAssiduiteRowsPourEtudiant, getTauxPresencePourEtudiant, getPresenceHebdoPourEtudiant, getPresenceParEcPourEtudiant, getHeuresAbsenceNonJustifieePourEtudiant } from "@/data/assiduiteEngine";
import type { ReleveRecord } from "@/data/studentStore";

const JOURS_GRID = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
const PX_PER_H = 80;
const FALLBACK_COLOR = "#4f46e5";

function shadeFromColor(hex: string): { bg: string; border: string; text: string } {
  return { bg: `${hex}18`, border: hex, text: hex };
}

function timeToPixels(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - 8) * PX_PER_H + m * (PX_PER_H / 60);
}

function getDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) * (PX_PER_H / 60);
}

/** Emploi du temps de l'étudiant — grille en lecture seule reprenant le design de l'EDT admin
 * (mêmes couleurs par type, même ligne "heure actuelle"), sans le glisser-déposer ni les
 * sélecteurs de vue (classe/salle/prof) qui n'ont pas de sens côté étudiant. */
export function StudentSchedulePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const seances = useSeances();
  const evenements = useEvenements();
  const TYPES_SEANCE = useTypesSeance();
  useJoursFeries();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];

  const [weekOffset, setWeekOffset] = useState(0);
  const [weekViewMode, setWeekViewMode] = useState<"semaine" | "jour">("semaine");

  const now = new Date();
  const todayDow = now.getDay() === 0 ? 7 : now.getDay();
  const currentTimeY = (now.getHours() - 8) * PX_PER_H + now.getMinutes() * (PX_PER_H / 60);
  const showTimeLine = now.getHours() >= 8 && now.getHours() < 20;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
  const weekMonday = mondayOf(weekStart.toISOString().slice(0, 10));
  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${weekMonday}T12:00:00`);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekMonday]);
  const weekEnd = weekDays[5];
  const weekLabel = `${weekDays[0].getDate()} – ${weekEnd.getDate()} ${weekDays[0].toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;

  const todayJourNum = Math.min((now.getDay() + 6) % 7 + 1, 6);
  const displayDayIdxs = weekViewMode === "jour" ? [todayJourNum - 1] : [0, 1, 2, 3, 4, 5];

  const weekSeances = useMemo(
    () => seances.filter((s) => s.classeId === student?.classeId && s.semaineDu === weekMonday),
    [seances, student?.classeId, weekMonday],
  );
  const weekEvenements = useMemo(
    () => evenements.filter((e) => !e.classeId || e.classeId === student?.classeId),
    [evenements, student?.classeId],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Emploi du temps</h2>
          <p className="text-sm text-muted-foreground mt-1">{student?.classe} · {student?.filiere}</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors" data-testid="edt-etudiant-week-prev"><ChevronLeft size={16} /></button>
          <span className="text-sm font-medium text-foreground px-2">Sem. du {weekLabel}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors" data-testid="edt-etudiant-week-next"><ChevronRight size={16} /></button>
          <button onClick={() => setWeekOffset(0)} className="px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">Aujourd&apos;hui</button>
          {(["semaine", "jour"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setWeekViewMode(mode)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors capitalize",
                weekViewMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        {TYPES_SEANCE.map((t) => {
          const c = shadeFromColor(t.couleur);
          return (
            <div key={t.id} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: c.text }}>
              <span className="w-3 h-3 rounded-sm" style={{ background: c.bg, border: `2px solid ${c.border}` }} />{t.code}
            </div>
          );
        })}
      </div>

      {weekSeances.length === 0 && weekEvenements.filter((e) => weekDays.some((d) => d.toISOString().slice(0, 10) === e.date)).length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          Aucune séance planifiée pour la semaine du {formatShortDate(weekMonday)}.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="overflow-x-auto">
          <div style={{ minWidth: weekViewMode === "semaine" ? 720 : 320 }}>
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${displayDayIdxs.length}, 1fr)` }}>
              <div className="border-b border-r border-border" />
              {displayDayIdxs.map((dayIdx) => {
                const dayNum = dayIdx + 1;
                const dateIso = weekDays[dayIdx].toISOString().slice(0, 10);
                const ferie = getJourFerieCouvrant(dateIso);
                return (
                  <div
                    key={dayIdx}
                    title={ferie ? `Jour férié — ${ferie.intitule}` : undefined}
                    className={cn(
                      "px-2 py-3 text-center text-xs font-semibold border-b border-r border-border last:border-r-0",
                      dayNum === todayDow && weekOffset === 0 && "bg-primary/5 text-primary",
                      ferie && "bg-amber-50 text-amber-700",
                    )}
                  >
                    {JOURS_GRID[dayIdx]}
                    {ferie && <div className="text-[9px] font-normal normal-case truncate">{ferie.intitule}</div>}
                  </div>
                );
              })}
            </div>

            <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(${displayDayIdxs.length}, 1fr)` }}>
              <div className="border-r border-border">
                {HOURS.map((h) => (
                  <div key={h} className="border-b border-border last:border-0 flex items-start justify-end pr-2 pt-1" style={{ height: PX_PER_H }}>
                    <span className="text-[10px] text-muted-foreground">{h}:00</span>
                  </div>
                ))}
              </div>

              {displayDayIdxs.map((dayIdx) => {
                const dayNum = dayIdx + 1;
                const dateIso = weekDays[dayIdx].toISOString().slice(0, 10);
                const daySeances = weekSeances.filter((s) => s.jour === dayNum);
                const dayEvenements = weekEvenements.filter((e) => e.date === dateIso);
                return (
                  <div
                    key={dayIdx}
                    className={cn("relative border-r border-border last:border-r-0", dayNum === todayDow && weekOffset === 0 && "bg-primary/[0.02]")}
                  >
                    {HOURS.map((h) => (
                      <div key={h} className="border-b border-border/50 last:border-0" style={{ height: PX_PER_H }} />
                    ))}

                    {daySeances.map((s) => {
                      const typeRecord = TYPES_SEANCE.find((t) => t.code === s.type);
                      const colors = shadeFromColor(typeRecord?.couleur ?? FALLBACK_COLOR);
                      const top = timeToPixels(s.heureDebut);
                      const height = getDuration(s.heureDebut, s.heureFin);
                      return (
                        <div
                          key={s.id}
                          data-testid={`edt-etudiant-seance-${s.id}`}
                          className="absolute left-1 right-1 rounded-lg px-2 py-1.5 overflow-hidden"
                          style={{
                            top: `${top}px`, height: `${Math.max(height, 40)}px`,
                            background: colors.bg, borderLeft: `3px solid ${colors.border}`,
                            zIndex: 5, boxShadow: "var(--shadow-sm)",
                          }}
                        >
                          <div className="text-[10px] font-bold truncate" style={{ color: colors.text }}>{s.ec}</div>
                          <div className="text-[9px] text-muted-foreground">{s.heureDebut}–{s.heureFin}</div>
                          {height > 50 && (
                            <>
                              <div className="text-[9px] text-muted-foreground truncate">{s.salle}</div>
                              <div className="text-[9px] text-muted-foreground truncate">{s.prof}</div>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {dayEvenements.map((ev) => {
                      const typeRecord = TYPES_SEANCE.find((t) => t.code === ev.type);
                      const colors = shadeFromColor(typeRecord?.couleur ?? FALLBACK_COLOR);
                      const top = timeToPixels(ev.heureDebut);
                      const height = getDuration(ev.heureDebut, ev.heureFin);
                      return (
                        <div
                          key={ev.id}
                          className="absolute left-1 right-1 rounded-lg px-2 py-1.5 overflow-hidden border-dashed"
                          style={{
                            top: `${top}px`, height: `${Math.max(height, 40)}px`,
                            background: colors.bg, border: `2px dashed ${colors.border}`,
                            zIndex: 4,
                          }}
                        >
                          <div className="text-[10px] font-bold truncate" style={{ color: colors.text }}>{ev.objet}</div>
                          <div className="text-[9px] text-muted-foreground">{ev.heureDebut}–{ev.heureFin} · {ev.type}</div>
                        </div>
                      );
                    })}

                    {dayNum === todayDow && weekOffset === 0 && showTimeLine && (
                      <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" style={{ top: `${currentTimeY}px` }}>
                        <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                        <div className="flex-1 h-[1.5px] bg-red-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = { CC: "Contrôle continu", EF: "Examen" };

const REPARTITION_DEFS = [
  { label: "Très bien (16-20)", color: "#10b981" },
  { label: "Bien (14-15.99)", color: "#2563eb" },
  { label: "Assez bien (10-13.99)", color: "#f59e0b" },
  { label: "Insuffisant (< 10)", color: "#ef4444" },
];
function bucketRepartition(note: number): number {
  if (note >= 16) return 0;
  if (note >= 14) return 1;
  if (note >= 10) return 2;
  return 3;
}

interface MatiereRow extends Record<string, unknown> {
  id: string;
  matiere: string;
  code: string;
  ue: string;
  prof: string;
  cc: string;
  examen: string;
  moyenne: string;
  credits: number;
}

/** Suivi des notes en cours — jamais un verdict officiel (ça, c'est Relevés & bulletins, avec
 * mention et décision de jury réelles). computeBulletin() n'est réutilisé ici que pour son
 * calcul de moyenne pondérée par les vrais coefficients, pas pour un statut "validé". */
export function StudentNotesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const notes = useNotes();
  const ues = useUes();
  const ecs = useEcs();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];

  const [onglet, setOnglet] = useState<"matieres" | "evaluations">("matieres");
  const [semestreSelectionne, setSemestreSelectionne] = useState("");

  const mesUes = useMemo(
    () => ues.filter((u) => u.filiereId === student?.filiereId && u.niveau === student?.niveau).sort((a, b) => a.semestre.localeCompare(b.semestre)),
    [ues, student?.filiereId, student?.niveau],
  );
  const semestres = useMemo(() => Array.from(new Set(mesUes.map((u) => u.semestre))), [mesUes]);
  const semestreActif = semestreSelectionne || semestres[0] || "";

  const bulletin = useMemo(() => {
    if (!student || !semestreActif) return undefined;
    return computeBulletin(student.id, student.classeId, student.filiereId, student.niveau, semestreActif);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student, semestreActif, notes, ecs]);

  const lignesMatieres = useMemo(() => {
    if (!bulletin) return [];
    return bulletin.ues.flatMap((ue) => ue.ecs.map((ec) => {
      const ecRecord = ecs.find((e) => e.id === ec.id);
      return { ...ec, ue: ue.libelle, responsable: ecRecord?.responsable || "Responsable non assigné" };
    }));
  }, [bulletin, ecs]);

  const ecIdsSemestre = useMemo(() => new Set(lignesMatieres.map((l) => l.id)), [lignesMatieres]);
  const notesDuSemestre = useMemo(
    () => notes
      .filter((n) => n.etudiantId === student?.id && n.statut === "publie" && ecIdsSemestre.has(n.ecId))
      .sort((a, b) => (b.dateModification ?? b.dateCreation).localeCompare(a.dateModification ?? a.dateCreation)),
    [notes, student?.id, ecIdsSemestre],
  );

  const repartition = useMemo(() => {
    const counts = [0, 0, 0, 0];
    for (const n of notesDuSemestre) counts[bucketRepartition(n.note)]++;
    return REPARTITION_DEFS.map((b, i) => ({ ...b, count: counts[i] })).filter((b) => b.count > 0);
  }, [notesDuSemestre]);

  const pctCredits = bulletin && bulletin.creditsTotal > 0 ? Math.round((bulletin.creditsObtenus / bulletin.creditsTotal) * 100) : 0;

  const matiereRows: MatiereRow[] = useMemo(() => lignesMatieres.map((l) => ({
    id: l.id,
    matiere: l.libelle,
    code: l.code,
    ue: l.ue,
    prof: l.responsable,
    cc: l.cc !== undefined ? l.cc.toFixed(2) : "—",
    examen: l.ef !== undefined ? l.ef.toFixed(2) : "—",
    moyenne: l.moyenne !== undefined ? l.moyenne.toFixed(2) : "—",
    credits: l.credits,
  })), [lignesMatieres]);

  const matiereColumns: Column<MatiereRow>[] = [
    {
      key: "matiere", header: "Matière", sortable: true,
      render: (r) => (<div><div className="font-medium text-foreground">{r.matiere}</div><div className="text-[11px] text-muted-foreground">{r.code} · {r.ue}</div></div>),
    },
    { key: "prof", header: "Professeur", sortable: true },
    { key: "cc", header: "CC", sortable: true },
    { key: "examen", header: "Examen", sortable: true },
    {
      key: "moyenne", header: "Moyenne", sortable: true,
      render: (r) => {
        const v = r.moyenne as string;
        if (v === "—") return v;
        return <span className={cn("font-bold", parseFloat(v) >= 10 ? "text-emerald-600" : "text-red-500")}>{v}/20</span>;
      },
    },
    { key: "credits", header: "Crédits", sortable: true },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Notes</h2>
          <p className="text-sm text-muted-foreground mt-1">Suivi de vos notes par semestre, matière et évaluation</p>
        </div>
        {semestres.length > 0 && (
          <select
            value={semestreActif}
            onChange={(e) => setSemestreSelectionne(e.target.value)}
            className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="notes-semestre"
          >
            {semestres.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <KPICard icon={GraduationCap} label="Moyenne générale" value={bulletin?.moyenneSession !== undefined ? `${bulletin.moyenneSession.toFixed(2)}/20` : "—"} accentColor={bulletin?.moyenneSession !== undefined && bulletin.moyenneSession >= 10 ? "#10b981" : "#ef4444"} />
        <KPICard icon={Award} label="Crédits obtenus" value={bulletin ? `${bulletin.creditsObtenus}/${bulletin.creditsTotal}` : "—"} subtitle={bulletin ? `${pctCredits}% obtenus` : undefined} accentColor="#2563eb" />
        <KPICard icon={FileText} label="Notes publiées" value={notesDuSemestre.length} accentColor="#8b5cf6" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
            {([["matieres", "Par matières"], ["evaluations", "Par évaluations"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setOnglet(key)}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", onglet === key ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                data-testid={`notes-onglet-${key}`}
              >
                {label}
              </button>
            ))}
          </div>

          {onglet === "matieres" ? (
            matiereRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucune matière pour ce semestre.</p>
            ) : (
              <DataTable columns={matiereColumns} data={matiereRows} pageSize={10} emptyMessage="Aucune matière pour ce semestre." />
            )
          ) : notesDuSemestre.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucune note publiée pour ce semestre.</p>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
              {notesDuSemestre.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-3 p-3.5" data-testid={`notes-evaluation-${n.id}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{n.ec}</p>
                    <p className="text-[11px] text-muted-foreground">{TYPE_LABELS[n.type] ?? n.type}{n.session === "rattrapage" ? " · Rattrapage" : ""}</p>
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                      {n.dateModification
                        ? `Modifiée le ${new Date(n.dateModification).toLocaleDateString("fr-FR")}`
                        : `Ajoutée le ${new Date(n.dateCreation).toLocaleDateString("fr-FR")}`}
                    </p>
                  </div>
                  <span className={cn("font-bold text-sm flex-shrink-0", n.note >= 10 ? "text-emerald-600" : "text-red-500")}>{n.note}/20</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <PieChartIcon size={16} className="text-violet-600" />
            </div>
            <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Répartition des notes</h3>
          </div>
          {repartition.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune note publiée pour l&apos;instant.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={repartition} cx="50%" cy="50%" outerRadius={65} innerRadius={35} dataKey="count">
                    {repartition.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, _n, item) => [`${v} note(s)`, item.payload.label]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {repartition.map((d) => (
                  <div key={d.label} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="font-semibold text-foreground ml-auto">{d.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function releveSortKey(r: ReleveRecord): number {
  const anneeStart = parseInt((r.annee ?? "0").split("-")[0], 10) || 0;
  const semNum = parseInt(/S(\d+)/.exec(r.semestre)?.[1] ?? "0", 10) || 0;
  return anneeStart * 10 + semNum;
}

const DECISION_TONE: Record<string, { bg: string; text: string }> = {
  admis: { bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300" },
  ajourne: { bg: "bg-red-50 dark:bg-red-950", text: "text-red-700 dark:text-red-300" },
  rattrapage: { bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-300" },
  exclu: { bg: "bg-red-50 dark:bg-red-950", text: "text-red-700 dark:text-red-300" },
  a_declasser: { bg: "bg-purple-50 dark:bg-purple-950", text: "text-purple-700 dark:text-purple-300" },
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

export function StudentRelevesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const releves = useReleves();
  useMentions(); // s'abonne pour refléter la vraie mention si la configuration change
  useDeliberations(); // s'abonne pour refléter la vraie décision de jury si une délibération change
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const inscriptions = useInscriptions(student?.id ?? "");

  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<"notes" | "bulletin" | "historique">("notes");
  const [previewReleve, setPreviewReleve] = useState<ReleveRecord | null>(null);

  const mesReleves = useMemo(
    () => releves.filter((r) => r.etudiantId === student?.id).sort((a, b) => releveSortKey(b) - releveSortKey(a)),
    [releves, student?.id],
  );
  const selected = mesReleves.find((r) => r.id === selectedId) ?? mesReleves[0];
  const resolved = selected ? resolveBulletin(selected, students) : undefined;

  const filiereObj = student ? FILIERES.find((f) => f.id === student.filiereId) : undefined;
  const totalSemestresProgramme = filiereObj ? SEMESTRES.filter((s) => s.filiere === filiereObj.code).length : 0;
  const semestresValides = useMemo(
    () => mesReleves.filter((r) => resolveBulletin(r, students)?.decision === "admis").length,
    [mesReleves, students],
  );
  const inscriptionCorrespondante = selected ? inscriptions.find((i) => i.annee === selected.annee) : undefined;

  if (!student) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Relevés & bulletins</h2>
          <p className="text-sm text-muted-foreground mt-1">Même moteur de calcul que le bulletin officiel — aucune moyenne recalculée séparément.</p>
        </div>
        {mesReleves.length > 0 && (
          <select
            value={selected?.id ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="releves-semestre"
          >
            {mesReleves.map((r) => (
              <option key={r.id} value={r.id}>{r.semestre}{r.annee ? ` — ${r.annee}` : ""}</option>
            ))}
          </select>
        )}
      </div>

      {mesReleves.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">
          Aucun relevé officiel disponible pour l'instant.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <KPICard
              icon={GraduationCap}
              label="Moyenne du semestre"
              value={resolved ? `${resolved.moyenne.toFixed(2)}/20` : "—"}
              accentColor={resolved && resolved.moyenne >= 10 ? "#10b981" : "#ef4444"}
            />
            <KPICard
              icon={Award}
              label="Crédits obtenus"
              value={resolved ? `${resolved.creditsObtenus}/${resolved.creditsTotal}` : "—"}
              subtitle={resolved && resolved.creditsTotal > 0 ? `${Math.round((resolved.creditsObtenus / resolved.creditsTotal) * 100)}% obtenus` : undefined}
              accentColor="#2563eb"
            />
            <KPICard
              icon={CheckCircle2}
              label="Semestres validés"
              value={`${semestresValides}/${totalSemestresProgramme || mesReleves.length}`}
              accentColor="#8b5cf6"
            />
            <KPICard
              icon={Trophy}
              label="Rang dans la classe"
              value={resolved?.rang ? `${resolved.rang}/${resolved.totalClasse}` : "—"}
              accentColor="#f59e0b"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4 min-w-0">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
                {([["notes", "Relevé de notes"], ["bulletin", "Bulletins"], ["historique", "Historique"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", tab === key ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                    data-testid={`releves-onglet-${key}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "notes" && (
                !resolved ? (
                  <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Détail indisponible pour ce relevé.</p>
                ) : (
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-foreground">Relevé de notes — {selected.semestre}</h3>
                      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap", DECISION_TONE[resolved.decision ?? ""]?.bg ?? "bg-muted", DECISION_TONE[resolved.decision ?? ""]?.text ?? "text-muted-foreground")}>
                        {resolved.decisionLabel}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground uppercase">
                            <th className="px-4 py-3">Matières</th>
                            <th className="px-4 py-3">CC</th>
                            <th className="px-4 py-3">Examen</th>
                            <th className="px-4 py-3">Moyenne</th>
                            <th className="px-4 py-3">Crédits</th>
                            <th className="px-4 py-3">Résultat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resolved.ues.map((ue) => (
                            <Fragment key={ue.id}>
                              <tr className="border-b border-border bg-muted/30">
                                <td className="px-4 py-2.5 font-bold text-foreground">{ue.code} — {ue.libelle}</td>
                                <td className="px-4 py-2.5" />
                                <td className="px-4 py-2.5" />
                                <td className={cn("px-4 py-2.5 font-bold", ue.moyenne !== undefined ? (ue.moyenne >= 10 ? "text-emerald-600" : "text-red-500") : "")}>
                                  {ue.moyenne !== undefined ? `${ue.moyenne.toFixed(2)}/20` : "—"}
                                </td>
                                <td className="px-4 py-2.5 font-medium">{ue.creditsObtenus}/{ue.credits}</td>
                                <td className={cn("px-4 py-2.5 font-medium", ue.validee ? "text-emerald-600" : "text-red-500")}>{ue.validee ? "Validée" : "Non validée"}</td>
                              </tr>
                              {ue.ecs.map((ec) => (
                                <tr key={ec.id} className="border-b border-border last:border-0">
                                  <td className="px-4 py-2.5 pl-8 text-muted-foreground">{ec.libelle}</td>
                                  <td className="px-4 py-2.5">{ec.cc !== undefined ? ec.cc.toFixed(2) : "—"}</td>
                                  <td className="px-4 py-2.5">{ec.ef !== undefined ? ec.ef.toFixed(2) : "—"}</td>
                                  <td className={cn("px-4 py-2.5 font-medium", ec.moyenne !== undefined ? (ec.moyenne >= 10 ? "text-emerald-600" : "text-red-500") : "")}>
                                    {ec.moyenne !== undefined ? ec.moyenne.toFixed(2) : "—"}
                                  </td>
                                  <td className="px-4 py-2.5" />
                                  <td className="px-4 py-2.5" />
                                </tr>
                              ))}
                            </Fragment>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/40 font-bold text-foreground">
                            <td className="px-4 py-3">Moyenne {selected.semestre}</td>
                            <td className="px-4 py-3" colSpan={2} />
                            <td className="px-4 py-3">{resolved.moyenne.toFixed(2)}/20</td>
                            <td className="px-4 py-3">{resolved.creditsObtenus}/{resolved.creditsTotal}</td>
                            <td className="px-4 py-3" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )
              )}

              {tab === "bulletin" && (
                <div className="rounded-2xl border border-border bg-card p-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <FileText size={24} className="text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Bulletin officiel — {selected.semestre}{selected.annee ? ` (${selected.annee})` : ""}</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Document identique à celui imprimé par l'administration.</p>
                  <button
                    onClick={() => setPreviewReleve(selected)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                    data-testid={`portal-bulletin-apercu-${selected.id}`}
                  >
                    <Eye size={14} /> Voir le bulletin
                  </button>
                </div>
              )}

              {tab === "historique" && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {mesReleves.map((r) => {
                    const res = resolveBulletin(r, students);
                    const isActive = r.id === selected?.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => { setSelectedId(r.id); setTab("notes"); }}
                        className={cn("text-left rounded-2xl border p-4 transition-colors", isActive ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border bg-card hover:bg-muted/50")}
                        data-testid={`releves-historique-${r.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-foreground">{r.semestre.replace(/\s*\(S\d+\)/, "")}</span>
                          {res && (
                            <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", DECISION_TONE[res.decision ?? ""]?.bg ?? "bg-muted", DECISION_TONE[res.decision ?? ""]?.text ?? "text-muted-foreground")}>
                              {res.decisionLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.annee ?? "Année inconnue"}</p>
                        <div className="flex gap-4 mt-2.5 text-xs">
                          <span className="text-muted-foreground">Moyenne <strong className="text-foreground">{res ? `${res.moyenne.toFixed(2)}/20` : "—"}</strong></span>
                          <span className="text-muted-foreground">Crédits <strong className="text-foreground">{res ? `${res.creditsObtenus}/${res.creditsTotal}` : "—"}</strong></span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-bold text-foreground mb-3">Bulletin du semestre</h3>
                <div className="rounded-xl border border-dashed border-border p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{selected.semestre}</p>
                    <p className="text-[11px] text-muted-foreground">{selected.annee ?? "—"}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewReleve(selected)}
                  className="w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Eye size={13} /> Voir le bulletin
                </button>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-bold text-foreground mb-2">Informations académiques</h3>
                <InfoRow label="Programme" value={resolved?.filiereNomComplet ?? student.filiere} />
                <InfoRow label="Niveau" value={resolved?.niveauLabel ?? student.niveau} />
                <InfoRow label="Année académique" value={selected.annee ?? "—"} />
                <InfoRow label="Statut" value={student.statut} />
                <InfoRow label="Date d'inscription" value={inscriptionCorrespondante ? formatDate(inscriptionCorrespondante.dateInscription) : "—"} />
              </div>

              {resolved && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="text-sm font-bold text-foreground mb-2">Appréciation</h3>
                  <p className="text-sm text-muted-foreground">{resolved.appreciation}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {previewReleve && (
        <BulletinPreviewModal entry={previewReleve} resolved={resolveBulletin(previewReleve, students)} onClose={() => setPreviewReleve(null)} />
      )}
    </div>
  );
}

function printRecu(p: import("@/data/studentStore").PaiementRecord) {
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return;
  const lignesHtml =
    p.lignes && p.lignes.length > 0
      ? p.lignes
          .map(
            (l) =>
              `<tr><td style="padding-left:12px;color:#666">${l.label}</td><td>${l.montant.toLocaleString("fr-FR")} FCFA</td></tr>`,
          )
          .join("")
      : `<tr><td>Rubrique</td><td>${p.rubrique}</td></tr>`;
  w.document.write(`<!DOCTYPE html><html><head><title>${p.numeroRecu}</title>
    <style>body{font-family:system-ui;padding:24px}h1{font-size:18px}table{width:100%;margin-top:16px}td{padding:6px 0;border-bottom:1px solid #eee}</style>
    </head><body>
    <h1>EduManage — Reçu de paiement</h1>
    <p>N° ${p.numeroRecu || p.reference}</p>
    <table>
      <tr><td>Date</td><td>${p.date}</td></tr>
      <tr><td>Étudiant</td><td>${p.etudiant}</td></tr>
      <tr><td colspan="2"><strong>Détail facture</strong></td></tr>
      ${lignesHtml}
      <tr><td>Montant versé</td><td><strong>${p.montant.toLocaleString("fr-FR")} FCFA</strong></td></tr>
      <tr><td>Moyen</td><td>${p.moyen}</td></tr>
      <tr><td>Statut</td><td>${p.statut}</td></tr>
      <tr><td>Solde restant</td><td>${p.soldeRestant.toLocaleString("fr-FR")} FCFA</td></tr>
    </table>
    <p style="margin-top:24px;font-size:12px;color:#666">Document généré automatiquement</p>
    <script>window.print()</script>
    </body></html>`);
  w.document.close();
}

export function StudentFraisPayePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const paiements = usePaiementsByEtudiant(student?.id ?? "");
  const payes = paiements.filter((p) => p.statut !== "annule" && p.montant > 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Frais payés</h2>
          <p className="text-sm text-muted-foreground mt-1">Historique des règlements effectivement encaissés</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total réglé</p>
          <p className="text-xl font-bold text-emerald-600">{formatCFA(payes.reduce((s, p) => s + p.montant, 0))}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {payes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucun paiement enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Rubrique</th>
                <th className="px-4 py-3">Moyen</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Reçu</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payes.map((p) => {
                const c = moyenPaiementColor(p.moyen || "—");
                return (
                  <tr key={p.id} className="border-b border-border last:border-0" data-testid={`frais-paye-${p.id}`}>
                    <td className="px-4 py-3">{formatDate(p.date)}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">{p.rubrique}</div>
                      {p.lignes && p.lignes.length > 1 && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{p.lignes.map((l) => l.label).join(" · ")}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.moyen && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: c.color, background: c.bg }}>{p.moyen}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-600">{formatCFA(p.montant)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.numeroRecu || p.reference}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => printRecu(p)} className="text-xs text-primary hover:underline">Imprimer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function StudentFraisImpayePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const paiements = usePaiementsByEtudiant(student?.id ?? "");
  const impayes = paiements.filter((p) => p.statut !== "annule" && p.montant < montantQuittance(p));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Frais impayés</h2>
          <p className="text-sm text-muted-foreground mt-1">Factures en attente de règlement</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Solde dû</p>
          <p className={`text-xl font-bold ${(student?.soldeDu ?? 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>{formatCFA(student?.soldeDu ?? 0)}</p>
        </div>
      </div>
      {impayes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucune facture impayée — vous êtes à jour.</p>
      ) : (
        <div className="space-y-2">
          {impayes.map((p) => {
            const reste = montantQuittance(p) - p.montant;
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3" data-testid={`frais-impaye-${p.id}`}>
                <div>
                  <p className="text-sm font-medium text-foreground">{p.rubrique}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Émise le {formatDate(p.date)}{p.dateLimite && ` · échéance ${formatShortDate(p.dateLimite)}`}
                    {p.montant > 0 && ` · ${formatCFA(p.montant)} déjà réglé`}
                  </p>
                </div>
                <p className="text-lg font-bold text-red-500">{formatCFA(reste)}</p>
              </div>
            );
          })}
        </div>
      )}
      <Link
        href="/student/payer-factures"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <CreditCard size={15} /> Payer en ligne
      </Link>
    </div>
  );
}

const MOYENS_PAIEMENT_EN_LIGNE = ["wave", "orange"];

export function StudentPayerFacturesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const paiements = usePaiementsByEtudiant(student?.id ?? "");
  const modesPaiement = useModesPaiementFinance();
  const modesEnLigne = modesPaiement.filter((m) => MOYENS_PAIEMENT_EN_LIGNE.some((k) => m.intitule.toLowerCase().includes(k)));
  const impayes = paiements.filter((p) => p.statut !== "annule" && p.montant < montantQuittance(p));

  const [selectedId, setSelectedId] = useState<string>("");
  const [montant, setMontant] = useState<number>(0);
  const [moyen, setMoyen] = useState<string>("");
  const [numero, setNumero] = useState("");
  const [paying, setPaying] = useState(false);

  const selected = impayes.find((p) => p.id === selectedId);
  const resteSelected = selected ? montantQuittance(selected) - selected.montant : 0;

  const selectQuittance = (id: string) => {
    setSelectedId(id);
    const p = impayes.find((x) => x.id === id);
    setMontant(p ? montantQuittance(p) - p.montant : 0);
  };

  const handlePayer = () => {
    if (!student || !selected || !moyen || montant <= 0) return;
    if (montant > resteSelected) {
      toast.error("Le montant dépasse le reste dû sur cette facture.");
      return;
    }
    if (!numero.trim()) {
      toast.error("Indiquez le numéro utilisé pour la transaction (téléphone Wave/Orange Money).");
      return;
    }
    setPaying(true);
    const date = new Date().toISOString().slice(0, 10);
    const reference = `${moyen.toUpperCase().replace(/\s+/g, "-")}-${numero.trim()}`;
    const quittanceLignes = selected.lignes && selected.lignes.length > 0 ? selected.lignes : [{ label: selected.rubrique, montant: montantQuittance(selected) }];
    const dejaPayeAvant = selected.montant;
    payerQuittance({ id: selected.id, montant, moyen, reference, date });
    enregistrerEncaissement({
      quittanceId: selected.id,
      quittanceReference: selected.numeroRecu,
      quittanceDateEmission: selected.date,
      quittanceDateLimite: selected.dateLimite,
      montantQuittanceTotal: montantQuittance(selected),
      quittanceLignes,
      dejaPayeAvant,
      etudiantId: student.id,
      payeur: `${student.matricule} - ${student.prenom} ${student.nom}`,
      filiere: student.filiere,
      annee: student.annee,
      montant,
      moyen,
      referenceBancaire: reference,
      date,
      encaissePar: `${student.prenom} ${student.nom} (paiement en ligne)`,
    });
    toast.success("Paiement enregistré — merci !");
    setSelectedId("");
    setMontant(0);
    setMoyen("");
    setNumero("");
    setPaying(false);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Payer une facture en ligne</h2>
        <p className="text-sm text-muted-foreground mt-1">Solde dû : <span className={(student?.soldeDu ?? 0) > 0 ? "text-red-500 font-semibold" : "text-emerald-600 font-semibold"}>{formatCFA(student?.soldeDu ?? 0)}</span></p>
      </div>

      <div className="flex items-start gap-2.5 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
        <ShieldAlert size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Simulation de paiement en ligne — aucune passerelle Wave/Orange Money réelle n'est branchée (mode démo). Le règlement saisi ici est cependant enregistré comme un vrai paiement dans votre dossier, exactement comme s'il avait été encaissé par l'administration.
        </p>
      </div>

      {impayes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucune facture à régler — vous êtes à jour.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Facture à régler <span className="text-red-500">*</span></label>
            <select
              value={selectedId}
              onChange={(e) => selectQuittance(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="payer-facture-select"
            >
              <option value="">— Sélectionner —</option>
              {impayes.map((p) => (
                <option key={p.id} value={p.id}>{p.rubrique} — reste {formatCFA(montantQuittance(p) - p.montant)}</option>
              ))}
            </select>
          </div>

          {selected && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Montant à payer (max {formatCFA(resteSelected)}) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min={1}
                    max={resteSelected}
                    value={montant || ""}
                    onChange={(e) => setMontant(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="payer-facture-montant"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyen de paiement <span className="text-red-500">*</span></label>
                  <select
                    value={moyen}
                    onChange={(e) => setMoyen(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="payer-facture-moyen"
                  >
                    <option value="">— Sélectionner —</option>
                    {modesEnLigne.map((m) => (
                      <option key={m.id} value={m.intitule}>{m.intitule}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Numéro utilisé pour la transaction <span className="text-red-500">*</span></label>
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="ex: 77 000 00 00"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="payer-facture-numero"
                />
              </div>
              <button
                type="button"
                onClick={handlePayer}
                disabled={paying || !moyen || montant <= 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                data-testid="payer-facture-confirmer"
              >
                <CreditCard size={15} /> {paying ? "Paiement en cours…" : `Payer ${formatCFA(montant)}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function StudentProfilePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  if (!student) return <p className="text-sm text-muted-foreground">Profil introuvable.</p>;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4 max-w-2xl">
      <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mon profil</h2>
      <p className="text-xs text-muted-foreground">Le matricule est définitif dès la 1ère inscription.</p>
      {[
        ["Matricule", student.matricule],
        ["Nom", `${student.prenom} ${student.nom}`],
        ["Email", student.email],
        ["Téléphone", student.telephone || "—"],
        ["Filière", student.filiere],
        ["Niveau", student.niveau],
        ["Classe pédagogique", student.classe],
        ["Année", student.annee],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between border-b border-border py-2 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{value}</span>
        </div>
      ))}

      {(student.documentsFournis?.length ?? 0) > 0 && (
        <div className="pt-3 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
            Pièces justificatives déposées
          </h3>
          <ul className="space-y-1 text-sm">
            {student.documentsFournis!.map((docId) => {
              const label = DOCUMENTS_INSCRIPTION.find((d) => d.id === docId)?.label ?? docId;
              return (
                <li key={docId} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{docId}</span>
                  <span className="text-foreground font-medium">{label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

const COURSE_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-600", bar: "#2563eb" },
  { bg: "bg-emerald-100", text: "text-emerald-600", bar: "#10b981" },
  { bg: "bg-violet-100", text: "text-violet-600", bar: "#8b5cf6" },
  { bg: "bg-amber-100", text: "text-amber-600", bar: "#f59e0b" },
  { bg: "bg-pink-100", text: "text-pink-600", bar: "#ec4899" },
  { bg: "bg-indigo-100", text: "text-indigo-600", bar: "#4f46e5" },
];

/** Mes cours — une carte par EC réel de la maquette du niveau/filière de l'étudiant, avec des
 * indicateurs tous dérivés de données réelles : progression = heures de cahier de texte
 * réalisées / VHT (getCahierStatsForEc), prochaine séance = la plus proche séance future
 * planifiée pour cet EC, dernière note = la dernière note publiée pour cet EC. Aucune donnée
 * inventée (pas de date d'évaluation : EvaluationRecord n'en porte pas). */
type ProgressionBucket = "non_commence" | "en_cours" | "termine";
function bucketProgression(pct: number): ProgressionBucket {
  if (pct <= 0) return "non_commence";
  if (pct >= 100) return "termine";
  return "en_cours";
}

interface CoursTableRow extends Record<string, unknown> {
  id: string;
  cours: string;
  code: string;
  ue: string;
  semestre: string;
  prof: string;
  credits: number;
  vht: number;
  progression: number;
  prochain: string;
  note: string;
  ressources: number;
}

export function StudentCoursPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const ues = useUes();
  const ecs = useEcs();
  const seances = useSeances();
  const notes = useNotes();
  const anneeActuelle = useAnneeActuelle();
  useCahiers(); // s'abonne pour refléter la progression (cahiers de séance réellement soumis)
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const ressources = useRessourcesPourClasse(student?.classeId ?? "");

  const [query, setQuery] = useState("");
  const [semestreFiltre, setSemestreFiltre] = useState("");
  const [viewMode, setViewMode] = useState<"grille" | "liste" | "tableau">("grille");
  const [showFiltresAvances, setShowFiltresAvances] = useState(false);
  const [profFiltre, setProfFiltre] = useState("");
  const [progressionFiltre, setProgressionFiltre] = useState<"" | ProgressionBucket>("");
  const [avecRessourcesSeulement, setAvecRessourcesSeulement] = useState(false);
  const [avecNoteSeulement, setAvecNoteSeulement] = useState(false);
  const [tri, setTri] = useState<"nom" | "progression" | "credits">("nom");

  const mesUes = useMemo(
    () => ues.filter((u) => u.filiereId === student?.filiereId && u.niveau === student?.niveau).sort((a, b) => a.semestre.localeCompare(b.semestre) || a.code.localeCompare(b.code)),
    [ues, student?.filiereId, student?.niveau],
  );
  const semestres = useMemo(() => Array.from(new Set(mesUes.map((u) => u.semestre))), [mesUes]);
  const profsDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const ue of mesUes) for (const ec of ecs.filter((e) => e.ueId === ue.id)) if (ec.responsable) set.add(ec.responsable);
    return Array.from(set).sort();
  }, [mesUes, ecs]);

  const mesCoursBase = useMemo(() => {
    const list: { ue: UeRecord; ec: EcRecord }[] = [];
    for (const ue of mesUes) {
      if (semestreFiltre && ue.semestre !== semestreFiltre) continue;
      for (const ec of ecs.filter((e) => e.ueId === ue.id)) {
        const q = query.trim().toLowerCase();
        if (q && !`${ec.code} ${ec.libelle} ${ec.responsable}`.toLowerCase().includes(q)) continue;
        if (profFiltre && ec.responsable !== profFiltre) continue;
        list.push({ ue, ec });
      }
    }
    return list;
  }, [mesUes, ecs, semestreFiltre, query, profFiltre]);

  const todayIso = new Date().toISOString().slice(0, 10);
  function prochaineSeancePourEc(ecId: string) {
    const candidates = seances
      .filter((s) => s.ecId === ecId && s.classeId === student?.classeId)
      .map((s) => {
        const d = new Date(`${s.semaineDu}T12:00:00`);
        d.setDate(d.getDate() + (s.jour - 1));
        return { s, dateIso: d.toISOString().slice(0, 10) };
      })
      .filter((x) => x.dateIso >= todayIso)
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso) || a.s.heureDebut.localeCompare(b.s.heureDebut));
    return candidates[0];
  }

  function derniereNotePourEc(ecId: string) {
    const mine = notes.filter((n) => n.ecId === ecId && n.etudiantId === student?.id && n.statut === "publie");
    return mine[mine.length - 1];
  }

  const coursEnrichis = useMemo(() => {
    let list = mesCoursBase.map(({ ue, ec }, i) => ({
      ue,
      ec,
      color: COURSE_COLORS[i % COURSE_COLORS.length],
      stats: getCahierStatsForEc(ec.id),
      prochaine: prochaineSeancePourEc(ec.id),
      derniereNote: derniereNotePourEc(ec.id),
      nbRessources: ressources.filter((r) => r.ecId === ec.id).length,
    }));
    if (progressionFiltre) list = list.filter((c) => bucketProgression(c.stats.pctProgramme) === progressionFiltre);
    if (avecRessourcesSeulement) list = list.filter((c) => c.nbRessources > 0);
    if (avecNoteSeulement) list = list.filter((c) => !!c.derniereNote);
    if (tri === "progression") list = [...list].sort((a, b) => b.stats.pctProgramme - a.stats.pctProgramme);
    else if (tri === "credits") list = [...list].sort((a, b) => b.ec.credits - a.ec.credits);
    else list = [...list].sort((a, b) => a.ec.libelle.localeCompare(b.ec.libelle));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesCoursBase, ressources, seances, notes, student?.id, progressionFiltre, avecRessourcesSeulement, avecNoteSeulement, tri]);

  const activeAdvancedCount = [profFiltre, progressionFiltre, avecRessourcesSeulement, avecNoteSeulement].filter(Boolean).length;
  function resetFiltresAvances() {
    setProfFiltre("");
    setProgressionFiltre("");
    setAvecRessourcesSeulement(false);
    setAvecNoteSeulement(false);
    setTri("nom");
  }

  const tableRows: CoursTableRow[] = useMemo(() => coursEnrichis.map((c) => ({
    id: c.ec.id,
    cours: c.ec.libelle,
    code: c.ec.code,
    ue: c.ue.libelle,
    semestre: c.ue.semestre,
    prof: c.ec.responsable || "—",
    credits: c.ec.credits,
    vht: c.ec.vht,
    progression: c.stats.pctProgramme,
    prochain: c.prochaine ? `${formatShortDate(c.prochaine.dateIso)} · ${c.prochaine.s.heureDebut}` : "—",
    note: c.derniereNote ? `${c.derniereNote.note}/20` : "—",
    ressources: c.nbRessources,
  })), [coursEnrichis]);

  const tableColumns: Column<CoursTableRow>[] = [
    {
      key: "cours", header: "Cours", sortable: true,
      render: (r) => (<div><div className="font-medium text-foreground">{r.cours}</div><div className="text-[11px] text-muted-foreground">{r.code}</div></div>),
    },
    { key: "ue", header: "UE", sortable: true },
    { key: "semestre", header: "Sem.", sortable: true },
    { key: "prof", header: "Professeur", sortable: true },
    { key: "credits", header: "Crédits", sortable: true },
    {
      key: "progression", header: "Progression", sortable: true,
      render: (r) => <span className={cn("font-semibold", (r.progression as number) >= 100 && "text-emerald-600")}>{r.progression as number}%</span>,
    },
    { key: "prochain", header: "Prochain cours" },
    {
      key: "note", header: "Dernière note",
      render: (r) => {
        const v = r.note as string;
        if (v === "—") return v;
        return <span className={cn("font-semibold", parseFloat(v) >= 10 ? "text-emerald-600" : "text-red-500")}>{v}</span>;
      },
    },
    { key: "ressources", header: "Ressources", render: (r) => `${r.ressources as number} ress.` },
  ];

  // Historique réel des années précédentes : reconstruit à partir des notes publiées de
  // l'étudiant (seule trace réellement conservée par EC/année dans le modèle de données).
  const anneesPrecedentes = useMemo(() => {
    const map = new Map<string, { ec: string; note: number }[]>();
    for (const n of notes) {
      if (n.etudiantId !== student?.id || n.statut !== "publie" || n.annee === anneeActuelle) continue;
      if (!map.has(n.annee)) map.set(n.annee, []);
      map.get(n.annee)!.push({ ec: n.ec, note: n.note });
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [notes, student?.id, anneeActuelle]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes cours</h2>
        <p className="text-sm text-muted-foreground mt-1">{student?.filiere} · {student?.niveau} · Année {anneeActuelle} — maquette pédagogique</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un cours, un professeur…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="cours-recherche"
            />
          </div>
          <select
            value={semestreFiltre}
            onChange={(e) => setSemestreFiltre(e.target.value)}
            className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="cours-filtre-semestre"
          >
            <option value="">Tous les semestres</option>
            {semestres.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setShowFiltresAvances((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm border rounded-xl transition-colors",
              showFiltresAvances || activeAdvancedCount > 0 ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted",
            )}
            data-testid="cours-toggle-filtres-avances"
          >
            <SlidersHorizontal size={14} /> Filtres avancés
            {activeAdvancedCount > 0 && (
              <span className={cn("inline-flex items-center justify-center min-w-[16px] h-[16px] text-[10px] font-bold rounded-full px-1", showFiltresAvances || activeAdvancedCount > 0 ? "bg-white text-primary" : "bg-primary text-white")}>
                {activeAdvancedCount}
              </span>
            )}
            {showFiltresAvances ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-shrink-0 ml-auto">
            {([["grille", LayoutGrid, "Grille"], ["liste", List, "Liste"], ["tableau", Table2, "Tableau"]] as const).map(([mode, Icon, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                title={label}
                className={cn("p-2 rounded-md transition-colors", viewMode === mode ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                data-testid={`cours-vue-${mode}`}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        {showFiltresAvances && (
          <div className="pt-3 border-t border-border grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={profFiltre}
              onChange={(e) => setProfFiltre(e.target.value)}
              className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="cours-filtre-prof"
            >
              <option value="">Tous les professeurs</option>
              {profsDisponibles.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={progressionFiltre}
              onChange={(e) => setProgressionFiltre(e.target.value as "" | ProgressionBucket)}
              className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="cours-filtre-progression"
            >
              <option value="">Toute progression</option>
              <option value="non_commence">Non commencé</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
            </select>
            <select
              value={tri}
              onChange={(e) => setTri(e.target.value as "nom" | "progression" | "credits")}
              className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="cours-tri"
            >
              <option value="nom">Trier par nom</option>
              <option value="progression">Trier par progression</option>
              <option value="credits">Trier par crédits</option>
            </select>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={avecRessourcesSeulement} onChange={(e) => setAvecRessourcesSeulement(e.target.checked)} data-testid="cours-filtre-avec-ressources" />
                Avec ressources
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={avecNoteSeulement} onChange={(e) => setAvecNoteSeulement(e.target.checked)} data-testid="cours-filtre-avec-note" />
                Avec note publiée
              </label>
            </div>
            {activeAdvancedCount > 0 && (
              <button type="button" onClick={resetFiltresAvances} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors">
                <X size={11} /> Effacer les filtres avancés
              </button>
            )}
          </div>
        )}
      </div>

      {coursEnrichis.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucun cours ne correspond.</p>
      ) : viewMode === "tableau" ? (
        <DataTable columns={tableColumns} data={tableRows} pageSize={10} emptyMessage="Aucun cours ne correspond." />
      ) : viewMode === "liste" ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {coursEnrichis.map((c) => (
            <div key={c.ec.id} className="flex items-center gap-3 p-3.5 hover:bg-muted/40 transition-colors" data-testid={`cours-liste-${c.ec.id}`}>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", c.color.bg)}>
                <BookOpen size={14} className={c.color.text} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">{c.ec.libelle}</div>
                <div className="text-[11px] text-muted-foreground truncate">{c.ec.code} · {c.ue.libelle} · {c.ec.responsable || "Responsable non assigné"}</div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0 hidden sm:inline-block">{c.ue.semestre}</span>
              <div className="w-24 flex-shrink-0 hidden md:block">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.stats.pctProgramme}%`, background: c.color.bar }} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 text-right">{c.stats.pctProgramme}%</div>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0 w-14 text-right hidden sm:block">{c.ec.credits} cr.</span>
              <Link href="/student/ressources" className="p-1.5 rounded-lg text-primary hover:bg-primary/10 flex-shrink-0" title={`${c.nbRessources} ressource(s)`}>
                <Library size={14} />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {coursEnrichis.map(({ ue, ec, color, stats, prochaine, derniereNote, nbRessources }) => (
            <div key={ec.id} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ boxShadow: "var(--shadow-sm)" }} data-testid={`cours-ec-${ec.id}`}>
              <div className="p-4 flex-1">
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", color.bg)}>
                    <BookOpen size={16} className={color.text} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-foreground leading-tight">{ec.libelle}</h3>
                    <p className="text-[11px] text-muted-foreground truncate">{ec.code} · {ue.libelle}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">{ue.semestre}</span>
                </div>

                <p className="text-xs text-muted-foreground truncate mb-1">{ec.responsable || "Responsable non assigné"}</p>
                <p className="text-[11px] text-muted-foreground mb-3">{ec.credits} crédit(s) · {ec.vht}h VHT</p>

                <div className="mb-3">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">Progression du programme</span>
                    <span className="font-semibold text-foreground">{stats.pctProgramme}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${stats.pctProgramme}%`, background: color.bar }} />
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock size={11} className="flex-shrink-0" />
                    {prochaine ? (
                      <span className="truncate">Prochain cours : {formatShortDate(prochaine.dateIso)} · {prochaine.s.heureDebut} · {prochaine.s.salle}</span>
                    ) : (
                      <span>Aucune séance à venir planifiée</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <GraduationCap size={11} className="flex-shrink-0" />
                    {derniereNote ? (
                      <span>Dernière note : <span className={cn("font-semibold", derniereNote.note >= 10 ? "text-emerald-600" : "text-red-500")}>{derniereNote.note}/20</span> ({derniereNote.type})</span>
                    ) : (
                      <span>Aucune note publiée</span>
                    )}
                  </div>
                </div>
              </div>
              <Link
                href="/student/ressources"
                className="flex items-center gap-1.5 px-4 py-2.5 border-t border-border text-xs font-medium text-primary hover:bg-muted/60 transition-colors"
              >
                <Library size={12} /> {nbRessources} ressource{nbRessources !== 1 ? "s" : ""} disponible{nbRessources !== 1 ? "s" : ""}
              </Link>
            </div>
          ))}
        </div>
      )}

      {anneesPrecedentes.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold text-sm text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Années précédentes</h3>
          <div className="space-y-4">
            {anneesPrecedentes.map(([annee, items]) => (
              <div key={annee}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Année {annee}</p>
                <div className="space-y-1">
                  {items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-1.5">
                      <span className="text-foreground">{it.ec}</span>
                      <span className={cn("font-semibold text-xs", it.note >= 10 ? "text-emerald-600" : "text-red-500")}>{it.note}/20</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Link href="/student/releves" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium mt-3">
            Voir mes relevés & bulletins
          </Link>
        </div>
      )}
    </div>
  );
}

function AbsenceLigne({ r, withMatiere = true }: { r: ReturnType<typeof getAssiduiteRowsPourEtudiant>[number]; withMatiere?: boolean }) {
  return (
    <tr className="border-b border-border last:border-0" data-testid={`absence-ligne-${r.id}`}>
      <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.date)}</td>
      {withMatiere && (
        <td className="px-4 py-3">
          <div className="font-medium text-foreground">{r.ec}</div>
          <div className="text-[11px] text-muted-foreground">{r.prof}</div>
        </td>
      )}
      <td className="px-4 py-3">
        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", r.type === "absence" ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300")}>
          {r.type === "absence" ? "Absence" : `Retard${r.retardMinutes ? ` (${r.retardMinutes} min)` : ""}`}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.heureDebut}–{r.heureFin}</td>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
        <span className="inline-flex items-center gap-1"><MapPin size={11} />{r.salle || "—"}</span>
      </td>
      <td className="px-4 py-3">
        {r.justifie ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Justifiée{r.justification ? ` — ${r.justification}` : ""}</span>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground">Non justifiée</p>
            <Link href="/student/requests" className="text-xs text-primary hover:underline whitespace-nowrap" data-testid={`absence-justifier-${r.id}`}>
              Demander une justification
            </Link>
          </div>
        )}
      </td>
    </tr>
  );
}

export function StudentAbsencesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const ues = useUes();
  useCahiers(); // s'abonne pour refléter les cahiers de séance réellement soumis
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];

  const [semestreSelectionne, setSemestreSelectionne] = useState("");
  const [onglet, setOnglet] = useState<"apercu" | "matieres" | "historique">("apercu");
  const [matiereFiltre, setMatiereFiltre] = useState("");

  const mesUes = useMemo(
    () => ues.filter((u) => u.filiereId === student?.filiereId && u.niveau === student?.niveau).sort((a, b) => a.semestre.localeCompare(b.semestre)),
    [ues, student?.filiereId, student?.niveau],
  );
  const semestres = useMemo(() => Array.from(new Set(mesUes.map((u) => u.semestre))), [mesUes]);
  const semestreActif = semestreSelectionne || semestres[0] || "";

  const rowsSemestre = useMemo(
    () => (student ? getAssiduiteRowsPourEtudiant(student.id).filter((r) => r.semestre === semestreActif) : []),
    [student, semestreActif],
  );
  const matieres = useMemo(() => Array.from(new Set(rowsSemestre.map((r) => r.ec))).sort(), [rowsSemestre]);
  const rowsFiltrees = useMemo(
    () => (matiereFiltre ? rowsSemestre.filter((r) => r.ec === matiereFiltre) : rowsSemestre),
    [rowsSemestre, matiereFiltre],
  );

  const taux = student ? getTauxPresencePourEtudiant(student.id, semestreActif || undefined) : { present: 0, total: 0, pct: 100 };
  const hebdo = useMemo(() => (student ? getPresenceHebdoPourEtudiant(student.id, semestreActif || undefined) : []), [student, semestreActif]);
  const parMatiere = useMemo(() => (student ? getPresenceParEcPourEtudiant(student.id, semestreActif || undefined) : []), [student, semestreActif]);
  const heuresNonJustifiees = student && student.classeId ? getHeuresAbsenceNonJustifieePourEtudiant(student.id, student.classeId, semestreActif) : 0;

  const absencesCount = rowsSemestre.filter((r) => r.type === "absence").length;
  const retardsCount = rowsSemestre.filter((r) => r.type === "retard").length;

  const repartition = [
    { label: "Présences", color: "#10b981", count: taux.present },
    { label: "Retards", color: "#f59e0b", count: retardsCount },
    { label: "Absences", color: "#ef4444", count: absencesCount },
  ].filter((d) => d.count > 0);

  if (!student) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Absences / retards</h2>
          <p className="text-sm text-muted-foreground mt-1">Constatés à partir des cahiers de séance réellement soumis</p>
        </div>
        {semestres.length > 0 && (
          <select
            value={semestreActif}
            onChange={(e) => setSemestreSelectionne(e.target.value)}
            className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="absences-semestre"
          >
            {semestres.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard icon={CheckCircle2} label="Taux de présence" value={`${taux.pct}%`} subtitle={`${taux.present}/${taux.total} séances`} accentColor={taux.pct >= 80 ? "#10b981" : "#ef4444"} />
        <KPICard icon={ShieldAlert} label="Absences" value={absencesCount} subtitle={taux.total > 0 ? `${Math.round((absencesCount / taux.total) * 100)}% des séances` : undefined} accentColor="#ef4444" />
        <KPICard icon={Clock} label="Retards" value={retardsCount} subtitle={taux.total > 0 ? `${Math.round((retardsCount / taux.total) * 100)}% des séances` : undefined} accentColor="#f59e0b" />
        <KPICard icon={Library} label="Total séances" value={taux.total} subtitle="Cette période" accentColor="#2563eb" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
            {([["apercu", "Vue d'ensemble"], ["matieres", "Par matière"], ["historique", "Historique"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setOnglet(key)}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", onglet === key ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                data-testid={`absences-onglet-${key}`}
              >
                {label}
              </button>
            ))}
          </div>

          {onglet === "apercu" && (
            <>
              <div className="grid sm:grid-cols-2 gap-4 min-w-0">
                <div className="rounded-2xl border border-border bg-card p-5 min-w-0">
                  <h3 className="text-sm font-bold text-foreground mb-3">Répartition des statuts</h3>
                  {repartition.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Aucune séance constatée pour l'instant.</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={repartition} cx="50%" cy="50%" outerRadius={65} innerRadius={35} dataKey="count">
                            {repartition.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: number, _n, item) => [`${v} séance(s)`, item.payload.label]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {repartition.map((d) => (
                          <div key={d.label} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full" style={{ background: d.color }} />{d.label}</span>
                            <span className="font-semibold text-foreground">{d.count}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 min-w-0">
                  <h3 className="text-sm font-bold text-foreground mb-3">Évolution de la présence</h3>
                  {hebdo.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Pas encore assez de séances pour une évolution.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={hebdo} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="semaineLabel" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                        <Tooltip formatter={(v: number) => [`${v}%`, "Présence"]} />
                        <Line type="monotone" dataKey="pct" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">Dernières absences et retards</h3>
                  {rowsSemestre.length > 6 && (
                    <button type="button" onClick={() => setOnglet("historique")} className="text-xs text-primary hover:underline">Voir tout →</button>
                  )}
                </div>
                {rowsSemestre.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Aucune absence ni retard constaté ce semestre.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground uppercase">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Matière</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Heure</th>
                          <th className="px-4 py-3">Salle</th>
                          <th className="px-4 py-3">Justification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rowsSemestre.slice(0, 6).map((r) => <AbsenceLigne key={r.id} r={r} />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {onglet === "matieres" && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {parMatiere.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Aucune séance constatée ce semestre.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground uppercase">
                        <th className="px-4 py-3">Matière</th>
                        <th className="px-4 py-3">Séances</th>
                        <th className="px-4 py-3">Absences</th>
                        <th className="px-4 py-3">Retards</th>
                        <th className="px-4 py-3">Taux de présence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parMatiere.map((m) => {
                        const abs = rowsSemestre.filter((r) => r.ec === m.ec && r.type === "absence").length;
                        const ret = rowsSemestre.filter((r) => r.ec === m.ec && r.type === "retard").length;
                        return (
                          <tr key={m.ec} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-medium text-foreground">{m.ec}</td>
                            <td className="px-4 py-3 text-muted-foreground">{m.total}</td>
                            <td className="px-4 py-3 text-muted-foreground">{abs}</td>
                            <td className="px-4 py-3 text-muted-foreground">{ret}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
                                  <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: m.pct >= 80 ? "#10b981" : m.pct >= 60 ? "#f59e0b" : "#ef4444" }} />
                                </div>
                                <span className="font-semibold text-foreground text-xs">{m.pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {onglet === "historique" && (
            <>
              {matieres.length > 0 && (
                <select
                  value={matiereFiltre}
                  onChange={(e) => setMatiereFiltre(e.target.value)}
                  className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="absences-filtre-matiere"
                >
                  <option value="">Toutes les matières</option>
                  {matieres.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {rowsFiltrees.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Aucune absence ni retard constaté.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground uppercase">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Matière</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Heure</th>
                          <th className="px-4 py-3">Salle</th>
                          <th className="px-4 py-3">Justification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rowsFiltrees.map((r) => <AbsenceLigne key={r.id} r={r} />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="space-y-4 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Taux de présence par matière</h3>
            {parMatiere.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucune donnée pour l'instant.</p>
            ) : (
              <div className="space-y-3">
                {parMatiere.slice(0, 6).map((m) => (
                  <div key={m.ec} className="min-w-0">
                    <div className="flex items-center justify-between text-xs mb-1 min-w-0">
                      <span className="text-foreground truncate pr-2 min-w-0">{m.ec}</span>
                      <span className="font-semibold text-foreground flex-shrink-0">{m.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: m.pct >= 80 ? "#10b981" : m.pct >= 60 ? "#f59e0b" : "#ef4444" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Conséquence</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Vous cumulez actuellement <strong className="text-foreground">{heuresNonJustifiees} h</strong> d'absence non justifiée ce semestre. Au-delà de 10h, une exclusion disciplinaire peut être prononcée par le jury de délibération.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
