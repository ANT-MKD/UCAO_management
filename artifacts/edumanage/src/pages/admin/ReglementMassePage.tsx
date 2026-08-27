import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Plus, Eye } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useReglementsMasse } from "@/hooks/useReglementMasseStore";
import type { ReglementMasseRecord } from "@/data/reglementMasseStore";
import { formatCFA, cn } from "@/lib/utils";

type Statut = "Validé" | "Annulé";

const STATUT_CLS: Record<Statut, string> = {
  Validé: "bg-emerald-50 text-emerald-700",
  Annulé: "bg-slate-100 text-slate-600",
};

export function statutReglementMasse(r: ReglementMasseRecord): Statut {
  return r.annulee ? "Annulé" : "Validé";
}

interface ColFilters {
  reference: string;
  organisme: string;
  mode: string;
  referenceBancaire: string;
  annee: string;
  statut: string;
}

const EMPTY_FILTERS: ColFilters = { reference: "", organisme: "", mode: "", referenceBancaire: "", annee: "", statut: "" };

const filterInputClass =
  "w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function ReglementMassePage() {
  const [, setLocation] = useLocation();
  const reglements = useReglementsMasse();
  const [filters, setFilters] = useState<ColFilters>(EMPTY_FILTERS);

  const filtered = useMemo(() => {
    const f = filters;
    return reglements
      .filter((r) => {
        if (f.reference && !r.reference.toLowerCase().includes(f.reference.toLowerCase())) return false;
        if (f.organisme && !r.organisme.toLowerCase().includes(f.organisme.toLowerCase())) return false;
        if (f.mode && !r.modePaiement.toLowerCase().includes(f.mode.toLowerCase())) return false;
        if (f.referenceBancaire && !(r.referenceBancaire ?? "").toLowerCase().includes(f.referenceBancaire.toLowerCase())) return false;
        if (f.annee && !r.annee.toLowerCase().includes(f.annee.toLowerCase())) return false;
        if (f.statut && !statutReglementMasse(r).toLowerCase().includes(f.statut.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [reglements, filters]);

  const patchFilter = (patch: Partial<ColFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les règlements en masse" }]}
        title="Les règlements en masse"
        subtitle={filtered.length === 0 ? "Aucun règlement effectué" : `${reglements.length} règlement(s) enregistré(s)`}
        actions={
          <button
            onClick={() => setLocation("/admin/encaissements-pec-masse/new")}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="btn-new-regm"
          >
            <Plus size={15} /> Nouvel encaissement
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl overflow-x-auto" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Numéro</th>
              <th className="text-left px-4 py-3">Entité</th>
              <th className="text-left px-4 py-3">Mode Paiement</th>
              <th className="text-left px-4 py-3">Référence</th>
              <th className="text-left px-4 py-3">Année référence</th>
              <th className="text-right px-4 py-3">Montant global</th>
              <th className="text-center px-4 py-3">Statut</th>
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
                <input value={filters.mode} onChange={(e) => patchFilter({ mode: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.referenceBancaire} onChange={(e) => patchFilter({ referenceBancaire: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2">
                <input value={filters.annee} onChange={(e) => patchFilter({ annee: e.target.value })} className={filterInputClass} placeholder="Filtrer…" />
              </th>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">
                <input value={filters.statut} onChange={(e) => patchFilter({ statut: e.target.value })} className={filterInputClass} placeholder="Statut" />
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
                <td colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                  Aucun règlement effectué.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const statut = statutReglementMasse(r);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setLocation(`/admin/encaissements-pec-masse/${r.id}`)}
                    data-testid={`regm-row-${r.id}`}
                  >
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{r.reference}</td>
                    <td className="px-4 py-3">{r.organisme}</td>
                    <td className="px-4 py-3">{r.modePaiement}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.referenceBancaire || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.annee}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCFA(r.montantGlobal)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[statut])}>{statut}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/admin/encaissements-pec-masse/${r.id}`);
                        }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Voir le détail"
                        data-testid={`regm-view-${r.id}`}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
