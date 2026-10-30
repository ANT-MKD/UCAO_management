import { createContext, useContext, useEffect, useState } from "react";
import {
  authenticateUser,
  clearAuthSession,
  findUserAccountByIdentifier,
  loadAuthSession,
  logAudit,
  pushNotificationEtPersister,
  refleterCompteServeur,
  saveAuthSession,
  type UserRole,
} from "@/data/studentStore";
import { modeSupabase, supabase } from "@/lib/supabase";
import { compteDeLaSession, connecterServeur, utilisateurDuCompte, type CompteServeur } from "@/lib/comptesServeur";
import { arreterMiroirs, chargerMiroirs } from "@/lib/miroirServeur";
import "@/data/miroirs";

const DONNEES_INJOIGNABLES = "Impossible de charger les données de l'établissement. Vérifiez votre connexion internet, puis reconnectez-vous.";
import { isPortalActif, PORTAL_LABELS } from "@/data/portalAccessStore";
import { isLocked, registerFailedAttempt, registerSuccessfulLogin, MAX_TENTATIVES } from "@/data/loginSecurityStore";
import { getCommunicationRolesParType } from "@/data/communicationRolesStore";
import { estActionInterdite, motifBlocagePortailPour } from "@/data/motifBlocageStore";
import { useUserAccounts, useStudentStore } from "@/hooks/useStudentStore";
import { usePortalAccess } from "@/hooks/usePortalAccessStore";
import { useMotifsBlocage } from "@/hooks/useMotifBlocageStore";
import { useRelances } from "@/hooks/useRelancePaiementStore";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  identifier: string;
  linkedId?: string;
  avatar?: string;
  roleId?: string;
  /** Connecté avec un mot de passe provisoire : accès aux portails bloqué jusqu'au changement. */
  doitChangerMotDePasse?: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  /** Mode Supabase : vrai le temps de retrouver la session ouverte au chargement de la page. */
  chargement: boolean;
  /** null : identifiants incorrects. Rejetée avec le motif d'un refus (verrouillage, compte
   * désactivé, portail fermé). */
  login: (identifierOrEmail: string, password: string) => Promise<User | null>;
  logout: () => void;
  /** À appeler après un changement de mot de passe obligatoire réussi. */
  confirmerMotDePasseChange: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isAuthenticated: false,
  chargement: false,
  login: async () => null,
  logout: () => {},
  confirmerMotDePasseChange: () => {},
});

/** Compte lu sur le serveur → utilisateur de l'application, recopié parmi les comptes locaux pour
 * les écrans pas encore branchés sur la base. */
function utilisateurServeur(compte: CompteServeur): User {
  const user = utilisateurDuCompte(compte);
  refleterCompteServeur({
    id: user.id,
    role: user.role,
    email: user.email,
    identifier: user.identifier,
    displayName: user.name,
    linkedId: user.linkedId,
    roleId: user.roleId,
    actif: compte.actif,
    doitChangerMotDePasse: user.doitChangerMotDePasse,
  });
  return user;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [chargement, setChargement] = useState(modeSupabase);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Mode Supabase : la session est retrouvée auprès du serveur (effet ci-dessous).
    if (modeSupabase) return null;
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
      doitChangerMotDePasse: saved.doitChangerMotDePasse,
    };
  });

  const accounts = useUserAccounts();
  const portalAccess = usePortalAccess();
  useStudentStore(); // souscription : un motif de blocage assigné en direct doit aussi invalider la session
  useMotifsBlocage();
  useRelances(); // idem pour une relance impayé nouvellement expirée

  /** Invalide une session déjà ouverte dès que le compte est désactivé, son portail coupé, ou (pour
   * un étudiant) qu'un motif de blocage interdisant "portail_etudiant" lui est assigné — jusqu'ici,
   * ces coupe-circuits ne bloquaient que les connexions futures, une session déjà ouverte restait
   * valide indéfiniment. Se réévalue à chaque changement (réactif), pas seulement au chargement. */
  useEffect(() => {
    if (modeSupabase || !currentUser) return;
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

  /** Mode Supabase : session retrouvée au chargement, puis revérifiée à chaque renouvellement du
   * jeton (compte désactivé ou portail fermé entre-temps : la session se ferme). La base refuse de
   * toute façon les données à un compte désactivé ou dont le portail est fermé. */
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let monte = true;
    const verifier = async () => {
      try {
        const etat = await compteDeLaSession();
        if (!monte) return;
        if (etat && "compte" in etat) {
          // Données de référence (structure académique…) chargées avant d'ouvrir les écrans.
          try {
            await chargerMiroirs();
          } catch {
            await client.auth.signOut();
            if (monte) setCurrentUser(null);
            return;
          }
          if (!monte) return;
          setCurrentUser(utilisateurServeur(etat.compte));
        } else {
          if (etat) await client.auth.signOut();
          setCurrentUser(null);
        }
      } catch {
        // Réseau momentanément indisponible : on garde l'état courant.
      } finally {
        if (monte) setChargement(false);
      }
    };
    void verifier();
    const { data } = client.auth.onAuthStateChange((evenement) => {
      // Pas d'appel à Supabase directement dans ce rappel (il bloquerait le client) : on diffère.
      if (evenement === "SIGNED_OUT") setCurrentUser(null);
      else if (evenement === "TOKEN_REFRESHED") setTimeout(() => void verifier(), 0);
    });
    return () => {
      monte = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const login = async (identifierOrEmail: string, password: string): Promise<User | null> => {
    if (modeSupabase) {
      const compte = await connecterServeur(identifierOrEmail, password);
      if (!compte) return null;
      try {
        await chargerMiroirs();
      } catch {
        await supabase?.auth.signOut();
        throw new Error(DONNEES_INJOIGNABLES);
      }
      const user = utilisateurServeur(compte);
      setCurrentUser(user);
      return user;
    }

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
      throw new Error("Ce compte a été désactivé. Contactez l'administration de l'établissement.");
    }
    if (account.role === "student" && account.linkedId && estActionInterdite(account.linkedId, "portail_etudiant")) {
      const motif = motifBlocagePortailPour(account.linkedId);
      throw new Error(`Accès au portail bloqué${motif ? ` — motif : ${motif}` : ""}. Contactez l'administration.`);
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
      // Mot de passe provisoire remis par l'administration : il faut en choisir un autre avant
      // d'entrer dans le portail.
      doitChangerMotDePasse: account.doitChangerMotDePasse === true,
    };
    setCurrentUser(user);
    saveAuthSession(user);
    return user;
  };

  const confirmerMotDePasseChange = () => {
    if (!currentUser) return;
    const user = { ...currentUser, doitChangerMotDePasse: false };
    setCurrentUser(user);
    if (modeSupabase) {
      refleterCompteServeur({
        id: user.id, role: user.role, email: user.email, identifier: user.identifier, displayName: user.name,
        linkedId: user.linkedId, roleId: user.roleId, actif: true, doitChangerMotDePasse: false,
      });
    } else {
      saveAuthSession(user);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    arreterMiroirs();
    if (supabase) void supabase.auth.signOut();
    else clearAuthSession();
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: !!currentUser, chargement, login, logout, confirmerMotDePasseChange }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
