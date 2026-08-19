'use client';
import React, { useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/lib/cart-context';
import { useToast } from '@/lib/toast-context';
import { combos } from '@/lib/menu-data';

export default function DealsAndCombos() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { addItem } = useCart();
  const { showToast } = useToast();

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'right' ? 340 : -340, behavior: 'smooth' });
    }
  };

  const orderNow = (comboId: number) => {
    const combo = combos.find((c) => c.id === comboId);
    if (!combo) return;
    addItem({
      key: `combo-${combo.id}`,
      name: combo.name,
      price: combo.salePrice,
      image: combo.image,
      imageAlt: combo.imageAlt,
      variant: 'Combo deal',
    });
    showToast(`${combo.name} added to cart`);
    router.push('/checkout');
  };

  return (
    <section id="combos">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏷️</span>
          <h2 className="text-xl font-extrabold text-foreground">Deals &amp; Combos</h2>
          <span className="text-sm font-semibold text-primary bg-orange-50 px-2 py-0.5 rounded-full">
            3 offers
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
            aria-label="Previous"
          >
            <Icon name="ChevronLeftIcon" size={16} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
            aria-label="Next"
          >
            <Icon name="ChevronRightIcon" size={16} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {combos.map((combo) => (
          <div
            key={combo.id}
            className="flex-none w-72 sm:w-80 bg-white rounded-2xl border border-border overflow-hidden card-hover group"
          >
            <div className="relative h-44 overflow-hidden">
              <AppImage
                src={combo.image}
                alt={combo.imageAlt}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                sizes="320px"
              />

              <div className="absolute top-3 left-3 flex items-center gap-2">
                {combo.isNew && (
                  <span className="bg-foreground text-white text-xs font-bold px-2 py-1 rounded">
                    NEW
                  </span>
                )}
                <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">
                  {combo.saveBadge}
                </span>
              </div>
              {combo.isLimited && (
                <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded flex items-center gap-1">
                  <Icon name="ClockIcon" size={12} />
                  Limited Time
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="text-base font-extrabold text-foreground mb-1">{combo.name}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                {combo.description}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-extrabold text-primary">₹{combo.salePrice}</span>
                  <span className="text-sm text-muted-foreground line-through">
                    ₹{combo.originalPrice}
                  </span>
                </div>
                <button
                  onClick={() => orderNow(combo.id)}
                  className="px-4 py-2 bg-primary text-primary-foreground font-bold text-sm rounded-full hover:bg-accent transition-colors btn-spring"
                >
                  Order Now
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
