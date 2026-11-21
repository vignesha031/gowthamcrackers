/**
 * OTP delivery. SMS_PROVIDER=console prints the OTP in the server log (development);
 * SMS_PROVIDER=msg91 sends a real SMS through MSG91's OTP API (needs a DLT-approved template with a ##OTP## variable).
 */
export async function sendOtpSms(mobile: string, code: string) {
  const provider = process.env.SMS_PROVIDER ?? 'console';
  if (provider === 'msg91') {
    const { MSG91_AUTHKEY: authkey, MSG91_TEMPLATE_ID: template } = process.env;
    if (!authkey || !template) throw new Error('MSG91_AUTHKEY and MSG91_TEMPLATE_ID must be set');
    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.search = new URLSearchParams({ template_id: template, mobile: `91${mobile}`, authkey, otp: code }).toString();
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const body = (await r.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!r.ok || body.type === 'error') throw new Error(`MSG91 failed: ${body.message ?? r.status}`);
    return;
  }
  console.log(`[sms → ${mobile}] Your Gowtham Crackers OTP is ${code}`);
}
export const smsIsReal = () => (process.env.SMS_PROVIDER ?? 'console') !== 'console';
