import { useState } from "react";
import { Plus, Edit, Trash2, Shield, User, Eye, EyeOff, CheckCircle, X } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { cn } from "@/lib/utils";

type Role = "superadmin" | "admin" | "directeur" | "secretaire" | "comptable" | "enseignant";

interface UserEntry {
  id: string;
  nom: string;
  email: string;
  role: Role;
  statut: "actif" | "inactif" | "suspendu";
  derniereConnexion: string;
  creeLe: string;
}

const USERS: UserEntry[] = [
  { id: "u1", nom: "Ousmane DIALLO", email: "admin@edumanage.com", role: "superadmin", statut: "actif", derniereConnexion: "Aujourd'hui 09:42", creeLe: "2023-09-01" },
  { id: "u2", nom: "Fatou NDIAYE", email: "directrice@edumanage.com", role: "directeur", statut: "actif", derniereConnexion: "Hier 16:30", creeLe: "2023-09-01" },
  { id: "u3", nom: "Ibrahima DIOP", email: "secretariat@edumanage.com", role: "secretaire", statut: "actif", derniereConnexion: "Aujourd'hui 08:15", creeLe: "2024-01-15" },
  { id: "u4", nom: "Mariama TOURE", email: "compta@edumanage.com", role: "comptable", statut: "actif", derniereConnexion: "Il y a 2j", creeLe: "2024-01-15" },
  { id: "u5", nom: "Pr. Cheikh FALL", email: "prof@edumanage.com", role: "enseignant", statut: "actif", derniereConnexion: "Aujourd'hui 11:05", creeLe: "2024-09-01" },
  { id: "u6", nom: "Dr. Aminata DIALLO", email: "aminata.diallo@edumanage.com", role: "enseignant", statut: "inactif", derniereConnexion: "Il y a 5j", creeLe: "2024-09-01" },
  { id: "u7", nom: "Seydou MBAYE", email: "s.mbaye@edumanage.com", role: "admin", statut: "suspendu", derniereConnexion: "Il y a 30j", creeLe: "2024-03-10" },
];

const ROLE_META: Record<Role, { label: string; cls: string; desc: string; color: string; bg: string }> = {
  superadmin: { label: "Super Admin", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300", desc: "Accès total au système", color: "#ef4444", bg: "#fef2f2" },
  admin: { label: "Administrateur", cls: "bg-primary/10 text-primary", desc: "Gestion complète sauf paramètres critiques", color: "#4f46e5", bg: "#eef2ff" },
  directeur: { label: "Directeur", cls: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300", desc: "Consultation + validation notes/délibérations", color: "#8b5cf6", bg: "#f5f3ff" },
  secretaire: { label: "Secrétariat", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300", desc: "Gestion étudiants, inscriptions, planning", color: "#3b82f6", bg: "#eff6ff" },
  comptable: { label: "Comptable", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", desc: "Finances, paiements, vacations", color: "#10b981", bg: "#ecfdf5" },
  enseignant: { label: "Enseignant", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300", desc: "Saisie notes, consultation planning", color: "#f59e0b", bg: "#fffbeb" },
};

const STATUT_META = {
  actif: { label: "Actif", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  inactif: { label: "Inactif", cls: "bg-muted text-muted-foreground" },
  suspendu: { label: "Suspendu", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

interface FormData {
  nom: string;
  email: string;
  role: Role;
  motdepasse: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState(USERS);
  const [filterRole, setFilterRole] = useState<Role | "">("");
  const [filterStatut, setFilterStatut] = useState<"" | "actif" | "inactif" | "suspendu">("");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserEntry | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ nom: "", email: "", role: "enseignant", motdepasse: "" });

  const filtered = users.filter((u) =>
    (!filterRole || u.role === filterRole) &&
    (!filterStatut || u.statut === filterStatut)
  );

  const openNew = () => {
    setEditUser(null);
    setForm({ nom: "", email: "", role: "enseignant", motdepasse: "" });
    setShowModal(true);
  };

  const openEdit = (u: UserEntry) => {
    setEditUser(u);
    setForm({ nom: u.nom, email: u.email, role: u.role, motdepasse: "" });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.nom || !form.email) return;
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowModal(false); }, 1500);
  };

  const handleDelete = () => {
    if (deleteTarget) { setUsers((prev) => prev.filter((u) => u.id !== deleteTarget)); setDeleteTarget(null); }
  };

  const roleStats = Object.entries(ROLE_META).map(([key, meta]) => ({
    role: key as Role,
    ...meta,
    count: users.filter((u) => u.role === key).length,
  }));

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Paramètres" }, { label: "Comptes & Rôles" }]}
        title="Comptes & Rôles"
        subtitle="Gestion des accès utilisateurs — permissions par rôle, création et suspension de comptes"
        actions={
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={14} /> Nouveau compte
          </button>
        }
      />

      {/* Role stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {roleStats.map((r) => (
          <button
            key={r.role}
            onClick={() => setFilterRole(filterRole === r.role ? "" : r.role)}
            className={cn(
              "bg-card border rounded-xl p-3 text-center transition-all hover:shadow-md",
              filterRole === r.role ? "border-primary ring-1 ring-primary/20" : "border-border hover:border-primary/30"
            )}
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: r.bg }}>
              <Shield size={14} style={{ color: r.color }} />
            </div>
            <div className="text-xl font-bold text-foreground">{r.count}</div>
            <div className="text-[10px] text-muted-foreground leading-tight">{r.label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value as typeof filterStatut)} className="px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
          <option value="suspendu">Suspendu</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} compte(s)</span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Utilisateur", "Email", "Rôle", "Statut", "Dernière connexion", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const role = ROLE_META[u.role];
              const statut = STATUT_META[u.statut];
              return (
                <tr key={u.id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.nom} size="sm" />
                      <span className="font-medium text-foreground">{u.nom}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", role.cls)}>{role.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", statut.cls)}>{statut.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.derniereConnexion}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="Modifier">
                        <Edit size={13} />
                      </button>
                      {u.role !== "superadmin" && (
                        <button onClick={() => setDeleteTarget(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 text-muted-foreground hover:text-red-500 transition-colors" title="Supprimer">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Permissions matrix */}
      <div className="bg-card border border-border rounded-xl p-5 mt-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <h3 className="font-bold text-foreground mb-4">Matrice des Permissions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Module</th>
                {Object.entries(ROLE_META).map(([r, m]) => (
                  <th key={r} className="text-center py-2 px-2 font-semibold text-muted-foreground">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { module: "Dashboard", perms: [true, true, true, true, false, false] },
                { module: "Gestion étudiants", perms: [true, true, true, true, false, false] },
                { module: "Gestion enseignants", perms: [true, true, true, false, false, false] },
                { module: "Saisie des notes", perms: [true, true, false, false, false, true] },
                { module: "Délibérations", perms: [true, true, true, false, false, false] },
                { module: "Finances", perms: [true, true, false, false, true, false] },
                { module: "Planning", perms: [true, true, false, true, false, true] },
                { module: "Paramètres", perms: [true, false, false, false, false, false] },
              ].map((row) => (
                <tr key={row.module} className="border-b border-border/60 hover:bg-muted/20">
                  <td className="py-2.5 pr-4 font-medium text-foreground">{row.module}</td>
                  {row.perms.map((has, i) => (
                    <td key={i} className="text-center py-2.5 px-2">
                      {has ? (
                        <CheckCircle size={14} className="mx-auto text-emerald-500" />
                      ) : (
                        <X size={14} className="mx-auto text-muted-foreground/30" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-5">{editUser ? "Modifier le compte" : "Créer un nouveau compte"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom complet *</label>
                <input value={form.nom} onChange={(e) => setForm(p => ({ ...p, nom: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Prénom NOM" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="email@edumanage.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rôle *</label>
                <select value={form.role} onChange={(e) => setForm(p => ({ ...p, role: e.target.value as Role }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {Object.entries(ROLE_META).filter(([r]) => r !== "superadmin").map(([r, m]) => <option key={r} value={r}>{m.label} — {m.desc}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{editUser ? "Nouveau mot de passe (laisser vide = inchangé)" : "Mot de passe *"}</label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} value={form.motdepasse} onChange={(e) => setForm(p => ({ ...p, motdepasse: e.target.value }))} className="w-full px-3 py-2.5 pr-10 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
              <button onClick={handleSave} className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
                {saved ? <><CheckCircle size={14} /> Enregistré</> : <>{editUser ? "Enregistrer" : "Créer le compte"}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-foreground mb-2">Supprimer ce compte ?</h3>
            <p className="text-sm text-muted-foreground mb-5">Cette action est irréversible. L'utilisateur perdra immédiatement son accès.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
              <button onClick={handleDelete} className="px-5 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
