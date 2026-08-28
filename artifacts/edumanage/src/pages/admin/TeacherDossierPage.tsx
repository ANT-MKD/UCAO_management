import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Edit, BookOpen, Calendar, DollarSign, FileText, Printer } from "lucide-react";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { ENSEIGNANTS } from "@/data/mockData";
import { useSeances } from "@/hooks/useStudentStore";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { formatCFA, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface TeacherDossierPageProps {
  id: string;
}

const GRADE_COLORS: Record<string, { bg: string; text: string }> = {
  Permanent: { bg: "#ecfdf5", text: "#10b981" },
  Vacataire: { bg: "#fffbeb", text: "#f59e0b" },
  Contractuel: { bg: "#eff6ff", text: "#3b82f6" },
};

const DECOMPTE_TYPE_LABEL: Record<string, string> = {
  taux_horaire: "Taux horaire",
  forfait: "Forfait",
  a_terme: "À terme",
};

export default function TeacherDossierPage({ id }: TeacherDossierPageProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("informations");
  const seances = useSeances();
  const decomptes = useDecomptes();

  const teacher = ENSEIGNANTS.find((e) => e.id === id);
  if (!teacher) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-bold text-foreground mb-2">Enseignant introuvable</h2>
        <button onClick={() => setLocation("/admin/teachers")} className="text-primary hover:underline text-sm">
          Retour à la liste
        </button>
      </div>
    );
  }

  const teacherDecomptes = decomptes.filter((d) => d.teacherId === id).sort((a, b) => b.date.localeCompare(a.date));
  const gradeColors = GRADE_COLORS[teacher.grade] ?? { bg: "#f1f5f9", text: "#64748b" };

  const TABS = [
    { key: "informations", label: "Informations", icon: FileText },
    { key: "modules", label: "Modules", icon: BookOpen },
    { key: "planning", label: "Planning", icon: Calendar },
    { key: "decomptes", label: "Décomptes", icon: DollarSign },
    { key: "attestation", label: "Attestation", icon: Printer },
  ];

  return (
    <div>
      <button
        onClick={() => setLocation("/admin/teachers")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
      >
        <ArrowLeft size={15} /> Retour aux enseignants
      </button>

      <div className="bg-card border border-border rounded-2xl p-6 mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <UserAvatar name={`${teacher.prenom} ${teacher.nom}`} size="lg" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              {teacher.prenom} {teacher.nom}
            </h1>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: gradeColors.bg, color: gradeColors.text }}>
              {teacher.grade}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono font-bold text-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {teacher.matricule}
            </span>
            <span>·</span>
            <span>{teacher.specialite}</span>
            <span>·</span>
            <span>{formatCFA(teacher.tauxHoraire)}/h</span>
          </div>
        </div>
        <button onClick={() => setLocation(`/admin/teachers/${id}/edit`)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors">
          <Edit size={13} /> Modifier
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
              activeTab === tab.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        {activeTab === "informations" && (
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Profil</h3>
              {[
                { label: "Prénom & Nom", value: `${teacher.prenom} ${teacher.nom}` },
                { label: "Matricule", value: teacher.matricule, mono: true },
                { label: "Grade", value: teacher.grade },
                { label: "Spécialité", value: teacher.specialite },
                { label: "Taux horaire", value: formatCFA(teacher.tauxHoraire) },
                { label: "Modules assignés", value: teacher.modulesAssignes },
                { label: "Heures ce mois", value: `${teacher.heuresMois}h` },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground w-36 flex-shrink-0">{f.label}</span>
                  <span className={cn("text-sm text-foreground font-medium", f.mono && "font-mono")} style={f.mono ? { fontFamily: "JetBrains Mono, monospace" } : {}}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "modules" && (
          <div>
            <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Modules enseignés</h3>
            <div className="space-y-2">
              {seances.filter((s) => s.prof.includes(teacher.nom)).map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border">
                  <div
                    className="w-2 h-10 rounded-full flex-shrink-0"
                    style={{ background: s.type === "CM" ? "#4f46e5" : s.type === "TD" ? "#10b981" : "#8b5cf6" }}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{s.ec}</div>
                    <div className="text-xs text-muted-foreground">{s.classe} · {s.salle}</div>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background: s.type === "CM" ? "#eef2ff" : s.type === "TD" ? "#ecfdf5" : "#f5f3ff",
                      color: s.type === "CM" ? "#4f46e5" : s.type === "TD" ? "#10b981" : "#8b5cf6",
                    }}
                  >
                    {s.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "planning" && (() => {
          const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
          const teacherSeances = seances.filter((s) => s.prof.includes(teacher.nom));
          const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
            CM: { bg: "#eef2ff", border: "#4f46e5", text: "#4f46e5" },
            TD: { bg: "#ecfdf5", border: "#10b981", text: "#10b981" },
            TP: { bg: "#f5f3ff", border: "#8b5cf6", text: "#8b5cf6" },
          };
          const HOURS = Array.from({ length: 9 }, (_, i) => i + 8);
          function timeToH(t: string) { const [h, m] = t.split(":").map(Number); return h + m / 60; }
          const totalH = teacherSeances.reduce((s, se) => s + (timeToH(se.heureFin) - timeToH(se.heureDebut)), 0);
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Planning hebdomadaire</h3>
                <div className="flex gap-3 text-xs">
                  {Object.entries(TYPE_COLORS).map(([t, c]) => (
                    <span key={t} className="flex items-center gap-1.5 font-medium" style={{ color: c.text }}>
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.bg, border: `1.5px solid ${c.border}` }} />{t}
                    </span>
                  ))}
                </div>
              </div>
              {/* Volume stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Séances / semaine", value: teacherSeances.length },
                  { label: "Heures / semaine", value: `${totalH}h` },
                  { label: "Classes", value: [...new Set(teacherSeances.map(s => s.classe))].length },
                ].map((s) => (
                  <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center border border-border">
                    <div className="text-xl font-bold text-foreground">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Mini calendar grid */}
              {teacherSeances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                  Aucune séance trouvée pour cet enseignant
                </div>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid" style={{ gridTemplateColumns: "48px repeat(6, 1fr)" }}>
                    <div className="bg-muted/30 border-b border-r border-border h-9" />
                    {JOURS.map((j, i) => (
                      <div key={j} className="bg-muted/30 border-b border-r border-border last:border-r-0 flex items-center justify-center h-9">
                        <span className="text-xs font-semibold text-muted-foreground">{j}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid relative" style={{ gridTemplateColumns: "48px repeat(6, 1fr)" }}>
                    <div className="border-r border-border">
                      {HOURS.map((h) => (
                        <div key={h} className="h-14 border-b border-border/50 last:border-0 flex items-start justify-end pr-1.5 pt-1">
                          <span className="text-[9px] text-muted-foreground">{h}:00</span>
                        </div>
                      ))}
                    </div>
                    {JOURS.map((_, dayIdx) => {
                      const dayNum = dayIdx + 1;
                      const daySeances = teacherSeances.filter((s) => s.jour === dayNum);
                      return (
                        <div key={dayIdx} className="relative border-r border-border last:border-r-0">
                          {HOURS.map((h) => <div key={h} className="h-14 border-b border-border/40 last:border-0" />)}
                          {daySeances.map((s) => {
                            const PX_PER_H = 56;
                            const top = (timeToH(s.heureDebut) - 8) * PX_PER_H;
                            const height = (timeToH(s.heureFin) - timeToH(s.heureDebut)) * PX_PER_H;
                            const c = TYPE_COLORS[s.type] ?? TYPE_COLORS.CM;
                            return (
                              <div key={s.id} className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 overflow-hidden" style={{ top, height, background: c.bg, borderLeft: `2.5px solid ${c.border}` }}>
                                <div className="text-[9px] font-bold truncate" style={{ color: c.text }}>{s.ec}</div>
                                <div className="text-[8px] text-muted-foreground truncate">{s.classe} · {s.salle}</div>
                                <div className="text-[8px] text-muted-foreground">{s.heureDebut}–{s.heureFin}</div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === "decomptes" && (
          <div>
            <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Décomptes</h3>
            {teacherDecomptes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun décompte enregistré pour ce professeur</p>
            ) : (
              <div className="space-y-3">
                {teacherDecomptes.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setLocation(`/admin/decomptes/${d.id}`)}
                    className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border cursor-pointer hover:bg-muted/60 transition-colors"
                    data-testid={`teacher-dossier-decompte-${d.id}`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{d.reference}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(d.date)} · {DECOMPTE_TYPE_LABEL[d.type] ?? d.type}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-foreground">{formatCFA(d.netAPayer)}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {formatCFA(d.montantPaye)} payé
                      </div>
                      <div className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full mt-1",
                        d.statut === "annule" ? "bg-red-50 text-red-600" : d.montantPaye >= d.netAPayer ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {d.statut === "annule" ? "Annulé" : d.montantPaye >= d.netAPayer ? "Payé" : "Emis"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "attestation" && (() => {
          const teacherSeances = seances.filter((s) => s.prof.includes(teacher.nom));
          const totalH = teacherSeances.reduce((s, se) => {
            const [sh, sm] = se.heureDebut.split(":").map(Number);
            const [eh, em] = se.heureFin.split(":").map(Number);
            return s + (eh * 60 + em - sh * 60 - sm) / 60;
          }, 0);
          const modules = [...new Set(teacherSeances.map((s) => s.ec))];
          const printAttestation = () => {
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Attestation de service</title>
<style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:40px}
.header{text-align:center;border-bottom:3px double #4f46e5;padding-bottom:20px;margin-bottom:30px}
.header h1{font-size:22px;color:#4f46e5;margin:0}
.title{text-align:center;font-size:18px;font-weight:bold;margin:30px 0;text-decoration:underline}
.body{font-size:14px;line-height:1.8} table{width:100%;border-collapse:collapse;margin:20px 0}
th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px} th{background:#f0f4ff}
.footer{margin-top:40px;display:flex;justify-content:space-between;font-size:12px;color:#666}
</style></head><body>
<div class="header"><h1>Institut Supérieur EduManage</h1><p>Dakar, Sénégal</p></div>
<div class="title">ATTESTATION DE SERVICE</div>
<div class="body">
<p>Je certifie que <strong>${teacher.prenom} ${teacher.nom}</strong> (matricule ${teacher.matricule}),
${teacher.grade} en ${teacher.specialite}, a effectivement enseigné dans notre établissement
durant l'année académique 2025-2026.</p>
<table><tr><th>Module</th><th>Type</th><th>Classe</th><th>Horaire</th></tr>
${teacherSeances.map((s) => `<tr><td>${s.ec}</td><td>${s.type}</td><td>${s.classe}</td><td>${s.heureDebut}-${s.heureFin}</td></tr>`).join("")}
</table>
<p><strong>Volume horaire total :</strong> ${totalH.toFixed(0)} heures/semaine · <strong>Modules :</strong> ${modules.length}</p>
<p>En foi de quoi, la présente attestation est délivrée pour servir et valoir ce que de droit.</p>
</div>
<div class="footer"><div>Fait à Dakar, le ${new Date().toLocaleDateString("fr-FR")}</div><div>Le Directeur</div></div>
</body></html>`;
            const win = window.open("", "_blank");
            if (win) { win.document.write(html); win.document.close(); win.print(); }
          };
          return (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Attestation de Service</h3>
                <button onClick={printAttestation} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
                  <Printer size={14} /> Imprimer / PDF
                </button>
              </div>
              <div className="border border-border rounded-xl p-6 bg-muted/20">
                <div className="text-center border-b-2 border-indigo-600 pb-4 mb-6">
                  <h2 className="text-lg font-bold text-indigo-600">Institut Supérieur EduManage</h2>
                  <p className="text-xs text-muted-foreground">Dakar, Sénégal</p>
                </div>
                <h3 className="text-center font-bold underline mb-4">ATTESTATION DE SERVICE</h3>
                <p className="text-sm leading-relaxed mb-4">
                  Je certifie que <strong>{teacher.prenom} {teacher.nom}</strong> ({teacher.matricule}),
                  {teacher.grade} en {teacher.specialite}, a enseigné {modules.length} module(s)
                  pour un volume de <strong>{totalH.toFixed(0)}h/semaine</strong> durant l'année 2025-2026.
                </p>
                <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                  <thead><tr className="bg-muted/50">
                    {["Module", "Type", "Classe", "Horaire"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {teacherSeances.slice(0, 6).map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-3 py-2">{s.ec}</td>
                        <td className="px-3 py-2">{s.type}</td>
                        <td className="px-3 py-2">{s.classe}</td>
                        <td className="px-3 py-2">{s.heureDebut}–{s.heureFin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
