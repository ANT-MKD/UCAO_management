import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX } from "@/data/mockData";
import { getClasseById, upsertClasse, getSalles } from "@/data/structureStore";
import { useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useSalles } from "@/hooks/useStructureStore";

interface FormData {
  nom: string;
  filiereId: string;
  niveauId: string;
  max: number;
  annee: string;
  delegue?: string;
  salleParDefautId?: string;
}

interface Props { id?: string; }

export default function ClasseFormPage({ id }: Props) {
  const [, setLocation] = useLocation();
  const isEdit = !!id;
  const annees = useAnneesAcademiques();
  const salles = useSalles();
  const existing = id ? getClasseById(id) : undefined;

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: existing
      ? {
          nom: existing.nom,
          filiereId: existing.filiereId,
          niveauId: existing.niveauId,
          max: existing.max,
          annee: existing.annee,
          delegue: existing.delegue,
          salleParDefautId: existing.salleParDefautId ?? "",
        }
      : {
          nom: "",
          filiereId: "",
          niveauId: "",
          max: 35,
          annee: annees.find((a) => a.actuelle)?.libelle ?? "2025-2026",
          delegue: "",
          salleParDefautId: "",
        },
  });

  useEffect(() => {
    void getSalles();
  }, []);

  const selectedFiliereId = watch("filiereId");
  const filteredNiveaux = selectedFiliereId ? NIVEAUX.filter((n) => n.filiereId === selectedFiliereId) : NIVEAUX;

  const onSubmit = (data: FormData) => {
    upsertClasse(
      {
        nom: data.nom,
        filiereId: data.filiereId,
        niveauId: data.niveauId,
        max: data.max,
        annee: data.annee,
        delegue: data.delegue,
        salleParDefautId: data.salleParDefautId || undefined,
      },
      id,
    );
    setLocation("/admin/classes");
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Classes pédagogiques", href: "/admin/classes" }, { label: isEdit ? "Modifier" : "Nouvelle" }]}
        title={isEdit ? "Modifier la classe pédagogique" : "Nouvelle classe pédagogique"}
        subtitle="Groupe d'étudiants (ex. LPIG L1 A 2025-2026) — distinct de la salle physique"
        actions={
          <button onClick={() => setLocation("/admin/classes")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 px-4 py-3 text-xs text-blue-800 dark:text-blue-200">
            Classe pédagogique = cohortes d'étudiants. La salle (local physique) se choisit à l'EDT ou en salle par défaut ci-dessous.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom de la classe *</label>
              <input {...register("nom", { required: "Nom requis", minLength: { value: 2, message: "Minimum 2 caractères" } })} placeholder="ex: LPIG-L1-A / L1-INFO-A" className={`${inputClass} uppercase font-mono`} />
              {errors.nom && <p className="text-xs text-red-500 mt-1">{errors.nom.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
              <select {...register("filiereId", { required: "Filière requise" })} onChange={(e) => { setValue("filiereId", e.target.value); setValue("niveauId", ""); }} className={inputClass}>
                <option value="">Sélectionner</option>
                {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
              </select>
              {errors.filiereId && <p className="text-xs text-red-500 mt-1">{errors.filiereId.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
              <select {...register("niveauId", { required: "Niveau requis" })} className={inputClass}>
                <option value="">Sélectionner</option>
                {filteredNiveaux.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
              </select>
              {errors.niveauId && <p className="text-xs text-red-500 mt-1">{errors.niveauId.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Capacité max *</label>
              <input {...register("max", { required: true, valueAsNumber: true, min: 1 })} type="number" min={1} max={200} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année académique *</label>
              <select {...register("annee")} className={inputClass}>
                {annees.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Salle physique par défaut</label>
              <select {...register("salleParDefautId")} className={inputClass}>
                <option value="">Aucune</option>
                {salles.filter((s) => s.statut === "actif").map((s) => (
                  <option key={s.id} value={s.id}>{s.nom} ({s.batiment})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Délégué</label>
              <input {...register("delegue")} placeholder="Nom du délégué" className={inputClass} />
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              <Save size={14} /> {isEdit ? "Enregistrer" : "Créer la classe"}
            </button>
            <button type="button" onClick={() => setLocation("/admin/classes")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}
