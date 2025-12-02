import { useEffect, useRef } from 'react';

/**
 * Hook personalizado para manejar la conexión WebSocket y recibir actualizaciones de lotes
 * 
 * Se conecta al WebSocket especificado en VITE_SOCKET_BASE_URL y escucha eventos
 * de tipo "lot_updated". Cuando recibe un evento, actualiza los datos del lote
 * en tiempo real usando la función updateLotFromWebSocket expuesta globalmente.
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 segundos
  const isConnectedRef = useRef(false);
  const isUnmountingRef = useRef(false);

  useEffect(() => {
    const socketBaseUrl = import.meta.env.VITE_SOCKET_BASE_URL;
    
    if (!socketBaseUrl) {
      console.warn('[WebSocket] VITE_SOCKET_BASE_URL no está definida. WebSocket no se conectará.');
      return;
    }

    // Construir la URL del WebSocket
    const wsUrl = `wss://${socketBaseUrl}/lots`;
    
    const connect = () => {
      if (isUnmountingRef.current) return; // No conectar si ya se está desmontando
      
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttempts.current = 0; // Resetear intentos de reconexión
          isConnectedRef.current = true;
          // No loguear conexiones exitosas para reducir ruido en consola
        };

        ws.onmessage = (event) => {
          try {
            const message: any = JSON.parse(event.data);
            
            if (message.type === 'lot_updated' && message.data) {
              // Llamar a la función global para actualizar el lote
              if (window.updateLotFromWebSocket) {
                window.updateLotFromWebSocket(message.data);
              }
              // No loguear cada actualización para reducir ruido
            }
            // No loguear connection_success ni otros mensajes para reducir ruido
          } catch (error) {
            console.error('[WebSocket] Error al parsear mensaje:', error, event.data);
          }
        };

        ws.onerror = () => {
          // Suprimir errores si el componente se está desmontando
          if (isUnmountingRef.current) return;
          
          // Solo loguear errores críticos después de varios intentos
          if (reconnectAttempts.current >= 3) {
            console.warn('[WebSocket] Error persistente en la conexión');
          }
        };

        ws.onclose = (event) => {
          isConnectedRef.current = false;
          
          // Si se está desmontando, no hacer nada
          if (isUnmountingRef.current) return;
          
          // Código 1000 = cierre normal/intencional (no loguear)
          if (event.code === 1000) {
            return; // No intentar reconectar si fue un cierre intencional
          }
          
          // Ignorar código 1006 en el primer intento (normal en React StrictMode)
          if (event.code === 1006 && reconnectAttempts.current === 0) {
            // No loguear ni reconectar inmediatamente - puede ser doble invocación de React
            return;
          }
          
          // Intentar reconectar si no fue un cierre intencional
          if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            
            // Solo loguear después de varios intentos fallidos
            if (reconnectAttempts.current >= 3) {
              console.warn(`[WebSocket] Intentando reconectar (${reconnectAttempts.current}/${maxReconnectAttempts})...`);
            }
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isUnmountingRef.current) {
                connect();
              }
            }, reconnectDelay);
          } else if (reconnectAttempts.current >= maxReconnectAttempts) {
            console.error('[WebSocket] ❌ Máximo de intentos de reconexión alcanzado.');
          }
        };
      } catch (error) {
        console.error('[WebSocket] Error al crear conexión WebSocket:', error);
      }
    };

    // Iniciar conexión
    connect();

    // Cleanup: cerrar conexión y limpiar timeout al desmontar
    return () => {
      isUnmountingRef.current = true;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (wsRef.current) {
        const readyState = wsRef.current.readyState;
        // Solo cerrar si realmente está conectado (OPEN)
        // No cerrar si está en CONNECTING porque puede generar errores en consola
        if (readyState === WebSocket.OPEN) {
          // Suprimir errores al cerrar durante desmontaje
          wsRef.current.onerror = null; // Remover handler de error
          wsRef.current.close(1000, 'Component unmounted');
        } else if (readyState === WebSocket.CONNECTING) {
          // Si está conectando, simplemente remover las referencias
          // El WebSocket se cerrará automáticamente cuando el navegador detecte que no hay listeners
          wsRef.current.onerror = null;
          wsRef.current.onopen = null;
          wsRef.current.onclose = null;
          wsRef.current.onmessage = null;
        }
        wsRef.current = null;
      }
      
      isConnectedRef.current = false;
    };
  }, []); // Solo ejecutar una vez al montar

  return wsRef.current;
}

