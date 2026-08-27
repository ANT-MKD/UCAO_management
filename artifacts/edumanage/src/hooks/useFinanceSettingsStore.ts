import { useSyncExternalStore } from "react";
import {
  typeFraisStore,
  modePaiementFinanceStore,
  typeFactureStore,
  modeleFraisStore,
  articleServiceStore,
  banqueStore,
  activiteServiceStore,
} from "@/data/financeSettingsStore";

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

export function useModelesFrais() {
  return useSyncExternalStore(modeleFraisStore.subscribe, modeleFraisStore.getAll, modeleFraisStore.getAll);
}

export function useArticlesService() {
  return useSyncExternalStore(articleServiceStore.subscribe, articleServiceStore.getAll, articleServiceStore.getAll);
}

export function useBanques() {
  return useSyncExternalStore(banqueStore.subscribe, banqueStore.getAll, banqueStore.getAll);
}

export function useActivitesService() {
  return useSyncExternalStore(activiteServiceStore.subscribe, activiteServiceStore.getAll, activiteServiceStore.getAll);
}
