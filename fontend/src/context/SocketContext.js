'use client';
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

const SocketContext = createContext(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://auction-api-5lfe.onrender.com/api';

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();
  const socketRef = useRef(null);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // SSE connection for webhook-style live notifications
  const connectSSE = useCallback(async () => {
    if (typeof window === 'undefined' || !user?.id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('[SSE] No auth token, skipping connection');
        return;
      }

      // Close existing SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const url = `${API_URL}/webhooks/live?token=${encodeURIComponent(session.access_token)}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('connected', (event) => {
        console.log('[SSE] Connected:', JSON.parse(event.data));
      });

      eventSource.addEventListener('ping', () => {
        // Keepalive - connection is healthy
      });

      // Forward SSE events to socket-like handlers
      eventSource.addEventListener('notification', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Notification:', data);
          // Dispatch custom event for components to listen
          window.dispatchEvent(new CustomEvent('sse-notification', { detail: data }));
        } catch (e) {
          console.error('[SSE] Parse error:', e);
        }
      });

      eventSource.addEventListener('auction-ended', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Auction ended:', data);
          window.dispatchEvent(new CustomEvent('sse-auction-ended', { detail: data }));
          window.dispatchEvent(new CustomEvent('sse-notification', { detail: data }));
        } catch (e) {
          console.error('[SSE] Parse error:', e);
        }
      });

      eventSource.addEventListener('auction-won', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Auction won:', data);
          window.dispatchEvent(new CustomEvent('sse-auction-won', { detail: data }));
          window.dispatchEvent(new CustomEvent('sse-notification', { detail: data }));
        } catch (e) {
          console.error('[SSE] Parse error:', e);
        }
      });

      eventSource.addEventListener('outbid', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Outbid:', data);
          window.dispatchEvent(new CustomEvent('sse-outbid', { detail: data }));
        } catch (e) {
          console.error('[SSE] Parse error:', e);
        }
      });

      eventSource.addEventListener('bid-placed', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Bid placed:', data);
          window.dispatchEvent(new CustomEvent('sse-bid-placed', { detail: data }));
        } catch (e) {
          console.error('[SSE] Parse error:', e);
        }
      });

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        eventSource.close();
        eventSourceRef.current = null;
        
        // Reconnect after 5 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(connectSSE, 5000);
      };

    } catch (error) {
      console.error('[SSE] Failed to connect:', error);
    }
  }, [user?.id]);

  // Create socket connection once
  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://auction-api-5lfe.onrender.com';
    const newSocket = io(WS_URL, { transports: ['websocket', 'polling'] });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    newSocket.on('notification', (data) => {
      console.log('[Socket] Received notification:', data);
    });

    newSocket.on('outbid', (data) => {
      console.log('[Socket] Received outbid:', data);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Join user room when user logs in + connect SSE
  useEffect(() => {
    if (socketRef.current && user?.id) {
      console.log('[Socket] Joining user room:', user.id);
      socketRef.current.emit('join-user', user.id);
    }

    // Also connect SSE for webhook-style notifications
    if (user?.id) {
      connectSSE();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user?.id, connectSSE]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
