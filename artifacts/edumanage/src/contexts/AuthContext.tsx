import { createContext, useContext, useEffect, useState } from "react";
import {
  authenticateUser,
  clearAuthSession,
  findUserAccountByIdentifier,
  getEtudiantById,
  loadAuthSession,
  logAudit,
  pushNotificationEtPersister,
  saveAuthSession,
  type UserRole,
} from "@/data/studentStore";
import { isPortalActif, PORTAL_LABELS } from "@/data/portalAccessStore";
import { isLocked, registerFailedAttempt, registerSuccessfulLogin, MAX_TENTATIVES } from "@/data/loginSecurityStore";
import { getCommunicationRolesParType } from "@/data/communicationRolesStore";
import { estActionInterdite, getMotifBlocageById } from "@/data/motifBlocageStore";
import { useUserAccounts, useStudentStore } from "@/hooks/useStudentStore";
import { usePortalAccess } from "@/hooks/usePortalAccessStore";
import { useMotifsBlocage } from "@/hooks/useMotifBlocageStore";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  identifier: string;
  linkedId?: string;
  avatar?: string;
  roleId?: string;
}

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (identifierOrEmail: string, password: string) => User | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isAuthenticated: false,
  login: () => null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = loadAuthSession();
    if (!saved) return null;
    return {
      id: saved.id,
      name: saved.name,
      email: saved.email,
      role: saved.role,
      identifier: saved.identifier,
      linkedId: saved.linkedId,
      roleId: saved.roleId,
    };
  });

  const accounts = useUserAccounts();
  const portalAccess = usePortalAccess();
  useStudentStore(); // souscription : un motif de blocage assigné en direct doit aussi invalider la session
  useMotifsBlocage();

  /** Invalide une session déjà ouverte dès que le compte est désactivé, son portail coupé, ou (pour
   * un étudiant) qu'un motif de blocage interdisant "portail_etudiant" lui est assigné — jusqu'ici,
   * ces coupe-circuits ne bloquaient que les connexions futures, une session déjà ouverte restait
   * valide indéfiniment. Se réévalue à chaque changement (réactif), pas seulement au chargement. */
  useEffect(() => {
    if (!currentUser) return;
    const account = accounts.find((a) => a.id === currentUser.id);
    let stillValid = !!account && account.actif !== false && portalAccess[currentUser.role];
    if (stillValid && currentUser.role === "student" && currentUser.linkedId) {
      stillValid = !estActionInterdite(currentUser.linkedId, "portail_etudiant");
    }
    if (!stillValid) {
      setCurrentUser(null);
      clearAuthSession();
    }
  }, [currentUser, accounts, portalAccess]);

  const login = (identifierOrEmail: string, password: string): User | null => {
    const lock = isLocked(identifierOrEmail);
    if (lock.locked) {
      const minutes = Math.max(1, Math.ceil((lock.remainingMs ?? 0) / 60000));
      throw new Error(`Trop de tentatives échouées. Réessayez dans ${minutes} minute(s).`);
    }

    const account = authenticateUser(identifierOrEmail, password);
    if (!account) {
      const result = registerFailedAttempt(identifierOrEmail);
      if (result.locked) {
        const compte = findUserAccountByIdentifier(identifierOrEmail);
        if (compte) {
          logAudit("system", "lockout_failed_attempts", "user_account", compte.id, `${MAX_TENTATIVES} tentatives échouées`);
          pushNotificationEtPersister(compte.id, "Votre compte a été temporairement bloqué après plusieurs tentatives de connexion échouées.");
          for (const alerte of getCommunicationRolesParType("destinataire_alert")) {
            pushNotificationEtPersister(alerte.userId, `Compte verrouillé après tentatives échouées : ${compte.displayName} (${compte.identifier}).`);
          }
        }
      }
      return null;
    }

    if (!isPortalActif(account.role)) {
      throw new Error(`Le portail ${PORTAL_LABELS[account.role]} est actuellement désactivé (Sécurité → Portails). Contactez l'administration.`);
    }
    if (account.actif === false) {
      throw new Error("Ce compte a été désactivé (Sécurité → Liste des utilisateurs). Contactez l'administration.");
    }
    if (account.role === "student" && account.linkedId && estActionInterdite(account.linkedId, "portail_etudiant")) {
      const etudiant = getEtudiantById(account.linkedId);
      const motif = etudiant?.motifBlocageId ? getMotifBlocageById(etudiant.motifBlocageId) : undefined;
      throw new Error(`Accès au portail bloqué${motif ? ` — motif : ${motif.intitule}` : ""}. Contactez l'administration.`);
    }

    registerSuccessfulLogin(identifierOrEmail);
    logAudit(account.id, "login", "user_account", account.id);

    const user: User = {
      id: account.id,
      name: account.displayName,
      email: account.email,
      role: account.role,
      identifier: account.identifier,
      linkedId: account.linkedId,
      roleId: account.roleId,
    };
    setCurrentUser(user);
    saveAuthSession(user);
    return user;
  };

  const logout = () => {
    setCurrentUser(null);
    clearAuthSession();
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: !!currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
