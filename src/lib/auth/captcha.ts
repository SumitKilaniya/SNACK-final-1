/**
 * CAPTCHA verification. Two providers:
 *  - dev: accepts any non-empty token (used when RECAPTCHA_SECRET is unset) —
 *         lets local flows run without Google credentials.
 *  - recaptcha: verifies the token server-side against
 *         https://www.google.com/recaptcha/api/siteverify
 */
export async function verifyCaptcha(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production' && token.length > 0;
  const body = new URLSearchParams({ secret, response: token });
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}
