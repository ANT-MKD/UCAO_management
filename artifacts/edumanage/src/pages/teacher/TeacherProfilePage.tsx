import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  User,
  GraduationCap,
  ShieldCheck,
  Sliders,
  Edit,
  KeyRound,
  Camera,
  CheckCircle2,
  AlertCircle,
  LogIn,
  Send,
  Sun,
  Moon,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { updateTeacher, type TeacherInput } from "@/data/teacherStore";
import { changeOwnPassword, type AuditLogRecord } from "@/data/studentStore";
import { useAuditLogs, useUserAccount } from "@/hooks/useStudentStore";
import { useTeachers } from "@/hooks/useTeacherStore";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { FormModal } from "@/components/admin/FormModal";
import { cn, formatDate } from "@/lib/utils";

type Tab = "personnelles" | "professionnelles" | "securite" | "preferences";

const ACTION_INFO: Record<string, { label: string; icon: React.ElementType }> = {
  login: { label: "Connexion réussie", icon: LogIn },
  send_message: { label: "Message envoyé", icon: Send },
  update_teacher: { label: "Informations personnelles modifiées", icon: Edit },
  update_password: { label: "Mot de passe modifié", icon: KeyRound },
};

function activityLabel(log: AuditLogRecord): { label: string; icon: React.ElementType } {
  return ACTION_INFO[log.action] ?? { label: log.action, icon: Edit };
}

function activityDateLabel(dateStr: string): string {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const day = dateStr.slice(0, 10);
  const time = new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (day === today) return `Aujourd'hui à ${time}`;
  if (day === yesterday) return `Hier à ${time}`;
  return `${formatDate(dateStr)} à ${time}`;
}

/** Même structure que StudentProfilePage.tsx, adaptée aux vrais champs d'une fiche enseignant
 * (teacherStore.ts) : pas d'informations académiques (filière/classe) mais spécialité, grade et
 * charge horaire réelles ; la modification passe par updateTeacher(), déjà utilisée côté admin. */
export default function TeacherProfilePage() {
  const { currentUser } = useAuth();
  const teachers = useTeachers();
  const teacher = useMemo(() => teachers.find((t) => t.id === currentUser?.linkedId) ?? null, [teachers, currentUser?.linkedId]);
  const account = useUserAccount(currentUser?.id ?? "");
  const auditLogs = useAuditLogs();
  const { theme, toggleTheme } = useTheme();

  const [tab, setTab] = useState<Tab>("personnelles");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [telephone, setTelephone] = useState(teacher?.telephone ?? "");
  const [adresse, setAdresse] = useState(teacher?.adresse ?? "");
  const [photoDataUrl, setPhotoDataUrl] = useState(teacher?.photoDataUrl ?? "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mesActivites = useMemo(
    () => auditLogs.filter((a) => a.actorUserId === currentUser?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    [auditLogs, currentUser?.id],
  );

  if (!teacher) return <p className="text-sm text-muted-foreground">Compte non rattaché à une fiche professeur.</p>;

  const contactComplet = !!(teacher.telephone && teacher.email);
  const infosCompletes = !!(teacher.specialite && teacher.grade);
  const securiteRenforcee = !!account?.passwordUpdatedAt;

  const openEditModal = () => {
    setTelephone(teacher.telephone ?? "");
    setAdresse(teacher.adresse ?? "");
    setPhotoDataUrl(teacher.photoDataUrl ?? "");
    setShowEditModal(true);
  };

  const handlePhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSaveInfos = () => {
    if (!currentUser) return;
    const patch: Partial<TeacherInput> = {
      telephone: telephone.trim() || undefined,
      adresse: adresse.trim() || undefined,
      photoDataUrl: photoDataUrl || undefined,
    };
    updateTeacher(teacher.id, patch, currentUser.id);
    toast.success("Informations mises à jour.");
    setShowEditModal(false);
  };

  const handleChangePassword = () => {
    if (!currentUser) return;
    if (newPassword.length < 6) {
      toast.error("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    const ok = changeOwnPassword(currentUser.id, currentPassword, newPassword);
    if (!ok) {
      toast.error("Mot de passe actuel incorrect.");
      return;
    }
    toast.success("Mot de passe modifié.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordModal(false);
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex flex-col items-center gap-2">
            <UserAvatar name={`${teacher.prenom} ${teacher.nom}`} src={teacher.photoDataUrl} size="lg" className="!w-20 !h-20 !text-xl" />
            <button type="button" onClick={openEditModal} className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="profil-changer-photo">
              <Camera size={12} /> Changer la photo
            </button>
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>{teacher.prenom} {teacher.nom}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">{teacher.grade}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-2 text-sm">
              <p className="text-muted-foreground">Matricule <span className="text-foreground font-medium ml-1">{teacher.matricule}</span></p>
              <p className="text-muted-foreground">Téléphone <span className="text-foreground font-medium ml-1">{teacher.telephone || "—"}</span></p>
              <p className="text-muted-foreground">Email <span className="text-foreground font-medium ml-1">{teacher.email || "—"}</span></p>
              <p className="text-muted-foreground">Spécialité <span className="text-foreground font-medium ml-1">{teacher.specialite}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5">
        {(
          [
            ["personnelles", "Informations personnelles", User],
            ["professionnelles", "Informations professionnelles", GraduationCap],
            ["securite", "Sécurité", ShieldCheck],
            ["preferences", "Préférences", Sliders],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
              tab === key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted",
            )}
            data-testid={`profil-onglet-${key}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          {tab === "personnelles" && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Informations personnelles</h3>
                <button type="button" onClick={openEditModal} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline" data-testid="profil-modifier">
                  <Edit size={13} /> Modifier
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Nom</p><p className="font-medium text-foreground mt-0.5">{teacher.nom}</p></div>
                <div><p className="text-xs text-muted-foreground">Prénom</p><p className="font-medium text-foreground mt-0.5">{teacher.prenom}</p></div>
                <div><p className="text-xs text-muted-foreground">Téléphone</p><p className="font-medium text-foreground mt-0.5">{teacher.telephone || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Adresse</p><p className="font-medium text-foreground mt-0.5">{teacher.adresse || "—"}</p></div>
              </div>
            </div>
          )}

          {tab === "professionnelles" && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">Informations professionnelles</h3>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Spécialité</p><p className="font-medium text-foreground mt-0.5">{teacher.specialite}</p></div>
                <div><p className="text-xs text-muted-foreground">Grade</p><p className="font-medium text-foreground mt-0.5">{teacher.grade}</p></div>
                <div><p className="text-xs text-muted-foreground">Taux horaire</p><p className="font-medium text-foreground mt-0.5">{teacher.tauxHoraire.toLocaleString("fr-FR")} FCFA/h</p></div>
                <div><p className="text-xs text-muted-foreground">Modules assignés</p><p className="font-medium text-foreground mt-0.5">{teacher.modulesAssignes}</p></div>
                <div><p className="text-xs text-muted-foreground">Heures ce mois</p><p className="font-medium text-foreground mt-0.5">{teacher.heuresMois} h</p></div>
              </div>
            </div>
          )}

          {tab === "securite" && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-bold text-foreground">Sécurité du compte</h3>
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Mot de passe</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {account?.passwordUpdatedAt ? `Dernière modification : ${formatDate(account.passwordUpdatedAt)}` : "Jamais modifié depuis la création du compte"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted"
                  data-testid="profil-changer-mdp"
                >
                  <KeyRound size={14} /> Changer
                </button>
              </div>
              <div className="p-3 rounded-xl border border-border">
                <p className="text-sm font-medium text-foreground">Dernière connexion</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mesActivites.find((a) => a.action === "login") ? activityDateLabel(mesActivites.find((a) => a.action === "login")!.createdAt) : "—"}
                </p>
              </div>
            </div>
          )}

          {tab === "preferences" && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">Préférences d'affichage</h3>
              <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                <div className="flex items-center gap-2.5">
                  {theme === "dark" ? <Moon size={16} className="text-primary" /> : <Sun size={16} className="text-primary" />}
                  <div>
                    <p className="text-sm font-medium text-foreground">Thème {theme === "dark" ? "sombre" : "clair"}</p>
                    <p className="text-xs text-muted-foreground">Change l'apparence de tout le portail</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={cn("relative w-11 h-6 rounded-full transition-colors flex-shrink-0", theme === "dark" ? "bg-primary" : "bg-muted")}
                  data-testid="profil-toggle-theme"
                >
                  <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform", theme === "dark" ? "translate-x-5" : "translate-x-0.5")} />
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Activités récentes</h3>
            {mesActivites.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Aucune activité enregistrée.</p>
            ) : (
              <div className="space-y-3">
                {mesActivites.map((a) => {
                  const info = activityLabel(a);
                  return (
                    <div key={a.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <info.icon size={14} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{info.label}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">{activityDateLabel(a.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Actions rapides</h3>
            <div className="space-y-1">
              {[
                { label: "Modifier mes informations", icon: Edit, onClick: openEditModal, testId: "action-modifier" },
                { label: "Changer mon mot de passe", icon: KeyRound, onClick: () => setShowPasswordModal(true), testId: "action-mdp" },
              ].map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={a.onClick}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2.5 rounded-xl hover:bg-muted transition-colors text-left"
                  data-testid={a.testId}
                >
                  <span className="flex items-center gap-2.5 text-sm text-foreground"><a.icon size={15} className="text-primary" /> {a.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Résumé de mes informations</h3>
            <div className="space-y-2">
              {[
                { label: "Informations personnelles", ok: infosCompletes },
                { label: "Contact", ok: contactComplet },
                { label: "Sécurité", ok: securiteRenforcee },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className={cn("flex items-center gap-1 text-xs font-medium", r.ok ? "text-emerald-600" : "text-amber-600")}>
                    {r.ok ? "Complètes" : r.label === "Sécurité" ? "À renforcer" : "À compléter"}
                    {r.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><MessageSquare size={15} className="text-primary" /> Besoin d'aide ?</h3>
            <p className="text-xs text-muted-foreground mb-3">Pour toute question administrative, contactez le service scolarité.</p>
            <Link href="/teacher/messages" className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
              Contacter le service
            </Link>
          </div>
        </div>
      </div>

      <FormModal open={showEditModal} onClose={() => setShowEditModal(false)} title="Modifier mes informations">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Photo</label>
            <div className="flex items-center gap-3">
              <UserAvatar name={`${teacher.prenom} ${teacher.nom}`} src={photoDataUrl} size="md" />
              <label className="px-3 py-2 rounded-xl border border-border text-xs font-medium cursor-pointer hover:bg-muted">
                Choisir une photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0])} data-testid="profil-photo-input" />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Téléphone</label>
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className={inputClass} data-testid="profil-telephone" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Adresse</label>
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className={inputClass} data-testid="profil-adresse" />
          </div>
          <button onClick={handleSaveInfos} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90" data-testid="profil-enregistrer">
            Enregistrer
          </button>
        </div>
      </FormModal>

      <FormModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Changer mon mot de passe">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mot de passe actuel</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} data-testid="mdp-actuel" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nouveau mot de passe</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} data-testid="mdp-nouveau" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirmer le nouveau mot de passe</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} data-testid="mdp-confirmer" />
          </div>
          <button onClick={handleChangePassword} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90" data-testid="mdp-enregistrer">
            Changer le mot de passe
          </button>
        </div>
      </FormModal>
    </div>
  );
}
