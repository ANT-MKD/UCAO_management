import { useRef } from "react";
import { Upload, Trash2, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { useDocuments } from "@/hooks/useDocumentStore";
import { addDocument, deleteDocument, TAILLE_MAX_DOCUMENT_OCTETS, type DocumentEntiteType } from "@/data/documentStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";

interface Props {
  entiteType: DocumentEntiteType;
  entiteId: string;
}

function formatTaille(octets: number): string {
  return octets > 1024 * 1024 ? `${(octets / (1024 * 1024)).toFixed(1)} Mo` : `${Math.round(octets / 1024)} Ko`;
}

export function DocumentsPanel({ entiteType, entiteId }: Props) {
  const { currentUser } = useAuth();
  const documents = useDocuments().filter((d) => d.entiteType === entiteType && d.entiteId === entiteId).sort((a, b) => b.ajouteLe.localeCompare(a.ajouteLe));
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file || !currentUser) return;
    if (file.size > TAILLE_MAX_DOCUMENT_OCTETS) {
      toast.error(`Fichier trop lourd (max ${Math.round(TAILLE_MAX_DOCUMENT_OCTETS / 1024)} Ko).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      addDocument({
        entiteType,
        entiteId,
        nom: file.name,
        dataUrl: String(reader.result),
        tailleOctets: file.size,
        ajoutePar: currentUser.name,
      }, currentUser.id);
      toast.success("Document ajouté.");
    };
    reader.readAsDataURL(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDelete = (id: string) => {
    if (!currentUser) return;
    deleteDocument(id, currentUser.id);
    toast.success("Document supprimé.");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Documents</h3>
        <label className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer" data-testid="document-ajouter">
          <Upload size={13} /> Ajouter
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} data-testid="document-input" />
        </label>
      </div>
      <p className="text-xs text-muted-foreground mb-3">Fichiers max {Math.round(TAILLE_MAX_DOCUMENT_OCTETS / 1024)} Ko (copie CNI, diplômes, justificatifs...).</p>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucun document pour l'instant.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3.5 bg-muted/30 rounded-xl border border-border" data-testid={`document-ligne-${d.id}`}>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText size={15} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{d.nom}</div>
                <div className="text-[10px] text-muted-foreground">{formatTaille(d.tailleOctets)} · {formatDate(d.ajouteLe.slice(0, 10))} · {d.ajoutePar}</div>
              </div>
              <a href={d.dataUrl} download={d.nom} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary flex-shrink-0" data-testid={`document-telecharger-${d.id}`}>
                <Download size={14} />
              </a>
              <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 flex-shrink-0" data-testid={`document-supprimer-${d.id}`}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
