import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Save, Calculator } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useTeachers } from "@/hooks/useTeacherStore";
import { getVacationById, addVacation, updateVacation } from "@/data/vacationStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA } from "@/lib/utils";

const MOIS_OPTIONS = [
  "Octobre 2025", "Novembre 2025", "Décembre 2025",
  "Janvier 2026", "Février 2026", "Mars 2026",
  "Avril 2026", "Mai 2026", "Juin 2026",
];

interface FormData {
  enseignantId: string;
  mois: string;
  heuresCm: number;
  heuresTd: number;
  tauxHoraire: number;
  statut: "brouillon" | "valide" | "paye";
  observations?: string;
}

interface Props { id?: string; }

export default function VacationFormPage({ id }: Props) {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const isEdit = !!id;
  const enseignants = useTeachers();

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { enseignantId: "", mois: "", heuresCm: 0, heuresTd: 0, tauxHoraire: 15000, statut: "brouillon", observations: "" },
  });

  useEffect(() => {
    if (isEdit && id) {
      const vacation = getVacationById(id);
      if (vacation) {
        reset({
          enseignantId: vacation.enseignantId,
          mois: vacation.mois,
          heuresCm: vacation.heuresCm,
          heuresTd: vacation.heuresTd,
          tauxHoraire: vacation.tauxHoraire,
          statut: vacation.statut,
          observations: vacation.observations ?? "",
        });
      }
    }
  }, [id, isEdit, reset]);

  const heuresCm = watch("heuresCm") || 0;
  const heuresTd = watch("heuresTd") || 0;
  const tauxHoraire = watch("tauxHoraire") || 0;
  const montantTotal = (Number(heuresCm) + Number(heuresTd)) * Number(tauxHoraire);

  const enseignantId = watch("enseignantId");
  const enseignant = enseignants.find((e) => e.id === enseignantId);

  const onSubmit = (data: FormData) => {
    if (!currentUser || !enseignant) return;
    const enseignantNom = `${enseignant.prenom} ${enseignant.nom}`;
    const payload = {
      enseignantId: data.enseignantId,
      mois: data.mois,
      modules: isEdit && id ? (getVacationById(id)?.modules ?? []) : [],
      heuresCm: Number(data.heuresCm),
      heuresTd: Number(data.heuresTd),
      tauxHoraire: Number(data.tauxHoraire),
      statut: data.statut,
      moyen: isEdit && id ? (getVacationById(id)?.moyen ?? "") : "",
      observations: data.observations,
    };
    if (isEdit && id) {
      updateVacation(id, payload, enseignantNom, currentUser.id);
    } else {
      addVacation(payload, enseignantNom, currentUser.id);
    }
    setLocation("/admin/vacations");
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Vacations", href: "/admin/vacations" }, { label: isEdit ? "Modifier" : "Nouvelle" }]}
        title={isEdit ? "Modifier la vacation" : "Nouvelle vacation enseignant"}
        subtitle="Déclarez les heures d'enseignement et calculez la rémunération automatiquement"
        actions={
          <button onClick={() => setLocation("/admin/vacations")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Enseignant *</label>
                <select {...register("enseignantId", { required: "Enseignant requis" })} className={inputClass}>
                  <option value="">Sélectionner un enseignant</option>
                  {enseignants.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.specialite} ({e.grade})</option>)}
                </select>
                {errors.enseignantId && <p className="text-xs text-red-500 mt-1">{errors.enseignantId.message}</p>}
              </div>
              {enseignant && (
                <div className="col-span-2 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-primary">{enseignant.prenom} {enseignant.nom}</p>
                    <p className="text-[10px] text-muted-foreground">{enseignant.specialite} · {enseignant.grade}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-foreground">{formatCFA(enseignant.tauxHoraire)}/h</p>
                    <p className="text-[10px] text-muted-foreground">Taux par défaut</p>
                  </div>
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mois de la vacation *</label>
                <select {...register("mois", { required: "Mois requis" })} className={inputClass}>
                  <option value="">Sélectionner le mois</option>
                  {MOIS_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {errors.mois && <p className="text-xs text-red-500 mt-1">{errors.mois.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Heures de CM</label>
                <input {...register("heuresCm", { valueAsNumber: true, min: 0 })} type="number" min={0} step={0.5} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Heures de TD / TP</label>
                <input {...register("heuresTd", { valueAsNumber: true, min: 0 })} type="number" min={0} step={0.5} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Taux horaire (FCFA) *</label>
                <input {...register("tauxHoraire", { required: "Taux requis", valueAsNumber: true, min: 0 })} type="number" min={0} className={inputClass} />
                {errors.tauxHoraire && <p className="text-xs text-red-500 mt-1">{errors.tauxHoraire.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut</label>
                <select {...register("statut")} className={inputClass}>
                  <option value="brouillon">Brouillon</option>
                  <option value="valide">Validé</option>
                  <option value="paye">Payé</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Observations</label>
                <textarea {...register("observations")} rows={2} placeholder="Remarques éventuelles..." className={`${inputClass} resize-none`} />
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Récapitulatif de la rémunération</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-muted/50 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">Total heures</p>
                <p className="text-xl font-bold text-foreground">{Number(heuresCm) + Number(heuresTd)}h</p>
                <p className="text-[10px] text-muted-foreground">{heuresCm}h CM + {heuresTd}h TD/TP</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">Taux horaire</p>
                <p className="text-xl font-bold text-foreground">{formatCFA(tauxHoraire)}</p>
                <p className="text-[10px] text-muted-foreground">par heure</p>
              </div>
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                <p className="text-xs text-primary font-medium mb-1">Montant total</p>
                <p className="text-xl font-bold text-primary">{formatCFA(montantTotal)}</p>
                <p className="text-[10px] text-primary/70">FCFA brut</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Save size={14} /> {isEdit ? "Enregistrer les modifications" : "Créer la vacation"}
            </button>
            <button type="button" onClick={() => setLocation("/admin/vacations")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}
