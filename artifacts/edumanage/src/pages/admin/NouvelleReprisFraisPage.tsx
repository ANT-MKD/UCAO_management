import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { FileText, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useStudentStore } from "@/hooks/useStudentStore";
import { importerReprisFrais, getAncienCodesDejaImportes, type NouvelleReprisLigne } from "@/data/reprisFraisStore";
import { parseReprisFraisFile, downloadReprisFraisTemplate, matchEtudiantParNom } from "@/lib/reprisFraisImport";
import { formatCFA, cn } from "@/lib/utils";

interface PreviewLigne extends NouvelleReprisLigne {
  key: string;
  doublon: boolean;
}

export default function NouvelleReprisFraisPage() {
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PreviewLigne[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePickFile = async (file: File) => {
    setFileName(file.name);
    setParsing(true);
    setPreview(null);
    try {
      const lignes = await parseReprisFraisFile(file);
      if (lignes.length === 0) {
        toast.error("Aucune ligne valide trouvée dans le fichier (colonnes attendues : ancien_code, nom, prenom, libelle_annee_scolaire, montant)");
        return;
      }
      const dejaImportes = getAncienCodesDejaImportes();
      const enrichies: PreviewLigne[] = lignes.map((l, i) => {
        const etudiant = matchEtudiantParNom(l.nom, l.prenom, etudiants);
        return { ...l, key: `p-${i}`, etudiantId: etudiant?.id, doublon: dejaImportes.has(l.ancienCode) };
      });
      setPreview(enrichies);
    } finally {
      setParsing(false);
    }
  };

  const updateAssociation = (key: string, etudiantId: string) => {
    setPreview((prev) => (prev ? prev.map((l) => (l.key === key ? { ...l, etudiantId } : l)) : prev));
  };

  const nbAssocies = preview ? preview.filter((l) => l.etudiantId).length : 0;
  const nbDoublons = preview ? preview.filter((l) => l.doublon).length : 0;

  const handleSave = () => {
    if (!preview || preview.length === 0) {
      toast.error("Sélectionnez d'abord un fichier à importer");
      return;
    }
    setSaving(true);
    try {
      importerReprisFrais(preview.map(({ key, doublon, ...rest }) => rest));
      toast.success(
        `${preview.length} ligne(s) importée(s) — ${nbAssocies} étudiant(s) déjà associé(s)` +
          (nbDoublons > 0 ? `. ⚠ ${nbDoublons} ancien(s) code(s) déjà importé(s) précédemment.` : ""),
      );
      setLocation("/admin/reprise-frais");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Reprise frais" }, { label: "Nouvelle reprise frais étudiant" }]}
        title="Importation reprise frais étudiant"
      />

      <div className="bg-card border border-border rounded-xl p-6 max-w-3xl" style={{ boxShadow: "var(--shadow-sm)" }}>
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

        {parsing && <p className="text-sm text-muted-foreground mb-4">Analyse du fichier…</p>}

        {preview && preview.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3 text-xs">
              <span className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full font-medium", nbAssocies === preview.length ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                <CheckCircle2 size={12} /> {nbAssocies}/{preview.length} associé(s)
              </span>
              {nbDoublons > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-medium bg-red-50 text-red-700">
                  <AlertTriangle size={12} /> {nbDoublons} déjà importé(s) précédemment
                </span>
              )}
            </div>
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-3 py-2">Ancien code</th>
                    <th className="text-left px-3 py-2">Nom</th>
                    <th className="text-left px-3 py-2">Prénom</th>
                    <th className="text-left px-3 py-2">Année</th>
                    <th className="text-right px-3 py-2">Montant</th>
                    <th className="text-left px-3 py-2">Étudiant</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((l) => {
                    const matched = etudiants.find((e) => e.id === l.etudiantId);
                    return (
                      <tr key={l.key} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-xs">{l.ancienCode}{l.doublon && <span className="ml-1 text-red-600" title="Déjà importé précédemment">⚠</span>}</td>
                        <td className="px-3 py-2">{l.nom}</td>
                        <td className="px-3 py-2">{l.prenom}</td>
                        <td className="px-3 py-2">{l.libelleAnneeScolaire}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCFA(l.montant)}</td>
                        <td className="px-3 py-2">
                          {matched ? (
                            <span className="text-xs text-emerald-700">{matched.matricule} - {matched.prenom} {matched.nom}</span>
                          ) : (
                            <select
                              className="px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                              defaultValue=""
                              onChange={(e) => updateAssociation(l.key, e.target.value)}
                              data-testid={`reprise-frais-preview-associer-${l.key}`}
                            >
                              <option value="" disabled>Associer un étudiant…</option>
                              {[...etudiants].sort((a, b) => a.nom.localeCompare(b.nom)).map((e) => (
                                <option key={e.id} value={e.id}>{e.matricule} - {e.prenom} {e.nom}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            onClick={handleSave}
            disabled={saving || !preview || preview.length === 0}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="reprise-frais-sauvegarder"
          >
            {saving ? "Import…" : "Sauvegarder"}
          </button>
          <button onClick={() => setLocation("/admin/reprise-frais")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
