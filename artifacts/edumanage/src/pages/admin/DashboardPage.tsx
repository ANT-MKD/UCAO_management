import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Users, TrendingUp, AlertTriangle, BarChart3, ArrowRight, Clock,
  Bell, CreditCard, DollarSign, ChevronRight, Wallet, GraduationCap,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { KPICard } from "@/components/admin/KPICard";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { formatCFA, formatDate, moyenPaiementColor } from "@/lib/utils";
import {
  REVENUE_DATA, SUCCESS_RATE_DATA, SUCCESS_BY_SEMESTRE, ABSENCES_STATS,
  NOTIFICATIONS, FILIERES,
} from "@/data/mockData";
import { useStudentStore, usePaiements, useSeances, useAnneesAcademiques, useAnneeActuelle } from "@/hooks/useStudentStore";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { useMailsEnvoyes } from "@/hooks/useMailEnvoyeStore";
import { mondayOf } from "@/lib/teacherUtils";
import { cn } from "@/lib/utils";
import { PubliciteBanner } from "@/components/PubliciteBanner";

const ALERT_STYLES: Record<string, { dot: string; border: string; bg: string }> = {
  danger: { dot: "#ef4444", border: "#fecaca", bg: "#fef2f2" },
  warning: { dot: "#f59e0b", border: "#fde68a", bg: "#fffbeb" },
  success: { dot: "#10b981", border: "#a7f3d0", bg: "#ecfdf5" },
  info: { dot: "#4f46e5", border: "#c7d2fe", bg: "#eef2ff" },
};

const TYPE_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
  CM: { bar: "#4f46e5", bg: "#eef2ff", text: "#4f46e5" },
  TD: { bar: "#10b981", bg: "#ecfdf5", text: "#10b981" },
  TP: { bar: "#8b5cf6", bg: "#f5f3ff", text: "#8b5cf6" },
  EX: { bar: "#ef4444", bg: "#fef2f2", text: "#ef4444" },
};

const FinanceTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm">
      <div className="font-semibold text-foreground mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="text-muted-foreground">
          {p.name === "recettes" ? "Recettes" : "Dépenses"} : {formatCFA(p.value)}
        </div>
      ))}
    </div>
  );
};

const StatsTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color?: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm">
      <div className="font-semibold text-foreground mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }} className="text-muted-foreground">
          {p.name}: {typeof p.value === "number" && p.value > 1000 ? formatCFA(p.value) : `${p.value}${p.name === "Réussite" ? "%" : ""}`}
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  const paiements = usePaiements();
  const seances = useSeances();
  const decomptes = useDecomptes();
  const mailsEnvoyes = useMailsEnvoyes();
  const anneesAcademiques = useAnneesAcademiques();
  const anneeActuelle = useAnneeActuelle();
  const anneeOptions = useMemo(
    () => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)).map((a) => a.libelle),
    [anneesAcademiques],
  );
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [pieType, setPieType] = useState<"donut" | "pie">("donut");
  const [anneeFilter, setAnneeFilter] = useState(anneeActuelle);
  const [filiereFilter, setFiliereFilter] = useState("");

  const today = new Date();
  const dayName = today.toLocaleDateString("fr-FR", { weekday: "long" });
  const dayNum = today.getDate();
  const todayDayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
  const todayIso = today.toISOString().slice(0, 10);
  const todayMonday = mondayOf(todayIso);
  const todaySeances = seances
    .filter((s) => s.jour === todayDayOfWeek && s.semaineDu === todayMonday)
    .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut));

  const impayes = etudiants.filter((e) => e.soldeDu > 0).length;
  const enAttenteInscription = etudiants.filter((e) => e.statut === "preinscrit" || e.statut === "en_attente").length;
  const mailsEnAttenteValidation = mailsEnvoyes.filter((m) => m.statut === "en_attente_validation").length;
  const alerteValidationMails = mailsEnAttenteValidation > 0
    ? [{ id: "com-validation", type: "warning" as const, message: `${mailsEnAttenteValidation} mail(s) en attente de validation (Communication)`, temps: "À l'instant" }]
    : [];
  const alertesAffichees = [
    ...alerteValidationMails,
    ...NOTIFICATIONS.filter((n) => !n.lue)
      .map((n) => {
        if (n.id !== "nt3") return n;
        if (enAttenteInscription === 0) return null;
        return { ...n, message: `${enAttenteInscription} étudiant(s) préinscrit(s) ou en attente de confirmation d'inscription`, temps: "À l'instant" };
      })
      .filter((n): n is (typeof NOTIFICATIONS)[number] => n !== null),
  ].slice(0, 3);
  const totalRecettes = paiements.reduce((s, p) => s + p.montant, 0);
  const totalAvoirCirculation = etudiants.reduce((s, e) => s + e.soldeAvoir, 0);
  const totalDecompteRestant = decomptes
    .filter((d) => d.statut !== "annule")
    .reduce((s, d) => s + Math.max(0, d.netAPayer - d.montantPaye), 0);
  const tauxReussiteMoy = Math.round(SUCCESS_RATE_DATA.reduce((s, d) => s + d.value, 0) / SUCCESS_RATE_DATA.length);

  const filteredSuccess = filiereFilter
    ? SUCCESS_BY_SEMESTRE.map((row) => ({ semestre: row.semestre, value: row[filiereFilter as keyof typeof row] as number }))
    : SUCCESS_BY_SEMESTRE.map((row) => ({
        semestre: row.semestre,
        value: Math.round((row.LPIG + row.GESTION + row.DROIT + row.COMPTA) / 4),
      }));

  const inputClass = "px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <div className="mb-6"><PubliciteBanner profil="admin" /></div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Bonjour, Ousmane
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {dayName.charAt(0).toUpperCase() + dayName.slice(1)} {dayNum} — {formatDate(today)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={() => setLocation("/admin/students/new")} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            + Inscrire Étudiant
          </button>
          <button onClick={() => setLocation("/admin/paiements/new")} className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
            Nouvel encaissement
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <KPICard icon={Users} label="Étudiants inscrits" value={etudiants.length} trend="+12 ce mois" trendDirection="up" accentColor="#4f46e5" onClick={() => setLocation("/admin/students")} />
        <KPICard icon={TrendingUp} label="Recettes encaissées" value={formatCFA(totalRecettes)} trend="+8% vs mois préc." trendDirection="up" accentColor="#10b981" onClick={() => setLocation("/admin/encaissements")} />
        <KPICard icon={AlertTriangle} label="Impayés actifs" value={`${impayes} étudiants`} trend="Voir la liste" trendDirection="down" accentColor="#ef4444" onClick={() => setLocation("/admin/paiements")} />
        <KPICard icon={Wallet} label="Avoir en circulation" value={formatCFA(totalAvoirCirculation)} trend="Crédits dus aux étudiants" trendDirection="down" accentColor="#0ea5e9" onClick={() => setLocation("/admin/encaissements")} />
        <KPICard icon={GraduationCap} label="Reste à payer aux profs" value={formatCFA(totalDecompteRestant)} trend="Décomptes non soldés" trendDirection="down" accentColor="#8b5cf6" onClick={() => setLocation("/admin/decomptes")} />
        <KPICard icon={BarChart3} label="Taux de réussite" value={`${tauxReussiteMoy}%`} trend="+2% vs S1" trendDirection="up" accentColor="#f59e0b" onClick={() => document.getElementById("reporting")?.scrollIntoView({ behavior: "smooth" })} />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Évolution des Revenus</h3>
              <p className="text-xs text-muted-foreground">Sept 2025 – Juin 2026</p>
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              {(["bar", "line"] as const).map((t) => (
                <button key={t} onClick={() => setChartType(t)} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", chartType === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                  {t === "bar" ? "Barres" : "Courbe"}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            {chartType === "bar" ? (
              <BarChart data={REVENUE_DATA} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip content={<FinanceTooltip />} />
                <Bar dataKey="recettes" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="depenses" fill="#e0e7ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={REVENUE_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip content={<FinanceTooltip />} />
                <Line type="monotone" dataKey="recettes" stroke="#4f46e5" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="depenses" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Taux de Réussite</h3>
              <p className="text-xs text-muted-foreground">Par filière — S1 2025</p>
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              {(["donut", "pie"] as const).map((t) => (
                <button key={t} onClick={() => setPieType(t)} className={cn("px-2 py-1 text-xs font-medium rounded-md transition-colors", pieType === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                  {t === "donut" ? "Donut" : "Camembert"}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={SUCCESS_RATE_DATA} cx="50%" cy="50%" outerRadius={65} innerRadius={pieType === "donut" ? 35 : 0} dataKey="value">
                {SUCCESS_RATE_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v}%`, "Taux"]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {SUCCESS_RATE_DATA.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-semibold text-foreground ml-auto">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Widgets: Paiements | Alertes + Planning */}
      <div className="grid lg:grid-cols-5 gap-5 mb-6">
        {/* Paiements récents — colonne large */}
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CreditCard size={16} className="text-emerald-600" />
              </div>
              <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Paiements récents</h3>
            </div>
            <button onClick={() => setLocation("/admin/paiements")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              Voir tout <ArrowRight size={11} />
            </button>
          </div>
          <div className="p-2">
            {paiements.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 mx-2 my-1 px-3 py-3 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer group"
                onClick={() => setLocation("/admin/paiements")}
              >
                <UserAvatar name={p.etudiant} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{p.etudiant}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.rubrique}</div>
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                  <div className="text-sm font-bold text-foreground tabular-nums">{formatCFA(p.montant)}</div>
                  <span
                    className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                    style={{ background: moyenPaiementColor(p.moyen).bg, color: moyenPaiementColor(p.moyen).color }}
                  >
                    {p.moyen}
                  </span>
                </div>
                <ChevronRight size={14} className="text-muted-foreground/0 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Colonne droite */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Alertes */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden flex-1" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/20">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Bell size={16} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Alertes intelligentes</h3>
            </div>
            <div className="p-3 space-y-2">
              {alertesAffichees.map((n) => {
                const style = ALERT_STYLES[n.type] ?? ALERT_STYLES.info;
                const estAlerteInscription = n.id === "nt3";
                const estAlerteValidationMails = n.id === "com-validation";
                const onClick = estAlerteInscription
                  ? () => setLocation("/admin/inscription/definitive")
                  : estAlerteValidationMails
                    ? () => setLocation("/admin/communication/validation")
                    : undefined;
                return (
                  <div
                    key={n.id}
                    onClick={onClick}
                    className={cn("flex items-start gap-3 p-3 rounded-xl border transition-colors hover:shadow-sm", onClick && "cursor-pointer")}
                    style={{ background: style.bg, borderColor: style.border }}
                    data-testid={estAlerteInscription ? "dashboard-alerte-inscription" : estAlerteValidationMails ? "dashboard-alerte-validation-mails" : undefined}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: style.dot }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-relaxed font-medium">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{n.temps}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Planning */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Clock size={16} className="text-indigo-600" />
                </div>
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Planning aujourd'hui</h3>
              </div>
              <button onClick={() => setLocation("/admin/schedule")} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                Voir tout <ArrowRight size={11} />
              </button>
            </div>
            {todaySeances.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune séance aujourd'hui</div>
            ) : (
              <div className="p-3 space-y-2">
                {todaySeances.slice(0, 4).map((s) => {
                  const tc = TYPE_COLORS[s.type] ?? TYPE_COLORS.CM;
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col items-center flex-shrink-0 w-14">
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg flex items-center gap-1">
                          <Clock size={9} /> {s.heureDebut}
                        </span>
                      </div>
                      <div className="w-1 self-stretch rounded-full flex-shrink-0 min-h-[36px]" style={{ background: tc.bar }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate">{s.ec}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{s.classe} · {s.salle}</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg flex-shrink-0" style={{ background: tc.bg, color: tc.text }}>
                        {s.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reporting intégré (ex-page Statistiques) */}
      <div id="reporting" className="scroll-mt-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Reporting & Statistiques</h2>
            <p className="text-xs text-muted-foreground">Indicateurs croisés réussite, finances et absences</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={anneeFilter} onChange={(e) => setAnneeFilter(e.target.value)} className={inputClass}>
              {anneeOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filiereFilter} onChange={(e) => setFiliereFilter(e.target.value)} className={inputClass}>
              <option value="">Toutes les filières</option>
              {FILIERES.filter((f) => f.statut === "actif").map((f) => (
                <option key={f.id} value={f.code}>{f.code}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 mb-5">
          <div className="bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <DollarSign size={16} className="text-primary" /> Évolution financière — {anneeFilter}
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={REVENUE_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip content={<StatsTooltip />} />
                <Area type="monotone" dataKey="recettes" name="Recettes" stroke="#4f46e5" fill="#4f46e520" />
                <Area type="monotone" dataKey="depenses" name="Dépenses" stroke="#ef4444" fill="#ef444420" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600" />
              Taux de réussite {filiereFilter ? `— ${filiereFilter}` : "— global"}
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={filteredSuccess}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="semestre" tick={{ fontSize: 10 }} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip content={<StatsTooltip />} />
                <Line type="monotone" dataKey="value" name="Réussite" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground mb-4">Répartition par filière</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={SUCCESS_RATE_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {SUCCESS_RATE_DATA.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground mb-4">Absences par mois</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ABSENCES_STATS}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="justifiees" name="Justifiées" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="nonJustifiees" name="Non justifiées" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "+ Inscrire Étudiant", href: "/admin/students/new", color: "#4f46e5", icon: Users },
          { label: "Nouvel encaissement", href: "/admin/paiements/new", color: "#10b981", icon: DollarSign },
          { label: "Ajouter une séance", href: "/admin/schedule/new", color: "#8b5cf6", icon: Clock },
          { label: "Saisir des Notes", href: "/admin/notes", color: "#f59e0b", icon: BarChart3 },
        ].map((a) => (
          <button
            key={a.label}
            onClick={() => setLocation(a.href)}
            className="py-3.5 px-4 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all text-left flex items-center gap-2 hover:-translate-y-0.5 hover:shadow-md"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <a.icon size={16} style={{ color: a.color }} />
            <span style={{ color: a.color }}>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
