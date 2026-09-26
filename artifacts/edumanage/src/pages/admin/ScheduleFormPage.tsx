import { useMemo, useState } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Check, Calendar, Clock, MapPin, User, BookOpen, AlertTriangle, Ban } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS } from "@/data/mockData";
import { addSeance, modifierSeance, annulerSeance, getSeances } from "@/data/studentStore";
import { useAuth } from "@/contexts/AuthContext";
import { useEcs } from "@/hooks/useCurriculumStore";
import { useClasses, useSalles } from "@/hooks/useStructureStore";
import { useTypesSeance } from "@/hooks/useScheduleSettingsStore";
import { dateToJour, mondayOf } from "@/lib/teacherUtils";
import { cn } from "@/lib/utils";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function prochainLundi(): string {
  const monday = mondayOf(new Date().toISOString().slice(0, 10));
  const d = new Date(`${monday}T12:00:00`);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

interface SeanceForm {
  ecId: string;
  classeId: string;
  salleId: string;
  prof: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  type: string;
  notes?: string;
}

/** Date réelle (ISO) d'une séance : lundi de sa semaine + (jour - 1). */
function dateDeSeance(semaineDu: string, jour: number): string {
  const d = new Date(`${semaineDu}T12:00:00`);
  d.setDate(d.getDate() + (jour - 1));
  return d.toISOString().slice(0, 10);
}

/** Planifier une séance (/admin/schedule/new) ou modifier / annuler une séance existante
 * (/admin/schedule/seance/:id, ouvert en cliquant sur la séance dans l'emploi du temps). */
export default function ScheduleFormPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const [modeEdition, routeParams] = useRoute("/admin/schedule/seance/:id");
  // Lue une seule fois : le formulaire part de l'état de la séance à l'ouverture.
  const [seanceEditee] = useState(() => (modeEdition ? getSeances().find((x) => x.id === routeParams?.id) : undefined));
  const [motifAnnulation, setMotifAnnulation] = useState("");
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false);
  const searchStr = useSearch();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const [submitted, setSubmitted] = useState(false);
  const ECS = useEcs();
  const CLASSES = useClasses();
  const SALLES = useSalles();
  const TYPES_SEANCE = useTypesSeance().filter((t) => t.categorie === "emploi_du_temps");
  const [conflicts, setConflicts] = useState<string[]>([]);

  const form = useForm<SeanceForm>({
    defaultValues: seanceEditee
      ? {
          ecId: seanceEditee.ecId,
          classeId: seanceEditee.classeId,
          salleId: seanceEditee.salleId,
          // Ancienne séance sans identifiant : on retrouve l'enseignant par son nom complet exact.
          prof: seanceEditee.profId ?? ENSEIGNANTS.find((e) => `${e.prenom} ${e.nom}`.trim().toLowerCase() === seanceEditee.prof.trim().toLowerCase())?.id ?? "",
          date: dateDeSeance(seanceEditee.semaineDu, seanceEditee.jour),
          heureDebut: seanceEditee.heureDebut,
          heureFin: seanceEditee.heureFin,
          type: seanceEditee.type,
          notes: "",
        }
      : {
          ecId: ECS[0]?.id ?? "",
          classeId: CLASSES[0]?.id ?? "",
          salleId: SALLES[0]?.id ?? "",
          prof: ENSEIGNANTS[0]?.id ?? "",
          date: params.get("date") || prochainLundi(),
          heureDebut: params.get("heureDebut") || "08:00",
          heureFin: params.get("heureFin") || "10:00",
          type: TYPES_SEANCE[0]?.code ?? "CM",
          notes: "",
        },
  });

  const values = form.watch();
  const profLabel = (id: string) => {
    const t = ENSEIGNANTS.find((e) => e.id === id);
    return t ? `${t.prenom} ${t.nom}` : "";
  };
  // Champs verrouillés en modification : lus depuis la séance, pas depuis le formulaire.
  const ec = ECS.find((e) => e.id === (seanceEditee?.ecId ?? values.ecId));
  const classe = CLASSES.find((c) => c.id === (seanceEditee?.classeId ?? values.classeId));
  const salle = SALLES.find((s) => s.id === values.salleId);
  const jourLabel = values.date ? JOURS[dateToJour(values.date)] : undefined;
  const typeColor = TYPES_SEANCE.find((t) => t.code === values.type)?.couleur ?? "#4f46e5";

  const onSubmit = form.handleSubmit((data) => {
    setConflicts([]);
    if (dateToJour(data.date) === 7) {
      setConflicts(["Aucun cours ne peut être planifié un dimanche — choisissez une date du lundi au samedi"]);
      return;
    }
    if (data.heureFin <= data.heureDebut) {
      setConflicts(["L'heure de fin doit être postérieure à l'heure de début"]);
      return;
    }
    if (seanceEditee) {
      const res = modifierSeance(seanceEditee.id, {
        salleId: data.salleId,
        prof: profLabel(data.prof),
        profId: data.prof || undefined,
        jour: dateToJour(data.date),
        semaineDu: mondayOf(data.date),
        heureDebut: data.heureDebut,
        heureFin: data.heureFin,
        type: data.type,
      }, currentUser?.id ?? "system");
      if (!res.ok) {
        setConflicts(res.conflicts.length > 0 ? res.conflicts.map((c) => c.label) : ["Séance introuvable"]);
        return;
      }
      toast.success("Séance modifiée — étudiants et professeur prévenus");
      setLocation(`/admin/schedule?week=${mondayOf(data.date)}`);
      return;
    }
    const result = addSeance({
      ecId: data.ecId,
      classeId: data.classeId,
      salleId: data.salleId,
      // Le champ contient l'identifiant de l'enseignant : la séance garde son nom (affichage) et son
      // identifiant (lien fiable vers son portail, même avec un homonyme).
      prof: profLabel(data.prof),
      profId: data.prof || undefined,
      jour: dateToJour(data.date),
      semaineDu: mondayOf(data.date),
      heureDebut: data.heureDebut,
      heureFin: data.heureFin,
      type: data.type,
    });
    if (result.conflicts.length > 0) {
      setConflicts(result.conflicts.map((c) => c.label));
      return;
    }
    setSubmitted(true);
    // Revenir sur la semaine où la séance vient d'être créée, pas systématiquement la semaine
    // courante — sinon une séance ajoutée pour une autre semaine semble ne jamais s'afficher.
    setTimeout(() => setLocation(`/admin/schedule?week=${mondayOf(data.date)}`), 1500);
  });

  const annuler = () => {
    if (!seanceEditee) return;
    const res = annulerSeance(seanceEditee.id, motifAnnulation, currentUser?.id ?? "system");
    if (!res.ok) { toast.error(res.reason ?? "Annulation impossible"); setConfirmerAnnulation(false); return; }
    toast.success("Cours annulé — étudiants et professeur prévenus");
    setLocation(`/admin/schedule?week=${seanceEditee.semaineDu}`);
  };

  if (modeEdition && !seanceEditee) {
    return (
      <div>
        <PageHeader breadcrumb={[{ label: "Admin" }, { label: "Emploi du Temps", href: "/admin/schedule" }, { label: "Séance" }]} title="Séance introuvable" subtitle="Elle a peut-être été annulée entre-temps." />
        <button onClick={() => setLocation("/admin/schedule")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted"><ArrowLeft size={15} /> Retour à l&apos;emploi du temps</button>
      </div>
    );
  }

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Emploi du Temps", href: "/admin/schedule" },
          { label: seanceEditee ? "Modifier la séance" : "Nouvelle séance" },
        ]}
        title={seanceEditee ? "Modifier la séance" : "Planifier une séance"}
        subtitle={seanceEditee ? `${seanceEditee.ec} — ${seanceEditee.classe} : date, horaire, salle ou enseignant ; la classe et l'enseignant sont prévenus` : "Formulaire complet — EC, classe, salle, horaire et enseignant"}
        actions={
          <button
            onClick={() => setLocation(seanceEditee ? `/admin/schedule?week=${seanceEditee.semaineDu}` : "/admin/schedule")}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft size={15} /> Retour à l'emploi du temps
          </button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {conflicts.length > 0 && (
          <div className="lg:col-span-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <div className="flex items-center gap-2 font-semibold mb-2"><AlertTriangle size={16} /> Impossible d'enregistrer — conflits détectés</div>
            <ul className="list-disc pl-5 space-y-1">{conflicts.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        )}
        <form onSubmit={onSubmit} className="lg:col-span-2 space-y-5">
          <section className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-primary" /> Cours & promotion
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Élément constitutif (EC) *</label>
                <select {...form.register("ecId", { required: true })} className={cn(inputClass, seanceEditee && "bg-muted/50 cursor-not-allowed")} disabled={!!seanceEditee}>
                  {ECS.map((e) => (
                    <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
                <select {...form.register("classeId", { required: true })} className={cn(inputClass, seanceEditee && "bg-muted/50 cursor-not-allowed")} disabled={!!seanceEditee}>
                  {CLASSES.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom} ({c.inscrits}/{c.max})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type de séance *</label>
                <select {...form.register("type")} className={inputClass}>
                  {TYPES_SEANCE.map((t) => <option key={t.id} value={t.code}>{t.code} — {t.intitule}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Clock size={18} className="text-primary" /> Horaire & lieu
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date (semaine du {mondayOf(values.date || prochainLundi())}) *</label>
                <input type="date" {...form.register("date", { required: true })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Salle *</label>
                <select {...form.register("salleId", { required: true })} className={inputClass}>
                  {SALLES.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom} — {s.batiment} ({s.capacite} pl.)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Heure début *</label>
                <input type="time" {...form.register("heureDebut", { required: true })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Heure fin *</label>
                <input type="time" {...form.register("heureFin", { required: true })} className={inputClass} />
              </div>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <User size={18} className="text-primary" /> Enseignant & remarques
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Enseignant responsable *</label>
                <select {...form.register("prof", { required: true })} className={inputClass}>
                  {ENSEIGNANTS.map((e) => (
                    <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.specialite}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notes internes (optionnel)</label>
                <textarea {...form.register("notes")} rows={3} placeholder="Ex: Séance de rattrapage, examen blanc…" className={inputClass} />
              </div>
            </div>
          </section>

          <div className="flex gap-3">
            <button type="button" onClick={() => setLocation(seanceEditee ? `/admin/schedule?week=${seanceEditee.semaineDu}` : "/admin/schedule")} className="flex-1 py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted">
              {seanceEditee ? "Retour sans modifier" : "Annuler"}
            </button>
            <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90" data-testid="seance-enregistrer">
              {seanceEditee ? "Enregistrer les modifications" : "Enregistrer la séance"}
            </button>
          </div>

          {seanceEditee && (
            <section className="bg-card border border-red-200 dark:border-red-900 rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
              <h3 className="font-bold text-red-600 mb-1 flex items-center gap-2"><Ban size={18} /> Annuler ce cours</h3>
              <p className="text-xs text-muted-foreground mb-3">La séance est retirée de l&apos;emploi du temps ; les étudiants de {seanceEditee.classe} et l&apos;enseignant reçoivent une notification avec le motif.</p>
              <input
                value={motifAnnulation}
                onChange={(e) => setMotifAnnulation(e.target.value)}
                placeholder="Motif communiqué (ex : enseignant en mission, salle indisponible)"
                className={cn(inputClass, "mb-3")}
                data-testid="seance-motif-annulation"
              />
              {confirmerAnnulation ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-red-600 font-medium">Confirmer l&apos;annulation ?</span>
                  <button type="button" onClick={() => setConfirmerAnnulation(false)} className="px-3 py-2 border border-border rounded-xl text-sm hover:bg-muted">Non</button>
                  <button type="button" onClick={annuler} className="px-3 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700" data-testid="seance-confirmer-annulation">Oui, annuler le cours</button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmerAnnulation(true)} className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40" data-testid="seance-annuler">
                  Annuler ce cours
                </button>
              )}
            </section>
          )}
        </form>

        <aside className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 sticky top-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Calendar size={16} className="text-primary" /> Aperçu
            </h3>
            {submitted ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <Check size={24} />
                </div>
                <p className="text-sm font-medium text-emerald-700">Séance enregistrée</p>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div
                  className="rounded-xl p-4 border-l-4"
                  style={{ borderColor: typeColor, background: `${typeColor}10` }}
                >
                  <p className="font-bold text-foreground">{ec?.libelle ?? "—"}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: `${typeColor}20`, color: typeColor }}>
                    {values.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock size={14} /> {jourLabel} · {values.heureDebut} – {values.heureFin}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin size={14} /> {salle?.nom ?? "—"} · {classe?.nom ?? "—"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User size={14} /> {profLabel(values.prof) || "—"}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
