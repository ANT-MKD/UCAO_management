import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { lireEtatCourriels, type EtatCourriels } from "@/lib/courriels";

/** Encadré « E-mails (Resend) » de la page des données (partie 10, lot 4), pour l'administrateur
 * à accès complet : réglages lus par la fonction serveur (jamais la clé) et état de la file. */
export function VueEtatCourriels({ etat }: { etat: EtatCourriels }) {
  const { file } = etat;
  return (
    <div className="mt-5 max-w-5xl space-y-2 rounded-xl border border-border bg-card p-4" data-testid="etat-courriels">
      <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Mail size={16} /> E-mails (Resend)</p>
      {!etat.configure ? (
        <p className="text-sm text-muted-foreground">
          Envoi d&apos;e-mails non réglé : la clé Resend n&apos;est pas dans les secrets du serveur (RESEND_API_KEY).
          Les mails restent dans la messagerie des portails. Procédure : MISE-EN-LIGNE.md, « E-mails par Resend ».
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Expéditeur : <span className="font-medium text-foreground">{etat.expediteur}</span>.{" "}
            {etat.domaine_propre
              ? "Domaine de l'établissement : les mails partent aussi par e-mail à leurs destinataires."
              : "Adresse d'essai de Resend : seules les alertes du service partent. Les mails partiront aussi par e-mail une fois un domaine vérifié chez Resend."}
          </p>
          <p className="text-sm text-muted-foreground">
            {etat.alertes
              ? <>Alertes du service (sauvegarde en retard, espace presque plein) : <span className="font-medium text-foreground">{etat.alertes}</span>.</>
              : "Adresse des alertes non réglée (EDUMANAGE_ALERTES) : les alertes ne partent pas."}
          </p>
          <p className="text-sm text-muted-foreground" data-testid="etat-courriels-file">
            7 derniers jours : {file.envoyes} envoyé{file.envoyes > 1 ? "s" : ""}, {file.refuses} refusé{file.refuses > 1 ? "s" : ""},
            {" "}{file.ignores} non envoyé{file.ignores > 1 ? "s" : ""} ; en attente : {file.en_attente}.
          </p>
          {etat.motifs.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-muted-foreground">
              {etat.motifs.map((m) => <li key={m.motif}>{m.motif} ({m.nombre})</li>)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function EtatCourrielsPanel() {
  const [etat, setEtat] = useState<EtatCourriels | null>(null);
  useEffect(() => {
    let actif = true;
    void lireEtatCourriels().then((e) => { if (actif) setEtat(e); });
    return () => { actif = false; };
  }, []);
  return etat ? <VueEtatCourriels etat={etat} /> : null;
}
