import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Save, Monitor, Building2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  EQUIPEMENTS_PEDAGOGIQUES,
  getSalleById,
  upsertSalle,
} from "@/data/structureStore";

const TYPES_SALLE = ["Amphithéâtre", "Salle de cours", "Laboratoire", "Salle TD", "Bibliothèque", "Salle de conférence"];
const BATIMENTS = ["Bloc A", "Bloc B", "Bloc C", "Bloc D", "Bâtiment central"];

interface FormData {
  nom: string;
  type: string;
  capacite: number;
  batiment: string;
  etage?: string;
  statut: "actif" | "en_maintenance" | "inactif";
}

interface Props { id?: string; }

export default function SalleFormPage({ id }: Props) {
  const [, setLocation] = useLocation();
  const isEdit = !!id;
  const existing = id ? getSalleById(id) : undefined;
  const [selectedEquip, setSelectedEquip] = useState<string[]>(existing?.equipements ?? []);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: existing
      ? {
          nom: existing.nom,
          type: existing.type,
          capacite: existing.capacite,
          batiment: existing.batiment,
          etage: existing.etage,
          statut: existing.statut,
        }
      : { nom: "", type: "Salle de cours", capacite: 40, batiment: "Bloc A", etage: "RDC", statut: "actif" },
  });

  const toggleEquip = (eq: string) =>
    setSelectedEquip((prev) => (prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]));

  const onSubmit = (data: FormData) => {
    upsertSalle(
      {
        nom: data.nom,
        type: data.type,
        capacite: data.capacite,
        batiment: data.batiment,
        etage: data.etage,
        equipements: selectedEquip,
        statut: data.statut,
      },
      id,
    );
    setLocation("/admin/salles");
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Salles physiques", href: "/admin/salles" }, { label: isEdit ? "Modifier" : "Nouvelle" }]}
        title={isEdit ? "Modifier la salle physique" : "Nouvelle salle physique"}
        subtitle="Local physique (ex. RDC 1A) — nom stable ; matériel pédagogique uniquement"
        actions={
          <button onClick={() => setLocation("/admin/salles")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
            Wifi, climatisation et sonorisation sont considérés comme implicites — seuls le matériel pédagogique est listé.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom / code de la salle *</label>
              <input {...register("nom", { required: "Nom requis" })} placeholder="ex: RDC 1A, Amphi A, Labo Info 1" className={inputClass} />
              {errors.nom && <p className="text-xs text-red-500 mt-1">{errors.nom.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type *</label>
              <select {...register("type")} className={inputClass}>
                {TYPES_SALLE.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Capacité *</label>
              <input {...register("capacite", { required: true, valueAsNumber: true, min: 1 })} type="number" min={1} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Bâtiment *</label>
              <select {...register("batiment")} className={inputClass}>
                {BATIMENTS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Étage</label>
              <input {...register("etage")} placeholder="ex: RDC, 1er, 2ème" className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut *</label>
              <select {...register("statut")} className={inputClass}>
                <option value="actif">Disponible</option>
                <option value="en_maintenance">En maintenance</option>
                <option value="inactif">Hors service</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-2">Matériel pédagogique</label>
              <div className="flex flex-wrap gap-2">
                {EQUIPEMENTS_PEDAGOGIQUES.map((eq) => {
                  const active = selectedEquip.includes(eq);
                  return (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => toggleEquip(eq)}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border-2 transition-all ${active ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >
                      {eq.includes("Ordinateur") || eq.includes("Écran") || eq.includes("Vidéo") ? <Monitor size={12} /> : <Building2 size={12} />}
                      {eq}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              <Save size={14} /> {isEdit ? "Enregistrer" : "Créer la salle"}
            </button>
            <button type="button" onClick={() => setLocation("/admin/salles")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}
