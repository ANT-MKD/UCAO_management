import { useMemo, useState } from "react";
import { Wallet, CircleDollarSign, CheckCircle2, Clock3, Printer, Search } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useVacations } from "@/hooks/useVacationStore";
import type { VacationRecord } from "@/data/vacationStore";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { useDecomptePaiements } from "@/hooks/useDecomptePaiementStore";
import type { DecompteRecord, TypeDecompte } from "@/data/decompteStore";
import { usePointages } from "@/hooks/usePointageStore";
import { useSeances, useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useTeacherVolumes } from "@/hooks/useTeacherVolumeStore";
import { getTeacherVolume, makeTeacherVolumeId } from "@/data/teacherVolumeStore";
import { buildTeacherCourses } from "@/lib/teacherCourseUtils";
import { ENSEIGNANTS } from "@/data/mockData";
import { moisLabelToYearMonth } from "@/lib/remunerationOverlap";
import { buildDecompteHtml } from "@/pages/admin/DecompteDetailPage";
import { KPICard } from "@/components/admin/KPICard";
import { cn, formatCFA, formatDate } from "@/lib/utils";

const DECOMPTE_TYPE_LABEL: Record<TypeDecompte, string> = {
  taux_horaire: "Taux horaire",
  forfait: "Forfait",
  a_terme: "À terme",
};

type TypeFiltre = "tous" | "vacation" | "decompte";
type StatutFiltre = "tous" | "paye" | "attente" | "annule";

interface RemunerationRow {
  key: string;
  type: "vacation" | "decompte";
  periodeLabel: string;
  yearMonth: string;
  detailLabel: string;
  montantBrut: number;
  montantNet: number;
  montantPaye: number;
  statutKey: "paye" | "attente" | "annule";
  statutLabel: string;
  reference?: string;
  vacation?: VacationRecord;
  decompte?: DecompteRecord;
}

const STATUT_CLS: Record<RemunerationRow["statutKey"], string> = {
  paye: "bg-emerald-50 text-emerald-700",
  attente: "bg-amber-50 text-amber-700",
  annule: "bg-muted text-muted-foreground",
};

/** Lecture seule de deux mécanismes de paiement réels et distincts, qui coexistent côté admin sans
 * se vérifier entre eux (voir remunerationOverlap.ts pour le garde-fou anti-double-paiement côté
 * admin) : les vacations (vacationStore.ts, saisie manuelle mensuelle par l'administration) et les
 * décomptes (decompteStore.ts, générés depuis les vraies séances pointées et validées). Regroupés
 * ici en un historique unique filtrable par type (au lieu de deux tableaux toujours affichés) —
 * les champs des deux enregistrements restent trop différents pour être fusionnés ligne à ligne. */
export default function TeacherRemunerationPage() {
  const { currentUser } = useAuth();
  const vacations = useVacations();
  const decomptes = useDecomptes();
  const paiements = useDecomptePaiements();
  const pointages = usePointages();
  const seances = useSeances();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  useTeacherVolumes();
  const anneesAcademiques = useAnneesAcademiques();
  const anneeActuelle = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneesAcademiques[0]?.libelle ?? "";

  const [query, setQuery] = useState("");
  const [typeFiltre, setTypeFiltre] = useState<TypeFiltre>("tous");
  const [statutFiltre, setStatutFiltre] = useState<StatutFiltre>("tous");

  const myTeacher = useMemo(() => ENSEIGNANTS.find((t) => t.id === currentUser?.linkedId) ?? null, [currentUser?.linkedId]);

  const mesVacations = useMemo(
    () => vacations.filter((v) => v.enseignantId === currentUser?.linkedId),
    [vacations, currentUser?.linkedId],
  );
  const mesDecomptes = useMemo(
    () => decomptes.filter((d) => d.teacherId === currentUser?.linkedId),
    [decomptes, currentUser?.linkedId],
  );
  const mesPaiements = useMemo(
    () => paiements.filter((p) => p.teacherId === currentUser?.linkedId && !p.annulee).sort((a, b) => b.date.localeCompare(a.date)),
    [paiements, currentUser?.linkedId],
  );

  /** VH prévu = volume théorique de l'EC (curriculumStore), ajusté par une éventuelle rallonge déjà
   * validée — même calcul que "Mon volume horaire". VH réalisé = pointages validés uniquement. */
  const vhTotaux = useMemo(() => {
    if (!myTeacher) return { prevu: 0, realise: 0 };
    const courses = buildTeacherCourses(myTeacher, seances, ecs, ues, classes, anneeActuelle);
    let prevu = 0;
    let realise = 0;
    for (const c of courses) {
      const volumeId = makeTeacherVolumeId(myTeacher.id, c.ecId, c.classeId, anneeActuelle);
      prevu += getTeacherVolume(volumeId)?.nouveauVh ?? c.volumeHoraire;
      realise += pointages
        .filter((p) => p.teacherId === myTeacher.id && p.ecId === c.ecId && p.classeId === c.classeId && p.annee === anneeActuelle && p.statut === "valide")
        .reduce((s, p) => s + p.volumePointe, 0);
    }
    return { prevu, realise };
  }, [myTeacher, seances, ecs, ues, classes, anneeActuelle, pointages]);

  const rows: RemunerationRow[] = useMemo(() => {
    const vacationRows: RemunerationRow[] = mesVacations.map((v) => {
      const paye = v.statut === "paye";
      return {
        key: `vac-${v.id}`,
        type: "vacation",
        periodeLabel: v.mois,
        yearMonth: moisLabelToYearMonth(v.mois) ?? "",
        detailLabel: `${v.heuresCm} CM · ${v.heuresTd} TD`,
        montantBrut: v.montantTotal,
        montantNet: v.montantTotal,
        montantPaye: paye ? v.montantTotal : 0,
        statutKey: paye ? "paye" : "attente",
        statutLabel: paye ? "Payée" : v.statut === "valide" ? "Validée" : "Brouillon",
        vacation: v,
      };
    });
    const decompteRows: RemunerationRow[] = mesDecomptes.map((d) => {
      const annule = d.statut === "annule";
      const paye = !annule && d.montantPaye >= d.netAPayer;
      return {
        key: `dec-${d.id}`,
        type: "decompte",
        periodeLabel: formatDate(d.date),
        yearMonth: d.date.slice(0, 7),
        detailLabel: `${d.lignes.length} pointage${d.lignes.length > 1 ? "s" : ""} · ${DECOMPTE_TYPE_LABEL[d.type]}`,
        montantBrut: d.montantDecompte,
        montantNet: d.netAPayer,
        montantPaye: d.montantPaye,
        statutKey: annule ? "annule" : paye ? "paye" : "attente",
        statutLabel: annule ? "Annulé" : paye ? "Payé" : "Émis",
        reference: d.reference,
        decompte: d,
      };
    });
    return [...vacationRows, ...decompteRows].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth) || b.key.localeCompare(a.key));
  }, [mesVacations, mesDecomptes]);

  const montantBrutTotal = rows.reduce((s, r) => s + r.montantBrut, 0);
  const montantNetTotal = rows.reduce((s, r) => s + r.montantNet, 0);
  const montantPayeTotal = rows.reduce((s, r) => s + r.montantPaye, 0);

  const repartitionCmTd = useMemo(() => {
    let cm = 0;
    let tdtp = 0;
    for (const v of mesVacations) {
      cm += v.heuresCm;
      tdtp += v.heuresTd;
    }
    for (const d of mesDecomptes) {
      if (d.statut === "annule") continue;
      for (const l of d.lignes) {
        const p = pointages.find((pt) => pt.id === l.pointageId);
        if (!p) continue;
        if (p.type === "CM") cm += l.duree;
        else tdtp += l.duree;
      }
    }
    return [
      { name: "CM", value: cm, color: "#4f46e5" },
      { name: "TD/TP", value: tdtp, color: "#10b981" },
    ].filter((d) => d.value > 0);
  }, [mesVacations, mesDecomptes, pointages]);

  const evolutionData = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const v of mesVacations) {
      const key = moisLabelToYearMonth(v.mois);
      if (!key) continue;
      buckets.set(key, (buckets.get(key) ?? 0) + v.montantTotal);
    }
    for (const d of mesDecomptes) {
      if (d.statut === "annule") continue;
      // Regroupé par mois réel des séances (ligne.date), pas par date de génération du décompte —
      // sinon des mois de travail passés se retrouveraient tous agrégés sous le mois d'émission.
      for (const l of d.lignes) {
        const key = l.date.slice(0, 7);
        buckets.set(key, (buckets.get(key) ?? 0) + l.montantBrut);
      }
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([yearMonth, montant]) => ({
        yearMonth,
        label: new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(new Date(`${yearMonth}-01`)),
        montant,
      }));
  }, [mesVacations, mesDecomptes]);

  const filtrees = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFiltre !== "tous" && r.type !== typeFiltre) return false;
      if (statutFiltre !== "tous" && r.statutKey !== statutFiltre) return false;
      if (q) {
        const haystack = `${r.periodeLabel} ${r.detailLabel} ${r.reference ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeFiltre, statutFiltre, query]);

  const printDecompte = (d: DecompteRecord) => {
    const statutLabel = d.statut === "annule" ? "Annulé" : d.montantPaye >= d.netAPayer ? "Payé" : "Emis";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildDecompteHtml({
        reference: d.reference,
        date: d.date,
        professeur: d.professeur,
        type: DECOMPTE_TYPE_LABEL[d.type],
        montantDecompte: d.montantDecompte,
        netAPayer: d.netAPayer,
        montantPaye: d.montantPaye,
        statut: statutLabel,
        lignes: d.lignes,
      }),
    );
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Ma rémunération</h2>
        <p className="text-sm text-muted-foreground mt-1">Vacations et décomptes émis pour votre enseignement, et leur règlement.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard icon={Clock3} label="Heures effectuées" value={`${vhTotaux.realise} h`} subtitle={`sur ${vhTotaux.prevu} h prévues — ${anneeActuelle}`} accentColor="#4f46e5" />
        <KPICard icon={Wallet} label="Montant brut (total)" value={formatCFA(montantBrutTotal)} accentColor="#6366f1" />
        <KPICard icon={CircleDollarSign} label="Net à payer (total)" value={formatCFA(montantNetTotal)} accentColor="#f59e0b" />
        <KPICard icon={CheckCircle2} label="Déjà payé" value={formatCFA(montantPayeTotal)} accentColor="#10b981" />
      </div>

      {evolutionData.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold text-sm text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Évolution mensuelle (montant brut)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [formatCFA(v), "Montant brut"]} />
              <Bar dataKey="montant" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucune vacation ni aucun décompte enregistré pour l&apos;instant.</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                  {(["tous", "vacation", "decompte"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFiltre(t)}
                      className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", typeFiltre === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
                      data-testid={`teacher-remuneration-filtre-type-${t}`}
                    >
                      {t === "tous" ? "Tout" : t === "vacation" ? "Vacations" : "Décomptes"}
                    </button>
                  ))}
                </div>
                <select
                  value={statutFiltre}
                  onChange={(e) => setStatutFiltre(e.target.value as StatutFiltre)}
                  className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="teacher-remuneration-filtre-statut"
                >
                  <option value="tous">Tous les statuts</option>
                  <option value="paye">Payé</option>
                  <option value="attente">En attente</option>
                  <option value="annule">Annulé</option>
                </select>
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher un mois, une référence…"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-remuneration-recherche"
                  />
                </div>
              </div>
            </div>

            {filtrees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucun élément ne correspond aux filtres.</p>
            ) : (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3">Période</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Détail</th>
                        <th className="px-4 py-3">Brut</th>
                        <th className="px-4 py-3">Net</th>
                        <th className="px-4 py-3">Payé</th>
                        <th className="px-4 py-3">Statut</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtrees.map((r) => (
                        <tr key={r.key} className="border-t border-border align-top" data-testid={`teacher-remuneration-row-${r.key}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium">{r.periodeLabel}</p>
                            {r.reference && <p className="text-xs text-muted-foreground">{r.reference}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", r.type === "vacation" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700")}>
                              {r.type === "vacation" ? "Vacation" : "Décompte"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{r.detailLabel}</td>
                          <td className="px-4 py-3 font-medium">{formatCFA(r.montantBrut)}</td>
                          <td className="px-4 py-3">{formatCFA(r.montantNet)}</td>
                          <td className="px-4 py-3">{formatCFA(r.montantPaye)}</td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[r.statutKey])}>{r.statutLabel}</span>
                          </td>
                          <td className="px-4 py-3">
                            {r.decompte && (
                              <button
                                type="button"
                                onClick={() => printDecompte(r.decompte!)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                                data-testid={`teacher-remuneration-imprimer-${r.key}`}
                              >
                                <Printer size={12} /> Imprimer
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {repartitionCmTd.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-bold text-sm text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Répartition des heures</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={repartitionCmTd} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                      {repartitionCmTd.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} h`, "Heures"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-1">
                  {repartitionCmTd.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </span>
                      <span className="font-semibold text-foreground">{d.value} h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mesPaiements.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-bold text-sm text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Derniers paiements</h3>
                <div className="space-y-3">
                  {mesPaiements.slice(0, 4).map((p) => (
                    <div key={p.id} className="flex items-start justify-between gap-2" data-testid={`teacher-paiement-decompte-${p.id}`}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{p.reference} — {p.decompteReference}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(p.date)} · {p.moyen}</p>
                      </div>
                      <p className="text-xs font-bold text-emerald-600 shrink-0">{formatCFA(p.montant)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
