import { useMemo, useState } from "react";
import { ClipboardList, Check, X, Clock, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import {
  getEtudiantById,
  updateStudentRequestStatus,
  type StudentRequestRecord,
} from "@/data/studentStore";
import { useStudentRequests } from "@/hooks/useStudentStore";
import { PORTEE_LABELS } from "@/data/derogationPaiementStore";
import { estAutorise } from "@/data/communicationRolesStore";
import { useCommunicationRoles } from "@/hooks/useCommunicationRolesStore";
import { cn, formatDate } from "@/lib/utils";

const TYPE_LABELS: Record<StudentRequestRecord["type"], string> = {
  justificatif_absence: "Justificatif d'absence",
  attestation: "Attestation",
  reclamation_note: "Réclamation de note",
  demande_rallonge: "Demande de rallonge",
};

const STATUS_LABELS: Record<StudentRequestRecord["status"], string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  valide: "Validé",
  rejete: "Rejeté",
};

const STATUS_COLORS: Record<StudentRequestRecord["status"], string> = {
  nouveau: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  en_cours: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  valide: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  rejete: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

export default function RequestsPage() {
  const { currentUser } = useAuth();
  const requests = useStudentRequests();
  useCommunicationRoles(); // s'abonne pour refléter les validateurs désignés si la config change
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      if (q) {
        const etu = getEtudiantById(r.studentId);
        const haystack = `${etu ? `${etu.prenom} ${etu.nom}` : ""} ${r.subject}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, typeFilter, search]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const stats = useMemo(() => ({
    total: requests.length,
    nouveau: requests.filter((r) => r.status === "nouveau").length,
    en_cours: requests.filter((r) => r.status === "en_cours").length,
    traite: requests.filter((r) => r.status === "valide" || r.status === "rejete").length,
  }), [requests]);

  const handleStatus = (status: StudentRequestRecord["status"]) => {
    if (!selected || !currentUser) return;
    try {
      updateStudentRequestStatus(selected.id, status, currentUser.id, resolution.trim() || undefined);
      if (status === "valide" && selected.type === "demande_rallonge") {
        toast.success("Demande validée — dérogation de paiement créée dans Finance.");
      }
      if (status === "valide" || status === "rejete") setResolution("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible");
    }
  };

  const peutValiderRallonge = !currentUser || !selected || selected.type !== "demande_rallonge" || estAutorise("validateur_rallonge", currentUser.id);

  const inputClass =
    "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Communication" }, { label: "Demandes étudiant" }]}
        title="Demandes étudiant"
        subtitle="Traitement des justificatifs, attestations et réclamations"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Nouvelles", value: stats.nouveau, color: "text-blue-600" },
          { label: "En cours", value: stats.en_cours, color: "text-amber-600" },
          { label: "Traitées", value: stats.traite, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Étudiant, objet..."
            className={cn(inputClass, "pl-9")}
            data-testid="requete-recherche"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={cn(inputClass, "w-auto min-w-[140px]")} data-testid="requete-filtre-statut">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={cn(inputClass, "w-auto min-w-[180px]")} data-testid="requete-filtre-type">
          <option value="">Tous types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {(search || statusFilter || typeFilter) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setTypeFilter(""); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
          >
            <X size={12} /> Effacer les filtres
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <ClipboardList size={16} className="text-primary" />
            <span className="font-semibold text-sm">Liste ({filtered.length})</span>
          </div>
          <div className="max-h-[560px] overflow-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Aucune demande.</p>
            ) : (
              filtered.map((req) => {
                const etu = getEtudiantById(req.studentId);
                const active = selected?.id === req.id;
                return (
                  <button
                    key={req.id}
                    onClick={() => { setSelectedId(req.id); setResolution(req.resolution ?? ""); }}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-muted transition-colors",
                      active && "bg-primary/5 border-l-2 border-l-primary",
                    )}
                    data-testid={`requete-ligne-${req.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {etu && <UserAvatar name={`${etu.prenom} ${etu.nom}`} size="xs" />}
                      <span className="text-sm font-medium text-foreground truncate">
                        {etu ? `${etu.prenom} ${etu.nom}` : req.studentId}
                      </span>
                    </div>
                    <p className="text-xs text-foreground truncate">{req.subject}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", STATUS_COLORS[req.status])}>
                        {STATUS_LABELS[req.status]}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{TYPE_LABELS[req.type]}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          {!selected ? (
            <p className="text-sm text-muted-foreground text-center py-16">Sélectionnez une demande à traiter.</p>
          ) : (
            <>
              {(() => {
                const etu = getEtudiantById(selected.studentId);
                return (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-foreground">{selected.subject}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {etu ? `${etu.prenom} ${etu.nom} · ${etu.matricule}` : selected.studentId}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {TYPE_LABELS[selected.type]} · {formatDate(selected.createdAt)}
                        </p>
                      </div>
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", STATUS_COLORS[selected.status])}>
                        {STATUS_LABELS[selected.status]}
                      </span>
                    </div>

                    <div className="rounded-xl bg-muted/30 border border-border p-4 mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Message étudiant</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{selected.message}</p>
                      {selected.type === "demande_rallonge" && selected.porteeRallonge && selected.dateFinSouhaitee && (
                        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                          Portée souhaitée : <span className="font-medium text-foreground">{PORTEE_LABELS[selected.porteeRallonge]}</span> · Jusqu'au <span className="font-medium text-foreground">{formatDate(selected.dateFinSouhaitee)}</span>
                        </p>
                      )}
                    </div>

                    {selected.type === "demande_rallonge" && !peutValiderRallonge && (
                      <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 rounded-lg px-3 py-2 mb-4">
                        Vous n'êtes pas désigné comme validateur des demandes de rallonge (Paramétrage communication) — vous pouvez la prendre en charge ou la rejeter, mais pas la valider.
                      </p>
                    )}

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Réponse / commentaire interne
                      </label>
                      <textarea
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder="Motif de validation ou de rejet..."
                        className={cn(inputClass, "min-h-[100px]")}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleStatus("en_cours")}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted"
                      >
                        <Clock size={14} /> Prendre en charge
                      </button>
                      <button
                        onClick={() => handleStatus("valide")}
                        disabled={!peutValiderRallonge}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        data-testid="requete-valider"
                      >
                        <Check size={14} /> Valider
                      </button>
                      <button
                        onClick={() => handleStatus("rejete")}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-sm hover:bg-red-700"
                      >
                        <X size={14} /> Rejeter
                      </button>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
