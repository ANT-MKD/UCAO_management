import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Save, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, SEMESTRES } from "@/data/mockData";
import { getUeById, upsertUe } from "@/data/curriculumStore";
import { useUes } from "@/hooks/useCurriculumStore";
import { proposerCodeUe } from "@/lib/codesCurriculum";
import { useCategoriesCours } from "@/hooks/useAcademicSettingsStore";
import { RecordNotFound } from "@/components/admin/RecordNotFound";

const NON_OBLIGATOIRE = ["Libre", "Optionnelle"];

interface FormData {
  code: string;
  libelle: string;
  credits: number;
  filiereId: string;
  niveauId: string;
  semestreId: string;
  type: string;
  description?: string;
}

interface Props { id?: string; }

export default function UEFormPage({ id }: Props) {
  const [, setLocation] = useLocation();
  const isEdit = !!id;
  const existing = id ? getUeById(id) : undefined;
  const categories = useCategoriesCours();
  const ues = useUes();
  // Code proposé (filière + semestre + numéro suivant) tant que l'utilisateur ne l'a pas tapé.
  const [codeManuel, setCodeManuel] = useState(isEdit);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: existing
      ? {
          code: existing.code,
          libelle: existing.libelle,
          credits: existing.credits,
          filiereId: existing.filiereId,
          niveauId: NIVEAUX.find((n) => n.alias === existing.niveau && n.filiereId === existing.filiereId)?.id ?? "",
          // Le semestre « S1 » existe dans chaque filière : celui du niveau de cette UE.
          semestreId: SEMESTRES.find((s) => s.alias === existing.semestre && s.niveauId === NIVEAUX.find((n) => n.alias === existing.niveau && n.filiereId === existing.filiereId)?.id)?.id ?? "",
          type: existing.type,
          description: existing.description ?? "",
        }
      : {
          code: "",
          libelle: "",
          credits: 6,
          filiereId: "",
          niveauId: "",
          semestreId: "",
          type: categories[0]?.intitule ?? "Obligatoire",
          description: "",
        },
  });

  const selectedFiliereId = watch("filiereId");
  const filteredNiveaux = selectedFiliereId ? NIVEAUX.filter((n) => n.filiereId === selectedFiliereId) : NIVEAUX;
  const selectedNiveauId = watch("niveauId");
  const filteredSemestres = selectedNiveauId ? SEMESTRES.filter((s) => s.niveauId === selectedNiveauId) : SEMESTRES;

  const proposerCode = (semestreId: string) => {
    if (codeManuel) return;
    const filiere = FILIERES.find((f) => f.id === watch("filiereId"));
    const semestre = SEMESTRES.find((s) => s.id === semestreId);
    if (filiere && semestre) setValue("code", proposerCodeUe(filiere.code, semestre.alias, ues.map((u) => u.code)));
  };

  const onSubmit = (data: FormData) => {
    const filiere = FILIERES.find((f) => f.id === data.filiereId);
    const niveau = NIVEAUX.find((n) => n.id === data.niveauId);
    const semestre = SEMESTRES.find((s) => s.id === data.semestreId);
    upsertUe(
      {
        code: data.code.toUpperCase().trim(),
        libelle: data.libelle.trim(),
        credits: data.credits,
        filiere: filiere?.code ?? "",
        filiereId: data.filiereId,
        niveau: niveau?.alias ?? "",
        semestre: semestre?.alias ?? "",
        type: data.type,
        obligatoire: !NON_OBLIGATOIRE.includes(data.type),
        description: data.description,
      },
      id,
    );
    setLocation("/admin/ues");
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  if (isEdit && !existing) {
    return (
      <RecordNotFound
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "UE", href: "/admin/ues" }, { label: "Modifier" }]}
        title="Unité d'enseignement introuvable"
        message="Cette UE n'existe pas ou a été supprimée."
        backHref="/admin/ues"
        backLabel="Retour aux UE"
      />
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "UE", href: "/admin/ues" }, { label: isEdit ? "Modifier" : "Nouvelle" }]}
        title={isEdit ? "Modifier l'Unité d'Enseignement" : "Nouvelle Unité d'Enseignement (UE)"}
        subtitle="Modèle LMD : Code UE, libellé, crédits ECTS, caractère obligatoire/libre"
        actions={
          <button onClick={() => setLocation("/admin/ues")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />
      <div className="max-w-2xl">
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="u-e-form-champ-1" className="block text-xs font-medium text-muted-foreground mb-1.5">Code UE *</label>
              <input id="u-e-form-champ-1" {...register("code", { required: "Code requis", minLength: { value: 2, message: "Minimum 2 caractères" }, onChange: () => setCodeManuel(true) })} placeholder="Choisissez filière, niveau et semestre" className={`${inputClass} uppercase font-mono`} data-testid="ue-code" />
              {!codeManuel && <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Wand2 size={11} /> Proposé d&apos;après la filière et le semestre — modifiable</p>}
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <label htmlFor="u-e-form-champ-2" className="block text-xs font-medium text-muted-foreground mb-1.5">Crédits ECTS *</label>
              <input id="u-e-form-champ-2" {...register("credits", { required: "Crédits requis", valueAsNumber: true, min: { value: 1, message: "Minimum 1" }, max: { value: 30, message: "Maximum 30" } })} type="number" min={1} max={30} className={inputClass} />
              {errors.credits && <p className="text-xs text-red-500 mt-1">{errors.credits.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="u-e-form-champ-3" className="block text-xs font-medium text-muted-foreground mb-1.5">Unité d'enseignement *</label>
              <input id="u-e-form-champ-3" {...register("libelle", { required: "Libellé requis", minLength: { value: 3, message: "Minimum 3 caractères" } })} placeholder="ex: Génie logiciel 5" className={inputClass} />
              {errors.libelle && <p className="text-xs text-red-500 mt-1">{errors.libelle.message}</p>}
            </div>
            <div>
              <label htmlFor="u-e-form-champ-4" className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
              <select id="u-e-form-champ-4" {...register("filiereId", { required: "Filière requise" })} onChange={(e) => { setValue("filiereId", e.target.value); setValue("niveauId", ""); setValue("semestreId", ""); }} className={inputClass}>
                <option value="">Sélectionner</option>
                {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
              </select>
              {errors.filiereId && <p className="text-xs text-red-500 mt-1">{errors.filiereId.message}</p>}
            </div>
            <div>
              <label htmlFor="u-e-form-champ-5" className="block text-xs font-medium text-muted-foreground mb-1.5">Caractère *</label>
              <select id="u-e-form-champ-5" {...register("type", { required: "Caractère requis" })} className={inputClass}>
                {categories.map((c) => <option key={c.id} value={c.intitule}>{c.intitule}</option>)}
              </select>
              {errors.type && <p className="text-xs text-red-500 mt-1">{errors.type.message}</p>}
            </div>
            <div>
              <label htmlFor="u-e-form-champ-6" className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
              <select id="u-e-form-champ-6" {...register("niveauId", { required: "Niveau requis" })} onChange={(e) => { setValue("niveauId", e.target.value); setValue("semestreId", ""); }} className={inputClass}>
                <option value="">Sélectionner</option>
                {filteredNiveaux.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
              </select>
              {errors.niveauId && <p className="text-xs text-red-500 mt-1">{errors.niveauId.message}</p>}
            </div>
            <div>
              <label htmlFor="u-e-form-champ-7" className="block text-xs font-medium text-muted-foreground mb-1.5">Semestre *</label>
              <select id="u-e-form-champ-7" {...register("semestreId", { required: "Semestre requis", onChange: (e) => proposerCode(e.target.value) })} className={inputClass} data-testid="ue-semestre">
                <option value="">Sélectionner</option>
                {filteredSemestres.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
              </select>
              {errors.semestreId && <p className="text-xs text-red-500 mt-1">{errors.semestreId.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="u-e-form-champ-8" className="block text-xs font-medium text-muted-foreground mb-1.5">Description (optionnel)</label>
              <textarea id="u-e-form-champ-8" {...register("description")} rows={3} placeholder="Objectifs pédagogiques..." className={`${inputClass} resize-none`} />
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Save size={14} /> {isEdit ? "Enregistrer les modifications" : "Créer l'UE"}
            </button>
            <button type="button" onClick={() => setLocation("/admin/ues")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}
