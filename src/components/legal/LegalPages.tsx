import React from 'react';

/**
 * Public policy pages required for launch (Play Store listing, Razorpay KYC, DPDP Act 2023).
 * Company details come from VITE_* build variables; until they are set every page shows a DRAFT banner.
 * These are templates: have them reviewed by a lawyer / CA before going live.
 */

const env = import.meta.env as Record<string, string | undefined>;
export const COMPANY = {
  name: env.VITE_COMPANY_NAME || '',
  brand: 'Mango Invoice',
  address: env.VITE_COMPANY_ADDRESS || '',
  email: env.VITE_SUPPORT_EMAIL || '',
  phone: env.VITE_SUPPORT_PHONE || '',
  grievanceName: env.VITE_GRIEVANCE_OFFICER || '',
  grievanceEmail: env.VITE_GRIEVANCE_EMAIL || env.VITE_SUPPORT_EMAIL || '',
  city: env.VITE_JURISDICTION_CITY || '',
  updated: env.VITE_POLICY_DATE || '4 November 2026'
};
const missing = !COMPANY.name || !COMPANY.address || !COMPANY.email || !COMPANY.grievanceName;
const v = (s: string, label: string) => s || `[${label}]`;

export const LEGAL_PATHS = ['/privacy', '/terms', '/refund-policy', '/contact', '/delete-account'] as const;
export type LegalPath = (typeof LEGAL_PATHS)[number];

const Shell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-screen bg-cream py-8 px-4">
    <div className="max-w-3xl mx-auto">
      <a href="/" className="flex items-center gap-2 mb-6">
        <img src="/logo.jpeg" alt="" className="w-9 h-9 rounded-xl object-cover" />
        <span className="font-black text-ink">Mango <span className="text-mango-600">Invoice</span></span>
      </a>
      {missing && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xl p-3 mb-4">
          <b>DRAFT.</b> Company details are not filled in yet (VITE_COMPANY_NAME, VITE_COMPANY_ADDRESS, VITE_SUPPORT_EMAIL, VITE_GRIEVANCE_OFFICER). Have this policy reviewed by a lawyer before launch.
        </div>
      )}
      <article className="bg-white border border-mango-100 rounded-2xl p-6 sm:p-8 text-sm text-stone-700 leading-relaxed space-y-4 [&_h2]:text-ink [&_h2]:font-extrabold [&_h2]:text-base [&_h2]:mt-6 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        <h1 className="text-2xl font-black text-ink">{title}</h1>
        <p className="text-xs text-stone-500">Last updated: {COMPANY.updated}</p>
        {children}
      </article>
      <nav className="flex flex-wrap gap-4 justify-center text-xs text-stone-500 mt-6">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/refund-policy">Refunds</a>
        <a href="/contact">Contact & grievances</a>
        <a href="/delete-account">Delete account</a>
      </nav>
    </div>
  </div>
);

const Privacy = () => (
  <Shell title="Privacy Policy">
    <p>{COMPANY.brand} is operated by {v(COMPANY.name, 'Company legal name')}, {v(COMPANY.address, 'registered address')} (“we”). This policy explains what personal data we process when you use the {COMPANY.brand} web app and mobile apps, and your rights under the Digital Personal Data Protection Act, 2023.</p>
    <h2>What we collect</h2>
    <ul>
      <li><b>Account data:</b> your name, mobile number, email and login history.</li>
      <li><b>Business data you enter:</b> business profile, GSTIN, PAN, bank and UPI details, customers, suppliers, items, invoices, purchases, payments and expenses.</li>
      <li><b>Payment data:</b> plan purchases are processed by Razorpay; we receive the payment status and reference, never your full card or UPI PIN.</li>
      <li><b>Technical data:</b> IP address, device and browser type, and logs needed to keep the service secure.</li>
    </ul>
    <h2>Why we use it</h2>
    <ul>
      <li>To provide billing, GST reporting, e-invoice / e-way bill and payment features you ask for.</li>
      <li>To send login OTPs, invoices, payment reminders and service notices on SMS, WhatsApp or email.</li>
      <li>To prevent fraud and abuse, and to meet legal obligations (including GST record-keeping).</li>
    </ul>
    <p>We do not sell personal data and do not use your customers' data for our own marketing.</p>
    <h2>Who we share it with</h2>
    <ul>
      <li>Service providers acting for us: cloud hosting and database (in India), SMS / WhatsApp / email delivery, Razorpay for payments, and a GST Suvidha Provider (GSP) when you generate e-invoices or e-way bills.</li>
      <li>Your customers, when you send them an invoice or payment link.</li>
      <li>Authorities, when required by law.</li>
    </ul>
    <h2>Where and how long</h2>
    <p>Data is stored on servers in India and encrypted in transit. Business books are kept for at least 72 months after the due date of the related annual GST return (Section 36, CGST Act); account data is deleted or anonymised when you delete your account, subject to that retention.</p>
    <h2>Your rights</h2>
    <p>You can access and export your data (Settings → Store Profile → Export), correct it in the app, withdraw consent for optional messages, and delete your account (see <a className="text-mango-700" href="/delete-account">Delete account</a>). You can raise a grievance with our Grievance Officer (below) and, if unresolved, with the Data Protection Board of India.</p>
    <h2>Grievance Officer</h2>
    <p>{v(COMPANY.grievanceName, 'Name')} · {v(COMPANY.grievanceEmail, 'email')} · {v(COMPANY.address, 'address')}. We acknowledge grievances within 24 hours and resolve them within 15 days.</p>
  </Shell>
);

const Terms = () => (
  <Shell title="Terms of Service">
    <p>These terms are an agreement between you and {v(COMPANY.name, 'Company legal name')} for use of {COMPANY.brand}.</p>
    <h2>Your account</h2>
    <ul>
      <li>You must give accurate business and tax details and keep your login secure. Actions taken by members you add to your business are your responsibility.</li>
      <li>You are responsible for the correctness of invoices, tax rates, HSN codes and returns you prepare. {COMPANY.brand} is a tool; it does not replace professional tax advice.</li>
    </ul>
    <h2>e-Invoice, e-way bill and GST</h2>
    <p>IRNs and e-way bills are issued by government systems (IRP / NIC). We pass your data to them or to a GSP on your instruction. Delays or rejections by those systems are outside our control.</p>
    <h2>Plans and payment</h2>
    <ul>
      <li>Paid plans are billed in advance for the chosen period, plus GST. Prices are shown before you pay.</li>
      <li>When a plan or trial ends you move to the Free plan; your data stays available.</li>
      <li>Refunds follow our <a className="text-mango-700" href="/refund-policy">Refund Policy</a>.</li>
    </ul>
    <h2>Acceptable use</h2>
    <p>Do not use the service for fake invoices, tax evasion, spam, or to break any law. We may suspend accounts that do, and may report them where required.</p>
    <h2>Liability</h2>
    <p>The service is provided with reasonable care and skill. To the extent the law allows, our total liability is limited to the fees you paid in the 12 months before the claim.</p>
    <h2>Governing law</h2>
    <p>Indian law applies. Courts at {v(COMPANY.city, 'city')} have jurisdiction.</p>
  </Shell>
);

const Refund = () => (
  <Shell title="Cancellation & Refund Policy">
    <ul>
      <li>You can cancel a paid plan at any time; it stays active until the end of the paid period and is not auto-renewed.</li>
      <li>Within 7 days of your first purchase you can ask for a full refund if you are not satisfied.</li>
      <li>Duplicate or failed-but-charged payments are refunded in full.</li>
      <li>Approved refunds go back to the original payment method within 5–7 working days.</li>
      <li>Usage packs already consumed (e-invoice / e-way bill / message packs) are not refundable.</li>
    </ul>
    <p>Write to {v(COMPANY.email, 'support email')} with your registered mobile number and the payment reference.</p>
  </Shell>
);

const Contact = () => (
  <Shell title="Contact & Grievances">
    <p><b>{v(COMPANY.name, 'Company legal name')}</b><br />{v(COMPANY.address, 'Registered address')}</p>
    <p>Support: {v(COMPANY.email, 'support email')}{COMPANY.phone ? ` · ${COMPANY.phone}` : ''}</p>
    <h2>Grievance Officer</h2>
    <p>{v(COMPANY.grievanceName, 'Name')}<br />{v(COMPANY.grievanceEmail, 'email')}</p>
    <p>Complaints are acknowledged within 24 hours and resolved within 15 days.</p>
  </Shell>
);

const DeleteAccount = () => (
  <Shell title="Delete your account">
    <p>You can delete your {COMPANY.brand} account at any time.</p>
    <h2>In the app</h2>
    <ul>
      <li><b>Staff / CA logins:</b> Settings → Store Profile → <i>Delete my login</i>. Your personal details are removed immediately.</li>
      <li><b>Business owners:</b> Settings → Store Profile → <i>Request deletion</i> for the business first, then delete your login. Download the export before that if you need a copy.</li>
    </ul>
    <h2>Without the app</h2>
    <p>Email {v(COMPANY.email, 'support email')} from your registered email, or with your registered mobile number, with the subject “Delete my account”. We confirm within 7 days.</p>
    <h2>What is kept</h2>
    <p>GST law requires invoices and books to be kept for 72 months. That business data is retained for the remaining period, access-restricted, and then deleted. Login data (name, phone, email) is removed when you delete your login.</p>
  </Shell>
);

export const LegalPage: React.FC<{ path: LegalPath }> = ({ path }) => {
  switch (path) {
    case '/privacy': return <Privacy />;
    case '/terms': return <Terms />;
    case '/refund-policy': return <Refund />;
    case '/contact': return <Contact />;
    default: return <DeleteAccount />;
  }
};

export const LegalLinks: React.FC = () => (
  <div className="flex flex-wrap gap-3 justify-center text-[10px] text-stone-400">
    <a href="/privacy" className="hover:text-ink">Privacy</a>
    <a href="/terms" className="hover:text-ink">Terms</a>
    <a href="/refund-policy" className="hover:text-ink">Refunds</a>
    <a href="/contact" className="hover:text-ink">Contact</a>
  </div>
);
