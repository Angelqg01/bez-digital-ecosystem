
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export interface AgentAlert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  status?: 'pending' | 'resolved' | 'rejected';
  data?: any;
}

export function useAgentAlerts() {
  const [alerts, setAlerts] = useState<AgentAlert[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io('http://localhost:3001');

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to BeZhas Agent Server');
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('alert:new', (newAlert: AgentAlert) => {
      setAlerts(prev => [
        { ...newAlert, status: 'pending' as const }, 
        ...prev
      ].slice(0, 50));
    });

    socketInstance.on('hitl:update', (data: { taskId: string, approved: boolean }) => {
        setAlerts(prev => prev.map(a => 
            a.id === data.taskId ? { ...a, status: data.approved ? 'resolved' : 'rejected' } : a
        ));
    });

    setSocket(socketInstance);

    fetch('http://localhost:3001/api/alerts')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAlerts(data);
      })
      .catch(err => console.error('Error fetching alerts:', err));

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const resolveAlert = async (taskId: string, approved: boolean) => {
    try {
        const res = await fetch(`http://localhost:3001/api/hitl/${taskId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approved, response: 'Confirmed via Dashboard' })
        });
        return await res.json();
    } catch (error) {
        console.error('Error resolving alert:', error);
        return { success: false };
    }
  };

  const clearAlerts = () => setAlerts([]);

  return { alerts, isConnected, resolveAlert, clearAlerts };
}
