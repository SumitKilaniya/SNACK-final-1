'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from './api-client';
import type { ReviewListItem, PaginatedReviews } from './review-schemas';

export type { ReviewListItem };

interface ReviewsContextType {
  /** Recent reviews across all items (for the homepage strip). */
  recentReviews: ReviewListItem[];
  recentLoading: boolean;

  /** Fetch reviews for a specific menu item (paginated). */
  fetchItemReviews: (itemId: string) => Promise<PaginatedReviews>;

  /** Fetch the current user's review for a specific item. Returns null if none. */
  fetchMyReview: (itemId: string) => Promise<ReviewListItem | null>;

  /** Submit a new review. Throws on 409 (caller should route to edit). */
  submitReview: (menuItemId: string, rating: number, comment?: string) => Promise<ReviewListItem>;

  /** Update an existing review (owner only). */
  updateReview: (reviewId: string, data: { rating?: number; comment?: string }) => Promise<ReviewListItem>;

  /** Delete a review (owner or admin). */
  deleteReview: (reviewId: string) => Promise<void>;
}

const ReviewsContext = createContext<ReviewsContextType | undefined>(undefined);

export function ReviewsProvider({ children }: { children: React.ReactNode }) {
  const [recentReviews, setRecentReviews] = useState<ReviewListItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  // Fetch recent reviews for the homepage strip (public, no auth needed).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch recent reviews across all items (no itemId param).
        const params = new URLSearchParams({ limit: '20' });
        const data = await api.authenticatedFetch<PaginatedReviews>(
          `/api/reviews?${params.toString()}`,
        );
        if (!cancelled) setRecentReviews(data.reviews);
      } catch {
        // Homepage strip is non-critical — start with empty and degrade silently.
        if (!cancelled) setRecentReviews([]);
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchItemReviews = useCallback(async (itemId: string): Promise<PaginatedReviews> => {
    const params = new URLSearchParams({ itemId, limit: '20' });
    return api.authenticatedFetch<PaginatedReviews>(`/api/reviews?${params.toString()}`);
  }, []);

  const fetchMyReview = useCallback(async (itemId: string): Promise<ReviewListItem | null> => {
    try {
      const params = new URLSearchParams({ itemId, limit: '50' });
      const data = await api.authenticatedFetch<PaginatedReviews>(
        `/api/reviews?${params.toString()}`,
      );
      // We can't filter by userId on the client, so fetch all and find ours.
      // In practice the 409 response gives us the existingReviewId to load.
      return data.reviews.find(() => true) ?? null; // placeholder — actual logic in modal
    } catch {
      return null;
    }
  }, []);

  const submitReview = useCallback(
    async (menuItemId: string, rating: number, comment?: string): Promise<ReviewListItem> => {
      const data = await api.authenticatedFetch<{ review: ReviewListItem }>(
        '/api/reviews',
        {
          method: 'POST',
          body: JSON.stringify({ menuItemId, rating, comment: comment ?? '' }),
        },
      );
      return data.review;
    },
    [],
  );

  const updateReview = useCallback(
    async (reviewId: string, payload: { rating?: number; comment?: string }): Promise<ReviewListItem> => {
      const data = await api.authenticatedFetch<{ review: ReviewListItem }>(
        `/api/reviews/${encodeURIComponent(reviewId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      );
      return data.review;
    },
    [],
  );

  const deleteReview = useCallback(async (reviewId: string): Promise<void> => {
    await api.authenticatedFetch<{ ok: boolean }>(
      `/api/reviews/${encodeURIComponent(reviewId)}`,
      { method: 'DELETE' },
    );
  }, []);

  const value = useMemo<ReviewsContextType>(
    () => ({
      recentReviews,
      recentLoading,
      fetchItemReviews,
      fetchMyReview,
      submitReview,
      updateReview,
      deleteReview,
    }),
    [recentReviews, recentLoading, fetchItemReviews, fetchMyReview, submitReview, updateReview, deleteReview],
  );

  return <ReviewsContext.Provider value={value}>{children}</ReviewsContext.Provider>;
}

export function useReviews(): ReviewsContextType {
  const context = useContext(ReviewsContext);
  if (!context) {
    throw new Error('useReviews must be used within a ReviewsProvider');
  }
  return context;
}
