import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormModal } from "@/components/admin/FormModal";
import { demanderCorrectionNote, libelleValeurNote } from "@/data/correctionNoteStore";
import type { NoteRecord } from "@/data/studentStore";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

/** « 12,5 » comme « 12.5 » : on tape une virgule en français. */
function lireNote(texte: string): number {
  return parseFloat(texte.trim().replace(",", "."));
}

/** Demande de correction d'une note validée ou publiée (portail professeur et saisie de la
 * scolarité) : la nouvelle valeur et son motif partent à la scolarité, qui accepte ou refuse ; la
 * note ne change qu'à l'acceptation, et la correction est inscrite au journal. */
export function DemandeCorrectionModal({ note, bareme, acteurId, onClose }: {
  note: NoteRecord | null;
  bareme: number;
  acteurId: string | undefined;
  onClose: () => void;
}) {
  const [valeur, setValeur] = useState("");
  const [absent, setAbsent] = useState(false);
  const [motif, setMotif] = useState("");

  useEffect(() => {
    if (!note) return;
    setValeur(note.absent ? "" : String(note.note).replace(".", ","));
    setAbsent(!!note.absent);
    setMotif("");
  }, [note]);

  const envoyer = () => {
    if (!note || !acteurId) return;
    try {
      demanderCorrectionNote({ noteId: note.id, nouvelleNote: lireNote(valeur), absent, motif, bareme }, acteurId);
      toast.success("Demande de correction envoyée à la scolarité.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demande impossible.");
    }
  };

  return (
    <FormModal
      open={!!note}
      onClose={onClose}
      title="Demander une correction"
      subtitle={note ? `${note.etudiant} — ${note.ec} : ${libelleValeurNote(note.note, note.absent)} actuellement` : undefined}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Cette note est validée : elle ne se modifie plus directement. Indiquez la note juste et le motif ; la scolarité acceptera ou refusera la correction, et elle sera inscrite au journal.</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label htmlFor="correction-note" className="block text-xs font-medium text-muted-foreground mb-1.5">Nouvelle note /{bareme}</label>
            <input id="correction-note" type="text" inputMode="decimal" disabled={absent} value={absent ? "ABS" : valeur} onChange={(e) => setValeur(e.target.value)} className={inputClass} data-testid="correction-note" />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground pb-2.5">
            <input type="checkbox" checked={absent} onChange={(e) => setAbsent(e.target.checked)} data-testid="correction-absent" />
            Absent (ABS = 0)
          </label>
        </div>
        <div>
          <label htmlFor="correction-motif" className="block text-xs font-medium text-muted-foreground mb-1.5">Motif *</label>
          <textarea id="correction-motif" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. : erreur de report, copie recorrigée" className={inputClass} data-testid="correction-motif" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-sm">Annuler</button>
          <button type="button" onClick={envoyer} disabled={!motif.trim() || (!absent && !valeur.trim())} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50" data-testid="correction-envoyer">Envoyer la demande</button>
        </div>
      </div>
    </FormModal>
  );
}
