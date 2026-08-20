'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useAuth } from '@/lib/auth-context';
import * as api from '@/lib/api-client';
import { ApiClientError } from '@/lib/api-client';

/** Pull the server's message out of a failed API call. */
function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

/** True when the login endpoint demands a CAPTCHA we don't offer yet. */
function isCaptchaRequired(err: unknown): boolean {
  return (
    err instanceof ApiClientError &&
    (err.code === 'CAPTCHA_REQUIRED' || err.extra?.captchaRequired === true)
  );
}

type AuthMode = 'signin' | 'signup' | 'phone';

interface CountryCode {
  code: string;
  country: string;
  flag: string;
}

const COUNTRY_CODES: CountryCode[] = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'US / Canada', flag: '🇺🇸' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
];

function AuthContent() {
  // Read NEXT_PUBLIC_* lazily inside the component, never at module scope:
  // a module-level process.env read executes on every import (including SSR
  // at server boot) even before any request arrives. Google OAuth is only
  // offered once a client id is configured; without it the button is hidden
  // entirely (not disabled), so adding the key later needs no code change.
  const googleEnabled = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const { login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams?.get('returnUrl') || '/';

  const [mode, setMode] = useState<AuthMode>('signin');

  // Sign In state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInErrors, setSignInErrors] = useState<{ email?: string; password?: string }>({});

  // Sign Up state
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false);
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [signUpErrors, setSignUpErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});

  // Phone / OTP state
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1);
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Global loading & feedback
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // OTP dev-mode code (only ever returned by the backend outside production)
  const [devCode, setDevCode] = useState<string | null>(null);

  // Forgot password result state
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotDevLink, setForgotDevLink] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState('');

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // OTP inputs refs
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer effect for OTP resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (mode === 'phone' && phoneStep === 2 && resendTimer > 0) {
      setCanResend(false);
      timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [mode, phoneStep, resendTimer]);

  // Validation functions
  const validateEmail = (email: string) => {
    if (!email.trim()) return 'Email address is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return 'Please enter a valid email address';
    return '';
  };

  const validatePassword = (pass: string) => {
    if (!pass) return 'Password is required';
    if (pass.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  // Mirrors the backend's register policy (src/lib/auth/validation.ts) so a
  // weak password fails here with a clear message instead of the server's
  // generic "Validation failed".
  const validateNewPassword = (pass: string) => {
    if (!pass) return 'Password is required';
    if (pass.length < 8) return 'Password must be at least 8 characters';
    if (!/[a-z]/.test(pass)) return 'Password must include a lowercase letter';
    if (!/[A-Z]/.test(pass)) return 'Password must include an uppercase letter';
    if (!/[0-9]/.test(pass)) return 'Password must include a number';
    if (!/[^A-Za-z0-9]/.test(pass)) return 'Password must include a special character';
    return '';
  };

  const validateName = (name: string) => {
    if (!name.trim()) return 'Full name is required';
    if (name.trim().length < 2) return 'Please enter your full name';
    return '';
  };

  const validatePhone = (phone: string) => {
    if (!phone.trim()) return 'Phone number is required';
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return 'Please enter a valid 10-digit phone number';
    return '';
  };

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-stone-200' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass) || /[A-Z]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { score: 2, label: 'Medium', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  const passwordStrength = getPasswordStrength(signUpPassword);

  // Handlers for Sign In
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailErr = validateEmail(signInEmail);
    const passErr = validatePassword(signInPassword);

    if (emailErr || passErr) {
      setSignInErrors({ email: emailErr, password: passErr });
      return;
    }

    setSignInErrors({});
    setFormError(null);
    setIsLoading(true);

    try {
      const loggedUser = await login(signInEmail.trim(), signInPassword);
      const targetUrl =
        returnUrl !== '/'
          ? returnUrl
          : loggedUser.role === 'SUPER_ADMIN' || loggedUser.role === 'BRANCH_ADMIN'
          ? '/admin'
          : '/';
      setSuccessMessage('Successfully signed in! Welcome back to Snack-Pod 🍔');
      setTimeout(() => router.push(targetUrl), 600);
    } catch (err) {
      // The backend asks for a CAPTCHA after repeated failures; there is no
      // CAPTCHA widget yet, so surface a clear message instead of silently
      // failing (never send a fake captchaToken to bypass it).
      if (isCaptchaRequired(err)) {
        setFormError('Too many attempts — please wait a few minutes and try again');
      } else {
        setFormError(apiErrorMessage(err, 'Invalid credentials'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers for Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateName(signUpName);
    const emailErr = validateEmail(signUpEmail);
    const passErr = validateNewPassword(signUpPassword);
    const termsErr = !agreeTerms ? 'You must agree to the Terms of Service' : '';

    const phoneErr = validatePhone(signUpPhone);
    const confirmErr =
      signUpConfirmPassword && signUpPassword !== signUpConfirmPassword
        ? 'Passwords do not match'
        : '';

    if (nameErr || emailErr || passErr || phoneErr || confirmErr || termsErr) {
      setSignUpErrors({
        name: nameErr,
        email: emailErr,
        password: passErr,
        phone: phoneErr,
        confirmPassword: confirmErr,
        terms: termsErr,
      });
      return;
    }

    setSignUpErrors({});
    setFormError(null);
    setIsLoading(true);

    try {
      await register({
        name: signUpName.trim(),
        email: signUpEmail.trim(),
        phone: `${countryCode}${signUpPhone}`,
        password: signUpPassword,
        confirmPassword: signUpConfirmPassword,
        termsAccepted: true,
      });
      setSuccessMessage('Account created successfully! Welcome to Snack-Pod 🎉');
      setTimeout(() => router.push(returnUrl), 600);
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not create your account. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };


  // Handlers for Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validatePhone(phoneNumber);
    if (err) {
      setPhoneError(err);
      return;
    }

    setPhoneError('');
    setOtpError('');
    setFormError(null);
    setIsLoading(true);

    try {
      const result = await api.otpSend(`${countryCode}${phoneNumber}`);
      // DEV ONLY: the backend returns the code here when no SMS provider is
      // configured (never in production) so the flow is testable locally.
      setDevCode(result.devCode ?? null);
      setPhoneStep(2);
      setResendTimer(30);
      setOtp(['', '', '', '', '', '']);
      // Focus first OTP field
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (sendErr) {
      setPhoneError(apiErrorMessage(sendErr, 'Could not send the code. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers for Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      setOtpError('Please enter the complete 6-digit verification code');
      return;
    }

    setOtpError('');
    setFormError(null);
    setIsLoading(true);

    try {
      await api.otpVerify(`${countryCode}${phoneNumber}`, otpCode);
      // The backend marks the phone verified but does not create a session
      // here — the user signs in afterwards with their phone + password.
      setDevCode(null);
      setSuccessMessage('Phone number verified! Sign in with your phone number to continue.');
      setMode('signin');
      // Prefill the identifier with the normalized phone (what the login
      // route stores/accepts, e.g. +919876543210).
      setSignInEmail(`${countryCode}${phoneNumber}`);
    } catch (verifyErr) {
      setOtpError(apiErrorMessage(verifyErr, 'Invalid or expired code'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP digit entry
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    // If user pasted a multi-digit string
    if (value.length > 1) {
      const pastedDigits = value.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedDigits[i] || '';
      }
      setOtp(newOtp);
      const nextIndex = Math.min(pastedDigits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    // Auto advance focus
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Resend OTP trigger — calls the real endpoint again (the backend enforces
  // its own resend cooldown server-side).
  const handleResendOtp = async () => {
    if (!canResend) return;
    setOtpError('');
    setFormError(null);
    setIsLoading(true);
    try {
      const result = await api.otpSend(`${countryCode}${phoneNumber}`);
      setDevCode(result.devCode ?? null);
      setResendTimer(30);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } catch (sendErr) {
      setOtpError(apiErrorMessage(sendErr, 'Please wait a moment before requesting another code.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password handler — real endpoint; never reveals whether an
  // account exists (the server always returns the same generic message).
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(forgotEmail);
    if (err) return;
    setForgotError('');
    setIsLoading(true);
    try {
      const result = await api.forgotPassword(forgotEmail.trim());
      setForgotMessage(result.message);
      // DEV ONLY: the backend only includes devLink outside production.
      setForgotDevLink(result.devLink ?? null);
      setForgotSuccess(true);
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotSuccess(false);
        setForgotMessage('');
        setForgotDevLink(null);
        setForgotEmail('');
      }, 5000);
    } catch (forgotErr) {
      setForgotError(apiErrorMessage(forgotErr, 'Could not send the reset link. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF7F2] text-[#221A15] font-sans antialiased flex flex-col justify-between selection:bg-[#E25822]/20 selection:text-[#E25822]">
      {/* Top Header Bar for easy back navigation */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-stone-200/60 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <Link
          href="/"
          className="flex items-center gap-2.5 group transition-transform duration-200 hover:scale-105"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E25822] to-amber-500 flex items-center justify-center shadow-md shadow-[#E25822]/20">
            <span className="text-white font-black text-lg">S</span>
          </div>
          <span className="font-black text-xl tracking-tight text-[#221A15]">
            Snack<span className="text-[#E25822]">-Pod</span>
          </span>
        </Link>

        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-[#E25822] bg-stone-100 hover:bg-orange-50 px-3.5 py-2 rounded-full transition-all"
        >
          <Icon name="ArrowLeftIcon" size={14} />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Main Container - Split screen on desktop */}
      <main className="flex-1 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-65px)]">
        {/* Left Panel: Food Image & Branding Showcase (Desktop only) */}
        <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 relative p-8 xl:p-12 flex-col justify-between overflow-hidden bg-stone-900 rounded-2xl my-4 ml-4 shadow-2xl">
          {/* Background image with warm gradient overlay */}
          <div className="absolute inset-0 z-0">
            <AppImage
              src="/images/auth/auth_banner_1.webp"
              alt="Delicious Indian & Western delicacies"
              width={1200}
              height={900}
              className="w-full h-full object-cover opacity-45 scale-105 hover:scale-100 transition-transform duration-1000 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/60 to-stone-900/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-transparent to-transparent" />
          </div>

          {/* Top tagline badge */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 text-white text-xs font-semibold">
              <span className="text-amber-400">🔥</span>
              <span>Fastest Food Delivery in Town</span>
            </div>
          </div>

          {/* Center Brand Text & Value Props */}
          <div className="relative z-10 max-w-lg mt-auto mb-10 space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl xl:text-5xl font-black text-white leading-tight tracking-tight">
                Satisfy your cravings in <span className="text-amber-400">30 minutes.</span>
              </h1>
              <p className="text-stone-300 text-sm xl:text-base leading-relaxed">
                Join over 50,000+ foodies in Bangalore. Order hot burgers, aromatic biryanis, crispy
                fries, and artisan desserts made fresh to order.
              </p>
            </div>

            {/* Feature Badges */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 text-center">
                <span className="text-xl block mb-1">⚡</span>
                <p className="text-white text-xs font-bold">30-Min Express</p>
                <p className="text-stone-400 text-[10px]">Hot &amp; Fresh</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 text-center">
                <span className="text-xl block mb-1">⭐</span>
                <p className="text-white text-xs font-bold">4.8★ Rating</p>
                <p className="text-stone-400 text-[10px]">50,000+ Reviews</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 text-center">
                <span className="text-xl block mb-1">🎁</span>
                <p className="text-white text-xs font-bold">Daily Deals</p>
                <p className="text-stone-400 text-[10px]">Save up to 40%</p>
              </div>
            </div>
          </div>

          {/* Social Proof Testimonial */}
          <div className="relative z-10 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 flex items-center gap-3 max-w-md">
            <div className="w-10 h-10 rounded-full bg-amber-400 text-stone-950 font-bold flex items-center justify-center shrink-0">
              RK
            </div>
            <div>
              <p className="text-white text-xs font-medium italic">
                &ldquo;Snack-Pod is hands down the fastest delivery in HSR Layout. The burgers
                arrive steaming hot every single time!&rdquo;
              </p>
              <p className="text-stone-400 text-[11px] font-semibold mt-0.5">
                — Rahul K., Koramangala
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel: Auth Form */}
        <div className="lg:col-span-6 xl:col-span-5 flex items-center justify-center p-4 sm:p-8 lg:p-12 my-auto w-full">
          <div className="w-full max-w-[420px] mx-auto bg-white rounded-2xl p-6 sm:p-8 shadow-xl shadow-stone-900/5 border border-stone-200/80 transition-all duration-300">
            {/* Mobile Header Banner */}
            <div className="lg:hidden text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#E25822]/10 text-[#E25822] mb-3">
                <span className="text-2xl font-black">🍔</span>
              </div>
              <h2 className="text-xl font-black text-[#221A15]">Welcome to Snack-Pod</h2>
              <p className="text-xs text-stone-500 mt-1">Order your favourite meals in seconds</p>
            </div>

            {/* Success Feedback Alert */}
            {successMessage && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 animate-fadeIn">
                <span className="text-xl shrink-0">🎉</span>
                <div className="flex-1">
                  <p className="text-xs font-bold text-emerald-900">{successMessage}</p>
                  <p className="text-[11px] text-emerald-700/80 mt-0.5">Redirecting to menu...</p>
                </div>
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Server / API Error Alert */}
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 animate-fadeIn">
                <span className="text-base shrink-0">⚠️</span>
                <p className="text-xs font-semibold text-red-700 leading-relaxed">{formError}</p>
              </div>
            )}

            {/* Auth Mode Control Bar (Tabs) */}
            {mode !== 'phone' && (
              <div className="relative p-1 bg-stone-100 rounded-xl mb-6 grid grid-cols-2 gap-1 border border-stone-200/60">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setSignInErrors({});
                    setFormError(null);
                  }}
                  className={`py-2.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    mode === 'signin'
                      ? 'bg-white text-[#221A15] shadow-sm font-extrabold'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setSignUpErrors({});
                    setFormError(null);
                  }}
                  className={`py-2.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    mode === 'signup'
                      ? 'bg-white text-[#221A15] shadow-sm font-extrabold'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <span>Sign Up</span>
                </button>
              </div>
            )}

            {/* ── MODE 1: SIGN IN TAB ──────────────────────────────────────── */}
            {mode === 'signin' && (
              <div className="space-y-5 animate-fadeIn">
                <div>
                  <h3 className="text-2xl font-black text-[#221A15] tracking-tight">
                    Welcome back
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Sign in with your email or phone number to continue.
                  </p>
                </div>

                <form onSubmit={handleEmailSignIn} className="space-y-4" noValidate>
                  {/* Email Field */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Email address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Icon name="EnvelopeIcon" size={16} />
                      </div>
                      <input
                        type="email"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        onBlur={() =>
                          setSignInErrors((prev) => ({
                            ...prev,
                            email: validateEmail(signInEmail),
                          }))
                        }
                        placeholder="you@example.com"
                        className={`w-full pl-10 pr-4 py-3 bg-stone-50/50 border rounded-xl text-sm outline-none transition-all placeholder:text-stone-400 text-[#221A15] ${
                          signInErrors.email
                            ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                            : 'border-stone-200 focus:border-[#E25822] focus:ring-4 focus:ring-[#E25822]/10 bg-white'
                        }`}
                      />
                    </div>
                    {signInErrors.email && (
                      <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <span>⚠️</span> {signInErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-stone-700">Password</label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="text-xs font-bold text-[#E25822] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Icon name="LockClosedIcon" size={16} />
                      </div>
                      <input
                        type={showSignInPassword ? 'text' : 'password'}
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        onBlur={() =>
                          setSignInErrors((prev) => ({
                            ...prev,
                            password: validatePassword(signInPassword),
                          }))
                        }
                        placeholder="••••••••"
                        className={`w-full pl-10 pr-11 py-3 bg-stone-50/50 border rounded-xl text-sm outline-none transition-all placeholder:text-stone-400 text-[#221A15] ${
                          signInErrors.password
                            ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                            : 'border-stone-200 focus:border-[#E25822] focus:ring-4 focus:ring-[#E25822]/10 bg-white'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignInPassword(!showSignInPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 transition-colors"
                        aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                      >
                        <Icon name={showSignInPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={18} />
                      </button>
                    </div>
                    {signInErrors.password && (
                      <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <span>⚠️</span> {signInErrors.password}
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 bg-[#E25822] hover:bg-[#C94816] active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-[#E25822]/25 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-stone-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-stone-400 font-semibold tracking-wider">
                      or
                    </span>
                  </div>
                </div>

                {/* Social Google Auth — hidden entirely until a client id exists */}
                {googleEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      // Real OAuth: the backend issues the state cookie and
                      // redirects to Google's consent screen.
                      window.location.href = '/api/auth/google';
                    }}
                    disabled={isLoading}
                    className="w-full py-3 px-4 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 font-bold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.99] disabled:opacity-70"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                )}

                {/* Alternative Phone Link */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('phone');
                      setPhoneStep(1);
                    }}
                    className="text-xs font-bold text-[#E25822] hover:underline inline-flex items-center gap-1.5"
                  >
                    <span>📱 Continue with phone number instead</span>
                  </button>
                </div>

                {/* Footer Switch */}
                <p className="text-center text-xs text-stone-500 pt-2 border-t border-stone-100">
                  New here?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="font-extrabold text-[#221A15] hover:text-[#E25822] hover:underline ml-0.5"
                  >
                    Create an account
                  </button>
                </p>
              </div>
            )}

            {/* ── MODE 2: SIGN UP TAB ──────────────────────────────────────── */}
            {mode === 'signup' && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <h3 className="text-2xl font-black text-[#221A15] tracking-tight">
                    Create an account
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Sign up to order food, track deliveries, and unlock exclusive deals.
                  </p>
                </div>

                <form onSubmit={handleSignUp} className="space-y-3.5" noValidate>
                  {/* Name Field */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Full Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Icon name="UserIcon" size={16} />
                      </div>
                      <input
                        type="text"
                        value={signUpName}
                        onChange={(e) => setSignUpName(e.target.value)}
                        onBlur={() =>
                          setSignUpErrors((prev) => ({
                            ...prev,
                            name: validateName(signUpName),
                          }))
                        }
                        placeholder="John Doe"
                        className={`w-full pl-10 pr-4 py-2.5 bg-stone-50/50 border rounded-xl text-sm outline-none transition-all placeholder:text-stone-400 text-[#221A15] ${
                          signUpErrors.name
                            ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                            : 'border-stone-200 focus:border-[#E25822] focus:ring-4 focus:ring-[#E25822]/10 bg-white'
                        }`}
                      />
                    </div>
                    {signUpErrors.name && (
                      <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <span>⚠️</span> {signUpErrors.name}
                      </p>
                    )}
                  </div>

                  {/* Email Field */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Email address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Icon name="EnvelopeIcon" size={16} />
                      </div>
                      <input
                        type="email"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        onBlur={() =>
                          setSignUpErrors((prev) => ({
                            ...prev,
                            email: validateEmail(signUpEmail),
                          }))
                        }
                        placeholder="you@example.com"
                        className={`w-full pl-10 pr-4 py-2.5 bg-stone-50/50 border rounded-xl text-sm outline-none transition-all placeholder:text-stone-400 text-[#221A15] ${
                          signUpErrors.email
                            ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                            : 'border-stone-200 focus:border-[#E25822] focus:ring-4 focus:ring-[#E25822]/10 bg-white'
                        }`}
                      />
                    </div>
                    {signUpErrors.email && (
                      <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <span>⚠️</span> {signUpErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Mobile Number Field (required by the register API) */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Mobile Number
                    </label>
                    <div className="flex gap-2">
                      <div className="relative shrink-0">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="appearance-none h-11 pl-3 pr-7 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-[#221A15] outline-none focus:border-[#E25822] focus:ring-4 focus:ring-[#E25822]/10 cursor-pointer"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.code}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-stone-400">
                          <Icon name="ChevronDownIcon" size={14} />
                        </div>
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="tel"
                          value={signUpPhone}
                          onChange={(e) =>
                            setSignUpPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                          }
                          onBlur={() =>
                            setSignUpErrors((prev) => ({
                              ...prev,
                              phone: validatePhone(signUpPhone),
                            }))
                          }
                          placeholder="98765 43210"
                          className={`w-full h-11 px-4 bg-stone-50/50 border rounded-xl text-sm font-semibold outline-none transition-all placeholder:text-stone-400 text-[#221A15] ${
                            signUpErrors.phone
                              ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                              : 'border-stone-200 focus:border-[#E25822] focus:ring-4 focus:ring-[#E25822]/10 bg-white'
                          }`}
                        />
                      </div>
                    </div>
                    {signUpErrors.phone && (
                      <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <span>⚠️</span> {signUpErrors.phone}
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Icon name="LockClosedIcon" size={16} />
                      </div>
                      <input
                        type={showSignUpPassword ? 'text' : 'password'}
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        onBlur={() =>
                          setSignUpErrors((prev) => ({
                            ...prev,
                            password: validateNewPassword(signUpPassword),
                          }))
                        }
                        placeholder="At least 6 characters"
                        className={`w-full pl-10 pr-11 py-2.5 bg-stone-50/50 border rounded-xl text-sm outline-none transition-all placeholder:text-stone-400 text-[#221A15] ${
                          signUpErrors.password
                            ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                            : 'border-stone-200 focus:border-[#E25822] focus:ring-4 focus:ring-[#E25822]/10 bg-white'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 transition-colors"
                        aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                      >
                        <Icon name={showSignUpPassword ? 'EyeSlashIcon' : 'EyeIcon'} size={18} />
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {signUpPassword.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-stone-500 font-medium">Password strength:</span>
                          <span
                            className={`font-bold ${
                              passwordStrength.score === 1
                                ? 'text-red-500'
                                : passwordStrength.score === 2
                                  ? 'text-amber-600'
                                  : 'text-emerald-600'
                            }`}
                          >
                            {passwordStrength.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 h-1.5">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              passwordStrength.score >= 1 ? passwordStrength.color : 'bg-stone-200'
                            }`}
                          />
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              passwordStrength.score >= 2 ? passwordStrength.color : 'bg-stone-200'
                            }`}
                          />
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              passwordStrength.score >= 3 ? passwordStrength.color : 'bg-stone-200'
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    {signUpErrors.password && (
                      <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <span>⚠️</span> {signUpErrors.password}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Icon name="LockClosedIcon" size={16} />
                      </div>
                      <input
                        type={showSignUpConfirmPassword ? 'text' : 'password'}
                        value={signUpConfirmPassword}
                        onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                        onBlur={() =>
                          setSignUpErrors((prev) => ({
                            ...prev,
                            confirmPassword:
                              signUpPassword !== signUpConfirmPassword
                                ? 'Passwords do not match'
                                : '',
                          }))
                        }
                        placeholder="Re-enter your password"
                        className={`w-full pl-10 pr-11 py-2.5 bg-stone-50/50 border rounded-xl text-sm outline-none transition-all placeholder:text-stone-400 text-[#221A15] ${
                          signUpErrors.confirmPassword
                            ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                            : 'border-stone-200 focus:border-[#E25822] focus:ring-4 focus:ring-[#E25822]/10 bg-white'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpConfirmPassword(!showSignUpConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 transition-colors"
                        aria-label={showSignUpConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        <Icon
                          name={showSignUpConfirmPassword ? 'EyeSlashIcon' : 'EyeIcon'}
                          size={18}
                        />
                      </button>
                    </div>
                    {signUpErrors.confirmPassword && (
                      <p className="text-red-500 text-[11px] font-semibold mt-1 flex items-center gap-1">
                        <span>⚠️</span> {signUpErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  {/* Terms & Conditions Checkbox */}
                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => {
                          setAgreeTerms(e.target.checked);
                          if (e.target.checked) {
                            setSignUpErrors((prev) => ({ ...prev, terms: '' }));
                          }
                        }}
                        className="mt-0.5 w-4 h-4 text-[#E25822] rounded border-stone-300 focus:ring-[#E25822] focus:ring-offset-0 accent-[#E25822]"
                      />
                      <span className="text-xs text-stone-600 leading-normal">
                        I agree to the{' '}
                        <Link
                          href="/terms"
                          target="_blank"
                          className="text-[#E25822] font-bold hover:underline"
                        >
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link
                          href="/privacy"
                          target="_blank"
                          className="text-[#E25822] font-bold hover:underline"
                        >
                          Privacy Policy
                        </Link>
                        .
                      </span>
                    </label>
                    {signUpErrors.terms && (
                      <p className="text-red-500 text-[11px] font-semibold mt-1">
                        {signUpErrors.terms}
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-4 bg-[#E25822] hover:bg-[#C94816] active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-[#E25822]/25 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Creating account...</span>
                      </>
                    ) : (
                      <span>Create Account</span>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-stone-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-stone-400 font-semibold tracking-wider">
                      or
                    </span>
                  </div>
                </div>

                {/* Google Auth — hidden entirely until a client id exists */}
                {googleEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = '/api/auth/google';
                    }}
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 font-bold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.99]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Sign up with Google</span>
                  </button>
                )}

                {/* Alternative Phone Link */}
                <div className="text-center pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('phone');
                      setPhoneStep(1);
                    }}
                    className="text-xs font-bold text-[#E25822] hover:underline inline-flex items-center gap-1.5"
                  >
                    <span>📱 Sign up with phone number instead</span>
                  </button>
                </div>

                {/* Footer Switch */}
                <p className="text-center text-xs text-stone-500 pt-2 border-t border-stone-100">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signin')}
                    className="font-extrabold text-[#221A15] hover:text-[#E25822] hover:underline ml-0.5"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            )}

            {/* ── MODE 3: PHONE / OTP FLOW ──────────────────────────────────── */}
            {mode === 'phone' && (
              <div className="space-y-5 animate-fadeIn">
                {/* Back button */}
                <button
                  type="button"
                  onClick={() => {
                    if (phoneStep === 2) {
                      setPhoneStep(1);
                      setDevCode(null);
                    } else {
                      setMode('signin');
                      setFormError(null);
                    }
                  }}
                  className="text-xs font-bold text-stone-500 hover:text-[#221A15] flex items-center gap-1 transition-colors"
                >
                  <Icon name="ArrowLeftIcon" size={14} />
                  <span>{phoneStep === 2 ? 'Change phone number' : 'Back to email sign in'}</span>
                </button>

                {/* STEP 1: Enter Phone Number */}
                {phoneStep === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-2xl font-black text-[#221A15] tracking-tight">
                        Sign in with Phone
                      </h3>
                      <p className="text-xs text-stone-500 mt-1">
                        We&apos;ll send a 6-digit verification code to your mobile number.
                      </p>
                    </div>

                    <form onSubmit={handleSendOtp} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1.5">
                          Mobile Number
                        </label>
                        <div className="flex gap-2">
                          {/* Country Code Selector */}
                          <div className="relative shrink-0">
                            <select
                              value={countryCode}
                              onChange={(e) => setCountryCode(e.target.value)}
                              className="appearance-none h-12 pl-3 pr-7 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-[#221A15] outline-none focus:border-[#E25822] focus:ring-4 focus:ring-[#E25822]/10 cursor-pointer"
                            >
                              {COUNTRY_CODES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.flag} {c.code}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-stone-400">
                              <Icon name="ChevronDownIcon" size={14} />
                            </div>
                          </div>

                          {/* Phone Input */}
                          <div className="relative flex-1">
                            <input
                              type="tel"
                              value={phoneNumber}
                              onChange={(e) =>
                                setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))
                              }
                              placeholder="98765 43210"
                              className={`w-full h-12 px-4 bg-stone-50/50 border rounded-xl text-sm font-semibold outline-none transition-all placeholder:text-stone-400 text-[#221A15] ${
                                phoneError
                                  ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                                  : 'border-stone-200 focus:border-[#E25822] focus:ring-4 focus:ring-[#E25822]/10 bg-white'
                              }`}
                            />
                          </div>
                        </div>
                        {phoneError && (
                          <p className="text-red-500 text-[11px] font-semibold mt-1.5 flex items-center gap-1">
                            <span>⚠️</span> {phoneError}
                          </p>
                        )}
                      </div>

                      {/* Send OTP Button */}
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3.5 px-4 bg-[#E25822] hover:bg-[#C94816] active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-[#E25822]/25 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Sending OTP...</span>
                          </>
                        ) : (
                          <span>Send Verification Code</span>
                        )}
                      </button>
                    </form>

                    <p className="text-center text-xs text-stone-500 pt-2 border-t border-stone-100">
                      Prefer standard login?{' '}
                      <button
                        type="button"
                        onClick={() => setMode('signin')}
                        className="font-extrabold text-[#221A15] hover:text-[#E25822] hover:underline"
                      >
                        Use Email &amp; Password
                      </button>
                    </p>
                  </div>
                )}

                {/* STEP 2: Enter 6-Digit OTP */}
                {phoneStep === 2 && (
                  <div className="space-y-5">
                    {/* DEV MODE — the backend echoes the code when no SMS
                        provider is configured; it can never appear in
                        production (server-gated by NODE_ENV). */}
                    {devCode && (
                      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-center space-y-1 animate-fadeIn">
                        <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">
                          DEV MODE — not sent via SMS
                        </p>
                        <p className="text-2xl font-mono font-black text-amber-800 tracking-[0.35em]">
                          {devCode}
                        </p>
                        <p className="text-[10px] text-amber-700 font-semibold">
                          Enter this code below to test the flow locally.
                        </p>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black text-[#221A15] tracking-tight">
                          Enter OTP Code
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setPhoneStep(1);
                            setDevCode(null);
                          }}
                          className="text-xs font-bold text-[#E25822] hover:underline flex items-center gap-1"
                        >
                          <span>Edit</span>
                          <Icon name="PencilIcon" size={12} />
                        </button>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">
                        Code sent to{' '}
                        <span className="font-bold text-[#221A15]">
                          {countryCode} {phoneNumber}
                        </span>
                      </p>
                    </div>

                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                      {/* 6 Digit Inputs */}
                      <div>
                        <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
                          {otp.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={(el) => {
                                otpInputRefs.current[idx] = el;
                              }}
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={digit}
                              onChange={(e) => handleOtpChange(idx, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                              className="w-full h-12 text-center text-lg font-black bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-[#E25822] focus:bg-white focus:ring-4 focus:ring-[#E25822]/10 text-[#221A15] transition-all"
                            />
                          ))}
                        </div>
                        {otpError && (
                          <p className="text-red-500 text-[11px] font-semibold mt-2 text-center flex items-center justify-center gap-1">
                            <span>⚠️</span> {otpError}
                          </p>
                        )}
                      </div>

                      {/* Verify Button */}
                      <button
                        type="submit"
                        disabled={isLoading || otp.join('').length < 6}
                        className="w-full py-3.5 px-4 bg-[#E25822] hover:bg-[#C94816] active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-[#E25822]/25 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Verifying code...</span>
                          </>
                        ) : (
                          <span>Verify &amp; Continue</span>
                        )}
                      </button>

                      {/* Resend Timer / Action */}
                      <div className="text-center">
                        {canResend ? (
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            className="text-xs font-bold text-[#E25822] hover:underline"
                          >
                            Didn&apos;t receive code? Resend OTP
                          </button>
                        ) : (
                          <p className="text-xs text-stone-400 font-medium">
                            Resend code in{' '}
                            <span className="font-mono font-bold text-stone-700">
                              00:{resendTimer < 10 ? `0${resendTimer}` : resendTimer}
                            </span>
                          </p>
                        )}
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
            >
              <Icon name="XMarkIcon" size={20} />
            </button>

            <div className="mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#E25822] flex items-center justify-center mb-3">
                <Icon name="KeyIcon" size={20} />
              </div>
              <h3 className="text-xl font-extrabold text-[#221A15]">Reset Your Password</h3>
              <p className="text-xs text-stone-500 mt-1">
                Enter your registered email address and we&apos;ll send you a password reset link.
              </p>
            </div>

            {forgotSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
                <p className="text-2xl">📬</p>
                <p className="text-xs font-bold text-emerald-900">{forgotMessage}</p>
                {forgotDevLink && (
                  <a
                    href={forgotDevLink}
                    className="text-[11px] font-bold text-primary underline break-all block"
                  >
                    Open reset link (dev only) →
                  </a>
                )}
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                {forgotError && (
                  <p className="text-red-500 text-[11px] font-semibold flex items-center gap-1">
                    <span>⚠️</span> {forgotError}
                  </p>
                )}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none focus:border-[#E25822] focus:bg-white focus:ring-4 focus:ring-[#E25822]/10"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 bg-stone-100 text-stone-700 font-bold text-xs rounded-xl hover:bg-stone-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#E25822] text-white font-bold text-xs rounded-xl hover:bg-[#C94816] transition-colors shadow-md shadow-[#E25822]/20"
                  >
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer copyright */}
      <footer className="w-full py-4 text-center text-[11px] text-stone-400 border-t border-stone-200/60 bg-white/50">
        © {new Date().getFullYear()} Snack-Pod India Pvt Ltd. All rights reserved.
      </footer>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
