import { FileSpreadsheet, FileText, File as FileIcon } from "lucide-react";
import { exportCurriculumToExcel, exportMaquettePdf, exportMaquetteWord } from "@/lib/curriculumExport";
import type { UeRecord, EcRecord } from "@/data/curriculumStore";
import { cn } from "@/lib/utils";

interface Props {
  ues: UeRecord[];
  ecs: EcRecord[];
  titre: string;
  className?: string;
}

/** Export de la maquette pédagogique (UE + EC actuellement filtrés) dans les 3 formats attendus
 * par l'administration — Excel (aller-retour avec l'import), PDF (impression/archivage), Word
 * (édition hors ligne). Réutilisé identique sur les écrans UE et EC. */
export function MaquetteExportButton({ ues, ecs, titre, className }: Props) {
  const disabled = ues.length === 0;
  const btnClass = "flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button type="button" disabled={disabled} onClick={() => exportCurriculumToExcel(ues, ecs)} title="Exporter la maquette en Excel" className={btnClass} data-testid="maquette-export-excel">
        <FileSpreadsheet size={13} /> Excel
      </button>
      <button type="button" disabled={disabled} onClick={() => exportMaquettePdf(ues, ecs, { titre })} title="Exporter la maquette en PDF" className={btnClass} data-testid="maquette-export-pdf">
        <FileText size={13} /> PDF
      </button>
      <button type="button" disabled={disabled} onClick={() => exportMaquetteWord(ues, ecs, { titre })} title="Exporter la maquette en Word" className={btnClass} data-testid="maquette-export-word">
        <FileIcon size={13} /> Word
      </button>
    </div>
  );
}
