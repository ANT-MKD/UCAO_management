import { useState } from "react";
import { Plus, Trash2, Image as ImageIcon, Link2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { usePublicites } from "@/hooks/usePubliciteStore";
import {
  upsertPublicite,
  deletePublicite,
  TYPE_CONTENU_LABELS,
  PROFIL_CIBLE_LABELS,
  TAILLE_MAX_IMAGE_OCTETS,
  type PubliciteRecord,
  type TypeContenuPublicite,
  type ProfilCiblePublicite,
} from "@/data/publiciteStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatShortDate } from "@/lib/utils";

const TODAY = new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  typeContenu: "image" as TypeContenuPublicite,
  profilCible: "tous" as ProfilCiblePublicite,
  titre: "",
  description: "",
  ordre: 1,
  dateDebut: TODAY,
  dateFin: TODAY,
  imageDataUrl: "",
  lienExterne: "",
};

const LIEN_PLACEHOLDER: Record<TypeContenuPublicite, string> = {
  image: "",
  video: "https://www.youtube.com/watch?v=...",
  document: "https://drive.google.com/...",
  url: "https://...",
};

export default function PublicitesPage() {
  const { currentUser } = useAuth();
  const publicites = usePublicites();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  const estImage = form.typeContenu === "image";
  const peutSauvegarder = !!form.titre.trim() && !!form.dateDebut && !!form.dateFin && (estImage ? !!form.imageDataUrl : !!form.lienExterne.trim());

  const handleFichierImage = (file: File | undefined) => {
    if (!file) return;
    if (file.size > TAILLE_MAX_IMAGE_OCTETS) {
      toast.error(`Image trop lourde (max ${Math.round(TAILLE_MAX_IMAGE_OCTETS / 1024)} Ko).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, imageDataUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!currentUser || !peutSauvegarder) return;
    if (form.dateFin < form.dateDebut) {
      toast.error("La date de fin doit être postérieure à la date de début.");
      return;
    }
    upsertPublicite({
      typeContenu: form.typeContenu,
      profilCible: form.profilCible,
      titre: form.titre.trim(),
      description: form.description.trim(),
      ordre: form.ordre,
      dateDebut: form.dateDebut,
      dateFin: form.dateFin,
      imageDataUrl: estImage ? form.imageDataUrl : undefined,
      lienExterne: estImage ? undefined : form.lienExterne.trim(),
      auteurId: currentUser.id,
      auteurLabel: currentUser.name,
    });
    toast.success("Publicité enregistrée — visible sur les tableaux de bord ciblés dans sa fenêtre de dates.");
    setForm(EMPTY_FORM);
    setOpen(false);
  };

  const isActive = (p: PubliciteRecord) => p.dateDebut <= TODAY && TODAY <= p.dateFin;

  const columns: Column<Record<string, unknown>>[] = [
    { key: "titre", header: "Titre", sortable: true },
    { key: "typeContenu", header: "Type", render: (row) => TYPE_CONTENU_LABELS[(row as unknown as PubliciteRecord).typeContenu] },
    { key: "profilCible", header: "Profil cible", render: (row) => PROFIL_CIBLE_LABELS[(row as unknown as PubliciteRecord).profilCible] },
    { key: "ordre", header: "Ordre", sortable: true },
    {
      key: "periode",
      header: "Période de publication",
      render: (row) => {
        const p = row as unknown as PubliciteRecord;
        return <span className="text-xs">{formatShortDate(p.dateDebut)} → {formatShortDate(p.dateFin)}</span>;
      },
    },
    {
      key: "statut",
      header: "Statut",
      render: (row) => {
        const p = row as unknown as PubliciteRecord;
        return (
          <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", isActive(p) ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}>
            {isActive(p) ? "Active" : TODAY < p.dateDebut ? "À venir" : "Expirée"}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => {
        const p = row as unknown as PubliciteRecord;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); deletePublicite(p.id); toast.success("Publicité supprimée"); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-600"
            title="Supprimer"
            data-testid={`publicite-supprimer-${p.id}`}
          >
            <Trash2 size={14} />
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Communication" }, { label: "Publicité et actualité" }]}
        title="Publicités et actualités"
        subtitle="Diffusées en bannière sur les tableaux de bord, selon le profil cible et la fenêtre de dates"
        actions={
          <button onClick={() => { setForm(EMPTY_FORM); setOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors" data-testid="publicite-ajouter">
            <Plus size={14} /> Ajouter
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={publicites as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Titre..."
        emptyMessage="Aucune publicité ou actualité pour l'instant."
      />

      <FormModal open={open} onClose={() => setOpen(false)} title="Nouvelle publicité et actualité" size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type de contenu *</label>
            <select value={form.typeContenu} onChange={(e) => setForm((f) => ({ ...f, typeContenu: e.target.value as TypeContenuPublicite, imageDataUrl: "", lienExterne: "" }))} className={inputClass} data-testid="publicite-type">
              {(Object.keys(TYPE_CONTENU_LABELS) as TypeContenuPublicite[]).map((t) => <option key={t} value={t}>{TYPE_CONTENU_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Profil cible *</label>
            <select value={form.profilCible} onChange={(e) => setForm((f) => ({ ...f, profilCible: e.target.value as ProfilCiblePublicite }))} className={inputClass} data-testid="publicite-profil">
              {(Object.keys(PROFIL_CIBLE_LABELS) as ProfilCiblePublicite[]).map((p) => <option key={p} value={p}>{PROFIL_CIBLE_LABELS[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Titre *</label>
            <input value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} className={inputClass} data-testid="publicite-titre" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputClass + " min-h-[80px]"} data-testid="publicite-description" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Ordre *</label>
              <input type="number" min={1} value={form.ordre} onChange={(e) => setForm((f) => ({ ...f, ordre: Number(e.target.value) }))} className={inputClass} data-testid="publicite-ordre" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date début *</label>
              <input type="date" value={form.dateDebut} onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))} className={inputClass} data-testid="publicite-date-debut" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date fin *</label>
              <input type="date" value={form.dateFin} onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))} className={inputClass} data-testid="publicite-date-fin" />
            </div>
          </div>
          {estImage ? (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Image *</label>
              <label className="inline-flex items-center gap-2 text-xs text-primary cursor-pointer hover:underline">
                <ImageIcon size={13} />
                Choisir une image
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFichierImage(e.target.files?.[0])} data-testid="publicite-image-input" />
              </label>
              <p className="text-[11px] text-muted-foreground mt-1">Max {Math.round(TAILLE_MAX_IMAGE_OCTETS / 1024)} Ko — affichée réellement dans la bannière.</p>
              {form.imageDataUrl && (
                <img src={form.imageDataUrl} alt="Aperçu" className="mt-2 max-h-32 rounded-lg border border-border" data-testid="publicite-image-apercu" />
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Lien externe *</label>
              <div className="relative">
                <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={form.lienExterne}
                  onChange={(e) => setForm((f) => ({ ...f, lienExterne: e.target.value }))}
                  placeholder={LIEN_PLACEHOLDER[form.typeContenu]}
                  className={inputClass + " pl-9"}
                  data-testid="publicite-lien-externe"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Ressource hébergée ailleurs — ouverte dans un nouvel onglet depuis la bannière.</p>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={!peutSauvegarder}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
            data-testid="publicite-sauvegarder"
          >
            Sauvegarder
          </button>
        </div>
      </FormModal>
    </div>
  );
}
