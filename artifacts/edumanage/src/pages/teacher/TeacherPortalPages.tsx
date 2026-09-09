import { useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import {
  ChevronLeft, ChevronRight, CalendarDays, BookOpen, AlertTriangle, Wallet,
  User, ArrowRight, ChevronRight as ChevronRightIcon, Clock, CalendarX, Repeat, Receipt,
  Search, CheckCircle2, XCircle, MessageCircle, History, FileEdit, Ban, ChevronDown, ChevronUp,
  Gauge, CircleDollarSign, Building2, FileText,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeances } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useTypesSeance, useJoursFeries } from "@/hooks/useScheduleSettingsStore";
import { useEvenements } from "@/hooks/useEvenementStore";
import { useTeachers } from "@/hooks/useTeacherStore";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { useVacations } from "@/hooks/useVacationStore";
import { usePointages } from "@/hooks/usePointageStore";
import { useTeacherVolumes } from "@/hooks/useTeacherVolumeStore";
import { getTeacherVolume, makeTeacherVolumeId } from "@/data/teacherVolumeStore";
import { getJourFerieCouvrant } from "@/data/scheduleSettingsStore";
import { ENSEIGNANTS, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { buildTeacherCourses } from "@/lib/teacherCourseUtils";
import { mondayOf, matchesProf, dateToJour, type EnseignantRecord } from "@/lib/teacherUtils";
import { addRallonge, type RallongeStatut } from "@/data/rallongeStore";
import { useRallonges } from "@/hooks/useRallongeStore";
import { useTeacherAbsences } from "@/hooks/useTeacherAbsenceStore";
import { montantTotal, contractStatut, type ContractLigne, type TeacherContractRecord } from "@/data/teacherContractStore";
import { useTeacherContracts } from "@/hooks/useTeacherContractStore";
import { printContract } from "@/lib/contractPrint";
import { getEtablissement } from "@/data/etablissementStore";
import { KPICard } from "@/components/admin/KPICard";
import { WeeklyScheduleGrid, type ScheduleBlock } from "@/components/shared/WeeklyScheduleGrid";
import { formatCFA, formatDate, formatShortDate, cn } from "@/lib/utils";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { PubliciteBanner } from "@/components/PubliciteBanner";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const FALLBACK_COLOR = "#4f46e5";

export function TeacherDashboardPage() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const seances = useSeances();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const absences = useTeacherAbsences();
  const rallonges = useRallonges();
  const decomptes = useDecomptes();
  const vacations = useVacations();
  const teachers = useTeachers();

  const myTeacher = useMemo(() => teachers.find((t) => t.id === currentUser?.linkedId) ?? null, [teachers, currentUser?.linkedId]);
  const annee = ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEES_ACADEMIQUES[0]?.libelle ?? "";

  const thisWeekMonday = mondayOf(new Date().toISOString().slice(0, 10));
  const weekSeances = useMemo(
    () => (myTeacher ? seances.filter((s) => matchesProf(myTeacher, s.prof) && s.semaineDu === thisWeekMonday).sort((a, b) => a.jour - b.jour || a.heureDebut.localeCompare(b.heureDebut)) : []),
    [seances, myTeacher, thisWeekMonday],
  );
  const todayJourNum = new Date().getDay();
  const todaySeances = useMemo(() => weekSeances.filter((s) => s.jour === todayJourNum), [weekSeances, todayJourNum]);

  const mineEcs = useMemo(() => (myTeacher ? ecs.filter((e) => matchesProf(myTeacher, e.responsable)) : []), [ecs, myTeacher]);
  const courses = useMemo(() => (myTeacher ? buildTeacherCourses(myTeacher, seances, ecs, ues, classes, annee) : []), [myTeacher, seances, ecs, ues, classes, annee]);
  const volumeHoraireTotal = courses.reduce((sum, c) => sum + c.volumeHoraire, 0);

  const mineAbsences = useMemo(() => absences.filter((a) => a.teacherId === myTeacher?.id).sort((a, b) => b.date.localeCompare(a.date)), [absences, myTeacher?.id]);
  const absencesNonJustifiees = mineAbsences.filter((a) => !a.justifie).length;

  const mineRallonges = useMemo(() => rallonges.filter((r) => r.teacherId === myTeacher?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [rallonges, myTeacher?.id]);

  const mineDecomptes = useMemo(
    () => decomptes.filter((d) => d.teacherId === myTeacher?.id && d.statut !== "annule").sort((a, b) => b.date.localeCompare(a.date)),
    [decomptes, myTeacher?.id],
  );
  const mineVacations = useMemo(() => vacations.filter((v) => v.enseignantId === myTeacher?.id), [vacations, myTeacher?.id]);
  /** Reste à percevoir unifié vacations + décomptes — même logique que "Ma rémunération" (une
   * vacation non "payée" reste due en totalité, il n'y a pas de paiement partiel côté vacation). */
  const soldeDecompte =
    mineDecomptes.reduce((sum, d) => sum + (d.netAPayer - d.montantPaye), 0) +
    mineVacations.reduce((sum, v) => sum + (v.statut === "paye" ? 0 : v.montantTotal), 0);

  return (
    <div className="space-y-6">
      <PubliciteBanner profil="teacher" />
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Bonjour</p>
          <h2 className="text-2xl font-bold text-foreground mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>{currentUser?.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {myTeacher ? `${myTeacher.matricule} · ${myTeacher.specialite} · ${myTeacher.grade}` : "Compte non rattaché à une fiche professeur"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLocation("/teacher/profile")}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors flex-shrink-0"
        >
          <User size={14} /> Voir mon profil <ArrowRight size={12} />
        </button>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KPICard icon={CalendarDays} label="Séances cette semaine" value={weekSeances.length} accentColor="#2563eb" onClick={() => setLocation("/teacher/schedule")} />
        <KPICard icon={BookOpen} label="Mes modules (EC)" value={mineEcs.length} accentColor="#8b5cf6" onClick={() => setLocation("/teacher/modules")} />
        <KPICard
          icon={AlertTriangle}
          label="Absences/retards non justifiés"
          value={absencesNonJustifiees}
          accentColor={absencesNonJustifiees > 0 ? "#ef4444" : "#10b981"}
          onClick={() => setLocation("/teacher/absences")}
        />
        <KPICard
          icon={Wallet}
          label="Solde à percevoir"
          value={formatCFA(soldeDecompte)}
          accentColor={soldeDecompte > 0 ? "#ef4444" : "#10b981"}
          onClick={() => setLocation("/teacher/remuneration")}
        />
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col min-w-0">
          <h3 className="font-bold text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Aperçu professionnel</h3>
          <div className="space-y-2 text-sm flex-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Statut</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{myTeacher?.grade ?? "--"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Spécialité</span>
              <span className="font-medium text-foreground">{myTeacher?.specialite ?? "--"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Modules assignés</span>
              <span className="font-medium text-foreground">{mineEcs.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Volume horaire assigné</span>
              <span className="font-bold text-foreground">{volumeHoraireTotal} h</span>
            </div>
          </div>
          <button onClick={() => setLocation("/teacher/modules")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium mt-3">
            Voir mes modules <ArrowRight size={11} />
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col min-w-0">
          <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
            <div className="min-w-0">
              <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Aujourd&apos;hui</h3>
              <p className="text-[10px] text-muted-foreground">{formatDate(new Date().toISOString().slice(0, 10))}</p>
            </div>
            <button onClick={() => setLocation("/teacher/schedule")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium flex-shrink-0">
              Voir le planning <ArrowRight size={11} />
            </button>
          </div>
          {todaySeances.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground text-center py-6">Aucun cours prévu aujourd&apos;hui.</div>
          ) : (
            <div className="space-y-2">
              {todaySeances.map((s) => (
                <div key={s.id} onClick={() => setLocation("/teacher/schedule")} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg flex-shrink-0">{s.heureDebut}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{s.ec}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.classe} · Salle {s.salle}</div>
                  </div>
                  <ChevronRightIcon size={14} className="text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-2xl overflow-hidden min-w-0" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <CalendarX size={16} className="text-red-600" />
              </div>
              <h3 className="font-bold text-foreground truncate" style={{ fontFamily: "Outfit, sans-serif" }}>Absences & retards</h3>
            </div>
            <button onClick={() => setLocation("/teacher/absences")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium flex-shrink-0">
              Voir tout <ArrowRight size={11} />
            </button>
          </div>
          {mineAbsences.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune absence ni retard constaté.</div>
          ) : (
            <div className="p-2">
              {mineAbsences.slice(0, 6).map((a) => (
                <div key={a.id} onClick={() => setLocation("/teacher/absences")} className="flex items-center gap-3 mx-2 my-1 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer group">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{a.type === "absence" ? "Absence" : `Retard (${a.dureeMinutes} min)`}</div>
                    <div className="text-xs text-muted-foreground truncate">{formatDate(a.date)}</div>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0", a.justifie ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                    {a.justifie ? "Justifié" : "Non justifié"}
                  </span>
                  <ChevronRightIcon size={14} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden min-w-0" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Repeat size={16} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-foreground truncate" style={{ fontFamily: "Outfit, sans-serif" }}>Mes demandes de rallonge</h3>
            </div>
            <button onClick={() => setLocation("/teacher/rallonge")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium flex-shrink-0">
              Voir tout <ArrowRight size={11} />
            </button>
          </div>
          {mineRallonges.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune demande de rallonge envoyée.</div>
          ) : (
            <div className="p-2">
              {mineRallonges.slice(0, 6).map((r) => (
                <div key={r.id} onClick={() => setLocation("/teacher/rallonge")} className="flex items-center gap-3 mx-2 my-1 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer group">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">+{r.vhSupplementaire} h</div>
                    <div className="text-xs text-muted-foreground truncate">{r.motif}</div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0",
                      r.statut === "valide" ? "bg-emerald-50 text-emerald-700" : r.statut === "rejete" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700",
                    )}
                  >
                    {r.statut === "valide" ? "Validée" : r.statut === "rejete" ? "Rejetée" : "En attente"}
                  </span>
                  <ChevronRightIcon size={14} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden min-w-0" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Receipt size={16} className="text-emerald-600" />
              </div>
              <h3 className="font-bold text-foreground truncate" style={{ fontFamily: "Outfit, sans-serif" }}>Mes décomptes</h3>
            </div>
            <button onClick={() => setLocation("/teacher/remuneration")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium flex-shrink-0">
              Voir tout <ArrowRight size={11} />
            </button>
          </div>
          {mineDecomptes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucun décompte émis.</div>
          ) : (
            <div className="p-2">
              {mineDecomptes.slice(0, 6).map((d) => {
                const reste = d.netAPayer - d.montantPaye;
                return (
                  <div key={d.id} onClick={() => setLocation("/teacher/remuneration")} className="flex items-center gap-3 mx-2 my-1 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{d.reference}</div>
                      <div className="text-xs text-muted-foreground truncate">{formatDate(d.date)}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-foreground tabular-nums">{formatCFA(d.netAPayer)}</div>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", reste <= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                        {reste <= 0 ? "Payé" : `Reste ${formatCFA(reste)}`}
                      </span>
                    </div>
                    <ChevronRightIcon size={14} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden min-w-0" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-indigo-600" />
              </div>
              <h3 className="font-bold text-foreground truncate" style={{ fontFamily: "Outfit, sans-serif" }}>Planning de la semaine</h3>
            </div>
            <button onClick={() => setLocation("/teacher/schedule")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium flex-shrink-0">
              Voir tout <ArrowRight size={11} />
            </button>
          </div>
          {weekSeances.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune séance planifiée cette semaine.</div>
          ) : (
            <div className="p-2">
              {weekSeances.slice(0, 6).map((s) => (
                <div key={s.id} className="flex items-center gap-3 mx-2 my-1 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors">
                  <div className="flex flex-col items-center flex-shrink-0 w-14">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg flex items-center gap-1">
                      <Clock size={9} /> {s.heureDebut}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-1">{JOURS[s.jour] ?? s.jour}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{s.ec}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.classe} · Salle {s.salle}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function TeacherSchedulePage() {
  const { currentUser } = useAuth();
  const seances = useSeances();
  const evenements = useEvenements();
  const typesSeance = useTypesSeance();
  useJoursFeries();
  const teachers = useTeachers();
  const myTeacher = useMemo(() => teachers.find((t) => t.id === currentUser?.linkedId) ?? null, [teachers, currentUser?.linkedId]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [weekViewMode, setWeekViewMode] = useState<"semaine" | "jour">("semaine");

  const now = new Date();
  const todayDow = now.getDay() === 0 ? 7 : now.getDay();

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

  const todayJourNum = Math.min(((now.getDay() + 6) % 7) + 1, 6);
  const displayDayIdxs = weekViewMode === "jour" ? [todayJourNum - 1] : [0, 1, 2, 3, 4, 5];

  const weekSeances = useMemo(
    () => (myTeacher ? seances.filter((s) => matchesProf(myTeacher, s.prof) && s.semaineDu === weekMonday) : []),
    [seances, myTeacher, weekMonday],
  );
  const weekEvenements = useMemo(
    () => (myTeacher ? evenements.filter((e) => e.surveillant && matchesProf(myTeacher, e.surveillant)) : []),
    [evenements, myTeacher],
  );

  const blocks: ScheduleBlock[] = useMemo(() => [
    ...weekSeances.map((s) => {
      const typeRecord = typesSeance.find((t) => t.code === s.type);
      return {
        id: s.id, jour: s.jour, heureDebut: s.heureDebut, heureFin: s.heureFin,
        colorHex: typeRecord?.couleur ?? FALLBACK_COLOR, title: s.ec,
        lines: [s.classe, s.salle], testId: `mon-edt-seance-${s.id}`,
      };
    }),
    ...weekEvenements
      .filter((e) => dateToJour(e.date) >= 1 && weekDays.some((d) => d.toISOString().slice(0, 10) === e.date))
      .map((e) => {
        const typeRecord = typesSeance.find((t) => t.code === e.type);
        return {
          id: e.id, jour: dateToJour(e.date), heureDebut: e.heureDebut, heureFin: e.heureFin,
          colorHex: typeRecord?.couleur ?? FALLBACK_COLOR, title: e.objet,
          lines: [e.classe, e.salle].filter((v): v is string => !!v), dashed: true,
        };
      }),
  ], [weekSeances, weekEvenements, typesSeance, weekDays]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mon emploi du temps</h2>
        <div className="flex items-center gap-1 flex-wrap">
          <button type="button" data-testid="mon-edt-week-prev" onClick={() => setWeekOffset((w) => w - 1)} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium px-2">Sem. du {weekLabel}</span>
          <button type="button" data-testid="mon-edt-week-next" onClick={() => setWeekOffset((w) => w + 1)} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors">
            <ChevronRight size={16} />
          </button>
          <button type="button" data-testid="mon-edt-week-today" onClick={() => setWeekOffset(0)} className="px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">
            Aujourd&apos;hui
          </button>
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

      {!myTeacher ? (
        <p className="text-sm text-muted-foreground">Compte non rattaché à une fiche professeur.</p>
      ) : (
        <WeeklyScheduleGrid
          weekDays={weekDays}
          displayDayIdxs={displayDayIdxs}
          blocks={blocks}
          todayDow={todayDow}
          isCurrentWeek={weekOffset === 0}
          legend={typesSeance}
          ferieForDate={getJourFerieCouvrant}
          emptyMessage={`Aucune séance planifiée pour la semaine du ${formatShortDate(weekMonday)}.`}
        />
      )}
    </div>
  );
}

const RALLONGE_STATUT_LABEL: Record<RallongeStatut, string> = {
  soumis: "En attente",
  valide: "Validée",
  rejete: "Rejetée",
};

const RALLONGE_STATUT_CLS: Record<RallongeStatut, string> = {
  soumis: "bg-amber-50 text-amber-700",
  valide: "bg-emerald-50 text-emerald-700",
  rejete: "bg-red-50 text-red-700",
};

const RALLONGE_MOTIF_OPTIONS = [
  "Rattrapage de cours",
  "Avancement du programme",
  "Soutien aux étudiants",
  "Séance supplémentaire",
  "Absence imprévue",
  "Autre",
];

export function TeacherRallongePage() {
  const { currentUser } = useAuth();
  const seances = useSeances();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const pointages = usePointages();
  const rallonges = useRallonges();
  useTeacherVolumes(); // s'abonne pour re-rendre si une rallonge validée ajuste le VH

  const myTeacher = useMemo(
    () => ENSEIGNANTS.find((t) => t.id === currentUser?.linkedId) ?? null,
    [currentUser?.linkedId],
  );
  const annee = ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEES_ACADEMIQUES[0]?.libelle ?? "";

  const courses = useMemo(
    () => (myTeacher ? buildTeacherCourses(myTeacher, seances, ecs, ues, classes, annee) : []),
    [myTeacher, seances, ecs, ues, classes, annee],
  );

  const situation = useMemo(() => {
    if (!myTeacher) return { prevu: 0, effectue: 0 };
    let prevu = 0;
    let effectue = 0;
    for (const c of courses) {
      const volumeId = makeTeacherVolumeId(myTeacher.id, c.ecId, c.classeId, annee);
      prevu += getTeacherVolume(volumeId)?.nouveauVh ?? c.volumeHoraire;
      effectue += pointages
        .filter((p) => p.teacherId === myTeacher.id && p.ecId === c.ecId && p.classeId === c.classeId && p.annee === annee && (p.statut === "soumis" || p.statut === "valide"))
        .reduce((s, p) => s + p.volumePointe, 0);
    }
    return { prevu, effectue };
  }, [myTeacher, courses, annee, pointages]);
  const heuresRestantes = Math.max(0, situation.prevu - situation.effectue);

  const [courseId, setCourseId] = useState("");
  const [heures, setHeures] = useState("2");
  const [motifCategorie, setMotifCategorie] = useState("");
  const [motifDetails, setMotifDetails] = useState("");

  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;

  const mine = useMemo(
    () =>
      rallonges
        .filter((r) => r.teacherId === myTeacher?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [rallonges, myTeacher?.id],
  );

  const totalDemandes = mine.length;
  const approuvees = mine.filter((r) => r.statut === "valide").length;
  const enAttente = mine.filter((r) => r.statut === "soumis").length;
  const refusees = mine.filter((r) => r.statut === "rejete").length;
  const pct = (n: number) => (totalDemandes > 0 ? Math.round((n / totalDemandes) * 100) : 0);

  const [query, setQuery] = useState("");
  const [statutFiltre, setStatutFiltre] = useState<"" | RallongeStatut>("");

  const filtrees = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mine.filter((r) => {
      if (statutFiltre && r.statut !== statutFiltre) return false;
      if (q) {
        const ec = ecs.find((e) => e.id === r.ecId);
        const haystack = `${ec ? `${ec.code} ${ec.libelle}` : ""} ${r.motif}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [mine, query, statutFiltre, ecs]);

  const timeline = useMemo(() => {
    const events: { date: string; label: string; kind: RallongeStatut; requestId: string }[] = [];
    for (const r of mine) {
      events.push({ date: r.createdAt, label: "Demande envoyée", kind: "soumis", requestId: r.id });
      if (r.statut !== "soumis" && r.dateTraitement) {
        events.push({
          date: r.dateTraitement,
          label: r.statut === "valide" ? "Approuvée par l'administration" : "Refusée",
          kind: r.statut,
          requestId: r.id,
        });
      }
    }
    return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, [mine]);

  function handleSubmit() {
    if (!myTeacher || !selectedCourse) {
      toast.error("Sélectionnez un cours");
      return;
    }
    const heuresNum = Number(heures);
    if (!heuresNum || heuresNum <= 0) {
      toast.error("Indiquez un nombre d'heures valide");
      return;
    }
    if (!motifCategorie) {
      toast.error("Sélectionnez un motif");
      return;
    }
    if (motifCategorie === "Autre" && !motifDetails.trim()) {
      toast.error("Précisez le motif");
      return;
    }
    const motif = motifDetails.trim()
      ? (motifCategorie === "Autre" ? motifDetails.trim() : `${motifCategorie} — ${motifDetails.trim()}`)
      : motifCategorie;
    addRallonge({
      teacherId: myTeacher.id,
      ecId: selectedCourse.ecId,
      classeId: selectedCourse.classeId,
      annee,
      vhActuel: selectedCourse.volumeHoraire,
      vhSupplementaire: heuresNum,
      motif,
      origine: "prof",
    });
    toast.success("Demande de rallonge envoyée à l'administration");
    setCourseId("");
    setHeures("2");
    setMotifCategorie("");
    setMotifDetails("");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Demande de rallonge</h2>
        <p className="text-sm text-muted-foreground mt-1">Soumettez vos demandes d&apos;heures supplémentaires pour vos enseignements.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard icon={Clock} label="Total des demandes" value={totalDemandes} subtitle="Cette année académique" accentColor="#4f46e5" />
        <KPICard icon={CheckCircle2} label="Demandes approuvées" value={approuvees} subtitle={`${pct(approuvees)} % du total`} accentColor="#10b981" />
        <KPICard icon={Clock} label="En attente" value={enAttente} subtitle={`${pct(enAttente)} % du total`} accentColor="#f59e0b" />
        <KPICard icon={XCircle} label="Refusées" value={refusees} subtitle={`${pct(refusees)} % du total`} accentColor={refusees > 0 ? "#ef4444" : "#10b981"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Repeat size={16} className="text-primary" />
              <h3 className="font-bold text-sm text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Nouvelle demande de rallonge</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Demandez des heures supplémentaires sur un cours dont le volume prévu est dépassé.
              L&apos;administration valide ou rejette votre demande.
            </p>
            {!myTeacher ? (
              <p className="text-sm text-muted-foreground">Compte non rattaché à une fiche professeur.</p>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <select
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    data-testid="teacher-rallonge-select-cours"
                  >
                    <option value="">Sélectionner un cours</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.coursLabel} — {c.detailsLabel}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={motifCategorie}
                    onChange={(e) => setMotifCategorie(e.target.value)}
                    data-testid="teacher-rallonge-select-motif"
                  >
                    <option value="">Sélectionner un motif</option>
                    {RALLONGE_MOTIF_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    value={heures}
                    onChange={(e) => setHeures(e.target.value)}
                    placeholder="Nombre d'heures demandées"
                    data-testid="teacher-rallonge-input-heures"
                  />
                  {selectedCourse && (
                    <p className="text-xs text-muted-foreground self-center sm:col-span-2">
                      Volume horaire prévu actuellement : <span className="font-semibold text-foreground">{selectedCourse.volumeHoraire} h</span>
                    </p>
                  )}
                </div>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  value={motifDetails}
                  onChange={(e) => setMotifDetails(e.target.value)}
                  placeholder={motifCategorie === "Autre" ? "Précisez le motif…" : "Détails / justification (optionnel)…"}
                  data-testid="teacher-rallonge-textarea-details"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    data-testid="teacher-rallonge-soumettre"
                  >
                    Soumettre la demande
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-sm text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Mes demandes de rallonge</h3>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher un cours, un motif…"
                    className="pl-8 pr-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-rallonge-recherche"
                  />
                </div>
                <select
                  value={statutFiltre}
                  onChange={(e) => setStatutFiltre(e.target.value as "" | RallongeStatut)}
                  className="px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="teacher-rallonge-filtre-statut"
                >
                  <option value="">Tous les statuts</option>
                  {(Object.keys(RALLONGE_STATUT_LABEL) as RallongeStatut[]).map((s) => (
                    <option key={s} value={s}>{RALLONGE_STATUT_LABEL[s]}</option>
                  ))}
                </select>
              </div>
            </div>
            {mine.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Aucune demande de rallonge envoyée.</p>
            ) : filtrees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Aucune demande ne correspond aux filtres.</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3">Cours</th>
                    <th className="px-4 py-3">Rallonge</th>
                    <th className="px-4 py-3">Motif</th>
                    <th className="px-4 py-3">Date de demande</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrees.map((r) => {
                    const ec = ecs.find((e) => e.id === r.ecId);
                    const classe = classes.find((c) => c.id === r.classeId);
                    return (
                      <tr key={r.id} className="border-t border-border align-top" data-testid={`teacher-rallonge-${r.id}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{ec ? `${ec.code} — ${ec.libelle}` : r.ecId}</p>
                          <p className="text-xs text-muted-foreground">{classe?.nom}</p>
                        </td>
                        <td className="px-4 py-3">
                          +{r.vhSupplementaire} h
                          <span className="text-xs text-muted-foreground block">
                            {r.vhActuel}h → {r.vhActuel + r.vhSupplementaire}h
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {r.motif}
                          {r.statut === "rejete" && r.motifRejet && (
                            <span className="block text-red-600 text-xs mt-1">{r.motifRejet}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", RALLONGE_STATUT_CLS[r.statut])}>
                            {RALLONGE_STATUT_LABEL[r.statut]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <User size={16} className="text-primary" />
              <h3 className="font-bold text-sm text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Ma situation</h3>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Heures prévues (volume horaire)</span>
                <span className="font-semibold">{situation.prevu} h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Heures déjà effectuées</span>
                <span className="font-semibold">{situation.effectue} h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Heures restantes</span>
                <span className={cn("font-semibold", heuresRestantes > 0 ? "text-amber-600" : "text-emerald-600")}>{heuresRestantes} h</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">Les demandes de rallonge doivent être justifiées et validées par l&apos;administration.</p>
            </div>
          </div>

          {timeline.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <History size={16} className="text-primary" />
                <h3 className="font-bold text-sm text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Historique des statuts</h3>
              </div>
              <div className="space-y-3">
                {timeline.map((ev, i) => (
                  <div key={`${ev.requestId}-${ev.label}-${i}`} className="flex items-start gap-2.5">
                    <span className={cn(
                      "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                      ev.kind === "valide" ? "bg-emerald-500" : ev.kind === "rejete" ? "bg-red-500" : "bg-blue-500",
                    )} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{formatDate(ev.date)}</p>
                      <p className="text-[11px] text-muted-foreground">{ev.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-bold text-sm text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Besoin d&apos;aide ?</h3>
            <p className="text-xs text-muted-foreground mb-3">Une question sur une demande de rallonge ? Contactez directement l&apos;administration.</p>
            <Link
              href="/teacher/messages"
              className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              data-testid="teacher-rallonge-contacter-admin"
            >
              <MessageCircle size={14} /> Contacter l&apos;administration
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const CONTRACT_MODE_LABEL: Record<ContractLigne["modePaiement"], string> = {
  taux_horaire: "Volume horaire",
  forfait: "Forfait",
};

/** Le KPICard tronque les valeurs trop longues (`truncate`) — un montant à 7 chiffres ne rentre
 * pas en entier, donc on l'abrège au-delà d'1 000 000 FCFA plutôt que de laisser l'affichage coupé. */
function formatMontantKpi(montant: number): string {
  if (montant >= 1_000_000) {
    return `${(montant / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M FCFA`;
  }
  return `${montant.toLocaleString("fr-FR")} F CFA`;
}

const CONTRACT_STATUT_LABEL: Record<"actif" | "expire" | "resilie", string> = {
  actif: "Actif",
  expire: "Expiré",
  resilie: "Résilié",
};

const CONTRACT_STATUT_CLS: Record<"actif" | "expire" | "resilie", string> = {
  actif: "bg-emerald-50 text-emerald-700",
  expire: "bg-slate-100 text-slate-600",
  resilie: "bg-red-50 text-red-700",
};

interface ContractTimelineEvent {
  date: string;
  label: string;
  detail?: string;
  kind: "creation" | "avenant" | "resiliation";
}

function ContractCard({
  contract,
  myTeacher,
  ecs,
  classes,
  defaultOpen,
}: {
  contract: TeacherContractRecord;
  myTeacher: EnseignantRecord | null;
  ecs: ReturnType<typeof useEcs>;
  classes: ReturnType<typeof useClasses>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const statut = contractStatut(contract);
  const rows = contract.lignes.map((l) => {
    const ec = ecs.find((e) => e.id === l.ecId);
    const classe = classes.find((cl) => cl.id === l.classeId);
    return {
      coursLabel: ec ? `${ec.code} — ${ec.libelle}` : l.ecId,
      classeLabel: classe?.nom ?? l.classeId,
      modeLabel: CONTRACT_MODE_LABEL[l.modePaiement],
      montant: l.montant,
    };
  });

  const timeline: ContractTimelineEvent[] = useMemo(() => {
    const events: ContractTimelineEvent[] = [
      { date: contract.createdAt, label: "Contrat créé", kind: "creation" },
    ];
    for (const a of contract.avenants) {
      events.push({
        date: a.date,
        label: `Avenant n°${a.numero} — ${a.motif}`,
        detail: `Échéance : ${formatDate(a.dateFinAvant)} → ${formatDate(a.dateFinApres)}`,
        kind: "avenant",
      });
    }
    if (contract.resilie && contract.dateResiliation) {
      events.push({ date: contract.dateResiliation, label: "Contrat résilié", detail: contract.motifResiliation, kind: "resiliation" });
    }
    return events.sort((a, b) => b.date.localeCompare(a.date));
  }, [contract]);

  const etablissement = getEtablissement();

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full p-5 flex flex-wrap items-center justify-between gap-3 border-b border-border text-left hover:bg-muted/40 transition-colors"
        data-testid={`teacher-contract-toggle-${contract.id}`}
      >
        <div>
          <p className="font-bold text-sm">{contract.id}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {contract.annee} · {formatDate(contract.dateDebut)} → {formatDate(contract.dateFin)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", CONTRACT_STATUT_CLS[statut])}>
            {CONTRACT_STATUT_LABEL[statut]}
          </span>
          {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="p-5 space-y-4">
          {contract.resilie && contract.motifResiliation && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl">
              <Ban size={15} className="text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">
                Résilié le {contract.dateResiliation && formatDate(contract.dateResiliation)} — {contract.motifResiliation}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <KPICard icon={Wallet} label="Montant total" value={formatMontantKpi(montantTotal(contract))} accentColor="#4f46e5" />
            <KPICard icon={BookOpen} label="Cours couverts" value={contract.lignes.length} accentColor="#2563eb" />
            <KPICard icon={FileEdit} label="Avenants" value={contract.avenants.length} accentColor="#f59e0b" />
            <KPICard icon={CalendarDays} label="Échéance" value={formatShortDate(contract.dateFin)} accentColor={statut === "actif" ? "#10b981" : "#6b7280"} />
          </div>

          <div className="rounded-xl border border-border p-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Résumé du contrat</h4>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <User size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">Statut de l&apos;enseignant :</span>
                <span className="font-medium">{myTeacher?.grade ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">Spécialité :</span>
                <span className="font-medium">{myTeacher?.specialite ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">Référence :</span>
                <span className="font-medium">{contract.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">Établissement :</span>
                <span className="font-medium">{etablissement.nom}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Enseignements couverts</h4>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5">Cours</th>
                    <th className="px-4 py-2.5">Classe</th>
                    <th className="px-4 py-2.5">Mode de paiement</th>
                    <th className="px-4 py-2.5">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2.5">{r.coursLabel}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.classeLabel}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.modeLabel}</td>
                      <td className="px-4 py-2.5 font-medium">{r.montant.toLocaleString("fr-FR")} F CFA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {timeline.length > 1 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <History size={13} /> Historique
              </h4>
              <div className="space-y-3 rounded-xl border border-border p-4">
                {timeline.map((ev, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className={cn(
                      "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                      ev.kind === "resiliation" ? "bg-red-500" : ev.kind === "avenant" ? "bg-amber-500" : "bg-emerald-500",
                    )} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{formatDate(ev.date)} — {ev.label}</p>
                      {ev.detail && <p className="text-[11px] text-muted-foreground">{ev.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap gap-4">
              <Link href="/teacher/volume" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Gauge size={12} /> Voir mon volume horaire <ArrowRight size={11} />
              </Link>
              <Link href="/teacher/remuneration" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <CircleDollarSign size={12} /> Voir ma rémunération <ArrowRight size={11} />
              </Link>
            </div>
            <button
              type="button"
              onClick={() => printContract(contract, myTeacher ?? undefined, rows, statut)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted"
              data-testid={`teacher-contract-imprimer-${contract.id}`}
            >
              <Printer size={12} /> Imprimer / PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TeacherContractPage() {
  const { currentUser } = useAuth();
  const contracts = useTeacherContracts();
  const ecs = useEcs();
  const classes = useClasses();

  const myTeacher = ENSEIGNANTS.find((t) => t.id === currentUser?.linkedId) ?? null;
  // Trié par date de début réelle du contrat, pas par date de création de la fiche — sinon un
  // contrat plus ancien édité récemment par l'admin passerait devant le contrat de l'année en cours.
  const mine = contracts
    .filter((c) => c.teacherId === currentUser?.linkedId)
    .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>
          Mon contrat
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Consultez toutes les informations relatives à vos contrats d&apos;enseignement.</p>
      </div>

      {mine.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Aucun contrat n&apos;a encore été enregistré pour vous.
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2 space-y-4">
            {mine.map((c, i) => (
              <ContractCard key={c.id} contract={c} myTeacher={myTeacher} ecs={ecs} classes={classes} defaultOpen={i === 0} />
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-bold text-sm text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Besoin d&apos;une information ?</h3>
            <p className="text-xs text-muted-foreground mb-3">Une question sur votre contrat ou un avenant ? Contactez directement l&apos;administration.</p>
            <Link
              href="/teacher/messages"
              className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              data-testid="teacher-contract-contacter-admin"
            >
              <MessageCircle size={14} /> Contacter l&apos;administration
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export { TeacherCahierPage } from "./TeacherCahierPage";


