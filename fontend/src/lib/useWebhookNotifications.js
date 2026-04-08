'use client';
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://auction-api-5lfe.onrender.com/api';

/**
 * Custom hook for receiving live notifications via Server-Sent Events (SSE).
 * This provides a webhook-style live notification system as a fallback/complement to Socket.IO.
 * 
 * @param {Object} options
 * @param {Function} options.onNotification - Callback for general notifications
 * @param {Function} options.onAuctionEnded - Callback when an auction ends (for sellers)
 * @param {Function} options.onAuctionWon - Callback when user wins an auction
 * @param {Function} options.onOutbid - Callback when user is outbid
 * @param {Function} options.onBidPlaced - Callback when bid is placed successfully
 * @param {Function} options.onConnected - Callback when SSE connection is established
 * @param {Function} options.onError - Callback when SSE connection errors
 * @param {boolean} options.enabled - Whether to enable the SSE connection
 */
export function useWebhookNotifications({
  onNotification,
  onAuctionEnded,
  onAuctionWon,
  onOutbid,
  onBidPlaced,
  onConnected,
  onError,
  enabled = true,
} = {}) {
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    try {
      // Get the auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('[SSE] No auth token, skipping connection');
        return;
      }

      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Create EventSource with auth - note: EventSource doesn't support headers directly,
      // so we pass the token as a query parameter
      const url = `${API_URL}/webhooks/live?token=${encodeURIComponent(session.access_token)}`;
      
      // Use fetch with credentials for SSE since EventSource doesn't support custom headers
      const eventSource = new EventSource(url, { withCredentials: false });
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('connected', (event) => {
        console.log('[SSE] Connected:', JSON.parse(event.data));
        reconnectAttempts.current = 0;
        onConnected?.();
      });

      eventSource.addEventListener('ping', () => {
        // Keepalive ping received, connection is healthy
      });

      eventSource.addEventListener('notification', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Notification received:', data);
          onNotification?.(data);
        } catch (e) {
          console.error('[SSE] Failed to parse notification:', e);
        }
      });

      eventSource.addEventListener('auction-ended', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Auction ended:', data);
          onAuctionEnded?.(data);
          onNotification?.(data);
        } catch (e) {
          console.error('[SSE] Failed to parse auction-ended:', e);
        }
      });

      eventSource.addEventListener('auction-won', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Auction won:', data);
          onAuctionWon?.(data);
          onNotification?.(data);
        } catch (e) {
          console.error('[SSE] Failed to parse auction-won:', e);
        }
      });

      eventSource.addEventListener('outbid', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Outbid:', data);
          onOutbid?.(data);
        } catch (e) {
          console.error('[SSE] Failed to parse outbid:', e);
        }
      });

      eventSource.addEventListener('bid-placed', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Bid placed:', data);
          onBidPlaced?.(data);
        } catch (e) {
          console.error('[SSE] Failed to parse bid-placed:', e);
        }
      });

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        eventSource.close();
        eventSourceRef.current = null;
        onError?.(error);

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current);
          reconnectAttempts.current++;
          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          console.log('[SSE] Max reconnect attempts reached');
        }
      };

    } catch (error) {
      console.error('[SSE] Failed to connect:', error);
      onError?.(error);
    }
  }, [onNotification, onAuctionEnded, onAuctionWon, onOutbid, onBidPlaced, onConnected, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    reconnectAttempts.current = 0;
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    connect,
    disconnect,
    isConnected: () => eventSourceRef.current?.readyState === EventSource.OPEN,
  };
}

export default useWebhookNotifications;
