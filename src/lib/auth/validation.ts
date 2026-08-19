import { z } from 'zod';

/**
 * Password policy: ≥8 chars, at least one uppercase, one lowercase, one digit
 * and one special (non-alphanumeric) character.
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const passwordPolicyMessage =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character.';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(PASSWORD_REGEX, passwordPolicyMessage);

/** Trim + lowercase + basic email sanity check (normalized on write). */
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .transform((v) => v.toLowerCase())
  .pipe(z.string().email('Enter a valid email address'));

/**
 * Normalize an international phone number: keep digits and a leading '+',
 * strip spaces/dashes/parens. Length 8–15 digits (E.164).
 */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned.length > 1 && cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

export const phoneSchema = z
  .string()
  .trim()
  .min(8, 'Enter a valid phone number')
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid phone number'));

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    termsAccepted: z.literal(true, { message: 'You must accept the terms to continue' }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or phone number'),
  password: z.string().min(1, 'Password is required'),
  captchaToken: z.string().optional(),
});

export const otpSendSchema = z.object({ phone: phoneSchema });

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Reset token is required'),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
