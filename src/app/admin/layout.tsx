'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminProvider, useAdmin } from '@/lib/admin-context';
import { ADMIN_ROLE_LABEL } from '@/lib/admin-api';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';

const NAV_ITEMS: {
  label: string;
  href: string;
  icon: string;
  roles: ('BRANCH_ADMIN' | 'SUPER_ADMIN')[];
}[] = [
  { label: 'Overview', href: '/admin', icon: 'LayoutDashboard', roles: ['BRANCH_ADMIN', 'SUPER_ADMIN'] },
  { label: 'Live Orders', href: '/admin/orders', icon: 'ShoppingBag', roles: ['BRANCH_ADMIN', 'SUPER_ADMIN'] },
  { label: 'Menu Management', href: '/admin/menu', icon: 'Utensils', roles: ['BRANCH_ADMIN', 'SUPER_ADMIN'] },
  { label: 'Coupons & Offers', href: '/admin/coupons', icon: 'Tag', roles: ['SUPER_ADMIN'] },
  { label: 'Branches', href: '/admin/branches', icon: 'Building2', roles: ['SUPER_ADMIN'] },
  { label: 'Reports & Analytics', href: '/admin/reports', icon: 'BarChart3', roles: ['BRANCH_ADMIN', 'SUPER_ADMIN'] },
  { label: 'User Accounts', href: '/admin/users', icon: 'Users', roles: ['SUPER_ADMIN'] },
  { label: 'Customer Data', href: '/admin/customers', icon: 'UsersRound', roles: ['SUPER_ADMIN'] },
  { label: 'Review Moderation', href: '/admin/reviews', icon: 'Star', roles: ['SUPER_ADMIN'] },
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, role, signOut } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isBranchAdmin = role === 'BRANCH_ADMIN';
  const visibleNav = NAV_ITEMS.filter((item) =>
    isSuperAdmin ? true : item.roles.includes('BRANCH_ADMIN')
  );

  useEffect(() => {
    if (!sidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800 px-3 sm:px-4 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            className="lg:hidden w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={sidebarOpen}
            aria-controls="admin-navigation"
          >
            <Icon name={sidebarOpen ? 'X' : 'Menu'} className="w-5 h-5" />
          </button>

          <Link href="/admin" className="flex items-center gap-2 min-w-0">
            <AppLogo size={32} />
            <span className="bg-primary/20 text-primary-foreground border border-primary/30 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded tracking-wide uppercase whitespace-nowrap">
              Admin<span className="hidden sm:inline"> Portal</span>
            </span>
          </Link>
        </div>

        {/* Right Control Strip */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1 rounded-lg">
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <Icon name="ShieldCheck" className="w-3.5 h-3.5 text-primary" />{' '}
              {role ? ADMIN_ROLE_LABEL[role] : 'Admin'}
            </span>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <Link
              href="/"
              className="hidden md:flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors font-medium"
            >
              <Icon name="ExternalLink" className="w-3.5 h-3.5" />
              Back to Store
            </Link>

            <div className="text-right hidden xl:block">
              <p className="font-semibold text-white leading-tight">{user?.name || 'Admin'}</p>
              <p className="text-[10px] text-slate-400">{user?.email}</p>
            </div>

            <button
              onClick={() => signOut()}
              title="Sign Out"
              aria-label="Sign Out"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
            >
              <Icon name="LogOut" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Workspace Body ───────────────────────────────────── */}
      <div className="flex flex-1 relative">
        {sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
            className="fixed inset-0 bg-slate-950/60 z-20 lg:hidden backdrop-blur-xs"
          />
        )}

        <aside
          id="admin-navigation"
          className={`fixed lg:sticky top-[61px] lg:top-[49px] left-0 h-[calc(100dvh-61px)] lg:h-[calc(100vh-49px)] w-[min(18rem,88vw)] bg-slate-900 text-slate-300 border-r border-slate-800 z-30 flex flex-col transition-transform duration-200 shrink-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Current Portal Scope
            </p>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-bold text-white text-sm capitalize flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {isSuperAdmin ? 'Super Admin' : isBranchAdmin ? 'Branch Admin' : 'Admin'}
              </span>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {visibleNav.map((item) => {
              const isActive =
                item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon name={item.icon as never} className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>SnackPod v1.4 Admin</span>
            <Link href="/" className="hover:text-slate-300 underline">
              Customer Store
            </Link>
          </div>
        </aside>

        <main className="flex-1 p-3 sm:p-6 md:p-8 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

/** Full-screen loading state while the session is verified. */
function LoadingGate() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <AppLogo />
        <div className="w-8 h-8 border-2 border-slate-700 border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Verifying admin session…</p>
      </div>
    </div>
  );
}

/** Sign-in screen — the admin portal requires a real BRANCH_ADMIN / SUPER_ADMIN session. */
function SignInGate() {
  const { signIn } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : 'Sign-in failed. Please try again.'
      );
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 relative overflow-hidden flex items-center justify-center p-4">
      {/* ambient glows */}
      <div className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-48 -left-40 w-[520px] h-[520px] rounded-full bg-orange-900/25 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl shadow-black/40 border border-slate-200 overflow-hidden">
          <div className="px-8 pt-8 pb-6 text-center">
            <div className="flex justify-center mb-4">
              <AppLogo />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Admin Portal</h1>
            <p className="text-sm text-slate-500 mt-1">
              Sign in with a branch admin or super admin account to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@snackpod.in"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              />
            </div>

            {error && (
              <div className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 bg-primary text-primary-foreground font-extrabold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {busy ? 'Signing in…' : 'Sign In'}
            </button>

            <div className="pt-3 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 font-medium mb-1.5">Dev demo accounts:</p>
              <div className="space-y-1 text-[11px] text-slate-500 font-mono">
                <p>👑 super_admin@snackpod.local / SuperAdmin@123!</p>
                <p>🏬 branch_admin@snackpod.local / BranchAdmin@123!</p>
              </div>
            </div>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-4">
          Every admin API is role-checked server-side — a customer token gets a 403.
        </p>
      </div>
    </div>
  );
}

function DeactivatedGate() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-8 text-center shadow-2xl border border-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <Icon name="Ban" className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Account Deactivated</h1>
        <p className="text-sm text-slate-500 mt-2">
          This admin account has been deactivated. Contact a super admin to restore access.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block px-5 py-2.5 bg-slate-900 text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-colors"
        >
          Back to Store
        </Link>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminGate>{children}</AdminGate>
    </AdminProvider>
  );
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const { state } = useAdmin();
  if (state === 'loading') return <LoadingGate />;
  if (state === 'signedOut') return <SignInGate />;
  if (state === 'deactivated') return <DeactivatedGate />;
  return <AdminShell>{children}</AdminShell>;
}
