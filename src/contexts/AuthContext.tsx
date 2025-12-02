import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  mustChangePassword: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Función para verificar el estado de autenticación usando /users/me con cookies HTTP-only
  const checkAuthStatus = useCallback(async (): Promise<{ isValid: boolean; user?: User }> => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const normalizedBase = apiBaseUrl?.replace(/\/$/, '') || '';
      
      // Crear un AbortController para timeout de 5 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        // Usar /users/me con credentials: 'include' para verificar cookies HTTP-only
        const response = await fetch(`${normalizedBase}/users/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          credentials: 'include',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Si la respuesta es exitosa, las cookies son válidas y obtenemos los datos del usuario
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            return { isValid: true, user: data.data };
          }
        }
        
        // Si recibimos 401 o 403, las cookies son inválidas o la sesión expiró
        if (response.status === 401 || response.status === 403) {
          return { isValid: false };
        }
        
        // Para otros errores, considerar inválido
        return { isValid: false };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Si es un abort (timeout), considerar como inválido por seguridad
        if (fetchError.name === 'AbortError') {
          console.warn('Auth status check timeout');
          return { isValid: false };
        }
        
        throw fetchError;
      }
    } catch (error) {
      // Si hay un error de red, no cambiar el estado (podría ser un problema de conexión)
      console.error('Error checking auth status:', error);
      return { isValid: false };
    }
  }, []);

  // Inicialización: verificar autenticación con cookies HTTP-only
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Verificar el estado de autenticación con /users/me usando cookies
        const { isValid, user: userData } = await checkAuthStatus();
        
        if (isValid && userData) {
          // Sesión válida, restaurar datos del usuario
          setUser(userData);
          setMustChangePassword(userData.must_change_password || false);
        } else {
          // No hay sesión válida
          setUser(null);
          setMustChangePassword(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setUser(null);
        setMustChangePassword(false);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [checkAuthStatus]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const normalizedBase = apiBaseUrl?.replace(/\/$/, '') || '';
      
      const response = await fetch(`${normalizedBase}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        const { user: userData, must_change_password } = data.data;
        
        // Las cookies HTTP-only se establecen automáticamente por el servidor
        // Solo actualizamos el estado local con los datos del usuario
        setUser(userData);
        setMustChangePassword(must_change_password || false);

        return true;
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  // Función de logout
  const logout = useCallback(async () => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    const normalizedBase = apiBaseUrl?.replace(/\/$/, '') || '';

    if (normalizedBase) {
      console.info('[Auth] Enviando logout al backend...');
      try {
        const response = await fetch(`${normalizedBase}/users/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          credentials: 'include',
          body: JSON.stringify({})
        });
        
        try {
          const data = await response.clone().json();
          console.info('[Auth] Respuesta logout:', data);
        } catch (parseError) {
          console.warn('[Auth] No se pudo parsear la respuesta de logout como JSON.', parseError);
        }
      } catch (error) {
        console.error('Error enviando logout al backend:', error);
      } finally {
        console.info('[Auth] Petición de logout enviada (o intentada).');
      }
    }

    // Limpiar estado local
    setUser(null);
    setMustChangePassword(false);
  }, []);

  // Interceptar respuestas de fetch para detectar sesiones inválidas automáticamente
  useEffect(() => {
    // Guardar la función fetch original solo una vez
    if (!(window as any).__originalFetch) {
      (window as any).__originalFetch = window.fetch;
    }
    
    const originalFetch = (window as any).__originalFetch;
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

    // Sobrescribir fetch para interceptar respuestas
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const response = await originalFetch(...args);
      
      // Si la respuesta es 401 o 403, verificar si es de nuestra API
      if (response.status === 401 || response.status === 403) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        
        // Verificar si la petición es a nuestra API (no hacer logout por errores de otras APIs)
        if (url && apiBaseUrl && url.includes(apiBaseUrl)) {
          // Clonar la respuesta antes de hacer logout
          const clonedResponse = response.clone();
          
          // Hacer logout automáticamente
          console.warn('Sesión inválida detectada en respuesta de API, cerrando sesión automáticamente');
          
          // Usar setTimeout para evitar problemas de sincronización
          setTimeout(() => {
            logout();
          }, 0);
          
          return clonedResponse;
        }
      }
      
      return response;
    };

    // Limpiar al desmontar
    return () => {
      // No restaurar fetch aquí para evitar conflictos si hay múltiples instancias
    };
  }, [logout]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
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
