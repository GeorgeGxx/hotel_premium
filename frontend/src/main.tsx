import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';

Sentry.init({
  dsn: import.meta.env.VITE_GLITCHTIP_DSN || undefined,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_RELEASE || 'unknown',
  maxBreadcrumbs: 0,
  tracesSampleRate: 0,
  beforeSend(event) {
    event.request = undefined;
    event.user = undefined;
    event.contexts = undefined;
    event.extra = undefined;
    event.breadcrumbs = [];
    event.message = undefined;
    event.transaction = undefined;
    for (const exception of event.exception?.values ?? []) exception.value = '[redacted]';
    return event;
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
