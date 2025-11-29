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

  useEffect(() => {
    const socketBaseUrl = import.meta.env.VITE_SOCKET_BASE_URL;
    
    if (!socketBaseUrl) {
      console.warn('[WebSocket] VITE_SOCKET_BASE_URL no está definida. WebSocket no se conectará.');
      return;
    }

    // Construir la URL del WebSocket
    const wsUrl = `wss://${socketBaseUrl}/lots`;
    
    const connect = () => {
      // Solo loguear en intentos de reconexión o después del primer intento
      if (reconnectAttempts.current > 0) {
        console.log(`[WebSocket] Intentando conectar a: ${wsUrl}`);
      } else {
        console.log(`[WebSocket] Iniciando conexión WebSocket...`);
      }
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WebSocket] ✅ Conexión establecida');
          reconnectAttempts.current = 0; // Resetear intentos de reconexión
        };

        ws.onmessage = (event) => {
          try {
            const message: any = JSON.parse(event.data);
            
            if (message.type === 'lot_updated' && message.data) {
              console.log('[WebSocket] 📦 Evento lot_updated recibido:', message.data);
              
              // Llamar a la función global para actualizar el lote
              if (window.updateLotFromWebSocket) {
                window.updateLotFromWebSocket(message.data);
              } else {
                console.warn('[WebSocket] updateLotFromWebSocket no está disponible aún. El lote se actualizará cuando Cesium esté listo.');
              }
            } else if (message.type === 'connection_success') {
              // Mensaje de confirmación de conexión del servidor - solo loguear en modo debug
              console.log('[WebSocket] ✅ Conexión confirmada por el servidor');
            } else {
              // Otros tipos de mensajes - loguear solo si es necesario para debug
              console.debug('[WebSocket] Mensaje recibido:', message.type);
            }
          } catch (error) {
            console.error('[WebSocket] Error al parsear mensaje:', error, event.data);
          }
        };

        ws.onerror = () => {
          // Solo loguear errores si la conexión no está cerrada (evitar logs duplicados)
          if (wsRef.current?.readyState !== WebSocket.CLOSED) {
            console.warn('[WebSocket] ⚠️ Error en la conexión (se intentará reconectar)');
          }
        };

        ws.onclose = (event) => {
          // Código 1006 = conexión cerrada inesperadamente (puede ser normal en el primer intento)
          // Código 1000 = cierre normal/intencional
          if (event.code === 1000) {
            console.log('[WebSocket] Conexión cerrada normalmente');
            return; // No intentar reconectar si fue un cierre intencional
          }
          
          // Solo loguear si no es el primer intento o si es un error diferente a 1006
          if (event.code !== 1006 || reconnectAttempts.current > 0) {
            console.log(`[WebSocket] Conexión cerrada (código: ${event.code})`);
          }
          
          // Intentar reconectar si no fue un cierre intencional
          if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            console.log(`[WebSocket] Intentando reconectar (${reconnectAttempts.current}/${maxReconnectAttempts}) en ${reconnectDelay}ms...`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, reconnectDelay);
          } else if (reconnectAttempts.current >= maxReconnectAttempts) {
            console.error('[WebSocket] ❌ Máximo de intentos de reconexión alcanzado. WebSocket no se reconectará.');
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
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, []); // Solo ejecutar una vez al montar

  return wsRef.current;
}

