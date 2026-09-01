import { Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { useUserAccounts } from "@/hooks/useStudentStore";
import { envoyerMailSysteme } from "@/data/mailEnvoyeStore";
import { PORTAL_LABELS } from "@/data/portalAccessStore";
import type { UserAccountRecord } from "@/data/studentStore";

export default function EnvoiIdentifiantPage() {
  const comptes = useUserAccounts();

  const handleEnvoyer = (compte: UserAccountRecord) => {
    envoyerMailSysteme({
      destinataireUserId: compte.id,
      destinataireLabel: compte.displayName,
      destinataireEmail: compte.email,
      objet: "Envoi identifiant de connexion",
      message: `Bonjour ${compte.displayName},\n\nVotre identifiant de connexion : ${compte.identifier}\nPortail : ${PORTAL_LABELS[compte.role]}\n\nSi vous avez oublié votre mot de passe, utilisez "Mot de passe oublié ?" sur la page de connexion.`,
    });
    toast.success(`Identifiant envoyé à ${compte.displayName}.`);
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "displayName", header: "Compte", sortable: true },
    { key: "email", header: "Email", sortable: true },
    { key: "role", header: "Portail", render: (row) => PORTAL_LABELS[(row as unknown as UserAccountRecord).role] },
    { key: "identifier", header: "Identifiant", render: (row) => <span className="font-mono text-xs">{(row as unknown as UserAccountRecord).identifier}</span> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => {
        const c = row as unknown as UserAccountRecord;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleEnvoyer(c); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
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

      <DataTable
        columns={columns}
        data={comptes as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Nom, email..."
        emptyMessage="Aucun compte."
      />
    </div>
  );
}
