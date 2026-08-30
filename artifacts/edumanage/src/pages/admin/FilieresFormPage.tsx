import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { addFiliere, updateFiliere, getFiliereById } from "@/data/filiereStore";
import { useCycles, useEntites } from "@/hooks/useAcademicSettingsStore";
import { cn } from "@/lib/utils";

interface FormData {
  nom: string;
  code: string;
  responsableId: string;
  statut: "actif" | "inactif";
  cycleId: string;
  entiteId: string;
  typeProgramme: "semestriel" | "annuel";
  specialite: string;
  informationsComplementaires: string;
}

interface FilieresFormPageProps { id?: string; }

export default function FilieresFormPage({ id }: FilieresFormPageProps) {
  const [, setLocation] = useLocation();
  const isEdit = !!id;
  const existing = id ? getFiliereById(id) : undefined;
  const cycles = useCycles();
  const entites = useEntites();
  const [anneesActives, setAnneesActives] = useState<string[]>(existing?.anneesActives ?? []);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: existing
      ? {
          nom: existing.nom,
          code: existing.code,
          responsableId: existing.responsableId ?? "",
          statut: existing.statut,
          cycleId: existing.cycleId ?? "",
          entiteId: existing.entiteId ?? "",
          typeProgramme: existing.typeProgramme ?? "semestriel",
          specialite: existing.specialite ?? "",
          informationsComplementaires: existing.informationsComplementaires ?? "",
        }
      : { nom: "", code: "", responsableId: "", statut: "actif", cycleId: "", entiteId: "", typeProgramme: "semestriel", specialite: "", informationsComplementaires: "" },
  });

  const onSubmit = (data: FormData) => {
    const enseignant = ENSEIGNANTS.find((e) => e.id === data.responsableId);
    const cycle = cycles.find((c) => c.id === data.cycleId);
    const entite = entites.find((e) => e.id === data.entiteId);
    const payload = {
      nom: data.nom.trim(),
      code: data.code.toUpperCase().trim(),
      responsable: enseignant ? `${enseignant.prenom} ${enseignant.nom}` : "",
      responsableId: data.responsableId || undefined,
      statut: data.statut,
      cycleId: data.cycleId || undefined,
      cycle: cycle?.intitule,
      entiteId: data.entiteId || undefined,
      entite: entite?.intitule,
      typeProgramme: data.typeProgramme,
      anneesActives,
      specialite: data.specialite.trim() || undefined,
      informationsComplementaires: data.informationsComplementaires.trim() || undefined,
    };
    if (isEdit && existing) {
      updateFiliere(existing.id, payload);
    } else {
      addFiliere({ ...payload, nbClasses: 0, nbEtudiants: 0 });
    }
    setLocation("/admin/filieres");
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Filières", href: "/admin/filieres" }, { label: isEdit ? "Modifier" : "Nouvelle" }]}
        title={isEdit ? "Modifier la filière" : "Nouvelle filière"}
        subtitle="Configurez le programme, son cycle, son entité de rattachement et son responsable pédagogique"
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
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cycle</label>
              <select {...register("cycleId")} className={inputClass}>
                <option value="">— Non défini —</option>
                {cycles.map((c) => <option key={c.id} value={c.id}>{c.intitule}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type de programme</label>
              <select {...register("typeProgramme")} className={inputClass}>
                <option value="semestriel">Semestriel</option>
                <option value="annuel">Annuel</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Entité de rattachement</label>
              <select {...register("entiteId")} className={inputClass}>
                <option value="">— Non rattachée —</option>
                {entites.map((e) => <option key={e.id} value={e.id}>{e.intitule}</option>)}
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
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Années scolaires actives</label>
              <div className="flex flex-wrap gap-2">
                {ANNEES_ACADEMIQUES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAnneesActives((prev) => (prev.includes(a.libelle) ? prev.filter((x) => x !== a.libelle) : [...prev, a.libelle]))}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                      anneesActives.includes(a.libelle) ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {a.libelle}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Spécialité (optionnel)</label>
              <input {...register("specialite")} placeholder="Laisser vide si aucune spécialité définie" className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Informations complémentaires</label>
              <textarea {...register("informationsComplementaires")} rows={3} placeholder="Objectifs de la filière, débouchés..." className={`${inputClass} resize-none`} />
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
