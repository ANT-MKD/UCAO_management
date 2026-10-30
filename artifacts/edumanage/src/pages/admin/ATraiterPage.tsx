import { useMemo } from "react";
import { Link } from "wouter";
import { CheckCircle2, ArrowRight, Inbox } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useAdminAlerts, type AdminAlert } from "@/hooks/useAdminAlerts";
import { cn } from "@/lib/utils";

const NIVEAUX: { type: AdminAlert["type"]; titre: string; sousTitre: string; pastille: string; badge: string }[] = [
  { type: "danger", titre: "Urgent", sousTitre: "Un usager est bloqué tant que ce n'est pas traité", pastille: "bg-red-500", badge: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
  { type: "warning", titre: "À traiter", sousTitre: "Des dossiers attendent une décision de l'administration", pastille: "bg-amber-500", badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  { type: "info", titre: "À suivre", sousTitre: "Dossiers en cours ou suivis dans la durée", pastille: "bg-blue-500", badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
];

/** Centre « À traiter » : une file unique de tout ce qui attend l'administration, calculée depuis
 * les données réelles (useAdminAlerts) — chaque ligne mène à l'écran où le dossier se traite et
 * disparaît d'elle-même une fois le dernier élément traité. */
export default function ATraiterPage() {
  const alertes = useAdminAlerts();
  const total = useMemo(() => alertes.filter((a) => a.type !== "info" && a.id !== "stockage").reduce((s, a) => s + a.count, 0), [alertes]);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "À traiter" }]}
        title="À traiter"
        subtitle="Tout ce qui attend une action de l'administration, par ordre d'urgence"
      />

      <div className="bg-card border border-border rounded-xl p-4 mb-5 flex flex-wrap items-center gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
        <Inbox size={20} className="text-primary" />
        <p className="flex-1 min-w-[220px] text-sm text-muted-foreground">
          {total > 0 ? <><strong className="text-foreground text-base" data-testid="a-traiter-total">{total}</strong> élément(s) en attente de décision.</> : "Aucun dossier en attente de décision."}
        </p>
      </div>

      {alertes.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
          <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-3" />
          <p className="font-semibold text-foreground">Tout est à jour</p>
          <p className="text-sm text-muted-foreground mt-1">Rien n&apos;attend l&apos;administration pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {NIVEAUX.map((niveau) => {
            const lignes = alertes.filter((a) => a.type === niveau.type || (niveau.type === "info" && a.type === "success"));
            if (lignes.length === 0) return null;
            return (
              <section key={niveau.type}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={cn("w-2 h-2 rounded-full translate-y-[-1px]", niveau.pastille)} />
                  <h2 className="font-bold text-foreground">{niveau.titre}</h2>
                  <span className="text-xs text-muted-foreground">{niveau.sousTitre}</span>
                </div>
                <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
                  {lignes.map((a) => (
                    <Link key={a.id} href={a.href} className="flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors" data-testid={`a-traiter-${a.id}`}>
                      <span className={cn("min-w-[2.5rem] text-center text-sm font-bold px-2 py-1 rounded-lg", niveau.badge)}>{a.id === "stockage" ? `${a.count} %` : a.count}</span>
                      <div className="flex-1 min-w-[200px]">
                        <p className="text-sm font-medium text-foreground">{a.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{a.domaine} · {a.temps}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        {a.action} <ArrowRight size={13} />
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
