import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Eye, CreditCard, ShieldAlert, ChevronLeft, ChevronRight, Search, Clock, Library, BookOpen, GraduationCap, LayoutGrid, List, Table2, SlidersHorizontal, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore, useSeances, useNotes, usePaiementsByEtudiant, useReleves, useCahiers, useAnneeActuelle } from "@/hooks/useStudentStore";
import { useUes, useEcs } from "@/hooks/useCurriculumStore";
import type { UeRecord, EcRecord } from "@/data/curriculumStore";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { useModesPaiementFinance } from "@/hooks/useFinanceSettingsStore";
import { useTypesSeance, useJoursFeries } from "@/hooks/useScheduleSettingsStore";
import { useEvenements } from "@/hooks/useEvenementStore";
import { useRessourcesPourClasse } from "@/hooks/useRessourcePedagogiqueStore";
import { getJourFerieCouvrant } from "@/data/scheduleSettingsStore";
import { getCahierStatsForEc } from "@/data/studentStore";
import { formatCFA, formatDate, formatShortDate, moyenPaiementColor, cn } from "@/lib/utils";
import { mondayOf } from "@/lib/teacherUtils";
import { DOCUMENTS_INSCRIPTION } from "@/lib/inscriptionConstants";
import { resolveBulletin, BulletinPreviewModal } from "@/pages/admin/RelevesPage";
import { montantQuittance } from "@/pages/admin/PaiementsPage";
import { useMentions } from "@/hooks/useMentionsStore";
import { useDeliberations } from "@/hooks/useDeliberationStore";
import { payerQuittance } from "@/data/studentStore";
import { enregistrerEncaissement } from "@/data/encaissementStore";
import { getAssiduiteRowsPourEtudiant, getTauxPresencePourEtudiant } from "@/data/assiduiteEngine";
import type { ReleveRecord } from "@/data/studentStore";

const JOURS_GRID = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
const PX_PER_H = 80;
const FALLBACK_COLOR = "#4f46e5";

function shadeFromColor(hex: string): { bg: string; border: string; text: string } {
  return { bg: `${hex}18`, border: hex, text: hex };
}

function timeToPixels(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - 8) * PX_PER_H + m * (PX_PER_H / 60);
}

function getDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) * (PX_PER_H / 60);
}

/** Emploi du temps de l'étudiant — grille en lecture seule reprenant le design de l'EDT admin
 * (mêmes couleurs par type, même ligne "heure actuelle"), sans le glisser-déposer ni les
 * sélecteurs de vue (classe/salle/prof) qui n'ont pas de sens côté étudiant. */
export function StudentSchedulePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const seances = useSeances();
  const evenements = useEvenements();
  const TYPES_SEANCE = useTypesSeance();
  useJoursFeries();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];

  const [weekOffset, setWeekOffset] = useState(0);
  const [weekViewMode, setWeekViewMode] = useState<"semaine" | "jour">("semaine");

  const now = new Date();
  const todayDow = now.getDay() === 0 ? 7 : now.getDay();
  const currentTimeY = (now.getHours() - 8) * PX_PER_H + now.getMinutes() * (PX_PER_H / 60);
  const showTimeLine = now.getHours() >= 8 && now.getHours() < 20;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
  const weekMonday = mondayOf(weekStart.toISOString().slice(0, 10));
  const weekDays = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(`${weekMonday}T12:00:00`);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekMonday]);
  const weekEnd = weekDays[5];
  const weekLabel = `${weekDays[0].getDate()} – ${weekEnd.getDate()} ${weekDays[0].toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;

  const todayJourNum = Math.min((now.getDay() + 6) % 7 + 1, 6);
  const displayDayIdxs = weekViewMode === "jour" ? [todayJourNum - 1] : [0, 1, 2, 3, 4, 5];

  const weekSeances = useMemo(
    () => seances.filter((s) => s.classeId === student?.classeId && s.semaineDu === weekMonday),
    [seances, student?.classeId, weekMonday],
  );
  const weekEvenements = useMemo(
    () => evenements.filter((e) => !e.classeId || e.classeId === student?.classeId),
    [evenements, student?.classeId],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Emploi du temps</h2>
          <p className="text-sm text-muted-foreground mt-1">{student?.classe} · {student?.filiere}</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors" data-testid="edt-etudiant-week-prev"><ChevronLeft size={16} /></button>
          <span className="text-sm font-medium text-foreground px-2">Sem. du {weekLabel}</span>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors" data-testid="edt-etudiant-week-next"><ChevronRight size={16} /></button>
          <button onClick={() => setWeekOffset(0)} className="px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-muted transition-colors">Aujourd&apos;hui</button>
          {(["semaine", "jour"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setWeekViewMode(mode)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors capitalize",
                weekViewMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        {TYPES_SEANCE.map((t) => {
          const c = shadeFromColor(t.couleur);
          return (
            <div key={t.id} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: c.text }}>
              <span className="w-3 h-3 rounded-sm" style={{ background: c.bg, border: `2px solid ${c.border}` }} />{t.code}
            </div>
          );
        })}
      </div>

      {weekSeances.length === 0 && weekEvenements.filter((e) => weekDays.some((d) => d.toISOString().slice(0, 10) === e.date)).length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          Aucune séance planifiée pour la semaine du {formatShortDate(weekMonday)}.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="overflow-x-auto">
          <div style={{ minWidth: weekViewMode === "semaine" ? 720 : 320 }}>
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${displayDayIdxs.length}, 1fr)` }}>
              <div className="border-b border-r border-border" />
              {displayDayIdxs.map((dayIdx) => {
                const dayNum = dayIdx + 1;
                const dateIso = weekDays[dayIdx].toISOString().slice(0, 10);
                const ferie = getJourFerieCouvrant(dateIso);
                return (
                  <div
                    key={dayIdx}
                    title={ferie ? `Jour férié — ${ferie.intitule}` : undefined}
                    className={cn(
                      "px-2 py-3 text-center text-xs font-semibold border-b border-r border-border last:border-r-0",
                      dayNum === todayDow && weekOffset === 0 && "bg-primary/5 text-primary",
                      ferie && "bg-amber-50 text-amber-700",
                    )}
                  >
                    {JOURS_GRID[dayIdx]}
                    {ferie && <div className="text-[9px] font-normal normal-case truncate">{ferie.intitule}</div>}
                  </div>
                );
              })}
            </div>

            <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(${displayDayIdxs.length}, 1fr)` }}>
              <div className="border-r border-border">
                {HOURS.map((h) => (
                  <div key={h} className="border-b border-border last:border-0 flex items-start justify-end pr-2 pt-1" style={{ height: PX_PER_H }}>
                    <span className="text-[10px] text-muted-foreground">{h}:00</span>
                  </div>
                ))}
              </div>

              {displayDayIdxs.map((dayIdx) => {
                const dayNum = dayIdx + 1;
                const dateIso = weekDays[dayIdx].toISOString().slice(0, 10);
                const daySeances = weekSeances.filter((s) => s.jour === dayNum);
                const dayEvenements = weekEvenements.filter((e) => e.date === dateIso);
                return (
                  <div
                    key={dayIdx}
                    className={cn("relative border-r border-border last:border-r-0", dayNum === todayDow && weekOffset === 0 && "bg-primary/[0.02]")}
                  >
                    {HOURS.map((h) => (
                      <div key={h} className="border-b border-border/50 last:border-0" style={{ height: PX_PER_H }} />
                    ))}

                    {daySeances.map((s) => {
                      const typeRecord = TYPES_SEANCE.find((t) => t.code === s.type);
                      const colors = shadeFromColor(typeRecord?.couleur ?? FALLBACK_COLOR);
                      const top = timeToPixels(s.heureDebut);
                      const height = getDuration(s.heureDebut, s.heureFin);
                      return (
                        <div
                          key={s.id}
                          data-testid={`edt-etudiant-seance-${s.id}`}
                          className="absolute left-1 right-1 rounded-lg px-2 py-1.5 overflow-hidden"
                          style={{
                            top: `${top}px`, height: `${Math.max(height, 40)}px`,
                            background: colors.bg, borderLeft: `3px solid ${colors.border}`,
                            zIndex: 5, boxShadow: "var(--shadow-sm)",
                          }}
                        >
                          <div className="text-[10px] font-bold truncate" style={{ color: colors.text }}>{s.ec}</div>
                          <div className="text-[9px] text-muted-foreground">{s.heureDebut}–{s.heureFin}</div>
                          {height > 50 && (
                            <>
                              <div className="text-[9px] text-muted-foreground truncate">{s.salle}</div>
                              <div className="text-[9px] text-muted-foreground truncate">{s.prof}</div>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {dayEvenements.map((ev) => {
                      const typeRecord = TYPES_SEANCE.find((t) => t.code === ev.type);
                      const colors = shadeFromColor(typeRecord?.couleur ?? FALLBACK_COLOR);
                      const top = timeToPixels(ev.heureDebut);
                      const height = getDuration(ev.heureDebut, ev.heureFin);
                      return (
                        <div
                          key={ev.id}
                          className="absolute left-1 right-1 rounded-lg px-2 py-1.5 overflow-hidden border-dashed"
                          style={{
                            top: `${top}px`, height: `${Math.max(height, 40)}px`,
                            background: colors.bg, border: `2px dashed ${colors.border}`,
                            zIndex: 4,
                          }}
                        >
                          <div className="text-[10px] font-bold truncate" style={{ color: colors.text }}>{ev.objet}</div>
                          <div className="text-[9px] text-muted-foreground">{ev.heureDebut}–{ev.heureFin} · {ev.type}</div>
                        </div>
                      );
                    })}

                    {dayNum === todayDow && weekOffset === 0 && showTimeLine && (
                      <div className="absolute left-0 right-0 z-30 pointer-events-none flex items-center" style={{ top: `${currentTimeY}px` }}>
                        <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                        <div className="flex-1 h-[1.5px] bg-red-500" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StudentNotesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const notes = useNotes();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const published = notes.filter((n) => n.etudiantId === student?.id && n.statut === "publie");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes notes</h2>
        <p className="text-sm text-muted-foreground mt-1">Notes publiées, détail par module (EC)</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        {published.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucune note publiée pour l'instant.</p>
        ) : (
          <div className="space-y-2">
            {published.map((n) => (
              <div key={n.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-2.5">
                <p className="font-medium">{n.ec}</p>
                <span className={`font-bold ${n.note >= 10 ? "text-emerald-600" : "text-red-500"}`}>{n.note}/20</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StudentRelevesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const releves = useReleves();
  useMentions(); // s'abonne pour refléter la vraie mention si la configuration change
  useDeliberations(); // s'abonne pour refléter la vraie décision de jury si une délibération change
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const mesReleves = releves.filter((r) => r.etudiantId === student?.id);
  const [previewReleve, setPreviewReleve] = useState<ReleveRecord | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Relevés & bulletins</h2>
        <p className="text-sm text-muted-foreground mt-1">Même moteur de calcul que le bulletin officiel — aucune moyenne recalculée séparément.</p>
      </div>

      {mesReleves.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">
          Aucun bulletin officiel disponible pour l'instant.
        </p>
      ) : (
        mesReleves.map((releve) => {
          const resolved = resolveBulletin(releve, students);
          return (
            <div key={releve.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-bold text-sm">{releve.semestre}</h3>
                  {resolved && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Moyenne <span className="font-bold text-foreground">{resolved.moyenne.toFixed(2)}/20</span> · Mention {resolved.mention} · Décision : <span className="font-medium">{resolved.decisionLabel}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setPreviewReleve(releve)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors flex-shrink-0"
                  data-testid={`portal-bulletin-apercu-${releve.id}`}
                >
                  <Eye size={13} /> Aperçu bulletin
                </button>
              </div>
              {resolved && (
                <div className="space-y-1.5">
                  {resolved.ues.map((ue) => (
                    <div key={ue.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-1.5">
                      <span className="font-medium">{ue.code} — {ue.libelle}</span>
                      <span className={`font-bold ${ue.moyenne !== undefined && ue.moyenne >= 10 ? "text-emerald-600" : "text-red-500"}`}>
                        {ue.moyenne !== undefined ? `${ue.moyenne.toFixed(2)}/20` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {previewReleve && (
        <BulletinPreviewModal entry={previewReleve} resolved={resolveBulletin(previewReleve, students)} onClose={() => setPreviewReleve(null)} />
      )}
    </div>
  );
}

function printRecu(p: import("@/data/studentStore").PaiementRecord) {
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return;
  const lignesHtml =
    p.lignes && p.lignes.length > 0
      ? p.lignes
          .map(
            (l) =>
              `<tr><td style="padding-left:12px;color:#666">${l.label}</td><td>${l.montant.toLocaleString("fr-FR")} FCFA</td></tr>`,
          )
          .join("")
      : `<tr><td>Rubrique</td><td>${p.rubrique}</td></tr>`;
  w.document.write(`<!DOCTYPE html><html><head><title>${p.numeroRecu}</title>
    <style>body{font-family:system-ui;padding:24px}h1{font-size:18px}table{width:100%;margin-top:16px}td{padding:6px 0;border-bottom:1px solid #eee}</style>
    </head><body>
    <h1>EduManage — Reçu de paiement</h1>
    <p>N° ${p.numeroRecu || p.reference}</p>
    <table>
      <tr><td>Date</td><td>${p.date}</td></tr>
      <tr><td>Étudiant</td><td>${p.etudiant}</td></tr>
      <tr><td colspan="2"><strong>Détail facture</strong></td></tr>
      ${lignesHtml}
      <tr><td>Montant versé</td><td><strong>${p.montant.toLocaleString("fr-FR")} FCFA</strong></td></tr>
      <tr><td>Moyen</td><td>${p.moyen}</td></tr>
      <tr><td>Statut</td><td>${p.statut}</td></tr>
      <tr><td>Solde restant</td><td>${p.soldeRestant.toLocaleString("fr-FR")} FCFA</td></tr>
    </table>
    <p style="margin-top:24px;font-size:12px;color:#666">Document généré automatiquement</p>
    <script>window.print()</script>
    </body></html>`);
  w.document.close();
}

export function StudentFraisPayePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const paiements = usePaiementsByEtudiant(student?.id ?? "");
  const payes = paiements.filter((p) => p.statut !== "annule" && p.montant > 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Frais payés</h2>
          <p className="text-sm text-muted-foreground mt-1">Historique des règlements effectivement encaissés</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total réglé</p>
          <p className="text-xl font-bold text-emerald-600">{formatCFA(payes.reduce((s, p) => s + p.montant, 0))}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {payes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucun paiement enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Rubrique</th>
                <th className="px-4 py-3">Moyen</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Reçu</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payes.map((p) => {
                const c = moyenPaiementColor(p.moyen || "—");
                return (
                  <tr key={p.id} className="border-b border-border last:border-0" data-testid={`frais-paye-${p.id}`}>
                    <td className="px-4 py-3">{formatDate(p.date)}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">{p.rubrique}</div>
                      {p.lignes && p.lignes.length > 1 && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{p.lignes.map((l) => l.label).join(" · ")}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.moyen && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: c.color, background: c.bg }}>{p.moyen}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-600">{formatCFA(p.montant)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.numeroRecu || p.reference}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => printRecu(p)} className="text-xs text-primary hover:underline">Imprimer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function StudentFraisImpayePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const paiements = usePaiementsByEtudiant(student?.id ?? "");
  const impayes = paiements.filter((p) => p.statut !== "annule" && p.montant < montantQuittance(p));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Frais impayés</h2>
          <p className="text-sm text-muted-foreground mt-1">Factures en attente de règlement</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Solde dû</p>
          <p className={`text-xl font-bold ${(student?.soldeDu ?? 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>{formatCFA(student?.soldeDu ?? 0)}</p>
        </div>
      </div>
      {impayes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucune facture impayée — vous êtes à jour.</p>
      ) : (
        <div className="space-y-2">
          {impayes.map((p) => {
            const reste = montantQuittance(p) - p.montant;
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3" data-testid={`frais-impaye-${p.id}`}>
                <div>
                  <p className="text-sm font-medium text-foreground">{p.rubrique}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Émise le {formatDate(p.date)}{p.dateLimite && ` · échéance ${formatShortDate(p.dateLimite)}`}
                    {p.montant > 0 && ` · ${formatCFA(p.montant)} déjà réglé`}
                  </p>
                </div>
                <p className="text-lg font-bold text-red-500">{formatCFA(reste)}</p>
              </div>
            );
          })}
        </div>
      )}
      <Link
        href="/student/payer-factures"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <CreditCard size={15} /> Payer en ligne
      </Link>
    </div>
  );
}

const MOYENS_PAIEMENT_EN_LIGNE = ["wave", "orange"];

export function StudentPayerFacturesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const paiements = usePaiementsByEtudiant(student?.id ?? "");
  const modesPaiement = useModesPaiementFinance();
  const modesEnLigne = modesPaiement.filter((m) => MOYENS_PAIEMENT_EN_LIGNE.some((k) => m.intitule.toLowerCase().includes(k)));
  const impayes = paiements.filter((p) => p.statut !== "annule" && p.montant < montantQuittance(p));

  const [selectedId, setSelectedId] = useState<string>("");
  const [montant, setMontant] = useState<number>(0);
  const [moyen, setMoyen] = useState<string>("");
  const [numero, setNumero] = useState("");
  const [paying, setPaying] = useState(false);

  const selected = impayes.find((p) => p.id === selectedId);
  const resteSelected = selected ? montantQuittance(selected) - selected.montant : 0;

  const selectQuittance = (id: string) => {
    setSelectedId(id);
    const p = impayes.find((x) => x.id === id);
    setMontant(p ? montantQuittance(p) - p.montant : 0);
  };

  const handlePayer = () => {
    if (!student || !selected || !moyen || montant <= 0) return;
    if (montant > resteSelected) {
      toast.error("Le montant dépasse le reste dû sur cette facture.");
      return;
    }
    if (!numero.trim()) {
      toast.error("Indiquez le numéro utilisé pour la transaction (téléphone Wave/Orange Money).");
      return;
    }
    setPaying(true);
    const date = new Date().toISOString().slice(0, 10);
    const reference = `${moyen.toUpperCase().replace(/\s+/g, "-")}-${numero.trim()}`;
    const quittanceLignes = selected.lignes && selected.lignes.length > 0 ? selected.lignes : [{ label: selected.rubrique, montant: montantQuittance(selected) }];
    const dejaPayeAvant = selected.montant;
    payerQuittance({ id: selected.id, montant, moyen, reference, date });
    enregistrerEncaissement({
      quittanceId: selected.id,
      quittanceReference: selected.numeroRecu,
      quittanceDateEmission: selected.date,
      quittanceDateLimite: selected.dateLimite,
      montantQuittanceTotal: montantQuittance(selected),
      quittanceLignes,
      dejaPayeAvant,
      etudiantId: student.id,
      payeur: `${student.matricule} - ${student.prenom} ${student.nom}`,
      filiere: student.filiere,
      annee: student.annee,
      montant,
      moyen,
      referenceBancaire: reference,
      date,
      encaissePar: `${student.prenom} ${student.nom} (paiement en ligne)`,
    });
    toast.success("Paiement enregistré — merci !");
    setSelectedId("");
    setMontant(0);
    setMoyen("");
    setNumero("");
    setPaying(false);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Payer une facture en ligne</h2>
        <p className="text-sm text-muted-foreground mt-1">Solde dû : <span className={(student?.soldeDu ?? 0) > 0 ? "text-red-500 font-semibold" : "text-emerald-600 font-semibold"}>{formatCFA(student?.soldeDu ?? 0)}</span></p>
      </div>

      <div className="flex items-start gap-2.5 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
        <ShieldAlert size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Simulation de paiement en ligne — aucune passerelle Wave/Orange Money réelle n'est branchée (mode démo). Le règlement saisi ici est cependant enregistré comme un vrai paiement dans votre dossier, exactement comme s'il avait été encaissé par l'administration.
        </p>
      </div>

      {impayes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucune facture à régler — vous êtes à jour.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Facture à régler <span className="text-red-500">*</span></label>
            <select
              value={selectedId}
              onChange={(e) => selectQuittance(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="payer-facture-select"
            >
              <option value="">— Sélectionner —</option>
              {impayes.map((p) => (
                <option key={p.id} value={p.id}>{p.rubrique} — reste {formatCFA(montantQuittance(p) - p.montant)}</option>
              ))}
            </select>
          </div>

          {selected && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Montant à payer (max {formatCFA(resteSelected)}) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min={1}
                    max={resteSelected}
                    value={montant || ""}
                    onChange={(e) => setMontant(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="payer-facture-montant"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyen de paiement <span className="text-red-500">*</span></label>
                  <select
                    value={moyen}
                    onChange={(e) => setMoyen(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="payer-facture-moyen"
                  >
                    <option value="">— Sélectionner —</option>
                    {modesEnLigne.map((m) => (
                      <option key={m.id} value={m.intitule}>{m.intitule}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Numéro utilisé pour la transaction <span className="text-red-500">*</span></label>
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="ex: 77 000 00 00"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="payer-facture-numero"
                />
              </div>
              <button
                type="button"
                onClick={handlePayer}
                disabled={paying || !moyen || montant <= 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                data-testid="payer-facture-confirmer"
              >
                <CreditCard size={15} /> {paying ? "Paiement en cours…" : `Payer ${formatCFA(montant)}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function StudentProfilePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  if (!student) return <p className="text-sm text-muted-foreground">Profil introuvable.</p>;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4 max-w-2xl">
      <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mon profil</h2>
      <p className="text-xs text-muted-foreground">Le matricule est définitif dès la 1ère inscription.</p>
      {[
        ["Matricule", student.matricule],
        ["Nom", `${student.prenom} ${student.nom}`],
        ["Email", student.email],
        ["Téléphone", student.telephone || "—"],
        ["Filière", student.filiere],
        ["Niveau", student.niveau],
        ["Classe pédagogique", student.classe],
        ["Année", student.annee],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between border-b border-border py-2 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{value}</span>
        </div>
      ))}

      {(student.documentsFournis?.length ?? 0) > 0 && (
        <div className="pt-3 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
            Pièces justificatives déposées
          </h3>
          <ul className="space-y-1 text-sm">
            {student.documentsFournis!.map((docId) => {
              const label = DOCUMENTS_INSCRIPTION.find((d) => d.id === docId)?.label ?? docId;
              return (
                <li key={docId} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{docId}</span>
                  <span className="text-foreground font-medium">{label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

const COURSE_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-600", bar: "#2563eb" },
  { bg: "bg-emerald-100", text: "text-emerald-600", bar: "#10b981" },
  { bg: "bg-violet-100", text: "text-violet-600", bar: "#8b5cf6" },
  { bg: "bg-amber-100", text: "text-amber-600", bar: "#f59e0b" },
  { bg: "bg-pink-100", text: "text-pink-600", bar: "#ec4899" },
  { bg: "bg-indigo-100", text: "text-indigo-600", bar: "#4f46e5" },
];

/** Mes cours — une carte par EC réel de la maquette du niveau/filière de l'étudiant, avec des
 * indicateurs tous dérivés de données réelles : progression = heures de cahier de texte
 * réalisées / VHT (getCahierStatsForEc), prochaine séance = la plus proche séance future
 * planifiée pour cet EC, dernière note = la dernière note publiée pour cet EC. Aucune donnée
 * inventée (pas de date d'évaluation : EvaluationRecord n'en porte pas). */
type ProgressionBucket = "non_commence" | "en_cours" | "termine";
function bucketProgression(pct: number): ProgressionBucket {
  if (pct <= 0) return "non_commence";
  if (pct >= 100) return "termine";
  return "en_cours";
}

interface CoursTableRow extends Record<string, unknown> {
  id: string;
  cours: string;
  code: string;
  ue: string;
  semestre: string;
  prof: string;
  credits: number;
  vht: number;
  progression: number;
  prochain: string;
  note: string;
  ressources: number;
}

export function StudentCoursPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const ues = useUes();
  const ecs = useEcs();
  const seances = useSeances();
  const notes = useNotes();
  const anneeActuelle = useAnneeActuelle();
  useCahiers(); // s'abonne pour refléter la progression (cahiers de séance réellement soumis)
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const ressources = useRessourcesPourClasse(student?.classeId ?? "");

  const [query, setQuery] = useState("");
  const [semestreFiltre, setSemestreFiltre] = useState("");
  const [viewMode, setViewMode] = useState<"grille" | "liste" | "tableau">("grille");
  const [showFiltresAvances, setShowFiltresAvances] = useState(false);
  const [profFiltre, setProfFiltre] = useState("");
  const [progressionFiltre, setProgressionFiltre] = useState<"" | ProgressionBucket>("");
  const [avecRessourcesSeulement, setAvecRessourcesSeulement] = useState(false);
  const [avecNoteSeulement, setAvecNoteSeulement] = useState(false);
  const [tri, setTri] = useState<"nom" | "progression" | "credits">("nom");

  const mesUes = useMemo(
    () => ues.filter((u) => u.filiereId === student?.filiereId && u.niveau === student?.niveau).sort((a, b) => a.semestre.localeCompare(b.semestre) || a.code.localeCompare(b.code)),
    [ues, student?.filiereId, student?.niveau],
  );
  const semestres = useMemo(() => Array.from(new Set(mesUes.map((u) => u.semestre))), [mesUes]);
  const profsDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const ue of mesUes) for (const ec of ecs.filter((e) => e.ueId === ue.id)) if (ec.responsable) set.add(ec.responsable);
    return Array.from(set).sort();
  }, [mesUes, ecs]);

  const mesCoursBase = useMemo(() => {
    const list: { ue: UeRecord; ec: EcRecord }[] = [];
    for (const ue of mesUes) {
      if (semestreFiltre && ue.semestre !== semestreFiltre) continue;
      for (const ec of ecs.filter((e) => e.ueId === ue.id)) {
        const q = query.trim().toLowerCase();
        if (q && !`${ec.code} ${ec.libelle} ${ec.responsable}`.toLowerCase().includes(q)) continue;
        if (profFiltre && ec.responsable !== profFiltre) continue;
        list.push({ ue, ec });
      }
    }
    return list;
  }, [mesUes, ecs, semestreFiltre, query, profFiltre]);

  const todayIso = new Date().toISOString().slice(0, 10);
  function prochaineSeancePourEc(ecId: string) {
    const candidates = seances
      .filter((s) => s.ecId === ecId && s.classeId === student?.classeId)
      .map((s) => {
        const d = new Date(`${s.semaineDu}T12:00:00`);
        d.setDate(d.getDate() + (s.jour - 1));
        return { s, dateIso: d.toISOString().slice(0, 10) };
      })
      .filter((x) => x.dateIso >= todayIso)
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso) || a.s.heureDebut.localeCompare(b.s.heureDebut));
    return candidates[0];
  }

  function derniereNotePourEc(ecId: string) {
    const mine = notes.filter((n) => n.ecId === ecId && n.etudiantId === student?.id && n.statut === "publie");
    return mine[mine.length - 1];
  }

  const coursEnrichis = useMemo(() => {
    let list = mesCoursBase.map(({ ue, ec }, i) => ({
      ue,
      ec,
      color: COURSE_COLORS[i % COURSE_COLORS.length],
      stats: getCahierStatsForEc(ec.id),
      prochaine: prochaineSeancePourEc(ec.id),
      derniereNote: derniereNotePourEc(ec.id),
      nbRessources: ressources.filter((r) => r.ecId === ec.id).length,
    }));
    if (progressionFiltre) list = list.filter((c) => bucketProgression(c.stats.pctProgramme) === progressionFiltre);
    if (avecRessourcesSeulement) list = list.filter((c) => c.nbRessources > 0);
    if (avecNoteSeulement) list = list.filter((c) => !!c.derniereNote);
    if (tri === "progression") list = [...list].sort((a, b) => b.stats.pctProgramme - a.stats.pctProgramme);
    else if (tri === "credits") list = [...list].sort((a, b) => b.ec.credits - a.ec.credits);
    else list = [...list].sort((a, b) => a.ec.libelle.localeCompare(b.ec.libelle));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesCoursBase, ressources, seances, notes, student?.id, progressionFiltre, avecRessourcesSeulement, avecNoteSeulement, tri]);

  const activeAdvancedCount = [profFiltre, progressionFiltre, avecRessourcesSeulement, avecNoteSeulement].filter(Boolean).length;
  function resetFiltresAvances() {
    setProfFiltre("");
    setProgressionFiltre("");
    setAvecRessourcesSeulement(false);
    setAvecNoteSeulement(false);
    setTri("nom");
  }

  const tableRows: CoursTableRow[] = useMemo(() => coursEnrichis.map((c) => ({
    id: c.ec.id,
    cours: c.ec.libelle,
    code: c.ec.code,
    ue: c.ue.libelle,
    semestre: c.ue.semestre,
    prof: c.ec.responsable || "—",
    credits: c.ec.credits,
    vht: c.ec.vht,
    progression: c.stats.pctProgramme,
    prochain: c.prochaine ? `${formatShortDate(c.prochaine.dateIso)} · ${c.prochaine.s.heureDebut}` : "—",
    note: c.derniereNote ? `${c.derniereNote.note}/20` : "—",
    ressources: c.nbRessources,
  })), [coursEnrichis]);

  const tableColumns: Column<CoursTableRow>[] = [
    {
      key: "cours", header: "Cours", sortable: true,
      render: (r) => (<div><div className="font-medium text-foreground">{r.cours}</div><div className="text-[11px] text-muted-foreground">{r.code}</div></div>),
    },
    { key: "ue", header: "UE", sortable: true },
    { key: "semestre", header: "Sem.", sortable: true },
    { key: "prof", header: "Professeur", sortable: true },
    { key: "credits", header: "Crédits", sortable: true },
    {
      key: "progression", header: "Progression", sortable: true,
      render: (r) => <span className={cn("font-semibold", (r.progression as number) >= 100 && "text-emerald-600")}>{r.progression as number}%</span>,
    },
    { key: "prochain", header: "Prochain cours" },
    {
      key: "note", header: "Dernière note",
      render: (r) => {
        const v = r.note as string;
        if (v === "—") return v;
        return <span className={cn("font-semibold", parseFloat(v) >= 10 ? "text-emerald-600" : "text-red-500")}>{v}</span>;
      },
    },
    { key: "ressources", header: "Ressources", render: (r) => `${r.ressources as number} ress.` },
  ];

  // Historique réel des années précédentes : reconstruit à partir des notes publiées de
  // l'étudiant (seule trace réellement conservée par EC/année dans le modèle de données).
  const anneesPrecedentes = useMemo(() => {
    const map = new Map<string, { ec: string; note: number }[]>();
    for (const n of notes) {
      if (n.etudiantId !== student?.id || n.statut !== "publie" || n.annee === anneeActuelle) continue;
      if (!map.has(n.annee)) map.set(n.annee, []);
      map.get(n.annee)!.push({ ec: n.ec, note: n.note });
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [notes, student?.id, anneeActuelle]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes cours</h2>
        <p className="text-sm text-muted-foreground mt-1">{student?.filiere} · {student?.niveau} · Année {anneeActuelle} — maquette pédagogique</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un cours, un professeur…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="cours-recherche"
            />
          </div>
          <select
            value={semestreFiltre}
            onChange={(e) => setSemestreFiltre(e.target.value)}
            className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="cours-filtre-semestre"
          >
            <option value="">Tous les semestres</option>
            {semestres.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setShowFiltresAvances((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm border rounded-xl transition-colors",
              showFiltresAvances || activeAdvancedCount > 0 ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted",
            )}
            data-testid="cours-toggle-filtres-avances"
          >
            <SlidersHorizontal size={14} /> Filtres avancés
            {activeAdvancedCount > 0 && (
              <span className={cn("inline-flex items-center justify-center min-w-[16px] h-[16px] text-[10px] font-bold rounded-full px-1", showFiltresAvances || activeAdvancedCount > 0 ? "bg-white text-primary" : "bg-primary text-white")}>
                {activeAdvancedCount}
              </span>
            )}
            {showFiltresAvances ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-shrink-0 ml-auto">
            {([["grille", LayoutGrid, "Grille"], ["liste", List, "Liste"], ["tableau", Table2, "Tableau"]] as const).map(([mode, Icon, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                title={label}
                className={cn("p-2 rounded-md transition-colors", viewMode === mode ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                data-testid={`cours-vue-${mode}`}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        {showFiltresAvances && (
          <div className="pt-3 border-t border-border grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={profFiltre}
              onChange={(e) => setProfFiltre(e.target.value)}
              className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="cours-filtre-prof"
            >
              <option value="">Tous les professeurs</option>
              {profsDisponibles.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={progressionFiltre}
              onChange={(e) => setProgressionFiltre(e.target.value as "" | ProgressionBucket)}
              className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="cours-filtre-progression"
            >
              <option value="">Toute progression</option>
              <option value="non_commence">Non commencé</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
            </select>
            <select
              value={tri}
              onChange={(e) => setTri(e.target.value as "nom" | "progression" | "credits")}
              className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="cours-tri"
            >
              <option value="nom">Trier par nom</option>
              <option value="progression">Trier par progression</option>
              <option value="credits">Trier par crédits</option>
            </select>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={avecRessourcesSeulement} onChange={(e) => setAvecRessourcesSeulement(e.target.checked)} data-testid="cours-filtre-avec-ressources" />
                Avec ressources
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={avecNoteSeulement} onChange={(e) => setAvecNoteSeulement(e.target.checked)} data-testid="cours-filtre-avec-note" />
                Avec note publiée
              </label>
            </div>
            {activeAdvancedCount > 0 && (
              <button type="button" onClick={resetFiltresAvances} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors">
                <X size={11} /> Effacer les filtres avancés
              </button>
            )}
          </div>
        )}
      </div>

      {coursEnrichis.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucun cours ne correspond.</p>
      ) : viewMode === "tableau" ? (
        <DataTable columns={tableColumns} data={tableRows} pageSize={10} emptyMessage="Aucun cours ne correspond." />
      ) : viewMode === "liste" ? (
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
          {coursEnrichis.map((c) => (
            <div key={c.ec.id} className="flex items-center gap-3 p-3.5 hover:bg-muted/40 transition-colors" data-testid={`cours-liste-${c.ec.id}`}>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", c.color.bg)}>
                <BookOpen size={14} className={c.color.text} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">{c.ec.libelle}</div>
                <div className="text-[11px] text-muted-foreground truncate">{c.ec.code} · {c.ue.libelle} · {c.ec.responsable || "Responsable non assigné"}</div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0 hidden sm:inline-block">{c.ue.semestre}</span>
              <div className="w-24 flex-shrink-0 hidden md:block">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.stats.pctProgramme}%`, background: c.color.bar }} />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 text-right">{c.stats.pctProgramme}%</div>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0 w-14 text-right hidden sm:block">{c.ec.credits} cr.</span>
              <Link href="/student/ressources" className="p-1.5 rounded-lg text-primary hover:bg-primary/10 flex-shrink-0" title={`${c.nbRessources} ressource(s)`}>
                <Library size={14} />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {coursEnrichis.map(({ ue, ec, color, stats, prochaine, derniereNote, nbRessources }) => (
            <div key={ec.id} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ boxShadow: "var(--shadow-sm)" }} data-testid={`cours-ec-${ec.id}`}>
              <div className="p-4 flex-1">
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", color.bg)}>
                    <BookOpen size={16} className={color.text} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-foreground leading-tight">{ec.libelle}</h3>
                    <p className="text-[11px] text-muted-foreground truncate">{ec.code} · {ue.libelle}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">{ue.semestre}</span>
                </div>

                <p className="text-xs text-muted-foreground truncate mb-1">{ec.responsable || "Responsable non assigné"}</p>
                <p className="text-[11px] text-muted-foreground mb-3">{ec.credits} crédit(s) · {ec.vht}h VHT</p>

                <div className="mb-3">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">Progression du programme</span>
                    <span className="font-semibold text-foreground">{stats.pctProgramme}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${stats.pctProgramme}%`, background: color.bar }} />
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock size={11} className="flex-shrink-0" />
                    {prochaine ? (
                      <span className="truncate">Prochain cours : {formatShortDate(prochaine.dateIso)} · {prochaine.s.heureDebut} · {prochaine.s.salle}</span>
                    ) : (
                      <span>Aucune séance à venir planifiée</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <GraduationCap size={11} className="flex-shrink-0" />
                    {derniereNote ? (
                      <span>Dernière note : <span className={cn("font-semibold", derniereNote.note >= 10 ? "text-emerald-600" : "text-red-500")}>{derniereNote.note}/20</span> ({derniereNote.type})</span>
                    ) : (
                      <span>Aucune note publiée</span>
                    )}
                  </div>
                </div>
              </div>
              <Link
                href="/student/ressources"
                className="flex items-center gap-1.5 px-4 py-2.5 border-t border-border text-xs font-medium text-primary hover:bg-muted/60 transition-colors"
              >
                <Library size={12} /> {nbRessources} ressource{nbRessources !== 1 ? "s" : ""} disponible{nbRessources !== 1 ? "s" : ""}
              </Link>
            </div>
          ))}
        </div>
      )}

      {anneesPrecedentes.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold text-sm text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Années précédentes</h3>
          <div className="space-y-4">
            {anneesPrecedentes.map(([annee, items]) => (
              <div key={annee}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Année {annee}</p>
                <div className="space-y-1">
                  {items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-1.5">
                      <span className="text-foreground">{it.ec}</span>
                      <span className={cn("font-semibold text-xs", it.note >= 10 ? "text-emerald-600" : "text-red-500")}>{it.note}/20</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Link href="/student/releves" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium mt-3">
            Voir mes relevés & bulletins
          </Link>
        </div>
      )}
    </div>
  );
}

export function StudentAbsencesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  useCahiers(); // s'abonne pour refléter les cahiers de séance réellement soumis
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const rows = student ? getAssiduiteRowsPourEtudiant(student.id) : [];
  const taux = student ? getTauxPresencePourEtudiant(student.id) : { present: 0, total: 0, pct: 100 };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Absences & retards</h2>
          <p className="text-sm text-muted-foreground mt-1">Constatés à partir des cahiers de séance réellement soumis</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Taux de présence</p>
          <p className={`text-xl font-bold ${taux.pct >= 80 ? "text-emerald-600" : "text-red-500"}`}>{taux.pct}%</p>
          <p className="text-[11px] text-muted-foreground">{taux.present}/{taux.total} séances</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucune absence ni retard constaté.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Module (EC)</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Justifié</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0" data-testid={`absence-ligne-${r.id}`}>
                  <td className="px-4 py-3">{formatDate(r.date)}</td>
                  <td className="px-4 py-3">{r.ec}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", r.type === "absence" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>
                      {r.type === "absence" ? "Absence" : `Retard${r.retardMinutes ? ` (${r.retardMinutes} min)` : ""}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.justifie ? (
                      <span className="text-xs text-emerald-600 font-medium">Justifié{r.justification ? ` — ${r.justification}` : ""}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Non justifié</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
