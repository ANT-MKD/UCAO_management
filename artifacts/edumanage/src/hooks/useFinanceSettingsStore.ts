import { useSyncExternalStore } from "react";
import { typeFraisStore, modePaiementFinanceStore, typeFactureStore } from "@/data/financeSettingsStore";

export function useTypesFrais() {
  return useSyncExternalStore(typeFraisStore.subscribe, typeFraisStore.getAll, typeFraisStore.getAll);
}

export function useModesPaiementFinance() {
  return useSyncExternalStore(
    modePaiementFinanceStore.subscribe,
    modePaiementFinanceStore.getAll,
    modePaiementFinanceStore.getAll,
  );
}

export function useTypesFacture() {
  return useSyncExternalStore(typeFactureStore.subscribe, typeFactureStore.getAll, typeFactureStore.getAll);
}
