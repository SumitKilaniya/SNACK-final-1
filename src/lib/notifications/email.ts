export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

/** Dev provider — prints the email to the server log (never used in production). */
const consoleProvider: { send: (m: EmailMessage) => Promise<void> } = {
  async send(message) {
    console.log(`[email:console] → ${message.to}: ${message.subject}`);
  },
};

/** Resend provider using plain fetch (no SDK needed). */
const resendProvider: { send: (m: EmailMessage) => Promise<void> } = {
  async send(message) {
    const key = process.env.RESEND_API_KEY;
    const from =
      process.env.RESEND_FROM ??
      (process.env.NODE_ENV === 'production' ? undefined : 'Snack-Pod <orders@snackpod.local>');
    if (!key || !from) {
      throw new Error('RESEND_API_KEY and RESEND_FROM must be configured for email delivery');
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: message.to, subject: message.subject, html: message.html }),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
  },
};

export function getEmailProvider(): { send: (m: EmailMessage) => Promise<void> } {
  if (process.env.EMAIL_PROVIDER === 'resend') return resendProvider;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Email delivery is not configured for production');
  }
  return consoleProvider;
}
