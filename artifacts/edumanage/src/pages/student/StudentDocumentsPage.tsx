import { useMemo, useState } from "react";
import { Link } from "wouter";
import { FileText, Printer, Eye, X, GraduationCap, Building2, BadgeCheck, ClipboardList, Search, Upload, CheckCircle2, AlertCircle, FolderOpen, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore } from "@/hooks/useStudentStore";
import { useAttestations } from "@/hooks/useAttestationStore";
import type { AttestationRecord, AttestationType } from "@/data/attestationStore";
import { buildAttestationHtml } from "@/pages/admin/AttestationsPage";
import { estActionInterdite } from "@/data/motifBlocageStore";
import { deposerDocumentEtudiant } from "@/data/studentStore";
import { DOCUMENTS_INSCRIPTION } from "@/lib/inscriptionConstants";
import { FormModal } from "@/components/admin/FormModal";
import { KPICard } from "@/components/admin/KPICard";
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

type Tab = "tous" | "attestations" | "pieces";

/** "Mes documents" réunit les deux seules sources réelles de documents administratifs de
 * l'étudiant : les attestations générées par le secrétariat (attestationStore.ts, jamais générées
 * ici — pour en demander une nouvelle, l'étudiant passe par "Mes demandes") et les pièces
 * d'inscription (documentsFournis/documentsFichiers sur son dossier), qu'il peut ici régulariser
 * lui-même en déposant un scan pour celles encore manquantes. */
export default function StudentDocumentsPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const allAttestations = useAttestations();
  const [tab, setTab] = useState<Tab>("tous");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<AttestationRecord | null>(null);
  const [uploadDocId, setUploadDocId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<{ name: string; dataUrl: string } | null>(null);

  const mesAttestations = useMemo(
    () => allAttestations.filter((a) => a.etudiantId === student?.id).sort((a, b) => b.dateGeneration.localeCompare(a.dateGeneration)),
    [allAttestations, student?.id],
  );

  const piecesFournies = DOCUMENTS_INSCRIPTION.filter((d) => student?.documentsFournis?.includes(d.id));
  const piecesManquantes = DOCUMENTS_INSCRIPTION.filter((d) => !student?.documentsFournis?.includes(d.id));

  const q = query.trim().toLowerCase();
  const attestationsAffichees = tab === "pieces" ? [] : mesAttestations.filter((a) => a.typeLabel.toLowerCase().includes(q));
  const piecesAffichees = tab === "attestations" ? [] : DOCUMENTS_INSCRIPTION.filter((d) => d.label.toLowerCase().includes(q));

  const printAttestation = (entry: AttestationRecord) => {
    if (estActionInterdite(entry.etudiantId, ACTION_IMPRESSION[entry.type])) {
      toast.error("Impression bloquée — un motif de blocage administratif l'interdit. Contactez le service scolarité (Messagerie).");
      return;
    }
    const win = window.open("", "_blank");
    if (win) { win.document.write(buildAttestationHtml(entry)); win.document.close(); win.print(); }
  };

  const voirFichier = (dataUrl: string) => {
    const win = window.open("", "_blank");
    if (!win) return;
    if (dataUrl.startsWith("data:application/pdf")) {
      win.location.href = dataUrl;
    } else {
      win.document.write(`<!DOCTYPE html><html><body style="margin:0"><img src="${dataUrl}" style="max-width:100%" /></body></html>`);
      win.document.close();
    }
  };

  const openUploadModal = (docId: string) => {
    setUploadDocId(docId);
    setUploadFile(null);
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadFile({ name: file.name, dataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const handleDeposer = () => {
    if (!currentUser || !student || !uploadDocId || !uploadFile) return;
    deposerDocumentEtudiant(student.id, uploadDocId, uploadFile.dataUrl, currentUser.id);
    toast.success("Document déposé — il apparaît désormais comme fourni.");
    setUploadDocId(null);
    setUploadFile(null);
  };

  if (!student) return null;

  const totalDocuments = mesAttestations.length + DOCUMENTS_INSCRIPTION.length;
  const rienAAfficher = attestationsAffichees.length === 0 && piecesAffichees.length === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes documents</h2>
        <p className="text-sm text-muted-foreground mt-1">Attestations délivrées par le secrétariat et pièces de votre dossier d'inscription.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <KPICard icon={FileText} label="Total documents" value={totalDocuments} accentColor="#4f46e5" />
        <KPICard icon={BadgeCheck} label="Attestations générées" value={mesAttestations.length} accentColor="#2563eb" />
        <KPICard icon={CheckCircle2} label="Pièces fournies" value={piecesFournies.length} subtitle={`sur ${DOCUMENTS_INSCRIPTION.length}`} accentColor="#10b981" />
        <KPICard icon={AlertCircle} label="Pièces manquantes" value={piecesManquantes.length} accentColor={piecesManquantes.length > 0 ? "#f59e0b" : "#10b981"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-3 space-y-2.5">
            <div className="flex flex-wrap gap-1">
              {([["tous", "Tous"], ["attestations", "Attestations"], ["pieces", "Pièces d'inscription"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                    tab === key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted",
                  )}
                  data-testid={`documents-onglet-${key}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un document..."
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="documents-recherche"
              />
            </div>
          </div>

          {rienAAfficher ? (
            <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucun document ne correspond.</p>
          ) : (
            <>
              {attestationsAffichees.length > 0 && (
                <div className="space-y-2">
                  {tab === "tous" && <h4 className="text-xs font-bold text-muted-foreground uppercase px-1">Attestations</h4>}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {attestationsAffichees.map((doc) => {
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
                            <button type="button" onClick={() => setPreview(doc)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors" data-testid={`document-apercu-${doc.id}`}>
                              <Eye size={13} /> Aperçu
                            </button>
                            <button type="button" onClick={() => printAttestation(doc)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors" data-testid={`document-imprimer-${doc.id}`}>
                              <Printer size={13} /> Imprimer
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {piecesAffichees.length > 0 && (
                <div className="space-y-2">
                  {tab === "tous" && <h4 className="text-xs font-bold text-muted-foreground uppercase px-1 pt-1">Pièces d'inscription</h4>}
                  <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                    {piecesAffichees.map((doc) => {
                      const fournie = !!student.documentsFournis?.includes(doc.id);
                      const fichier = student.documentsFichiers?.[doc.id];
                      return (
                        <div key={doc.id} className="flex items-center justify-between gap-3 p-3.5" data-testid={`piece-${doc.id}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", fournie ? "bg-emerald-50 dark:bg-emerald-950" : "bg-amber-50 dark:bg-amber-950")}>
                              {fournie ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-amber-600" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{doc.label}</p>
                              <p className="text-[11px] text-muted-foreground">{fournie ? "Fournie" : "Manquante"}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {fichier && (
                              <button type="button" onClick={() => voirFichier(fichier)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors" data-testid={`piece-voir-${doc.id}`}>
                                <Eye size={12} /> Voir
                              </button>
                            )}
                            {!fournie && (
                              <button type="button" onClick={() => openUploadModal(doc.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors" data-testid={`piece-deposer-${doc.id}`}>
                                <Upload size={12} /> Déposer
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-4 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><FolderOpen size={15} className="text-primary" /> Catégories</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Attestations</span>
                <span className="font-semibold text-foreground">{mesAttestations.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pièces d'inscription</span>
                <span className="font-semibold text-foreground">{DOCUMENTS_INSCRIPTION.length}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><MessageSquare size={15} className="text-primary" /> Besoin d'aide ?</h3>
            <p className="text-xs text-muted-foreground mb-3">Pour une attestation manquante, faites-en la demande. Pour toute autre question, contactez le service scolarité.</p>
            <div className="flex flex-col gap-2">
              <Link href="/student/requests" className="inline-flex items-center justify-center gap-2 px-3.5 py-2 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors">
                Demander une attestation
              </Link>
              <Link href="/student/messages" className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                Contacter le service
              </Link>
            </div>
          </div>
        </div>
      </div>

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

      <FormModal
        open={!!uploadDocId}
        onClose={() => setUploadDocId(null)}
        title="Déposer un document"
        subtitle={uploadDocId ? DOCUMENTS_INSCRIPTION.find((d) => d.id === uploadDocId)?.label : undefined}
      >
        <div className="space-y-3">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:bg-muted transition-colors">
            <Upload size={22} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground text-center">
              {uploadFile ? uploadFile.name : "Cliquez pour choisir un fichier (image ou PDF)"}
            </span>
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} data-testid="piece-fichier-input" />
          </label>
          <button
            type="button"
            onClick={handleDeposer}
            disabled={!uploadFile}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="piece-deposer-confirmer"
          >
            Déposer ce document
          </button>
        </div>
      </FormModal>
    </div>
  );
}
