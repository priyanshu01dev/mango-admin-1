import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { PublicInvoice } from './components/PublicInvoice';
import { LegalPage, LEGAL_PATHS, LegalPath } from './components/legal/LegalPages';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const path = window.location.pathname.replace(/\/$/, '') || '/';
// /i/<token> is the customer-facing invoice link (no login)
const publicMatch = path.match(/^\/i\/([A-Za-z0-9_-]{20,40})$/);
const legal = (LEGAL_PATHS as readonly string[]).includes(path) ? (path as LegalPath) : null;

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>{publicMatch ? <PublicInvoice token={publicMatch[1]} /> : legal ? <LegalPage path={legal} /> : <App />}</ErrorBoundary>
);
