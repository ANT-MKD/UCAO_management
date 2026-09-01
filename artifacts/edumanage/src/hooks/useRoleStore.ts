import { useSyncExternalStore } from "react";
import { subscribeRoles, getRoles, getRoleById } from "@/data/roleStore";

export function useRoles() {
  return useSyncExternalStore(subscribeRoles, getRoles, getRoles);
}

export function useRole(id: string) {
  useSyncExternalStore(subscribeRoles, () => getRoleById(id), () => getRoleById(id));
  return getRoleById(id);
}
