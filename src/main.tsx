import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { PublicInvoice } from './components/PublicInvoice';
import './index.css';

// /i/<token> is the customer-facing invoice link (no login)
const publicMatch = window.location.pathname.match(/^\/i\/([A-Za-z0-9_-]{20,40})\/?$/);

createRoot(document.getElementById('root')!).render(publicMatch ? <PublicInvoice token={publicMatch[1]} /> : <App />);
