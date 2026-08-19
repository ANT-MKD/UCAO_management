import { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  headerActions?: React.ReactNode;
  filterPanel?: React.ReactNode;
  activeFiltersCount?: number;
  onClearFilters?: () => void;
  emptyMessage?: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  searchable = false,
  searchPlaceholder = "Rechercher...",
  onRowClick,
  pageSize: defaultPageSize = 10,
  headerActions,
  filterPanel,
  activeFiltersCount = 0,
  onClearFilters,
  emptyMessage = "Aucun résultat trouvé",
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let rows = [...data];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((row) =>
        Object.values(row).some((v) => String(v).toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      rows.sort((a, b) => {
        const av = String(a[sortKey] ?? "");
        const bv = String(b[sortKey] ?? "");
        const numA = parseFloat(av);
        const numB = parseFloat(bv);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDir === "asc" ? numA - numB : numB - numA;
        }
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [data, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handlePageSize = (val: number) => { setPageSize(val); setPage(1); };

  // Page number pills
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    pages.push(1);
    if (safePage > 3) pages.push("...");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) {
      pages.push(i);
    }
    if (safePage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  const totalFilters = activeFiltersCount + (search ? 1 : 0);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      {/* Header bar */}
      {(searchable || headerActions || filterPanel) && (
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {searchable && (
              <div className="relative w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  data-testid="table-search"
                />
              </div>
            )}
            {filterPanel && (
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-all",
                  showFilters || activeFiltersCount > 0
                    ? "bg-primary text-white border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
                data-testid="btn-toggle-filters"
              >
                <SlidersHorizontal size={14} />
                Filtres
                {totalFilters > 0 && (
                  <span className={cn(
                    "inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold rounded-full px-1",
                    showFilters || activeFiltersCount > 0 ? "bg-white text-primary" : "bg-primary text-white"
                  )}>
                    {totalFilters}
                  </span>
                )}
              </button>
            )}
            {totalFilters > 0 && onClearFilters && (
              <button
                onClick={() => { handleSearch(""); onClearFilters(); setPage(1); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                data-testid="btn-clear-filters"
              >
                <X size={12} /> Effacer tout
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            {filtered.length !== data.length && (
              <span className="text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full">
                {filtered.length} résultat{filtered.length !== 1 ? "s" : ""} sur {data.length}
              </span>
            )}
            {!filterPanel && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Afficher</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSize(Number(e.target.value))}
                  className="px-2 py-1 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                  data-testid="page-size-select"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span>/ page</span>
              </div>
            )}
            {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
          </div>
        </div>
      )}

      {/* Filter panel (collapsible) */}
      {filterPanel && showFilters && (
        <div className="border-b border-border">
          {filterPanel}
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Afficher</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSize(Number(e.target.value))}
                className="px-2 py-1 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>lignes par page</span>
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {totalFilters > 0 && !showFilters && (
        <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-border bg-muted/20">
          {search && (
            <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
              Recherche : "{search}"
              <button onClick={() => handleSearch("")} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="data-table">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap",
                    col.sortable && "cursor-pointer select-none hover:text-foreground group",
                    col.className
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className={cn("transition-opacity", sortKey === col.key ? "opacity-100" : "opacity-0 group-hover:opacity-40")}>
                        {sortKey === col.key && sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-14 text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Search size={20} className="opacity-40" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{emptyMessage}</p>
                      {totalFilters > 0 && (
                        <p className="text-xs mt-1">
                          <button onClick={() => { handleSearch(""); onClearFilters?.(); }} className="text-primary hover:underline">
                            Effacer les filtres
                          </button>
                        </p>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-border last:border-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-primary/[0.03]"
                  )}
                  onClick={() => onRowClick?.(row)}
                  data-testid={`table-row-${i}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3", col.className)}>
                      {col.render ? col.render(row) : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Affichage de{" "}
            <span className="font-semibold text-foreground">{(safePage - 1) * pageSize + 1}</span>
            –
            <span className="font-semibold text-foreground">{Math.min(safePage * pageSize, filtered.length)}</span>
            {" "}sur{" "}
            <span className="font-semibold text-foreground">{filtered.length}</span>
            {filtered.length !== data.length && (
              <span className="text-primary"> (filtré de {data.length})</span>
            )}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {/* First */}
              <button
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground"
                title="Première page"
                data-testid="table-first-page"
              >
                <ChevronsLeft size={14} />
              </button>
              {/* Prev */}
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground"
                data-testid="table-prev-page"
              >
                <ChevronLeft size={14} />
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-0.5">
                {getPageNumbers().map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} className="w-7 text-center text-muted-foreground text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={cn(
                        "w-7 h-7 rounded-lg text-xs font-medium transition-all",
                        safePage === p
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      data-testid={`table-page-${p}`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              {/* Next */}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground"
                data-testid="table-next-page"
              >
                <ChevronRight size={14} />
              </button>
              {/* Last */}
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground"
                title="Dernière page"
                data-testid="table-last-page"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
