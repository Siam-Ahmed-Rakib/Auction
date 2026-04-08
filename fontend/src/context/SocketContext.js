'use client';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();
  const socketRef = useRef(null);

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

  // Join user room when user logs in
  useEffect(() => {
    if (socketRef.current && user?.id) {
      console.log('[Socket] Joining user room:', user.id);
      socketRef.current.emit('join-user', user.id);
    }
  }, [user?.id]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
