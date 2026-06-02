import React from 'react'
import ReactDOM from 'react-dom/client'
import './utils'
import App from './App.tsx'
import './index.css'
import { signalRService } from './services/signalrService'
import { MainResource } from '@MainResource';

const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (favicon) {
  favicon.href = MainResource.Images.ReportLogo;
  favicon.type = 'image/png';
}
// Initialize SignalR connection
signalRService.startConnection(`${import.meta.env.VITE_API_BASE_URL}/notificationHub`)
  .then(() => console.log('SignalR initialized'))
  .catch(console.error);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)