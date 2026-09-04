import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  accentColor?: string;
  subtitle?: string;
  onClick?: () => void;
}

export function KPICard({
  icon: Icon,
  label,
  value,
  trend,
  trendDirection = "neutral",
  accentColor = "#4f46e5",
  subtitle,
  onClick,
}: KPICardProps) {
  const trendColors = {
    up: { bg: "bg-emerald-50 dark:bg-emerald-950/60", text: "text-emerald-600 dark:text-emerald-400" },
    down: { bg: "bg-red-50 dark:bg-red-950/60", text: "text-red-600 dark:text-red-400" },
    neutral: { bg: "bg-muted", text: "text-muted-foreground" },
  };
  const tc = trendColors[trendDirection];

  return (
    <div
      className={cn(
        "relative bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-xl",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
      style={{ boxShadow: "var(--shadow-sm)" }}
      data-testid="kpi-card"
    >
      {/* Colored accent bar at top */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)` }}
      />

      <div className="p-5 pt-6">
        <div className="flex items-start justify-between mb-4">
          {/* Icon container */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}10)`,
              border: `1px solid ${accentColor}25`,
            }}
          >
            <Icon size={20} style={{ color: accentColor }} />
          </div>

          {/* Trend badge */}
          {trend && (
            <div className={cn("flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full", tc.bg, tc.text)}>
              {trendDirection === "up" && <TrendingUp size={11} />}
              {trendDirection === "down" && <TrendingDown size={11} />}
              {trendDirection === "neutral" && <Minus size={11} />}
              {trend}
            </div>
          )}
        </div>

        {/* Value */}
        <div
          className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-none truncate"
          style={{ fontFamily: "Outfit, sans-serif" }}
        >
          {value}
        </div>

        {/* Label */}
        <div className="text-sm font-medium text-muted-foreground mt-1.5">{label}</div>

        {/* Optional subtitle */}
        {subtitle && (
          <div className="text-xs text-muted-foreground/70 mt-1">{subtitle}</div>
        )}
      </div>

      {/* Subtle glow at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none rounded-b-2xl"
        style={{
          background: `radial-gradient(ellipse at 50% 120%, ${accentColor}12 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}
