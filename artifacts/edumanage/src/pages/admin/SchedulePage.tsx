import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight, GripVertical, AlertTriangle, Users, MapPin, GraduationCap } from "lucide-react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/admin/PageHeader";
import { updateSeancePosition } from "@/data/studentStore";
import { useSeances } from "@/hooks/useStudentStore";
import { useClasses, useSalles } from "@/hooks/useStructureStore";
import { useTypesSeance } from "@/hooks/useScheduleSettingsStore";
import { cn } from "@/lib/utils";

type ViewMode = "classe" | "salle" | "prof";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
const PX_PER_H = 80;

const FALLBACK_COLOR = "#4f46e5";

/** Fond/texte dérivés de la couleur du type (édition modifiable dans Paramétrage emploi du
 * temps > Type emploi du temps) — jamais une palette codée en dur ici. */
function shadeFromColor(hex: string): { bg: string; border: string; text: string } {
  return { bg: `${hex}18`, border: hex, text: hex };
}

const MODE_CONFIG: { key: ViewMode; label: string; icon: typeof Users }[] = [
  { key: "classe", label: "Par classe", icon: GraduationCap },
  { key: "salle", label: "Par salle", icon: MapPin },
  { key: "prof", label: "Par professeur", icon: Users },
];

function timeToPixels(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - 8) * PX_PER_H + m * (PX_PER_H / 60);
}

function pixelsToTime(px: number): string {
  const totalMinutes = Math.round((px / PX_PER_H) * 60 / 30) * 30;
  const h = Math.floor(totalMinutes / 60) + 8;
  const m = totalMinutes % 60;
  return `${String(Math.min(h, 19)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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

export default function SchedulePage() {
  const [, setLocation] = useLocation();
  const seances = useSeances();
  const CLASSES = useClasses();
  const SALLES = useSalles();
  const TYPES_SEANCE = useTypesSeance();
  const [viewMode, setViewMode] = useState<ViewMode>("classe");
  const [viewTarget, setViewTarget] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [conflictMsg, setConflictMsg] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  const profs = useMemo(() => [...new Set(seances.map((s) => s.prof))].sort(), [seances]);

  const filteredSeances = useMemo(() => {
    if (!viewTarget) return [];
    return seances.filter((s) => {
      if (viewMode === "classe") return s.classeId === viewTarget;
      if (viewMode === "salle") return s.salleId === viewTarget;
      return s.prof === viewTarget;
    });
  }, [seances, viewMode, viewTarget]);

  const targetOptions = useMemo(() => {
    if (viewMode === "classe") return CLASSES.map((c) => ({ id: c.id, label: c.nom }));
    if (viewMode === "salle") return SALLES.map((s) => ({ id: s.id, label: s.nom }));
    return profs.map((p) => ({ id: p, label: p }));
  }, [viewMode, profs, CLASSES, SALLES]);

  useEffect(() => {
    if (!viewTarget && targetOptions[0]) setViewTarget(targetOptions[0].id);
  }, [viewTarget, targetOptions]);

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setConflictMsg("");
    if (mode === "classe") setViewTarget(CLASSES[0]?.id ?? "");
    else if (mode === "salle") setViewTarget(SALLES[0]?.id ?? "");
    else setViewTarget(profs[0] ?? "");
  };

  const now = new Date();
  const todayDow = now.getDay() === 0 ? 7 : now.getDay();
  const currentTimeY = (now.getHours() - 8) * PX_PER_H + now.getMinutes() * (PX_PER_H / 60);
  const showTimeLine = now.getHours() >= 8 && now.getHours() < 20;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
  const weekEnd = new Date(weekStart.getTime() + 5 * 86400000);
  const weekLabel = `${weekStart.getDate()} – ${weekEnd.getDate()} ${weekStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;

  const handleDrop = useCallback((dayNum: number, offsetY: number, seanceId: string) => {
    const seance = seances.find((s) => s.id === seanceId);
    if (!seance) return;
    const newStart = pixelsToTime(Math.max(0, offsetY));
    const duration = getDuration(seance.heureDebut, seance.heureFin);
    const durationMins = Math.round((duration / PX_PER_H) * 60);
    const newEnd = addMinutes(newStart, durationMins);
    const result = updateSeancePosition(seanceId, dayNum, newStart, newEnd);
    if (!result.ok) {
      setConflictMsg(result.conflicts.map((c) => c.label).join(" · "));
      setTimeout(() => setConflictMsg(""), 5000);
    } else {
      setConflictMsg("");
    }
    setDraggingId(null);
  }, [seances]);

  const inputClass = "px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Emploi du Temps" }]}
        title="Emploi du Temps"
        subtitle="Vue obligatoire par classe, salle ou professeur — conflits détectés au déplacement"
        actions={
          <button onClick={() => setLocation("/admin/schedule/new")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Ajouter une séance
          </button>
        }
      />

      {conflictMsg && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={16} /> Conflit détecté : {conflictMsg}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 mb-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex flex-wrap gap-2">
          {MODE_CONFIG.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleModeChange(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all",
                viewMode === key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select value={viewTarget} onChange={(e) => setViewTarget(e.target.value)} className={inputClass + " min-w-[220px]"}>
            {targetOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"><ChevronLeft size={16} /></button>
            <span className="text-sm font-medium text-foreground px-2">Sem. du {weekLabel}</span>
            <button onClick={() => setWeekOffset((w) => w + 1)} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"><ChevronRight size={16} /></button>
            <button onClick={() => setWeekOffset(0)} className="px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">Aujourd'hui</button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {filteredSeances.length} séance(s) affichée(s) — mode <strong>{viewMode}</strong>
        </p>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        {TYPES_SEANCE.map((t) => {
          const c = shadeFromColor(t.couleur);
          return (
            <div key={t.id} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: c.text }}>
              <span className="w-3 h-3 rounded-sm" style={{ background: c.bg, border: `2px solid ${c.border}` }} />{t.code}
            </div>
          );
        })}
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1"><GripVertical size={12} /> Glisser-déposer (avec validation anti-conflit)</span>
      </div>

      {!viewTarget ? (
        <div className="text-center py-16 text-muted-foreground">Sélectionnez une cible pour afficher l'emploi du temps</div>
      ) : (
        <div ref={gridRef} className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="grid" style={{ gridTemplateColumns: "64px repeat(6, 1fr)" }}>
            <div className="border-b border-r border-border" />
            {JOURS.map((j, i) => (
              <div key={j} className={cn("px-3 py-3 text-center text-xs font-semibold border-b border-r border-border last:border-r-0", i + 1 === todayDow && weekOffset === 0 && "bg-primary/5 text-primary")}>
                {j}
              </div>
            ))}
          </div>

          <div className="grid relative" style={{ gridTemplateColumns: "64px repeat(6, 1fr)" }}>
            <div className="border-r border-border">
              {HOURS.map((h) => (
                <div key={h} className="border-b border-border last:border-0 flex items-start justify-end pr-2 pt-1" style={{ height: PX_PER_H }}>
                  <span className="text-[10px] text-muted-foreground">{h}:00</span>
                </div>
              ))}
            </div>

            {JOURS.map((_, dayIdx) => {
              const dayNum = dayIdx + 1;
              const daySeances = filteredSeances.filter((s) => s.jour === dayNum);
              return (
                <div
                  key={dayIdx}
                  className={cn("relative border-r border-border last:border-r-0", dayNum === todayDow && weekOffset === 0 && "bg-primary/[0.02]")}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("seanceId");
                    const rect = e.currentTarget.getBoundingClientRect();
                    const offsetY = e.clientY - rect.top;
                    if (id) handleDrop(dayNum, offsetY, id);
                  }}
                >
                  {HOURS.map((h) => (
                    <div key={h} className="border-b border-border/50 last:border-0" style={{ height: PX_PER_H }} />
                  ))}

                  {daySeances.map((s) => {
                    const typeRecord = TYPES_SEANCE.find((t) => t.code === s.type);
                    const colors = shadeFromColor(typeRecord?.couleur ?? FALLBACK_COLOR);
                    const top = timeToPixels(s.heureDebut);
                    const height = getDuration(s.heureDebut, s.heureFin);
                    const isDragging = draggingId === s.id;
                    return (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("seanceId", s.id); setDraggingId(s.id); }}
                        onDragEnd={() => setDraggingId(null)}
                        className={cn("absolute left-1 right-1 rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing transition-all overflow-hidden group", isDragging && "opacity-50 scale-95")}
                        style={{
                          top: `${top}px`, height: `${Math.max(height, 40)}px`,
                          background: colors.bg, borderLeft: `3px solid ${colors.border}`,
                          zIndex: isDragging ? 20 : 5,
                          boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.2)" : "var(--shadow-sm)",
                        }}
                      >
                        <div className="flex items-start gap-1">
                          <GripVertical size={10} className="text-muted-foreground/50 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold truncate" style={{ color: colors.text }}>{s.ec}</div>
                            <div className="text-[9px] text-muted-foreground">{s.heureDebut}–{s.heureFin}</div>
                            {height > 50 && (
                              <>
                                <div className="text-[9px] text-muted-foreground truncate">{s.salle} · {s.classe}</div>
                                <div className="text-[9px] text-muted-foreground truncate">{s.prof}</div>
                              </>
                            )}
                          </div>
                        </div>
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
      )}
    </div>
  );
}
