import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, DatabaseZap, Loader2 } from "lucide-react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { compteDeLaSession } from "@/lib/comptesServeur";
import { effacerSauvegarde, lireSauvegarde } from "@/lib/stockageLocal";
import { donneesDuPoste, essayerReprise, reprendre, type DonneesDuPoste, type Etape, type RapportReprise } from "@/lib/reprise";
import { VueRapportReprise } from "./RapportReprise";

/** Page de reprise (ouverte avec ?reprise=poste depuis Sécurité → Réinitialisation des données) :
 * les stores contiennent les données de ce poste d'avant la base. L'administrateur principal lance
 * un essai, lit le rapport de contrôle, puis reprend ces données, une fois pour toutes. */

type Phase =
  | { nom: "verification" }
  | { nom: "refus"; message: string }
  | { nom: "pret" }
  | { nom: "essai" }
  | { nom: "essaye"; rapport: RapportReprise }
  | { nom: "reprise"; essai: RapportReprise; etape: Etape; fait: number; total: number }
  | { nom: "faite"; rapport: RapportReprise }
  | { nom: "erreur"; message: string; essai?: RapportReprise };

const ETAPES: Record<Etape, string> = {
  comptes: "Création des comptes",
  fichiers: "Dépôt des fichiers",
  reprise: "Reprise des données dans la base",
};

const accueil = () => window.location.replace(import.meta.env.BASE_URL || "/");

export default function RepriseApp() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-5xl space-y-5 p-6">
          <header className="flex items-center gap-3">
            <DatabaseZap className="text-primary" size={24} />
            <div>
              <h1 className="text-lg font-semibold">Reprise des données de ce poste</h1>
              <p className="text-xs text-muted-foreground">Année en cours seulement, une fois, dans la base qui vient d&apos;être installée.</p>
            </div>
            <button onClick={accueil} className="ml-auto rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-muted">Quitter</button>
          </header>
          <Reprise />
        </div>
      </div>
    </ThemeProvider>
  );
}

function Reprise() {
  const [phase, setPhase] = useState<Phase>({ nom: "verification" });
  const [confirme, setConfirme] = useState(false);
  const sauvegarde = useMemo(() => lireSauvegarde(), []);
  const donnees = useMemo<DonneesDuPoste>(() => donneesDuPoste(), []);

  useEffect(() => {
    void (async () => {
      try {
        const etat = await compteDeLaSession();
        if (!etat || !("compte" in etat)) {
          setPhase({ nom: "refus", message: etat && "refus" in etat ? etat.refus : "Connectez-vous d'abord avec le compte de l'administrateur principal." });
        } else if (etat.compte.type_compte !== "administration" || etat.compte.role_id) {
          setPhase({ nom: "refus", message: "La reprise est réservée à un administrateur à accès complet." });
        } else {
          setPhase({ nom: "pret" });
        }
      } catch (e) {
        setPhase({ nom: "refus", message: e instanceof Error ? e.message : "Base injoignable." });
      }
    })();
  }, []);

  const essayer = async () => {
    setPhase({ nom: "essai" });
    try {
      setPhase({ nom: "essaye", rapport: await essayerReprise(donnees) });
      setConfirme(false);
    } catch (e) {
      setPhase({ nom: "erreur", message: e instanceof Error ? e.message : "L'essai a échoué." });
    }
  };

  const lancer = async (essai: RapportReprise) => {
    setPhase({ nom: "reprise", essai, etape: "comptes", fait: 0, total: 0 });
    try {
      const rapport = await reprendre(donnees, essai, (etape, fait, total) => setPhase({ nom: "reprise", essai, etape, fait, total }));
      setPhase({ nom: "faite", rapport });
    } catch (e) {
      setPhase({ nom: "erreur", message: e instanceof Error ? e.message : "La reprise a échoué.", essai });
    }
  };

  const lignes = Object.values(donnees.tables).reduce((n, t) => n + t.length, 0);

  if (phase.nom === "verification") return <Attente texte="Vérification de votre compte…" />;
  if (phase.nom === "refus") return <Message ton="rouge" texte={phase.message} />;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-4 text-sm" data-testid="reprise-poste">
        {sauvegarde ? (
          <p>
            Données d&apos;avant la base mises de côté sur ce poste le {new Date(sauvegarde.le).toLocaleString("fr-FR")} : <b>{lignes.toLocaleString("fr-FR")}</b> lignes
            dans {Object.values(donnees.tables).filter((t) => t.length > 0).length} tables, <b>{donnees.comptes.length}</b> comptes, <b>{donnees.fichiers.length}</b> fichiers.
            Année en cours sur ce poste : <b>{donnees.annee || "aucune"}</b>.
          </p>
        ) : (
          <p>Aucune donnée d&apos;avant la base n&apos;a été mise de côté sur ce poste : il n&apos;y a rien à reprendre ici.</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Seules les lignes de l&apos;année en cours sont reprises (étudiants inscrits, classes, notes, emploi du temps…) ; les pièces financières des étudiants
          repris le sont en entier. Les mots de passe ne se reprennent pas : chacun en choisira un nouveau avec un code remis par l&apos;administration
          (Sécurité → Codes PIN).
        </p>
      </section>

      {sauvegarde && (phase.nom === "pret" || phase.nom === "erreur") && (
        <div className="space-y-3">
          {phase.nom === "erreur" && <Message ton="rouge" texte={phase.message} />}
          <button onClick={essayer} disabled={!donnees.annee} data-testid="reprise-essai"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
            Faire l&apos;essai (rien n&apos;est enregistré)
          </button>
        </div>
      )}
      {phase.nom === "essai" && <Attente texte="Essai en cours dans la base…" />}

      {phase.nom === "essaye" && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Rapport de contrôle de l&apos;essai</h2>
          <VueRapportReprise rapport={phase.rapport} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={confirme} onChange={(e) => setConfirme(e.target.checked)} className="mt-1" data-testid="reprise-confirmation" />
            J&apos;ai lu ce rapport : reprendre ces données dans la base, une fois pour toutes (la reprise ne se refait pas).
          </label>
          <div className="flex gap-3">
            <button onClick={() => lancer(phase.rapport)} disabled={!confirme} data-testid="reprise-lancer"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
              Reprendre les données
            </button>
            <button onClick={essayer} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted">Refaire l&apos;essai</button>
          </div>
        </div>
      )}

      {phase.nom === "reprise" && (
        <Attente texte={`${ETAPES[phase.etape]}${phase.total > 1 ? ` : ${phase.fait} / ${phase.total}` : "…"}`} />
      )}

      {phase.nom === "faite" && (
        <div className="space-y-4">
          <Message ton="vert" texte="Reprise faite. Les comptes repris doivent choisir un nouveau mot de passe : remettez-leur un code depuis Sécurité → Codes PIN." />
          <VueRapportReprise rapport={phase.rapport} />
          <div className="flex gap-3">
            <button onClick={() => { effacerSauvegarde(); accueil(); }} data-testid="reprise-effacer"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
              Effacer la sauvegarde de ce poste et ouvrir EduManage
            </button>
            <button onClick={accueil} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted">Ouvrir EduManage (garder la sauvegarde)</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Attente({ texte }: { texte: string }) {
  return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> {texte}</p>;
}

function Message({ ton, texte }: { ton: "rouge" | "vert"; texte: string }) {
  const Icone = ton === "rouge" ? AlertTriangle : CheckCircle2;
  const couleurs = ton === "rouge"
    ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200"
    : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200";
  return (
    <div className={`flex gap-2 rounded-xl border p-3 text-sm ${couleurs}`} data-testid={`reprise-message-${ton}`}>
      <Icone size={18} className="mt-0.5 flex-shrink-0" /> <span>{texte}</span>
    </div>
  );
}
