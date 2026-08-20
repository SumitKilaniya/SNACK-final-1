'use client';
import React, { useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import DishCard from '@/components/ui/DishCard';
import { useMenu } from '@/lib/menu-context';

// Real catalog ids (seeded in prisma/seed.js); unknown ids fall back to the
// first dishes served by the API, so this never renders empty.
const trendingKeys = [
  'item_double_decker_burger',
  'item_chicken_wings',
  'item_peri_peri_fries',
  'item_cold_coffee',
  'item_choco_lava_shake',
  'item_chocolate_brownie',
];

export default function TrendingDishes() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { getDishById, dishes } = useMenu();

  const trendingDishes = trendingKeys
    .map((key) => getDishById(key))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  // Fallback if none found
  const displayDishes = trendingDishes.length > 0 ? trendingDishes : dishes.slice(0, 6);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'right' ? 280 : -280, behavior: 'smooth' });
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground" style={{ letterSpacing: '-0.03em' }}>Current Flavor Trends</h2>
          <p className="text-sm text-[#736B66] mt-0.5" style={{ letterSpacing: '0.02em' }}>
            What everyone&apos;s ordering right now
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            className="w-9 h-9 rounded-full border border-[rgba(0,0,0,0.08)] flex items-center justify-center hover:border-primary/25 hover:text-primary hover:bg-[#FAF7F2] transition-all"
            aria-label="Scroll left"
          >
            <Icon name="ChevronLeftIcon" size={16} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-9 h-9 rounded-full border border-[rgba(0,0,0,0.08)] flex items-center justify-center hover:border-primary/25 hover:text-primary hover:bg-[#FAF7F2] transition-all"
            aria-label="Scroll right"
          >
            <Icon name="ChevronRightIcon" size={16} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {displayDishes.map((dish) => (
          <DishCard key={dish.id || dish.key} dish={dish} layout="compact" />
        ))}
      </div>
    </section>
  );
}
