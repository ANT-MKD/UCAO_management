import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS } from "@/data/mockData";

interface FormData {
  nom: string;
  code: string;
  responsableId: string;
  statut: "actif" | "inactif";
  description?: string;
}

interface FilieresFormPageProps { id?: string; }

export default function FilieresFormPage({ id }: FilieresFormPageProps) {
  const [, setLocation] = useLocation();
  const isEdit = !!id;

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: { nom: "", code: "", responsableId: "", statut: "actif", description: "" },
  });

  const onSubmit = (data: FormData) => {
    console.log("Filière saved:", data);
    setLocation("/admin/filieres");
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Filières", href: "/admin/filieres" }, { label: isEdit ? "Modifier" : "Nouvelle" }]}
        title={isEdit ? "Modifier la filière" : "Nouvelle filière"}
        subtitle="Configurez la filière et son responsable pédagogique"
        actions={
          <button onClick={() => setLocation("/admin/filieres")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom complet de la filière *</label>
              <input {...register("nom", { required: "Nom requis", minLength: { value: 3, message: "Minimum 3 caractères" } })} placeholder="ex: Licence en Informatique de Gestion" className={inputClass} />
              {errors.nom && <p className="text-xs text-red-500 mt-1">{errors.nom.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code / Sigle *</label>
              <input {...register("code", { required: "Code requis", minLength: { value: 2, message: "Minimum 2 caractères" } })} placeholder="ex: LPIG" className={`${inputClass} uppercase font-mono`} />
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut *</label>
              <select {...register("statut")} className={inputClass}>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Responsable pédagogique *</label>
              <select {...register("responsableId", { required: "Responsable requis" })} className={inputClass}>
                <option value="">Sélectionner un responsable</option>
                {ENSEIGNANTS.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.specialite}</option>)}
              </select>
              {errors.responsableId && <p className="text-xs text-red-500 mt-1">{errors.responsableId.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description (optionnel)</label>
              <textarea {...register("description")} rows={3} placeholder="Objectifs de la filière, débouchés..." className={`${inputClass} resize-none`} />
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Save size={14} /> {isEdit ? "Enregistrer les modifications" : "Créer la filière"}
            </button>
            <button type="button" onClick={() => setLocation("/admin/filieres")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}
