import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { FILIERES, NIVEAUX, SEMESTRES } from "@/data/mockData";
import { importCurriculumRows } from "@/data/curriculumStore";
import { downloadCurriculumTemplate, parseCurriculumExcel } from "@/lib/curriculumImport";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function CurriculumImportButton({ className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [filiereId, setFiliereId] = useState("f1");
  const [niveauId, setNiveauId] = useState("");
  const [semestreId, setSemestreId] = useState("");

  const niveaux = NIVEAUX.filter((n) => n.filiereId === filiereId);
  const semestres = SEMESTRES.filter((s) => !niveauId || s.niveauId === niveauId);

  const handleFile = async (file: File) => {
    setLoading(true);
    setMessage("");
    try {
      const rows = await parseCurriculumExcel(file);
      if (rows.length === 0) {
        setMessage("Aucune ligne valide trouvée dans le fichier.");
        return;
      }
      const filiere = FILIERES.find((f) => f.id === filiereId);
      const niveau = NIVEAUX.find((n) => n.id === niveauId);
      const semestre = SEMESTRES.find((s) => s.id === semestreId);
      const result = importCurriculumRows(rows, {
        filiere: filiere?.code ?? "LPIG",
        filiereId,
        niveau: niveau?.alias ?? "L3",
        semestre: semestre?.alias ?? rows[0]?.semestre ?? "S5",
      });
      setMessage(`Import réussi : ${result.ueCount} UE créée(s), ${result.ecCount} EC importé(s).`);
    } catch (err) {
      console.error(err);
      setMessage("Échec de l'import. Vérifiez le format du fichier Excel.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors",
          className,
        )}
      >
        <FileSpreadsheet size={15} /> Importer via Excel
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-foreground mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>
              Import programme UE / EC
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Importez un fichier Excel (.xlsx) au format du programme LMD (Code UE, EC, CM, TD, TP, TPE, VHT, Crédits).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Filière par défaut</label>
                <select
                  value={filiereId}
                  onChange={(e) => { setFiliereId(e.target.value); setNiveauId(""); setSemestreId(""); }}
                  className="w-full px-2.5 py-2 text-sm border border-border rounded-xl bg-background"
                >
                  {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Niveau</label>
                <select
                  value={niveauId}
                  onChange={(e) => { setNiveauId(e.target.value); setSemestreId(""); }}
                  className="w-full px-2.5 py-2 text-sm border border-border rounded-xl bg-background"
                >
                  <option value="">Auto</option>
                  {niveaux.map((n) => <option key={n.id} value={n.id}>{n.alias}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">Semestre</label>
                <select
                  value={semestreId}
                  onChange={(e) => setSemestreId(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm border border-border rounded-xl bg-background"
                >
                  <option value="">Depuis fichier</option>
                  {semestres.map((s) => <option key={s.id} value={s.id}>{s.alias}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={downloadCurriculumTemplate}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted"
              >
                <Download size={14} /> Télécharger le modèle
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm hover:bg-primary/90 disabled:opacity-60"
              >
                <Upload size={14} /> {loading ? "Import..." : "Choisir un fichier"}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </div>

            {message && (
              <div className="mb-4 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                {message}
              </div>
            )}

            <div className="text-[11px] text-muted-foreground mb-4 space-y-1">
              <p>Colonnes attendues : Code UE, Unité d'enseignement, Code EC, Élément constitutif, CM, TD, TP, TPE, VHT, Crédits, Semestre, Obligatoire.</p>
              <p>Les crédits sont au niveau UE. Plusieurs lignes EC peuvent partager le même Code UE.</p>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
