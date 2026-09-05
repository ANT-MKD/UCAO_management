import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Image as ImageIcon, Eye, Download, Link2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useUserAccounts } from "@/hooks/useStudentStore";
import { useRoles } from "@/hooks/useRoleStore";
import { useTeachers } from "@/hooks/useTeacherStore";
import { creerCompteStaff, type UserAccountRecord } from "@/data/studentStore";
import { PORTAL_LABELS } from "@/data/portalAccessStore";
import { useAuth } from "@/contexts/AuthContext";
import { isPasswordValid, PASSWORD_HINT } from "@/lib/passwordPolicy";
import { generateMotDePasse } from "@/lib/inscriptionConstants";
import { exportUsersToExcel } from "@/lib/userExport";
import { cn } from "@/lib/utils";

interface CompteGenere {
  nom: string;
  identifiant: string;
  motDePasse: string;
}

const TAILLE_MAX_PHOTO_OCTETS = 400 * 1024;

const EMPTY_FORM = {
  role: "teacher" as "admin" | "teacher",
  teacherId: "",
  prenom: "",
  nom: "",
  identifier: "",
  email: "",
  telephone: "",
  fonction: "",
  roleId: "",
  password: "",
  photoDataUrl: "",
};

export default function UsersPage() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const comptes = useUserAccounts().filter((c) => c.role !== "student");
  const roles = useRoles();
  const teachers = useTeachers();
  const [roleFilter, setRoleFilter] = useState<"" | "admin" | "teacher">("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkResults, setBulkResults] = useState<CompteGenere[] | null>(null);

  const filtered = roleFilter ? comptes.filter((c) => c.role === roleFilter) : comptes;

  /** Fiches enseignant pas encore reliées à un compte de connexion — une fiche ne peut être
   * choisie que par un seul compte, jamais deux, sans quoi deux comptes se disputeraient le même
   * currentUser.linkedId. */
  const teachersDejaLies = new Set(comptes.filter((c) => c.role === "teacher" && c.linkedId).map((c) => c.linkedId));
  const teachersDisponibles = teachers.filter((t) => !teachersDejaLies.has(t.id));

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  const handlePhoto = (file: File | undefined) => {
    if (!file) return;
    if (file.size > TAILLE_MAX_PHOTO_OCTETS) {
      toast.error(`Photo trop lourde (max ${Math.round(TAILLE_MAX_PHOTO_OCTETS / 1024)} Ko).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photoDataUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const peutSauvegarder = form.prenom.trim() && form.nom.trim() && form.identifier.trim() && form.email.trim() && isPasswordValid(form.password) && (form.role !== "teacher" || form.teacherId);

  const handleSave = () => {
    if (!currentUser || !peutSauvegarder) return;
    setError("");
    try {
      creerCompteStaff(
        {
          role: form.role,
          prenom: form.prenom,
          nom: form.nom,
          identifier: form.identifier,
          email: form.email,
          password: form.password,
          telephone: form.telephone || undefined,
          fonction: form.fonction || undefined,
          roleId: form.roleId || undefined,
          photoDataUrl: form.photoDataUrl || undefined,
          linkedId: form.role === "teacher" ? form.teacherId : undefined,
        },
        currentUser.id,
      );
      toast.success("Utilisateur créé.");
      setForm(EMPTY_FORM);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    }
  };

  const handleBulkLink = () => {
    if (!currentUser) return;
    const crees: CompteGenere[] = [];
    const echecs: string[] = [];
    for (const t of teachersDisponibles) {
      const motDePasse = generateMotDePasse();
      try {
        creerCompteStaff(
          {
            role: "teacher",
            prenom: t.prenom,
            nom: t.nom,
            identifier: t.matricule,
            email: t.email?.trim() || `${t.matricule.toLowerCase()}@edumanage.local`,
            password: motDePasse,
            telephone: t.telephone,
            photoDataUrl: t.photoDataUrl,
            linkedId: t.id,
          },
          currentUser.id,
        );
        crees.push({ nom: `${t.prenom} ${t.nom}`, identifiant: t.matricule, motDePasse });
      } catch (err) {
        echecs.push(`${t.prenom} ${t.nom} (${err instanceof Error ? err.message : "erreur inconnue"})`);
      }
    }
    setBulkResults(crees);
    if (echecs.length) toast.error(`${echecs.length} fiche(s) non reliée(s) : ${echecs.join(", ")}`);
    if (crees.length) toast.success(`${crees.length} compte(s) créé(s).`);
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "displayName",
      header: "Utilisateur",
      sortable: true,
      render: (row) => {
        const c = row as unknown as UserAccountRecord;
        return (
          <div className="flex items-center gap-2.5">
            {c.photoDataUrl ? (
              <img src={c.photoDataUrl} alt={c.displayName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <UserAvatar name={c.displayName} size="sm" />
            )}
            <span className="font-medium text-foreground">{c.displayName}</span>
          </div>
        );
      },
    },
    { key: "identifier", header: "Identifiant", sortable: true, render: (row) => <span className="font-mono text-xs">{(row as unknown as UserAccountRecord).identifier}</span> },
    {
      key: "profil",
      header: "Profil",
      render: (row) => {
        const c = row as unknown as UserAccountRecord;
        const role = c.roleId ? roles.find((r) => r.id === c.roleId) : undefined;
        return (
          <div>
            <div className="text-sm">{PORTAL_LABELS[c.role]}</div>
            {c.fonction && <div className="text-[11px] text-muted-foreground">{c.fonction}</div>}
            {role && <div className="text-[11px] text-primary font-mono">{role.code}</div>}
          </div>
        );
      },
    },
    { key: "email", header: "Email", sortable: true },
    { key: "telephone", header: "Téléphone", render: (row) => (row as unknown as UserAccountRecord).telephone ?? "—" },
    {
      key: "actif",
      header: "Statut",
      render: (row) => {
        const c = row as unknown as UserAccountRecord;
        const actif = c.actif !== false;
        return (
          <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", actif ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300")}>
            {actif ? "Actif" : "Désactivé"}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => {
        const c = row as unknown as UserAccountRecord;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); setLocation(`/admin/users/${c.id}`); }}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary"
            title="Voir la fiche"
            data-testid={`user-voir-${c.id}`}
          >
            <Eye size={14} />
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Les utilisateurs" }]}
        title="Les utilisateurs"
        subtitle="Comptes réels d'administration et de professeurs — les étudiants sont gérés via l'inscription"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => exportUsersToExcel(filtered)} className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors text-muted-foreground" title="Exporter la liste" data-testid="user-export">
              <Download size={13} /> Exporter
            </button>
            {teachersDisponibles.length > 0 && (
              <button
                onClick={() => { setBulkResults(null); setBulkOpen(true); }}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors text-muted-foreground"
                title="Créer un compte pour chaque fiche enseignant sans compte"
                data-testid="user-bulk-link"
              >
                <Link2 size={13} /> Relier {teachersDisponibles.length} enseignant(s) sans compte
              </button>
            )}
            <button onClick={() => { setForm(EMPTY_FORM); setError(""); setOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors" data-testid="user-ajouter">
              <Plus size={14} /> Ajouter
            </button>
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)} className={cn(inputClass, "w-auto min-w-[180px]")} data-testid="user-filtre-profil">
          <option value="">Tous les profils</option>
          <option value="admin">{PORTAL_LABELS.admin}</option>
          <option value="teacher">{PORTAL_LABELS.teacher}</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Nom, identifiant, email..."
        onRowClick={(row) => setLocation(`/admin/users/${(row as unknown as UserAccountRecord).id}`)}
        emptyMessage="Aucun utilisateur."
      />

      <FormModal open={open} onClose={() => setOpen(false)} title="Nouvel utilisateur" size="md">
        <div className="space-y-3">
          <div>
            <label className="inline-flex items-center gap-2 text-xs text-primary cursor-pointer hover:underline">
              <ImageIcon size={13} />
              Choisir une photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0])} data-testid="user-photo-input" />
            </label>
            {form.photoDataUrl && (
              <img src={form.photoDataUrl} alt="Aperçu" className="mt-2 w-16 h-16 rounded-full object-cover border border-border" data-testid="user-photo-apercu" />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Profil *</label>
            <select
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as "admin" | "teacher";
                setForm((f) => (role === "teacher" ? { ...f, role, teacherId: "", prenom: "", nom: "" } : { ...f, role, teacherId: "" }));
              }}
              className={inputClass}
              data-testid="user-role"
            >
              <option value="teacher">{PORTAL_LABELS.teacher}</option>
              <option value="admin">{PORTAL_LABELS.admin}</option>
            </select>
          </div>

          {form.role === "teacher" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Fiche enseignant *</label>
              {teachersDisponibles.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                  Aucune fiche enseignant disponible — toutes sont déjà reliées à un compte, ou aucune n'existe encore.{" "}
                  <Link href="/admin/teachers/new" className="text-primary hover:underline font-medium">Créer une fiche enseignant</Link>.
                </p>
              ) : (
                <select
                  value={form.teacherId}
                  onChange={(e) => {
                    const t = teachersDisponibles.find((x) => x.id === e.target.value);
                    setForm((f) => ({ ...f, teacherId: e.target.value, prenom: t?.prenom ?? "", nom: t?.nom ?? "" }));
                  }}
                  className={inputClass}
                  data-testid="user-teacher-select"
                >
                  <option value="">Sélectionner une fiche...</option>
                  {teachersDisponibles.map((t) => (
                    <option key={t.id} value={t.id}>{t.prenom} {t.nom} — {t.matricule}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Prénom *</label>
              <input value={form.prenom} disabled={form.role === "teacher"} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} className={cn(inputClass, form.role === "teacher" && "opacity-60 cursor-not-allowed")} data-testid="user-prenom" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom *</label>
              <input value={form.nom} disabled={form.role === "teacher"} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className={cn(inputClass, form.role === "teacher" && "opacity-60 cursor-not-allowed")} data-testid="user-nom" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Identifiant *</label>
            <input value={form.identifier} onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))} placeholder="ex: ENS-0042" className={inputClass} data-testid="user-identifiant" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="nom@edumanage.com" className={inputClass} data-testid="user-email" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Téléphone</label>
            <input value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} className={inputClass} data-testid="user-telephone" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Fonction</label>
            <input value={form.fonction} onChange={(e) => setForm((f) => ({ ...f, fonction: e.target.value }))} placeholder="ex: Secrétariat, Gestion des professeurs..." className={inputClass} data-testid="user-fonction" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rôle (droits d'accès)</label>
            <select value={form.roleId} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))} className={inputClass} data-testid="user-role-select">
              <option value="">Aucun — accès complet</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mot de passe initial *</label>
            <input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Communicable via Envoi identifiant" className={inputClass} data-testid="user-password" />
            <p className={cn("text-[11px] mt-1", form.password && !isPasswordValid(form.password) ? "text-red-600" : "text-muted-foreground")}>{PASSWORD_HINT}</p>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>}

          <button
            onClick={handleSave}
            disabled={!peutSauvegarder}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
            data-testid="user-sauvegarder"
          >
            Sauvegarder
          </button>
        </div>
      </FormModal>

      <FormModal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Relier les enseignants sans compte" size="md">
        {!bulkResults ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {teachersDisponibles.length} fiche(s) enseignant n'ont pas encore de compte de connexion. Un compte sera créé pour chacune (identifiant = matricule, mot de passe généré) :
            </p>
            <div className="max-h-60 overflow-y-auto border border-border rounded-xl divide-y divide-border">
              {teachersDisponibles.map((t) => (
                <div key={t.id} className="px-3 py-2 flex items-center justify-between text-sm">
                  <span>{t.prenom} {t.nom}</span>
                  <span className="font-mono text-xs text-muted-foreground">{t.matricule}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleBulkLink}
              className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              data-testid="user-bulk-confirm"
            >
              Créer {teachersDisponibles.length} compte(s)
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Comptes créés — communiquez ces mots de passe aux professeurs concernés (ils pourront ensuite le changer depuis leur profil) :
            </p>
            <div className="max-h-72 overflow-y-auto border border-border rounded-xl divide-y divide-border">
              {bulkResults.map((r) => (
                <div key={r.identifiant} className="px-3 py-2 flex items-center justify-between text-sm gap-2" data-testid="user-bulk-result-row">
                  <span className="truncate">{r.nom}</span>
                  <span className="font-mono text-xs text-muted-foreground">{r.identifiant}</span>
                  <span className="font-mono text-xs font-semibold">{r.motDePasse}</span>
                </div>
              ))}
              {bulkResults.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Aucun compte créé.</p>}
            </div>
            <button onClick={() => setBulkOpen(false)} className="w-full px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
              Fermer
            </button>
          </div>
        )}
      </FormModal>
    </div>
  );
}
