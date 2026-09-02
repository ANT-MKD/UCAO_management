import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { useUserAccounts } from "@/hooks/useStudentStore";
import { useMailsEnvoyes } from "@/hooks/useMailEnvoyeStore";
import { envoyerMailSysteme } from "@/data/mailEnvoyeStore";
import { PORTAL_LABELS } from "@/data/portalAccessStore";
import type { UserAccountRecord, UserRole } from "@/data/studentStore";
import { cn } from "@/lib/utils";

const OBJET_IDENTIFIANT = "Envoi identifiant de connexion";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function EnvoiIdentifiantPage() {
  const [, setLocation] = useLocation();
  const comptes = useUserAccounts();
  const mails = useMailsEnvoyes();

  const [roleFilter, setRoleFilter] = useState<"" | UserRole>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const dernierEnvoiParCompte = useMemo(() => {
    const map = new Map<string, string>();
    for (const mail of mails) {
      if (mail.objet !== OBJET_IDENTIFIANT) continue;
      for (const d of mail.destinataires) {
        if (!d.userId) continue;
        const existing = map.get(d.userId);
        if (!existing || mail.date > existing) map.set(d.userId, mail.date);
      }
    }
    return map;
  }, [mails]);

  const filtered = roleFilter ? comptes.filter((c) => c.role === roleFilter) : comptes;

  const envoyerA = (compte: UserAccountRecord) => {
    envoyerMailSysteme({
      destinataireUserId: compte.id,
      destinataireLabel: compte.displayName,
      destinataireEmail: compte.email,
      objet: OBJET_IDENTIFIANT,
      message: `Bonjour ${compte.displayName},\n\nVotre identifiant de connexion : ${compte.identifier}\nPortail : ${PORTAL_LABELS[compte.role]}\n\nSi vous avez oublié votre mot de passe, utilisez "Mot de passe oublié ?" sur la page de connexion.`,
    });
  };

  const handleEnvoyer = (compte: UserAccountRecord) => {
    envoyerA(compte);
    toast.success(`Identifiant envoyé à ${compte.displayName}.`);
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleEnvoyerSelection = () => {
    const ciblesActives = filtered.filter((c) => selected.has(c.id) && c.actif !== false);
    const nbIgnores = selected.size - ciblesActives.length;
    ciblesActives.forEach(envoyerA);
    if (ciblesActives.length > 0) {
      toast.success(`Identifiants envoyés à ${ciblesActives.length} compte${ciblesActives.length > 1 ? "s" : ""}.`);
    }
    if (nbIgnores > 0) {
      toast.warning(`${nbIgnores} compte${nbIgnores > 1 ? "s" : ""} désactivé${nbIgnores > 1 ? "s" : ""} ignoré${nbIgnores > 1 ? "s" : ""}.`);
    }
    setSelected(new Set());
  };

  const navigateToFiche = (row: Record<string, unknown>) => {
    const compte = row as unknown as UserAccountRecord;
    if (compte.role === "student" && compte.linkedId) setLocation(`/admin/students/${compte.linkedId}`);
    else if (compte.role !== "student") setLocation(`/admin/users/${compte.id}`);
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "select",
      header: "",
      className: "w-8",
      render: (row) => {
        const c = row as unknown as UserAccountRecord;
        const actif = c.actif !== false;
        return (
          <input
            type="checkbox"
            checked={selected.has(c.id)}
            disabled={!actif}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => toggleSelect(c.id, e.target.checked)}
            className="rounded border-border"
            data-testid={`envoi-select-${c.id}`}
          />
        );
      },
    },
    { key: "displayName", header: "Compte", sortable: true },
    { key: "email", header: "Email", sortable: true },
    { key: "role", header: "Portail", render: (row) => PORTAL_LABELS[(row as unknown as UserAccountRecord).role] },
    { key: "identifier", header: "Identifiant", render: (row) => <span className="font-mono text-xs">{(row as unknown as UserAccountRecord).identifier}</span> },
    {
      key: "actif",
      header: "Statut",
      render: (row) => {
        const actif = (row as unknown as UserAccountRecord).actif !== false;
        return (
          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", actif ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300")}>
            {actif ? "Actif" : "Désactivé"}
          </span>
        );
      },
    },
    {
      key: "dernierEnvoi",
      header: "Dernier envoi",
      render: (row) => {
        const c = row as unknown as UserAccountRecord;
        const date = dernierEnvoiParCompte.get(c.id);
        return date ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid={`envoi-dernier-${c.id}`}>
            <CheckCircle2 size={12} className="text-emerald-600" /> {formatDateTime(date)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic" data-testid={`envoi-dernier-${c.id}`}>Jamais</span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => {
        const c = row as unknown as UserAccountRecord;
        const actif = c.actif !== false;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleEnvoyer(c); }}
            disabled={!actif}
            title={actif ? undefined : "Compte désactivé — réactivez-le d'abord dans Liste des utilisateurs"}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            data-testid={`envoi-identifiant-${c.id}`}
          >
            <Send size={12} /> Envoyer les identifiants
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Envoi identifiant" }]}
        title="Envoi identifiant"
        subtitle="Renvoie l'identifiant de connexion à un compte réel — jamais le mot de passe. Journalisé dans Mails envoyés."
      />

      <div className="flex items-center gap-3 mb-4">
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as typeof roleFilter); setSelected(new Set()); }} className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background w-auto min-w-[180px] focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="envoi-filtre-role">
          <option value="">Tous les portails</option>
          <option value="admin">{PORTAL_LABELS.admin}</option>
          <option value="teacher">{PORTAL_LABELS.teacher}</option>
          <option value="student">{PORTAL_LABELS.student}</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Nom, email, identifiant..."
        onRowClick={navigateToFiche}
        emptyMessage="Aucun compte."
        headerActions={
          <button
            onClick={handleEnvoyerSelection}
            disabled={selected.size === 0}
            className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
            data-testid="envoi-selection"
          >
            <Send size={13} /> Envoyer à la sélection ({selected.size})
          </button>
        }
      />
    </div>
  );
}
