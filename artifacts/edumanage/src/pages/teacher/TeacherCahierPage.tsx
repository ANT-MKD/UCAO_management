import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CalendarCheck, ClipboardCheck, UserCheck2, XCircle, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeances, useCahiers } from "@/hooks/useStudentStore";
import { useTeachers } from "@/hooks/useTeacherStore";
import { mondayOf, matchesProf } from "@/lib/teacherUtils";
import { KPICard } from "@/components/admin/KPICard";
import { cn } from "@/lib/utils";
import { getCahierPourSeanceEtDate, type CahierSeanceRecord, type SeanceRecord } from "@/data/studentStore";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const STATUT_CLS: Record<string, string> = {
  soumis: "bg-amber-50 text-amber-700",
  valide: "bg-emerald-50 text-emerald-700",
  rejete: "bg-red-50 text-red-700",
  brouillon: "bg-slate-100 text-slate-600",
};

const STATUT_DOT: Record<string, string> = {
  soumis: "bg-amber-500",
  valide: "bg-emerald-500",
  rejete: "bg-red-500",
  brouillon: "bg-slate-400",
};

/** Jour de semaine (1=Lundi…6=Samedi) d'une date ISO — même convention que SeanceRecord.jour,
 * qui coïncide avec Date.getDay() (0=Dimanche…6=Samedi) sauf pour le dimanche (hors cours). */
function jourDeLaSemaine(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00`).getDay();
}

/** Page d'accueil du Cahier de texte : KPI, séances du jour restant à saisir, et la liste des
 * cahiers déjà soumis. La saisie proprement dite se fait sur une page dédiée
 * (TeacherCahierFormPage, /teacher/cahier/nouveau ou /teacher/cahier/:id/edit) — accessible via
 * le bouton "Nouveau cahier" ou en cliquant sur une séance/un cahier ci-dessous. */
export function TeacherCahierPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const seances = useSeances();
  const cahiers = useCahiers();
  const teachers = useTeachers();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const myTeacher = useMemo(() => teachers.find((t) => t.id === currentUser?.linkedId) ?? null, [teachers, currentUser?.linkedId]);

  const mineCahiers = useMemo(
    () => cahiers.filter((c) => myTeacher && matchesProf(myTeacher, c.prof)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [cahiers, myTeacher],
  );
  const moisCourant = new Date().toISOString().slice(0, 7);
  const cahiersCeMois = mineCahiers.filter((c) => c.date.startsWith(moisCourant) && c.statut !== "brouillon");
  const cahiersSoumis = mineCahiers.filter((c) => c.statut !== "brouillon");
  const cahiersRejetes = mineCahiers.filter((c) => c.statut === "rejete");
  const tauxPresenceMoyenGlobal = cahiersSoumis.length
    ? Math.round((cahiersSoumis.reduce((s, c) => s + (c.tauxPresence || 0), 0) / cahiersSoumis.length) * 10) / 10
    : 0;

  const mine = seances.filter((s) => myTeacher && matchesProf(myTeacher, s.prof) && s.semaineDu === mondayOf(date));
  const jourChoisi = date ? jourDeLaSemaine(date) : -1;
  const seancesDuJour = mine.filter((s) => s.jour === jourChoisi);
  const seancesAvecStatut = seancesDuJour.map((s) => ({
    seance: s,
    cahier: getCahierPourSeanceEtDate(s.id, date),
  }));
  const nbFaites = seancesAvecStatut.filter((x) => x.cahier).length;

  function goToChip(s: SeanceRecord, cahier: CahierSeanceRecord | undefined) {
    if (cahier) {
      if (cahier.statut !== "valide") setLocation(`/teacher/cahier/${cahier.id}/edit`);
    } else {
      setLocation(`/teacher/cahier/nouveau?seanceId=${s.id}&date=${date}`);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Cahier de texte électronique</h2>
          <p className="text-sm text-muted-foreground mt-1">Corrélé à l&apos;EDT, la maquette UE/EC et la classe pédagogique</p>
        </div>
        <button
          type="button"
          onClick={() => setLocation("/teacher/cahier/nouveau")}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shrink-0"
        >
          <Plus size={16} /> Nouveau cahier
        </button>
      </div>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KPICard icon={CalendarCheck} label="Cahiers ce mois" value={cahiersCeMois.length} accentColor="#2563eb" />
        <KPICard icon={ClipboardCheck} label="Cahiers soumis" value={cahiersSoumis.length} accentColor="#8b5cf6" />
        <KPICard icon={UserCheck2} label="Présence moyenne" value={`${tauxPresenceMoyenGlobal}%`} accentColor={tauxPresenceMoyenGlobal >= 80 ? "#10b981" : "#f59e0b"} />
        <KPICard icon={XCircle} label="Cahiers rejetés" value={cahiersRejetes.length} accentColor={cahiersRejetes.length > 0 ? "#ef4444" : "#10b981"} />
      </section>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-sm">Reste à faire</h3>
          <input
            type="date"
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Le {date} ({JOURS[jourChoisi] || "—"}) : {nbFaites}/{seancesAvecStatut.length} cahier(s) traité(s)
        </p>
        {seancesAvecStatut.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune séance programmée ce jour-là.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {seancesAvecStatut.map(({ seance: s, cahier }) => (
              <button
                type="button"
                key={s.id}
                onClick={() => goToChip(s, cahier)}
                className={`text-[11px] px-2 py-1 rounded-lg border ${
                  cahier
                    ? cahier.statut === "rejete"
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-amber-50 border-amber-200 text-amber-700"
                }`}
                title={
                  cahier
                    ? cahier.statut === "valide"
                      ? "Cahier validé — non modifiable"
                      : "Cliquer pour revoir/corriger ce cahier"
                    : "Cliquer pour saisir ce cahier"
                }
              >
                {cahier ? (cahier.statut === "rejete" ? "✗ Rejeté" : "✓ Fait") : "○ À faire"} — {s.heureDebut} {s.ec} ({s.classe})
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-bold text-sm mb-3">Mes cahiers de texte</h3>
        <p className="text-xs text-muted-foreground -mt-2 mb-4">Cliquez sur un cahier non validé pour le rouvrir et le corriger.</p>
        {mineCahiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun cahier. Cliquez sur « Nouveau cahier » pour commencer.</p>
        ) : (
          <div className="relative pl-6 border-l-2 border-indigo-200 space-y-4">
            {mineCahiers.map((c) => {
              const modifiable = c.statut !== "valide";
              return (
                <div key={c.id} className="relative">
                  <div className={cn("absolute -left-[29px] top-4 w-3 h-3 rounded-full border-2 border-card", STATUT_DOT[c.statut] ?? "bg-slate-400")} />
                  <div
                    onClick={() => modifiable && setLocation(`/teacher/cahier/${c.id}/edit`)}
                    className={cn(
                      "ml-2 p-4 rounded-xl border border-border bg-muted/20 text-sm",
                      modifiable && "cursor-pointer hover:bg-muted/40",
                    )}
                    title={modifiable ? "Rouvrir ce cahier pour le modifier" : "Cahier validé — non modifiable"}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{c.sujet || c.ec} · {c.classe}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", STATUT_CLS[c.statut] ?? "bg-muted")}>{c.statut} · {c.etatSeance}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{c.date} · {c.typeSeance} · présence {c.tauxPresence}%</p>
                    <p className="text-xs mt-1 line-clamp-2">{c.resume || c.activite}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeacherCahierPage;
