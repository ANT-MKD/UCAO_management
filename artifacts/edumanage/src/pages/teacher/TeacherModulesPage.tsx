import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, Layers, Clock, GraduationCap, Search, LayoutGrid, List, ArrowRight, MapPin, Lightbulb } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeances, useCahiers } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useTeachers } from "@/hooks/useTeacherStore";
import { usePointages } from "@/hooks/usePointageStore";
import { ANNEES_ACADEMIQUES } from "@/data/mockData";
import { buildTeacherCourses } from "@/lib/teacherCourseUtils";
import { matchesProf } from "@/lib/teacherUtils";
import { KPICard } from "@/components/admin/KPICard";
import { cn, formatShortDate } from "@/lib/utils";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const BADGE_COLORS: Record<string, string> = {
  Obligatoire: "bg-indigo-50 text-indigo-700",
  Fondamentale: "bg-indigo-50 text-indigo-700",
  Spécialité: "bg-purple-50 text-purple-700",
  Transversale: "bg-blue-50 text-blue-700",
  Optionnelle: "bg-amber-50 text-amber-700",
  Libre: "bg-emerald-50 text-emerald-700",
};

function seanceDateIso(semaineDu: string, jour: number): string {
  const d = new Date(`${semaineDu}T12:00:00`);
  d.setDate(d.getDate() + (jour - 1));
  return d.toISOString().slice(0, 10);
}

export default function TeacherModulesPage() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const seances = useSeances();
  const cahiers = useCahiers();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const teachers = useTeachers();
  const pointages = usePointages();

  const [search, setSearch] = useState("");
  const [filiereFilter, setFiliereFilter] = useState("");
  const [niveauFilter, setNiveauFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grille" | "liste">("grille");

  const myTeacher = useMemo(() => teachers.find((t) => t.id === currentUser?.linkedId) ?? null, [teachers, currentUser?.linkedId]);
  const annee = ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEES_ACADEMIQUES[0]?.libelle ?? "";
  const todayIso = new Date().toISOString().slice(0, 10);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const baseCourses = useMemo(() => (myTeacher ? buildTeacherCourses(myTeacher, seances, ecs, ues, classes, annee) : []), [myTeacher, seances, ecs, ues, classes, annee]);

  const courses = useMemo(() => baseCourses.map((course) => {
    const ec = ecs.find((e) => e.id === course.ecId);
    const ue = ues.find((u) => u.id === ec?.ueId);
    const classe = classes.find((c) => c.id === course.classeId);

    const mesSeances = seances.filter((s) => s.ecId === course.ecId && s.classeId === course.classeId && s.annee === annee && myTeacher && matchesProf(myTeacher, s.prof));
    const mesCahiers = cahiers.filter((c) => c.ecId === course.ecId && c.classeId === course.classeId && c.annee === annee && myTeacher && matchesProf(myTeacher, c.prof) && c.etatSeance !== "annulee");
    const vhRealise = myTeacher
      ? pointages.filter((p) => p.teacherId === myTeacher.id && p.ecId === course.ecId && p.classeId === course.classeId && p.annee === annee && p.statut === "valide").reduce((s, p) => s + p.volumePointe, 0)
      : 0;

    const upcoming = mesSeances
      .map((s) => ({ s, dateIso: seanceDateIso(s.semaineDu, s.jour) }))
      .filter(({ dateIso, s }) => dateIso > todayIso || (dateIso === todayIso && (Number(s.heureDebut.slice(0, 2)) * 60 + Number(s.heureDebut.slice(3, 5))) >= nowMinutes))
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso) || a.s.heureDebut.localeCompare(b.s.heureDebut))[0];

    const dernierePassee = [...mesSeances].sort((a, b) => seanceDateIso(b.semaineDu, b.jour).localeCompare(seanceDateIso(a.semaineDu, a.jour)))[0];

    return {
      ...course,
      code: ec?.code ?? "",
      libelle: ec?.libelle ?? "",
      ueType: ue?.type ?? "",
      classeNom: classe?.nom ?? "",
      niveau: classe?.niveau ?? "",
      effectif: classe?.inscrits ?? 0,
      vhRealise,
      totalSeances: mesSeances.length,
      seancesRealisees: mesCahiers.length,
      prochaine: upcoming ? { dateIso: upcoming.dateIso, heureDebut: upcoming.s.heureDebut, salle: upcoming.s.salle } : undefined,
      salle: upcoming?.s.salle ?? dernierePassee?.salle,
    };
  }), [baseCourses, ecs, ues, classes, seances, cahiers, pointages, myTeacher, annee, todayIso, nowMinutes]);

  const filieresDisponibles = useMemo(() => Array.from(new Set(courses.map((c) => c.filiereLabel))).sort(), [courses]);
  const niveauxDisponibles = useMemo(() => Array.from(new Set(courses.map((c) => c.niveau))).sort(), [courses]);

  const filtered = courses.filter((c) => {
    if (filiereFilter && c.filiereLabel !== filiereFilter) return false;
    if (niveauFilter && c.niveau !== niveauFilter) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (!`${c.code} ${c.libelle} ${c.classeNom}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const classesConcernees = new Set(courses.map((c) => c.classeId));
  const etudiantsConcernes = Array.from(classesConcernees).reduce((sum, classeId) => sum + (classes.find((c) => c.id === classeId)?.inscrits ?? 0), 0);
  const heuresEnseignees = courses.reduce((sum, c) => sum + c.vhRealise, 0);

  const repartition = { termine: 0, enCours: 0, aVenir: 0 };
  for (const c of courses) {
    if (c.totalSeances > 0 && c.seancesRealisees >= c.totalSeances) repartition.termine++;
    else if (c.seancesRealisees > 0) repartition.enCours++;
    else repartition.aVenir++;
  }
  const donutTotal = courses.length || 1;
  const donutSegments = [
    { label: "Terminés", value: repartition.termine, color: "#10b981" },
    { label: "En cours", value: repartition.enCours, color: "#2563eb" },
    { label: "À venir", value: repartition.aVenir, color: "#f59e0b" },
  ];
  let cumule = 0;
  const donutStops = donutSegments.map((seg) => {
    const start = (cumule / donutTotal) * 360;
    cumule += seg.value;
    const end = (cumule / donutTotal) * 360;
    return { ...seg, start, end };
  });

  const prochainCoursGlobal = courses
    .filter((c) => c.prochaine)
    .sort((a, b) => a.prochaine!.dateIso.localeCompare(b.prochaine!.dateIso) || a.prochaine!.heureDebut.localeCompare(b.prochaine!.heureDebut))[0];

  const parFiliere = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of courses) map.set(c.filiereLabel, (map.get(c.filiereLabel) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [courses]);

  const goToNotes = (classeId: string, ecId: string) => setLocation(`/teacher/grades?classeId=${classeId}&ecId=${ecId}`);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Mes cours</h2>
        <p className="text-sm text-muted-foreground mt-1">Consultez la liste de vos cours et modules, gérez vos enseignements et accédez aux informations associées.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-5 min-w-0">
          <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <KPICard icon={BookOpen} label="Total de mes cours" value={courses.length} subtitle="ce semestre" accentColor="#2563eb" />
            <KPICard icon={Layers} label="Classes concernées" value={classesConcernees.size} subtitle="au total" accentColor="#10b981" />
            <KPICard icon={Clock} label="Heures enseignées" value={`${heuresEnseignees} h`} subtitle="cette année" accentColor="#f59e0b" />
            <KPICard icon={GraduationCap} label="Étudiants concernés" value={etudiantsConcernes} subtitle="au total" accentColor="#8b5cf6" />
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un cours, un module…"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select value={filiereFilter} onChange={(e) => setFiliereFilter(e.target.value)} className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Toutes les filières</option>
              {filieresDisponibles.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={niveauFilter} onChange={(e) => setNiveauFilter(e.target.value)} className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Tous les niveaux</option>
              {niveauxDisponibles.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <div className="flex border border-border rounded-xl overflow-hidden">
              <button type="button" onClick={() => setViewMode("grille")} className={cn("p-2.5", viewMode === "grille" ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground")}><LayoutGrid size={15} /></button>
              <button type="button" onClick={() => setViewMode("liste")} className={cn("p-2.5", viewMode === "liste" ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground")}><List size={15} /></button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground flex items-center gap-2" style={{ fontFamily: "Outfit, sans-serif" }}>
              Mes cours <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{filtered.length}</span>
            </h3>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              {myTeacher ? "Aucun cours ne correspond." : "Compte non rattaché à une fiche professeur."}
            </div>
          ) : viewMode === "grille" ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((c) => {
                const pct = c.totalSeances > 0 ? Math.round((c.seancesRealisees / c.totalSeances) * 100) : 0;
                return (
                  <div key={c.id} className="rounded-2xl border border-border bg-card p-4 flex flex-col" style={{ boxShadow: "var(--shadow-sm)" }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={18} className="text-indigo-600" />
                      </div>
                      {c.ueType && <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", BADGE_COLORS[c.ueType] ?? "bg-muted text-muted-foreground")}>{c.ueType}</span>}
                    </div>
                    <p className="font-bold text-sm text-foreground truncate">{c.libelle}</p>
                    <p className="text-xs text-muted-foreground">{c.code}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.niveau} {c.filiereLabel}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1"><GraduationCap size={12} /> {c.effectif} étudiants</span>
                      {c.salle && <span className="flex items-center gap-1"><MapPin size={12} /> Salle {c.salle}</span>}
                    </div>
                    {c.prochaine ? (
                      <p className="text-xs text-muted-foreground mt-2">
                        Prochaine séance<br />
                        <span className="text-foreground font-medium">{c.prochaine.dateIso === todayIso ? "Aujourd'hui" : formatShortDate(c.prochaine.dateIso)} · {c.prochaine.heureDebut}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">Aucune séance à venir</p>
                    )}
                    <div className="mt-3">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{c.seancesRealisees} / {c.totalSeances} séances · {pct}%</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToNotes(c.classeId, c.ecId)}
                      className="mt-3 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Voir le cours <ArrowRight size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3">Cours</th>
                    <th className="px-4 py-3">Classe</th>
                    <th className="px-4 py-3">Étudiants</th>
                    <th className="px-4 py-3">Progression</th>
                    <th className="px-4 py-3">Prochaine séance</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const pct = c.totalSeances > 0 ? Math.round((c.seancesRealisees / c.totalSeances) * 100) : 0;
                    return (
                      <tr key={c.id} className="border-t border-border">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{c.code} — {c.libelle}</p>
                          <p className="text-xs text-muted-foreground">{c.niveau} {c.filiereLabel}</p>
                        </td>
                        <td className="px-4 py-3">{c.classeNom}</td>
                        <td className="px-4 py-3">{c.effectif}</td>
                        <td className="px-4 py-3">
                          <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{c.seancesRealisees}/{c.totalSeances}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{c.prochaine ? `${c.prochaine.dateIso === todayIso ? "Aujourd'hui" : formatShortDate(c.prochaine.dateIso)} · ${c.prochaine.heureDebut}` : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => goToNotes(c.classeId, c.ecId)} className="text-xs text-primary hover:underline font-medium">Voir le cours →</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-bold text-foreground text-sm mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Vue d&apos;ensemble</h3>
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 36 36" className="w-24 h-24 flex-shrink-0 -rotate-90">
                {donutStops.map((seg) => (
                  <circle
                    key={seg.label}
                    cx="18" cy="18" r="15.5" fill="none" stroke={seg.color} strokeWidth="4"
                    strokeDasharray={`${((seg.end - seg.start) / 360) * 97.4} 97.4`}
                    strokeDashoffset={`${-(seg.start / 360) * 97.4}`}
                  />
                ))}
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-foreground">{courses.length}</p>
                <p className="text-xs text-muted-foreground mb-2">cours</p>
                {donutSegments.map((seg) => (
                  <div key={seg.label} className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><span className="w-2 h-2 rounded-full" style={{ background: seg.color }} />{seg.label}</span>
                    <span className="font-semibold text-foreground">{seg.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2" style={{ fontFamily: "Outfit, sans-serif" }}>Prochain cours</h3>
            {prochainCoursGlobal ? (
              <div>
                <p className="font-semibold text-sm text-foreground">{prochainCoursGlobal.libelle}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{prochainCoursGlobal.classeNom} · Salle {prochainCoursGlobal.salle ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                  <Clock size={12} /> {prochainCoursGlobal.prochaine!.heureDebut} · {prochainCoursGlobal.prochaine!.dateIso === todayIso ? "Aujourd'hui" : formatShortDate(prochainCoursGlobal.prochaine!.dateIso)}
                </p>
                <button
                  type="button"
                  onClick={() => setLocation("/teacher/schedule")}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  Voir les détails <ArrowRight size={11} />
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune séance à venir.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-bold text-foreground text-sm mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Mes cours par filière</h3>
            {parFiliere.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="space-y-1">
                {parFiliere.map(([filiere, count]) => (
                  <div key={filiere} className="flex items-center justify-between text-sm py-1.5">
                    <span className="text-foreground">{filiere}</span>
                    <span className="text-xs text-muted-foreground">{count} cours</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-2">
            <Lightbulb size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Cliquez sur « Voir le cours » pour accéder directement à la saisie des notes de ce cours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
