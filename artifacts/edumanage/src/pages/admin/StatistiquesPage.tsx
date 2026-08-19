import { useState } from "react";
import { TrendingUp, Users, DollarSign, Award, BarChart3, Download } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { formatCFA } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, AreaChart, Area
} from "recharts";
import { REVENUE_DATA, SUCCESS_RATE_DATA, FILIERES, ETUDIANTS } from "@/data/mockData";

const TAUX_PAR_FILIERE = [
  { filiere: "LPIG", S1: 78, S2: 72, total: 145 },
  { filiere: "GESTION", S1: 82, S2: 79, total: 212 },
  { filiere: "DROIT", S1: 75, S2: 68, total: 98 },
  { filiere: "COMPTA", S1: 69, S2: 71, total: 87 },
  { filiere: "BIOMED", S1: 84, S2: 81, total: 76 },
];

const INSCRIPTIONS_DATA = [
  { mois: "Sep", inscrits: 210, nouveaux: 45 },
  { mois: "Oct", inscrits: 385, nouveaux: 175 },
  { mois: "Nov", inscrits: 520, nouveaux: 135 },
  { mois: "Déc", inscrits: 612, nouveaux: 92 },
  { mois: "Jan", inscrits: 730, nouveaux: 118 },
  { mois: "Fév", inscrits: 790, nouveaux: 60 },
  { mois: "Mar", inscrits: 820, nouveaux: 30 },
  { mois: "Avr", inscrits: 840, nouveaux: 20 },
  { mois: "Mai", inscrits: 847, nouveaux: 7 },
];

const RADAR_DATA = [
  { subject: "Taux réussite", A: 78, B: 85 },
  { subject: "Paiements OK", A: 72, B: 80 },
  { subject: "Présence", A: 88, B: 92 },
  { subject: "Notes saisies", A: 95, B: 98 },
  { subject: "Satisfaction", A: 82, B: 88 },
];

const REPARTITION_SEXE = [
  { name: "Femmes", value: 412, color: "#ec4899" },
  { name: "Hommes", value: 435, color: "#4f46e5" },
];

const REPARTITION_FILIERE = FILIERES.slice(0, 4).map((f, i) => ({
  name: f.code,
  value: f.nbEtudiants,
  color: ["#4f46e5", "#10b981", "#f59e0b", "#8b5cf6"][i],
}));

const IMPAYE_DATA = [
  { classe: "L1-INFO-A", total: 38, impaye: 5 },
  { classe: "L1-INFO-B", total: 35, impaye: 8 },
  { classe: "L1-GEST-A", total: 42, impaye: 4 },
  { classe: "L1-DROIT-A", total: 45, impaye: 6 },
  { classe: "L2-INFO-A", total: 30, impaye: 9 },
  { classe: "BTS1", total: 28, impaye: 6 },
];

const KPI = [
  { label: "Étudiants inscrits", value: "847", sub: "+12 ce mois", icon: Users, color: "#4f46e5", bg: "#eef2ff" },
  { label: "Taux de réussite", value: "76%", sub: "+2% vs S1", icon: Award, color: "#10b981", bg: "#ecfdf5" },
  { label: "Revenus YTD", value: "84.25M FCFA", sub: "+18% vs 2024", icon: DollarSign, color: "#f59e0b", bg: "#fffbeb" },
  { label: "Taux de présence", value: "88%", sub: "moy. toutes classes", icon: TrendingUp, color: "#8b5cf6", bg: "#f5f3ff" },
];

export default function StatistiquesPage() {
  const [periode, setPeriode] = useState("2025-2026");
  const totalRevenu = REVENUE_DATA.reduce((s, d) => s + d.recettes, 0);
  const totalDepense = REVENUE_DATA.reduce((s, d) => s + d.depenses, 0);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Statistiques & Rapports" }]}
        title="Statistiques & Rapports"
        subtitle="Tableau de bord analytique complet — indicateurs académiques, financiers et pédagogiques"
        actions={
          <div className="flex items-center gap-2">
            <select value={periode} onChange={(e) => setPeriode(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none">
              {["2025-2026", "2024-2025", "2023-2024"].map((p) => <option key={p}>{p}</option>)}
            </select>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Download size={14} /> Exporter rapport
            </button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {KPI.map((k) => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={18} style={{ color: k.color }} />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
            <div className="text-xs mt-1" style={{ color: k.color }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Revenue + Inscriptions */}
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Évolution des Revenus</h3>
              <p className="text-xs text-muted-foreground">Recettes vs Dépenses — {periode}</p>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="font-bold text-emerald-600">{formatCFA(totalRevenu)}</span>
              <span className="font-bold text-red-500">−{formatCFA(totalDepense)}</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={REVENUE_DATA} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="recette" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="depense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => formatCFA(v)} />
              <Area type="monotone" dataKey="recettes" name="Recettes" stroke="#4f46e5" fill="url(#recette)" strokeWidth={2} />
              <Area type="monotone" dataKey="depenses" name="Dépenses" stroke="#ef4444" fill="url(#depense)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Progression des Inscriptions</h3>
            <p className="text-xs text-muted-foreground">Cumulatif et nouveaux inscrits par mois</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={INSCRIPTIONS_DATA} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="inscrits" name="Total inscrits" fill="#4f46e5" radius={[4, 4, 0, 0]} opacity={0.7} />
              <Bar dataKey="nouveaux" name="Nouveaux" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Taux de réussite + Répartition */}
      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Taux de Réussite par Filière</h3>
            <p className="text-xs text-muted-foreground">Comparaison S1 / S2 — seuil de réussite 10/20</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={TAUX_PAR_FILIERE} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="filiere" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend iconSize={10} />
              <Bar dataKey="S1" name="Semestre 1" fill="#4f46e5" radius={[3, 3, 0, 0]} />
              <Bar dataKey="S2" name="Semestre 2" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Répartition par Filière</h3>
            <p className="text-xs text-muted-foreground">847 étudiants inscrits</p>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={REPARTITION_FILIERE} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                {REPARTITION_FILIERE.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: number, name) => [`${v} étudiants`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {REPARTITION_FILIERE.map((f) => (
              <div key={f.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: f.color }} />
                <span className="text-xs text-muted-foreground">{f.name}: <span className="font-semibold text-foreground">{f.value}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Impayés + Radar + Sexe */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">Situation des Impayés par Classe</h3>
            <p className="text-xs text-muted-foreground">Nombre d'étudiants avec solde dû &gt; 0</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={IMPAYE_DATA} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="classe" type="category" tick={{ fontSize: 10 }} width={80} />
              <Tooltip />
              <Bar dataKey="total" name="Total" fill="#e0e7ff" radius={[0, 3, 3, 0]} />
              <Bar dataKey="impaye" name="Impayés" fill="#ef4444" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-5">
          <div className="bg-card border border-border rounded-xl p-5 flex-1" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="text-sm font-bold text-foreground mb-1">Répartition Homme / Femme</h3>
            <p className="text-xs text-muted-foreground mb-3">847 inscrits total</p>
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={REPARTITION_SEXE} cx="50%" cy="50%" innerRadius={30} outerRadius={45} dataKey="value" paddingAngle={2}>
                  {REPARTITION_SEXE.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-around mt-2">
              {REPARTITION_SEXE.map((s) => (
                <div key={s.name} className="text-center">
                  <div className="text-sm font-bold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="text-sm font-bold text-foreground mb-3">Indicateurs Qualité</h3>
            <div className="space-y-2.5">
              {[
                { label: "Taux de réussite", value: 76, color: "#10b981" },
                { label: "Paiements à jour", value: 72, color: "#4f46e5" },
                { label: "Notes publiées", value: 95, color: "#f59e0b" },
                { label: "Taux de présence", value: 88, color: "#8b5cf6" },
              ].map((ind) => (
                <div key={ind.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{ind.label}</span>
                    <span className="font-bold" style={{ color: ind.color }}>{ind.value}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${ind.value}%`, background: ind.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
