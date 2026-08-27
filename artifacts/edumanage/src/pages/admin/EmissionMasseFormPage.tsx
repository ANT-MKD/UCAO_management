import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES, FRAIS_CONFIG } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { useStudentStore } from "@/hooks/useStudentStore";
import { addEmissionMasse } from "@/data/emissionMasseStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA } from "@/lib/utils";

const ANNEE_OPTIONS = [...ANNEES_ACADEMIQUES].sort((a, b) => b.libelle.localeCompare(a.libelle));
const DEFAULT_ANNEE = ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEE_OPTIONS[0]?.libelle ?? "2025-2026";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function EmissionMasseFormPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const classes = useClasses();
  const etudiants = useStudentStore();

  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState(DEFAULT_ANNEE);
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [dateEcheance, setDateEcheance] = useState(todayPlus(0));
  const [dateLimite, setDateLimite] = useState(todayPlus(30));
  const [commentaire, setCommentaire] = useState("");

  const filteredNiveaux = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const filteredClasses = useMemo(() => {
    const niveau = NIVEAUX.find((n) => n.id === niveauId);
    if (!filiereId || !niveau) return [];
    return classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau.alias && c.annee === annee);
  }, [classes, filiereId, niveauId, annee]);

  const selectedClasse = filteredClasses.find((c) => c.id === classeId) ?? null;
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const grille = FRAIS_CONFIG.find((f) => f.filiereId === filiereId && f.niveau === niveau?.alias && f.annee === annee);
  const effectif = selectedClasse ? etudiants.filter((e) => e.classeId === selectedClasse.id && e.statut !== "suspendu").length : 0;

  const handleFiliereChange = (id: string) => {
    setFiliereId(id);
    setNiveauId("");
    setClasseId("");
  };

  const handleNiveauChange = (id: string) => {
    setNiveauId(id);
    setClasseId("");
  };

  const handleAnneeChange = (v: string) => {
    setAnnee(v);
    setClasseId("");
  };

  const handleSubmit = () => {
    if (!filiereId || !niveauId || !classeId) {
      toast.error("Sélectionnez la filière, le niveau et la classe");
      return;
    }
    if (!dateEcheance || !dateLimite) {
      toast.error("Indiquez la date d'échéance et la date limite");
      return;
    }
    if (effectif === 0) {
      toast.error("Aucun étudiant actif dans cette classe");
      return;
    }

    const filiere = FILIERES.find((f) => f.id === filiereId);

    const record = addEmissionMasse({
      filiereId,
      filiere: filiere?.nom ?? "",
      annee,
      niveauId,
      niveau: niveau?.alias ?? "",
      classeId,
      classe: selectedClasse?.nom ?? "",
      dateEcheance,
      dateLimite,
      commentaire,
      emisPar: currentUser?.name ?? "Administration",
    });

    toast.success(`Émission ${record.reference} générée pour ${effectif} étudiant(s)`);
    setLocation(`/admin/emissions-masse/${record.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "Émission en masse", href: "/admin/emissions-masse" },
          { label: "Nouvelle émission" },
        ]}
        title="Nouvelle émission en masse"
        subtitle="Génère une quittance pour chaque étudiant actif de la classe sélectionnée, selon la grille tarifaire en vigueur"
      />

      <div className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Filière <span className="text-red-500">*</span>
            </label>
            <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="emm-filiere">
              <option value="">Sélectionner…</option>
              {FILIERES.filter((f) => f.statut === "actif").map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Année <span className="text-red-500">*</span>
              </label>
              <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} className={inputClass} data-testid="emm-annee">
                {ANNEE_OPTIONS.map((a) => (
                  <option key={a.id} value={a.libelle}>
                    {a.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Niveau <span className="text-red-500">*</span>
              </label>
              <select
                value={niveauId}
                onChange={(e) => handleNiveauChange(e.target.value)}
                className={inputClass}
                disabled={!filiereId}
                data-testid="emm-niveau"
              >
                <option value="">Sélectionner…</option>
                {filteredNiveaux.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Classe <span className="text-red-500">*</span>
          </label>
          <select
            value={classeId}
            onChange={(e) => setClasseId(e.target.value)}
            className={inputClass}
            disabled={!niveauId}
            data-testid="emm-classe"
          >
            <option value="">Sélectionner…</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom} ({c.inscrits} inscrits)
              </option>
            ))}
          </select>
          {niveauId && filteredClasses.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">Aucune classe pour ce niveau sur l&apos;année {annee}.</p>
          )}
        </div>

        {selectedClasse && (
          <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>
              <strong>{effectif}</strong> étudiant(s) actif(s) recevront une quittance de{" "}
              <strong>{grille ? formatCFA(grille.scolariteAnnuelle) : "0 FCFA"}</strong> (Scolarité annuelle)
            </span>
            {!grille && <span className="text-amber-600 text-xs">Aucune grille tarifaire configurée pour ce niveau/année.</span>}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Date échéance <span className="text-red-500">*</span>
            </label>
            <input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Date limite <span className="text-red-500">*</span>
            </label>
            <input type="date" value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Commentaire</label>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Précisions à l'attention des étudiants ou de la comptabilité…"
          />
        </div>

        <div className="flex flex-wrap gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={() => setLocation("/admin/emissions-masse")}
            className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="emm-submit"
          >
            <Send size={15} /> Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
