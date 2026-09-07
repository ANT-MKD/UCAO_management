import { useMemo } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS } from "@/data/mockData";
import { computeVht, getEcById, upsertEc } from "@/data/curriculumStore";
import { useUes } from "@/hooks/useCurriculumStore";

interface FormData {
  code: string;
  libelle: string;
  abrege: string;
  ueId: string;
  coeff: number;
  volCm: number;
  volTd: number;
  volTp: number;
  volTpe: number;
  responsableId: string;
}

interface Props { id?: string; }

export default function ECFormPage({ id }: Props) {
  const [, setLocation] = useLocation();
  const isEdit = !!id;
  const ues = useUes();
  const existing = id ? getEcById(id) : undefined;

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: existing
      ? {
          code: existing.code,
          libelle: existing.libelle,
          abrege: existing.abrege ?? "",
          ueId: existing.ueId,
          coeff: existing.coeff,
          volCm: existing.volCm,
          volTd: existing.volTd,
          volTp: existing.volTp,
          volTpe: existing.volTpe,
          responsableId: existing.responsableId ?? "",
        }
      : {
          code: "",
          libelle: "",
          abrege: "",
          ueId: "",
          coeff: 1,
          volCm: 20,
          volTd: 10,
          volTp: 0,
          volTpe: 50,
          responsableId: "",
        },
  });

  const volCm = watch("volCm") || 0;
  const volTd = watch("volTd") || 0;
  const volTp = watch("volTp") || 0;
  const volTpe = watch("volTpe") || 0;
  const vht = useMemo(() => computeVht(volCm, volTd, volTp, volTpe), [volCm, volTd, volTp, volTpe]);

  const onSubmit = (data: FormData) => {
    const enseignant = ENSEIGNANTS.find((e) => e.id === data.responsableId);
    upsertEc(
      {
        code: data.code.toUpperCase().trim(),
        libelle: data.libelle.trim(),
        abrege: data.abrege.trim().toUpperCase() || undefined,
        ueId: data.ueId,
        coeff: data.coeff,
        credits: 0,
        volCm: data.volCm || 0,
        volTd: data.volTd || 0,
        volTp: data.volTp || 0,
        volTpe: data.volTpe || 0,
        responsable: enseignant ? `${enseignant.prenom} ${enseignant.nom}` : "",
        responsableId: data.responsableId || undefined,
      },
      id,
    );
    setLocation("/admin/ecs");
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "EC", href: "/admin/ecs" }, { label: isEdit ? "Modifier" : "Nouvel" }]}
        title={isEdit ? "Modifier l'Élément Constitutif" : "Nouvel Élément Constitutif (EC)"}
        subtitle="Volumes horaires LMD : CM, TD, TP, TPE et VHT calculé automatiquement"
        actions={
          <button onClick={() => setLocation("/admin/ecs")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code EC *</label>
              <input {...register("code", { required: "Code requis", minLength: { value: 2, message: "Minimum 2 caractères" } })} placeholder="ex: LPIG3511" className={`${inputClass} uppercase font-mono`} />
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">UE Parente *</label>
              <select {...register("ueId", { required: "UE parente requise" })} className={inputClass}>
                <option value="">Sélectionner une UE</option>
                {ues.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.libelle}</option>)}
              </select>
              {errors.ueId && <p className="text-xs text-red-500 mt-1">{errors.ueId.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Élément constitutif *</label>
              <input {...register("libelle", { required: "Libellé requis", minLength: { value: 3, message: "Minimum 3 caractères" } })} placeholder="ex: Concepts et fondamentaux de la POO Java" className={inputClass} />
              {errors.libelle && <p className="text-xs text-red-500 mt-1">{errors.libelle.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Intitulé abrégé</label>
              <input {...register("abrege")} placeholder="ex: ICPT" className={`${inputClass} uppercase font-mono`} />
            </div>

            <div className="col-span-2">
              <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wide">Enseignements (heures)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">CM</label>
                  <input {...register("volCm", { valueAsNumber: true, min: 0 })} type="number" min={0} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">TD</label>
                  <input {...register("volTd", { valueAsNumber: true, min: 0 })} type="number" min={0} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">TP</label>
                  <input {...register("volTp", { valueAsNumber: true, min: 0 })} type="number" min={0} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">TPE</label>
                  <input {...register("volTpe", { valueAsNumber: true, min: 0 })} type="number" min={0} className={inputClass} />
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Volume Horaire Total (VHT)</span>
                <span className="text-lg font-bold text-foreground">{vht} h</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">VHT = CM + TD + TP + TPE</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Coefficient</label>
              <input {...register("coeff", { valueAsNumber: true, min: 1 })} type="number" min={1} max={10} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Enseignant responsable</label>
              <select {...register("responsableId")} className={inputClass}>
                <option value="">Non assigné</option>
                {ENSEIGNANTS.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.specialite}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Save size={14} /> {isEdit ? "Enregistrer les modifications" : "Créer l'EC"}
            </button>
            <button type="button" onClick={() => setLocation("/admin/ecs")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}
