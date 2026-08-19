'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { categories, combos, type Category, type Combo, type Dish } from './menu-data';
import { useBranches } from './branches-context';

export type { Category, Combo, Dish };

/**
 * Shape of an item returned by GET /api/menu (see src/lib/catalog.ts's
 * EffectiveMenuItem — prices are already resolved per branch server-side).
 */
interface ApiMenuItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  basePrice: number;
  price: number;
  priceOverridden: boolean;
  isAvailable: boolean;
  isVeg: boolean | null;
  imageUrl: string | null;
  isBestseller: boolean;
  badge: string | null;
  rating: number;
}

const DEFAULT_IMAGE = '/images/dishes/dish_48.webp';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Normalize any partial dish (API item or admin form) into the full Dish shape. */
function normalizeDish(input: Partial<Dish> & { name: string; price: number }): Dish {
  const cat = input.categoryId || input.category || 'main-course';
  const key = input.key || input.id || slugify(input.name);
  return {
    key,
    id: input.id || key,
    name: input.name,
    description: input.description ?? '',
    price: Number(input.price) || 0,
    rating: input.rating !== undefined ? input.rating : 4.5,
    isVeg: input.isVeg !== undefined ? input.isVeg : true,
    image: input.image || DEFAULT_IMAGE,
    imageAlt: input.imageAlt || input.name,
    categoryId: cat,
    category: cat,
    badge: input.badge,
    isBestseller: input.isBestseller,
    sizes: input.sizes,
    discountPrice: input.discountPrice,
    inStock: input.inStock !== undefined ? input.inStock : true,
  };
}

function apiToDish(item: ApiMenuItem): Dish {
  return normalizeDish({
    key: item.id,
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    price: item.price,
    rating: item.rating,
    isVeg: item.isVeg ?? true,
    image: item.imageUrl || DEFAULT_IMAGE,
    imageAlt: item.name,
    categoryId: item.category,
    badge: item.badge ?? undefined,
    isBestseller: item.isBestseller,
    inStock: item.isAvailable,
  });
}

interface MenuContextValue {
  dishes: Dish[];
  categories: Category[];
  combos: Combo[];
  /** True once the first /api/menu fetch for the selected branch has finished. */
  isHydrated: boolean;
  getDishById: (idOrKey: string) => Dish | undefined;
  getDishesByCategory: (categoryId: string) => Dish[];
  /**
   * Admin-panel editing helpers. NOTE: these mutate the in-memory list only
   * (session-scoped) until the admin phase wires them to the real admin API
   * routes (src/app/api/admin/menu-items/*) — they exist so the existing admin
   * UI keeps compiling and working, not as the source of truth.
   */
  addDish: (dishData: Partial<Dish> & { name: string; price: number; categoryId: string }) => Dish;
  updateDish: (idOrKey: string, updates: Partial<Dish>) => void;
  deleteDish: (idOrKey: string) => void;
  toggleStock: (idOrKey: string) => void;
  /** Re-fetch the menu from the API (discards any in-memory edits). */
  resetMenu: () => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

export function MenuProvider({ children }: { children: React.ReactNode }) {
  // Menu is branch-scoped: re-fetch whenever the selected branch changes.
  const { selectedBranch } = useBranches();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const branchId = selectedBranch?.id ?? null;

  useEffect(() => {
    // Wait until branches have loaded and a branch is selected.
    if (!branchId) return;
    let cancelled = false;
    setIsHydrated(false);
    setDishes([]);

    fetch(`/api/menu?branchId=${encodeURIComponent(branchId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`menu request failed (${res.status})`);
        const body = await res.json().catch(() => null);
        if (!body || !Array.isArray(body.items)) throw new Error('unexpected response');
        if (cancelled) return;
        setDishes(body.items.map(apiToDish));
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Failed to load menu for branch', branchId, err);
        setDishes([]);
      })
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, attempt]);

  const getDishById = useCallback(
    (idOrKey: string) => dishes.find((d) => d.id === idOrKey || d.key === idOrKey),
    [dishes]
  );

  const getDishesByCategory = useCallback(
    (categoryId: string) =>
      dishes.filter((d) => d.categoryId === categoryId || d.category === categoryId),
    [dishes]
  );

  const addDish = useCallback(
    (dishData: Partial<Dish> & { name: string; price: number; categoryId: string }) => {
      const newDish = normalizeDish(dishData);
      setDishes((prev) => [newDish, ...prev]);
      return newDish;
    },
    []
  );

  const updateDish = useCallback((idOrKey: string, updates: Partial<Dish>) => {
    setDishes((prev) =>
      prev.map((d) => {
        if (d.id === idOrKey || d.key === idOrKey) {
          return normalizeDish({ ...d, ...updates });
        }
        return d;
      })
    );
  }, []);

  const deleteDish = useCallback((idOrKey: string) => {
    setDishes((prev) => prev.filter((d) => d.id !== idOrKey && d.key !== idOrKey));
  }, []);

  const toggleStock = useCallback((idOrKey: string) => {
    setDishes((prev) =>
      prev.map((d) => {
        if (d.id === idOrKey || d.key === idOrKey) {
          return { ...d, inStock: !(d.inStock !== false) };
        }
        return d;
      })
    );
  }, []);

  const resetMenu = useCallback(() => {
    setAttempt((a) => a + 1);
  }, []);

  const value = useMemo<MenuContextValue>(
    () => ({
      dishes,
      categories,
      combos,
      isHydrated,
      getDishById,
      getDishesByCategory,
      addDish,
      updateDish,
      deleteDish,
      toggleStock,
      resetMenu,
    }),
    [
      dishes,
      isHydrated,
      getDishById,
      getDishesByCategory,
      addDish,
      updateDish,
      deleteDish,
      toggleStock,
      resetMenu,
    ]
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu() {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
}
