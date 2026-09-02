import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { Plus, Eye, Pencil, Download, Upload, FileSpreadsheet, Users, AlertTriangle, UserX, X, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import { DataTable, Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { FILIERES } from "@/data/mockData";
import { useStudentStore, useAnneeActuelle, useAnneesAcademiques, useAllInscriptions } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { setEtudiantsAccess, type EtudiantRecord } from "@/data/studentStore";
import { downloadStudentTemplate, parseStudentExcel, importStudentRows, exportStudentsToExcel } from "@/lib/studentImportExport";
import { formatCFA } from "@/lib/utils";

type Etudiant = EtudiantRecord;

const STATUT_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "actif", label: "Actif" },
  { value: "preinscrit", label: "Préinscrit" },
  { value: "en_attente", label: "En attente" },
  { value: "inscrit", label: "Inscrit" },
  { value: "suspendu", label: "Suspendu" },
  { value: "abandon", label: "Abandon" },
];

function isYearMonth(iso: string, year: number, month: number): boolean {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5">
        <X size={10} />
      </button>
    </span>
  );
}

export default function StudentsPage() {
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  const anneeActuelle = useAnneeActuelle();
  const inscriptions = useAllInscriptions();
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const rows = await parseStudentExcel(file);
      if (rows.length === 0) {
        toast.error("Aucune ligne valide trouvée dans le fichier.");
        return;
      }
      const { created, echecs } = importStudentRows(rows);
      toast.success(`${created.length} étudiant(s) préinscrit(s)${echecs > 0 ? ` — ${echecs} ligne(s) en échec` : ""}.`);
    } catch {
      toast.error("Échec de l'import. Vérifiez le format du fichier Excel.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };
  const anneesAcademiques = useAnneesAcademiques();
  const anneeOptions = useMemo(
    () => [
      { value: "", label: "Toutes les années" },
      ...[...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)).map((a) => ({ value: a.libelle, label: a.libelle })),
    ],
    [anneesAcademiques],
  );

  // Filters
  const [filiereFilter, setFiliereFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [anneeFilter, setAnneeFilter] = useState("");
  const [impayesOnly, setImpayesOnly] = useState(false);
  const [sexeFilter, setSexeFilter] = useState("");
  const [classeFilter, setClasseFilter] = useState("");
  const [niveauFilter, setNiveauFilter] = useState("");

  const classes = useClasses();
  const classeOptions = useMemo(
    () => classes.filter((c) => !filiereFilter || c.filiereId === filiereFilter).sort((a, b) => a.nom.localeCompare(b.nom)),
    [classes, filiereFilter],
  );
  const niveauOptions = useMemo(() => [...new Set(etudiants.map((e) => e.niveau))].sort(), [etudiants]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredData = useMemo(() => {
    return etudiants.filter((e) => {
      if (filiereFilter && e.filiereId !== filiereFilter) return false;
      if (statutFilter && e.statut !== statutFilter) return false;
      if (anneeFilter && e.annee !== anneeFilter) return false;
      if (impayesOnly && e.soldeDu === 0) return false;
      if (sexeFilter && e.sexe !== sexeFilter) return false;
      if (classeFilter && e.classeId !== classeFilter) return false;
      if (niveauFilter && e.niveau !== niveauFilter) return false;
      return true;
    });
  }, [etudiants, filiereFilter, statutFilter, anneeFilter, impayesOnly, sexeFilter, classeFilter, niveauFilter]);

  const impayés = etudiants.filter((e) => e.soldeDu > 0).length;

  const now = new Date();
  const moisPrecedent = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const premieresInscriptions = inscriptions.filter((i) => i.type === "premiere");
  const nouveauxCeMois = premieresInscriptions.filter((i) => isYearMonth(i.dateInscription, now.getFullYear(), now.getMonth())).length;
  const nouveauxMoisPrecedent = premieresInscriptions.filter((i) => isYearMonth(i.dateInscription, moisPrecedent.getFullYear(), moisPrecedent.getMonth())).length;
  const ecartNouveaux = nouveauxCeMois - nouveauxMoisPrecedent;
  const suspendus = etudiants.filter((e) => e.statut === "suspendu").length;

  const activeFiltersCount = [filiereFilter, statutFilter, anneeFilter, sexeFilter, classeFilter, niveauFilter, impayesOnly].filter(Boolean).length;

  const clearFilters = () => {
    setFiliereFilter("");
    setStatutFilter("");
    setAnneeFilter("");
    setImpayesOnly(false);
    setSexeFilter("");
    setClasseFilter("");
    setNiveauFilter("");
  };

  const applyAccessToSelection = (access: "autorise" | "interdit", ids: string[], clearSelection: () => void) => {
    const count = setEtudiantsAccess(ids, access);
    clearSelection();
    setSelectedIds(new Set());
    if (count === 0) {
      toast.message(access === "autorise" ? "Déjà autorisés" : "Déjà suspendus", { description: "Aucun statut n'a nécessité de changement." });
      return;
    }
    toast.success(access === "autorise" ? `${count} étudiant(s) réactivé(s)` : `${count} étudiant(s) suspendu(s)`);
  };

  const activeFiliereLabel = FILIERES.find((f) => f.id === filiereFilter)?.code;

  const columns: Column<Etudiant>[] = [
    {
      key: "nom",
      header: "Étudiant",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/admin/students/${r.id}`);
            }}
            className="rounded-full cursor-pointer hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
            title={`Ouvrir le dossier de ${r.prenom} ${r.nom}`}
            aria-label={`Dossier ${r.prenom} ${r.nom}`}
          >
            <UserAvatar name={`${r.prenom} ${r.nom}`} size="sm" src={r.photoDataUrl} />
          </button>
          <div>
            <div className="font-medium text-foreground text-sm">{r.prenom} {r.nom}</div>
            <div className="text-[10px] text-muted-foreground">{r.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "matricule",
      header: "Matricule",
      render: (r) => (
        <span className="text-xs font-mono font-bold text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {r.matricule}
        </span>
      ),
    },
    { key: "classe", header: "Classe", render: (r) => <span className="text-xs font-semibold px-2 py-0.5 bg-muted rounded-lg">{r.classe}</span> },
    { key: "filiere", header: "Filière", render: (r) => <span className="text-xs text-muted-foreground">{r.filiere}</span> },
    { key: "sexe", header: "Sexe", render: (r) => <span className="text-xs text-muted-foreground">{r.sexe === "M" ? "Masculin" : "Féminin"}</span> },
    { key: "annee", header: "Année", render: (r) => <span className="text-xs text-muted-foreground">{r.annee}</span> },
    { key: "statut", header: "Statut", render: (r) => <StatusBadge status={r.statut} /> },
    {
      key: "soldeDu",
      header: "Solde dû",
      sortable: true,
      render: (r) => (
        <span className={`text-sm font-semibold ${r.soldeDu > 0 ? "text-red-500" : "text-emerald-600"}`}>
          {r.soldeDu > 0 ? formatCFA(r.soldeDu) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setLocation(`/admin/students/${r.id}`); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
            title="Voir dossier"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setLocation(`/admin/students/reinscription?matricule=${encodeURIComponent(r.matricule)}`); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-indigo-600 transition-colors"
            title="Réinscrire"
          >
            <RefreshCw size={14} />
          </button>
          <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="Modifier">
            <Pencil size={14} />
          </button>
        </div>
      ),
    },
  ];

  const filterPanel = (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {/* Filière */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Filière</label>
          <select
            value={filiereFilter}
            onChange={(e) => { setFiliereFilter(e.target.value); setClasseFilter(""); }}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-filiere"
          >
            <option value="">Toutes</option>
            {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.code} – {f.nom}</option>)}
          </select>
        </div>

        {/* Statut */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Statut</label>
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-statut"
          >
            {STATUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Sexe */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Sexe</label>
          <select
            value={sexeFilter}
            onChange={(e) => setSexeFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-sexe"
          >
            <option value="">Tous</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </div>

        {/* Année */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Année académ.</label>
          <select
            value={anneeFilter}
            onChange={(e) => setAnneeFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-annee"
          >
            {anneeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Niveau */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Niveau</label>
          <select
            value={niveauFilter}
            onChange={(e) => setNiveauFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-niveau"
          >
            <option value="">Tous</option>
            {niveauOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Classe */}
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Classe</label>
          <select
            value={classeFilter}
            onChange={(e) => setClasseFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="filter-classe"
          >
            <option value="">Toutes</option>
            {classeOptions.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>

        {/* Impayés toggle */}
        <div className="flex flex-col justify-between">
          <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Impayés</label>
          <button
            onClick={() => setImpayesOnly((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg font-medium transition-all ${
              impayesOnly
                ? "bg-red-50 border-red-300 text-red-600 dark:bg-red-950 dark:border-red-700 dark:text-red-300"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
            data-testid="filter-impayes"
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${impayesOnly ? "bg-red-500 border-red-500" : "border-border"}`}>
              {impayesOnly && <span className="text-white text-[10px]">✓</span>}
            </span>
            Avec impayés seulement
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {activeFiliereLabel && <FilterChip label={`Filière : ${activeFiliereLabel}`} onRemove={() => setFiliereFilter("")} />}
          {statutFilter && <FilterChip label={`Statut : ${statutFilter}`} onRemove={() => setStatutFilter("")} />}
          {sexeFilter && <FilterChip label={`Sexe : ${sexeFilter === "M" ? "Masculin" : "Féminin"}`} onRemove={() => setSexeFilter("")} />}
          {anneeFilter && <FilterChip label={`Année : ${anneeFilter}`} onRemove={() => setAnneeFilter("")} />}
          {niveauFilter && <FilterChip label={`Niveau : ${niveauFilter}`} onRemove={() => setNiveauFilter("")} />}
          {classeFilter && <FilterChip label={`Classe : ${classeOptions.find((c) => c.id === classeFilter)?.nom ?? classeFilter}`} onRemove={() => setClasseFilter("")} />}
          {impayesOnly && <FilterChip label="Impayés uniquement" onRemove={() => setImpayesOnly(false)} />}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Utilisateurs" }, { label: "Étudiants" }]}
        title="Étudiants"
        subtitle={`${etudiants.length} étudiants — année ${anneeActuelle}`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={downloadStudentTemplate} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground" title="Télécharger le modèle Excel">
              <FileSpreadsheet size={13} /> Modèle
            </button>
            <label className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground cursor-pointer" title="Importer via Excel">
              <Upload size={13} /> Importer
              <input ref={importInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleImportFile(e.target.files?.[0])} data-testid="student-import-input" />
            </label>
            <button onClick={() => exportStudentsToExcel(filteredData)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors text-muted-foreground" title="Exporter la liste affichée">
              <Download size={13} /> Exporter
            </button>
            <button
              onClick={() => setLocation("/admin/students/reinscription")}
              className="flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-50 transition-colors"
            >
              <RefreshCw size={15} /> Réinscrire
            </button>
            <button
              onClick={() => setLocation("/admin/students/new")}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="btn-new-student"
            >
              <Plus size={15} /> Nouvelle inscription
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard icon={Users} label="Total inscrits" value={etudiants.length} accentColor="#4f46e5" />
        <KPICard
          icon={Users}
          label="Nouveaux ce mois"
          value={nouveauxCeMois}
          trend={ecartNouveaux === 0 ? undefined : `${ecartNouveaux > 0 ? "+" : ""}${ecartNouveaux} vs mois préc.`}
          trendDirection={ecartNouveaux >= 0 ? "up" : "down"}
          accentColor="#10b981"
        />
        <KPICard
          icon={AlertTriangle}
          label="Avec impayés"
          value={impayés}
          accentColor="#ef4444"
          onClick={() => { setImpayesOnly(true); }}
        />
        <KPICard
          icon={UserX}
          label="Suspendus"
          value={suspendus}
          accentColor="#64748b"
          onClick={() => { setStatutFilter("suspendu"); }}
        />
      </div>

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={filteredData as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher par nom, matricule, email..."
        onRowClick={(r) => setLocation(`/admin/students/${(r as unknown as Etudiant).id}`)}
        filterPanel={filterPanel}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={clearFilters}
        emptyMessage="Aucun étudiant ne correspond aux filtres sélectionnés"
        pageSize={10}
        selectable
        getRowId={(r) => (r as unknown as Etudiant).id}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        renderBulkActions={(ids, clearSelection) => (
          <>
            <button
              onClick={() => exportStudentsToExcel(etudiants.filter((e) => ids.includes(e.id)))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
              data-testid="bulk-export-students"
            >
              <Download size={12} /> Exporter la sélection
            </button>
            <button
              onClick={() => applyAccessToSelection("autorise", ids, clearSelection)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 text-xs font-medium hover:bg-emerald-50 transition-colors"
              data-testid="bulk-authorize-students"
            >
              <ShieldCheck size={12} /> Autoriser la sélection
            </button>
            <button
              onClick={() => applyAccessToSelection("interdit", ids, clearSelection)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-medium hover:bg-red-50 transition-colors"
              data-testid="bulk-suspend-students"
            >
              <ShieldOff size={12} /> Suspendre la sélection
            </button>
          </>
        )}
      />
    </div>
  );
}
