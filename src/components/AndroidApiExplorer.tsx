import React, { useState } from 'react';
import { Terminal, Play, Copy, Check, Smartphone, Server, Loader2 } from 'lucide-react';

/** The real API the Mango Invoice Android app talks to (backend/src/modules/app/routes.ts). */
interface Endpoint { method: 'GET' | 'POST' | 'PUT' | 'PATCH'; path: string; group: string; desc: string; auth: boolean; body?: object; live?: string }

const ENDPOINTS: Endpoint[] = [
  { method: 'GET', path: '/api/v1/config', group: 'App', desc: 'Maintenance mode, latest/minimum app version, support contact', auth: false, live: '/api/v1/config' },
  { method: 'GET', path: '/api/v1/plans', group: 'App', desc: 'Plans with prices and feature limits', auth: false, live: '/api/v1/plans' },
  { method: 'POST', path: '/api/v1/auth/otp', group: 'Auth', desc: 'Send login OTP to a mobile number', auth: false, body: { phone: '9876543210' } },
  { method: 'POST', path: '/api/v1/auth/verify', group: 'Auth', desc: 'Verify OTP → JWT token + businesses', auth: false, body: { phone: '9876543210', code: '123456', device: 'Samsung M34' } },
  { method: 'GET', path: '/api/v1/me', group: 'Account', desc: 'User, business, plan, subscription, remote config', auth: true },
  { method: 'POST', path: '/api/v1/businesses', group: 'Account', desc: 'Create business at onboarding (starts trial)', auth: true, body: { name: 'Shree Ganesh Traders', gstin: '22AABCS1429B1Z4', state: 'Chhattisgarh' } },
  { method: 'GET', path: '/api/v1/sync', group: 'Sync', desc: 'Download the latest cloud copy of the app data (Snapshot)', auth: true },
  { method: 'PUT', path: '/api/v1/sync', group: 'Sync', desc: 'Upload app data. 409 if another device pushed first', auth: true, body: { baseRevision: 3, snapshot: { business: {}, parties: [], items: [], docs: [] } } },
  { method: 'POST', path: '/api/v1/compliance/irn', group: 'GST', desc: 'Generate e-Invoice IRN via GSP (Platinum)', auth: true, body: { doc: { id: 'd1', type: 'INVOICE', number: 'INV/26-27/0149' } } },
  { method: 'POST', path: '/api/v1/compliance/ewaybill', group: 'GST', desc: 'Generate e-Way bill via GSP (Gold+)', auth: true, body: { doc: { id: 'd1' }, vehicleNo: 'CG04MK2291', distanceKm: 288 } },
  { method: 'POST', path: '/api/v1/compliance/returns', group: 'GST', desc: 'Queue GSTR-1 / GSTR-3B filing', auth: true, body: { form: 'GSTR1', period: '10-2026' } },
  { method: 'POST', path: '/api/v1/subscription/checkout', group: 'Billing', desc: 'Start a plan upgrade (pending payment)', auth: true, body: { planId: 'gold' } },
  { method: 'GET', path: '/api/v1/announcements', group: 'Support', desc: 'Announcements for this business', auth: true },
  { method: 'POST', path: '/api/v1/support/tickets', group: 'Support', desc: 'Raise a support ticket from Help', auth: true, body: { subject: 'Sync issue', category: 'sync', message: '…' } },
  { method: 'POST', path: '/api/v1/staff', group: 'Staff', desc: 'Owner invites staff by phone with per-screen permissions (default none)', auth: true, body: { phone: '9811100001', name: 'Asha', permissions: { attendance: 'view' } } },
  { method: 'POST', path: '/api/v1/attendance/check-in', group: 'Staff', desc: 'Staff check-in with selfie + location (geofenced)', auth: true, body: { selfieFileId: 'fil_…', lat: 19.076, lng: 72.8777, accuracy: 10, deviceTime: '2026-11-06T09:30:00+05:30' } },
  { method: 'POST', path: '/api/v1/location/pings', group: 'Staff', desc: 'Batched location pings while checked in', auth: true, body: { pings: [{ lat: 19.08, lng: 72.88, deviceTime: '2026-11-06T11:00:00+05:30' }] } },
  { method: 'GET', path: '/api/v1/payroll/me', group: 'Staff', desc: 'Payslip JSON for the signed-in staff member (backend/docs/staff-api.md)', auth: true },
  // Called by the app's newer modules (services/FeatureApi.kt). Marked "new" until the backend ships them.
  { method: 'POST', path: '/api/v1/attendance/check-out', group: 'Staff (new)', desc: 'Staff check-out with location', auth: true, body: { staffId: 'st_…', lat: 21.25, lng: 81.63, deviceTime: '2026-11-06T18:30:00+05:30' } },
  { method: 'POST', path: '/api/v1/coins/checkout', group: 'Coins (new)', desc: 'Start a coin-pack payment → { orderId, paymentUrl }', auth: true, body: { packId: 'c500' } },
  { method: 'GET', path: '/api/v1/coins/orders/{id}', group: 'Coins (new)', desc: 'Payment status → { status: "paid", coins }', auth: true },
  { method: 'POST', path: '/api/v1/ai/video-script', group: 'Marketing (new)', desc: 'AI writes promo-video scene captions → { scenes: [] }', auth: true, body: { prompt: 'Diwali sweets sale', business: 'Shree Ganesh Sweets', style: 'Festive' } },
  { method: 'POST', path: '/api/v1/ads/connect', group: 'Marketing (new)', desc: 'OAuth URL to connect Instagram / Facebook / YouTube / Google Ads', auth: true, body: { platform: 'INSTAGRAM' } },
  { method: 'POST', path: '/api/v1/ads/campaigns', group: 'Marketing (new)', desc: 'Publish a paid campaign with the stored platform tokens → { ids }', auth: true, body: { name: 'Diwali offer', objective: 'VISITS', dailyBudget: 200, days: 7, radiusKm: 5, caption: '…', platforms: ['INSTAGRAM', 'FACEBOOK'] } },
  { method: 'POST', path: '/api/v1/licences/applications', group: 'Licences (new)', desc: 'Send an FSSAI / trade licence application to the Mango licence desk → { reference }', auth: true, body: { kind: 'FSSAI', action: 'NEW', category: 'BASIC', holderName: 'Ramesh', premises: '…', years: 1, documents: [] } },
  { method: 'GET', path: '/api/v1/integrations/orders?status=new', group: 'Delivery (new)', desc: 'New Zomato / Swiggy / ONDC orders received from the POS-partner webhook', auth: true },
  { method: 'POST', path: '/api/v1/integrations/orders/{id}/status', group: 'Delivery (new)', desc: 'Accept / ready / delivered / reject an aggregator order', auth: true, body: { status: 'ACCEPTED' } },
];

const KOTLIN = `// MangoInvoice/app/src/main/java/com/firstwave/mangoinvoice/services/ApiServices.kt
// Server address comes from local.properties → mango.apiUrl (BuildConfig.API_BASE_URL)

class ApiAuthService(private val api: ApiClient) : AuthService {
    override suspend fun requestOtp(phone: String) = runCatching {
        api.post("/auth/otp", buildJsonObject { put("phone", phone) }.toString()); Unit
    }
    override suspend fun verifyOtp(phone: String, code: String) = runCatching {
        val r = api.post("/auth/verify", ...).jsonObject
        api.token = r["token"]!!.jsonPrimitive.content
    }
}

// CloudSync: pushes the whole Snapshot 5s after any change, with baseRevision.
// On 409 the user chooses "Restore from cloud" or "Keep this phone's data".
// ApiComplianceService: IRN / e-Way bill results are saved back on the document.`;

const methodColor: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400', POST: 'bg-indigo-500/20 text-indigo-300', PUT: 'bg-amber-500/20 text-amber-300', PATCH: 'bg-amber-500/20 text-amber-300',
};

export const AndroidApiExplorer: React.FC = () => {
  const [sel, setSel] = useState<Endpoint>(ENDPOINTS[0]);
  const [tab, setTab] = useState<'API' | 'KOTLIN'>('API');
  const [resp, setResp] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const origin = window.location.origin;

  const run = async () => {
    if (!sel.live) return;
    setLoading(true);
    try {
      const r = await fetch(sel.live);
      setResp(`HTTP ${r.status}\n\n` + JSON.stringify(await r.json(), null, 2));
    } catch (e) { setResp(String(e)); }
    finally { setLoading(false); }
  };
  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const curl = `curl -X ${sel.method} "${origin}${sel.path}"${sel.auth ? ' -H "Authorization: Bearer <APP_TOKEN>"' : ''}${sel.body ? ` -H "Content-Type: application/json" -d '${JSON.stringify(sel.body)}'` : ''}`;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2"><Terminal className="w-5 h-5 text-emerald-400" /><h2 className="text-xl font-black text-white">Android App API</h2></div>
          <p className="text-slate-400 text-xs mt-0.5">Endpoints the Mango Invoice app uses — served by <span className="font-mono">backend/</span></p>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
          {(['API', 'KOTLIN'] as const).map(k => (
            <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 ${tab === k ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
              {k === 'API' ? <Server className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}<span>{k === 'API' ? 'Endpoints' : 'In the app'}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'API' ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-2 space-y-1 max-h-[640px] overflow-y-auto">
            {ENDPOINTS.map(e => (
              <button key={e.method + e.path} onClick={() => { setSel(e); setResp(''); }}
                className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors ${sel === e ? 'bg-slate-800 border border-slate-700' : 'hover:bg-slate-800/50 border border-transparent'}`}>
                <div className="flex items-center space-x-2">
                  <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${methodColor[e.method]}`}>{e.method}</span>
                  <span className="font-mono text-slate-200 truncate">{e.path}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{e.group} · {e.desc}</div>
              </button>
            ))}
          </div>
          <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${methodColor[sel.method]}`}>{sel.method}</span>
                <span className="font-mono text-white text-sm">{sel.path}</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded ${sel.auth ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>{sel.auth ? 'App JWT required' : 'Public'}</span>
            </div>
            <p className="text-slate-300">{sel.desc}</p>
            {sel.body && (
              <div>
                <div className="text-[10px] text-slate-400 mb-1 uppercase font-bold">Request body</div>
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-emerald-300 overflow-x-auto">{JSON.stringify(sel.body, null, 2)}</pre>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">cURL</span>
                <button onClick={() => copy(curl)} className="text-slate-400 hover:text-white flex items-center space-x-1">{copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}<span>Copy</span></button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">{curl}</pre>
            </div>
            {sel.live && (
              <div>
                <button onClick={run} disabled={loading} className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}<span>Call live server</span>
                </button>
                {resp && <pre className="mt-3 bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 overflow-x-auto max-h-80">{resp}</pre>}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 overflow-x-auto">{KOTLIN}</pre>
        </div>
      )}
    </div>
  );
};
