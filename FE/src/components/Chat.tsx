import { useState, useEffect } from 'react';
import { useSignalR } from '../hooks/useSignalR';

interface Message {
  user: string;
  text: string;
  timestamp: Date;
}

export const Chat = () => {
  const { isConnected, error, on, off, invoke } = useSignalR();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [username] = useState('User' + Math.floor(Math.random() * 1000));

  useEffect(() => {
    if (isConnected) {
      // Listen for incoming messages
      on('ReceiveMessage', (user: string, message: string) => {
        setMessages(prev => [...prev, {
          user,
          text: message,
          timestamp: new Date()
        }]);
      });

      // Join chat room
      invoke('JoinRoom', 'general');

      return () => {
        off('ReceiveMessage');
      };
    }
  }, [isConnected, on, off, invoke]);

  const sendMessage = async () => {
    if (messageText.trim() && isConnected) {
      try {
        await invoke('SendMessage', username, messageText);
        setMessageText('');
      } catch (err) {
        console.error('Failed to send message:', err);
      }
    }
  };

  return (
    <div>
      <div>
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        {error && <span> - Error: {error}</span>}
      </div>
      
      <div style={{ height: '300px', overflow: 'auto', border: '1px solid #ccc', padding: '10px' }}>
        {messages.map((msg, index) => (
          <div key={index}>
            <strong>{msg.user}:</strong> {msg.text}
            <small> ({msg.timestamp.toLocaleTimeString()})</small>
          </div>
        ))}
      </div>

      <div>
        <input
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        <button onClick={sendMessage} disabled={!isConnected}>
          Send
        </button>
      </div>
    </div>
  );
};