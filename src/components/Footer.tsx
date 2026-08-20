import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export default function Footer() {
  return (
    <footer className="bg-[#1A1615] text-white">
      {/* Top CTA Strip */}
      <div className="bg-primary py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-display font-bold text-white mb-1">Hungry? We got you.</h3>
            <p className="text-white/70 text-sm tracking-wide">
              Order now and get free delivery on your first order.
            </p>
          </div>
          <Link
            href="/menu"
            className="shrink-0 btn-pill px-8 py-3.5 bg-white text-primary font-bold hover:bg-white/90 transition-colors shadow-lg text-sm"
          >
            Order Now →
          </Link>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-white font-black text-lg">S</span>
              </div>
              <span className="font-display font-bold text-xl text-white">
                Snack<span className="text-primary">-Pod</span>
              </span>
            </Link>
            <p className="text-sm text-white/40 leading-relaxed mb-5 tracking-wide">
              Fresh, bold flavors for the next generation. Delivery, pickup, or dine-in — we make
              every bite count.
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3">
              {[
                { label: 'Instagram', icon: 'HeartIcon' },
                { label: 'Twitter', icon: 'GlobeAltIcon' },
                { label: 'Facebook', icon: 'UserGroupIcon' },
              ].map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-white/40 hover:bg-primary hover:text-white transition-all duration-200"
                >
                  <Icon name={s.icon as 'HeartIcon'} size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-[0.2em] mb-5">
              Quick Links
            </h4>
            <ul className="flex flex-col gap-3">
              {[
                { label: 'Home', href: '/' },
                { label: 'Menu', href: '/menu' },
                { label: 'Offers & Deals', href: '/offers' },
                { label: 'My Orders', href: '/orders' },
                { label: 'About Us', href: '/about' },
                { label: 'Contact Us', href: '/contact' },
                { label: 'FAQ', href: '/faq' },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/40 hover:text-white transition-colors tracking-wide"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-[0.2em] mb-5">Legal</h4>
            <ul className="flex flex-col gap-3">
              {[
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms & Conditions', href: '/terms' },
                { label: 'Refund Policy', href: '/refund' },
                { label: 'Cookie Policy', href: '/cookie' },
                { label: 'FSSAI License', href: '/fssai' },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/40 hover:text-white transition-colors tracking-wide"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-[0.2em] mb-5">
              Contact Us
            </h4>
            <ul className="flex flex-col gap-4">
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon name="MapPinIcon" size={14} />
                </div>
                <div>
                  <p className="text-sm text-white/70 font-medium tracking-wide">Koramangala, Bangalore</p>
                  <p className="text-xs text-white/35">Karnataka, India 560034</p>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon name="PhoneIcon" size={14} />
                </div>
                <a
                  href="tel:+918001234567"
                  className="text-sm text-white/50 hover:text-white transition-colors tracking-wide"
                >
                  +91 800 123 4567
                </a>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon name="EnvelopeIcon" size={14} />
                </div>
                <a
                  href="mailto:hello@snackpod.in"
                  className="text-sm text-white/50 hover:text-white transition-colors tracking-wide"
                >
                  hello@snackpod.in
                </a>
              </li>
            </ul>

            {/* App Download hint */}
            <div className="mt-6 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <p className="text-[10px] text-white/35 mb-1 tracking-widest uppercase">App coming soon</p>
              <p className="text-xs font-semibold text-white/60">iOS & Android</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10 py-5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-white/25 tracking-wide">
            © 2026 Snack-Pod. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-white/25 tracking-widest uppercase">FSSAI Lic: 10020042000123</span>
            <span className="text-[10px] text-white/25 tracking-widest uppercase">GST: 29AABCU9603R1ZX</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
