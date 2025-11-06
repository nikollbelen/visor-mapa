import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthResponse {
  success: boolean;
  code: number;
  message: string;
  data: {
    access_token: string;
    token_type: string;
    user: User;
    must_change_password: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  tokenLogin: (tempToken: string) => Promise<boolean>;
  logout: () => void;
  mustChangePassword: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Inicialización: si viene ?token= en la URL, iniciar sesión con token temporal.
  // Si no hay token en URL, restaurar desde localStorage.
  useEffect(() => {
    const initAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const tempToken = url.searchParams.get('token');

        if (tempToken) {
          const success = await tokenLogin(tempToken);
          // Limpiar el query param de la URL por seguridad/UX
          url.searchParams.delete('token');
          window.history.replaceState({}, document.title, url.toString());
          if (success) {
            setIsLoading(false);
            return;
          }
          // Si falla, continuar intentando restaurar desde storage
        }

        const savedToken = localStorage.getItem('auth_token');
        const savedUser = localStorage.getItem('auth_user');
        const savedMustChangePassword = localStorage.getItem('must_change_password');

        if (savedToken && savedUser) {
          try {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            setMustChangePassword(savedMustChangePassword === 'true');
          } catch (error) {
            console.error('Error parsing saved auth data:', error);
            // Limpiar datos corruptos
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            localStorage.removeItem('must_change_password');
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const normalizedBase = apiBaseUrl?.replace(/\/$/, '') || '';
      const response = await fetch(`${normalizedBase}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AuthResponse = await response.json();

      if (data.success && data.data.access_token) {
        const { access_token, user, must_change_password } = data.data;
        
        // Guardar en estado
        setToken(access_token);
        setUser(user);
        setMustChangePassword(must_change_password);

        // Guardar en localStorage
        localStorage.setItem('auth_token', access_token);
        localStorage.setItem('auth_user', JSON.stringify(user));
        localStorage.setItem('must_change_password', must_change_password.toString());

        return true;
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const tokenLogin = async (tempToken: string): Promise<boolean> => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const normalizedBase = apiBaseUrl?.replace(/\/$/, '') || '';
      const pathsToTry = [
        '/users/token-login',
        '/users/token-login/',
        '/auth/token-login',
        '/auth/token-login/'
      ];

      let lastError: any = null;
      for (const path of pathsToTry) {
        try {
          const response = await fetch(`${normalizedBase}${path}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ temp_token: tempToken })
          });

          if (!response.ok) {
            lastError = new Error(`HTTP error! status: ${response.status}`);
            // Si es 405 en variante sin barra, reintentaremos con la siguiente variante
            continue;
          }

          const data: AuthResponse = await response.json();

          if (data.success && data.data.access_token) {
            const { access_token, user, must_change_password } = data.data;

            setToken(access_token);
            setUser(user);
            setMustChangePassword(must_change_password);

            localStorage.setItem('auth_token', access_token);
            localStorage.setItem('auth_user', JSON.stringify(user));
            localStorage.setItem('must_change_password', must_change_password.toString());

            return true;
          } else {
            lastError = new Error(data.message || 'Token login failed');
            continue;
          }
        } catch (innerErr) {
          lastError = innerErr;
        }
      }

      if (lastError) throw lastError;
      return false;
    } catch (error) {
      console.error('Token login error:', error);
      return false;
    }
  };

  const logout = () => {
    // Limpiar estado
    setUser(null);
    setToken(null);
    setMustChangePassword(false);

    // Limpiar localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('must_change_password');
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    tokenLogin,
    logout,
    mustChangePassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
