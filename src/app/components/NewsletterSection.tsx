'use client';
import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubscribed(true);
  };

  return (
    <section className="relative bg-[#1A1615] overflow-hidden mt-8">
      <div className="max-w-7xl mx-auto px-4 py-14 flex items-center justify-center relative">
        {/* Left food image */}
        <div className="absolute left-0 bottom-0 w-48 h-40 hidden lg:block">
          <AppImage
            src="/images/banners/newsletter_1.webp"
            alt="Elegant dessert plate with berries and sauce on a dark background"
            width={200}
            height={160}
            className="w-full h-full object-contain object-bottom"
          />
        </div>

        {/* Center content */}
        <div className="text-center z-10 max-w-lg">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">
            Enjoy 40% Off — Get Your Coupon Now!
          </h2>
          <p className="text-sm text-white/40 mb-6" style={{ letterSpacing: '0.02em' }}>by subscribing to our Newsletter</p>

          {subscribed ? (
            <div className="flex items-center justify-center gap-2 text-primary font-semibold">
              <span>🎉</span> Coupon sent to {email}!
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex gap-0 rounded-lg overflow-hidden border border-white/15 max-w-sm mx-auto"
            >
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-3 bg-white text-foreground text-sm outline-none placeholder:text-[#736B66]"
                required
              />

              <button
                type="submit"
                className="px-5 py-3 bg-primary text-primary-foreground font-bold text-sm hover:bg-accent transition-colors whitespace-nowrap btn-spring"
              >
                Subscribe
              </button>
            </form>
          )}
        </div>

        {/* Right food image */}
        <div className="absolute right-0 bottom-0 w-48 h-40 hidden lg:block">
          <AppImage
            src="/images/banners/newsletter_2.webp"
            alt="Gourmet waffle with ice cream and berry sauce on a white plate, dark background"
            width={200}
            height={160}
            className="w-full h-full object-contain object-bottom"
          />
        </div>
      </div>
    </section>
  );
}
