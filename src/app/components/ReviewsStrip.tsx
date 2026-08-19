'use client';

import React from 'react';
import { useReviews } from '@/lib/reviews-context';

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-3 h-3 ${star <= rating ? 'star-filled' : 'star-empty'}`}
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

/**
 * Continuously, smoothly scrolling strip of customer reviews. The list is
 * duplicated once and the track translates -50% on a loop, so there is no
 * visible jump; hovering pauses the animation so a review can be read.
 */
export default function ReviewsStrip() {
  const { recentReviews, recentLoading } = useReviews();
  const displayReviews = recentReviews.slice(0, 20);

  if (recentLoading || displayReviews.length === 0) {
    return null;
  }

  return (
    <section className="py-10 overflow-hidden bg-background" aria-label="Customer reviews">
      <div className="max-w-7xl mx-auto px-4 mb-4 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg sm:text-xl font-extrabold text-foreground">Loved by locals</h2>
          <span className="text-xs text-muted-foreground">
            {recentReviews.length > 0 && `${recentReviews.length}+ reviews`}
          </span>
        </div>
        {recentReviews.length > 10 && (
          <span className="text-xs font-bold text-primary bg-orange-100 px-2.5 py-1 rounded-full">
            {recentReviews.length} community reviews
          </span>
        )}
      </div>

      <div className="relative marquee-pause">
        {/* Edge fades so cards melt into the page background */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-24 z-10 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-24 z-10 bg-gradient-to-l from-background to-transparent" />

        <div className="marquee-track flex gap-4 w-max">
          {[...displayReviews, ...displayReviews].map((review, i) => (
            <article
              key={`${review.id}-${i}`}
              className="flex-none w-64 sm:w-72 bg-white rounded-xl border border-border shadow-sm px-4 py-3.5"
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-bold text-foreground truncate max-w-[140px]">
                  {review.userName}
                </p>
                <Stars rating={review.rating} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                &ldquo;{review.comment}&rdquo;
              </p>
              {review.menuItemName && (
                <p className="text-[10px] text-primary font-bold mt-1.5 truncate">
                  {review.menuItemName}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
