import { useState } from "react";
import { Sparkles, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  genererDonneesAcademiques,
  socleAcademiqueDemoDejaGenere,
  apercuSocleAcademiqueDemo,
  type ResultatSeedFiliere,
} from "@/lib/demoSeed";

export default function DemoSeedPage() {
  const { currentUser } = useAuth();
  const [dejaGenere, setDejaGenere] = useState(socleAcademiqueDemoDejaGenere());
  const [generating, setGenerating] = useState(false);
  const [resultats, setResultats] = useState<ResultatSeedFiliere[] | null>(null);

  const apercu = apercuSocleAcademiqueDemo();

  const handleGenerer = () => {
    if (!currentUser) return;
    setGenerating(true);
    try {
      const res = genererDonneesAcademiques(currentUser.id);
      setResultats(res);
      setDejaGenere(true);
      const nbCrees = res.filter((r) => r.cree).length;
      if (nbCrees === 0) {
        toast.info("Toutes les filières de démonstration existaient déjà — rien à créer.");
      } else {
        toast.success(`Socle académique généré pour ${nbCrees} filière(s).`);
      }
    } catch {
      toast.error("La génération a échoué.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Données de démonstration" }]}
        title="Générer des données de démonstration"
        subtitle="Créer un jeu de données réaliste pour explorer l'application"
      />

      <div className="max-w-2xl space-y-5">
        <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4 flex gap-3">
          <Info size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Étape 1 : socle académique. Crée 6 filières types (Informatique de Gestion, Agrobusiness, Sciences de
            Gestion, Comptabilité Finance, Sciences Politiques et Relations Internationales, Qualité Hygiène Sécurité
            Environnement), chacune avec ses niveaux L1/L2/L3, ses semestres S1 à S6 et une maquette UE/EC complète
            pour l'année 2025-2026. Action idempotente : relancer ne crée pas de doublons.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Sera créé (si aucune filière de démo n'existe encore)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-lg font-semibold text-foreground">{apercu.filieres}</p>
              <p className="text-xs text-muted-foreground">Filières</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{apercu.niveaux}</p>
              <p className="text-xs text-muted-foreground">Niveaux</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{apercu.semestres}</p>
              <p className="text-xs text-muted-foreground">Semestres</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{apercu.ueEstime}</p>
              <p className="text-xs text-muted-foreground">UE ({apercu.ecEstime} EC)</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <button
            type="button"
            onClick={handleGenerer}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="button-generer-demo-academique"
          >
            <Sparkles size={14} /> {generating ? "Génération…" : dejaGenere ? "Relancer la génération" : "Générer le socle académique"}
          </button>
          {dejaGenere && !resultats && (
            <p className="mt-3 text-xs text-muted-foreground">
              Au moins une filière de démonstration existe déjà dans ce navigateur.
            </p>
          )}
        </div>

        {resultats && (
          <div className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Résultat</p>
            <ul className="space-y-2">
              {resultats.map((r) => (
                <li key={r.filiere} className="text-xs text-foreground flex items-center gap-2">
                  {r.cree ? (
                    <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Info size={14} className="text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="font-medium">{r.filiere}</span>
                  <span className="text-muted-foreground">
                    {r.cree
                      ? `— ${r.niveaux} niveaux, ${r.semestres} semestres, ${r.ueCount} UE, ${r.ecCount} EC`
                      : "— déjà existante, ignorée"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
