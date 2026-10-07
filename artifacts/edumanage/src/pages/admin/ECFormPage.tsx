import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { ArrowLeft, Save, Wand2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { computeVht, getEcById, upsertEc } from "@/data/curriculumStore";
import { useUes, useEcs } from "@/hooks/useCurriculumStore";
import { useTeachers } from "@/hooks/useTeacherStore";
import { RecordNotFound } from "@/components/admin/RecordNotFound";
import { cn } from "@/lib/utils";
import { RechercheSelect, type OptionRecherche } from "@/components/admin/RechercheSelect";
import { proposerCodeEc, abregerIntitule } from "@/lib/codesCurriculum";

interface FormData {
  code: string;
  libelle: string;
  abrege: string;
  ueId: string;
  credits: number;
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
  const ecs = useEcs();
  const enseignants = useTeachers();
  const existing = id ? getEcById(id) : undefined;
  // « Ajouter un EC » depuis la liste des UE : l'UE parente arrive déjà choisie.
  const ueDepuisUrl = new URLSearchParams(useSearch()).get("ue") ?? "";
  // Code et intitulé abrégé proposés automatiquement tant que l'utilisateur ne les a pas tapés.
  const [codeManuel, setCodeManuel] = useState(isEdit);
  const [abregeManuel, setAbregeManuel] = useState(isEdit);

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormData>({
    defaultValues: existing
      ? {
          code: existing.code,
          libelle: existing.libelle,
          abrege: existing.abrege ?? "",
          ueId: existing.ueId,
          credits: existing.credits ?? 0,
          volCm: existing.volCm,
          volTd: existing.volTd,
          volTp: existing.volTp,
          volTpe: existing.volTpe,
          responsableId: existing.responsableId ?? "",
        }
      : {
          code: ueDepuisUrl ? proposerCodeEc(ues.find((u) => u.id === ueDepuisUrl)?.code ?? "", ecs.map((e) => e.code)) : "",
          libelle: "",
          abrege: "",
          ueId: ues.some((u) => u.id === ueDepuisUrl) ? ueDepuisUrl : "",
          credits: 0,
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

  const optionsUe: OptionRecherche[] = useMemo(() => ues.map((u) => ({
    value: u.id, label: `${u.code} — ${u.libelle}`, hint: [u.filiere, u.niveau, u.semestre].filter(Boolean).join(" · "),
  })), [ues]);
  const optionsEnseignants: OptionRecherche[] = useMemo(() => enseignants.map((e) => ({
    value: e.id, label: `${e.prenom} ${e.nom}`, hint: [e.matricule, e.specialite].filter(Boolean).join(" · "), motsCles: e.email,
  })), [enseignants]);

  const ueId = watch("ueId");
  const ue = ues.find((u) => u.id === ueId);
  const credits = Number(watch("credits")) || 0;
  // Contrôle des crédits : les EC d'une UE ne doivent pas dépasser les crédits de l'UE.
  const autresEcs = ue ? ecs.filter((e) => e.ueId === ue.id && e.id !== id) : [];
  const sommeCredits = autresEcs.reduce((s, e) => s + (e.credits || 0), 0) + credits;

  const choisirUe = (nouvelle: string) => {
    setValue("ueId", nouvelle, { shouldValidate: true });
    const u = ues.find((x) => x.id === nouvelle);
    if (u && !codeManuel) setValue("code", proposerCodeEc(u.code, ecs.filter((e) => e.id !== id).map((e) => e.code)));
  };

  const onSubmit = (data: FormData) => {
    const enseignant = enseignants.find((e) => e.id === data.responsableId);
    upsertEc(
      {
        code: data.code.toUpperCase().trim(),
        libelle: data.libelle.trim(),
        abrege: data.abrege.trim().toUpperCase() || undefined,
        ueId: data.ueId,
        credits: Number(data.credits) || 0,
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

  if (isEdit && !existing) {
    return (
      <RecordNotFound
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "EC", href: "/admin/ecs" }, { label: "Modifier" }]}
        title="Élément constitutif introuvable"
        message="Cet EC n'existe pas ou a été supprimé."
        backHref="/admin/ecs"
        backLabel="Retour aux EC"
      />
    );
  }

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code EC *</label>
              <input {...register("code", { required: "Code requis", minLength: { value: 2, message: "Minimum 2 caractères" }, onChange: () => setCodeManuel(true) })} placeholder="ex: LPIG3511" className={`${inputClass} uppercase font-mono`} data-testid="ec-code" />
              {!codeManuel && ue && <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Wand2 size={11} /> Proposé d&apos;après l&apos;UE — modifiable</p>}
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">UE Parente *</label>
              <Controller
                name="ueId"
                control={control}
                rules={{ required: "UE parente requise" }}
                render={({ field }) => (
                  <RechercheSelect options={optionsUe} value={field.value} onChange={choisirUe} placeholder="Tapez un code, un intitulé ou une filière…" invalide={!!errors.ueId} testId="ec-ue" />
                )}
              />
              {errors.ueId && <p className="text-xs text-red-500 mt-1">{errors.ueId.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Élément constitutif *</label>
              <input {...register("libelle", { required: "Libellé requis", minLength: { value: 3, message: "Minimum 3 caractères" }, onChange: (e) => { if (!abregeManuel) setValue("abrege", abregerIntitule(e.target.value)); } })} placeholder="ex: Concepts et fondamentaux de la POO Java" className={inputClass} data-testid="ec-libelle" />
              {errors.libelle && <p className="text-xs text-red-500 mt-1">{errors.libelle.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Intitulé abrégé</label>
              <input {...register("abrege", { onChange: () => setAbregeManuel(true) })} placeholder="ex: ICPT" className={`${inputClass} uppercase font-mono`} data-testid="ec-abrege" />
              {!abregeManuel && <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Wand2 size={11} /> Proposé d&apos;après l&apos;intitulé — modifiable</p>}
            </div>

            <div className="sm:col-span-2">
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
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Crédits de l&apos;EC</label>
              <input {...register("credits", { valueAsNumber: true, min: 0 })} type="number" min={0} step={0.5} className={inputClass} data-testid="ec-credits" />
              {ue && (
                <p className={cn("text-[11px] mt-1", sommeCredits > ue.credits ? "text-amber-700" : "text-muted-foreground")} data-testid="ec-controle-credits">
                  {sommeCredits > ue.credits && <AlertTriangle size={11} className="inline mr-1 -mt-0.5" />}
                  EC de l&apos;UE : {sommeCredits} crédit(s) sur {ue.credits}{sommeCredits > ue.credits ? " — dépasse les crédits de l'UE" : ""}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Enseignant responsable</label>
              <Controller
                name="responsableId"
                control={control}
                render={({ field }) => (
                  <RechercheSelect options={optionsEnseignants} value={field.value} onChange={field.onChange} placeholder="Tapez un nom, un matricule ou une spécialité…" aucunLabel="Non assigné" testId="ec-enseignant" />
                )}
              />
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
