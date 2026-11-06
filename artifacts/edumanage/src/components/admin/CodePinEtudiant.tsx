import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { FormModal } from "@/components/admin/FormModal";
import { DUREES_CODE, genererCodeEtudiant, PAGES_CODES_PIN, type CodeEtudiant } from "@/data/comptesAdmin";
import type { EtudiantRecord } from "@/data/studentStore";
import { useAccesUnePage } from "@/hooks/useComptesAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { modeSupabase } from "@/lib/supabase";

const libelleDuree = (d: number) => (d === 1 ? "24 heures" : `${d} jours`);
const dateHeure = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR")} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Bouton « Code PIN » du dossier d'un étudiant : un code pour lui seul, sans passer par la page
 * Codes PIN ni toucher aux codes des autres. Le code est montré une fois, à remettre en main propre
 * (jamais envoyé par e-mail). Visible seulement pour ceux que la base laisse générer un code. */
export function CodePinEtudiant({ etudiant }: { etudiant: EtudiantRecord }) {
  const { currentUser } = useAuth();
  const autorise = useAccesUnePage(currentUser?.roleId, PAGES_CODES_PIN);
  const [ouvert, setOuvert] = useState(false);
  const [jours, setJours] = useState(1);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<CodeEtudiant | null>(null);

  if (!autorise || etudiant.statut === "abandon") return null;

  const fermer = () => {
    if (enCours) return;
    setOuvert(false);
    setResultat(null);
    setJours(1);
  };

  const generer = async () => {
    if (!currentUser) return;
    setEnCours(true);
    try {
      const ligne = await genererCodeEtudiant(etudiant.id, jours, { id: currentUser.id, name: currentUser.name });
      setResultat(ligne);
      if (!ligne.code) toast.error(`Pas de code pour ${ligne.nomComplet} : ${ligne.motif ?? "compte introuvable"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération impossible");
    } finally {
      setEnCours(false);
    }
  };

  const nom = `${etudiant.prenom} ${etudiant.nom}`;
  return (
    <>
      <button onClick={() => setOuvert(true)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
        data-testid="dossier-code-pin">
        <KeyRound size={13} /> Code PIN
      </button>
      <FormModal open={ouvert} onClose={fermer} title="Code PIN" subtitle={`${nom} — ${etudiant.matricule}`} size="sm">
        {!resultat?.code ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Un nouveau code pour {nom} uniquement. Avec ce code, le mot de passe se choisit sur la page de connexion
              (« J&apos;ai déjà un code »). Le code reçu avant ne servira plus ; les codes des autres étudiants ne changent pas.
            </p>
            <label className="text-xs font-medium text-muted-foreground flex flex-col gap-1">
              Validité
              <select value={jours} onChange={(e) => setJours(Number(e.target.value))} disabled={enCours}
                className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="dossier-code-pin-duree">
                {DUREES_CODE.map((d) => <option key={d} value={d}>{libelleDuree(d)}</option>)}
              </select>
            </label>
            {resultat && !resultat.code && (
              <p className="text-xs text-red-700 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2" data-testid="dossier-code-pin-motif">
                Pas de code : {resultat.motif ?? "compte introuvable"}.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={fermer} disabled={enCours} className="px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted disabled:opacity-40">Annuler</button>
              <button onClick={() => void generer()} disabled={enCours}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40"
                data-testid="dossier-code-pin-generer">
                <KeyRound size={14} /> {enCours ? "Génération…" : "Générer le code"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4" data-testid="dossier-code-pin-resultat">
            <div className="text-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl py-4">
              <p className="text-xs text-muted-foreground mb-1">Code de {nom}</p>
              <p className="font-mono text-3xl font-bold tracking-[0.3em] text-foreground" data-testid="dossier-code-pin-code">{resultat.code}</p>
              <p className="text-xs text-muted-foreground mt-1" data-testid="dossier-code-pin-expire">
                {resultat.expireLe ? `Valable jusqu'au ${dateHeure(resultat.expireLe)}` : `Valable ${libelleDuree(jours)}`}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              À remettre en main propre, après vérification de son identité.
              {modeSupabase && " Le code n'est montré qu'une fois : notez-le avant de fermer."}
            </p>
            <div className="flex justify-end">
              <button onClick={fermer} className="px-4 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted" data-testid="dossier-code-pin-fermer">Fermer</button>
            </div>
          </div>
        )}
      </FormModal>
    </>
  );
}
