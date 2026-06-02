import { useState, useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';

const useWebSocket = (url, user) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(async () => {
    if (!user || !user.address) return;

    try {
      const ws = new WebSocket(url);
      
      ws.onopen = async () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;

        // Authenticate with the server
        try {
          const message = `Authenticate BeZhas WebSocket ${Date.now()}`;
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const signature = await signer.signMessage(message);

          ws.send(JSON.stringify({
            type: 'authenticate',
            payload: {
              address: user.address,
              signature: signature,
              message: message
            }
          }));
        } catch (authError) {
          console.error('WebSocket authentication error:', authError);
          setConnectionError('Authentication failed');
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'authenticated') {
            console.log('WebSocket authenticated for:', data.address);
          } else if (data.type === 'auth_error') {
            console.error('WebSocket auth error:', data.message);
            setConnectionError(data.message);
          }
          
          // Events will be handled by components that listen to the socket
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setSocket(null);

        // Attempt to reconnect if not a manual close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`Attempting to reconnect in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setConnectionError('Max reconnection attempts reached');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Connection error');
      };

      setSocket(ws);
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnectionError('Failed to create connection');
    }
  }, [url, user]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socket) {
      socket.close(1000, 'Manual disconnect');
    }
    
    setSocket(null);
    setIsConnected(false);
    setConnectionError(null);
    reconnectAttemptsRef.current = 0;
  }, [socket]);

  const sendMessage = useCallback((message) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, [socket, isConnected]);

  const joinRoom = useCallback((roomId) => {
    return sendMessage({
      type: 'join_room',
      payload: { roomId }
    });
  }, [sendMessage]);

  const leaveRoom = useCallback(() => {
    return sendMessage({
      type: 'leave_room',
      payload: {}
    });
  }, [sendMessage]);

  // Connect when user is available
  useEffect(() => {
    if (user && user.address) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Ping to keep connection alive
  useEffect(() => {
    if (isConnected && socket) {
      const pingInterval = setInterval(() => {
        sendMessage({ type: 'ping' });
      }, 30000); // Ping every 30 seconds

      return () => clearInterval(pingInterval);
    }
  }, [isConnected, socket, sendMessage]);

  return {
    socket,
    isConnected,
    connectionError,
    connect,
    disconnect,
    sendMessage,
    joinRoom,
    leaveRoom
  };
};

export default useWebSocket;
