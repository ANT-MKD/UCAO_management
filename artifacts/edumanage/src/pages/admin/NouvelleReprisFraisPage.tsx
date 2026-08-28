import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useStudentStore } from "@/hooks/useStudentStore";
import { importerReprisFrais, getAncienCodesDejaImportes } from "@/data/reprisFraisStore";
import { parseReprisFraisFile, downloadReprisFraisTemplate, matchEtudiantParNom } from "@/lib/reprisFraisImport";

export default function NouvelleReprisFraisPage() {
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePickFile = (f: File) => {
    setFile(f);
    setFileName(f.name);
  };

  const handleSave = async () => {
    if (!file) {
      toast.error("Sélectionnez un fichier");
      return;
    }
    setLoading(true);
    try {
      const lignes = await parseReprisFraisFile(file);
      if (lignes.length === 0) {
        toast.error("Aucune ligne valide trouvée dans le fichier (colonnes attendues : ancien_code, nom, prenom, libelle_annee_scolaire, montant)");
        return;
      }
      const dejaImportes = getAncienCodesDejaImportes();
      const doublons = lignes.filter((l) => dejaImportes.has(l.ancienCode)).length;

      const enrichies = lignes.map((l) => {
        const etudiant = matchEtudiantParNom(l.nom, l.prenom, etudiants);
        return { ...l, etudiantId: etudiant?.id };
      });
      importerReprisFrais(enrichies);
      const nbAssocies = enrichies.filter((l) => l.etudiantId).length;
      toast.success(
        `${lignes.length} ligne(s) importée(s) — ${nbAssocies} étudiant(s) retrouvé(s) automatiquement` +
          (doublons > 0 ? `. ⚠ ${doublons} ancien(s) code(s) déjà importé(s) précédemment.` : ""),
      );
      setLocation("/admin/reprise-frais");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Reprise frais" }, { label: "Nouvelle reprise frais étudiant" }]}
        title="Importation reprise frais étudiant"
      />

      <div className="bg-card border border-border rounded-xl p-6 max-w-2xl" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
          <FileText size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Importation reprise frais étudiant</h3>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm text-muted-foreground w-24 flex-shrink-0">Fichier</label>
          <div className="flex-1 flex items-center gap-2">
            <input
              readOnly
              value={fileName}
              placeholder=""
              className="flex-1 px-3 py-2 text-sm border border-border rounded-l-xl bg-background"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-muted border border-border rounded-r-xl text-sm hover:bg-muted/70 transition-colors -ml-2"
              data-testid="reprise-frais-selectionner"
            >
              Sélectionner
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePickFile(f); }}
              data-testid="reprise-frais-fichier-input"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={downloadReprisFraisTemplate}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline mb-6"
        >
          <Download size={12} /> Télécharger le fichier modèle
        </button>

        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            data-testid="reprise-frais-sauvegarder"
          >
            {loading ? "Import…" : "Sauvegarder"}
          </button>
          <button onClick={() => setLocation("/admin/reprise-frais")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
