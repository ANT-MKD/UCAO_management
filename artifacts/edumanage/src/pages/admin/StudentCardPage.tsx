import { useMemo, useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Eye, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { StudentQrCode } from "@/components/admin/StudentQrCode";
import { useStudentStore } from "@/hooks/useStudentStore";
import type { EtudiantRecord } from "@/data/studentStore";
import { formatShortDate } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [8, 12, 16, 24];

function StudentCardTile({
  student,
  onOpenDetail,
}: {
  student: EtudiantRecord;
  onOpenDetail: () => void;
}) {
  return (
    <div
      className="group relative bg-card border border-border rounded-2xl p-4 flex flex-col items-center text-center transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-md"
      style={{ boxShadow: "var(--shadow-sm)" }}
      data-testid={`student-id-card-${student.id}`}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-muted-foreground opacity-70 group-hover:opacity-100 hover:bg-muted hover:text-primary transition-all"
        title="Voir le dossier"
        aria-label={`Dossier ${student.prenom} ${student.nom}`}
      >
        <Eye size={15} />
      </button>

      <UserAvatar name={`${student.prenom} ${student.nom}`} size="lg" className="!w-16 !h-16 !text-base" />

      <div className="mt-3 flex items-center justify-center gap-1.5 w-full px-1">
        <StudentQrCode value={student.matricule} size={26} />
        <span
          className="text-xs font-mono font-bold text-foreground truncate"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {student.matricule}
        </span>
      </div>

      <p
        className="mt-2 text-sm font-bold text-foreground truncate w-full px-1"
        style={{ fontFamily: "Outfit, sans-serif" }}
      >
        {student.nom.toUpperCase()} {student.prenom}
      </p>

      <p className="text-[11px] text-muted-foreground mt-0.5">
        Né{student.sexe === "F" ? "e" : ""} le {formatShortDate(student.dateNaissance)}
      </p>

      <div className="mt-3">
        <span className="text-xs font-semibold px-2.5 py-1 bg-muted rounded-lg text-foreground">
          {student.filiere}
        </span>
      </div>
    </div>
  );
}

export default function StudentCardPage() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const etudiants = useStudentStore();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const focusId = params.get("id") ?? "";

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return etudiants;
    return etudiants.filter(
      (e) =>
        e.matricule.toLowerCase().includes(q) ||
        e.nom.toLowerCase().includes(q) ||
        e.prenom.toLowerCase().includes(q) ||
        e.filiere.toLowerCase().includes(q),
    );
  }, [etudiants, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  useEffect(() => {
    if (!focusId) return;
    const idx = filtered.findIndex((e) => e.id === focusId);
    if (idx < 0) return;
    setPage(Math.floor(idx / pageSize) + 1);
  }, [focusId, filtered, pageSize]);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Étudiants" }, { label: "Carte étudiant" }]}
        title="Carte étudiant"
        subtitle={`${filtered.length} carte${filtered.length > 1 ? "s" : ""}${query.trim() ? ` (sur ${etudiants.length})` : ""} — cliquez sur l’œil pour ouvrir le dossier`}
      />

      <div className="mb-5 max-w-md">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par matricule, nom, prénom ou filière…"
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="student-card-search"
          />
        </div>
      </div>

      {etudiants.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Aucun étudiant enregistré
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Aucune carte ne correspond à « {query.trim()} »
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 mb-6">
            {paged.map((s) => (
              <StudentCardTile
                key={s.id}
                student={s}
                onOpenDetail={() => setLocation(`/admin/students/${s.id}`)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-muted-foreground">
            <span>
              {(safePage - 1) * pageSize + (paged.length ? 1 : 0)}–
              {(safePage - 1) * pageSize + paged.length} sur {filtered.length}
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2 py-1 border border-border rounded-lg bg-background"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(1)}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 font-medium text-foreground">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(totalPages)}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
