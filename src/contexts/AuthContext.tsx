import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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
  
  // Ref para mantener la referencia al token actual sin causar re-renders
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  // Función para verificar el estado de autenticación usando /users/me
  // Esta función sincroniza el estado local con el backend
  const checkAuthStatus = useCallback(async (tokenToCheck: string): Promise<{ isValid: boolean; user?: User }> => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const normalizedBase = apiBaseUrl?.replace(/\/$/, '') || '';
      
      // Crear un AbortController para timeout de 5 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        // Usar /users/me para verificar el estado de autenticación y obtener datos del usuario
        // IMPORTANTE: Usar originalFetch para evitar el interceptor (podría causar bucle)
        const originalFetch = (window as any).__originalFetch || window.fetch;
        const response = await originalFetch(`${normalizedBase}/users/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenToCheck}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Si la respuesta es exitosa, el token es válido y obtenemos los datos del usuario
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            return { isValid: true, user: data.data };
          }
        }
        
        // Si recibimos 401 o 403, el token es inválido o la sesión expiró
        if (response.status === 401 || response.status === 403) {
          return { isValid: false };
        }
        
        // Para otros errores, considerar inválido
        return { isValid: false };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Si es un abort (timeout), considerar el token como inválido por seguridad
        if (fetchError.name === 'AbortError') {
          console.warn('Token validation timeout');
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

  // Función auxiliar para verificar si un token tiene un formato válido
  const isValidTokenFormat = (token: string | null): boolean => {
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    // Verificar que no esté vacío, no sea "null", "undefined", etc.
    const trimmedToken = token.trim();
    if (trimmedToken === '' || 
        trimmedToken === 'null' || 
        trimmedToken === 'undefined' ||
        trimmedToken.length < 10) { // Los JWT suelen ser bastante largos
      return false;
    }
    
    return true;
  };

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

        // Validar que el token tenga un formato válido antes de intentar restaurarlo
        if (savedToken && isValidTokenFormat(savedToken) && savedUser) {
          try {
            // Verificar el estado de autenticación con /users/me (más eficiente y obtiene datos actualizados)
            const { isValid, user: userData } = await checkAuthStatus(savedToken);
            
            if (isValid && userData) {
              // Token válido y sesión activa, restaurar sesión con datos actualizados
              setToken(savedToken);
              setUser(userData);
              // Actualizar localStorage con datos actualizados del usuario
              localStorage.setItem('auth_user', JSON.stringify(userData));
              setMustChangePassword(savedMustChangePassword === 'true');
            } else {
              // Token inválido o sesión cerrada en el backend/dashboard
              console.warn('Token inválido o sesión cerrada, limpiando sesión local');
              localStorage.removeItem('auth_token');
              localStorage.removeItem('auth_user');
              localStorage.removeItem('must_change_password');
            }
          } catch (error) {
            console.error('Error validating or parsing saved auth data:', error);
            // Limpiar datos corruptos o inválidos
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            localStorage.removeItem('must_change_password');
          }
        } else {
          // No hay token válido o formato inválido, asegurarse de limpiar localStorage
          if (savedToken && !isValidTokenFormat(savedToken)) {
            console.warn('Token con formato inválido encontrado, limpiando localStorage');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // checkAuthStatus y tokenLogin son funciones estables definidas con useCallback/function

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

  // Función de logout estable con useCallback para evitar recreaciones
  const logout = useCallback(() => {
    // Limpiar estado
    setUser(null);
    setToken(null);
    setMustChangePassword(false);

    // Limpiar localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('must_change_password');
  }, []);

  // Interceptar respuestas de fetch para detectar tokens inválidos automáticamente
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
          // Usar el ref para verificar el token actual sin causar dependencias
          if (tokenRef.current) {
            // Clonar la respuesta antes de hacer logout
            const clonedResponse = response.clone();
            
            // Hacer logout automáticamente
            console.warn('Token inválido detectado en respuesta de API, cerrando sesión automáticamente');
            
            // Usar setTimeout para evitar problemas de sincronización
            setTimeout(() => {
              logout();
            }, 0);
            
            return clonedResponse;
          }
        }
      }
      
      return response;
    };

    // Limpiar al desmontar - pero solo si no hay otros componentes usando el interceptor
    return () => {
      // No restaurar fetch aquí para evitar conflictos si hay múltiples instancias
      // En su lugar, siempre usar __originalFetch en validaciones
    };
  }, [logout]);

  // Sincronizar cambios de localStorage entre pestañas
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Si se elimina el token en otra pestaña, hacer logout aquí también
      if (e.key === 'auth_token' && !e.newValue && tokenRef.current) {
        console.info('Token eliminado en otra pestaña, cerrando sesión');
        logout();
      }
      
      // Si se actualiza el token en otra pestaña, sincronizar
      if (e.key === 'auth_token' && e.newValue && e.newValue !== tokenRef.current) {
        const newToken = e.newValue;
        const newUser = localStorage.getItem('auth_user');
        const newMustChangePassword = localStorage.getItem('must_change_password');
        
        if (newUser) {
          try {
            setToken(newToken);
            setUser(JSON.parse(newUser));
            setMustChangePassword(newMustChangePassword === 'true');
          } catch (error) {
            console.error('Error sincronizando datos de autenticación:', error);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [logout]);

  // Sincronización inteligente de autenticación con el backend
  // Verifica el estado de autenticación de forma eficiente:
  // 1. Cuando la ventana vuelve a estar activa (usuario regresa)
  // 2. Cuando hay focus en la ventana después de un tiempo
  // 3. Después de interacciones del usuario (opcional)
  useEffect(() => {
    if (!token) return;

    let syncTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastSyncTime = 0;
    const SYNC_COOLDOWN = 10000; // No sincronizar más de una vez cada 10 segundos

    const syncAuthStatus = async () => {
      const currentTime = Date.now();
      // Evitar múltiples sincronizaciones simultáneas
      if (currentTime - lastSyncTime < SYNC_COOLDOWN) {
        return;
      }

      const currentToken = tokenRef.current;
      const savedToken = localStorage.getItem('auth_token');
      
      // Si no hay token actual o el token cambió, no hacer nada
      if (!currentToken || savedToken !== currentToken) return;
      
      lastSyncTime = currentTime;

      // Verificar el estado de autenticación con /users/me
      const { isValid, user: userData } = await checkAuthStatus(currentToken);
      
      if (isValid && userData) {
        // Token válido y obtenemos datos actualizados del usuario
        // Sincronizar datos del usuario por si cambiaron en el backend
        const currentUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
        if (currentUser.id !== userData.id) {
          // El usuario cambió (sesión diferente), actualizar
          setUser(userData);
          localStorage.setItem('auth_user', JSON.stringify(userData));
        }
      } else {
        // Token inválido o sesión cerrada en el backend/dashboard
        console.info('Sesión cerrada en backend o token inválido, cerrando sesión local');
        logout();
      }
    };

    // Sincronizar cuando la ventana vuelve a estar visible (usuario regresa)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Pequeño delay para evitar múltiples llamadas
        syncTimeout = setTimeout(syncAuthStatus, 1000);
      }
    };

    // Sincronizar cuando la ventana recupera el focus
    const handleFocus = () => {
      syncTimeout = setTimeout(syncAuthStatus, 2000);
    };

    // Sincronizar inicialmente después de 5 segundos (dar tiempo a que la app cargue)
    syncTimeout = setTimeout(syncAuthStatus, 5000);

    // Agregar listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [token, logout, checkAuthStatus]);

  // Sincronización adicional: cuando el usuario interactúa después de un tiempo inactivo
  useEffect(() => {
    if (!token) return;

    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    const INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutos de inactividad

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      
      inactivityTimer = setTimeout(async () => {
        // Después de inactividad, verificar estado cuando el usuario vuelva a interactuar
        const syncOnNextInteraction = () => {
          const currentToken = tokenRef.current;
          if (currentToken) {
            checkAuthStatus(currentToken).then(({ isValid }) => {
              if (!isValid) {
                console.info('Sesión expirada por inactividad, cerrando sesión');
                logout();
              }
            });
          }
          // Remover listener después de usarlo
          document.removeEventListener('click', syncOnNextInteraction);
          document.removeEventListener('keydown', syncOnNextInteraction);
        };

        document.addEventListener('click', syncOnNextInteraction, { once: true });
        document.addEventListener('keydown', syncOnNextInteraction, { once: true });
      }, INACTIVITY_THRESHOLD);
    };

    // Resetear timer en interacciones del usuario
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, { passive: true });
    });

    resetInactivityTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [token, logout, checkAuthStatus]);

  // Verificación en tiempo real para detectar cierre de sesión en el dashboard
  useEffect(() => {
    if (!token) return;

    const POLLING_INTERVAL = 2000; // Verificar cada 2 segundos para tiempo real
    let lastCheckTime = 0;
    const CHECK_COOLDOWN = 1000; // No verificar más de una vez cada segundo
    let isChecking = false; // Flag para evitar verificaciones simultáneas

    const checkSessionStatus = async () => {
      const currentTime = Date.now();
      
      // Evitar múltiples verificaciones simultáneas
      if (isChecking || (currentTime - lastCheckTime < CHECK_COOLDOWN)) {
        return;
      }

      const currentToken = tokenRef.current;
      const savedToken = localStorage.getItem('auth_token');
      
      // Si no hay token actual o el token cambió, no hacer nada
      if (!currentToken || savedToken !== currentToken) return;
      
      isChecking = true;
      lastCheckTime = currentTime;

      try {
        // Verificar el estado de autenticación con /users/me
        // Si la sesión fue cerrada en el dashboard, este endpoint retornará 401/403
        const { isValid, user: userData } = await checkAuthStatus(currentToken);
        
        if (isValid && userData) {
          // Sesión sigue activa, actualizar datos del usuario si cambiaron
          const currentUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
          if (currentUser.id !== userData.id) {
            setUser(userData);
            localStorage.setItem('auth_user', JSON.stringify(userData));
          }
        } else {
          // Sesión cerrada en el dashboard o token inválido
          console.info('Sesión cerrada en el dashboard detectada en tiempo real, cerrando sesión local');
          logout();
        }
      } catch (error) {
        console.error('Error verificando estado de sesión:', error);
        // En caso de error de red, no cerrar sesión (podría ser un problema temporal)
      } finally {
        isChecking = false;
      }
    };

    // Verificar inmediatamente y luego periódicamente
    checkSessionStatus();
    const intervalId = setInterval(checkSessionStatus, POLLING_INTERVAL);

    // Verificar también después de interacciones del usuario para detección inmediata
    const handleUserInteraction = () => {
      checkSessionStatus();
    };

    // Agregar listeners para interacciones del usuario
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { passive: true });
    });

    return () => {
      clearInterval(intervalId);
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [token, logout, checkAuthStatus]);

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
