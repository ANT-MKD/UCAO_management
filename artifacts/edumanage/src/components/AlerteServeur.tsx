import { useEffect } from "react";
import { toast } from "sonner";
import { EVENEMENT_REFUS_SERVEUR } from "@/lib/miroirServeur";

/** Avec Supabase : quand la base refuse un enregistrement (droit manquant, élément encore utilisé,
 * valeur hors limites), l'écran a été recalé sur la base ; on dit pourquoi. */
export function AlerteServeur() {
  useEffect(() => {
    const signaler = (e: Event) => {
      const message = (e as CustomEvent<{ message: string }>).detail?.message ?? "La base a refusé l'enregistrement.";
      toast.error(message, { duration: 10_000, closeButton: true });
    };
    window.addEventListener(EVENEMENT_REFUS_SERVEUR, signaler);
    return () => window.removeEventListener(EVENEMENT_REFUS_SERVEUR, signaler);
  }, []);
  return null;
}
