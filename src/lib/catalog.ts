import { prisma } from '@/lib/auth/prisma';
import type { Branch, BranchMenuOverride, MenuItem } from '@prisma/client';

/**
 * A menu item as a customer sees it: the effective price for the selected
 * branch (override if set, else master base price) and whether it is offered
 * there (master availability AND branch override availability).
 */
export interface EffectiveMenuItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  basePrice: number;
  /** Effective price for this branch — never trust a client-sent price. */
  price: number;
  priceOverridden: boolean;
  isAvailable: boolean;
  isVeg: boolean | null;
  imageUrl: string | null;
  isBestseller: boolean;
  badge: string | null;
  rating: number;
}

/** Parse a branch's stored service area (JSON array, with comma fallback). */
export function parsePincodes(branch: Pick<Branch, 'servicePincodes'>): string[] {
  if (!branch.servicePincodes) return [];
  const raw = branch.servicePincodes.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).map((p) => p.trim()).filter(Boolean);
  } catch {
    // fall through to comma-separated
  }
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Serialize a pincode list into the stored form (canonical JSON). */
export function stringifyPincodes(pincodes: string[]): string {
  return JSON.stringify([...new Set(pincodes.map((p) => p.trim()).filter(Boolean))]);
}

/**
 * Resolve master items + their (already branch-filtered) overrides into the
 * customer-facing shape. The override array is expected to contain at most one
 * row per item for the branch in question.
 */
export function resolveItems(
  items: (MenuItem & { overrides: BranchMenuOverride[] })[]
): EffectiveMenuItem[] {
  return items.map((item) => {
    const override = item.overrides[0];
    const priceOverridden = override != null && override.priceOverride != null;
    const price = priceOverridden ? (override!.priceOverride as number) : item.basePrice;
    const isAvailable = item.isAvailable && (override ? override.isAvailable : true);
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      basePrice: item.basePrice,
      price,
      priceOverridden,
      isAvailable,
      isVeg: item.isVeg,
      imageUrl: item.imageUrl,
      isBestseller: item.isBestseller,
      badge: item.badge,
      rating: item.rating,
    };
  });
}

/**
 * Customer-facing menu for a branch: only items offered there, with the
 * effective price applied. Prices are always recomputed server-side.
 */
export async function getMenuForBranch(branchId: string): Promise<EffectiveMenuItem[]> {
  const items = await prisma.menuItem.findMany({
    include: { overrides: { where: { branchId } } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return resolveItems(items).filter((i) => i.isAvailable);
}
