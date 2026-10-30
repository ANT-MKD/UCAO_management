import { toast } from "sonner";
import type { ResultatSuppression } from "@/data/suppressionReferentiel";

/** Suppression d'un élément du référentiel : si l'élément est utilisé, on affiche tout de suite
 * pourquoi il ne peut pas être supprimé (sans rien demander) ; sinon on demande confirmation. */
export function confirmerSuppression(verification: ResultatSuppression, question: string, supprimer: () => ResultatSuppression, succes: string) {
  if (!verification.ok) {
    toast.error(verification.reason, { duration: 10000 });
    return;
  }
  if (!window.confirm(question)) return;
  const res = supprimer();
  if (res.ok) toast.success(succes);
  else toast.error(res.reason, { duration: 10000 });
}
