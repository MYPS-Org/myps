import { useState, useEffect } from 'react';
import { useSignalR } from '../hooks/useSignalR';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  timestamp: Date;
}

export const Notifications = () => {
  const { isConnected, on, off, invoke } = useSignalR();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (isConnected) {
      on('NotificationReceived', (notification: Notification) => {
        setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
      });

      // Subscribe to notifications for current user
      invoke('SubscribeToNotifications', 'user123');

      return () => {
        off('NotificationReceived');
      };
    }
  }, [isConnected, on, off, invoke]);

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <div>
      <div>Notifications {isConnected ? '🟢' : '🔴'}</div>
      <button onClick={clearNotifications}>Clear All</button>
      
      <div>
        {notifications.map(notif => (
          <div key={notif.id} style={{
            padding: '10px',
            margin: '5px 0',
            backgroundColor: notif.type === 'error' ? '#ffebee' : 
                           notif.type === 'warning' ? '#fff3e0' : '#e3f2fd'
          }}>
            <div>{notif.message}</div>
            <small>{notif.timestamp.toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
};