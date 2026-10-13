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
// Initialize SignalR connections. Same-origin relative paths -- not built from
// VITE_API_BASE_URL -- so a placeholder/misconfigured value in a built bundle can't silently
// break every hub connection the way it did in prod (see MYPS_REPORT_DOWNLOAD_PROD_RCA.md).
// The dev server proxies these paths to VITE_API_BASE_URL itself (vite.config.ts).
signalRService.startConnection('/notificationHub')
  .then(() => console.log('SignalR initialized'))
  .catch(console.error);

signalRService.startConnection('/hubs/import', 'import')
  .then(() => console.log('SignalR (import) initialized'))
  .catch(console.error);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)