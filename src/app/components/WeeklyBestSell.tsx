'use client';
import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import DishCard from '@/components/ui/DishCard';
import { useMenu } from '@/lib/menu-context';

// Real catalog ids (seeded in prisma/seed.js); unknown ids fall back to the
// first dishes served by the API, so this never renders empty.
const weeklyKeys = [
  'item_classic_chicken_burger',
  'item_paneer_tikka_burger',
  'item_veg_meal_combo',
  'item_grilled_chicken_combo',
  'item_loaded_nachos',
  'item_masala_fries',
];

export default function WeeklyBestSell() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { getDishById, dishes } = useMenu();

  const weeklySellers = weeklyKeys
    .map((key) => getDishById(key))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  const displaySellers = weeklySellers.length > 0 ? weeklySellers : dishes.slice(0, 6);

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
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className={`scroll-pop ${visible ? 'popped' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-foreground">Weekly Best Sell</h2>
          <p className="text-sm text-muted-foreground mt-0.5">This week&apos;s crowd favorites</p>
        </div>
        <Link
          href="/menu"
          className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-full hover:bg-accent transition-colors btn-spring shadow-sm shadow-primary/20"
        >
          See All
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displaySellers.map((dish) => (
          <DishCard key={dish.id || dish.key} dish={dish} layout="row" />
        ))}
      </div>
    </section>
  );
}
