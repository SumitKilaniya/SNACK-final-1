'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const deals = [
  {
    id: 1,
    label: 'Seasonal Flavors',
    title: 'End-Of-Season Special: Gourmet Delights At Reduced Prices!',
    description: 'Seasonal Flavors: Enjoy Gourmet Delights at Discounted Prices!',
    originalPrice: 200,
    salePrice: 159,
    cta: 'Get this Deal',
    image: '/images/banners/deal_1.webp',
    imageAlt:
      'Colorful wrap sandwich with fries and dipping sauce on a wooden board, well-lit food photography',
  },
  {
    id: 2,
    label: 'Limited Time',
    title: 'Family Feast Special: Feed The Whole Crew For Less!',
    description: '4 Zinger Burgers + 4 Large Fries + 4 Pepsi Regulars — feeds the whole family.',
    originalPrice: 1196,
    salePrice: 899,
    cta: 'Get this Deal',
    image: '/images/banners/deal_2.webp',
    imageAlt: 'Large juicy burger with cheese and fresh vegetables on a dark background',
  },
];

export default function DealBanner() {
  const [active, setActive] = useState(0);
  const deal = deals?.[active];

  return (
    <section className="relative overflow-hidden rounded-2xl promo-gradient min-h-[220px] flex items-center shadow-[0_20px_48px_rgba(0,0,0,0.15)]">
      <div className="flex-1 p-8 sm:p-12 z-10 max-w-lg">
        <span className="text-xs font-bold text-primary uppercase mb-2 block" style={{ letterSpacing: '0.08em' }}>
          {deal?.label}
        </span>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-white leading-tight mb-3">
          {deal?.title}
        </h2>
        <p className="text-sm text-white/60 mb-5" style={{ letterSpacing: '0.02em' }}>{deal?.description}</p>
        <div className="flex items-baseline gap-3 mb-6">
          <span className="text-2xl font-extrabold text-white">₹{deal?.salePrice}.00</span>
          <span className="text-base text-white/50 line-through">₹{deal?.originalPrice}.00</span>
        </div>
        <Link
          href="/menu"
          className="inline-block px-6 py-2.5 bg-primary text-primary-foreground font-bold text-sm btn-pill hover:bg-accent transition-colors btn-spring"
        >
          {deal?.cta}
        </Link>
      </div>
      {/* Food image */}
      <div className="absolute right-0 top-0 bottom-0 w-2/5 hidden sm:block">
        <AppImage
          src={deal?.image}
          alt={deal?.imageAlt}
          fill
          className="object-cover object-left"
          sizes="40vw"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1615] via-[#1A1615]/60 to-transparent" />
      </div>
      {/* Carousel dots */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        {deals?.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`w-6 h-1.5 rounded-full transition-all ${i === active ? 'bg-primary w-8' : 'bg-white/30'}`}
            aria-label={`Deal ${i + 1}`}
          />
        ))}
      </div>
      {/* Nav arrows */}
      <button
        onClick={() => setActive((prev) => (prev - 1 + deals.length) % deals.length)}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors hidden sm:flex"
        aria-label="Previous deal"
      >
        <Icon name="ChevronLeftIcon" size={16} />
      </button>
      <button
        onClick={() => setActive((prev) => (prev + 1) % deals.length)}
        className="absolute right-12 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors hidden sm:flex"
        aria-label="Next deal"
      >
        <Icon name="ChevronRightIcon" size={16} />
      </button>
    </section>
  );
}
