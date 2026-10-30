import { useEffect } from "react";
import { toast } from "sonner";
import { EVENEMENT_STOCKAGE_PLEIN } from "@/lib/stockageLocal";

/** Affiche un avertissement persistant dès qu'un enregistrement échoue parce que le stockage du
 * navigateur est plein — sans lui, l'écran montrait l'action comme réussie et tout était perdu au
 * rechargement. Un seul message à la fois (id fixe), qui reste jusqu'à ce qu'on le ferme. */
export function AlerteStockage() {
  useEffect(() => {
    const signaler = () => {
      toast.error("Enregistrement impossible : le stockage de ce navigateur est plein", {
        id: "stockage-plein",
        duration: Infinity,
        closeButton: true,
        description:
          "Votre dernière action n'a pas été conservée et sera perdue au rechargement. Supprimez des pièces jointes ou photos devenues inutiles, puis recommencez.",
      });
    };
    window.addEventListener(EVENEMENT_STOCKAGE_PLEIN, signaler);
    return () => window.removeEventListener(EVENEMENT_STOCKAGE_PLEIN, signaler);
  }, []);
  return null;
}
