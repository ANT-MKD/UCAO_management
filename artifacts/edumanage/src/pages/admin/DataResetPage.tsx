import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Trash2, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { AvisAccesComplet } from "@/components/admin/AvisAccesComplet";
import { useAuth } from "@/contexts/AuthContext";
import { resetTestData } from "@/lib/dataReset";
import { CAPACITE_STOCKAGE, stockageUtilise } from "@/lib/stockageLocal";
import { modeSupabase, supabase } from "@/lib/supabase";
import { EspaceService } from "@/components/admin/EtatServicePanels";
import { lireSauvegarde } from "@/lib/stockageLocal";
import type { RapportReprise } from "@/lib/reprise";
import { VueRapportReprise } from "@/pages/reprise/RapportReprise";

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
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [resetting, setResetting] = useState(false);

  const accesComplet = currentUser?.role === "admin" && !currentUser.roleId;
  const peutConfirmer = accesComplet && phrase.trim().toUpperCase() === PHRASE_CONFIRMATION && motDePasse.length > 0;

  const handleReset = () => {
    if (!currentUser || !peutConfirmer) return;
    setErreur("");
    setResetting(true);
    try {
      resetTestData(currentUser.id, motDePasse);
    } catch (err) {
      const message = err instanceof Error ? err.message : "La réinitialisation a échoué.";
      setErreur(message);
      toast.error(message);
      setMotDePasse("");
      setResetting(false);
    }
  };

  // Avec la base de données, le navigateur ne garde plus aucune donnée : rien à vider ici.
  if (modeSupabase) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Réinitialisation des données" }]}
          title="Réinitialisation des données"
          subtitle="Les données de l'établissement sont dans la base de données"
        />
        <div className="max-w-2xl rounded-xl border border-border bg-card p-4 flex gap-3" data-testid="reinitialisation-avec-base">
          <HardDrive size={18} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Ce navigateur ne garde aucune copie des données de l&apos;établissement : elles sont chargées depuis la base à chaque connexion et oubliées à la déconnexion. Seuls le thème et la session restent sur ce poste. Il n&apos;y a donc rien à vider ici.
          </p>
        </div>
        <EspaceService />
        <RepriseDuPoste />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Réinitialisation des données" }]}
        title="Réinitialisation des données"
        subtitle="Vider les données opérationnelles de test en conservant le paramétrage"
      />

      <div className="max-w-2xl space-y-5">
        <EspaceStockage />

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

        {!accesComplet ? (
          <AvisAccesComplet testId="reset-reserve">
            La réinitialisation efface les données de tout l&apos;établissement : elle est réservée aux administrateurs à accès complet.
          </AvisAccesComplet>
        ) : (
        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <label htmlFor="data-reset-champ-1" className="block text-xs font-medium text-muted-foreground mb-1.5">
            Tapez <span className="font-mono font-bold text-foreground">{PHRASE_CONFIRMATION}</span> pour confirmer
          </label>
          <input id="data-reset-champ-1"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={PHRASE_CONFIRMATION}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 font-mono"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
            data-testid="input-confirmation-reset"
          />
          <label htmlFor="reset-mot-de-passe" className="block text-xs font-medium text-muted-foreground mt-4 mb-1.5">
            Votre mot de passe
          </label>
          <input
            id="reset-mot-de-passe"
            type="password"
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => { setMotDePasse(e.target.value); setErreur(""); }}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
            data-testid="input-mot-de-passe-reset"
          />
          {erreur && <p className="text-xs text-red-600 mt-1.5" role="alert" data-testid="reset-erreur">{erreur}</p>}
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
        )}
      </div>
    </div>
  );
}

/** Jauge de l'espace réellement occupé dans ce navigateur : au-delà de la capacité, plus aucun
 * enregistrement ne passe (un avertissement s'affiche alors à chaque tentative). */
function EspaceStockage() {
  const utilise = useMemo(() => stockageUtilise(), []);
  const pct = Math.min(100, Math.round((utilise / CAPACITE_STOCKAGE) * 100));
  const couleur = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500";
  const mo = (n: number) => (n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2" data-testid="espace-stockage">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <HardDrive size={16} className="text-muted-foreground" /> Espace de stockage de ce navigateur
        <span className="ml-auto tabular-nums">{pct} %</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${couleur}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {mo(utilise)} Mo utilisés sur environ {mo(CAPACITE_STOCKAGE)} Mo. Les photos et pièces jointes (demandes, cahiers, ressources, documents) occupent l&apos;essentiel de l&apos;espace : supprimez celles devenues inutiles avant que le stockage soit plein.
      </p>
    </div>
  );
}

/** Avec la base : reprise des données que ce poste gardait avant elle (partie 9, lot 3). Faite une
 * fois, par l'administrateur principal, depuis une page dédiée ; son rapport reste consultable ici. */
function RepriseDuPoste() {
  const [etat, setEtat] = useState<{ le: string; annee: string; rapport: RapportReprise } | null | "chargement" | "refus">("chargement");
  const sauvegarde = useMemo(() => lireSauvegarde(), []);
  useEffect(() => {
    if (!supabase) return;
    void supabase.rpc("etat_reprise").then(({ data, error }) => setEtat(error ? "refus" : (data as typeof etat) ?? null));
  }, []);
  if (etat === "chargement") return null;
  return (
    <div className="mt-5 max-w-5xl space-y-3 rounded-xl border border-border bg-card p-4" data-testid="reprise-du-poste">
      <p className="text-sm font-semibold text-foreground">Reprise des données d&apos;avant la base</p>
      {etat === "refus" ? (
        <p className="text-sm text-muted-foreground">La reprise est réservée à l&apos;administrateur à accès complet.</p>
      ) : etat ? (
        <>
          <p className="text-sm text-muted-foreground">Reprise faite le {new Date(etat.le).toLocaleString("fr-FR")}, année {etat.annee}. Elle ne se refait pas.</p>
          <VueRapportReprise rapport={etat.rapport} />
        </>
      ) : sauvegarde ? (
        <>
          <p className="text-sm text-muted-foreground">
            Ce poste a mis de côté ses données d&apos;avant la base le {new Date(sauvegarde.le).toLocaleString("fr-FR")}. Elles peuvent être reprises une fois
            (année en cours seulement), dans la base qui vient d&apos;être installée : un essai donne d&apos;abord le rapport de contrôle.
          </p>
          <button onClick={() => window.location.assign(`${import.meta.env.BASE_URL || "/"}?reprise=poste`)} data-testid="reprise-ouvrir"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
            Préparer la reprise
          </button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Aucune donnée d&apos;avant la base n&apos;a été mise de côté sur ce poste.</p>
      )}
    </div>
  );
}
