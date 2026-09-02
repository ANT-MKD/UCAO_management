import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { Activity, Users, TrendingUp, Download } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { useAuditLogs, useUserAccounts } from "@/hooks/useStudentStore";
import { cn } from "@/lib/utils";
import type { AuditLogRecord } from "@/data/studentStore";

const ACTION_LABELS: Record<string, string> = {
  create_user_account: "Création d'un compte utilisateur",
  activate_user_account: "Réactivation d'un compte",
  deactivate_user_account: "Désactivation d'un compte",
  update_user_account: "Modification d'un compte",
  create_role: "Création d'un rôle",
  update_role_access: "Modification des accès d'un rôle",
  validate_notes: "Validation de notes",
  update_request: "Traitement d'une demande",
  send_message: "Envoi d'un message",
  validate_cahier: "Validation d'un cahier de séance",
  reject_cahier: "Rejet d'un cahier de séance",
  login: "Connexion",
  lockout_failed_attempts: "Verrouillage après tentatives échouées",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  user_account: "Compte utilisateur",
  role: "Rôle",
  ec: "Élément constitutif",
  request: "Demande",
  message: "Message",
  cahier: "Cahier de séance",
};

/** Repli automatique : toute future action/cible pas encore mappée reste lisible (underscores →
 * espaces, majuscule) au lieu de planter ou de rester en code technique brut. */
function autoLabel(raw: string): string {
  const s = raw.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? autoLabel(action);
}

function formatTargetType(targetType: string): string {
  return TARGET_TYPE_LABELS[targetType] ?? autoLabel(targetType);
}

/** Ne résout un lien que vers des pages qui existent réellement — jamais une URL devinée qui
 * pourrait 404. Les types non gérés restent affichés mais non cliquables. */
function resolveTargetHref(targetType: string, targetId: string): string | undefined {
  if (targetType === "user_account") return `/admin/users/${targetId}`;
  if (targetType === "role") return `/admin/roles/${targetId}`;
  if (targetType === "cahier") return `/admin/cahiers/${targetId}`;
  return undefined;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

interface AuditRow {
  id: string;
  createdAt: string;
  actorId: string;
  actorLabel: string;
  actionRaw: string;
  actionLabel: string;
  targetType: string;
  targetTypeLabel: string;
  targetId: string;
  targetHref?: string;
  meta: string;
}

export default function AuditTrailPage() {
  const logs = useAuditLogs();
  const users = useUserAccounts();
  const [, setLocation] = useLocation();

  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const actorById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.displayName);
    return map;
  }, [users]);

  const rows = useMemo<AuditRow[]>(() => {
    return logs.map((l: AuditLogRecord) => ({
      id: l.id,
      createdAt: l.createdAt,
      actorId: l.actorUserId,
      actorLabel: actorById.get(l.actorUserId) ?? (l.actorUserId === "system" ? "Système" : l.actorUserId),
      actionRaw: l.action,
      actionLabel: formatAction(l.action),
      targetType: l.targetType,
      targetTypeLabel: formatTargetType(l.targetType),
      targetId: l.targetId,
      targetHref: resolveTargetHref(l.targetType, l.targetId),
      meta: l.meta ?? "",
    }));
  }, [logs, actorById]);

  const targetTypeOptions = useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => set.set(r.targetType, r.targetTypeLabel));
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const actorOptions = useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => set.set(r.actorId, r.actorLabel));
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (targetTypeFilter && r.targetType !== targetTypeFilter) return false;
      if (actorFilter && r.actorId !== actorFilter) return false;
      if (dateFrom && r.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && r.createdAt.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [rows, targetTypeFilter, actorFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const actionsAujourdhui = filtered.filter((r) => isToday(r.createdAt)).length;
    const acteursDistincts = new Set(filtered.map((r) => r.actorId)).size;
    const counts = new Map<string, number>();
    filtered.forEach((r) => counts.set(r.actionLabel, (counts.get(r.actionLabel) ?? 0) + 1));
    let actionFrequente = "—";
    let max = 0;
    for (const [label, n] of counts) {
      if (n > max) { max = n; actionFrequente = label; }
    }
    return { actionsAujourdhui, acteursDistincts, actionFrequente, total: filtered.length };
  }, [filtered]);

  const handleExport = () => {
    const data = filtered.map((r) => ({
      Date: formatDateTime(r.createdAt),
      Acteur: r.actorLabel,
      Action: r.actionLabel,
      "Type de cible": r.targetTypeLabel,
      "ID cible": r.targetId,
      Détail: r.meta,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Journal d'audit");
    XLSX.writeFile(wb, `journal-audit-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "createdAt", header: "Date", sortable: true, render: (row) => formatDateTime((row as unknown as AuditRow).createdAt) },
    { key: "actorLabel", header: "Acteur", sortable: true },
    {
      key: "actionLabel",
      header: "Action",
      sortable: true,
      render: (row) => {
        const r = row as unknown as AuditRow;
        return (
          <div>
            <span className="font-medium text-foreground">{r.actionLabel}</span>
            <div className="text-[10px] text-muted-foreground font-mono">{r.actionRaw}</div>
          </div>
        );
      },
    },
    {
      key: "targetTypeLabel",
      header: "Cible",
      render: (row) => {
        const r = row as unknown as AuditRow;
        const content = (
          <span className={cn("inline-flex text-xs px-2 py-1 rounded-lg bg-muted", r.targetHref ? "text-primary" : "text-foreground", "max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap")}>
            {r.targetTypeLabel} · {r.targetId}
          </span>
        );
        if (!r.targetHref) return content;
        return (
          <button onClick={(e) => { e.stopPropagation(); setLocation(r.targetHref!); }} className="hover:underline" data-testid={`audit-cible-${r.id}`}>
            {content}
          </button>
        );
      },
    },
    {
      key: "meta",
      header: "Détail",
      render: (row) => {
        const meta = (row as unknown as AuditRow).meta;
        return meta ? <span className="text-xs text-muted-foreground">{meta}</span> : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
  ];

  const selectClass = "px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Journal d'audit" }]}
        title="Journal d'audit"
        subtitle="Historique réel des actions sensibles : acteur, action, cible, date"
        actions={
          <button onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors" data-testid="audit-export">
            <Download size={14} /> Exporter (Excel)
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><Activity size={16} /></div>
          <div>
            <p className="text-xl font-bold text-foreground" data-testid="audit-stat-aujourdhui">{stats.actionsAujourdhui}</p>
            <p className="text-[11px] text-muted-foreground">Action(s) aujourd'hui</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><Users size={16} /></div>
          <div>
            <p className="text-xl font-bold text-foreground" data-testid="audit-stat-acteurs">{stats.acteursDistincts}</p>
            <p className="text-[11px] text-muted-foreground">Acteur(s) distinct(s)</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><TrendingUp size={16} /></div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate" data-testid="audit-stat-frequente">{stats.actionFrequente}</p>
            <p className="text-[11px] text-muted-foreground">Action la plus fréquente</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={targetTypeFilter} onChange={(e) => setTargetTypeFilter(e.target.value)} className={selectClass} data-testid="audit-filtre-type">
          <option value="">Tous les types de cible</option>
          {targetTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} className={selectClass} data-testid="audit-filtre-acteur">
          <option value="">Tous les acteurs</option>
          {actorOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Du</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={selectClass} data-testid="audit-filtre-date-debut" />
          <span>au</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={selectClass} data-testid="audit-filtre-date-fin" />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Action, acteur, cible, détail..."
        pageSize={25}
        emptyMessage="Aucun log trouvé."
      />
    </div>
  );
}
