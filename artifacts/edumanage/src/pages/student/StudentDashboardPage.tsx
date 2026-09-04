import { useMemo } from "react";
import { useLocation } from "wouter";
import {
  CalendarDays, FileText, AlertTriangle, Bell, ArrowRight, ChevronRight,
  Wallet, CalendarX, UserCheck, Clock,
} from "lucide-react";
import { KPICard } from "@/components/admin/KPICard";
import { useStudentStore, useSeances, useNotes, usePaiementsByEtudiant, useStudentRequests, useMessages, useCahiers } from "@/hooks/useStudentStore";
import { useAuth } from "@/contexts/AuthContext";
import { PubliciteBanner } from "@/components/PubliciteBanner";
import { getAssiduiteRowsPourEtudiant, getTauxPresencePourEtudiant } from "@/data/assiduiteEngine";
import { montantQuittance } from "@/pages/admin/PaiementsPage";
import { formatCFA, formatDate, formatShortDate, moyenPaiementColor, cn } from "@/lib/utils";
import { mondayOf } from "@/lib/teacherUtils";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const ALERT_STYLES: Record<string, { dot: string; border: string; bg: string }> = {
  danger: { dot: "#ef4444", border: "#fecaca", bg: "#fef2f2" },
  warning: { dot: "#f59e0b", border: "#fde68a", bg: "#fffbeb" },
  info: { dot: "#4f46e5", border: "#c7d2fe", bg: "#eef2ff" },
};

const TYPE_COLORS: Record<string, { text: string; bg: string }> = {
  CM: { bg: "#eef2ff", text: "#4f46e5" },
  TD: { bg: "#ecfdf5", text: "#10b981" },
  TP: { bg: "#f5f3ff", text: "#8b5cf6" },
  EX: { bg: "#fef2f2", text: "#ef4444" },
};

const REQUEST_STATUS_LABEL: Record<string, string> = {
  nouveau: "reçue",
  en_cours: "en cours de traitement",
  valide: "validée",
  rejete: "rejetée",
};

export default function StudentDashboardPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const notes = useNotes();
  const seances = useSeances();
  const requests = useStudentRequests();
  const messages = useMessages(currentUser?.id);
  useCahiers(); // s'abonne pour refléter les cahiers de séance réellement soumis (assiduité)

  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const paiements = usePaiementsByEtudiant(student?.id ?? "");

  const studentNotes = useMemo(() => notes.filter((n) => n.etudiantId === student?.id && n.statut === "publie"), [notes, student?.id]);
  const recentNotes = useMemo(() => studentNotes.slice(-5).reverse(), [studentNotes]);
  const moyenne = studentNotes.length
    ? (studentNotes.reduce((sum, n) => sum + n.note, 0) / studentNotes.length).toFixed(2)
    : "--";

  const paiementsPayes = useMemo(() => paiements.filter((p) => p.statut !== "annule" && p.montant > 0), [paiements]);
  const impayes = useMemo(() => paiements.filter((p) => p.statut !== "annule" && p.montant < montantQuittance(p)), [paiements]);

  const assiduiteRows = student ? getAssiduiteRowsPourEtudiant(student.id) : [];
  const taux = student ? getTauxPresencePourEtudiant(student.id) : { present: 0, total: 0, pct: 100 };

  const mesDemandes = useMemo(() => requests.filter((r) => r.studentId === student?.id), [requests, student?.id]);
  const demandesEnCours = useMemo(() => mesDemandes.filter((r) => r.status === "nouveau" || r.status === "en_cours"), [mesDemandes]);
  const messagesNonLus = useMemo(() => messages.filter((m) => m.toUserId === currentUser?.id && !m.read), [messages, currentUser?.id]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const weekMonday = mondayOf(todayIso);
  const weekEnd = useMemo(() => {
    const d = new Date(`${weekMonday}T12:00:00`);
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  }, [weekMonday]);

  const weekSeances = useMemo(
    () => seances
      .filter((s) => s.classeId === student?.classeId && s.semaineDu === weekMonday)
      .sort((a, b) => a.jour - b.jour || a.heureDebut.localeCompare(b.heureDebut)),
    [seances, student?.classeId, weekMonday],
  );

  const prochaineSeance = useMemo(() => {
    const now = new Date();
    const todayJour = now.getDay();
    const nowHM = now.toTimeString().slice(0, 5);
    return weekSeances.find((s) => s.jour > todayJour || (s.jour === todayJour && s.heureDebut >= nowHM)) ?? weekSeances[0];
  }, [weekSeances]);

  // Alertes intelligentes — construites à partir de signaux réels du profil étudiant
  const alertes = useMemo(() => {
    const list: { id: string; type: "danger" | "warning" | "info"; message: string; href: string }[] = [];
    if (student && student.soldeDu > 0) {
      const echeances = impayes.map((p) => p.dateLimite).filter((d): d is string => !!d).sort();
      const enRetard = echeances.length > 0 && echeances[0] < todayIso;
      list.push({
        id: "solde",
        type: enRetard ? "danger" : "warning",
        message: enRetard
          ? `Solde dû en retard : ${formatCFA(student.soldeDu)} — régularisez rapidement.`
          : `Solde dû : ${formatCFA(student.soldeDu)}${echeances[0] ? ` — échéance le ${formatShortDate(echeances[0])}` : ""}.`,
        href: "/student/payer-factures",
      });
    }
    if (taux.total > 0 && taux.pct < 80) {
      list.push({ id: "assiduite", type: "warning", message: `Taux de présence faible : ${taux.pct}% (${taux.present}/${taux.total} séances).`, href: "/student/absences" });
    }
    if (demandesEnCours.length > 0) {
      list.push({ id: "demandes", type: "info", message: `${demandesEnCours.length} demande(s) en cours de traitement.`, href: "/student/requests" });
    }
    if (messagesNonLus.length > 0) {
      list.push({ id: "messages", type: "info", message: `${messagesNonLus.length} message(s) non lu(s).`, href: "/student/messages" });
    }
    return list;
  }, [student, impayes, taux, demandesEnCours.length, messagesNonLus.length, todayIso]);

  const prochainesEtapes = useMemo(() => {
    const items: { label: string; href: string }[] = [];
    if (prochaineSeance) {
      items.push({
        label: `Prochaine séance : ${prochaineSeance.ec} — ${JOURS[prochaineSeance.jour] ?? prochaineSeance.jour} ${prochaineSeance.heureDebut} (salle ${prochaineSeance.salle})`,
        href: "/student/schedule",
      });
    } else {
      items.push({ label: "Consulter l'emploi du temps de votre classe.", href: "/student/schedule" });
    }
    if (impayes.length > 0 && student) {
      items.push({ label: `Régler votre solde dû (${formatCFA(student.soldeDu)}).`, href: "/student/payer-factures" });
    } else {
      items.push({ label: "Aucun frais impayé — solde à jour.", href: "/student/frais-paye" });
    }
    if (demandesEnCours.length > 0) {
      const r = demandesEnCours[0];
      items.push({ label: `Suivre votre demande « ${r.subject} » (${REQUEST_STATUS_LABEL[r.status] ?? r.status}).`, href: "/student/requests" });
    } else {
      items.push({ label: "Consulter vos notes publiées et télécharger votre relevé.", href: "/student/releves" });
    }
    return items;
  }, [prochaineSeance, impayes.length, student, demandesEnCours]);

  return (
    <div className="space-y-6">
      <PubliciteBanner profil="student" />
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <p className="text-sm text-muted-foreground">Bienvenue</p>
        <h2 className="text-2xl font-bold text-foreground mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>
          {student ? `${student.prenom} ${student.nom}` : "Étudiant"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {student ? `${student.matricule} · ${student.classe} · ${student.filiere}` : "Aucun profil lié pour le moment"}
        </p>
      </section>

      {alertes.length > 0 && (
        <section className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/20">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Bell size={16} className="text-amber-600" />
            </div>
            <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Alertes</h3>
          </div>
          <div className="p-3 space-y-2">
            {alertes.map((a) => {
              const style = ALERT_STYLES[a.type];
              return (
                <div
                  key={a.id}
                  onClick={() => setLocation(a.href)}
                  className="flex items-start gap-3 p-3 rounded-xl border transition-colors hover:shadow-sm cursor-pointer"
                  style={{ background: style.bg, borderColor: style.border }}
                  data-testid={`student-alerte-${a.id}`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: style.dot }} />
                  <p className="text-xs text-foreground leading-relaxed font-medium flex-1">{a.message}</p>
                  <ChevronRight size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard icon={CalendarDays} label="Séances cette semaine" value={weekSeances.length} accentColor="#2563eb" />
        <KPICard icon={FileText} label="Notes publiées" value={studentNotes.length} accentColor="#10b981" />
        <KPICard
          icon={UserCheck}
          label="Taux de présence"
          value={taux.total > 0 ? `${taux.pct}%` : "--"}
          subtitle={taux.total > 0 ? `${taux.present}/${taux.total} séances` : undefined}
          accentColor={taux.total === 0 || taux.pct >= 80 ? "#10b981" : "#ef4444"}
        />
        <KPICard
          icon={AlertTriangle}
          label="Solde dû"
          value={student ? formatCFA(student.soldeDu) : "--"}
          accentColor={student && student.soldeDu > 0 ? "#ef4444" : "#10b981"}
        />
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Aperçu académique</h3>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Moyenne publiée: <span className="font-semibold text-foreground">{moyenne}/20</span></p>
            <p className="text-muted-foreground">Statut: <span className="font-semibold text-foreground">{student?.statut ?? "--"}</span></p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Prochaines étapes</h3>
          <ul className="space-y-2 text-sm">
            {prochainesEtapes.map((e, i) => (
              <li key={i}>
                <button type="button" onClick={() => setLocation(e.href)} className="text-left text-muted-foreground hover:text-primary transition-colors">
                  {e.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-5">
        {/* Dernières notes */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText size={16} className="text-blue-600" />
              </div>
              <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Dernières notes</h3>
            </div>
            <button onClick={() => setLocation("/student/notes")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              Voir tout <ArrowRight size={11} />
            </button>
          </div>
          {recentNotes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune note publiée pour l&apos;instant.</div>
          ) : (
            <div className="p-2">
              {recentNotes.map((n) => (
                <div
                  key={n.id}
                  onClick={() => setLocation("/student/notes")}
                  className="flex items-center gap-3 mx-2 my-1 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{n.ec}</div>
                    <div className="text-xs text-muted-foreground truncate">{n.type}</div>
                  </div>
                  <span className={cn("text-sm font-bold tabular-nums", n.note >= 10 ? "text-emerald-600" : "text-red-500")}>{n.note}/20</span>
                  <ChevronRight size={14} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Frais payés récents */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Wallet size={16} className="text-emerald-600" />
              </div>
              <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Paiements récents</h3>
            </div>
            <button onClick={() => setLocation("/student/frais-paye")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              Voir tout <ArrowRight size={11} />
            </button>
          </div>
          {paiementsPayes.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucun paiement enregistré.</div>
          ) : (
            <div className="p-2">
              {paiementsPayes.slice(0, 5).map((p) => {
                const c = moyenPaiementColor(p.moyen || "—");
                return (
                  <div
                    key={p.id}
                    onClick={() => setLocation("/student/frais-paye")}
                    className="flex items-center gap-3 mx-2 my-1 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{p.rubrique}</div>
                      <div className="text-xs text-muted-foreground truncate">{formatDate(p.date)}</div>
                    </div>
                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                      <div className="text-sm font-bold text-foreground tabular-nums">{formatCFA(p.montant)}</div>
                      {p.moyen && (
                        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: c.bg, color: c.color }}>{p.moyen}</span>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Absences / retards récents */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <CalendarX size={16} className="text-red-600" />
              </div>
              <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Absences & retards</h3>
            </div>
            <button onClick={() => setLocation("/student/absences")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              Voir tout <ArrowRight size={11} />
            </button>
          </div>
          {assiduiteRows.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune absence ni retard constaté.</div>
          ) : (
            <div className="p-2">
              {assiduiteRows.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  onClick={() => setLocation("/student/absences")}
                  className="flex items-center gap-3 mx-2 my-1 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{r.ec}</div>
                    <div className="text-xs text-muted-foreground truncate">{formatDate(r.date)}</div>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0", r.type === "absence" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>
                    {r.type === "absence" ? "Absence" : "Retard"}
                  </span>
                  <ChevronRight size={14} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Planning de la semaine */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Clock size={16} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Planning de la semaine</h3>
                <p className="text-[10px] text-muted-foreground">du {formatShortDate(weekMonday)} au {formatShortDate(weekEnd)}</p>
              </div>
            </div>
            <button onClick={() => setLocation("/student/schedule")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              Voir tout <ArrowRight size={11} />
            </button>
          </div>
          {weekSeances.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune séance planifiée cette semaine.</div>
          ) : (
            <div className="p-2">
              {weekSeances.slice(0, 6).map((s) => {
                const tc = TYPE_COLORS[s.type] ?? TYPE_COLORS.CM;
                return (
                  <div key={s.id} className="flex items-center gap-3 mx-2 my-1 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors">
                    <div className="flex flex-col items-center flex-shrink-0 w-14">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg flex items-center gap-1">
                        <Clock size={9} /> {s.heureDebut}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1">{JOURS[s.jour] ?? s.jour}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{s.ec}</div>
                      <div className="text-xs text-muted-foreground truncate">Salle {s.salle} · {s.prof}</div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: tc.bg, color: tc.text }}>{s.type}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
