import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Edit, AlertTriangle, GraduationCap, FileText, CreditCard, Calendar, History, IdCard } from "lucide-react";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatCFA, formatDate, getMention } from "@/lib/utils";
import { ABSENCES } from "@/data/mockData";
import { useEtudiant, useInscriptions, usePaiementsByEtudiant, useNotes } from "@/hooks/useStudentStore";
import { cn } from "@/lib/utils";

interface StudentDossierPageProps {
  id: string;
}

const MENTION_COLORS: Record<string, string> = {
  "Très Bien": "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "Bien": "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  "Assez Bien": "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "Passable": "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "Ajourné": "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const MOYEN_COLORS: Record<string, string> = {
  Wave: "#2563eb", OrangeMoney: "#ea580c", Virement: "#4f46e5", Especes: "#10b981",
};

export default function StudentDossierPage({ id }: StudentDossierPageProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("informations");

  const student = useEtudiant(id);
  const inscriptions = useInscriptions(id);
  const studentPaiements = usePaiementsByEtudiant(id);
  const allNotes = useNotes();
  const studentNotes = allNotes.filter((n) => n.etudiantId === id);
  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-bold text-foreground mb-2">Étudiant introuvable</h2>
        <button onClick={() => setLocation("/admin/students")} className="text-primary hover:underline text-sm">
          Retour à la liste
        </button>
      </div>
    );
  }

  const totalPaye = studentPaiements.reduce((sum, p) => sum + p.montant, 0);

  const TABS = [
    { key: "informations", label: "Informations", icon: GraduationCap },
    { key: "parcours", label: "Parcours", icon: History },
    { key: "notes", label: "Notes", icon: FileText },
    { key: "paiements", label: "Paiements", icon: CreditCard },
    { key: "absences", label: "Absences", icon: Calendar },
  ];

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => setLocation("/admin/students")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
        data-testid="btn-back"
      >
        <ArrowLeft size={15} /> Retour aux étudiants
      </button>

      {/* Banner */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <UserAvatar name={`${student.prenom} ${student.nom}`} size="lg" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              {student.prenom} {student.nom}
            </h1>
            <StatusBadge status={student.statut} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono font-bold text-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {student.matricule}
            </span>
            <span>·</span>
            <span>{student.filiere}</span>
            <span>·</span>
            <span>{student.classe}</span>
            <span>·</span>
            <span>{student.niveau}</span>
          </div>
          {student.soldeDu > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-500">
              <AlertTriangle size={12} />
              Solde dû : {formatCFA(student.soldeDu)}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          <button onClick={() => setLocation(`/admin/students/card?id=${encodeURIComponent(student.id)}`)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors">
            <IdCard size={13} /> Carte étudiant
          </button>
          <button onClick={() => setLocation(`/admin/students/reinscription?matricule=${encodeURIComponent(student.matricule)}`)} className="flex items-center gap-1.5 px-3 py-2 border border-indigo-300 text-indigo-700 rounded-xl text-xs font-medium hover:bg-indigo-50 transition-colors">
            <History size={13} /> Réinscrire
          </button>
          <button onClick={() => setLocation(`/admin/paiements/new`)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors">
            <CreditCard size={13} /> Paiement
          </button>
          <button onClick={() => setLocation(`/admin/students/new`)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors">
            <Edit size={13} /> Modifier
          </button>
        </div>
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
            data-testid={`tab-${tab.key}`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        {activeTab === "informations" && (
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>État Civil</h3>
              <div className="space-y-3">
                {[
                  { label: "Prénom", value: student.prenom },
                  { label: "Nom", value: student.nom },
                  { label: "Sexe", value: student.sexe === "M" ? "Masculin" : "Féminin" },
                  { label: "Date de naissance", value: formatDate(student.dateNaissance) },
                  { label: "Matricule", value: student.matricule, mono: true },
                  { label: "1ère inscription", value: String(student.anneePremiereInscription) },
                  { label: "Inscription unique payée", value: student.inscriptionUniquePayee ? "Oui" : "Non" },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{f.label}</span>
                    <span className={cn("text-sm text-foreground font-medium", f.mono && "font-mono")} style={f.mono ? { fontFamily: "JetBrains Mono, monospace" } : {}}>
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Contacts</h3>
              <div className="space-y-3">
                {[
                  { label: "Email", value: student.email },
                  { label: "Téléphone", value: student.telephone },
                  { label: "Filière", value: student.filiere },
                  { label: "Classe", value: student.classe },
                  { label: "Année", value: student.annee },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{f.label}</span>
                    <span className="text-sm text-foreground font-medium">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "parcours" && (
          <div>
            <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
              Historique des inscriptions
            </h3>
            {inscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune inscription enregistrée</p>
            ) : (
              <div className="relative pl-6 border-l-2 border-indigo-200 space-y-4">
                {inscriptions.map((ins) => (
                  <div key={ins.id} className="relative">
                    <div className="absolute -left-[25px] top-4 w-3 h-3 rounded-full bg-indigo-500 border-2 border-card" />
                    <div className="ml-2 p-4 rounded-xl border border-border bg-muted/20">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-bold text-foreground">{ins.annee}</span>
                        <StatusBadge status={ins.statut} />
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                          {ins.type === "premiere" ? "1ère inscription" : "Réinscription"}
                        </span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <span>Filière : <strong className="text-foreground">{ins.filiere}</strong></span>
                        <span>Niveau : <strong className="text-foreground">{ins.niveau}</strong></span>
                        <span>Classe : <strong className="text-foreground">{ins.classe}</strong></span>
                        <span>Date : {formatDate(ins.dateInscription)}</span>
                        {ins.soldeDu > 0 && (
                          <span className="text-red-500 sm:col-span-2">Solde dû : {formatCFA(ins.soldeDu)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "notes" && (
          <div>
            <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Relevé de Notes — S1 2025-2026</h3>
            {studentNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune note disponible</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">EC</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Note /20</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Mention</th>
                  </tr>
                </thead>
                <tbody>
                  {studentNotes.map((n) => {
                    const mention = getMention(n.note);
                    return (
                      <tr key={n.id} className={cn("border-b border-border last:border-0", n.note < 10 && "bg-red-50/50 dark:bg-red-950/20")}>
                        <td className="px-4 py-3 font-medium text-foreground">{n.ec}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-0.5 bg-muted text-muted-foreground rounded">{n.type}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("font-bold text-base", n.note >= 10 ? "text-emerald-600" : "text-red-500")}>
                            {n.note}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", MENTION_COLORS[mention] ?? "bg-muted text-muted-foreground")}>
                            {mention}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "paiements" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Historique des Paiements</h3>
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">Total payé : <span className="font-bold text-emerald-600">{formatCFA(totalPaye)}</span></span>
                {student.soldeDu > 0 && <span className="text-muted-foreground">Restant dû : <span className="font-bold text-red-500">{formatCFA(student.soldeDu)}</span></span>}
              </div>
            </div>
            {studentPaiements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun paiement enregistré</p>
            ) : (
              <div className="relative pl-6 border-l-2 border-primary/20 space-y-4">
                {[...studentPaiements].sort((a, b) => b.date.localeCompare(a.date)).map((p) => (
                  <div key={p.id} className="relative">
                    <div className="absolute -left-[25px] top-3 w-3 h-3 rounded-full bg-primary border-2 border-card" />
                    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border ml-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${MOYEN_COLORS[p.moyen] ?? "#64748b"}15` }}>
                        <CreditCard size={16} style={{ color: MOYEN_COLORS[p.moyen] ?? "#64748b" }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{p.rubrique}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(p.date)} · {p.reference} · {p.moyen}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-600">{formatCFA(p.montant)}</div>
                        <StatusBadge status={p.statut} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "absences" && (() => {
          const studentAbsences = ABSENCES.filter((a) => a.etudiantId === id);
          const nbTotal = studentAbsences.length;
          const nbJustif = studentAbsences.filter((a) => a.justifie).length;
          const nbNonJustif = nbTotal - nbJustif;
          const tauxPresence = Math.max(0, Math.round(((52 - nbTotal) / 52) * 100));
          return (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Suivi des Absences — S1 2025-2026</h3>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Total absences", value: nbTotal, color: "text-foreground" },
                  { label: "Non justifiées", value: nbNonJustif, color: "text-red-500" },
                  { label: "Justifiées", value: nbJustif, color: "text-amber-600" },
                  { label: "Taux de présence", value: `${tauxPresence}%`, color: "text-emerald-600" },
                ].map((s) => (
                  <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center border border-border">
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mb-5">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Taux de présence global</span>
                  <span className="font-semibold text-emerald-600">{tauxPresence}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${tauxPresence}%` }} />
                </div>
              </div>
              {studentAbsences.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune absence enregistrée</p>
              ) : (
                <div className="relative pl-6 border-l-2 border-amber-200 space-y-3">
                  {[...studentAbsences].sort((a, b) => b.date.localeCompare(a.date)).map((ab) => (
                    <div key={ab.id} className="relative">
                      <div className={cn("absolute -left-[25px] top-4 w-3 h-3 rounded-full border-2 border-card", ab.justifie ? "bg-amber-400" : "bg-red-400")} />
                      <div className={cn("flex items-center gap-4 p-4 rounded-xl border ml-2",
                        ab.justifie ? "bg-amber-50/50 border-amber-100" : "bg-red-50/50 border-red-100"
                      )}>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{ab.ec}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(ab.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} · {ab.heure}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{ab.type}</span>
                        <div className="text-right">
                          <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full",
                            ab.justifie ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"
                          )}>
                            {ab.justifie ? "Justifiée" : "Non justifiée"}
                          </span>
                          {ab.motif && <div className="text-[10px] text-muted-foreground mt-0.5">{ab.motif}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
