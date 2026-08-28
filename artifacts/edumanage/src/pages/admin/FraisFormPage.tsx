import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Save, Calendar } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { getFraisConfig, upsertFraisConfig } from "@/data/fraisConfigStore";
import { formatCFA } from "@/lib/utils";

const MOIS_SCOLARITE = ["Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin"];

interface FormData {
  filiereId: string;
  niveauId: string;
  annee: string;
  inscription: number;
  scolariteAnnuelle: number;
  fraisDivers: number;
}

interface Props { id?: string; }

export default function FraisFormPage({ id }: Props) {
  const [, setLocation] = useLocation();
  const isEdit = !!id;

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: { filiereId: "", niveauId: "", annee: "2025-2026", inscription: 150000, scolariteAnnuelle: 600000, fraisDivers: 50000 },
  });

  useEffect(() => {
    if (!isEdit || !id) return;
    const existing = getFraisConfig(id);
    if (!existing) {
      toast.error("Grille tarifaire introuvable");
      setLocation("/admin/frais");
      return;
    }
    const niveauRec = NIVEAUX.find((n) => n.filiereId === existing.filiereId && n.alias === existing.niveau);
    setValue("filiereId", existing.filiereId);
    setValue("niveauId", niveauRec?.id ?? "");
    setValue("annee", existing.annee);
    setValue("inscription", existing.inscription);
    setValue("scolariteAnnuelle", existing.scolariteAnnuelle);
    setValue("fraisDivers", existing.fraisDivers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  const selectedFiliereId = watch("filiereId");
  const filteredNiveaux = selectedFiliereId ? NIVEAUX.filter((n) => n.filiereId === selectedFiliereId) : NIVEAUX;

  const inscription = Number(watch("inscription")) || 0;
  const scolariteAnnuelle = Number(watch("scolariteAnnuelle")) || 0;
  const fraisDivers = Number(watch("fraisDivers")) || 0;
  const mensualite = scolariteAnnuelle > 0 ? Math.round(scolariteAnnuelle / 9) : 0;
  const totalAnnuel = inscription + scolariteAnnuelle + fraisDivers;

  const onSubmit = (data: FormData) => {
    const filiere = FILIERES.find((f) => f.id === data.filiereId);
    const niveauRec = NIVEAUX.find((n) => n.id === data.niveauId);
    if (!filiere || !niveauRec) {
      toast.error("Filière et niveau requis");
      return;
    }
    upsertFraisConfig({
      id: isEdit ? id : undefined,
      filiere: filiere.code,
      filiereId: filiere.id,
      niveau: niveauRec.alias,
      annee: data.annee,
      inscription: Number(data.inscription) || 0,
      scolariteAnnuelle: Number(data.scolariteAnnuelle) || 0,
      fraisDivers: Number(data.fraisDivers) || 0,
    });
    toast.success(isEdit ? "Grille tarifaire mise à jour" : "Grille tarifaire créée");
    setLocation("/admin/frais");
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Config. Frais", href: "/admin/frais" }, { label: isEdit ? "Modifier" : "Nouvelle grille" }]}
        title={isEdit ? "Modifier la grille tarifaire" : "Nouvelle grille tarifaire"}
        subtitle="Définissez les frais de scolarité échelonnés sur 9 mois"
        actions={
          <button onClick={() => setLocation("/admin/frais")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />
      <div className="max-w-3xl space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Identification</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
                <select {...register("filiereId", { required: "Filière requise" })} onChange={(e) => { setValue("filiereId", e.target.value); setValue("niveauId", ""); }} className={inputClass}>
                  <option value="">Sélectionner</option>
                  {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
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
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année académique *</label>
                <select {...register("annee")} className={inputClass}>
                  {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Montants</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Frais d'inscription (FCFA)</label>
                <input {...register("inscription", { valueAsNumber: true, min: 0 })} type="number" min={0} className={inputClass} />
                <p className="text-[10px] text-muted-foreground mt-1">Versé à l'inscription</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Scolarité annuelle (FCFA) *</label>
                <input {...register("scolariteAnnuelle", { required: "Scolarité requise", valueAsNumber: true, min: 0 })} type="number" min={0} className={inputClass} />
                <p className="text-[10px] text-muted-foreground mt-1">Étalée sur 9 mensualités</p>
                {errors.scolariteAnnuelle && <p className="text-xs text-red-500 mt-1">{errors.scolariteAnnuelle.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Frais divers (FCFA)</label>
                <input {...register("fraisDivers", { valueAsNumber: true, min: 0 })} type="number" min={0} className={inputClass} />
                <p className="text-[10px] text-muted-foreground mt-1">Bibliothèque, matériel, etc.</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Échéancier de scolarité sur 9 mois</h3>
              <span className="ml-auto text-xs text-muted-foreground font-mono">{formatCFA(mensualite)} / mois</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MOIS_SCOLARITE.map((mois, i) => (
                <div key={mois} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                  <div>
                    <p className="text-xs font-medium text-foreground">{mois}</p>
                    <p className="text-[10px] text-muted-foreground">Mensualité {i + 1}/9</p>
                  </div>
                  <span className="text-xs font-bold text-primary">{formatCFA(mensualite)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Inscription</p>
                <p className="font-bold text-foreground text-sm">{formatCFA(inscription)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scolarité (9 mois)</p>
                <p className="font-bold text-foreground text-sm">{formatCFA(scolariteAnnuelle)}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-xl">
                <p className="text-xs text-primary font-medium">Total annuel</p>
                <p className="font-bold text-primary text-sm">{formatCFA(totalAnnuel)}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Save size={14} /> {isEdit ? "Enregistrer les modifications" : "Créer la grille tarifaire"}
            </button>
            <button type="button" onClick={() => setLocation("/admin/frais")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}
