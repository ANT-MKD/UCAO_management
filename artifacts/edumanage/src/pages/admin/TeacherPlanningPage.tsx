import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Plus, ChevronLeft, ChevronRight, Search, GripVertical, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS } from "@/data/mockData";
import { updateSeancePosition } from "@/data/studentStore";
import { useSeances } from "@/hooks/useStudentStore";
import { useTypesSeance } from "@/hooks/useScheduleSettingsStore";
import {
  filterTeachers,
  matchesProf,
  mondayOf,
  teacherDisplayLabel,
  type EnseignantRecord,
} from "@/lib/teacherUtils";
import { cn } from "@/lib/utils";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 6);
const PX_PER_H = 56;
const FALLBACK_COLOR = "#4f46e5";

function shadeFromColor(hex: string): { bg: string; border: string; text: string } {
  return { bg: `${hex}18`, border: hex, text: hex };
}

function timeToPixels(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - 6) * PX_PER_H + m * (PX_PER_H / 60);
}

function pixelsToTime(px: number): string {
  const totalMinutes = Math.round((px / PX_PER_H) * 60 / 30) * 30;
  const h = Math.floor(totalMinutes / 60) + 6;
  const m = totalMinutes % 60;
  return `${String(Math.min(h, 20)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) * (PX_PER_H / 60);
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export default function TeacherPlanningPage() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const teacherIdParam = params.get("id") ?? "";

  const seances = useSeances();
  const typesSeance = useTypesSeance();
  const teachers = ENSEIGNANTS as EnseignantRecord[];

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(teacherIdParam);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<"semaine" | "jour">("semaine");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  const selected = teachers.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (!teacherIdParam) return;
    setSelectedId(teacherIdParam);
    const t = teachers.find((x) => x.id === teacherIdParam);
    if (t) setQuery(teacherDisplayLabel(t));
  }, [teacherIdParam, teachers]);

  const suggestions = useMemo(() => filterTeachers(teachers, query).slice(0, 8), [teachers, query]);

  const pickTeacher = (t: EnseignantRecord) => {
    setSelectedId(t.id);
    setQuery(teacherDisplayLabel(t));
    setShowSuggestions(false);
    setLocation(`/admin/teachers/planning?id=${encodeURIComponent(t.id)}`);
  };

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
  const weekMonday = weekStart.toISOString().slice(0, 10);
  const weekDays = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const weekEnd = weekDays[5];
  const weekLabel = `${weekStart.getDate()} – ${weekEnd.getDate()} ${weekStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;

  const teacherSeances = useMemo(() => {
    if (!selected) return [];
    return seances.filter((s) => matchesProf(selected, s.prof) && s.semaineDu === weekMonday);
  }, [seances, selected, weekMonday]);

  const todayJourNum = Math.min((now.getDay() + 6) % 7 + 1, 6);
  const displayDays = viewMode === "jour" ? [weekDays[todayJourNum - 1]] : weekDays;
  const displayJourNums = viewMode === "jour" ? [todayJourNum] : [1, 2, 3, 4, 5, 6];

  const openNewPlanning = (jour: number, heureDebut: string, heureFin?: string) => {
    if (!selected) return;
    const dayDate = weekDays[jour - 1];
    const dateStr = dayDate.toISOString().slice(0, 10);
    const qs = new URLSearchParams({
      teacherId: selected.id,
      jour: String(jour),
      date: dateStr,
      heureDebut,
      heureFin: heureFin ?? addMinutes(heureDebut, 60),
    });
    setLocation(`/admin/teachers/planning/new?${qs.toString()}`);
  };

  const handleDrop = useCallback(
    (dayNum: number, offsetY: number, seanceId: string) => {
      const seance = seances.find((s) => s.id === seanceId);
      if (!seance) return;
      const newStart = pixelsToTime(Math.max(0, offsetY));
      const durationMins = Math.round((getDuration(seance.heureDebut, seance.heureFin) / PX_PER_H) * 60);
      const newEnd = addMinutes(newStart, durationMins);
      const result = updateSeancePosition(seanceId, dayNum, newStart, newEnd);
      if (!result.ok) {
        setConflictMsg(result.conflicts.map((c) => c.label).join(" · "));
        setTimeout(() => setConflictMsg(""), 5000);
      } else {
        setConflictMsg("");
      }
      setDraggingId(null);
    },
    [seances],
  );

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Professeurs" }, { label: "Planning professeur" }]}
        title="Planning professeur"
        subtitle="Recherchez un professeur pour consulter et planifier son emploi du temps"
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-foreground whitespace-nowrap">
            Professeur <span className="text-red-500">*</span>
          </label>
          <div className="relative flex-1 min-w-[280px] max-w-2xl">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
                if (!e.target.value.trim()) setSelectedId("");
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Veuillez saisir le matricule, le prénom, le nom ou le numéro de téléphone du professeur…"
              className={`${inputClass} pl-10`}
              data-testid="teacher-planning-search"
            />
            {showSuggestions && suggestions.length > 0 && query.trim().length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                {suggestions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickTeacher(t)}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors",
                      t.id === selectedId && "bg-primary/5",
                    )}
                  >
                    {teacherDisplayLabel(t)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!selected ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-20 text-center text-sm text-muted-foreground">
          Sélectionnez un professeur pour afficher son planning
        </div>
      ) : (
        <>
          <div className="bg-muted/60 border border-border rounded-t-xl px-4 py-2.5 text-sm font-semibold text-foreground uppercase tracking-wide">
            Disponibilité du professeur : {selected.matricule} — {selected.prenom} {selected.nom}
          </div>

          {conflictMsg && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={16} /> Conflit détecté : {conflictMsg}
            </div>
          )}

          <div className="bg-card border border-border border-t-0 rounded-b-xl p-4 mb-4 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekOffset((w) => w - 1)}
                  className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-foreground px-2 min-w-[180px] text-center">{weekLabel}</span>
                <button
                  type="button"
                  onClick={() => setWeekOffset((w) => w + 1)}
                  className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex items-center gap-1 ml-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Aujourd&apos;hui
                </button>
                {(["semaine", "jour"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors capitalize",
                      viewMode === mode
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {mode}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => openNewPlanning(1, "08:00")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors ml-2"
                >
                  <Plus size={13} /> Ajouter planning
                </button>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              {typesSeance.map((t) => {
                const c = shadeFromColor(t.couleur);
                return (
                  <div key={t.id} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: c.text }}>
                    <span className="w-3 h-3 rounded-sm" style={{ background: c.bg, border: `2px solid ${c.border}` }} />
                    {t.code}
                  </div>
                );
              })}
              <span className="text-xs text-muted-foreground ml-auto">
                {teacherSeances.length} séance(s) — cliquez sur une case vide pour planifier
              </span>
            </div>
          </div>

          <div ref={gridRef} className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div
              className="grid"
              style={{ gridTemplateColumns: `56px repeat(${displayDays.length}, 1fr)` }}
            >
              <div className="border-b border-r border-border" />
              {displayDays.map((d, i) => (
                <div
                  key={i}
                  className="px-2 py-3 text-center text-xs font-semibold border-b border-r border-border last:border-r-0 text-muted-foreground"
                >
                  {formatDayHeader(d)}
                </div>
              ))}
            </div>

            <div
              className="grid relative"
              style={{ gridTemplateColumns: `56px repeat(${displayDays.length}, 1fr)` }}
            >
              <div className="border-r border-border">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-b border-border last:border-0 flex items-start justify-end pr-2 pt-1"
                    style={{ height: PX_PER_H }}
                  >
                    <span className="text-[10px] text-muted-foreground">{String(h).padStart(2, "0")}</span>
                  </div>
                ))}
              </div>

              {displayJourNums.map((dayNum, colIdx) => {
                const daySeances = teacherSeances.filter((s) => s.jour === dayNum);
                return (
                  <div
                    key={dayNum}
                    className="relative border-r border-border last:border-r-0"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("seanceId");
                      const rect = e.currentTarget.getBoundingClientRect();
                      if (id) handleDrop(dayNum, e.clientY - rect.top, id);
                    }}
                  >
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        className="w-full border-b border-border/50 last:border-0 hover:bg-primary/[0.04] transition-colors cursor-pointer"
                        style={{ height: PX_PER_H }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const offsetY = e.clientY - rect.top;
                          openNewPlanning(dayNum, pixelsToTime(offsetY));
                        }}
                        aria-label={`Planifier ${JOURS[dayNum - 1]} ${h}h`}
                      />
                    ))}

                    {daySeances.map((s) => {
                      const typeRecord = typesSeance.find((t) => t.code === s.type);
                      const colors = shadeFromColor(typeRecord?.couleur ?? FALLBACK_COLOR);
                      const top = timeToPixels(s.heureDebut);
                      const height = getDuration(s.heureDebut, s.heureFin);
                      const isDragging = draggingId === s.id;
                      return (
                        <div
                          key={s.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("seanceId", s.id);
                            setDraggingId(s.id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "absolute left-1 right-1 rounded-lg px-2 py-1 cursor-grab active:cursor-grabbing overflow-hidden group",
                            isDragging && "opacity-50 scale-95",
                          )}
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 36)}px`,
                            background: colors.bg,
                            borderLeft: `3px solid ${colors.border}`,
                            zIndex: isDragging ? 20 : 5,
                            boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.2)" : "var(--shadow-sm)",
                          }}
                        >
                          <div className="flex items-start gap-1">
                            <GripVertical size={10} className="text-muted-foreground/50 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-bold truncate" style={{ color: colors.text }}>
                                {s.ec}
                              </div>
                              <div className="text-[9px] text-muted-foreground">
                                {s.heureDebut}–{s.heureFin}
                              </div>
                              {height > 45 && (
                                <div className="text-[9px] text-muted-foreground truncate">
                                  {s.salle} · {s.classe}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
