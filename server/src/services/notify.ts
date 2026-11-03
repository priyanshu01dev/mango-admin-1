import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';
import { HttpError } from '../lib/errors';

/**
 * Outbound messaging: email (SMTP), WhatsApp (Meta Cloud API templates) and SMS (MSG91 flow, DLT).
 * Each sender throws NOT_CONFIGURED when its keys are missing, so callers can report it instead of
 * pretending a message went out.
 */

export const channels = {
  email: () => !!config.SMTP_HOST,
  whatsapp: () => !!(config.WHATSAPP_TOKEN && config.WHATSAPP_PHONE_NUMBER_ID),
  sms: () => config.SMS_PROVIDER === 'msg91' && !!config.MSG91_AUTH_KEY
};

const notConfigured = (what: string) => new HttpError(503, `${what} is not configured on the server`, 'NOT_CONFIGURED');

let transport: Transporter | null = null;
/** Test hook: replace the SMTP transport. */
export function setMailTransport(t: Transporter | null) {
  transport = t;
}

export async function sendEmail(msg: { to: string; subject: string; html: string; text?: string; attachments?: { filename: string; content: string | Buffer; contentType?: string }[] }) {
  if (!transport) {
    if (!channels.email()) throw notConfigured('Email (SMTP)');
    transport = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined
    });
  }
  const info = await transport.sendMail({ from: config.SMTP_FROM, ...msg });
  return { id: info.messageId as string };
}

/** Meta WhatsApp Cloud API: sends an approved template with body parameters. */
export async function sendWhatsAppTemplate(toPhone: string, template: string, params: string[], language = 'en') {
  if (!channels.whatsapp()) throw notConfigured('WhatsApp Business API');
  const to = toPhone.replace(/\D/g, '').replace(/^(?!91)(\d{10})$/, '91$1');
  const res = await fetch(`https://graph.facebook.com/v20.0/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: template, language: { code: language }, components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }] }
    })
  });
  const body = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) throw new HttpError(502, `WhatsApp: ${body.error?.message ?? res.status}`, 'WHATSAPP_FAILED');
  return { id: body.messages?.[0]?.id ?? '' };
}

/** MSG91 flow API with a DLT-approved template; vars map to ##var## placeholders. */
export async function sendSms(toPhone: string, templateId: string | undefined, vars: Record<string, string>) {
  if (!channels.sms() || !templateId) throw notConfigured('SMS (MSG91 template)');
  const mobile = toPhone.replace(/\D/g, '').replace(/^(?!91)(\d{10})$/, '91$1');
  const res = await fetch('https://control.msg91.com/api/v5/flow', {
    method: 'POST',
    headers: { authkey: config.MSG91_AUTH_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: templateId, short_url: '1', recipients: [{ mobiles: mobile, ...vars }] })
  });
  if (!res.ok) throw new HttpError(502, `SMS failed (${res.status})`, 'SMS_FAILED');
  return { id: '' };
}

export const escapeHtml = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Simple branded email wrapper. */
export const emailLayout = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#fdf6ee;font-family:system-ui,sans-serif;color:#2a1f17">
<div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #ffebd3;border-radius:16px;overflow:hidden">
<div style="background:linear-gradient(90deg,#fbbf24,#f7781b,#e25e0e);color:#fff;padding:16px 20px;font-weight:800;font-size:16px">${escapeHtml(title)}</div>
<div style="padding:20px;font-size:14px;line-height:1.5">${body}</div>
<div style="padding:12px 20px;font-size:11px;color:#a8a29e;border-top:1px solid #ffebd3">Sent with Mango Invoice · Powered by First Wave</div>
</div></body></html>`;
