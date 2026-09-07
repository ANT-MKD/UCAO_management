import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Mail, Phone, ShieldCheck, ShieldOff, KeyRound, Pencil, Image as ImageIcon, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { FormModal } from "@/components/admin/FormModal";
import { useUserAccount, useUserAccounts, useAuditLogs } from "@/hooks/useStudentStore";
import { useRoles } from "@/hooks/useRoleStore";
import { setUserAccountActif, updateUserAccountInfo } from "@/data/studentStore";
import { usePortalAccess } from "@/hooks/usePortalAccessStore";
import { PORTAL_LABELS } from "@/data/portalAccessStore";
import { genererPin } from "@/data/pinActivationStore";
import { envoyerMailSysteme } from "@/data/mailEnvoyeStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const TAILLE_MAX_PHOTO_OCTETS = 400 * 1024;

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function UserDetailPage({ id }: { id: string }) {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const compte = useUserAccount(id);
  const comptes = useUserAccounts();
  const logs = useAuditLogs();
  const portails = usePortalAccess();
  const roles = useRoles();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: "", email: "", telephone: "", fonction: "", roleId: "", photoDataUrl: "" });
  const [dernierPin, setDernierPin] = useState<string | null>(null);

  const acteurById = useMemo(() => new Map(comptes.map((c) => [c.id, c.displayName])), [comptes]);

  const creation = useMemo(
    () => logs.find((l) => l.targetType === "user_account" && l.targetId === id && l.action === "create_user_account"),
    [logs, id],
  );

  const derniereConnexion = useMemo(
    () => logs.find((l) => l.targetType === "user_account" && l.targetId === id && l.action === "login"),
    [logs, id],
  );

  if (!compte) {
    return (
      <div>
        <PageHeader breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Fiche utilisateur" }]} title="Utilisateur introuvable" />
        <button onClick={() => setLocation("/admin/users")} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft size={14} /> Retour à la liste
        </button>
      </div>
    );
  }

  const actif = compte.actif !== false;
  const portailActif = portails[compte.role];

  const roleAssigne = compte.roleId ? roles.find((r) => r.id === compte.roleId) : undefined;

  const openEdit = () => {
    setEditForm({
      displayName: compte.displayName,
      email: compte.email,
      telephone: compte.telephone ?? "",
      fonction: compte.fonction ?? "",
      roleId: compte.roleId ?? "",
      photoDataUrl: compte.photoDataUrl ?? "",
    });
    setEditOpen(true);
  };

  const handlePhoto = (file: File | undefined) => {
    if (!file) return;
    if (file.size > TAILLE_MAX_PHOTO_OCTETS) {
      toast.error(`Photo trop lourde (max ${Math.round(TAILLE_MAX_PHOTO_OCTETS / 1024)} Ko).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditForm((f) => ({ ...f, photoDataUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = () => {
    if (!currentUser || !editForm.displayName.trim() || !editForm.email.trim()) return;
    updateUserAccountInfo(compte.id, editForm, currentUser.id);
    toast.success("Utilisateur mis à jour.");
    setEditOpen(false);
  };

  const handleToggleActif = () => {
    if (!currentUser) return;
    setUserAccountActif(compte.id, !actif, currentUser.id);
    toast.success(actif ? "Compte désactivé." : "Compte réactivé.");
  };

  const handleGenererPin = () => {
    if (!currentUser) return;
    const record = genererPin(compte.id, compte.displayName, compte.identifier, currentUser.id, currentUser.name);
    envoyerMailSysteme({
      destinataireUserId: compte.id,
      destinataireLabel: compte.displayName,
      destinataireEmail: compte.email,
      objet: "Code de validation",
      message: `Votre pin de réinitialisation de mot de passe: ${record.pin}`,
    });
    setDernierPin(record.pin);
    toast.success("Code PIN généré et envoyé.");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Sécurité" },
          { label: "Les utilisateurs", href: "/admin/users" },
          { label: "Fiche utilisateur" },
        ]}
        title="Fiche utilisateur"
        actions={
          <button onClick={openEdit} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline" data-testid="user-editer">
            <Pencil size={13} /> Éditer
          </button>
        }
      />

      <div className="bg-card border border-border rounded-2xl p-6 grid md:grid-cols-[200px_1fr] gap-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex flex-col items-center text-center gap-2">
          {compte.photoDataUrl ? (
            <img src={compte.photoDataUrl} alt={compte.displayName} className="w-28 h-28 rounded-full object-cover" />
          ) : (
            <UserAvatar name={compte.displayName} size="lg" />
          )}
          <span className="font-mono text-xs text-primary font-semibold">{compte.identifier}</span>
          <p className="font-bold text-foreground">{compte.displayName}</p>
          <button
            onClick={handleToggleActif}
            title={actif ? "Bloque immédiatement toute session déjà ouverte, pas seulement les prochaines connexions" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium hover:underline",
              actif ? "text-red-600" : "text-emerald-600",
            )}
            data-testid="user-toggle-actif"
          >
            {actif ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
            {actif ? "Désactiver le compte" : "Réactiver le compte"}
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck size={14} className="text-primary" />
            <span className="font-medium">{PORTAL_LABELS[compte.role]}</span>
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", actif ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300")}>
              {actif ? "Actif" : "Désactivé"}
            </span>
          </div>
          <a href={`mailto:${compte.email}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary">
            <Mail size={14} className="text-muted-foreground" /> {compte.email}
          </a>
          {compte.telephone && (
            <a href={`tel:${compte.telephone}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary">
              <Phone size={14} className="text-muted-foreground" /> {compte.telephone}
            </a>
          )}

          {creation && (
            <p className="text-xs text-muted-foreground" data-testid="user-cree-par">
              Compte créé par <span className="font-medium text-foreground">{acteurById.get(creation.actorUserId) ?? creation.actorUserId}</span> le {formatDateTime(creation.createdAt)}
            </p>
          )}

          <p className="text-xs text-muted-foreground" data-testid="user-derniere-connexion">
            Dernière connexion : {derniereConnexion ? <span className="font-medium text-foreground">{formatDateTime(derniereConnexion.createdAt)}</span> : <span className="italic">jamais connecté</span>}
          </p>

          {compte.fonction && (
            <div className="bg-muted/40 rounded-lg px-3 py-2 text-sm font-medium text-foreground" data-testid="user-fonction-affichee">
              {compte.fonction}
            </div>
          )}

          <div className="text-sm">
            <span className="text-muted-foreground">Rôle : </span>
            {roleAssigne ? (
              <button onClick={() => setLocation(`/admin/roles/${roleAssigne.id}`)} className="font-mono font-medium text-primary hover:underline" data-testid="user-role-affiche">
                {roleAssigne.code}
              </button>
            ) : (
              <span className="text-muted-foreground italic" data-testid="user-role-affiche">Aucun — accès complet</span>
            )}
          </div>

          <div className="border-t border-border pt-3 mt-3">
            <button onClick={handleGenererPin} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline" data-testid="user-generer-pin">
              <KeyRound size={13} /> Générer code pin activation
            </button>
            {dernierPin && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Code envoyé : <span className="font-mono font-bold" data-testid="user-dernier-pin">{dernierPin}</span> (aussi visible dans Mails envoyés)
              </p>
            )}
          </div>

          <div className="border-t border-border pt-3 mt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Droits d'accès</p>
            <div className="flex items-center gap-2 text-sm">
              {portailActif ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-red-600" />}
              <span>
                Portail {PORTAL_LABELS[compte.role]} : {portailActif ? "actif" : "désactivé pour tous les comptes de ce rôle"}
              </span>
            </div>
            <button onClick={() => setLocation("/admin/security/portails")} className="text-xs text-primary hover:underline mt-1" data-testid="user-verifier-droits">
              Vérifier les droits d'accès (Portails)
            </button>
          </div>
        </div>
      </div>

      <FormModal open={editOpen} onClose={() => setEditOpen(false)} title="Éditer l'utilisateur" size="md">
        <div className="space-y-3">
          <div>
            <label className="inline-flex items-center gap-2 text-xs text-primary cursor-pointer hover:underline">
              <ImageIcon size={13} />
              Changer la photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0])} data-testid="user-edit-photo-input" />
            </label>
            {editForm.photoDataUrl && (
              <img src={editForm.photoDataUrl} alt="Aperçu" className="mt-2 w-16 h-16 rounded-full object-cover border border-border" />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom complet *</label>
            <input value={editForm.displayName} onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="user-edit-nom" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email *</label>
            <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="user-edit-email" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Téléphone</label>
            <input value={editForm.telephone} onChange={(e) => setEditForm((f) => ({ ...f, telephone: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="user-edit-telephone" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Fonction</label>
            <input value={editForm.fonction} onChange={(e) => setEditForm((f) => ({ ...f, fonction: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="user-edit-fonction" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rôle (droits d'accès)</label>
            <select value={editForm.roleId} onChange={(e) => setEditForm((f) => ({ ...f, roleId: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="user-edit-role-select">
              <option value="">Aucun — accès complet</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
            </select>
          </div>
          <button
            onClick={handleSaveEdit}
            disabled={!editForm.displayName.trim() || !editForm.email.trim()}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
            data-testid="user-edit-sauvegarder"
          >
            Sauvegarder
          </button>
        </div>
      </FormModal>
    </div>
  );
}
