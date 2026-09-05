import { useMemo, useState } from "react";
import { Link } from "wouter";
import { FileText, Printer, Eye, X, GraduationCap, Building2, BadgeCheck, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore } from "@/hooks/useStudentStore";
import { useAttestations } from "@/hooks/useAttestationStore";
import type { AttestationRecord, AttestationType } from "@/data/attestationStore";
import { buildAttestationHtml } from "@/pages/admin/AttestationsPage";
import { estActionInterdite } from "@/data/motifBlocageStore";
import { cn, formatDate } from "@/lib/utils";

const ACTION_IMPRESSION: Record<AttestationType, string> = {
  scolarite: "impression_certificat_scolarite",
  inscription: "impression_attestation_inscription",
  reussite: "impression_attestation_reussite",
};

const TYPE_ICON: Record<AttestationType, React.ElementType> = {
  scolarite: Building2,
  inscription: ClipboardList,
  reussite: GraduationCap,
};

const STATUT_CONFIG = {
  genere: { label: "Générée", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  envoyee: { label: "Envoyée", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
};

/** Consultation des attestations déjà générées par le secrétariat (attestationStore.ts) — jamais
 * de génération côté étudiant : pour en demander une nouvelle, il passe par "Mes demandes"
 * (type "attestation"), exactement comme le fait le formulaire réel. */
export default function StudentDocumentsPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const allAttestations = useAttestations();
  const [preview, setPreview] = useState<AttestationRecord | null>(null);

  const mesDocuments = useMemo(
    () => allAttestations.filter((a) => a.etudiantId === student?.id).sort((a, b) => b.dateGeneration.localeCompare(a.dateGeneration)),
    [allAttestations, student?.id],
  );

  const printAttestation = (entry: AttestationRecord) => {
    if (estActionInterdite(entry.etudiantId, ACTION_IMPRESSION[entry.type])) {
      toast.error("Impression bloquée — un motif de blocage administratif l'interdit. Contactez le service scolarité (Messagerie).");
      return;
    }
    const win = window.open("", "_blank");
    if (win) { win.document.write(buildAttestationHtml(entry)); win.document.close(); win.print(); }
  };

  if (!student) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes documents</h2>
        <p className="text-sm text-muted-foreground mt-1">Attestations et certificats délivrés par le secrétariat, prêts à imprimer.</p>
      </div>

      {mesDocuments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <FileText size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Aucune attestation générée pour l'instant.</p>
          <Link
            href="/student/requests"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Faire une demande d'attestation
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {mesDocuments.map((doc) => {
            const Icon = TYPE_ICON[doc.type];
            const statut = STATUT_CONFIG[doc.statut];
            return (
              <div key={doc.id} className="rounded-2xl border border-border bg-card p-4" data-testid={`document-${doc.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{doc.typeLabel}</p>
                      <p className="text-[11px] text-muted-foreground">N° {doc.numero}</p>
                    </div>
                  </div>
                  <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0", statut.cls)}>{statut.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2.5">
                  Générée le {formatDate(doc.dateGeneration)}
                  {doc.type === "reussite" && doc.semestreLabel ? ` · ${doc.semestreLabel}` : ""}
                </p>
                {doc.type === "reussite" && doc.moyenneConstatee !== undefined && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <BadgeCheck size={12} className="text-emerald-600" /> Moyenne {doc.moyenneConstatee.toFixed(2)}/20
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setPreview(doc)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
                    data-testid={`document-apercu-${doc.id}`}
                  >
                    <Eye size={13} /> Aperçu
                  </button>
                  <button
                    type="button"
                    onClick={() => printAttestation(doc)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors"
                    data-testid={`document-imprimer-${doc.id}`}
                  >
                    <Printer size={13} /> Imprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold flex items-center gap-2 text-gray-900"><FileText size={18} /> Aperçu — {preview.typeLabel}</h3>
              <button type="button" onClick={() => setPreview(null)}><X size={18} className="text-gray-500" /></button>
            </div>
            <iframe title="Aperçu attestation" srcDoc={buildAttestationHtml(preview)} className="flex-1 w-full" data-testid="document-preview-iframe" />
            <div className="p-4 flex gap-2 justify-end border-t flex-shrink-0">
              <button type="button" onClick={() => printAttestation(preview)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm">
                <Printer size={14} /> Imprimer / PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
