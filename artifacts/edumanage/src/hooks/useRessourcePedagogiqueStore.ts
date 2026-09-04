import { useSyncExternalStore } from "react";
import {
  subscribeRessourcesPedagogiques,
  getRessourcesPedagogiques,
  getRessourcesPourClasse,
} from "@/data/ressourcePedagogiqueStore";

export function useRessourcesPedagogiques() {
  return useSyncExternalStore(subscribeRessourcesPedagogiques, getRessourcesPedagogiques, getRessourcesPedagogiques);
}

export function useRessourcesPourClasse(classeId: string) {
  useSyncExternalStore(
    subscribeRessourcesPedagogiques,
    () => getRessourcesPourClasse(classeId),
    () => getRessourcesPourClasse(classeId),
  );
  return getRessourcesPourClasse(classeId);
}
