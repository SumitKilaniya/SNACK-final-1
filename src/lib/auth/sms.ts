export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

/** Dev provider — prints the OTP to the server log (never enabled in production). */
const consoleProvider: SmsProvider = {
  async send(phone, message) {
    console.log(`[sms:console] → ${phone}: ${message}`);
  },
};

/** Twilio provider using plain fetch (no SDK needed). */
const twilioProvider: SmsProvider = {
  async send(phone, message) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM ?? process.env.TWILIO_PHONE_NUMBER;
    if (!sid || !token || !from) {
      throw new Error('Twilio env vars (TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM) not configured');
    }
    const body = new URLSearchParams({ To: phone, From: from, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) throw new Error(`Twilio error ${res.status}: ${await res.text()}`);
  },
};

export function getSmsProvider(): SmsProvider {
  return process.env.SMS_PROVIDER === 'twilio' ? twilioProvider : consoleProvider;
}
