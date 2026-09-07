import { useMemo, useState } from "react";
import { KeyRound, Search, X, Ban } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useUserAccounts } from "@/hooks/useStudentStore";
import { usePinsActivation } from "@/hooks/usePinActivationStore";
import { genererPin, revoquerPin, statutPin, type PinActivationRecord, type StatutPin } from "@/data/pinActivationStore";
import { envoyerMailSysteme } from "@/data/mailEnvoyeStore";
import { PORTAL_LABELS } from "@/data/portalAccessStore";
import { useAuth } from "@/contexts/AuthContext";
import type { UserAccountRecord } from "@/data/studentStore";
import { cn } from "@/lib/utils";

const STATUT_CONFIG: Record<StatutPin, { label: string; cls: string }> = {
  actif: { label: "Actif", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  utilise: { label: "Utilisé", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  expire: { label: "Expiré", cls: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
  remplace: { label: "Remplacé", cls: "bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-500" },
  revoque: { label: "Révoqué", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PinActivationPage() {
  const { currentUser } = useAuth();
  const comptes = useUserAccounts();
  const pins = usePinsActivation();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserAccountRecord | null>(null);

  const candidats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 1) return [];
    return comptes.filter((c) => c.displayName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)).slice(0, 8);
  }, [comptes, search]);

  const handleGenerer = () => {
    if (!selected || !currentUser) return;
    const record = genererPin(selected.id, selected.displayName, selected.identifier, currentUser.id, currentUser.name);
    envoyerMailSysteme({
      destinataireUserId: selected.id,
      destinataireLabel: selected.displayName,
      destinataireEmail: selected.email,
      objet: "Code de validation",
      message: `Votre pin de réinitialisation de mot de passe: ${record.pin}`,
    });
    toast.success(`PIN généré pour ${selected.displayName} — envoyé (voir Mails envoyés).`);
    setSelected(null);
    setSearch("");
  };

  const handleRevoquer = (record: PinActivationRecord) => {
    if (!currentUser) return;
    try {
      revoquerPin(record.id, currentUser.name);
      toast.success(`PIN de ${record.compteLabel} révoqué.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Révocation impossible");
    }
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "compteLabel",
      header: "Utilisateur",
      sortable: true,
      render: (row) => {
        const r = row as unknown as PinActivationRecord;
        return (
          <div>
            <span className="font-mono text-xs text-muted-foreground">{r.compteIdentifier}</span>
            <span className="text-muted-foreground"> — </span>
            <span className="font-medium text-foreground">{r.compteLabel}</span>
          </div>
        );
      },
    },
    { key: "pin", header: "Code pin", render: (row) => <span className="font-mono font-semibold">{(row as unknown as PinActivationRecord).pin}</span> },
    { key: "createdAt", header: "Date création", sortable: true, render: (row) => formatDateTime((row as unknown as PinActivationRecord).createdAt) },
    { key: "auteurLabel", header: "Créé par", render: (row) => (row as unknown as PinActivationRecord).auteurLabel },
    {
      key: "statut",
      header: "Statut",
      render: (row) => {
        const r = row as unknown as PinActivationRecord;
        const st = statutPin(r, pins);
        const cfg = STATUT_CONFIG[st];
        return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", cfg.cls)}>{cfg.label}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => {
        const r = row as unknown as PinActivationRecord;
        const st = statutPin(r, pins);
        if (st !== "actif") return null;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleRevoquer(r); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-muted-foreground transition-colors dark:hover:bg-red-950/40"
            data-testid={`pin-revoquer-${r.id}`}
          >
            <Ban size={12} /> Révoquer
          </button>
        );
      },
    },
  ];

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Code pin activation" }]}
        title="Code pin activation"
        subtitle="Génère un code réel utilisable sur la page de connexion pour activer un compte ou réinitialiser un mot de passe"
      />

      <div className="bg-card border border-border rounded-2xl p-5 mb-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <h3 className="font-bold text-foreground mb-3">Générer un PIN</h3>
        <div className="max-w-md">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
              placeholder="Nom ou email du compte..."
              className={inputClass + " pl-9"}
              data-testid="pin-recherche-compte"
            />
          </div>
          {!selected && candidats.length > 0 && (
            <div className="mt-1.5 border border-border rounded-xl divide-y divide-border max-h-48 overflow-auto">
              {candidats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelected(c); setSearch(c.displayName); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                  data-testid={`pin-compte-option-${c.id}`}
                >
                  <UserAvatar name={c.displayName} size="xs" />
                  <div>
                    <div className="font-medium">{c.displayName}</div>
                    <div className="text-[10px] text-muted-foreground">{c.email} · {PORTAL_LABELS[c.role]}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="flex items-center gap-2 mt-2 border border-primary/30 bg-primary/5 rounded-xl p-2.5" data-testid="pin-compte-selectionne">
              <UserAvatar name={selected.displayName} size="xs" />
              <div className="flex-1 min-w-0 text-xs">
                <div className="font-medium truncate">{selected.displayName}</div>
                <div className="text-muted-foreground truncate">{selected.email}</div>
              </div>
              <button onClick={() => { setSelected(null); setSearch(""); }} className="p-1 rounded-lg hover:bg-muted"><X size={12} /></button>
            </div>
          )}
        </div>
        <button
          onClick={handleGenerer}
          disabled={!selected}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
          data-testid="pin-generer"
        >
          <KeyRound size={14} /> Générer et envoyer
        </button>
      </div>

      <DataTable
        columns={columns}
        data={pins as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Compte..."
        emptyMessage="Aucun PIN généré pour l'instant."
      />
    </div>
  );
}
