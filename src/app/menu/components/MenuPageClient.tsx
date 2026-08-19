'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Dish } from '@/lib/menu-data';
import { useMenu } from '@/lib/menu-context';
import { useWishlist } from '@/lib/wishlist-context';
import DishCard from '@/components/ui/DishCard';
import Icon from '@/components/ui/AppIcon';
import CategoryTabBar from './MenuCategory';
import DealsAndCombos from './DealsAndCombos';

type SortKey = 'popular' | 'price-asc' | 'price-desc' | 'rating';

interface MenuPageClientProps {
  initialSearch?: string;
  initialWishlistOnly?: boolean;
  /** Dish key from the header search autocomplete (?dish=<key>) — scroll to & flash it. */
  initialDish?: string;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="skeleton h-40 sm:h-44" />
      <div className="p-4 space-y-2.5">
        <div className="skeleton h-3.5 w-3/4 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="flex justify-between pt-2">
          <div className="skeleton h-5 w-12 rounded" />
          <div className="skeleton h-9 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

interface CategorySectionProps {
  section: {
    id: string;
    emoji: string;
    name: string;
    dishes: Dish[];
  };
  hasFilters: boolean;
  wishlistOnly: boolean;
  highlightKey: string | null;
  index: number;
}

const CategorySection = React.memo(function CategorySection({
  section,
  hasFilters,
  wishlistOnly,
  highlightKey,
  index,
}: CategorySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(index < 2 || hasFilters);

  useEffect(() => {
    if (shouldRender || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <section key={section.id} id={section.id} ref={ref} className="scroll-mt-40">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{section.emoji}</span>
        <h2 className="text-xl font-extrabold text-foreground">{section.name}</h2>
        <span className="text-sm text-muted-foreground">
          ({section.dishes.length} {section.dishes.length === 1 ? 'item' : 'items'})
        </span>
        {section.dishes.length === 0 && (
          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            No matches here
          </span>
        )}
      </div>
      {section.dishes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-2xl mb-1">{section.emoji}</p>
          <p className="text-sm font-bold text-foreground">No items in this category</p>
          <p className="text-xs text-muted-foreground mt-1">
            {wishlistOnly
              ? 'Nothing wishlisted here yet.'
              : 'Nothing matches your current search or filters in this category.'}
          </p>
        </div>
      ) : !shouldRender ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 min-h-[220px]">
          {Array.from({ length: Math.min(section.dishes.length, 4) }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {section.dishes.map((dish) => (
            <DishCard
              key={dish.key}
              id={`dish-${dish.key}`}
              dish={dish}
              layout="grid"
              className={highlightKey === dish.key ? 'dish-highlight' : ''}
            />
          ))}
        </div>
      )}
    </section>
  );
});

export default function MenuPageClient({
  initialSearch = '',
  initialWishlistOnly = false,
  initialDish = '',
}: MenuPageClientProps) {
  const { dishes, categories, getDishById, isHydrated } = useMenu();
  const [search, setSearch] = useState(initialSearch);
  const [vegOnly, setVegOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('popular');
  const [wishlistOnly, setWishlistOnly] = useState(initialWishlistOnly);
  const [activeTab, setActiveTab] = useState('all');
  // Skeletons until the selected branch's menu has actually arrived from /api/menu.
  const loading = !isHydrated;
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isWishlisted } = useWishlist();

  // Sync from URL params on client-side navigations
  useEffect(() => {
    setSearch(initialSearch);
    setWishlistOnly(initialWishlistOnly);
  }, [initialSearch, initialWishlistOnly]);

  // Landing on /menu?dish=<key>
  useEffect(() => {
    if (!initialDish || loading) return;
    const dish = getDishById(initialDish);
    if (!dish) return;
    setSearch('');
    setVegOnly(false);
    setSort('popular');
    setWishlistOnly(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        const section = document.getElementById(dish.categoryId);
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        timers.push(
          setTimeout(() => {
            const card = document.getElementById(`dish-${dish.key}`);
            card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (card) setHighlightKey(dish.key);
          }, 450)
        );
      }, 120)
    );
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightKey(null), 4200);

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('dish');
      window.history.replaceState(null, '', url.toString());
    } catch {
      // ignore
    }
    return () => {
      timers.forEach(clearTimeout);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, [initialDish, loading, getDishById]);

  // Landing on /menu#<category>
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveTab(hash);
      }
    };
    if (!loading) {
      const t = setTimeout(scrollToHash, 60);
      return () => clearTimeout(t);
    }
  }, [loading]);

  // Support hash changes
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Scroll-spy
  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveTab(entry.target.id);
        }
      },
      { rootMargin: '-25% 0px -70% 0px', threshold: 0 }
    );
    categories.forEach((c) => {
      const el = document.getElementById(c.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [loading, vegOnly, search, sort, wishlistOnly, categories]);

  const filtered = useMemo(() => {
    let list = dishes;
    if (wishlistOnly) list = list.filter((d) => isWishlisted(d.id || d.key));
    if (vegOnly) list = list.filter((d) => d.isVeg);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
      );
    }
    if (sort === 'price-asc')
      list = [...list].sort((a, b) => (a.discountPrice ?? a.price) - (b.discountPrice ?? b.price));
    else if (sort === 'price-desc')
      list = [...list].sort((a, b) => (b.discountPrice ?? b.price) - (a.discountPrice ?? a.price));
    else if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [dishes, search, vegOnly, sort, wishlistOnly, isWishlisted]);

  const sections = useMemo(
    () =>
      categories.map((cat) => ({
        ...cat,
        dishes: filtered.filter((d) => (d.categoryId || d.category) === cat.id),
      })),
    [categories, filtered]
  );

  const totalDishes = filtered.length;
  const anyMatch = sections.some((s) => s.dishes.length > 0);
  const hasFilters = Boolean(search.trim()) || vegOnly || wishlistOnly || sort !== 'popular';

  const handleTabSelect = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveTab(id);
    }
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setVegOnly(false);
    setSort('popular');
    setWishlistOnly(false);
    if (window.location.search) {
      window.history.replaceState(null, '', '/menu');
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="pt-2">
        <h1 className="text-2xl sm:text-3xl font-black text-foreground">Full Menu</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {wishlistOnly
            ? `Showing your ${filtered.length} wishlisted ${filtered.length === 1 ? 'dish' : 'dishes'} ♥`
            : `${dishes.length} dishes across ${categories.length} categories — freshly made to order.`}
        </p>
      </div>

      {/* Sticky category tabs */}
      <CategoryTabBar active={activeTab} onSelect={handleTabSelect} />

      {/* Filter bar: search + veg toggle + sort */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white rounded-xl border border-border p-3">
        <div className="flex-1 flex items-center gap-2 border border-border rounded-full px-4 py-2 bg-secondary min-w-0">
          <Icon name="MagnifyingGlassIcon" size={16} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search dishes by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground w-full"
            aria-label="Search dishes"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground"
            >
              <Icon name="XMarkIcon" size={14} />
            </button>
          )}
        </div>

        {/* Veg-only toggle */}
        <button
          onClick={() => setVegOnly((v) => !v)}
          aria-pressed={vegOnly}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all btn-spring ${
            vegOnly
              ? 'bg-green-600 text-white border-green-600 shadow-sm shadow-green-600/30'
              : 'bg-white text-foreground border-border hover:border-green-500 hover:text-green-700'
          }`}
        >
          <span className={vegOnly ? 'badge-veg' : 'badge-veg'} />
          Veg only
        </button>

        {/* Sort control */}
        <div className="flex items-center gap-2 border border-border rounded-full px-4 py-2 bg-secondary">
          <Icon name="ArrowDownIcon" size={14} className="text-muted-foreground" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-transparent text-sm font-semibold outline-none text-foreground cursor-pointer"
            aria-label="Sort dishes"
          >
            <option value="popular">Popular</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="rating">Top rated</option>
          </select>
        </div>
      </div>

      {/* Result count / wishlist banner */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          {hasFilters ? (
            <>
              <span className="font-bold text-foreground">{totalDishes}</span> of {dishes.length}{' '}
              dishes match
              {wishlistOnly && ' your wishlist'}
            </>
          ) : (
            <span className="text-muted-foreground">Showing all dishes</span>
          )}
        </p>
        {hasFilters && (
          <button onClick={clearFilters} className="text-primary font-semibold hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Deals & Combos strip (not part of the 12 tabs) */}
      <DealsAndCombos />

      {/* Skeleton while "loading" */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !anyMatch ? (
        /* Global empty state — nothing matches the filters at all */
        <div className="text-center py-20 bg-white rounded-2xl border border-border">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-base font-bold text-foreground">Nothing here yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {wishlistOnly
              ? 'Your wishlist is empty. Tap the ♥ on any dish to save it for later.'
              : search.trim()
                ? `No dishes match “${search.trim()}”.`
                : vegOnly
                  ? 'No vegetarian dishes match the current filters.'
                  : 'Try a different category or clear the filters.'}
          </p>
          <button
            onClick={clearFilters}
            className="mt-6 inline-block px-6 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-full hover:bg-accent transition-colors btn-spring"
          >
            Clear filters
          </button>
        </div>
      ) : (
        /* The 12 category sections rendered lazily on scroll */
        <div className="space-y-12">
          {(hasFilters ? sections.filter((s) => s.dishes.length > 0) : sections).map(
            (section, idx) => (
              <CategorySection
                key={section.id}
                section={section}
                hasFilters={hasFilters}
                wishlistOnly={wishlistOnly}
                highlightKey={highlightKey}
                index={idx}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
