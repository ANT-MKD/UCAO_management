import { createContext, useContext, useState } from "react";
import {
  authenticateUser,
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  type UserRole,
} from "@/data/studentStore";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  identifier: string;
  linkedId?: string;
  avatar?: string;
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
    };
  });

  const login = (identifierOrEmail: string, password: string): User | null => {
    const account = authenticateUser(identifierOrEmail, password);
    if (!account) return null;
    const user: User = {
      id: account.id,
      name: account.displayName,
      email: account.email,
      role: account.role,
      identifier: account.identifier,
      linkedId: account.linkedId,
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
