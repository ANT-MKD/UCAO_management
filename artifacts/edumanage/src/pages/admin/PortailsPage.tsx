import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { usePortalAccess } from "@/hooks/usePortalAccessStore";
import { setPortalActif, PORTAL_LABELS } from "@/data/portalAccessStore";
import { usePortalFeatures } from "@/hooks/usePortalFeaturesStore";
import { getFeaturesForPortal, isHomeFeature, setFeatureActif, type PortalWithFeatures } from "@/data/portalFeaturesStore";
import type { UserRole } from "@/data/studentStore";
import { cn } from "@/lib/utils";

const PORTAILS: { role: UserRole; portal: PortalWithFeatures; label: string }[] = [
  { role: "student", portal: "student", label: "Étudiant" },
  { role: "teacher", portal: "teacher", label: "Professeur" },
];

function Toggle({ value, onChange, disabled, title, testId }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean; title?: string; testId: string }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors",
        value ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
        !disabled && "cursor-pointer hover:opacity-80",
        disabled && "opacity-60 cursor-not-allowed",
      )}
      data-testid={testId}
    >
      {value ? "Activé" : "Désactivé"}
    </button>
  );
}

export default function PortailsPage() {
  const access = usePortalAccess();
  const features = usePortalFeatures();
  const [active, setActive] = useState<UserRole>("student");

  const current = PORTAILS.find((p) => p.role === active)!;
  const portailActif = access[current.role];
  const featureList = getFeaturesForPortal(current.portal);

  const handleTogglePortail = (actif: boolean) => {
    try {
      setPortalActif(current.role, actif);
      toast.success(`Portail ${PORTAL_LABELS[current.role]} ${actif ? "activé" : "désactivé"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible");
    }
  };

  const handleToggleFeature = (featureId: string, actif: boolean) => {
    try {
      setFeatureActif(current.portal, featureId, actif);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible");
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Portails" }]}
        title="Portails"
        subtitle="Contrôle réel, côté établissement, de ce que les portails Étudiant et Professeur donnent à voir"
      />

      <div className="grid md:grid-cols-[200px_1fr] gap-4">
        <div className="bg-card border border-border rounded-2xl p-2 h-fit" style={{ boxShadow: "var(--shadow-sm)" }}>
          {PORTAILS.map((p) => (
            <button
              key={p.role}
              onClick={() => setActive(p.role)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active === p.role ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
              )}
              data-testid={`portail-onglet-${p.role}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div>
              <p className="font-semibold text-foreground">Accès au portail {current.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {portailActif ? "Connexion autorisée pour ce portail" : "Connexion bloquée — plus aucun compte de ce portail ne peut se connecter"}
              </p>
            </div>
            <Toggle value={portailActif} onChange={handleTogglePortail} testId={`portail-toggle-global-${current.role}`} />
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="px-5 py-3 border-b border-border">
              <p className="font-semibold text-sm text-foreground">Accès portail {current.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Détermine ce qui apparaît dans le menu de ce portail — désactiver bloque aussi l'accès direct par URL</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Libellé</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Activé ?</th>
                </tr>
              </thead>
              <tbody>
                {featureList.map((f) => {
                  const actif = features[f.id] !== false;
                  const home = isHomeFeature(current.portal, f.id);
                  return (
                    <tr key={f.id} className="border-b border-border/60 last:border-0" data-testid={`feature-ligne-${f.id}`}>
                      <td className="px-5 py-2.5 text-foreground">{f.label}</td>
                      <td className="px-5 py-2.5">
                        <Toggle
                          value={actif}
                          onChange={(v) => handleToggleFeature(f.id, v)}
                          disabled={home && actif}
                          title={home ? "Page d'accueil du portail — ne peut pas être désactivée" : undefined}
                          testId={`feature-toggle-${f.id}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-xl p-3 mt-4">
        <ShieldAlert size={14} className="mt-0.5 shrink-0" />
        Le portail Administration n'apparaît pas ici : il ne peut pas être désactivé, pour éviter de verrouiller totalement l'accès au système.
      </div>
    </div>
  );
}
