import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  NotebookPen, ClipboardList, Search, ExternalLink, Paperclip, Ban, Clock,
  CalendarDays, UserCheck, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore, useCahiers, useSeances } from "@/hooks/useStudentStore";
import { KPICard } from "@/components/admin/KPICard";
import { formatDate, formatShortDate, cn } from "@/lib/utils";
import { mondayOf } from "@/lib/teacherUtils";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const EVALUATION_LABELS: Record<string, string> = {
  quiz: "Quiz",
  controle: "Contrôle",
  tp: "TP noté",
  projet: "Projet",
  examen: "Examen",
};

/** Cahier de texte étudiant — lecture seule intégrale (aucune écriture côté portail étudiant).
 * Exploite les champs réels du CahierSeanceRecord que l'ancienne page ignorait : compétences,
 * liens externes, pièces jointes, évaluation annoncée, taux de présence, séance annulée. */
export default function StudentCahierPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const cahiers = useCahiers();
  const seances = useSeances();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];

  const [query, setQuery] = useState("");
  const [ecFiltre, setEcFiltre] = useState("");
  const [typeFiltre, setTypeFiltre] = useState<"" | "note" | "devoir">("");

  const mesCahiers = useMemo(
    () =>
      cahiers
        .filter((c) => c.classeId === student?.classeId && c.statut !== "brouillon")
        .sort((a, b) => b.date.localeCompare(a.date) || b.heureDebut.localeCompare(a.heureDebut)),
    [cahiers, student?.classeId],
  );

  const ecsDisponibles = useMemo(() => Array.from(new Set(mesCahiers.map((c) => c.ec))).sort(), [mesCahiers]);

  const cahiersFiltres = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mesCahiers.filter((c) => {
      if (ecFiltre && c.ec !== ecFiltre) return false;
      const estDevoir = !!c.travail?.devoirDonne;
      if (typeFiltre === "devoir" && !estDevoir) return false;
      if (typeFiltre === "note" && estDevoir) return false;
      if (q && !`${c.ec} ${c.sujet} ${c.resume} ${c.prof}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [mesCahiers, query, ecFiltre, typeFiltre]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const seancesReelles = useMemo(() => mesCahiers.filter((c) => c.etatSeance !== "annulee"), [mesCahiers]);
  const coursConcernes = useMemo(() => new Set(seancesReelles.map((c) => c.ecId)).size, [seancesReelles]);
  const devoirsEnCours = useMemo(
    () => mesCahiers.filter((c) => c.travail?.devoirDonne && (!c.travail.dateLimite || c.travail.dateLimite >= todayIso)).length,
    [mesCahiers, todayIso],
  );
  const tauxPresenceMoyen = seancesReelles.length
    ? Math.round(seancesReelles.reduce((s, c) => s + (c.tauxPresence || 0), 0) / seancesReelles.length)
    : 0;
  const nbDevoirs = useMemo(() => mesCahiers.filter((c) => c.travail?.devoirDonne).length, [mesCahiers]);
  const nbNotes = mesCahiers.length - nbDevoirs;

  const weekMonday = mondayOf(todayIso);
  const weekSeances = useMemo(
    () => seances
      .filter((s) => s.classeId === student?.classeId && s.semaineDu === weekMonday)
      .sort((a, b) => a.jour - b.jour || a.heureDebut.localeCompare(b.heureDebut)),
    [seances, student?.classeId, weekMonday],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Cahier de texte</h2>
        <p className="text-sm text-muted-foreground mt-1">{student?.classe} — ce qui a été vu en cours, séance par séance</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KPICard icon={NotebookPen} label="Séances consignées" value={seancesReelles.length} accentColor="#2563eb" />
        <KPICard icon={CalendarDays} label="Cours concernés" value={coursConcernes} accentColor="#10b981" />
        <KPICard icon={ClipboardList} label="Devoirs en cours" value={devoirsEnCours} accentColor="#f59e0b" />
        <KPICard icon={UserCheck} label="Taux de présence" value={`${tauxPresenceMoyen}%`} accentColor={tauxPresenceMoyen >= 80 ? "#10b981" : "#ef4444"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher dans le cahier de texte…"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="cahier-recherche"
              />
            </div>
            <select
              value={ecFiltre}
              onChange={(e) => setEcFiltre(e.target.value)}
              className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="cahier-filtre-ec"
            >
              <option value="">Tous les cours</option>
              {ecsDisponibles.map((ec) => <option key={ec} value={ec}>{ec}</option>)}
            </select>
            <select
              value={typeFiltre}
              onChange={(e) => setTypeFiltre(e.target.value as "" | "note" | "devoir")}
              className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="cahier-filtre-type"
            >
              <option value="">Tous les types</option>
              <option value="note">Notes de cours</option>
              <option value="devoir">Devoirs</option>
            </select>
          </div>

          {cahiersFiltres.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">
              Aucune séance ne correspond.
            </p>
          ) : (
            cahiersFiltres.map((c) => {
              const estDevoir = !!c.travail?.devoirDonne;
              const estAnnulee = c.etatSeance === "annulee";
              return (
                <div
                  key={c.id}
                  className={cn(
                    "rounded-2xl border bg-card p-5",
                    estAnnulee ? "border-amber-200 bg-amber-50/40" : "border-border",
                  )}
                  style={!estAnnulee ? { boxShadow: "var(--shadow-sm)" } : undefined}
                  data-testid={`cahier-${c.id}`}
                >
                  <div className="flex items-start gap-3 mb-1">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      estAnnulee ? "bg-amber-100" : estDevoir ? "bg-amber-100" : "bg-blue-100",
                    )}>
                      {estAnnulee ? <Ban size={15} className="text-amber-600" /> : estDevoir ? <ClipboardList size={15} className="text-amber-600" /> : <NotebookPen size={15} className="text-blue-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-foreground">{c.ec}</h3>
                        {estDevoir && !estAnnulee && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Devoir</span>}
                        {estAnnulee && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Séance annulée</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.prof} · {c.salle} · {c.typeSeance}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(c.date)} · {c.heureDebut}–{c.heureFin}</span>
                  </div>

                  {estAnnulee ? (
                    <p className="text-sm text-amber-800 mt-3">{c.motifAnnulation || "Séance annulée — aucun motif renseigné."}</p>
                  ) : (
                    <>
                      {c.sujet && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-foreground">Sujet</p>
                          <p className="text-sm text-muted-foreground">{c.sujet}</p>
                        </div>
                      )}
                      {(c.resume || c.activite) && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-foreground">Résumé</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.resume || c.activite}</p>
                        </div>
                      )}
                      {c.competences && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-foreground">Compétences travaillées</p>
                          <p className="text-sm text-muted-foreground">{c.competences}</p>
                        </div>
                      )}
                      {c.evaluation && c.evaluation.types.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {c.evaluation.types.map((t) => (
                              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">{EVALUATION_LABELS[t] ?? t}</span>
                            ))}
                          </div>
                          {c.evaluation.detail && <p className="text-sm text-muted-foreground">{c.evaluation.detail}</p>}
                        </div>
                      )}
                      {c.liensExternes && c.liensExternes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border space-y-1">
                          <p className="text-xs font-semibold text-foreground mb-1">Liens partagés</p>
                          {c.liensExternes.map((lien, i) => (
                            <a key={i} href={lien} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline truncate">
                              <ExternalLink size={12} className="flex-shrink-0" /> <span className="truncate">{lien}</span>
                            </a>
                          ))}
                        </div>
                      )}
                      {c.piecesJointes && c.piecesJointes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs font-semibold text-foreground mb-1.5">Pièces jointes</p>
                          <div className="flex flex-wrap gap-2">
                            {c.piecesJointes.map((p) =>
                              p.dataUrl ? (
                                <a
                                  key={p.id}
                                  href={p.dataUrl}
                                  download={p.nom}
                                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-muted text-primary hover:underline"
                                >
                                  <Paperclip size={11} /> {p.nom}
                                </a>
                              ) : (
                                <span key={p.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground">
                                  <Paperclip size={11} /> {p.nom}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}
                      {c.photosTableau && c.photosTableau.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs font-semibold text-foreground mb-1.5">Photos du tableau</p>
                          <div className="flex flex-wrap gap-2">
                            {c.photosTableau.map((src, i) => (
                              <img
                                key={i}
                                src={src}
                                alt={`Photo du tableau ${i + 1}`}
                                className="w-16 h-16 object-cover rounded-lg border border-border"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {c.travail?.devoirDonne && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs font-semibold text-foreground">Travail donné</p>
                          <p className="text-sm text-muted-foreground">{c.travail.devoirDonne}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                            {c.travail.dateLimite && <p className="text-[11px] text-muted-foreground">À rendre pour le {formatDate(c.travail.dateLimite)}</p>}
                            {c.travail.bareme && <p className="text-[11px] text-muted-foreground">Barème : {c.travail.bareme}</p>}
                            {c.travail.fichierARemettre && <p className="text-[11px] text-muted-foreground">Fichier attendu : {c.travail.fichierARemettre}</p>}
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-3">Présence constatée : {c.tauxPresence}%</p>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Clock size={16} className="text-indigo-600" />
                </div>
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Cours de la semaine</h3>
              </div>
              <button onClick={() => setLocation("/student/schedule")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium flex-shrink-0">
                Voir tout <ArrowRight size={11} />
              </button>
            </div>
            {weekSeances.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune séance planifiée cette semaine.</div>
            ) : (
              <div className="p-2">
                {weekSeances.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 mx-2 my-1 px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors">
                    <div className="flex flex-col items-center flex-shrink-0 w-12">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-lg">{s.heureDebut}</span>
                      <span className="text-[10px] text-muted-foreground mt-1">{JOURS[s.jour] ?? s.jour}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{s.ec}</div>
                      <div className="text-[11px] text-muted-foreground truncate">Salle {s.salle} · {s.prof}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-bold text-sm text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Répartition</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-blue-500" /> Notes de cours</span>
                <span className="font-semibold text-foreground">{nbNotes}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><span className="w-2 h-2 rounded-full bg-amber-500" /> Devoirs / Travaux</span>
                <span className="font-semibold text-foreground">{nbDevoirs}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
