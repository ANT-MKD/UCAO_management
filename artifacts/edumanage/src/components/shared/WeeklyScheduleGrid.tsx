import { cn } from "@/lib/utils";

export const SCHEDULE_HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
const PX_PER_H = 80;
const FALLBACK_COLOR = "#4f46e5";
const JOURS_GRID = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export function shadeFromColor(hex: string): { bg: string; border: string; text: string } {
  return { bg: `${hex}18`, border: hex, text: hex };
}

function timeToPixels(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - SCHEDULE_HOURS[0]) * PX_PER_H + m * (PX_PER_H / 60);
}

function getDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) * (PX_PER_H / 60);
}

export interface ScheduleBlock {
  id: string;
  /** 1 = lundi ... 6 = samedi */
  jour: number;
  heureDebut: string;
  heureFin: string;
  colorHex: string;
  title: string;
  lines?: string[];
  dashed?: boolean;
  testId?: string;
}

export interface ScheduleLegendItem {
  code: string;
  couleur: string;
}

interface WeeklyScheduleGridProps {
  weekDays: Date[];
  displayDayIdxs: number[];
  blocks: ScheduleBlock[];
  todayDow: number;
  isCurrentWeek: boolean;
  legend?: ScheduleLegendItem[];
  ferieForDate?: (dateIso: string) => { intitule: string } | undefined;
  emptyMessage?: string;
}

/** Grille horaire hebdomadaire en lecture seule (positionnement en pixels, ligne "heure
 * actuelle", jours fériés) — extraite pour être partagée entre les portails qui n'ont pas
 * besoin du glisser-déposer de l'EDT admin (élève, professeur). */
export function WeeklyScheduleGrid({ weekDays, displayDayIdxs, blocks, todayDow, isCurrentWeek, legend, ferieForDate, emptyMessage }: WeeklyScheduleGridProps) {
  const now = new Date();
  const currentTimeY = (now.getHours() - SCHEDULE_HOURS[0]) * PX_PER_H + now.getMinutes() * (PX_PER_H / 60);
  const showTimeLine = isCurrentWeek && now.getHours() >= SCHEDULE_HOURS[0] && now.getHours() < SCHEDULE_HOURS[SCHEDULE_HOURS.length - 1] + 1;

  return (
    <div className="space-y-3">
      {legend && legend.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {legend.map((t) => {
            const c = shadeFromColor(t.couleur);
            return (
              <div key={t.code} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: c.text }}>
                <span className="w-3 h-3 rounded-sm" style={{ background: c.bg, border: `2px solid ${c.border}` }} />
                {t.code}
              </div>
            );
          })}
        </div>
      )}

      {blocks.length === 0 && emptyMessage && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">{emptyMessage}</div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="overflow-x-auto">
          <div style={{ minWidth: displayDayIdxs.length > 1 ? 720 : 320 }}>
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${displayDayIdxs.length}, 1fr)` }}>
              <div className="border-b border-r border-border" />
              {displayDayIdxs.map((dayIdx) => {
                const dayNum = dayIdx + 1;
                const dateIso = weekDays[dayIdx].toISOString().slice(0, 10);
                const ferie = ferieForDate?.(dateIso);
                return (
                  <div
                    key={dayIdx}
                    title={ferie ? `Jour férié — ${ferie.intitule}` : undefined}
                    className={cn(
                      "px-2 py-3 text-center text-xs font-semibold border-b border-r border-border last:border-r-0",
                      dayNum === todayDow && isCurrentWeek && "bg-primary/5 text-primary",
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
                {SCHEDULE_HOURS.map((h) => (
                  <div key={h} className="border-b border-border last:border-0 flex items-start justify-end pr-2 pt-1" style={{ height: PX_PER_H }}>
                    <span className="text-[10px] text-muted-foreground">{h}:00</span>
                  </div>
                ))}
              </div>

              {displayDayIdxs.map((dayIdx) => {
                const dayNum = dayIdx + 1;
                const dayBlocks = blocks.filter((b) => b.jour === dayNum);
                return (
                  <div key={dayIdx} className={cn("relative border-r border-border last:border-r-0", dayNum === todayDow && isCurrentWeek && "bg-primary/[0.02]")}>
                    {SCHEDULE_HOURS.map((h) => (
                      <div key={h} className="border-b border-border/50 last:border-0" style={{ height: PX_PER_H }} />
                    ))}

                    {dayBlocks.map((b) => {
                      const colors = shadeFromColor(b.colorHex || FALLBACK_COLOR);
                      const top = timeToPixels(b.heureDebut);
                      const height = getDuration(b.heureDebut, b.heureFin);
                      return (
                        <div
                          key={b.id}
                          data-testid={b.testId}
                          className="absolute left-1 right-1 rounded-lg px-2 py-1.5 overflow-hidden"
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 40)}px`,
                            background: colors.bg,
                            border: b.dashed ? `2px dashed ${colors.border}` : undefined,
                            borderLeft: b.dashed ? undefined : `3px solid ${colors.border}`,
                            zIndex: b.dashed ? 4 : 5,
                            boxShadow: "var(--shadow-sm)",
                          }}
                        >
                          <div className="text-[10px] font-bold truncate" style={{ color: colors.text }}>{b.title}</div>
                          <div className="text-[9px] text-muted-foreground">{b.heureDebut}–{b.heureFin}</div>
                          {height > 50 && b.lines?.map((line, i) => (
                            <div key={i} className="text-[9px] text-muted-foreground truncate">{line}</div>
                          ))}
                        </div>
                      );
                    })}

                    {dayNum === todayDow && isCurrentWeek && showTimeLine && (
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
