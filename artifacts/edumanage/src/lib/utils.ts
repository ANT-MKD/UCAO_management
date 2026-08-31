import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCFA = (n: number) =>
  new Intl.NumberFormat("fr-SN", { style: "currency", currency: "XOF", minimumFractionDigits: 0 }).format(n);

export const formatDate = (d: string | Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d));

export const formatShortDate = (d: string | Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));

export const getMention = (avg: number): string => {
  if (avg >= 16) return "Très Bien";
  if (avg >= 14) return "Bien";
  if (avg >= 12) return "Assez Bien";
  if (avg >= 10) return "Passable";
  return "Ajourné";
};

export const hashColor = (str: string): string => {
  const colors = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
  let hash = 0;
  for (const c of str) hash = (hash << 5) - hash + c.charCodeAt(0);
  return colors[Math.abs(hash) % colors.length];
};

/** Couleur associée à un moyen de paiement, par correspondance partielle sur son libellé — reste
 * valide quelle que soit l'orthographe exacte utilisée dans financeSettingsStore.modePaiementFinanceStore
 * ("Espèce", "Espèces", "Wave", "Orange Money"...), contrairement à une table figée par valeur exacte. */
export const moyenPaiementColor = (label: string): { color: string; bg: string } => {
  const l = label.toLowerCase();
  if (l.includes("wave")) return { color: "#2563eb", bg: "#eff6ff" };
  if (l.includes("orange")) return { color: "#ea580c", bg: "#fff7ed" };
  if (l.includes("vir")) return { color: "#4f46e5", bg: "#eef2ff" };
  if (l.includes("esp")) return { color: "#16a34a", bg: "#f0fdf4" };
  if (l.includes("ch")) return { color: "#64748b", bg: "#f8fafc" };
  if (l.includes("avoir")) return { color: "#8b5cf6", bg: "#f5f3ff" };
  return { color: "#64748b", bg: "#f8fafc" };
};

export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};
