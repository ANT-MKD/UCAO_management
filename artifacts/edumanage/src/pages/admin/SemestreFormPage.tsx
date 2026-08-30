import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES } from "@/data/mockData";
import { useNiveaux } from "@/hooks/useNiveauStore";
import { addSemestre, updateSemestre, getSemestreById } from "@/data/semestreStore";

interface FormData {
  nom: string;
  alias: string;
  niveauId: string;
  periode: string;
  statut: "actif" | "futur" | "clos";
}

interface Props { id?: string; }

export default function SemestreFormPage({ id }: Props) {
  const [, setLocation] = useLocation();
  const isEdit = !!id;
  const existing = id ? getSemestreById(id) : undefined;
  const niveaux = useNiveaux();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: existing
      ? { nom: existing.nom, alias: existing.alias, niveauId: existing.niveauId, periode: existing.periode, statut: existing.statut }
      : { nom: "", alias: "", niveauId: "", periode: "", statut: "futur" },
  });

  const onSubmit = (data: FormData) => {
    const niveau = niveaux.find((n) => n.id === data.niveauId);
    const payload = {
      nom: data.nom.trim(),
      alias: data.alias.trim().toUpperCase(),
      niveauId: data.niveauId,
      niveau: niveau?.alias ?? "",
      filiere: niveau?.filiere ?? "",
      periode: data.periode.trim(),
      statut: data.statut,
    };
    if (isEdit && existing) {
      updateSemestre(existing.id, payload);
    } else {
      addSemestre(payload);
    }
    setLocation("/admin/semestres");
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Semestres", href: "/admin/semestres" }, { label: isEdit ? "Modifier" : "Nouveau" }]}
        title={isEdit ? "Modifier le semestre" : "Nouveau semestre"}
        subtitle="Associez le semestre à un niveau d'études"
        actions={
          <button onClick={() => setLocation("/admin/semestres")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom *</label>
              <input {...register("nom", { required: "Nom requis", minLength: { value: 2, message: "Minimum 2 caractères" } })} placeholder="ex: Semestre 1" className={inputClass} />
              {errors.nom && <p className="text-xs text-red-500 mt-1">{errors.nom.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Alias *</label>
              <input {...register("alias", { required: "Alias requis" })} placeholder="ex: S1" className={`${inputClass} uppercase font-mono`} />
              {errors.alias && <p className="text-xs text-red-500 mt-1">{errors.alias.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
              <select {...register("niveauId", { required: "Niveau requis" })} className={inputClass}>
                <option value="">Sélectionner un niveau</option>
                {niveaux.map((n) => {
                  const f = FILIERES.find((f) => f.id === n.filiereId);
                  return <option key={n.id} value={n.id}>{n.nom} ({n.alias}) — {f?.code}</option>;
                })}
              </select>
              {errors.niveauId && <p className="text-xs text-red-500 mt-1">{errors.niveauId.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Période *</label>
              <input {...register("periode", { required: "Période requise", minLength: { value: 3, message: "Minimum 3 caractères" } })} placeholder="ex: Septembre 2025 – Janvier 2026" className={inputClass} />
              {errors.periode && <p className="text-xs text-red-500 mt-1">{errors.periode.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut *</label>
              <select {...register("statut")} className={inputClass}>
                <option value="futur">À venir</option>
                <option value="actif">Actif</option>
                <option value="clos">Clôturé</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Save size={14} /> {isEdit ? "Enregistrer les modifications" : "Créer le semestre"}
            </button>
            <button type="button" onClick={() => setLocation("/admin/semestres")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}
