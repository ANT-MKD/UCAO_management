import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Edit, BookOpen, Calendar, DollarSign, FileText, Printer, ClipboardCheck, ClipboardList, StickyNote, Paperclip } from "lucide-react";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { MemosPanel } from "@/components/admin/MemosPanel";
import { DocumentsPanel } from "@/components/admin/DocumentsPanel";
import { useTeachers } from "@/hooks/useTeacherStore";
import { useAnneeActuelle, useSeances } from "@/hooks/useStudentStore";
import { useEtablissement } from "@/hooks/useEtablissementStore";
import { enteteEtablissementHtml, faitALe } from "@/lib/printDocument";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { useTypesSeance } from "@/hooks/useScheduleSettingsStore";
import { usePointages } from "@/hooks/usePointageStore";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import { matchesProf, mondayOf } from "@/lib/teacherUtils";
import { formatCFA, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const POINTAGE_STATUT_LABEL: Record<string, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
  soumis: { label: "Soumis", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  valide: { label: "Validé", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  rejete: { label: "Rejeté", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

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

/** « 12 h » ou « 7 h 30 ». */
function formatHeures(h: number): string {
  const min = Math.round(h * 60);
  const reste = min % 60;
  return reste ? `${Math.floor(min / 60)} h ${String(reste).padStart(2, "0")}` : `${min / 60} h`;
}

/** Une ligne par module, type et classe, avec le nombre de séances et les heures programmées. */
function regrouperSeances(seances: { ec: string; type: string; classe: string; heureDebut: string; heureFin: string }[]) {
  const lignes = new Map<string, { module: string; type: string; classe: string; seances: number; heures: number }>();
  for (const s of seances) {
    const [sh, sm] = s.heureDebut.split(":").map(Number);
    const [eh, em] = s.heureFin.split(":").map(Number);
    const cle = `${s.ec}|${s.type}|${s.classe}`;
    const l = lignes.get(cle) ?? { module: s.ec, type: s.type, classe: s.classe, seances: 0, heures: 0 };
    l.seances += 1;
    l.heures += (eh * 60 + em - sh * 60 - sm) / 60;
    lignes.set(cle, l);
  }
  return [...lignes.values()].sort((a, b) => a.module.localeCompare(b.module, "fr"));
}

export default function TeacherDossierPage({ id }: TeacherDossierPageProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("informations");
  const seances = useSeances();
  const anneeActuelle = useAnneeActuelle();
  const etablissement = useEtablissement();
  const typesSeance = useTypesSeance();
  const decomptes = useDecomptes();
  const pointages = usePointages();
  const evaluations = useEvaluations();

  const teachers = useTeachers();
  const teacher = teachers.find((t) => t.id === id);
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
  const teacherPointages = pointages.filter((p) => p.teacherId === id).sort((a, b) => b.date.localeCompare(a.date));
  const teacherDevoirs = evaluations
    .filter((e) => e.type === "devoir" && (e.professeurId ? e.professeurId === id : matchesProf(teacher, e.professeur)))
    .sort((a, b) => b.annee.localeCompare(a.annee));

  const TABS = [
    { key: "informations", label: "Informations", icon: FileText },
    { key: "modules", label: "Modules", icon: BookOpen },
    { key: "planning", label: "Planning", icon: Calendar },
    { key: "pointage", label: "Pointage", icon: ClipboardCheck },
    { key: "devoirs", label: "Devoirs", icon: ClipboardList },
    { key: "decomptes", label: "Décomptes", icon: DollarSign },
    { key: "attestation", label: "Attestation", icon: Printer },
    { key: "memos", label: "Mémos", icon: StickyNote },
    { key: "documents", label: "Documents", icon: Paperclip },
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
        <UserAvatar name={`${teacher.prenom} ${teacher.nom}`} size="lg" src={teacher.photoDataUrl} />
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
                { label: "Statut", value: teacher.grade },
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
              {seances.filter((s) => matchesProf(teacher, s.prof, s.profId)).map((s) => (
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
          const thisWeekMonday = mondayOf(new Date().toISOString().slice(0, 10));
          const teacherSeances = seances.filter((s) => matchesProf(teacher, s.prof, s.profId) && s.semaineDu === thisWeekMonday);
          function typeColorOf(type: string) {
            const t = typesSeance.find((x) => x.code === type);
            const hex = t?.couleur ?? "#4f46e5";
            return { bg: `${hex}18`, border: hex, text: hex };
          }
          const HOURS = Array.from({ length: 9 }, (_, i) => i + 8);
          function timeToH(t: string) { const [h, m] = t.split(":").map(Number); return h + m / 60; }
          const totalH = teacherSeances.reduce((s, se) => s + (timeToH(se.heureFin) - timeToH(se.heureDebut)), 0);
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Planning hebdomadaire</h3>
                <div className="flex gap-3 text-xs">
                  {typesSeance.map((t) => {
                    const c = typeColorOf(t.code);
                    return (
                      <span key={t.id} className="flex items-center gap-1.5 font-medium" style={{ color: c.text }}>
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.bg, border: `1.5px solid ${c.border}` }} />{t.code}
                      </span>
                    );
                  })}
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
                            const c = typeColorOf(s.type);
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
          // Année académique en cours : seules ses séances (les séances annulées sont retirées de l'emploi du temps).
          const teacherSeances = seances.filter((s) => matchesProf(teacher, s.prof, s.profId) && s.annee === anneeActuelle);
          const lignes = regrouperSeances(teacherSeances);
          const totalH = lignes.reduce((t, l) => t + l.heures, 0);
          const nbModules = new Set(lignes.map((l) => l.module)).size;
          const printAttestation = () => {
            const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Attestation de service — ${teacher.prenom} ${teacher.nom}</title>
<style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:40px}
.title{text-align:center;font-size:18px;font-weight:bold;margin:30px 0;text-decoration:underline}
.body{font-size:14px;line-height:1.8} table{width:100%;border-collapse:collapse;margin:20px 0}
th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px} th{background:#f0f4ff} td.num{text-align:right}
.footer{margin-top:40px;display:flex;justify-content:space-between;font-size:12px;color:#666}
</style></head><body>
${enteteEtablissementHtml()}
<div class="title">ATTESTATION DE SERVICE</div>
<div class="body">
<p>Je certifie que <strong>${teacher.prenom} ${teacher.nom}</strong> (matricule ${teacher.matricule}),
${teacher.grade} en ${teacher.specialite}, a enseigné dans notre établissement
durant l'année académique ${anneeActuelle}.</p>
<table><tr><th>Module</th><th>Type</th><th>Classe</th><th>Séances</th><th>Heures</th></tr>
${lignes.map((l) => `<tr><td>${l.module}</td><td>${l.type}</td><td>${l.classe}</td><td class="num">${l.seances}</td><td class="num">${formatHeures(l.heures)}</td></tr>`).join("")}
</table>
<p><strong>Volume horaire programmé :</strong> ${formatHeures(totalH)} · <strong>Modules :</strong> ${nbModules}</p>
<p>En foi de quoi, la présente attestation est délivrée pour servir et valoir ce que de droit.</p>
</div>
<div class="footer"><div>${faitALe()}</div><div>Le Directeur</div></div>
</body></html>`;
            const win = window.open("", "_blank");
            if (win) { win.document.write(html); win.document.close(); win.print(); }
          };
          return (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Attestation de Service</h3>
                <button onClick={printAttestation} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90" data-testid="attestation-imprimer">
                  <Printer size={14} /> Imprimer / PDF
                </button>
              </div>
              <div className="border border-border rounded-xl p-6 bg-muted/20" data-testid="attestation-apercu">
                <div className="text-center border-b-2 border-indigo-600 pb-4 mb-6">
                  <h2 className="text-lg font-bold text-indigo-600">{etablissement.nom}</h2>
                  {etablissement.adresse && <p className="text-xs text-muted-foreground">{etablissement.adresse}</p>}
                </div>
                <h3 className="text-center font-bold underline mb-4">ATTESTATION DE SERVICE</h3>
                <p className="text-sm leading-relaxed mb-4">
                  Je certifie que <strong>{teacher.prenom} {teacher.nom}</strong> ({teacher.matricule}),
                  {" "}{teacher.grade} en {teacher.specialite}, a enseigné {nbModules} module(s)
                  pour un volume programmé de <strong>{formatHeures(totalH)}</strong> durant l&apos;année académique {anneeActuelle}.
                </p>
                {lignes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune séance programmée pour ce professeur en {anneeActuelle}.</p>
                ) : (
                  <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                    <thead><tr className="bg-muted/50">
                      {["Module", "Type", "Classe", "Séances", "Heures"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {lignes.map((l) => (
                        <tr key={`${l.module}|${l.type}|${l.classe}`} className="border-t border-border">
                          <td className="px-3 py-2">{l.module}</td>
                          <td className="px-3 py-2">{l.type}</td>
                          <td className="px-3 py-2">{l.classe}</td>
                          <td className="px-3 py-2">{l.seances}</td>
                          <td className="px-3 py-2">{formatHeures(l.heures)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })()}

        {activeTab === "pointage" && (
          <div>
            <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Pointage</h3>
            {teacherPointages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun pointage effectué.</p>
            ) : (
              <div className="space-y-2">
                {teacherPointages.map((p) => {
                  const meta = POINTAGE_STATUT_LABEL[p.statut] ?? { label: p.statut, cls: "bg-muted text-muted-foreground" };
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 p-3.5 bg-muted/30 rounded-xl border border-border">
                      <div>
                        <div className="text-sm font-medium text-foreground">{formatDate(p.date)} · {p.type} · {p.heureDebut}–{p.heureFin}</div>
                        <div className="text-[11px] text-muted-foreground">{p.volumePointe}h pointée(s){p.remarque ? ` · ${p.remarque}` : ""}</div>
                      </div>
                      <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", meta.cls)}>{meta.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "devoirs" && (
          <div>
            <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Devoirs</h3>
            {teacherDevoirs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun devoir effectué.</p>
            ) : (
              <div className="space-y-2">
                {teacherDevoirs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 p-3.5 bg-muted/30 rounded-xl border border-border">
                    <div>
                      <div className="text-sm font-medium text-foreground">{d.cours} — {d.classe}</div>
                      <div className="text-[11px] text-muted-foreground">{d.semestre} · {d.annee} · Poids {d.poids}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "memos" && <MemosPanel entiteType="enseignant" entiteId={id} />}
        {activeTab === "documents" && <DocumentsPanel entiteType="enseignant" entiteId={id} />}
      </div>
    </div>
  );
}
