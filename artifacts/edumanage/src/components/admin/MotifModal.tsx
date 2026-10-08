import { useEffect, useId, useState } from "react";
import { FormModal } from "@/components/admin/FormModal";

interface MotifModalProps {
  open: boolean;
  title: string;
  /** Ce qui va se passer, rappelé au-dessus du champ. */
  description?: React.ReactNode;
  /** Motif exigé pour valider (sinon facultatif). */
  obligatoire?: boolean;
  libelleConfirmer?: string;
  placeholder?: string;
  onCancel: () => void;
  onConfirm: (motif: string) => void;
  testId?: string;
}

/** Demande d'un motif dans une fenêtre de l'application (jamais la fenêtre grise du navigateur) :
 * correction manuelle d'une décision de jury, ajustement du seuil de session… */
export function MotifModal({ open, title, description, obligatoire = false, libelleConfirmer = "Valider", placeholder, onCancel, onConfirm, testId = "motif-modal" }: MotifModalProps) {
  const [motif, setMotif] = useState("");
  const champId = useId();
  useEffect(() => { if (open) setMotif(""); }, [open]);
  const peutValider = !obligatoire || motif.trim().length > 0;

  return (
    <FormModal open={open} onClose={onCancel} title={title} size="md">
      <div className="space-y-4" data-testid={testId}>
        {description && <div className="text-sm text-foreground">{description}</div>}
        <div>
          <label htmlFor={champId} className="block text-xs font-medium text-muted-foreground mb-1.5">
            Motif {obligatoire ? "*" : "(facultatif)"}
          </label>
          <textarea
            id={champId}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            placeholder={placeholder}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid={`${testId}-motif`}
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground mt-1">Le motif est conservé dans l&apos;historique de la délibération.</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">Annuler</button>
          <button
            type="button"
            onClick={() => onConfirm(motif.trim())}
            disabled={!peutValider}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid={`${testId}-valider`}
          >
            {libelleConfirmer}
          </button>
        </div>
      </div>
    </FormModal>
  );
}
