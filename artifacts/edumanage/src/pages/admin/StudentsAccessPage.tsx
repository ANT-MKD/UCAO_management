import { useMemo, useState } from "react";
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { Checkbox } from "@/components/ui/checkbox";
import { useStudentStore } from "@/hooks/useStudentStore";
import { setEtudiantsAccess, type EtudiantRecord } from "@/data/studentStore";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function isInterdit(statut: string): boolean {
  return statut === "suspendu";
}

function programmeLabel(e: EtudiantRecord): string {
  return [e.filiere, e.niveau, e.annee].filter(Boolean).join(" | ");
}

export default function StudentsAccessPage() {
  const etudiants = useStudentStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [accessFilter, setAccessFilter] = useState<"" | "autorise" | "interdit">("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return etudiants.filter((e) => {
      if (accessFilter === "interdit" && !isInterdit(e.statut)) return false;
      if (accessFilter === "autorise" && isInterdit(e.statut)) return false;
      if (!q) return true;
      return (
        e.matricule.toLowerCase().includes(q) ||
        e.nom.toLowerCase().includes(q) ||
        e.prenom.toLowerCase().includes(q) ||
        e.filiere.toLowerCase().includes(q) ||
        e.niveau.toLowerCase().includes(q) ||
        e.annee.toLowerCase().includes(q)
      );
    });
  }, [etudiants, search, accessFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageIds = paged.map((e) => e.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllPage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const applyAccess = (access: "autorise" | "interdit") => {
    if (selected.size === 0) {
      toast.message("Aucune sélection", {
        description: "Cochez au moins un étudiant avant d'autoriser ou d'interdire.",
      });
      return;
    }
    const ids = [...selected];
    const count = setEtudiantsAccess(ids, access);
    setSelected(new Set());
    if (count === 0) {
      toast.message(access === "autorise" ? "Déjà autorisés" : "Déjà interdits", {
        description: "Aucun statut n'a nécessité de changement.",
      });
      return;
    }
    toast.success(
      access === "autorise"
        ? `${count} étudiant(s) autorisé(s)`
        : `${count} étudiant(s) interdit(s)`,
    );
  };

  const inputClass =
    "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Étudiants" }, { label: "Interdire / Autoriser" }]}
        title="Interdire / Autoriser étudiants"
        subtitle="Gérer l'accès portail des étudiants — sélection multiple"
      />

      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border">
          <div className="relative w-64 max-w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Matricule, nom, prénom, programme..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={accessFilter}
            onChange={(e) => { setAccessFilter(e.target.value as typeof accessFilter); setPage(1); }}
            className={cn(inputClass, "w-auto min-w-[160px]")}
          >
            <option value="">Tous les accès</option>
            <option value="autorise">Autorisés</option>
            <option value="interdit">Interdits</option>
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => applyAccess("autorise")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 size={15} /> Autoriser
            </button>
            <button
              type="button"
              onClick={() => applyAccess("interdit")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <Ban size={15} /> Interdire
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 w-12">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAllPage(v === true)}
                    aria-label="Tout sélectionner sur cette page"
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Matricule</th>
                <th className="px-4 py-3 font-semibold">Nom</th>
                <th className="px-4 py-3 font-semibold">Prénom</th>
                <th className="px-4 py-3 font-semibold">Programme en cours</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Aucun étudiant trouvé
                  </td>
                </tr>
              ) : (
                paged.map((e) => {
                  const interdit = isInterdit(e.statut);
                  const checked = selected.has(e.id);
                  return (
                    <tr
                      key={e.id}
                      className={cn(
                        "border-b border-border last:border-0 hover:bg-muted/30 transition-colors",
                        checked && "bg-primary/[0.03]",
                      )}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleOne(e.id, v === true)}
                          aria-label={`Sélectionner ${e.matricule}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-mono font-bold text-muted-foreground"
                          style={{ fontFamily: "JetBrains Mono, monospace" }}
                        >
                          {e.matricule}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground uppercase tracking-wide">
                        {e.nom}
                      </td>
                      <td className="px-4 py-3 text-foreground">{e.prenom}</td>
                      <td className="px-4 py-3 text-muted-foreground">{programmeLabel(e)}</td>
                      <td className="px-4 py-3">
                        {interdit ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden />
                            Interdit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                            Autorisé
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
          <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <Checkbox
              checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
              onCheckedChange={(v) => toggleAllPage(v === true)}
            />
            Tout sélectionner
            {selected.size > 0 && (
              <span className="text-xs text-muted-foreground">({selected.size} sélectionné(s))</span>
            )}
          </label>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              {(safePage - 1) * pageSize + (paged.length ? 1 : 0)}–
              {(safePage - 1) * pageSize + paged.length} sur {filtered.length}
            </span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 border border-border rounded-lg bg-background"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button type="button" disabled={safePage <= 1} onClick={() => setPage(1)} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40">
                <ChevronsLeft size={14} />
              </button>
              <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40">
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 font-medium text-foreground">{safePage} / {totalPages}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40">
                <ChevronRight size={14} />
              </button>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40">
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
