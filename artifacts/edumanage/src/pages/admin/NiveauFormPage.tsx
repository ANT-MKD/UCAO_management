import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES } from "@/data/mockData";
import { addNiveau, updateNiveau, getNiveauById } from "@/data/niveauStore";
import { useCycles } from "@/hooks/useAcademicSettingsStore";

interface FormData {
  nom: string;
  alias: string;
  cycleId: string;
  filiereId: string;
  passageConditionnelAutorise: boolean;
  creditDetteMin: number;
  creditsRequisEntree: number | "";
}

interface Props { id?: string; }

export default function NiveauFormPage({ id }: Props) {
  const [, setLocation] = useLocation();
  const isEdit = !!id;
  const existing = id ? getNiveauById(id) : undefined;
  const cycles = useCycles();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: existing
      ? {
          nom: existing.nom,
          alias: existing.alias,
          cycleId: existing.cycleId ?? cycles.find((c) => c.intitule === existing.cycle)?.id ?? "",
          filiereId: existing.filiereId,
          passageConditionnelAutorise: existing.passageConditionnelAutorise ?? false,
          creditDetteMin: existing.creditDetteMin ?? 0,
          creditsRequisEntree: existing.creditsRequisEntree ?? "",
        }
      : { nom: "", alias: "", cycleId: cycles[0]?.id ?? "", filiereId: "", passageConditionnelAutorise: false, creditDetteMin: 0, creditsRequisEntree: "" },
  });
  const passageConditionnelAutorise = watch("passageConditionnelAutorise");

  const onSubmit = (data: FormData) => {
    const cycle = cycles.find((c) => c.id === data.cycleId);
    const filiere = FILIERES.find((f) => f.id === data.filiereId);
    const payload = {
      nom: data.nom.trim(),
      alias: data.alias.trim().toUpperCase(),
      cycleId: data.cycleId || undefined,
      cycle: cycle?.intitule ?? "",
      filiereId: data.filiereId,
      filiere: filiere?.code ?? "",
      passageConditionnelAutorise: data.passageConditionnelAutorise,
      creditDetteMin: data.passageConditionnelAutorise ? Number(data.creditDetteMin) : undefined,
      creditsRequisEntree: data.creditsRequisEntree === "" ? undefined : Number(data.creditsRequisEntree),
    };
    if (isEdit && existing) {
      updateNiveau(existing.id, payload);
    } else {
      addNiveau(payload);
    }
    setLocation("/admin/niveaux");
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Niveaux", href: "/admin/niveaux" }, { label: isEdit ? "Modifier" : "Nouveau" }]}
        title={isEdit ? "Modifier le niveau" : "Nouveau niveau d'études"}
        subtitle="Configurez le cycle et la filière associée"
        actions={
          <button onClick={() => setLocation("/admin/niveaux")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom du niveau *</label>
              <input {...register("nom", { required: "Nom requis", minLength: { value: 2, message: "Minimum 2 caractères" } })} placeholder="ex: Licence 1" className={inputClass} />
              {errors.nom && <p className="text-xs text-red-500 mt-1">{errors.nom.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Alias *</label>
              <input {...register("alias", { required: "Alias requis", maxLength: { value: 8, message: "Maximum 8 caractères" } })} placeholder="ex: L1" className={`${inputClass} uppercase font-mono`} />
              {errors.alias && <p className="text-xs text-red-500 mt-1">{errors.alias.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cycle LMD *</label>
              <select {...register("cycleId", { required: "Cycle requis" })} className={inputClass}>
                <option value="">Sélectionner un cycle</option>
                {cycles.map((c) => <option key={c.id} value={c.id}>{c.intitule}</option>)}
              </select>
              {errors.cycleId && <p className="text-xs text-red-500 mt-1">{errors.cycleId.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
              <select {...register("filiereId", { required: "Filière requise" })} className={inputClass}>
                <option value="">Sélectionner une filière</option>
                {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
              </select>
              {errors.filiereId && <p className="text-xs text-red-500 mt-1">{errors.filiereId.message}</p>}
            </div>
          </div>

          <div className="pt-4 border-t border-border space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Passage vers le niveau supérieur</h3>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Crédits cumulés requis pour intégrer ce niveau</label>
              <input
                type="number" min={0} step={1} {...register("creditsRequisEntree")}
                placeholder="ex: 120 pour L3 — laisser vide si aucun contrôle"
                className={inputClass}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Si renseigné, l&apos;inscription à ce niveau est bloquée tant que l&apos;étudiant n&apos;a pas ce total de crédits validés sur son parcours (toutes années confondues).</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" {...register("passageConditionnelAutorise")} className="w-4 h-4 rounded border-border" />
              Autoriser le passage conditionnel (AJAC) depuis ce niveau
            </label>
            {passageConditionnelAutorise && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Crédits minimum pour le passage conditionnel</label>
                <input type="number" min={0} step={1} {...register("creditDetteMin")} placeholder="ex: 42 sur 60" className={inputClass} />
                <p className="text-[11px] text-muted-foreground mt-1">En dessous de ce seuil, l&apos;étudiant redouble ce niveau plutôt que de monter avec dette.</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Save size={14} /> {isEdit ? "Enregistrer les modifications" : "Créer le niveau"}
            </button>
            <button type="button" onClick={() => setLocation("/admin/niveaux")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}
