import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Check, Calendar, Clock, MapPin, User, BookOpen, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS } from "@/data/mockData";
import { addSeance } from "@/data/studentStore";
import { useEcs } from "@/hooks/useCurriculumStore";
import { useClasses, useSalles } from "@/hooks/useStructureStore";
import { useTypesSeance } from "@/hooks/useScheduleSettingsStore";
import { cn } from "@/lib/utils";

const JOURS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
];

interface SeanceForm {
  ecId: string;
  classeId: string;
  salleId: string;
  prof: string;
  jour: number;
  heureDebut: string;
  heureFin: string;
  type: string;
  notes?: string;
}

export default function ScheduleFormPage() {
  const [, setLocation] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const ECS = useEcs();
  const CLASSES = useClasses();
  const SALLES = useSalles();
  const TYPES_SEANCE = useTypesSeance();
  const [conflicts, setConflicts] = useState<string[]>([]);

  const form = useForm<SeanceForm>({
    defaultValues: {
      ecId: ECS[0]?.id ?? "",
      classeId: CLASSES[0]?.id ?? "",
      salleId: SALLES[0]?.id ?? "",
      prof: ENSEIGNANTS[0] ? `${ENSEIGNANTS[0].prenom} ${ENSEIGNANTS[0].nom}` : "",
      jour: 1,
      heureDebut: "08:00",
      heureFin: "10:00",
      type: TYPES_SEANCE[0]?.code ?? "CM",
      notes: "",
    },
  });

  const values = form.watch();
  const ec = ECS.find((e) => e.id === values.ecId);
  const classe = CLASSES.find((c) => c.id === values.classeId);
  const salle = SALLES.find((s) => s.id === values.salleId);
  const jourLabel = JOURS.find((j) => j.value === Number(values.jour))?.label;
  const typeColor = TYPES_SEANCE.find((t) => t.code === values.type)?.couleur ?? "#4f46e5";

  const onSubmit = form.handleSubmit((data) => {
    setConflicts([]);
    const result = addSeance({
      ecId: data.ecId,
      classeId: data.classeId,
      salleId: data.salleId,
      prof: data.prof,
      jour: Number(data.jour),
      heureDebut: data.heureDebut,
      heureFin: data.heureFin,
      type: data.type,
    });
    if (result.conflicts.length > 0) {
      setConflicts(result.conflicts.map((c) => c.label));
      return;
    }
    setSubmitted(true);
    setTimeout(() => setLocation("/admin/schedule"), 1500);
  });

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Emploi du Temps", href: "/admin/schedule" },
          { label: "Nouvelle séance" },
        ]}
        title="Planifier une séance"
        subtitle="Formulaire complet — EC, classe, salle, horaire et enseignant"
        actions={
          <button
            onClick={() => setLocation("/admin/schedule")}
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
                <select {...form.register("ecId", { required: true })} className={inputClass}>
                  {ECS.map((e) => (
                    <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
                <select {...form.register("classeId", { required: true })} className={inputClass}>
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
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Jour *</label>
                <select {...form.register("jour", { valueAsNumber: true })} className={inputClass}>
                  {JOURS.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
                </select>
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
                    <option key={e.id} value={`${e.prenom} ${e.nom}`}>{e.prenom} {e.nom} — {e.specialite}</option>
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
            <button type="button" onClick={() => setLocation("/admin/schedule")} className="flex-1 py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted">
              Annuler
            </button>
            <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Enregistrer la séance
            </button>
          </div>
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
                <p className="text-sm font-medium text-emerald-700">Séance enregistrée (mock)</p>
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
                  <User size={14} /> {values.prof || "—"}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
