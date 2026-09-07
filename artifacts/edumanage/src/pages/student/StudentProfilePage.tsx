import { useMemo, useState } from "react";
import { Link } from "wouter";
import { renderToStaticMarkup } from "react-dom/server";
import {
  User,
  GraduationCap,
  ShieldCheck,
  Sliders,
  Edit,
  KeyRound,
  Printer,
  Camera,
  Building2,
  CheckCircle2,
  AlertCircle,
  LogIn,
  Send,
  FileText,
  Ban,
  MessageSquare,
  Sun,
  Moon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { updateEtudiantInfos, changeOwnPassword, type EtudiantInfosPayload, type AuditLogRecord } from "@/data/studentStore";
import { useStudentStore, useInscriptions, useUserAccount, useAuditLogs } from "@/hooks/useStudentStore";
import { getEtablissement } from "@/data/etablissementStore";
import { DOCUMENTS_INSCRIPTION } from "@/lib/inscriptionConstants";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { StudentQrCode } from "@/components/admin/StudentQrCode";
import { FormModal } from "@/components/admin/FormModal";
import { cn, formatDate } from "@/lib/utils";

type Tab = "personnelles" | "academiques" | "securite" | "preferences";

const STATUT_STYLES: Record<string, { label: string; className: string }> = {
  inscrit: { label: "Étudiant actif", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  preinscrit: { label: "Préinscrit", className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  suspendu: { label: "Suspendu", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  abandon: { label: "Dossier abandonné", className: "bg-muted text-muted-foreground" },
};

const ACTION_INFO: Record<string, { label: string; icon: React.ElementType }> = {
  login: { label: "Connexion réussie", icon: LogIn },
  send_message: { label: "Message envoyé", icon: Send },
  create_request: { label: "Nouvelle demande envoyée", icon: FileText },
  cancel_request: { label: "Demande annulée", icon: Ban },
  update_etudiant_infos: { label: "Informations personnelles modifiées", icon: Edit },
  update_password: { label: "Mot de passe modifié", icon: KeyRound },
};

function activityLabel(log: AuditLogRecord): { label: string; icon: React.ElementType; showMeta: boolean } {
  const info = ACTION_INFO[log.action];
  if (info) return { ...info, showMeta: log.action === "create_request" || log.action === "cancel_request" };
  return { label: log.action, icon: FileText, showMeta: false };
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

function printHtmlShell(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body{font-family:system-ui;padding:24px;color:#0f172a}
      h1{font-size:18px;margin:0 0 4px}
      h2{font-size:13px;margin:20px 0 8px;text-transform:uppercase;color:#64748b}
      table{width:100%;border-collapse:collapse}
      td{padding:6px 0;border-bottom:1px solid #eee;font-size:13px}
      td:first-child{color:#64748b;width:40%}
      .muted{color:#64748b;font-size:12px}
    </style>
    </head><body>${body}<script>window.print()</script></body></html>`;
}

export default function StudentProfilePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const account = useUserAccount(currentUser?.id ?? "");
  const inscriptions = useInscriptions(student?.id ?? "");
  const auditLogs = useAuditLogs();
  const { theme, toggleTheme } = useTheme();
  const etablissement = getEtablissement();

  const [tab, setTab] = useState<Tab>("personnelles");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [adresse, setAdresse] = useState(student?.adresse ?? "");
  const [telephone, setTelephone] = useState(student?.telephone ?? "");
  const [nomTuteur, setNomTuteur] = useState(student?.nomTuteur ?? "");
  const [telTuteur, setTelTuteur] = useState(student?.telTuteur ?? "");
  const [photoDataUrl, setPhotoDataUrl] = useState(student?.photoDataUrl ?? "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const premiereInscription = useMemo(
    () => [...inscriptions].sort((a, b) => a.dateInscription.localeCompare(b.dateInscription))[0],
    [inscriptions],
  );

  const mesActivites = useMemo(
    () => auditLogs.filter((a) => a.actorUserId === currentUser?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    [auditLogs, currentUser?.id],
  );

  if (!student) return <p className="text-sm text-muted-foreground">Profil introuvable.</p>;

  const statutStyle = STATUT_STYLES[student.statut] ?? { label: student.statut, className: "bg-muted text-muted-foreground" };

  const personnellesCompletes = !!(student.adresse && student.lieuNaissance && student.nationalite && student.cni);
  const academiquesCompletes = !!student.classeId;
  const contactComplet = !!(student.telephone && student.email);
  const securiteRenforcee = !!account?.passwordUpdatedAt;

  const openEditModal = () => {
    setAdresse(student.adresse ?? "");
    setTelephone(student.telephone ?? "");
    setNomTuteur(student.nomTuteur ?? "");
    setTelTuteur(student.telTuteur ?? "");
    setPhotoDataUrl(student.photoDataUrl ?? "");
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
    const payload: EtudiantInfosPayload = {
      adresse: adresse.trim() || undefined,
      telephone: telephone.trim() || undefined,
      nomTuteur: nomTuteur.trim() || undefined,
      telTuteur: telTuteur.trim() || undefined,
      photoDataUrl: photoDataUrl || undefined,
    };
    updateEtudiantInfos(student.id, payload, currentUser.id);
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

  const printCarte = () => {
    const qrHtml = renderToStaticMarkup(<StudentQrCode value={student.matricule} size={110} />);
    const w = window.open("", "_blank", "width=420,height=620");
    if (!w) return;
    w.document.write(printHtmlShell(
      `Carte étudiant — ${student.matricule}`,
      `<div style="border:2px solid #4f46e5;border-radius:16px;padding:20px;max-width:320px">
        <p style="font-weight:700;color:#4f46e5;margin:0 0 12px">${etablissement.nom}</p>
        <p style="font-weight:700;font-size:16px;margin:0">${student.prenom} ${student.nom.toUpperCase()}</p>
        <p class="muted" style="margin:2px 0 12px">${student.filiere} — ${student.niveau}</p>
        <div style="display:flex;align-items:center;gap:10px">
          ${qrHtml}
          <div>
            <p style="font-family:monospace;font-weight:700;margin:0">${student.matricule}</p>
            <p class="muted" style="margin:2px 0">${student.annee}</p>
          </div>
        </div>
      </div>`,
    ));
    w.document.close();
  };

  const printInfos = () => {
    const w = window.open("", "_blank", "width=480,height=700");
    if (!w) return;
    w.document.write(printHtmlShell(
      `Fiche étudiant — ${student.matricule}`,
      `<h1>${student.prenom} ${student.nom}</h1>
      <p class="muted">${student.matricule} — ${statutStyle.label}</p>
      <h2>Informations personnelles</h2>
      <table>
        <tr><td>Date de naissance</td><td>${formatDate(student.dateNaissance)}</td></tr>
        <tr><td>Lieu de naissance</td><td>${student.lieuNaissance || "—"}</td></tr>
        <tr><td>Nationalité</td><td>${student.nationalite || "—"}</td></tr>
        <tr><td>Sexe</td><td>${student.sexe === "F" ? "Féminin" : "Masculin"}</td></tr>
        <tr><td>Adresse</td><td>${student.adresse || "—"}</td></tr>
        <tr><td>Téléphone</td><td>${student.telephone || "—"}</td></tr>
        <tr><td>Email</td><td>${student.email}</td></tr>
      </table>
      <h2>Informations académiques</h2>
      <table>
        <tr><td>Établissement</td><td>${etablissement.nom}</td></tr>
        <tr><td>Filière</td><td>${student.filiere}</td></tr>
        <tr><td>Niveau</td><td>${student.niveau}</td></tr>
        <tr><td>Classe</td><td>${student.classe}</td></tr>
        <tr><td>Statut</td><td>${statutStyle.label}</td></tr>
        <tr><td>Année académique</td><td>${student.annee}</td></tr>
      </table>`,
    ));
    w.document.close();
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex flex-col items-center gap-2">
            <UserAvatar name={`${student.prenom} ${student.nom}`} src={student.photoDataUrl} size="lg" className="!w-20 !h-20 !text-xl" />
            <button type="button" onClick={openEditModal} className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="profil-changer-photo">
              <Camera size={12} /> Changer la photo
            </button>
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>{student.prenom} {student.nom}</h2>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statutStyle.className)}>{statutStyle.label}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-2 text-sm">
              <p className="text-muted-foreground">Matricule <span className="text-foreground font-medium ml-1">{student.matricule}</span></p>
              <p className="text-muted-foreground">Téléphone <span className="text-foreground font-medium ml-1">{student.telephone || "—"}</span></p>
              <p className="text-muted-foreground">Email <span className="text-foreground font-medium ml-1">{student.email}</span></p>
              {premiereInscription && (
                <p className="text-muted-foreground">Date d'inscription <span className="text-foreground font-medium ml-1">{formatDate(premiereInscription.dateInscription)}</span></p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5">
        {(
          [
            ["personnelles", "Informations personnelles", User],
            ["academiques", "Informations académiques", GraduationCap],
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
                <div><p className="text-xs text-muted-foreground">Nom</p><p className="font-medium text-foreground mt-0.5">{student.nom}</p></div>
                <div><p className="text-xs text-muted-foreground">Prénom</p><p className="font-medium text-foreground mt-0.5">{student.prenom}</p></div>
                <div><p className="text-xs text-muted-foreground">Date de naissance</p><p className="font-medium text-foreground mt-0.5">{formatDate(student.dateNaissance)}</p></div>
                <div><p className="text-xs text-muted-foreground">Lieu de naissance</p><p className="font-medium text-foreground mt-0.5">{student.lieuNaissance || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Nationalité</p><p className="font-medium text-foreground mt-0.5">{student.nationalite || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Sexe</p><p className="font-medium text-foreground mt-0.5">{student.sexe === "F" ? "Féminin" : "Masculin"}</p></div>
                <div><p className="text-xs text-muted-foreground">Pièce d'identité (CNI)</p><p className="font-medium text-foreground mt-0.5">{student.cni || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Adresse</p><p className="font-medium text-foreground mt-0.5">{student.adresse || "—"}</p></div>
                {(student.nomTuteur || student.telTuteur) && (
                  <div className="sm:col-span-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Contact tuteur</p>
                    <p className="font-medium text-foreground">{student.nomTuteur || "—"}{student.telTuteur ? ` — ${student.telTuteur}` : ""}</p>
                  </div>
                )}
              </div>
              {(student.documentsFournis?.length ?? 0) > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Pièces justificatives déposées</h4>
                  <ul className="space-y-1">
                    {student.documentsFournis!.map((docId) => {
                      const label = DOCUMENTS_INSCRIPTION.find((d) => d.id === docId)?.label ?? docId;
                      return (
                        <li key={docId} className="flex items-center gap-2 text-sm text-foreground">
                          <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" /> {label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {tab === "academiques" && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">Informations académiques</h3>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="flex items-start gap-2"><Building2 size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" /><div><p className="text-xs text-muted-foreground">Établissement</p><p className="font-medium text-foreground">{etablissement.nom}</p></div></div>
                <div><p className="text-xs text-muted-foreground">Filière</p><p className="font-medium text-foreground mt-0.5">{student.filiere}</p></div>
                <div><p className="text-xs text-muted-foreground">Niveau</p><p className="font-medium text-foreground mt-0.5">{student.niveau}</p></div>
                <div><p className="text-xs text-muted-foreground">Classe</p><p className="font-medium text-foreground mt-0.5">{student.classe}</p></div>
                <div><p className="text-xs text-muted-foreground">Statut</p><span className={cn("inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium", statutStyle.className)}>{statutStyle.label}</span></div>
                <div><p className="text-xs text-muted-foreground">Année académique</p><p className="font-medium text-foreground mt-0.5">{student.annee}</p></div>
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">Activités récentes</h3>
            </div>
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
                        {info.showMeta && a.meta && <p className="text-xs text-muted-foreground truncate">{a.meta}</p>}
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
                { label: "Imprimer ma carte étudiant", icon: Printer, onClick: printCarte, testId: "action-carte" },
                { label: "Imprimer mes informations", icon: Printer, onClick: printInfos, testId: "action-infos" },
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
            <h3 className="text-sm font-bold text-foreground mb-3">Ma carte étudiant</h3>
            <div className="rounded-xl border-2 border-primary/30 p-4 bg-primary/5">
              <p className="text-xs font-bold text-primary mb-2 truncate">{etablissement.nom}</p>
              <p className="text-sm font-bold text-foreground">{student.prenom} {student.nom.toUpperCase()}</p>
              <p className="text-xs text-muted-foreground mb-3">{student.filiere} — {student.niveau}</p>
              <div className="flex items-center gap-2.5">
                <StudentQrCode value={student.matricule} size={56} />
                <div className="min-w-0">
                  <p className="text-xs font-mono font-bold text-foreground truncate">{student.matricule}</p>
                  <p className="text-[11px] text-muted-foreground">{student.annee}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Résumé de mes informations</h3>
            <div className="space-y-2">
              {[
                { label: "Informations personnelles", ok: personnellesCompletes },
                { label: "Informations académiques", ok: academiquesCompletes },
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
            <p className="text-xs text-muted-foreground mb-3">Pour toute modification ou information, contactez le service scolarité.</p>
            <Link href="/student/messages" className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
              Contacter le service
            </Link>
          </div>
        </div>
      </div>

      <FormModal open={showEditModal} onClose={() => setShowEditModal(false)} title="Modifier mes informations" subtitle="Seuls les champs de contact peuvent être modifiés ici">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Photo</label>
            <div className="flex items-center gap-3">
              <UserAvatar name={`${student.prenom} ${student.nom}`} src={photoDataUrl} size="md" />
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
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom du tuteur</label>
              <input value={nomTuteur} onChange={(e) => setNomTuteur(e.target.value)} className={inputClass} data-testid="profil-tuteur-nom" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Téléphone du tuteur</label>
              <input value={telTuteur} onChange={(e) => setTelTuteur(e.target.value)} className={inputClass} data-testid="profil-tuteur-tel" />
            </div>
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
