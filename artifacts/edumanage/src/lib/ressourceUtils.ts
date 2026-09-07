import {
  FileText, FileSpreadsheet, Presentation, FileImage, FileArchive, Video, Link2,
  File as FileIcon,
} from "lucide-react";
import type { RessourcePedagogiqueRecord } from "@/data/ressourcePedagogiqueStore";

export function formatTailleRessource(octets: number): string {
  return octets > 1024 * 1024 ? `${(octets / (1024 * 1024)).toFixed(1)} Mo` : `${Math.round(octets / 1024)} Ko`;
}

export const RESSOURCE_TYPE_STYLES: Record<string, { icon: typeof FileText; bg: string; text: string }> = {
  "Liens externes": { icon: Link2, bg: "bg-cyan-100", text: "text-cyan-600" },
  "PDF": { icon: FileText, bg: "bg-red-100", text: "text-red-600" },
  "Documents Word": { icon: FileText, bg: "bg-blue-100", text: "text-blue-600" },
  "Feuilles de calcul": { icon: FileSpreadsheet, bg: "bg-emerald-100", text: "text-emerald-600" },
  "Présentations": { icon: Presentation, bg: "bg-amber-100", text: "text-amber-600" },
  "Vidéos": { icon: Video, bg: "bg-rose-100", text: "text-rose-600" },
  "Images": { icon: FileImage, bg: "bg-violet-100", text: "text-violet-600" },
  "Archives": { icon: FileArchive, bg: "bg-slate-200", text: "text-slate-600" },
  "Autres documents": { icon: FileIcon, bg: "bg-muted", text: "text-muted-foreground" },
};

/** Type dérivé d'une ressource réelle : "Liens externes" si c'est un lien (pas de fichier), sinon
 * déduit de l'extension du fichier téléversé — jamais une catégorie saisie à la main. */
export function detecterTypeRessource(r: Pick<RessourcePedagogiqueRecord, "nom" | "url">): string {
  if (r.url) return "Liens externes";
  const ext = r.nom?.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (["doc", "docx"].includes(ext)) return "Documents Word";
  if (["xls", "xlsx", "csv"].includes(ext)) return "Feuilles de calcul";
  if (["ppt", "pptx"].includes(ext)) return "Présentations";
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return "Vidéos";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "Images";
  if (["zip", "rar", "7z"].includes(ext)) return "Archives";
  return "Autres documents";
}
