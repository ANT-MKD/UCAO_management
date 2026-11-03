import { useState } from "react";
import { Download, Lock } from "lucide-react";
import { toast } from "sonner";
import { motifPhrase } from "@/lib/archiveSauvegarde";
import { formatTaille } from "@/lib/etatService";
import { faireSauvegarde, type EtapeSauvegarde } from "@/lib/sauvegarde";
import { useEtatService, VueEspaceService } from "@/components/admin/EtatServicePanels";
import { EtatCourrielsPanel } from "@/components/admin/CourrielsPanel";

/** Texte de la progression, pour l'administrateur. */
export function texteEtape(e: EtapeSauvegarde): string {
  switch (e.etape) {
    case "liste": return "Liste des fichiers…";
    case "donnees": return "Copie des données…";
    case "fichiers": return e.total === 0 ? "Aucun fichier à copier…" : `Fichiers : ${e.fait} sur ${e.total}…`;
    case "fin": return "Sauvegarde terminée.";
  }
}

/** Télécharge le fichier dans le navigateur (dossier de téléchargement du poste). */
function telecharger(blob: Blob, nom: string): void {
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Sauvegarde chiffrée (partie 10, lot 3) : réservée à l'administrateur à accès complet. */
export function SauvegardeEtEspace() {
  const { etat, recharger } = useEtatService();
  const [ouvert, setOuvert] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notee, setNotee] = useState(false);
  const [etape, setEtape] = useState<EtapeSauvegarde | null>(null);
  const [erreur, setErreur] = useState("");
  const [faite, setFaite] = useState<{ nom: string; octets: number; fichiers: number } | null>(null);
  if (!etat) return null;

  const motif = phrase ? motifPhrase(phrase) : null;
  const differentes = confirmation.length > 0 && confirmation !== phrase;
  const pret = !!phrase && !motif && confirmation === phrase && notee && !etape;

  const lancer = async () => {
    setErreur("");
    setFaite(null);
    try {
      const resultat = await faireSauvegarde(phrase, setEtape);
      telecharger(resultat.blob, resultat.nom);
      setFaite({ nom: resultat.nom, octets: resultat.octets, fichiers: resultat.fichiers });
      setOuvert(false);
      setPhrase("");
      setConfirmation("");
      setNotee(false);
      toast.success("Sauvegarde téléchargée.");
      recharger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Sauvegarde impossible.");
    } finally {
      setEtape(null);
    }
  };

  const champ = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <>
      <div className="mt-5 max-w-5xl space-y-3 rounded-xl border border-border bg-card p-4" data-testid="sauvegarde">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Lock size={16} /> Sauvegarde chiffrée</p>
        <p className="text-sm text-muted-foreground">
          {etat.derniereSauvegarde
            ? `Dernière sauvegarde : ${new Date(etat.derniereSauvegarde).toLocaleString("fr-FR")}.`
            : "Aucune sauvegarde n'a encore été faite."}
          {" "}L&apos;offre gratuite de Supabase n&apos;en garde aucune : faites-en une chaque semaine.
        </p>
        <p className="text-sm text-muted-foreground">
          Un seul fichier réunit toutes les données (mots de passe chiffrés compris) et tous les fichiers (photos, pièces, documents).
          Il est chiffré avec une phrase secrète que vous choisissez : sans elle, personne ne peut le lire, vous non plus.
          Notez-la et gardez-la à part du fichier. Rangez la sauvegarde sur un ordinateur ou un disque de l&apos;université, jamais sur GitHub ni par e-mail.
        </p>

        {faite && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status" data-testid="sauvegarde-faite">
            Sauvegarde téléchargée : {faite.nom} ({formatTaille(faite.octets)}, {faite.fichiers} fichier{faite.fichiers > 1 ? "s" : ""}).
          </p>
        )}

        {!ouvert ? (
          <button onClick={() => { setOuvert(true); setErreur(""); }} data-testid="sauvegarde-ouvrir"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
            <Download size={14} /> Préparer une sauvegarde
          </button>
        ) : (
          <div className="max-w-md space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">
              Phrase secrète (12 caractères au moins ; par exemple quatre mots sans lien entre eux)
              <input type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="new-password"
                className={champ + " mt-1"} data-testid="sauvegarde-phrase" disabled={!!etape} />
            </label>
            {motif && <p className="text-xs text-red-600" role="alert">{motif}</p>}
            <label className="block text-xs font-medium text-muted-foreground">
              Phrase secrète, à nouveau
              <input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password"
                className={champ + " mt-1"} data-testid="sauvegarde-confirmation" disabled={!!etape} />
            </label>
            {differentes && <p className="text-xs text-red-600" role="alert">Les deux phrases ne sont pas identiques.</p>}
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input type="checkbox" checked={notee} onChange={(e) => setNotee(e.target.checked)} className="mt-1" data-testid="sauvegarde-notee" disabled={!!etape} />
              J&apos;ai noté cette phrase en lieu sûr : sans elle, la sauvegarde est inutilisable.
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void lancer()} disabled={!pret} data-testid="sauvegarde-lancer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40">
                <Download size={14} /> Télécharger la sauvegarde
              </button>
              <button onClick={() => setOuvert(false)} disabled={!!etape}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40">
                Annuler
              </button>
            </div>
          </div>
        )}
        {etape && <p className="text-sm text-muted-foreground" role="status" data-testid="sauvegarde-etape">{texteEtape(etape)}</p>}
        {erreur && <p className="text-sm text-red-600" role="alert" data-testid="sauvegarde-erreur">{erreur}</p>}
      </div>
      <VueEspaceService etat={etat} />
      <EtatCourrielsPanel />
    </>
  );
}
