import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS } from "@/data/mockData";
import { montantTotal, contractStatut } from "@/data/teacherContractStore";
import { useTeacherContracts } from "@/hooks/useTeacherContractStore";
import { filterTeachers, type EnseignantRecord } from "@/lib/teacherUtils";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function TeacherContractsPage() {
  const contracts = useTeacherContracts();
  const teachers = ENSEIGNANTS as EnseignantRecord[];
  const [quickSearch, setQuickSearch] = useState("");

  const quickMatchIds = useMemo(() => {
    if (!quickSearch.trim()) return null;
    return new Set(filterTeachers(teachers, quickSearch).map((t) => t.id));
  }, [teachers, quickSearch]);

  const filtered = useMemo(
    () =>
      [...contracts]
        .filter((c) => !quickMatchIds || quickMatchIds.has(c.teacherId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [contracts, quickMatchIds],
  );

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Accueil" }, { label: "Les contrats Professeur" }]}
        title="Les contrats Professeur"
        actions={
          <Link
            href="/admin/teachers/contracts/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="contract-nouveau"
          >
            <Plus size={15} /> Nouveau contrat
          </Link>
        }
      />

      <div className="mb-4 relative w-full sm:w-72">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={quickSearch}
          onChange={(e) => setQuickSearch(e.target.value)}
          placeholder="Rechercher un professeur (nom, matricule)…"
          className={`${inputClass} pl-10`}
          data-testid="contract-quick-search"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          {quickSearch.trim() ? "Aucun contrat ne correspond à cette recherche." : "Aucun contrat professeur pour le moment."}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto" style={{ boxShadow: "var(--shadow-sm)" }}>
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">N°contrat</th>
                <th className="text-left px-4 py-3">Professeur</th>
                <th className="text-center px-3 py-3">Année</th>
                <th className="text-center px-3 py-3">Date de création</th>
                <th className="text-right px-4 py-3">Montant total</th>
                <th className="text-center px-3 py-3">N°avenant</th>
                <th className="text-center px-3 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const teacher = teachers.find((t) => t.id === c.teacherId);
                const statut = contractStatut(c);
                return (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{c.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{teacher ? `${teacher.prenom} ${teacher.nom}` : c.teacherId}</p>
                      <p className="text-xs text-muted-foreground">{teacher?.matricule}</p>
                    </td>
                    <td className="px-3 py-3 text-center">{c.annee}</td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">{formatShortDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCFA(montantTotal(c))}</td>
                    <td className="px-3 py-3 text-center">{c.nombreAvenants}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          statut === "actif" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {statut === "actif" ? "Actif" : "Expiré"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
