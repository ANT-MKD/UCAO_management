import { FileSpreadsheet } from "lucide-react";
import { exportCurriculumToExcel } from "@/lib/curriculumExport";
import type { UeRecord, EcRecord } from "@/data/curriculumStore";
import { cn } from "@/lib/utils";

interface Props {
  ues: UeRecord[];
  ecs: EcRecord[];
  className?: string;
}

/** Export Excel de la maquette pédagogique (UE + EC actuellement filtrés), au même format que le
 * modèle d'import (CurriculumImportButton) — pour un aller-retour Export → édition → Réimport.
 * Réutilisé identique sur les écrans UE et EC. */
export function MaquetteExportButton({ ues, ecs, className }: Props) {
  const disabled = ues.length === 0;
  const title = disabled
    ? "Aucune UE à exporter avec ces filtres — créez une UE (« + Nouvelle UE ») ou importez-en via Excel d'abord"
    : "Exporter la maquette en Excel";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => exportCurriculumToExcel(ues, ecs)}
      title={title}
      className={cn(
        "flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
      data-testid="maquette-export-excel"
    >
      <FileSpreadsheet size={15} /> Exporter via Excel
    </button>
  );
}
