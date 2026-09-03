import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { resetTestData } from "@/lib/dataReset";

const PHRASE_CONFIRMATION = "REINITIALISER";

const DONNEES_SUPPRIMEES = [
  "Étudiants, inscriptions, notes, relevés, délibérations, attestations",
  "Paiements, quittances, décomptes, devis, encaissements, exports comptables",
  "Enseignants, vacations, contrats, pointages",
  "Filières, niveaux, semestres, classes, salles, UE/EC (maquettes)",
  "Communications envoyées (mails, publicités, notifications, journal d'audit)",
  "Comptes utilisateurs autres que le vôtre",
];

const DONNEES_CONSERVEES = [
  "Les 6 pages Paramétrage (académique, finances, scolarité, emploi du temps, communication, bulletins)",
  "Rôles et infos établissement",
  "Réglages d'accès (portails, fonctionnalités, signature, motifs de blocage)",
  "Votre compte administrateur actuel",
];

export default function DataResetPage() {
  const { currentUser } = useAuth();
  const [phrase, setPhrase] = useState("");
  const [resetting, setResetting] = useState(false);

  const peutConfirmer = phrase.trim().toUpperCase() === PHRASE_CONFIRMATION;

  const handleReset = () => {
    if (!currentUser || !peutConfirmer) return;
    setResetting(true);
    try {
      resetTestData(currentUser.id);
    } catch {
      toast.error("La réinitialisation a échoué.");
      setResetting(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Réinitialisation des données" }]}
        title="Réinitialisation des données"
        subtitle="Vider les données opérationnelles de test en conservant le paramétrage"
      />

      <div className="max-w-2xl space-y-5">
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-3">
          <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Action irréversible. Toutes les données listées ci-dessous seront définitivement supprimées de ce navigateur.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">Sera supprimé</p>
            <ul className="space-y-2">
              {DONNEES_SUPPRIMEES.map((d) => (
                <li key={d} className="text-xs text-muted-foreground flex gap-2">
                  <span className="text-red-500 flex-shrink-0">✕</span>{d}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-3">Sera conservé</p>
            <ul className="space-y-2">
              {DONNEES_CONSERVEES.map((d) => (
                <li key={d} className="text-xs text-muted-foreground flex gap-2">
                  <span className="text-emerald-500 flex-shrink-0">✓</span>{d}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Tapez <span className="font-mono font-bold text-foreground">{PHRASE_CONFIRMATION}</span> pour confirmer
          </label>
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={PHRASE_CONFIRMATION}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 font-mono"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
            data-testid="input-confirmation-reset"
          />
          <button
            type="button"
            onClick={handleReset}
            disabled={!peutConfirmer || resetting}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="button-confirmer-reset"
          >
            <Trash2 size={14} /> {resetting ? "Réinitialisation…" : "Réinitialiser les données"}
          </button>
        </div>
      </div>
    </div>
  );
}
