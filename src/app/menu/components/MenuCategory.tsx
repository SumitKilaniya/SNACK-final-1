'use client';
import React, { useRef } from 'react';
import { categories } from '@/lib/menu-data';

interface CategoryTabBarProps {
  active: string; // active category id ('all' when none is focused)
  onSelect: (id: string) => void;
}

/**
 * Sticky Zomato/Swiggy-style category tab bar. Sits directly under the sticky
 * header and lets users jump between the 12 menu categories without scrolling.
 */
export default function CategoryTabBar({ active, onSelect }: CategoryTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleClick = (id: string) => {
    onSelect(id);
    // Keep the clicked tab visible in the overflow strip.
    const el = scrollRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  return (
    <div className="sticky top-[60px] sm:top-[92px] z-40 -mx-4 px-4 sm:mx-0 sm:px-0 bg-background/95 backdrop-blur-md border-b border-border shadow-sm shadow-black/5">
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-3 max-w-7xl mx-auto"
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            data-tab={cat.id}
            onClick={() => handleClick(cat.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all btn-spring ${
              active === cat.id
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                : 'bg-white text-foreground border border-border hover:border-primary/50 hover:text-primary'
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
