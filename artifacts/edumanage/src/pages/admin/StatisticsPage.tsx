import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { TrendingUp, Users, DollarSign, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { KPICard } from "@/components/admin/KPICard";
import {
  REVENUE_DATA, SUCCESS_RATE_DATA, SUCCESS_BY_SEMESTRE, ABSENCES_STATS,
  ETUDIANTS, PAIEMENTS, FILIERES,
} from "@/data/mockData";
import { formatCFA } from "@/lib/utils";

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color?: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm">
      <div className="font-semibold text-foreground mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }} className="text-muted-foreground">
          {p.name}: {typeof p.value === "number" && p.value > 1000 ? formatCFA(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function StatisticsPage() {
  const [anneeFilter, setAnneeFilter] = useState("2025-2026");
  const [filiereFilter, setFiliereFilter] = useState("");

  const totalEtudiants = ETUDIANTS.length;
  const impayes = ETUDIANTS.filter((e) => e.soldeDu > 0).length;
  const totalRecettes = PAIEMENTS.reduce((s, p) => s + p.montant, 0);
  const tauxReussiteMoy = Math.round(SUCCESS_RATE_DATA.reduce((s, d) => s + d.value, 0) / SUCCESS_RATE_DATA.length);

  const filteredSuccess = filiereFilter
    ? SUCCESS_BY_SEMESTRE.map((row) => ({ semestre: row.semestre, value: row[filiereFilter as keyof typeof row] as number }))
    : SUCCESS_BY_SEMESTRE.map((row) => ({
        semestre: row.semestre,
        value: Math.round(((row.LPIG + row.GESTION + row.DROIT + row.COMPTA) / 4)),
      }));

  const inputClass = "px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Statistiques & Reporting" }]}
        title="Statistiques & Reporting"
        subtitle="Indicateurs croisés : réussite, finances, absences"
      />

      <div className="flex flex-wrap gap-3 mb-6">
        <select value={anneeFilter} onChange={(e) => setAnneeFilter(e.target.value)} className={inputClass}>
          <option value="2025-2026">2025-2026</option>
          <option value="2024-2025">2024-2025</option>
        </select>
        <select value={filiereFilter} onChange={(e) => setFiliereFilter(e.target.value)} className={inputClass}>
          <option value="">Toutes les filières</option>
          {FILIERES.filter((f) => f.statut === "actif").map((f) => (
            <option key={f.id} value={f.code}>{f.code}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard icon={Users} label="Étudiants inscrits" value={totalEtudiants} accentColor="#4f46e5" />
        <KPICard icon={TrendingUp} label="Taux réussite moy." value={`${tauxReussiteMoy}%`} accentColor="#10b981" />
        <KPICard icon={DollarSign} label="Recettes encaissées" value={formatCFA(totalRecettes)} accentColor="#f59e0b" />
        <KPICard icon={AlertTriangle} label="Impayés" value={impayes} accentColor="#ef4444" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Évolution financière</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={REVENUE_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="recettes" name="Recettes" stroke="#4f46e5" fill="#4f46e520" />
              <Area type="monotone" dataKey="depenses" name="Dépenses" stroke="#ef4444" fill="#ef444420" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
            Taux de réussite {filiereFilter ? `— ${filiereFilter}` : "— global"}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={filteredSuccess}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="semestre" tick={{ fontSize: 10 }} />
              <YAxis domain={[50, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="value" name="Réussite" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Réussite par filière</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={SUCCESS_RATE_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                {SUCCESS_RATE_DATA.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Absences par mois</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ABSENCES_STATS}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
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
  );
}
