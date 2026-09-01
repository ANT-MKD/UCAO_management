import { useMemo, useState } from "react";
import { KeyRound, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useUserAccounts } from "@/hooks/useStudentStore";
import { usePinsActivation } from "@/hooks/usePinActivationStore";
import { genererPin, statutPin, type PinActivationRecord } from "@/data/pinActivationStore";
import { envoyerMailSysteme } from "@/data/mailEnvoyeStore";
import { PORTAL_LABELS } from "@/data/portalAccessStore";
import type { UserAccountRecord } from "@/data/studentStore";
import { cn } from "@/lib/utils";

const STATUT_CONFIG: Record<ReturnType<typeof statutPin>, { label: string; cls: string }> = {
  actif: { label: "Actif", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  utilise: { label: "Utilisé", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  expire: { label: "Expiré", cls: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PinActivationPage() {
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
    if (!selected) return;
    const record = genererPin(selected.id, selected.displayName, selected.identifier);
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

  const columns: Column<Record<string, unknown>>[] = [
    { key: "compteLabel", header: "Compte", sortable: true },
    { key: "pin", header: "PIN", render: (row) => <span className="font-mono font-semibold">{(row as unknown as PinActivationRecord).pin}</span> },
    { key: "createdAt", header: "Généré le", sortable: true, render: (row) => formatDateTime((row as unknown as PinActivationRecord).createdAt) },
    { key: "expiresAt", header: "Expire le", render: (row) => formatDateTime((row as unknown as PinActivationRecord).expiresAt) },
    {
      key: "statut",
      header: "Statut",
      render: (row) => {
        const st = statutPin(row as unknown as PinActivationRecord);
        const cfg = STATUT_CONFIG[st];
        return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", cfg.cls)}>{cfg.label}</span>;
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
