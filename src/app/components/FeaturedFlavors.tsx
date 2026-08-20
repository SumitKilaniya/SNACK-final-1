'use client';
import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import DishCard from '@/components/ui/DishCard';
import { useMenu } from '@/lib/menu-context';

// Real catalog ids (seeded in prisma/seed.js); unknown ids fall back to the
// first dishes served by the API, so this never renders empty.
const featuredKeys = [
  'item_classic_chicken_burger',
  'item_crispy_veg_burger',
  'item_peri_peri_fries',
  'item_masala_fries',
  'item_chicken_wings',
  'item_veg_spring_rolls',
  'item_loaded_nachos',
  'item_cold_coffee',
  'item_fresh_lime_soda',
  'item_chocolate_brownie',
];

export default function FeaturedFlavors() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { getDishById, dishes } = useMenu();

  const featuredItems = featuredKeys
    .map((key) => getDishById(key))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  const displayItems = featuredItems.length > 0 ? featuredItems : dishes.slice(0, 10);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className={`scroll-pop ${visible ? 'popped' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground" style={{ letterSpacing: '-0.03em' }}>Featured Flavors</h2>
          <p className="text-sm text-[#736B66] mt-0.5" style={{ letterSpacing: '0.02em' }}>Chef&apos;s handpicked favorites</p>
        </div>
        <Link
          href="/menu"
          className="px-5 py-2 bg-primary text-white text-sm font-bold btn-pill hover:bg-accent transition-colors btn-spring shadow-sm shadow-primary/20"
        >
          See All
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {displayItems.map((dish) => (
          <DishCard key={dish.id || dish.key} dish={dish} layout="compact" />
        ))}
      </div>
    </section>
  );
}
