import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import {
  Plus, ChevronLeft, ChevronRight, GripVertical, AlertTriangle, Users, MapPin,
  GraduationCap, Search, CalendarPlus, Copy, Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { ENSEIGNANTS } from "@/data/mockData";
import { updateSeancePosition, dupliquerSemaine } from "@/data/studentStore";
import { useSeances } from "@/hooks/useStudentStore";
import { useClasses, useSalles } from "@/hooks/useStructureStore";
import { useTypesSeance, useJoursFeries } from "@/hooks/useScheduleSettingsStore";
import { getJourFerieCouvrant } from "@/data/scheduleSettingsStore";
import { useEvenements } from "@/hooks/useEvenementStore";
import { ajouterEvenement, modifierEvenement, supprimerEvenement, type EvenementRecord } from "@/data/evenementStore";
import {
  filterTeachers,
  matchesProf,
  mondayOf,
  teacherDisplayLabel,
  type EnseignantRecord,
} from "@/lib/teacherUtils";
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

const inputClass = "px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";
const formInputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function SchedulePage() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const initialParams = useMemo(() => new URLSearchParams(searchStr), []); // eslint-disable-line react-hooks/exhaustive-deps
  const seances = useSeances();
  const CLASSES = useClasses();
  const SALLES = useSalles();
  const TYPES_SEANCE = useTypesSeance();
  const evenements = useEvenements();
  useJoursFeries(); // souscription pour re-rendre quand la liste des jours fériés change
  const teachers = ENSEIGNANTS as EnseignantRecord[];

  // Point d'entrée depuis le menu "Planning professeurs" (redirigé vers ce mode plutôt que
  // de maintenir une page séparée redondante) : ?mode=prof&teacherId=... présélectionne.
  const initialTeacherId = initialParams.get("teacherId") ?? "";
  const initialTeacher = initialTeacherId ? teachers.find((t) => t.id === initialTeacherId) : undefined;

  const [viewMode, setViewMode] = useState<ViewMode>(initialParams.get("mode") === "prof" ? "prof" : "classe");
  const [viewTarget, setViewTarget] = useState("");
  const [profQuery, setProfQuery] = useState(initialTeacher ? teacherDisplayLabel(initialTeacher) : "");
  const [selectedProfId, setSelectedProfId] = useState(initialTeacherId);
  const [showProfSuggestions, setShowProfSuggestions] = useState(false);
  const [weekViewMode, setWeekViewMode] = useState<"semaine" | "jour">("semaine");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Revenir sur la semaine visée après un ajout de séance/évènement (?week=<lundi ISO>),
  // plutôt que de retomber systématiquement sur la semaine courante — sinon une séance créée
  // pour une autre semaine que celle affichée semble "ne pas s'afficher".
  const [weekOffset, setWeekOffset] = useState(() => {
    const weekParam = initialParams.get("week");
    if (!weekParam) return 0;
    const now = new Date();
    const thisWeekMonday = new Date(now);
    thisWeekMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const target = new Date(`${weekParam}T12:00:00`);
    const diffDays = Math.round((target.getTime() - thisWeekMonday.getTime()) / 86400000);
    return Math.round(diffDays / 7);
  });
  const [conflictMsg, setConflictMsg] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  // Évènement — création / édition
  const [showEvenementModal, setShowEvenementModal] = useState(false);
  const [editingEvenementId, setEditingEvenementId] = useState<string | undefined>(undefined);
  const [evObjet, setEvObjet] = useState("");
  const [evDate, setEvDate] = useState(new Date().toISOString().slice(0, 10));
  const [evTypeId, setEvTypeId] = useState("");
  const [evClasseId, setEvClasseId] = useState("");
  const [evSalleId, setEvSalleId] = useState("");
  const [evHeureDebut, setEvHeureDebut] = useState("08:00");
  const [evHeureFin, setEvHeureFin] = useState("10:00");
  const [evSurveillant, setEvSurveillant] = useState("");
  const [evRemarque, setEvRemarque] = useState("");
  const [evConflicts, setEvConflicts] = useState<string[]>([]);
  const [deleteEvenementTarget, setDeleteEvenementTarget] = useState<EvenementRecord | null>(null);

  const selectedProf = teachers.find((t) => t.id === selectedProfId) ?? null;
  const profSuggestions = useMemo(() => filterTeachers(teachers, profQuery).slice(0, 8), [teachers, profQuery]);

  const targetOptions = useMemo(() => {
    if (viewMode === "classe") return CLASSES.map((c) => ({ id: c.id, label: c.nom }));
    if (viewMode === "salle") return SALLES.map((s) => ({ id: s.id, label: `${s.nom} [${s.capacite} places]` }));
    return [];
  }, [viewMode, CLASSES, SALLES]);

  useEffect(() => {
    if (viewMode === "prof") return;
    if (!viewTarget && targetOptions[0]) setViewTarget(targetOptions[0].id);
  }, [viewMode, viewTarget, targetOptions]);

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setConflictMsg("");
    if (mode === "classe") setViewTarget(CLASSES[0]?.id ?? "");
    else if (mode === "salle") setViewTarget(SALLES[0]?.id ?? "");
  };

  const now = new Date();
  const todayDow = now.getDay() === 0 ? 7 : now.getDay();
  const currentTimeY = (now.getHours() - 8) * PX_PER_H + now.getMinutes() * (PX_PER_H / 60);
  const showTimeLine = now.getHours() >= 8 && now.getHours() < 20;

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

  const todayJourNum = Math.min((now.getDay() + 6) % 7 + 1, 6);
  const displayDayIdxs = weekViewMode === "jour" ? [todayJourNum - 1] : [0, 1, 2, 3, 4, 5];

  const filteredSeances = useMemo(() => {
    let list = seances.filter((s) => s.semaineDu === weekMonday);
    if (viewMode === "classe") list = list.filter((s) => s.classeId === viewTarget);
    else if (viewMode === "salle") list = list.filter((s) => s.salleId === viewTarget);
    else if (viewMode === "prof" && selectedProf) list = list.filter((s) => matchesProf(selectedProf, s.prof));
    else if (viewMode === "prof") list = [];
    return list;
  }, [seances, viewMode, viewTarget, selectedProf, weekMonday]);

  // Évènements : jamais en mode "Par professeur" (pas de champ prof) — visibles en classe/salle,
  // uniquement s'ils sont génériques (aucune classe/salle choisie) ou s'ils ciblent celle affichée.
  const filteredEvenements = useMemo(() => {
    if (viewMode === "prof") return [];
    return evenements.filter((e) => {
      if (viewMode === "classe") return !e.classeId || e.classeId === viewTarget;
      return !e.salleId || e.salleId === viewTarget;
    });
  }, [evenements, viewMode, viewTarget]);

  const semaineVide = useMemo(() => seances.filter((s) => s.semaineDu === weekMonday).length === 0, [seances, weekMonday]);
  const semainePrecedenteMonday = useMemo(() => {
    const d = new Date(`${weekMonday}T12:00:00`);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, [weekMonday]);
  const semainePrecedenteCount = useMemo(() => seances.filter((s) => s.semaineDu === semainePrecedenteMonday).length, [seances, semainePrecedenteMonday]);

  function handleDupliquer() {
    const count = dupliquerSemaine(semainePrecedenteMonday, weekMonday);
    if (count > 0) toast.success(`${count} séance(s) dupliquée(s) depuis la semaine précédente — ajustez au besoin`);
  }

  const openNewSeance = (dayIdx: number, heureDebut: string, heureFin?: string) => {
    const dateStr = weekDays[dayIdx].toISOString().slice(0, 10);
    const qs = new URLSearchParams({ date: dateStr, heureDebut, heureFin: heureFin ?? addMinutes(heureDebut, 60) });
    setLocation(`/admin/schedule/new?${qs.toString()}`);
  };

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

  const bannerLabel = useMemo(() => {
    if (viewMode === "classe") {
      const c = CLASSES.find((x) => x.id === viewTarget);
      return c ? `Disponibilité de la classe : ${c.nom}` : "Disponibilité de la classe";
    }
    if (viewMode === "salle") {
      const s = SALLES.find((x) => x.id === viewTarget);
      return s ? `Disponibilité de la salle : ${s.nom} [${s.capacite} places]` : "Disponibilité de la salle";
    }
    return selectedProf ? `Planning du professeur : ${selectedProf.matricule} — ${selectedProf.prenom} ${selectedProf.nom}` : "Planning du professeur";
  }, [viewMode, viewTarget, CLASSES, SALLES, selectedProf]);

  const evenementTypes = TYPES_SEANCE.filter((t) => t.categorie === "evenement");
  const evenementTypeSelected = evenementTypes.find((t) => t.id === evTypeId) ?? evenementTypes[0];

  useEffect(() => {
    if (!evTypeId && evenementTypes[0]) setEvTypeId(evenementTypes[0].id);
  }, [evTypeId, evenementTypes]);

  function resetEvenementForm() {
    setEditingEvenementId(undefined);
    setEvObjet("");
    // Défaut sur la semaine actuellement affichée (pas "aujourd'hui") — sinon un évènement créé
    // en consultant une autre semaine que la semaine courante semble ne jamais s'afficher.
    setEvDate(weekMonday);
    setEvClasseId("");
    setEvSalleId("");
    setEvHeureDebut("08:00");
    setEvHeureFin("10:00");
    setEvSurveillant("");
    setEvRemarque("");
    setEvConflicts([]);
  }

  function openEditEvenement(ev: EvenementRecord) {
    setEditingEvenementId(ev.id);
    setEvObjet(ev.objet);
    setEvDate(ev.date);
    setEvTypeId(ev.typeId);
    setEvClasseId(ev.classeId ?? "");
    setEvSalleId(ev.salleId ?? "");
    setEvHeureDebut(ev.heureDebut);
    setEvHeureFin(ev.heureFin);
    setEvSurveillant(ev.surveillant ?? "");
    setEvRemarque(ev.remarque ?? "");
    setEvConflicts([]);
    setShowEvenementModal(true);
  }

  function submitEvenement() {
    setEvConflicts([]);
    if (!evObjet.trim() || !evDate || !evenementTypeSelected) {
      toast.error("Objet, date et type sont obligatoires");
      return;
    }
    const classe = CLASSES.find((c) => c.id === evClasseId);
    const salle = SALLES.find((s) => s.id === evSalleId);
    const payload = {
      objet: evObjet.trim(),
      date: evDate,
      typeId: evenementTypeSelected.id,
      type: evenementTypeSelected.code,
      classeId: evClasseId || undefined,
      classe: classe?.nom,
      salleId: evSalleId || undefined,
      salle: salle?.nom,
      heureDebut: evHeureDebut,
      heureFin: evHeureFin,
      surveillant: evenementTypeSelected.necessiteSurveillant ? evSurveillant.trim() || undefined : undefined,
      remarque: evRemarque.trim() || undefined,
    };
    const result = editingEvenementId ? modifierEvenement(editingEvenementId, payload) : ajouterEvenement(payload);
    if (result.conflicts.length > 0) {
      setEvConflicts(result.conflicts.map((c) => c.label));
      return;
    }
    toast.success(editingEvenementId ? "Évènement modifié" : "Évènement ajouté");
    setShowEvenementModal(false);
    resetEvenementForm();
  }

  const canDisplay = viewMode === "prof" ? !!selectedProf : !!viewTarget;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Emploi du Temps" }]}
        title="Emploi du Temps"
        subtitle="Propre à chaque semaine — vue par classe, salle ou professeur, conflits détectés au déplacement"
        actions={
          <div className="flex items-center gap-2">
            <button data-testid="edt-ajouter-evenement" onClick={() => { resetEvenementForm(); setShowEvenementModal(true); }} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
              <CalendarPlus size={15} /> Ajouter un évènement
            </button>
            <button data-testid="edt-ajouter-seance" onClick={() => setLocation(`/admin/schedule/new?date=${weekMonday}`)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus size={15} /> Ajouter une séance
            </button>
          </div>
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
              data-testid={`edt-mode-${key}`}
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
          {viewMode === "prof" ? (
            <div className="relative flex-1 min-w-[280px] max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
              <input
                type="search"
                value={profQuery}
                onChange={(e) => {
                  setProfQuery(e.target.value);
                  setShowProfSuggestions(true);
                  if (!e.target.value.trim()) setSelectedProfId("");
                }}
                onFocus={() => setShowProfSuggestions(true)}
                placeholder="Rechercher un professeur (matricule, nom, téléphone)…"
                className={`${inputClass} pl-10 w-full`}
                data-testid="edt-prof-search"
              />
              {showProfSuggestions && profSuggestions.length > 0 && profQuery.trim().length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                  {profSuggestions.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedProfId(t.id);
                        setProfQuery(teacherDisplayLabel(t));
                        setShowProfSuggestions(false);
                      }}
                      className={cn("w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors", t.id === selectedProfId && "bg-primary/5")}
                    >
                      {teacherDisplayLabel(t)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <select data-testid="edt-target-select" value={viewTarget} onChange={(e) => setViewTarget(e.target.value)} className={inputClass + " min-w-[220px]"}>
              {targetOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 ml-auto flex-wrap">
            <button data-testid="edt-week-prev" onClick={() => setWeekOffset((w) => w - 1)} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"><ChevronLeft size={16} /></button>
            <span className="text-sm font-medium text-foreground px-2">Sem. du {weekLabel}</span>
            <button data-testid="edt-week-next" onClick={() => setWeekOffset((w) => w + 1)} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"><ChevronRight size={16} /></button>
            <button data-testid="edt-week-today" onClick={() => setWeekOffset(0)} className="px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">Aujourd&apos;hui</button>
            {(["semaine", "jour"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                data-testid={`edt-view-${mode}`}
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

        <p className="text-xs text-muted-foreground">
          {filteredSeances.length} séance(s) affichée(s) — mode <strong>{viewMode}</strong>
        </p>
      </div>

      {semaineVide && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-800">
            Aucune séance confectionnée pour la semaine du {weekMonday}
            {semainePrecedenteCount > 0 ? " — repartez de la semaine précédente pour gagner du temps." : "."}
          </p>
          {semainePrecedenteCount > 0 && (
            <button
              type="button"
              data-testid="edt-dupliquer-semaine"
              onClick={handleDupliquer}
              className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-xl text-xs font-medium hover:bg-amber-700 transition-colors shrink-0"
            >
              <Copy size={14} /> Dupliquer la semaine précédente ({semainePrecedenteCount} séance(s))
            </button>
          )}
        </div>
      )}

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

      {!canDisplay ? (
        <div className="text-center py-16 text-muted-foreground">
          {viewMode === "prof" ? "Recherchez un professeur pour afficher son planning" : "Sélectionnez une cible pour afficher l'emploi du temps"}
        </div>
      ) : (
        <>
          <div className="bg-muted/60 border border-border rounded-t-xl px-4 py-2.5 text-sm font-semibold text-foreground uppercase tracking-wide">
            {bannerLabel}
          </div>
          <div ref={gridRef} className="bg-card border border-border border-t-0 rounded-b-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="grid" style={{ gridTemplateColumns: `64px repeat(${displayDayIdxs.length}, 1fr)` }}>
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
                      "px-3 py-3 text-center text-xs font-semibold border-b border-r border-border last:border-r-0",
                      dayNum === todayDow && weekOffset === 0 && "bg-primary/5 text-primary",
                      ferie && "bg-amber-50 text-amber-700",
                    )}
                  >
                    {JOURS[dayIdx]}
                    {ferie && <div className="text-[9px] font-normal normal-case truncate">{ferie.intitule}</div>}
                  </div>
                );
              })}
            </div>

            <div className="grid relative" style={{ gridTemplateColumns: `64px repeat(${displayDayIdxs.length}, 1fr)` }}>
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
                const daySeances = filteredSeances.filter((s) => s.jour === dayNum);
                const dayEvenements = filteredEvenements.filter((e) => e.date === dateIso);
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
                      <button
                        key={h}
                        type="button"
                        className="w-full border-b border-border/50 last:border-0 hover:bg-primary/[0.04] transition-colors cursor-pointer"
                        style={{ height: PX_PER_H }}
                        onClick={() => openNewSeance(dayIdx, `${String(h).padStart(2, "0")}:00`)}
                        aria-label={`Planifier ${JOURS[dayIdx]} ${h}h`}
                      />
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
                          onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("seanceId", s.id); setDraggingId(s.id); }}
                          onDragEnd={() => setDraggingId(null)}
                          onClick={(e) => e.stopPropagation()}
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

                    {dayEvenements.map((ev) => {
                      const typeRecord = TYPES_SEANCE.find((t) => t.code === ev.type);
                      const colors = shadeFromColor(typeRecord?.couleur ?? FALLBACK_COLOR);
                      const top = timeToPixels(ev.heureDebut);
                      const height = getDuration(ev.heureDebut, ev.heureFin);
                      return (
                        <div
                          key={ev.id}
                          data-testid={`edt-evenement-${ev.id}`}
                          onClick={(e) => { e.stopPropagation(); openEditEvenement(ev); }}
                          title={`${ev.remarque || ev.objet} — cliquer pour modifier ou supprimer`}
                          className="absolute left-1 right-1 rounded-lg px-2 py-1.5 overflow-hidden border-dashed cursor-pointer hover:brightness-95"
                          style={{
                            top: `${top}px`, height: `${Math.max(height, 40)}px`,
                            background: colors.bg, border: `2px dashed ${colors.border}`,
                            zIndex: 4,
                          }}
                        >
                          <div className="text-[10px] font-bold truncate" style={{ color: colors.text }}>{ev.objet}</div>
                          <div className="text-[9px] text-muted-foreground">{ev.heureDebut}–{ev.heureFin} · {ev.type}</div>
                          {ev.surveillant && <div className="text-[9px] text-muted-foreground truncate">Surveillant : {ev.surveillant}</div>}
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
        </>
      )}

      <FormModal
        open={showEvenementModal}
        onClose={() => { setShowEvenementModal(false); resetEvenementForm(); }}
        title={editingEvenementId ? "Modifier l'évènement" : "Ajouter un évènement"}
        size="md"
      >
        <div className="space-y-4">
          {evConflicts.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <div className="flex items-center gap-2 font-semibold mb-1"><AlertTriangle size={14} /> Conflit de salle détecté</div>
              <ul className="list-disc pl-5 space-y-0.5">{evConflicts.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Objet <span className="text-red-500">*</span></label>
            <input value={evObjet} onChange={(e) => setEvObjet(e.target.value)} className={formInputClass} placeholder="Ex : Conseil de classe, Examen S1…" data-testid="ev-objet" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date <span className="text-red-500">*</span></label>
              <input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} className={formInputClass} data-testid="ev-date" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type <span className="text-red-500">*</span></label>
              <select value={evTypeId} onChange={(e) => setEvTypeId(e.target.value)} className={formInputClass} data-testid="ev-type">
                {evenementTypes.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.intitule}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe (optionnel)</label>
              <select value={evClasseId} onChange={(e) => setEvClasseId(e.target.value)} className={formInputClass} data-testid="ev-classe">
                <option value="">— Aucune —</option>
                {CLASSES.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Salle (optionnel)</label>
              <select value={evSalleId} onChange={(e) => setEvSalleId(e.target.value)} className={formInputClass} data-testid="ev-salle">
                <option value="">— Aucune —</option>
                {SALLES.map((s) => <option key={s.id} value={s.id}>{s.nom} — {s.batiment}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Heure début <span className="text-red-500">*</span></label>
              <input type="time" value={evHeureDebut} onChange={(e) => setEvHeureDebut(e.target.value)} className={formInputClass} data-testid="ev-heure-debut" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Heure fin <span className="text-red-500">*</span></label>
              <input type="time" value={evHeureFin} onChange={(e) => setEvHeureFin(e.target.value)} className={formInputClass} data-testid="ev-heure-fin" />
            </div>
          </div>
          {evenementTypeSelected?.necessiteSurveillant && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Surveillant</label>
              <input value={evSurveillant} onChange={(e) => setEvSurveillant(e.target.value)} className={formInputClass} placeholder="Nom du surveillant" data-testid="ev-surveillant" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Remarque</label>
            <textarea value={evRemarque} onChange={(e) => setEvRemarque(e.target.value)} rows={2} className={formInputClass} />
          </div>
          <div className="flex justify-between gap-2 pt-2">
            {editingEvenementId ? (
              <button
                type="button"
                data-testid="ev-supprimer"
                onClick={() => {
                  const ev = evenements.find((e) => e.id === editingEvenementId);
                  if (ev) setDeleteEvenementTarget(ev);
                }}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50"
              >
                <Trash2 size={14} /> Supprimer
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowEvenementModal(false); resetEvenementForm(); }} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                Annuler
              </button>
              <button type="button" onClick={submitEvenement} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90" data-testid="ev-sauvegarder">
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      </FormModal>

      {deleteEvenementTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteEvenementTarget(null)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1">Supprimer « {deleteEvenementTarget.objet} » ?</h2>
            <p className="text-xs text-muted-foreground mb-4">Cette action est irréversible.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteEvenementTarget(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                Annuler
              </button>
              <button
                type="button"
                data-testid="ev-confirmer-suppression"
                onClick={() => {
                  supprimerEvenement(deleteEvenementTarget.id);
                  toast.success("Évènement supprimé");
                  setDeleteEvenementTarget(null);
                  setShowEvenementModal(false);
                  resetEvenementForm();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
