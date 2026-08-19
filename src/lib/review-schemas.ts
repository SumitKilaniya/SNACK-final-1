import { z } from 'zod';

// ── Review Zod schemas ────────────────────────────────────────────────

export const reviewCreateSchema = z.object({
  menuItemId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const reviewUpdateSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional(),
});

export const reviewListQuerySchema = z.object({
  itemId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminReviewListQuerySchema = z.object({
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});

// ── Wishlist Zod schemas ──────────────────────────────────────────────

export const wishlistAddSchema = z.object({
  menuItemId: z.string().min(1),
});

// ── Review + Wishlist types ───────────────────────────────────────────

export interface ReviewListItem {
  id: string;
  userId: string;
  userName: string;
  menuItemId: string;
  menuItemName: string;
  rating: number;
  comment: string;
  isHidden: boolean;
  createdAt: string;
}

export interface PaginatedReviews {
  reviews: ReviewListItem[];
  nextCursor: string | null;
  total: number;
}
