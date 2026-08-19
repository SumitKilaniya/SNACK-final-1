import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

const banners = [
  {
    id: 1,
    label: 'NEW FLAVORS',
    title: 'Big Discounts on Your Favorite Dishes!',
    cta: 'ORDER NOW →',
    href: '/menu',
    image: '/images/banners/promo_1.webp',
    imageAlt:
      'Steaming bowl of spicy noodles being lifted with chopsticks against a dark background, dramatic food photography',
    dark: true,
  },
  {
    id: 2,
    label: 'NEW FLAVORS',
    title: 'Up to 50% Off Culinary Must-Haves!',
    cta: 'ORDER NOW →',
    href: '/menu',
    image: '/images/banners/promo_2.webp',
    imageAlt:
      'Bright pasta dish with tomatoes, olives, and fresh basil on a white plate, well-lit food photography',
    dark: false,
  },
  {
    id: 3,
    label: 'NEW FLAVORS',
    title: 'Gourmet Delights at Discounted Prices!',
    cta: 'ORDER NOW →',
    href: '/menu',
    image: '/images/banners/promo_3.webp',
    imageAlt:
      'Elegant cheesecake slice with raspberry coulis and fresh berries on a dark plate, gourmet dessert photography',
    dark: false,
  },
];

export default function PromoBanners() {
  return (
    <section className="max-w-7xl mx-auto px-4 pt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left large banner */}
        <div className="relative overflow-hidden rounded-xl min-h-[280px] sm:min-h-[380px] group img-grayscale-hover">
          <AppImage
            src={banners?.[0]?.image}
            alt={banners?.[0]?.imageAlt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
          <div className="absolute inset-0 p-8 flex flex-col justify-end">
            <span className="text-xs font-bold text-primary tracking-widest mb-2 uppercase">
              {banners?.[0]?.label}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-4">
              {banners?.[0]?.title}
            </h2>
            <Link
              href={banners?.[0]?.href}
              className="text-sm font-bold text-white hover:text-primary transition-colors"
            >
              {banners?.[0]?.cta}
            </Link>
          </div>
        </div>

        {/* Right two banners stacked */}
        <div className="flex flex-col gap-4">
          {banners?.slice(1)?.map((banner) => (
            <div
              key={banner?.id}
              className="relative overflow-hidden rounded-xl min-h-[140px] sm:min-h-[180px] group img-grayscale-hover"
            >
              <AppImage
                src={banner?.image}
                alt={banner?.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 25vw"
              />

              <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-transparent" />
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <span className="text-xs font-bold text-primary tracking-widest mb-1 uppercase">
                  {banner?.label}
                </span>
                <h3 className="text-xl font-extrabold text-white leading-tight mb-2">
                  {banner?.title}
                </h3>
                <Link
                  href={banner?.href}
                  className="text-xs font-bold text-white hover:text-primary transition-colors"
                >
                  {banner?.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
