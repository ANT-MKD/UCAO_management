import { useMemo, useSyncExternalStore } from "react";
import { modeSupabase } from "@/lib/supabase";
import type { UserAccountRecord } from "@/data/studentStore";
import type { RoleRecord } from "@/data/roleStore";
import { statutPin, type StatutPin } from "@/data/pinActivationStore";
import {
  codesServeur,
  comptesServeur,
  demandesServeur,
  portailsServeur,
  rolesServeur,
  type PortailsVue,
} from "@/data/comptesServeurStore";
import { useUserAccounts } from "@/hooks/useStudentStore";
import { useRoles } from "@/hooks/useRoleStore";
import { usePortalAccess } from "@/hooks/usePortalAccessStore";
import { useDemandesReinitialisation, usePinsActivation } from "@/hooks/usePinActivationStore";

/** Mêmes listes pour les écrans, que les données viennent de la base (Supabase) ou du navigateur. */

function useSource<T>(source: { abonner: (f: () => void) => () => void; lire: () => T }): T {
  return useSyncExternalStore(source.abonner, source.lire, source.lire);
}

export function useComptesAdmin(): UserAccountRecord[] {
  const locaux = useUserAccounts();
  const serveur = useSource(comptesServeur);
  return modeSupabase ? serveur : locaux;
}

export function useCompteAdmin(id: string): UserAccountRecord | undefined {
  const comptes = useComptesAdmin();
  return comptes.find((c) => c.id === id);
}

export function useRolesAdmin(): RoleRecord[] {
  const locaux = useRoles();
  const serveur = useSource(rolesServeur);
  return modeSupabase ? serveur : locaux;
}

export function usePortailsAdmin(): PortailsVue {
  const locaux = usePortalAccess();
  const serveur = useSource(portailsServeur);
  return useMemo(
    () => (modeSupabase ? serveur : { ouverts: locaux, messages: { admin: "", teacher: "", student: "" } }),
    [serveur, locaux],
  );
}

export interface CodePinVue {
  id: string;
  compteId: string;
  compteLabel: string;
  compteIdentifier: string;
  /** Absent avec Supabase : le code n'est montré qu'à sa génération. */
  pin?: string;
  createdAt: string;
  auteurLabel: string;
  statut: StatutPin;
}

export function useCodesPin(): CodePinVue[] {
  const comptes = useComptesAdmin();
  const locaux = usePinsActivation();
  const serveur = useSource(codesServeur);
  return useMemo(() => {
    if (!modeSupabase) {
      return locaux.map((r) => ({
        id: r.id, compteId: r.userId, compteLabel: r.compteLabel, compteIdentifier: r.compteIdentifier, pin: r.pin,
        createdAt: r.createdAt, auteurLabel: r.auteurLabel, statut: statutPin(r, locaux),
      }));
    }
    const parId = new Map(comptes.map((c) => [c.id, c]));
    return serveur.map((c) => ({
      id: c.id, compteId: c.compteId, compteLabel: parId.get(c.compteId)?.displayName ?? "Compte supprimé",
      compteIdentifier: parId.get(c.compteId)?.identifier ?? "", createdAt: c.createdAt,
      auteurLabel: (c.auteurId && parId.get(c.auteurId)?.displayName) || "—", statut: c.statut,
    }));
  }, [comptes, locaux, serveur]);
}

export interface DemandeVue {
  id: string;
  compteId: string;
  compteLabel: string;
  compteIdentifier: string;
  createdAt: string;
}

/** Demandes « mot de passe oublié » encore en attente d'un code. */
export function useDemandesAttente(): DemandeVue[] {
  const comptes = useComptesAdmin();
  const locales = useDemandesReinitialisation();
  const serveur = useSource(demandesServeur);
  return useMemo(() => {
    if (!modeSupabase) {
      return locales.filter((d) => !d.traiteeLe)
        .map((d) => ({ id: d.id, compteId: d.userId, compteLabel: d.compteLabel, compteIdentifier: d.compteIdentifier, createdAt: d.createdAt }));
    }
    const parId = new Map(comptes.map((c) => [c.id, c]));
    return serveur.map((d) => ({
      id: d.id, compteId: d.compteId, compteLabel: parId.get(d.compteId)?.displayName ?? "Compte",
      compteIdentifier: parId.get(d.compteId)?.identifier ?? "", createdAt: d.createdAt,
    }));
  }, [comptes, locales, serveur]);
}
