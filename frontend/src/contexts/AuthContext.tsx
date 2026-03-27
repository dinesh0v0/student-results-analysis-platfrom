import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import api, { registerUnauthorizedHandler } from '../lib/api';

export type Role = 'admin' | 'student' | null;

interface User {
  id: string;
  email: string;
  role: Role;
  institution_id?: string;
  student_id?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'token';
const USER_STORAGE_KEY = 'user';

function clearStoredSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    clearStoredSession();
  }, []);

  const login = useCallback((nextToken: string, userData: User) => {
    setToken(nextToken);
    setUser(userData);
    localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(logout);
    return () => registerUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    let ignore = false;

    const restoreSession = async () => {
      const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!savedToken) {
        if (!ignore) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data } = await api.get('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        if (ignore) {
          return;
        }

        const restoredUser: User = {
          id: data.user_id,
          email: data.email,
          role: data.role,
          institution_id: data.institution_id,
          student_id: data.student_id,
        };

        setToken(savedToken);
        setUser(restoredUser);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(restoredUser));
      } catch {
        if (!ignore) {
          logout();
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      ignore = true;
    };
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
