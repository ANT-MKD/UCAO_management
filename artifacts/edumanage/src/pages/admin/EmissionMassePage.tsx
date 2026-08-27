import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Plus, Eye, FileStack, Ban, Layers } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { useEmissionsMasse } from "@/hooks/useEmissionMasseStore";
import { formatShortDate, cn } from "@/lib/utils";

interface ColFilters {
  reference: string;
  filiere: string;
  annee: string;
  niveau: string;
  classe: string;
  emisLe: string;
  emisPar: string;
  dateLimite: string;
}

const EMPTY_FILTERS: ColFilters = {
  reference: "",
  filiere: "",
  annee: "",
  niveau: "",
  classe: "",
  emisLe: "",
  emisPar: "",
  dateLimite: "",
};

const filterInputClass =
  "w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function EmissionMassePage() {
  const [, setLocation] = useLocation();
  const emissions = useEmissionsMasse();
  const [filters, setFilters] = useState<ColFilters>(EMPTY_FILTERS);

  const filtered = useMemo(() => {
    const f = filters;
    return emissions
      .filter((e) => {
        if (f.reference && !e.reference.toLowerCase().includes(f.reference.toLowerCase())) return false;
        if (f.filiere && !e.filiere.toLowerCase().includes(f.filiere.toLowerCase())) return false;
        if (f.annee && !e.annee.toLowerCase().includes(f.annee.toLowerCase())) return false;
        if (f.niveau && !e.niveau.toLowerCase().includes(f.niveau.toLowerCase())) return false;
        if (f.classe && !e.classe.toLowerCase().includes(f.classe.toLowerCase())) return false;
        if (f.emisLe && !formatShortDate(e.emisLe).includes(f.emisLe)) return false;
        if (f.emisPar && !e.emisPar.toLowerCase().includes(f.emisPar.toLowerCase())) return false;
        if (f.dateLimite && !formatShortDate(e.dateLimite).includes(f.dateLimite)) return false;
        return true;
      })
      .sort((a, b) => b.emisLe.localeCompare(a.emisLe));
  }, [emissions, filters]);

  const patchFilter = (patch: Partial<ColFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const totalQuittances = emissions.reduce((sum, e) => sum + e.quittanceIds.length, 0);
  const nbAnnulees = emissions.filter((e) => e.annulee).length;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Émission en masse" }]}
        title="Les émissions de quittances en masse"
        subtitle={`${emissions.length} génération(s) enregistrée(s)`}
        actions={
          <button
            onClick={() => setLocation("/admin/emissions-masse/new")}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="btn-new-emission-masse"
          >
            <Plus size={15} /> Nouvelle émission en masse
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KPICard icon={Layers} label="Émissions" value={emissions.length} accentColor="#4f46e5" />
        <KPICard icon={FileStack} label="Quittances générées" value={totalQuittances} accentColor="#10b981" />
        <KPICard icon={Ban} label="Générations annulées" value={nbAnnulees} accentColor="#ef4444" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Référence</th>
              <th className="text-left px-4 py-3">Filière</th>
              <th className="text-left px-4 py-3">Année</th>
              <th className="text-left px-4 py-3">Niveau</th>
              <th className="text-left px-4 py-3">Classe</th>
              <th className="text-left px-4 py-3">Emis le</th>
              <th className="text-left px-4 py-3">Emis par</th>
              <th className="text-left px-4 py-3">Date limite</th>
              <th className="text-right px-4 py-3 w-14" />
            </tr>
            <tr className="border-b border-border bg-card">
              <th className="px-3 py-2">
                <input value={filters.reference} onChange={(e) => patchFilter({ reference: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.filiere} onChange={(e) => patchFilter({ filiere: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.annee} onChange={(e) => patchFilter({ annee: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.niveau} onChange={(e) => patchFilter({ niveau: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.classe} onChange={(e) => patchFilter({ classe: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.emisLe} onChange={(e) => patchFilter({ emisLe: e.target.value })} className={filterInputClass} placeholder="jj/mm/aaaa" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.emisPar} onChange={(e) => patchFilter({ emisPar: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.dateLimite} onChange={(e) => patchFilter({ dateLimite: e.target.value })} className={filterInputClass} placeholder="jj/mm/aaaa" />
              </th>
              <th className="px-3 py-2">
                {Object.values(filters).some(Boolean) && (
                  <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-[11px] text-muted-foreground hover:text-foreground underline whitespace-nowrap">
                    Réinit.
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-sm text-muted-foreground">
                  Aucune émission en masse ne correspond aux critères sélectionnés.
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => setLocation(`/admin/emissions-masse/${e.id}`)}
                  data-testid={`emission-masse-row-${e.id}`}
                >
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {e.reference}
                    {e.annulee && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Annulée</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{e.filiere}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{e.annee}</td>
                  <td className="px-4 py-3">{e.niveau}</td>
                  <td className="px-4 py-3">{e.classe}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatShortDate(e.emisLe)}</td>
                  <td className="px-4 py-3">{e.emisPar}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatShortDate(e.dateLimite)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setLocation(`/admin/emissions-masse/${e.id}`);
                      }}
                      className={cn("p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors")}
                      aria-label="Voir le détail"
                      data-testid={`emission-masse-view-${e.id}`}
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
