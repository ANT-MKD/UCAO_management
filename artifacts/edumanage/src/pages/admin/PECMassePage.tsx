import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Plus, Eye } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { usePECsMasse } from "@/hooks/usePECMasseStore";
import { cn } from "@/lib/utils";

interface ColFilters {
  reference: string;
  organisme: string;
  classe: string;
}

const EMPTY_FILTERS: ColFilters = { reference: "", organisme: "", classe: "" };

const filterInputClass =
  "w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function PECMassePage() {
  const [, setLocation] = useLocation();
  const pecsMasse = usePECsMasse();
  const [filters, setFilters] = useState<ColFilters>(EMPTY_FILTERS);

  const filtered = useMemo(() => {
    const f = filters;
    return pecsMasse
      .filter((r) => {
        if (f.reference && !r.reference.toLowerCase().includes(f.reference.toLowerCase())) return false;
        if (f.organisme && !r.organisme.toLowerCase().includes(f.organisme.toLowerCase())) return false;
        if (f.classe && !r.classe.toLowerCase().includes(f.classe.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => b.emisLe.localeCompare(a.emisLe));
  }, [pecsMasse, filters]);

  const patchFilter = (patch: Partial<ColFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "PEC en masse" }]}
        title="Les PEC en masse"
        subtitle={`${pecsMasse.length} génération(s) enregistrée(s)`}
        actions={
          <button
            onClick={() => setLocation("/admin/pec-masse/new")}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="btn-new-pec-masse"
          >
            <Plus size={15} /> Nouvelle PEC en masse
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl overflow-x-auto" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Référence</th>
              <th className="text-left px-4 py-3">Organisme</th>
              <th className="text-left px-4 py-3">Classe</th>
              <th className="text-left px-4 py-3">Émis le</th>
              <th className="text-center px-4 py-3">Étudiants couverts</th>
              <th className="text-right px-4 py-3 w-14" />
            </tr>
            <tr className="border-b border-border bg-card">
              <th className="px-3 py-2">
                <input value={filters.reference} onChange={(e) => patchFilter({ reference: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.organisme} onChange={(e) => patchFilter({ organisme: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.classe} onChange={(e) => patchFilter({ classe: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2" colSpan={3}>
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
                <td colSpan={6} className="py-16 text-center text-sm text-muted-foreground">
                  Aucune PEC en masse ne correspond aux critères sélectionnés.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => setLocation(`/admin/pec-masse/${r.id}`)}
                  data-testid={`pecm-row-${r.id}`}
                >
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {r.reference}
                    {r.annulee && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Annulée</span>}
                  </td>
                  <td className="px-4 py-3">{r.organisme}</td>
                  <td className="px-4 py-3">
                    {r.classe} <span className="text-xs text-muted-foreground">({r.filiere} / {r.annee})</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.emisLe}</td>
                  <td className="px-4 py-3 text-center">{r.priseEnChargeIds.length}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/admin/pec-masse/${r.id}`);
                      }}
                      className={cn("p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors")}
                      aria-label="Voir le détail"
                      data-testid={`pecm-view-${r.id}`}
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
