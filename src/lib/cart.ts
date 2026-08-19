import { prisma } from '@/lib/auth/prisma';
import { ApiError } from '@/lib/auth/errors';
import { resolveItems } from '@/lib/catalog';

/** Flat delivery fee, ₹ — kept in sync with the frontend DELIVERY_FEE. */
export const DELIVERY_FEE = 40;

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

/**
 * Pure price/total math — the single place subtotal/total are computed, so
 * the high-cost-of-bug pricing logic is unit-testable without a database.
 * Discount is applied as-is; callers cap it (coupon validation) before use.
 */
export function computeLineTotals(
  lines: PricedLine[],
  deliveryFee = DELIVERY_FEE,
  discount = 0
): { subtotal: number; deliveryFee: number; discount: number; total: number } {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const total = subtotal + deliveryFee - discount;
  return { subtotal, deliveryFee, discount, total };
}

export interface CartLine {
  itemId: string;
  name: string;
  quantity: number;
  /** Effective unit price for the cart's branch (override ?? base). */
  unitPrice: number;
  total: number;
  isAvailable: boolean;
}

export interface CartSummary {
  branchId: string;
  branchName: string;
  branchCity: string | null;
  items: CartLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}

export async function getOrCreateCart(userId: string, branchId?: string) {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;

  let target = branchId;
  if (!target) {
    const first = await prisma.branch.findFirst({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    if (!first) throw new ApiError(503, 'No active branch', 'NO_BRANCH');
    target = first.id;
  }

  return prisma.cart.create({ data: { userId, branchId: target } });
}

/**
 * Add (or increment) an item in the user's cart.
 * If the caller explicitly passes a different branchId, the cart switches to
 * that branch and its previous items are cleared (`cleared: true` tells the
 * UI it can warn the customer). Prices are never stored on the cart — they are
 * recomputed from the catalog on every read (see computeCartSummary).
 */
export async function addItemToCart(
  userId: string,
  itemId: string,
  quantity = 1,
  opts: { branchId?: string } = {}
): Promise<{ summary: CartSummary; cleared: boolean }> {
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!item || !item.isAvailable) {
    throw new ApiError(404, 'Item not found', 'ITEM_NOT_FOUND');
  }

  const cart = await getOrCreateCart(userId, opts.branchId);
  let cleared = false;

  if (opts.branchId && opts.branchId !== cart.branchId) {
    const target = await prisma.branch.findUnique({ where: { id: opts.branchId } });
    if (!target || !target.isActive) throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
      prisma.cart.update({ where: { id: cart.id }, data: { branchId: target.id } }),
    ]);
    cleared = true;
  }

  // Item must be offered at the cart's branch (master + override availability).
  const override = await prisma.branchMenuOverride.findUnique({
    where: { branchId_itemId: { branchId: cart.branchId, itemId } },
  });
  if (!(item.isAvailable && (override ? override.isAvailable : true))) {
    throw new ApiError(409, 'This item is not available at the selected branch', 'ITEM_UNAVAILABLE');
  }

  await prisma.cartItem.upsert({
    where: { cartId_itemId: { cartId: cart.id, itemId } },
    update: { quantity: { increment: quantity } },
    create: { cartId: cart.id, itemId, quantity },
  });

  const summary = await computeCartSummary(userId);
  if (!summary) throw new ApiError(500, 'Cart could not be loaded', 'INTERNAL');
  return { summary, cleared };
}

/** Set a line's quantity (0 removes it). */
export async function setCartQuantity(userId: string, itemId: string, quantity: number) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new ApiError(404, 'Cart is empty', 'CART_EMPTY');

  const line = await prisma.cartItem.findUnique({
    where: { cartId_itemId: { cartId: cart.id, itemId } },
  });
  if (!line) throw new ApiError(404, 'Item not in cart', 'ITEM_NOT_IN_CART');

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: line.id } });
  } else {
    await prisma.cartItem.update({ where: { id: line.id }, data: { quantity } });
  }
}

/** Remove a single line from the cart. */
export async function removeCartItem(userId: string, itemId: string) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new ApiError(404, 'Cart is empty', 'CART_EMPTY');
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, itemId } });
}

/** Empty the cart entirely. */
export async function clearCart(userId: string) {
  await prisma.cart.deleteMany({ where: { userId } });
}

/** Switch the cart to another branch, clearing previous items. */
export async function switchCartBranch(userId: string, branchId: string) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch || !branch.isActive) throw new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND');

  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (cart && cart.branchId === branchId) return;

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart?.id ?? '' } }),
    prisma.cart.upsert({
      where: { userId },
      update: { branchId },
      create: { userId, branchId },
    }),
  ]);
}

/**
 * Recompute the whole cart from the catalog, server-side, every time.
 * Unit prices use the branch's effective price (override ?? base). Nothing a
 * client sends (prices, totals) is ever trusted here.
 */
export async function computeCartSummary(userId: string): Promise<CartSummary | null> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { branch: true, items: true },
  });
  if (!cart) return null;

  const catalog = await prisma.menuItem.findMany({
    include: { overrides: { where: { branchId: cart.branchId } } },
  });
  const byId = new Map(resolveItems(catalog).map((i) => [i.id, i]));

  const lines: CartLine[] = [];
  for (const ci of cart.items) {
    const eff = byId.get(ci.itemId);
    const unitPrice = eff ? eff.price : 0;
    const isAvailable = eff ? eff.isAvailable : false;
    lines.push({
      itemId: ci.itemId,
      name: eff?.name ?? 'Unknown item',
      quantity: ci.quantity,
      unitPrice,
      total: unitPrice * ci.quantity,
      isAvailable,
    });
  }

  const { subtotal, deliveryFee, total } = computeLineTotals(lines, DELIVERY_FEE);
  return {
    branchId: cart.branchId,
    branchName: cart.branch.name,
    branchCity: cart.branch.city,
    items: lines,
    subtotal,
    deliveryFee,
    total,
  };
}
