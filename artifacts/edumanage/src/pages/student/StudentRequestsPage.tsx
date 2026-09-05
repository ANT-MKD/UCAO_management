import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ClipboardList,
  Send,
  CheckCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Search,
  Plus,
  FileText,
  CalendarX,
  AlertTriangle,
  CreditCard,
  HelpCircle,
  MessageSquare,
  PieChart as PieChartIcon,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { addStudentRequest, cancelStudentRequest, type StudentRequestRecord } from "@/data/studentStore";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentRequests } from "@/hooks/useStudentStore";
import { PORTEE_LABELS, type PorteeDerogation } from "@/data/derogationPaiementStore";
import { KPICard } from "@/components/admin/KPICard";
import { FormModal } from "@/components/admin/FormModal";
import { requestsLastSeenKey } from "@/components/layout/StudentLayout";
import { cn, formatDate } from "@/lib/utils";

type ReqType = StudentRequestRecord["type"];
type ReqStatus = StudentRequestRecord["status"];

const REQUEST_TYPES: { value: ReqType; label: string; icon: React.ElementType }[] = [
  { value: "attestation", label: "Attestation", icon: FileText },
  { value: "justificatif_absence", label: "Justificatif d'absence", icon: CalendarX },
  { value: "reclamation_note", label: "Réclamation sur note", icon: AlertTriangle },
  { value: "demande_rallonge", label: "Demande de rallonge (délai de paiement)", icon: CreditCard },
  { value: "autre", label: "Autre demande", icon: HelpCircle },
];

const CATEGORIE_PAR_TYPE: Record<ReqType, string> = {
  attestation: "Scolarité",
  justificatif_absence: "Absences",
  reclamation_note: "Notes",
  demande_rallonge: "Finances",
  autre: "Général",
};

const CATEGORIE_COLOR: Record<string, string> = {
  Scolarité: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Absences: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Notes: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  Finances: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Général: "bg-muted text-muted-foreground",
};

const STATUS_STYLES: Record<ReqStatus, { label: string; className: string; dot: string }> = {
  nouveau: { label: "Nouveau", className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300", dot: "#2563eb" },
  en_cours: { label: "En cours", className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300", dot: "#f59e0b" },
  valide: { label: "Validée", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", dot: "#10b981" },
  rejete: { label: "Refusée", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300", dot: "#ef4444" },
  annule: { label: "Annulée", className: "bg-muted text-muted-foreground", dot: "#94a3b8" },
};

function typeLabel(type: ReqType): string {
  return REQUEST_TYPES.find((t) => t.value === type)?.label ?? type;
}

function averageDelaiJours(requests: StudentRequestRecord[], type: ReqType): number | null {
  const resolved = requests.filter((r) => r.type === type && (r.status === "valide" || r.status === "rejete"));
  if (resolved.length === 0) return null;
  const totalMs = resolved.reduce((s, r) => s + (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()), 0);
  return Math.max(1, Math.round(totalMs / resolved.length / 86400000));
}

export default function StudentRequestsPage() {
  const { currentUser } = useAuth();
  const allRequests = useStudentRequests();

  const myRequests = useMemo(
    () => [...allRequests.filter((r) => r.studentId === currentUser?.linkedId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allRequests, currentUser?.linkedId],
  );

  /** Marque la visite de cette page — sert uniquement au badge "non lu" du sidebar
   * (StudentLayout.tsx), jamais une donnée métier persistée dans studentStore. */
  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(requestsLastSeenKey(currentUser.id), new Date().toISOString());
  }, [currentUser, myRequests]);

  const [tab, setTab] = useState<"toutes" | "attente" | "validees" | "refusees" | "annulees">("toutes");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [type, setType] = useState<ReqType>("attestation");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [porteeRallonge, setPorteeRallonge] = useState<PorteeDerogation>("reinscription");
  const [dateFinSouhaitee, setDateFinSouhaitee] = useState("");
  const [sent, setSent] = useState(false);

  const total = myRequests.length;
  const enAttente = myRequests.filter((r) => r.status === "nouveau" || r.status === "en_cours").length;
  const validees = myRequests.filter((r) => r.status === "valide").length;
  const refusees = myRequests.filter((r) => r.status === "rejete").length;
  const annulees = myRequests.filter((r) => r.status === "annule").length;

  const repartition = useMemo(
    () =>
      [
        { label: "En attente", count: enAttente, color: STATUS_STYLES.en_cours.dot },
        { label: "Validées", count: validees, color: STATUS_STYLES.valide.dot },
        { label: "Refusées", count: refusees, color: STATUS_STYLES.rejete.dot },
        { label: "Annulées", count: annulees, color: STATUS_STYLES.annule.dot },
      ].filter((d) => d.count > 0),
    [enAttente, validees, refusees, annulees],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return myRequests.filter((r) => {
      if (tab === "attente" && r.status !== "nouveau" && r.status !== "en_cours") return false;
      if (tab === "validees" && r.status !== "valide") return false;
      if (tab === "refusees" && r.status !== "rejete") return false;
      if (tab === "annulees" && r.status !== "annule") return false;
      if (q && !r.subject.toLowerCase().includes(q) && !r.message.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [myRequests, tab, query]);

  const detail = myRequests.find((r) => r.id === detailId) ?? null;

  const openNewRequest = (t: ReqType) => {
    setType(t);
    setSubject("");
    setMessage("");
    setDateFinSouhaitee("");
    setShowNewRequest(true);
  };

  const estRallonge = type === "demande_rallonge";

  const handleSubmit = () => {
    if (!currentUser?.linkedId || !subject.trim() || !message.trim()) return;
    if (estRallonge && !dateFinSouhaitee) return;
    addStudentRequest({
      studentId: currentUser.linkedId,
      type,
      subject: subject.trim(),
      message: message.trim(),
      porteeRallonge: estRallonge ? porteeRallonge : undefined,
      dateFinSouhaitee: estRallonge ? dateFinSouhaitee : undefined,
    });
    setShowNewRequest(false);
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  const handleCancel = (id: string) => {
    if (!currentUser?.linkedId) return;
    cancelStudentRequest(id, currentUser.linkedId);
    setDetailId(null);
  };

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes demandes</h2>
          <p className="text-sm text-muted-foreground mt-1">Suivez l'état de vos demandes et consultez l'historique de vos requêtes.</p>
        </div>
        <button
          type="button"
          onClick={() => openNewRequest("attestation")}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
          data-testid="demande-nouvelle"
        >
          <Plus size={15} /> Nouvelle demande
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <KPICard icon={ClipboardList} label="Total demandes" value={total} accentColor="#2563eb" />
        <KPICard icon={Clock} label="En attente" value={enAttente} accentColor="#f59e0b" />
        <KPICard icon={CheckCircle2} label="Validées" value={validees} accentColor="#10b981" />
        <KPICard icon={XCircle} label="Refusées" value={refusees} accentColor="#ef4444" />
        <KPICard icon={Ban} label="Annulées" value={annulees} accentColor="#94a3b8" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border space-y-3">
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["toutes", `Toutes ${total}`],
                    ["attente", `En attente ${enAttente}`],
                    ["validees", `Validées ${validees}`],
                    ["refusees", `Refusées ${refusees}`],
                    ["annulees", `Annulées ${annulees}`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0",
                      tab === key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted",
                    )}
                    data-testid={`demande-onglet-${key}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative sm:max-w-[280px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher une demande..."
                  className="w-full pl-8 pr-3 py-2 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="demande-recherche"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {myRequests.length === 0 ? "Aucune demande pour le moment." : "Aucune demande ne correspond à votre recherche."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-4 py-2.5 font-medium">Demande</th>
                      <th className="px-4 py-2.5 font-medium">Catégorie</th>
                      <th className="px-4 py-2.5 font-medium">Date de demande</th>
                      <th className="px-4 py-2.5 font-medium">Dernière mise à jour</th>
                      <th className="px-4 py-2.5 font-medium">Statut</th>
                      <th className="px-4 py-2.5 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((r) => {
                      const categorie = CATEGORIE_PAR_TYPE[r.type];
                      const status = STATUS_STYLES[r.status];
                      return (
                        <tr key={r.id} data-testid={`demande-ligne-${r.id}`}>
                          <td className="px-4 py-3 max-w-[220px]">
                            <p className="font-medium text-foreground truncate">{r.subject}</p>
                            <p className="text-xs text-muted-foreground truncate">{typeLabel(r.type)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", CATEGORIE_COLOR[categorie])}>{categorie}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.createdAt)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.updatedAt)}</td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", status.className)}>{status.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => setDetailId(r.id)} className="text-xs text-primary hover:underline whitespace-nowrap" data-testid={`demande-voir-${r.id}`}>
                              Voir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-1">Faire une nouvelle demande</h3>
            <p className="text-xs text-muted-foreground mb-4">Sélectionnez le type de demande que vous souhaitez effectuer.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {REQUEST_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => openNewRequest(t.value)}
                  className="flex flex-col items-center text-center gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                  data-testid={`demande-tuile-${t.value}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <t.icon size={18} className="text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <PieChartIcon size={15} className="text-primary" />
              <h3 className="text-sm font-bold text-foreground">Suivi rapide</h3>
            </div>
            {total === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Aucune demande à afficher.</p>
            ) : (
              <>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={repartition} cx="50%" cy="50%" outerRadius={65} innerRadius={40} dataKey="count">
                        {repartition.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number, _n, item) => [`${v} demande(s)`, item.payload.label]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-foreground">{total}</span>
                    <span className="text-[10px] text-muted-foreground">Total</span>
                  </div>
                </div>
                <div className="space-y-1.5 mt-2">
                  {[
                    { label: "En attente", count: enAttente, color: STATUS_STYLES.en_cours.dot },
                    { label: "Validées", count: validees, color: STATUS_STYLES.valide.dot },
                    { label: "Refusées", count: refusees, color: STATUS_STYLES.rejete.dot },
                    { label: "Annulées", count: annulees, color: STATUS_STYLES.annule.dot },
                  ].map((d) => (
                    <div key={d.label} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} /> {d.label}
                      </span>
                      <span className="font-medium text-foreground">{d.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
              <MessageSquare size={15} className="text-primary" /> Besoin d'aide ?
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Pour toute question sur le traitement d'une demande, contactez directement le secrétariat.</p>
            <Link
              href="/student/messages"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              Contacter le service
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Délais moyens de traitement</h3>
            <div className="space-y-2.5">
              {REQUEST_TYPES.map((t) => {
                const avg = averageDelaiJours(allRequests, t.value);
                return (
                  <div key={t.value} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground truncate min-w-0">{t.label}</span>
                    <span className="font-medium text-foreground whitespace-nowrap flex-shrink-0">{avg !== null ? `${avg} jour${avg > 1 ? "s" : ""}` : "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <FormModal open={showNewRequest} onClose={() => setShowNewRequest(false)} title="Nouvelle demande" subtitle="Déposez une demande au secrétariat">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type de demande</label>
            <select value={type} onChange={(e) => setType(e.target.value as ReqType)} className={inputClass} data-testid="requete-type">
              {REQUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Objet</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Justificatif absence du 12/01"
              className={inputClass}
              data-testid="requete-objet"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Décrivez votre demande..."
              className={cn(inputClass, "min-h-[120px]")}
              data-testid="requete-message"
            />
          </div>
          {estRallonge && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Portée souhaitée</label>
                <select value={porteeRallonge} onChange={(e) => setPorteeRallonge(e.target.value as PorteeDerogation)} className={inputClass} data-testid="requete-portee">
                  {Object.entries(PORTEE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date de fin souhaitée</label>
                <input type="date" value={dateFinSouhaitee} onChange={(e) => setDateFinSouhaitee(e.target.value)} className={inputClass} data-testid="requete-date-fin" />
              </div>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={!subject.trim() || !message.trim() || (estRallonge && !dateFinSouhaitee)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            data-testid="requete-envoyer"
          >
            {sent ? <CheckCircle size={14} /> : <Send size={14} />}
            {sent ? "Demande envoyée" : "Envoyer la demande"}
          </button>
        </div>
      </FormModal>

      {detail && (
        <FormModal open onClose={() => setDetailId(null)} title={detail.subject} subtitle={`${typeLabel(detail.type)} · ${formatDate(detail.createdAt)}`}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", CATEGORIE_COLOR[CATEGORIE_PAR_TYPE[detail.type]])}>{CATEGORIE_PAR_TYPE[detail.type]}</span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_STYLES[detail.status].className)}>{STATUS_STYLES[detail.status].label}</span>
            </div>
            <div className="rounded-xl bg-muted/30 border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">Votre message</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{detail.message}</p>
              {detail.type === "demande_rallonge" && detail.porteeRallonge && detail.dateFinSouhaitee && (
                <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                  {PORTEE_LABELS[detail.porteeRallonge]} · jusqu'au {formatDate(detail.dateFinSouhaitee)}
                </p>
              )}
            </div>
            {detail.resolution && (
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">Réponse du secrétariat</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{detail.resolution}</p>
              </div>
            )}
            {detail.status === "nouveau" && (
              <button
                type="button"
                onClick={() => handleCancel(detail.id)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                data-testid="demande-annuler"
              >
                <Ban size={14} /> Annuler ma demande
              </button>
            )}
          </div>
        </FormModal>
      )}
    </div>
  );
}
