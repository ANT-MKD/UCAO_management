import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronLeft, ChevronRight, CalendarDays, BookOpen, AlertTriangle, Wallet,
  User, ArrowRight, ChevronRight as ChevronRightIcon, Clock, CalendarX, Repeat, Receipt,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeances, useStudentStore } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useTypesSeance, useJoursFeries } from "@/hooks/useScheduleSettingsStore";
import { useEvenements } from "@/hooks/useEvenementStore";
import { useTeachers } from "@/hooks/useTeacherStore";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { getJourFerieCouvrant } from "@/data/scheduleSettingsStore";
import { saveNotesGrid, submitNotesForValidation } from "@/data/studentStore";
import { ENSEIGNANTS, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { buildTeacherCourses } from "@/lib/teacherCourseUtils";
import { mondayOf, matchesProf, dateToJour } from "@/lib/teacherUtils";
import { addRallonge, type RallongeStatut } from "@/data/rallongeStore";
import { useRallonges } from "@/hooks/useRallongeStore";
import { useTeacherAbsences } from "@/hooks/useTeacherAbsenceStore";
import { montantTotal, contractStatut, type ContractLigne } from "@/data/teacherContractStore";
import { useTeacherContracts } from "@/hooks/useTeacherContractStore";
import { printContract } from "@/lib/contractPrint";
import { KPICard } from "@/components/admin/KPICard";
import { WeeklyScheduleGrid, type ScheduleBlock } from "@/components/shared/WeeklyScheduleGrid";
import { formatCFA, formatDate, formatShortDate, cn } from "@/lib/utils";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { PubliciteBanner } from "@/components/PubliciteBanner";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const FALLBACK_COLOR = "#4f46e5";

export function matchProf(label: string, userName?: string) {
  if (!userName) return false;
  const last = userName.split(" ").pop() ?? "";
  return label === userName || label.includes(last) || userName.includes(label.split(" ").pop() ?? "");
}

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
  const soldeDecompte = mineDecomptes.reduce((sum, d) => sum + (d.netAPayer - d.montantPaye), 0);

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
          label="Solde décompte à percevoir"
          value={formatCFA(soldeDecompte)}
          accentColor={soldeDecompte > 0 ? "#ef4444" : "#10b981"}
          onClick={() => setLocation("/teacher/decomptes")}
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
            <button onClick={() => setLocation("/teacher/decomptes")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium flex-shrink-0">
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
                  <div key={d.id} onClick={() => setLocation("/teacher/decomptes")} className="flex items-center gap-3 mx-2 my-1 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer group">
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

export function TeacherModulesPage() {
  const { currentUser } = useAuth();
  const ecs = useEcs();
  const ues = useUes();
  const mine = ecs.filter((e) => matchProf(e.responsable, currentUser?.name));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes modules</h2>
      {mine.map((e) => {
        const ue = ues.find((u) => u.id === e.ueId);
        return (
          <div key={e.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="font-bold text-sm">{e.code} â€” {e.libelle}</p>
            <p className="text-xs text-muted-foreground mt-1">
              UE : {ue?.code ?? e.ue} Â· CM {e.volCm}h / TD {e.volTd}h / TP {e.volTp}h Â· VHT {e.vht}h
            </p>
          </div>
        );
      })}
      {mine.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun EC avec vous comme responsable. Les sÃ©ances EDT restent visibles dans Â« Mon EDT Â».
        </p>
      )}
    </div>
  );
}

export function TeacherGradesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const classes = useClasses();
  const ecs = useEcs();
  const [classeId, setClasseId] = useState("");
  const [ecId, setEcId] = useState("");
  const [cc, setCc] = useState("12");
  const [examen, setExamen] = useState("10");
  const [etudiantId, setEtudiantId] = useState("");

  const mineEcs = useMemo(() => {
    const byResp = ecs.filter((e) => matchProf(e.responsable, currentUser?.name));
    return byResp.length ? byResp : ecs;
  }, [ecs, currentUser?.name]);

  const classeStudents = students.filter((s) => s.classeId === classeId);

  function handleSave(submit: boolean) {
    const ec = ecs.find((x) => x.id === ecId);
    const s = students.find((x) => x.id === etudiantId);
    if (!ec || !s || !classeId) {
      toast.error("Classe, EC et Ã©tudiant requis");
      return;
    }
    try {
      saveNotesGrid(
        classeId,
        ec.id,
        `${ec.code} â€” ${ec.libelle}`,
        [{ etudiantId: s.id, cc: Number(cc), examen: Number(examen) }],
        false,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible");
      return;
    }
    if (submit) {
      submitNotesForValidation(classeId, ec.id);
      toast.success("Notes soumises Ã  validation admin");
    } else {
      toast.success("Brouillon enregistrÃ© (CC 30% / Examen 70%)");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Saisie des notes</h2>
        <p className="text-xs text-muted-foreground">Workflow : brouillon â†’ soumission admin â†’ validation â†’ publication</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={classeId} onChange={(e) => setClasseId(e.target.value)}>
            <option value="">Classe pÃ©dagogique</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
          <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={ecId} onChange={(e) => setEcId(e.target.value)}>
            <option value="">Ã‰lÃ©ment constitutif</option>
            {mineEcs.map((e) => (
              <option key={e.id} value={e.id}>{e.code} â€” {e.libelle}</option>
            ))}
          </select>
          <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={etudiantId} onChange={(e) => setEtudiantId(e.target.value)}>
            <option value="">Ã‰tudiant</option>
            {classeStudents.map((s) => (
              <option key={s.id} value={s.id}>{s.matricule} â€” {s.prenom} {s.nom}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={0} max={20} step={0.25} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="CC" title="CC (30%)" />
            <input type="number" min={0} max={20} step={0.25} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={examen} onChange={(e) => setExamen(e.target.value)} placeholder="Examen" title="Examen (70%)" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => handleSave(false)} className="px-4 py-2 rounded-xl border border-border text-sm">Brouillon</button>
          <button type="button" onClick={() => handleSave(true)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">Soumettre Ã  l&apos;admin</button>
        </div>
      </div>
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

export function TeacherRallongePage() {
  const { currentUser } = useAuth();
  const seances = useSeances();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const rallonges = useRallonges();

  const myTeacher = useMemo(
    () => ENSEIGNANTS.find((t) => t.id === currentUser?.linkedId) ?? null,
    [currentUser?.linkedId],
  );
  const annee = ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEES_ACADEMIQUES[0]?.libelle ?? "";

  const courses = useMemo(
    () => (myTeacher ? buildTeacherCourses(myTeacher, seances, ecs, ues, classes, annee) : []),
    [myTeacher, seances, ecs, ues, classes, annee],
  );

  const [courseId, setCourseId] = useState("");
  const [heures, setHeures] = useState("2");
  const [motif, setMotif] = useState("");

  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;

  const mine = useMemo(
    () =>
      rallonges
        .filter((r) => r.teacherId === myTeacher?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [rallonges, myTeacher?.id],
  );

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
    if (!motif.trim()) {
      toast.error("Indiquez un motif");
      return;
    }
    addRallonge({
      teacherId: myTeacher.id,
      ecId: selectedCourse.ecId,
      classeId: selectedCourse.classeId,
      annee,
      vhActuel: selectedCourse.volumeHoraire,
      vhSupplementaire: heuresNum,
      motif: motif.trim(),
      origine: "prof",
    });
    toast.success("Demande de rallonge envoyée à l'administration");
    setCourseId("");
    setHeures("2");
    setMotif("");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>
          Demande de rallonge de volume horaire
        </h2>
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
              >
                <option value="">Sélectionner un cours</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.coursLabel} — {c.detailsLabel}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0.5}
                step={0.5}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={heures}
                onChange={(e) => setHeures(e.target.value)}
                placeholder="Heures supplémentaires demandées"
              />
              {selectedCourse && (
                <p className="text-xs text-muted-foreground self-center">
                  Volume horaire prévu actuellement : <span className="font-semibold text-foreground">{selectedCourse.volumeHoraire} h</span>
                </p>
              )}
            </div>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Motif de la demande…"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
              >
                Envoyer la demande
              </button>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-bold text-sm">Mes demandes</h3>
        </div>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucune demande de rallonge envoyée.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Cours</th>
                <th className="px-4 py-3">Rallonge</th>
                <th className="px-4 py-3">Motif</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((r) => {
                const ec = ecs.find((e) => e.id === r.ecId);
                const classe = classes.find((c) => c.id === r.classeId);
                return (
                  <tr key={r.id} className="border-t border-border align-top">
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
        )}
      </div>
    </div>
  );
}

const CONTRACT_MODE_LABEL: Record<ContractLigne["modePaiement"], string> = {
  taux_horaire: "Volume horaire",
  forfait: "Forfait",
};

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

export function TeacherContractPage() {
  const { currentUser } = useAuth();
  const contracts = useTeacherContracts();
  const ecs = useEcs();
  const classes = useClasses();

  const myTeacher = ENSEIGNANTS.find((t) => t.id === currentUser?.linkedId) ?? null;
  const mine = contracts
    .filter((c) => c.teacherId === currentUser?.linkedId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>
          Mon contrat
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Historique de vos contrats d&apos;enseignement</p>
      </div>

      {mine.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Aucun contrat n&apos;a encore été enregistré pour vous.
        </div>
      ) : (
        mine.map((c) => {
          const statut = contractStatut(c);
          const rows = c.lignes.map((l) => {
            const ec = ecs.find((e) => e.id === l.ecId);
            const classe = classes.find((cl) => cl.id === l.classeId);
            return {
              coursLabel: ec ? `${ec.code} — ${ec.libelle}` : l.ecId,
              classeLabel: classe?.nom ?? l.classeId,
              modeLabel: CONTRACT_MODE_LABEL[l.modePaiement],
              montant: l.montant,
            };
          });
          return (
            <div key={c.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="p-5 flex flex-wrap items-center justify-between gap-3 border-b border-border">
                <div>
                  <p className="font-bold text-sm">{c.id}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.annee} · {c.dateDebut} → {c.dateFin}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", CONTRACT_STATUT_CLS[statut])}>
                    {CONTRACT_STATUT_LABEL[statut]}
                  </span>
                  <button
                    type="button"
                    onClick={() => printContract(c, myTeacher ?? undefined, rows, statut)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted"
                  >
                    <Printer size={12} /> Imprimer / PDF
                  </button>
                </div>
              </div>
              <div className="p-5">
                {c.lignes.map((l, i) => {
                  const ec = ecs.find((e) => e.id === l.ecId);
                  const classe = classes.find((cl) => cl.id === l.classeId);
                  return (
                    <div key={i} className="flex justify-between items-center text-sm border-b border-border py-2 last:border-0">
                      <span>
                        {ec ? `${ec.code} — ${ec.libelle}` : l.ecId}
                        <span className="text-xs text-muted-foreground"> · {classe?.nom ?? l.classeId}</span>
                      </span>
                      <span className="font-medium">{l.montant.toLocaleString("fr-FR")} F CFA</span>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center text-sm pt-3 font-semibold">
                  <span>Montant total</span>
                  <span>{montantTotal(c).toLocaleString("fr-FR")} F CFA</span>
                </div>
                {c.avenants.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">{c.avenants.length} avenant{c.avenants.length > 1 ? "s" : ""}</p>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export { TeacherCahierPage } from "./TeacherCahierPage";


