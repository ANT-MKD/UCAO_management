import { useEffect, useState } from "react";
import { AlertTriangle, HardDrive } from "lucide-react";
import { alertesService, formatTaille, lireEtatService, part, SEUIL_ATTENTION, SEUIL_CRITIQUE, type EtatService } from "@/lib/etatService";
import { modeSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** Bandeau du tableau de bord : n'apparaît que s'il y a quelque chose à faire (partie 10, lot 3). */
export function BandeauService({ etat, maintenant }: { etat: EtatService; maintenant?: Date }) {
  const alertes = alertesService(etat, maintenant);
  if (alertes.length === 0) return null;
  return (
    <div className="mb-6 space-y-2" data-testid="alerte-service">
      {alertes.map((a) => (
        <div key={a.titre} role="alert"
          className={cn("flex gap-3 rounded-2xl border p-4",
            a.niveau === "critique"
              ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
              : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40")}>
          <AlertTriangle size={18} className={cn("mt-0.5 flex-shrink-0", a.niveau === "critique" ? "text-red-600" : "text-amber-600")} />
          <div>
            <p className="text-sm font-semibold text-foreground">{a.titre}</p>
            <p className="text-sm text-muted-foreground">{a.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Jauge({ libelle, octets, limite, detail }: { libelle: string; octets: number; limite: number; detail?: string }) {
  const p = part(octets, limite);
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{libelle}{detail ? ` · ${detail}` : ""}</span>
        <span>{formatTaille(octets)} sur {formatTaille(limite)}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden" role="meter" aria-label={libelle}
        aria-valuemin={0} aria-valuemax={limite} aria-valuenow={octets}>
        <div className={cn("h-full rounded-full", p >= SEUIL_CRITIQUE ? "bg-red-500" : p >= SEUIL_ATTENTION ? "bg-amber-500" : "bg-emerald-500")}
          style={{ width: `${Math.min(100, Math.max(1, p * 100))}%` }} />
      </div>
    </div>
  );
}

/** Encadré de la page des données : espace occupé et dernière visite quotidienne. */
export function VueEspaceService({ etat, maintenant }: { etat: EtatService; maintenant?: Date }) {
  return (
    <div className="mt-5 max-w-5xl space-y-3 rounded-xl border border-border bg-card p-4" data-testid="espace-service">
      <p className="text-sm font-semibold text-foreground flex items-center gap-2"><HardDrive size={16} /> Espace occupé (offre gratuite de Supabase)</p>
      <Jauge libelle="Base de données" octets={etat.baseOctets} limite={etat.baseLimite} />
      <Jauge libelle="Fichiers" octets={etat.fichiersOctets} limite={etat.fichiersLimite}
        detail={`${etat.fichiersNombre.toLocaleString("fr-FR")} fichier${etat.fichiersNombre > 1 ? "s" : ""}`} />
      <p className="text-xs text-muted-foreground">
        {etat.derniereVeille
          ? `Dernière visite quotidienne : ${new Date(etat.derniereVeille).toLocaleString("fr-FR")}.`
          : "Visite quotidienne : pas encore passée."}
        {" "}Elle empêche la mise en pause de la base après 7 jours sans activité.
      </p>
      <BandeauService etat={etat} maintenant={maintenant} />
    </div>
  );
}

function useEtatService(): EtatService | null {
  const [etat, setEtat] = useState<EtatService | null>(null);
  useEffect(() => {
    if (!modeSupabase) return;
    let actif = true;
    void lireEtatService().then((e) => { if (actif) setEtat(e); });
    return () => { actif = false; };
  }, []);
  return etat;
}

/** Avec la base, pour l'administrateur à accès complet ; rien sinon. */
export function AlerteServiceTableauDeBord() {
  const etat = useEtatService();
  return etat ? <BandeauService etat={etat} /> : null;
}

export function EspaceService() {
  const etat = useEtatService();
  return etat ? <VueEspaceService etat={etat} /> : null;
}
