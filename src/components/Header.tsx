'use client';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import SearchAutocomplete from '@/components/SearchAutocomplete';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import { useAuth } from '@/lib/auth-context';
import { useBranches } from '@/lib/branches-context';

// Nav links
const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Menu', href: '/menu' },
  { label: 'Offers', href: '/offers' },
  { label: 'Orders', href: '/orders' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { itemCount, openCartDrawer, requestBranchSwitch } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { user, isLoggedIn, isLoading, logout } = useAuth();
  const { branches, selectedBranch } = useBranches();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg shadow-black/5' : 'bg-white'}`}
      >
        {/* Announcement Bar */}
        <div className="bg-gradient-to-r from-primary via-accent to-primary text-white py-2 px-4 text-center text-xs font-medium hidden sm:block">
          🎉 Free delivery on orders over ₹499 &nbsp;·&nbsp;
          <Link href="/offers" className="font-bold underline cursor-pointer hover:text-white/80">
            View Offers →
          </Link>
        </div>

        {/* Main Header Row */}
        <div className="border-b border-border/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <span className="text-white font-black text-lg">S</span>
              </div>
              <span className="font-black text-xl tracking-tight text-foreground hidden sm:block">
                Snack<span className="text-primary">-Pod</span>
              </span>
            </Link>

            {/* Nav Links — Desktop */}
            <nav className="hidden md:flex items-center gap-1 ml-4">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-all duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Search — Desktop (with live autocomplete) */}
            <SearchAutocomplete variant="desktop" />

            {/* Right Actions */}
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              {/* Branch selector — persisted via the sp_branch cookie. */}
              {branches.length > 1 && (
                <div className="hidden md:flex items-center gap-1.5 border border-border rounded-full pl-2.5 pr-1.5 py-1.5 bg-secondary/60">
                  <Icon name="MapPinIcon" size={14} className="text-primary shrink-0" />
                  <select
                    value={selectedBranch?.id ?? ''}
                    onChange={(e) => requestBranchSwitch(e.target.value)}
                    aria-label="Select branch"
                    className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer max-w-[110px]"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Session hydration placeholder — avoids flashing "Sign In"
                  while the refresh-cookie session is being restored. */}
              {isLoading ? (
                <div className="w-9 h-9 rounded-full bg-stone-100 animate-pulse" aria-hidden="true" />
              ) : isLoggedIn ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-1 pl-2.5 pr-1.5 bg-stone-100 hover:bg-stone-200/80 rounded-full transition-all border border-stone-200/60"
                  >
                    <span className="text-xs font-bold text-stone-800 max-w-[100px] truncate hidden sm:inline-block">
                      {user?.name?.split(' ')[0]}
                    </span>
                    <div className="w-7 h-7 rounded-full bg-primary text-white font-black text-xs flex items-center justify-center shadow-sm">
                      {user?.name ? user.name[0].toUpperCase() : 'U'}
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-stone-200/80 py-2 z-50 animate-fadeIn">
                      <div className="px-4 py-2.5 border-b border-stone-100">
                        <p className="text-xs font-bold text-stone-900 truncate">{user?.name}</p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {user?.email || user?.phone}
                        </p>
                      </div>

                      <div className="py-1">
                        {(user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_ADMIN') && (
                          <Link
                            href="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 transition-colors border-b border-amber-100/80"
                          >
                            <Icon name="Cog6ToothIcon" size={16} className="text-amber-600" />
                            <span>Admin Portal ⚡</span>
                          </Link>
                        )}

                        <Link
                          href="/account"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-primary transition-colors"
                        >
                          <Icon name="UserIcon" size={16} />
                          <span>Account & Profile</span>
                        </Link>

                        <Link
                          href="/orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-primary transition-colors"
                        >
                          <Icon name="ClipboardDocumentListIcon" size={16} />
                          <span>Order History</span>
                        </Link>

                        <Link
                          href="/favourites"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-primary transition-colors"
                        >
                          <Icon name="HeartIcon" size={16} />
                          <span>Favourites</span>
                        </Link>
                      </div>

                      <div className="pt-1 border-t border-stone-100">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Icon name="ArrowRightOnRectangleIcon" size={16} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/signin"
                  className="px-3.5 py-1.5 bg-primary hover:bg-[#C94816] text-white text-xs font-bold rounded-full transition-all shadow-sm hover:shadow flex items-center gap-1.5"
                >
                  <Icon name="UserIcon" size={16} />
                  <span>Sign In</span>
                </Link>
              )}
              {/* Wishlist / Favourites — links to dedicated Favourites page */}
              <Link
                href="/favourites"
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-all relative"
                aria-label={`Favourites, ${wishlistCount} items`}
              >
                <Icon name="HeartIcon" size={20} />
                {wishlistCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-primary text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={openCartDrawer}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-all relative"
                aria-label={`Cart drawer, ${itemCount} items`}
              >
                <Icon name="ShoppingBagIcon" size={20} />
                {itemCount > 0 && (
                  <span
                    key={itemCount}
                    className="cart-bounce absolute top-0.5 right-0.5 bg-primary text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center"
                  >
                    {itemCount}
                  </span>
                )}
              </button>
              {/* Mobile Hamburger */}
              <button
                className="md:hidden p-2 text-foreground hover:bg-secondary rounded-full transition-all"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                <Icon name="Bars3Icon" size={22} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Dark Overlay — closes on tap */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Slide-in Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white z-[70] shadow-2xl transform transition-transform duration-300 ease-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-white font-black">S</span>
            </div>
            <span className="font-black text-lg text-foreground">
              Snack<span className="text-primary">-Pod</span>
            </span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-all"
            aria-label="Close menu"
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        {/* Search in drawer (with live autocomplete) */}
        <div className="p-4 border-b border-border">
          <SearchAutocomplete variant="drawer" onNavigate={() => setMobileMenuOpen(false)} />
        </div>

        {/* Branch selector in drawer */}
        {branches.length > 1 && (
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Icon name="MapPinIcon" size={16} className="text-primary shrink-0" />
            <select
              value={selectedBranch?.id ?? ''}
              onChange={(e) => requestBranchSwitch(e.target.value)}
              aria-label="Select branch"
              className="flex-1 bg-secondary/60 border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Nav Links */}
        <nav className="p-4 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="flex items-center gap-3 py-3 px-4 text-foreground font-semibold rounded-xl hover:bg-secondary hover:text-primary transition-all"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          {isLoggedIn ? (
            <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col gap-1">
              <Link
                href="/account"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 bg-stone-50 hover:bg-stone-100 rounded-xl mb-1 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-bold text-stone-900">{user?.name}</p>
                  <p className="text-[11px] text-stone-500">{user?.email || user?.phone}</p>
                </div>
                <span className="text-xs font-bold text-primary">View Profile →</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-2 py-2.5 px-4 text-xs font-bold text-red-600 rounded-xl hover:bg-red-50 transition-all text-left"
              >
                <Icon name="ArrowRightOnRectangleIcon" size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <Link
              href="/signin"
              className="flex items-center gap-2 mt-2 py-3 px-4 text-primary font-bold rounded-xl bg-primary/10 hover:bg-primary/20 transition-all"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon name="UserIcon" size={18} />
              <span>Sign In / Sign Up</span>
            </Link>
          )}
        </nav>

        {/* CTA */}
        <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-border bg-white">
          <Link
            href="/menu"
            className="block w-full py-3.5 bg-gradient-to-r from-primary to-accent text-white font-bold text-center rounded-2xl shadow-lg shadow-primary/30 hover:opacity-90 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          >
            Order Now 🍔
          </Link>
        </div>
      </div>
    </>
  );
}
