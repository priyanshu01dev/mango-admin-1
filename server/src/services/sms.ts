import { config } from '../config';
import { HttpError } from '../lib/errors';

/** Sends the login OTP. The "console" provider is for local development only (blocked in production by config). */
export async function sendOtpSms(phone: string, code: string) {
  if (config.SMS_PROVIDER === 'console') {
    if (config.NODE_ENV !== 'test') console.log(`[OTP] ${phone} -> ${code} (console provider, SMS not sent)`);
    return;
  }
  if (!config.MSG91_AUTH_KEY || !config.MSG91_OTP_TEMPLATE_ID) {
    throw new HttpError(503, 'SMS provider is not configured', 'SMS_NOT_CONFIGURED');
  }
  // MSG91 OTP API; the DLT-approved template must contain the ##OTP## variable
  const url = new URL('https://control.msg91.com/api/v5/otp');
  url.searchParams.set('template_id', config.MSG91_OTP_TEMPLATE_ID);
  url.searchParams.set('mobile', phone.replace('+', ''));
  url.searchParams.set('otp', code);
  const res = await fetch(url, { method: 'POST', headers: { authkey: config.MSG91_AUTH_KEY } });
  if (!res.ok) throw new HttpError(502, 'Could not send OTP SMS, please try again', 'SMS_FAILED');
}
