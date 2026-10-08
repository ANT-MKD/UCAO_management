import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CalendarX, CheckCircle2, AlertCircle, Clock, Search, CalendarClock, SlidersHorizontal, X } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useTeacherAbsences } from "@/hooks/useTeacherAbsenceStore";
import { useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useEcs } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { KPICard } from "@/components/admin/KPICard";
import { FormModal } from "@/components/admin/FormModal";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { lireFichierPourStockage } from "@/lib/stockageLocal";
import { envoyerJustificatifAbsence, statutJustificationAbsence, type StatutJustificationAbsence, type TeacherAbsenceRecord } from "@/data/teacherAbsenceStore";

/** Statut lisible d'un constat, de l'absence non justifiée à la décision sur le justificatif. */
const STATUT_JUSTIF: Record<StatutJustificationAbsence, { label: string; className: string }> = {
  justifiee: { label: "Justifiée", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  justificatif_envoye: { label: "Justificatif envoyé", className: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  justificatif_refuse: { label: "Justificatif refusé", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  non_justifiee: { label: "Non justifiée", className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
};

const TYPE_LABEL: Record<string, string> = { absence: "Absence", retard: "Retard" };

const STATUT_COLORS = { justifiee: "#10b981", retard: "#f59e0b", nonJustifiee: "#ef4444" };

/** Lecture seule des constats réels (teacherAbsenceStore.ts) déclarés par l'administration sur ce
 * professeur — jamais de saisie ici : l'enseignant consulte et voit si un constat est justifié,
 * exactement le même statut que celui utilisé pour valider/rejeter côté admin (TeacherAbsencePage). */
export default function TeacherAbsencesPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  // Justifier un constat : motif + pièce jointe facultative, envoyés à l'administration.
  const [aJustifier, setAJustifier] = useState<TeacherAbsenceRecord | null>(null);
  const [justifMotif, setJustifMotif] = useState("");
  const [justifPiece, setJustifPiece] = useState<{ nom: string; dataUrl: string } | undefined>();
  const ouvrirJustification = (a: TeacherAbsenceRecord) => {
    setAJustifier(a);
    setJustifMotif("");
    setJustifPiece(undefined);
  };
  const choisirPiece = (file?: File) => {
    if (!file) { setJustifPiece(undefined); return; }
    lireFichierPourStockage(file, { usagePhoto: "document" })
      .then((dataUrl) => setJustifPiece({ nom: file.name, dataUrl }))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Fichier illisible."));
  };
  const envoyerJustification = () => {
    if (!aJustifier || !currentUser) return;
    try {
      envoyerJustificatifAbsence(aJustifier.id, { motif: justifMotif, pieceJointe: justifPiece }, currentUser.id);
      toast.success("Justificatif envoyé à l'administration.");
      setAJustifier(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    }
  };
  const absences = useTeacherAbsences();
  const anneesAcademiques = useAnneesAcademiques();
  const anneeActuelle = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneesAcademiques[0]?.libelle ?? "";
  const ecs = useEcs();
  const classes = useClasses();

  const mine = useMemo(
    () => absences.filter((a) => a.teacherId === currentUser?.linkedId).sort((a, b) => b.date.localeCompare(a.date)),
    [absences, currentUser?.linkedId],
  );

  const [query, setQuery] = useState("");
  const [ecFiltre, setEcFiltre] = useState("");
  const [typeFiltre, setTypeFiltre] = useState("");
  const [periodeFiltre, setPeriodeFiltre] = useState("");
  const [classeFiltre, setClasseFiltre] = useState("");
  const [justifieFiltre, setJustifieFiltre] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [filtresAvancesOuverts, setFiltresAvancesOuverts] = useState(false);

  const retards = mine.filter((a) => a.type === "retard").length;
  const justifiees = mine.filter((a) => a.justifie).length;
  const nonJustifiees = mine.length - justifiees;

  const repartitionData = useMemo(() => {
    const absencesNonRetard = mine.filter((a) => a.type !== "retard");
    const justifieesHorsRetard = absencesNonRetard.filter((a) => a.justifie).length;
    const nonJustifieesHorsRetard = absencesNonRetard.length - justifieesHorsRetard;
    return [
      { name: "Justifiées", value: justifieesHorsRetard, color: STATUT_COLORS.justifiee },
      { name: "Retards", value: retards, color: STATUT_COLORS.retard },
      { name: "Non justifiées", value: nonJustifieesHorsRetard, color: STATUT_COLORS.nonJustifiee },
    ].filter((d) => d.value > 0);
  }, [mine, retards]);

  const mesEcsIds = useMemo(() => Array.from(new Set(mine.map((a) => a.ecId))), [mine]);
  const mesClasseIds = useMemo(() => Array.from(new Set(mine.map((a) => a.classeId))), [mine]);

  const filtresActifs = [query, ecFiltre, typeFiltre, periodeFiltre, classeFiltre, justifieFiltre, dateDebut, dateFin].some(Boolean);

  function reinitialiserFiltres() {
    setQuery("");
    setEcFiltre("");
    setTypeFiltre("");
    setPeriodeFiltre("");
    setClasseFiltre("");
    setJustifieFiltre("");
    setDateDebut("");
    setDateFin("");
  }

  const filtrees = useMemo(() => {
    const q = query.trim().toLowerCase();
    const moisCourant = new Date().toISOString().slice(0, 7);
    return mine.filter((a) => {
      if (ecFiltre && a.ecId !== ecFiltre) return false;
      if (classeFiltre && a.classeId !== classeFiltre) return false;
      if (typeFiltre && a.type !== typeFiltre) return false;
      if (justifieFiltre === "oui" && !a.justifie) return false;
      if (justifieFiltre === "non" && a.justifie) return false;
      if (periodeFiltre === "mois" && !a.date.startsWith(moisCourant)) return false;
      if (periodeFiltre === "annee" && a.annee !== anneeActuelle) return false;
      if (dateDebut && a.date < dateDebut) return false;
      if (dateFin && a.date > dateFin) return false;
      if (q) {
        const ec = ecs.find((e) => e.id === a.ecId);
        const classe = classes.find((c) => c.id === a.classeId);
        const haystack = `${ec?.libelle ?? ""} ${classe?.nom ?? ""} ${a.motif}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [mine, query, ecFiltre, classeFiltre, typeFiltre, justifieFiltre, periodeFiltre, dateDebut, dateFin, ecs, classes, anneeActuelle]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes absences</h2>
          <p className="text-sm text-muted-foreground mt-1">Absences et retards constatés par l&apos;administration.</p>
        </div>
        <button
          type="button"
          onClick={() => setLocation("/teacher/schedule")}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted shrink-0"
        >
          <CalendarClock size={15} /> Voir mon planning
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard icon={CalendarX} label="Total constats" value={mine.length} accentColor="#4f46e5" />
        <KPICard icon={CheckCircle2} label="Justifiées" value={justifiees} accentColor="#10b981" />
        <KPICard icon={Clock} label="Retards" value={retards} accentColor="#f59e0b" />
        <KPICard icon={AlertCircle} label="Non justifiées" value={nonJustifiees} accentColor={nonJustifiees > 0 ? "#ef4444" : "#10b981"} />
      </div>

      {mine.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <CheckCircle2 size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucune absence ni retard constaté.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4 min-w-0">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input aria-label="Rechercher un cours, un motif"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher un cours, un motif…"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-absences-recherche"
                  />
                </div>
                <select aria-label="Tous les types"
                  value={typeFiltre}
                  onChange={(e) => setTypeFiltre(e.target.value)}
                  className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="teacher-absences-filtre-type"
                >
                  <option value="">Tous les types</option>
                  <option value="absence">Absence</option>
                  <option value="retard">Retard</option>
                </select>
                <button
                  type="button"
                  onClick={() => setFiltresAvancesOuverts((o) => !o)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-xl border font-medium",
                    filtresAvancesOuverts ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted",
                  )}
                  data-testid="teacher-absences-toggle-filtres-avances"
                >
                  <SlidersHorizontal size={14} /> Filtres avancés
                </button>
                {filtresActifs && (
                  <button
                    type="button"
                    onClick={reinitialiserFiltres}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                    data-testid="teacher-absences-reinitialiser-filtres"
                  >
                    <X size={12} /> Réinitialiser les filtres
                  </button>
                )}
              </div>

              {filtresAvancesOuverts && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border">
                  <select aria-label="Tous les cours"
                    value={ecFiltre}
                    onChange={(e) => setEcFiltre(e.target.value)}
                    className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-absences-filtre-cours"
                  >
                    <option value="">Tous les cours</option>
                    {mesEcsIds.map((id) => {
                      const ec = ecs.find((e) => e.id === id);
                      return <option key={id} value={id}>{ec ? `${ec.code} — ${ec.libelle}` : id}</option>;
                    })}
                  </select>
                  <select aria-label="Toutes les classes"
                    value={classeFiltre}
                    onChange={(e) => setClasseFiltre(e.target.value)}
                    className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-absences-filtre-classe"
                  >
                    <option value="">Toutes les classes</option>
                    {mesClasseIds.map((id) => {
                      const classe = classes.find((c) => c.id === id);
                      return <option key={id} value={id}>{classe?.nom ?? id}</option>;
                    })}
                  </select>
                  <select
                    aria-label="Filtrer par justification"
                    value={justifieFiltre}
                    onChange={(e) => setJustifieFiltre(e.target.value)}
                    className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-absences-filtre-justifie"
                  >
                    <option value="">Justifiées et non justifiées</option>
                    <option value="oui">Justifiées uniquement</option>
                    <option value="non">Non justifiées uniquement</option>
                  </select>
                  <select aria-label="Toutes les périodes"
                    value={periodeFiltre}
                    onChange={(e) => setPeriodeFiltre(e.target.value)}
                    className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-absences-filtre-periode"
                  >
                    <option value="">Toutes les périodes</option>
                    <option value="mois">Ce mois-ci</option>
                    <option value="annee">Cette année académique</option>
                  </select>
                  <div>
                    <label htmlFor="teacher-absences-champ-1" className="block text-[11px] text-muted-foreground mb-1">Du</label>
                    <input id="teacher-absences-champ-1"
                      type="date"
                      value={dateDebut}
                      onChange={(e) => setDateDebut(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="teacher-absences-date-debut"
                    />
                  </div>
                  <div>
                    <label htmlFor="teacher-absences-champ-2" className="block text-[11px] text-muted-foreground mb-1">Au</label>
                    <input id="teacher-absences-champ-2"
                      type="date"
                      value={dateFin}
                      onChange={(e) => setDateFin(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="teacher-absences-date-fin"
                    />
                  </div>
                </div>
              )}
            </div>

            {filtrees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">
                Aucun constat ne correspond.
              </p>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Cours</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Durée</th>
                        <th className="px-4 py-3">Motif</th>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3"><span className="sr-only">Action</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtrees.map((a) => {
                        const ec = ecs.find((e) => e.id === a.ecId);
                        const classe = classes.find((c) => c.id === a.classeId);
                        return (
                          <tr key={a.id} className="border-t border-border align-top" data-testid={`teacher-absence-${a.id}`}>
                            <td className="px-4 py-3">{formatDate(a.date)}</td>
                            <td className="px-4 py-3">
                              <p className="font-medium">{ec ? `${ec.code} — ${ec.libelle}` : a.ecId}</p>
                              <p className="text-xs text-muted-foreground">{classe?.nom}</p>
                            </td>
                            <td className="px-4 py-3">{TYPE_LABEL[a.type] ?? a.type}</td>
                            <td className="px-4 py-3">{a.dureeMinutes ? `${a.dureeMinutes} min` : "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{a.motif}</td>
                            <td className="px-4 py-3">
                              {(() => {
                                const st = statutJustificationAbsence(a);
                                return (
                                  <>
                                    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", STATUT_JUSTIF[st].className)} data-testid={`teacher-absence-statut-${a.id}`}>
                                      {st === "justifiee" ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                                      {STATUT_JUSTIF[st].label}
                                    </span>
                                    {st === "justificatif_refuse" && a.justificatifRefuse && (
                                      <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">Motif : {a.justificatifRefuse.motifRefus}</p>
                                    )}
                                  </>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {(statutJustificationAbsence(a) === "non_justifiee" || statutJustificationAbsence(a) === "justificatif_refuse") && (
                                <button type="button" onClick={() => ouvrirJustification(a)} className="text-xs font-medium text-primary hover:underline whitespace-nowrap" data-testid={`teacher-absence-justifier-${a.id}`}>
                                  Justifier
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {repartitionData.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-bold text-sm text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Répartition</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={repartitionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                      {repartitionData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-1">
                  {repartitionData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </span>
                      <span className="font-semibold text-foreground">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold text-sm text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Dernières absences</h3>
              <div className="space-y-3">
                {mine.slice(0, 3).map((a) => {
                  const ec = ecs.find((e) => e.id === a.ecId);
                  return (
                    <div key={a.id} className="flex items-start gap-2.5">
                      <span
                        className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", a.justifie ? "bg-emerald-500" : a.type === "retard" ? "bg-amber-500" : "bg-red-500")}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{formatDate(a.date)} · {ec?.libelle ?? a.ecId}</p>
                        <p className="text-[11px] text-muted-foreground">{STATUT_JUSTIF[statutJustificationAbsence(a)].label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      <FormModal
        open={!!aJustifier}
        onClose={() => setAJustifier(null)}
        title="Justifier ce constat"
        subtitle={aJustifier ? `${TYPE_LABEL[aJustifier.type] ?? aJustifier.type} du ${formatDate(aJustifier.date)}` : undefined}
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="justif-motif" className="block text-xs font-medium text-muted-foreground mb-1.5">Explication *</label>
            <textarea id="justif-motif" rows={3} value={justifMotif} onChange={(e) => setJustifMotif(e.target.value)} placeholder="Ex. : rendez-vous médical, certificat joint" className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="teacher-justif-motif" />
          </div>
          <div>
            <label htmlFor="justif-piece" className="block text-xs font-medium text-muted-foreground mb-1.5">Pièce jointe (facultative)</label>
            <input id="justif-piece" type="file" accept="image/*,application/pdf" onChange={(e) => choisirPiece(e.target.files?.[0])} className="text-sm" data-testid="teacher-justif-piece" />
            {justifPiece && <p className="text-[11px] text-muted-foreground mt-1">{justifPiece.nom}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAJustifier(null)} className="px-4 py-2 border border-border rounded-xl text-sm">Annuler</button>
            <button type="button" onClick={envoyerJustification} disabled={!justifMotif.trim()} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50" data-testid="teacher-justif-envoyer">Envoyer à l&apos;administration</button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
