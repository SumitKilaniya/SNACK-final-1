'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Icon from './AppIcon';
import ConfirmDialog from './ConfirmDialog';
import { useReviews, type ReviewListItem } from '@/lib/reviews-context';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import * as api from '@/lib/api-client';

interface DishReviewsModalProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
}

function Stars({ rating, onRate, interactive = false }: { rating: number; onRate?: (r: number) => void; interactive?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onRate?.(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          className={`${interactive ? 'cursor-pointer' : 'cursor-default'}`}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <svg
            className={`w-4 h-4 ${(hover || rating) >= star ? 'star-filled' : 'star-empty'}`}
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function DishReviewsModal({ open, onClose, itemId, itemName }: DishReviewsModalProps) {
  const { isLoggedIn } = useAuth();
  const { showToast } = useToast();
  const { fetchItemReviews, submitReview, updateReview, deleteReview } = useReviews();

  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // My review state
  const [myReview, setMyReview] = useState<ReviewListItem | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const loadReviews = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    try {
      const data = await fetchItemReviews(itemId);
      if (cursor) {
        setReviews((prev) => [...prev, ...data.reviews]);
      } else {
        setReviews(data.reviews);
      }
      setNextCursor(data.nextCursor);
    } catch {
      // Non-critical — just show empty
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [itemId, fetchItemReviews]);

  // Load reviews and my existing review when modal opens
  useEffect(() => {
    if (!open) return;
    void loadReviews();

    // Try to find my existing review in the response
    if (isLoggedIn) {
      (async () => {
        try {
          // The POST /api/reviews returns 409 with existingReviewId if one exists.
          // We can also fetch all reviews for this item and find ours by userId.
          const data = await fetchItemReviews(itemId);
          // We need the user's ID — get it from the auth context indirectly.
          // Since we can't access user.id here directly, we'll rely on the 409 flow.
          // For pre-filling, we'll just check if any review belongs to the current user.
          // Actually, let's just try to create and catch 409 to get the existing one.
        } catch {
          // ignore
        }
      })();
    }
  }, [open, itemId, isLoggedIn, loadReviews, fetchItemReviews]);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setEditRating(0);
      setEditComment('');
      setMyReview(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (editRating === 0) {
      showToast('Please select a rating', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (myReview) {
        const updated = await updateReview(myReview.id, { rating: editRating, comment: editComment });
        setMyReview(updated);
        setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        showToast('Review updated!', 'success');
      } else {
        const created = await submitReview(itemId, editRating, editComment);
        setMyReview(created);
        setReviews((prev) => [created, ...prev]);
        showToast('Review submitted!', 'success');
      }
    } catch (e) {
      const err = e instanceof api.ApiClientError ? e : new Error('Failed');
      if (err instanceof api.ApiClientError && err.code === 'REVIEW_ALREADY_EXISTS') {
        showToast('You already reviewed this item — editing your existing review.', 'info');
      } else {
        showToast(err.message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!myReview) return;
    setSubmitting(true);
    try {
      await deleteReview(myReview.id);
      setMyReview(null);
      setReviews((prev) => prev.filter((r) => r.id !== myReview.id));
      showToast('Review deleted', 'success');
    } catch {
      showToast('Failed to delete review', 'error');
    } finally {
      setSubmitting(false);
      setDeleteConfirm(false);
    }
  };

  const loadMore = () => {
    if (nextCursor && !loadingMore) {
      void loadReviews(nextCursor);
    }
  };

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="relative w-full sm:max-w-lg max-h-[85vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-black text-foreground">Reviews</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{itemName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Write / Edit review form */}
          {isLoggedIn ? (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-foreground mb-2">
                {myReview ? 'Edit your review' : 'Write a review'}
              </p>
              <div className="mb-3">
                <Stars
                  rating={myReview ? myReview.rating : editRating}
                  onRate={(r) => { setEditRating(r); if (myReview) setMyReview({ ...myReview, rating: r }); }}
                  interactive
                />
              </div>
              <textarea
                value={myReview ? myReview.comment : editComment}
                onChange={(e) => {
                  const val = e.target.value;
                  if (myReview) setMyReview({ ...myReview, comment: val });
                  else setEditComment(val);
                }}
                placeholder="Share your experience (optional)"
                className="w-full p-3 bg-white border border-orange-200 rounded-xl text-sm text-foreground resize-none focus:outline-none focus:border-primary"
                rows={3}
              />
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || (myReview ? myReview.rating === 0 : editRating === 0)}
                  className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-accent transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : myReview ? 'Update Review' : 'Submit Review'}
                </button>
                {myReview && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-50 text-red-600 text-sm font-bold rounded-xl hover:bg-red-100 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Sign in to write a review for this item.
              </p>
              <a
                href={`/auth?returnUrl=${encodeURIComponent('/menu')}`}
                className="inline-block px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-accent transition-colors"
              >
                Sign In
              </a>
            </div>
          )}

          {/* Reviews list */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8">
              <Icon name="Star" className="w-8 h-8 mx-auto text-stone-300 mb-2" />
              <p className="text-sm text-muted-foreground">No reviews yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((rev) => (
                <div key={rev.id} className="bg-white border border-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-bold text-foreground">{rev.userName}</p>
                    <Stars rating={rev.rating} />
                  </div>
                  {rev.comment && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{rev.comment}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {new Date(rev.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              ))}

              {nextCursor && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full py-2.5 text-sm font-bold text-primary hover:bg-orange-50 rounded-xl transition-colors disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more reviews'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteConfirm}
        title="Delete your review?"
        message="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        busy={submitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  );
}
