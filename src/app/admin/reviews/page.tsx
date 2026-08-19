'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/lib/toast-context';
import Icon from '@/components/ui/AppIcon';
import * as api from '@/lib/api-client';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface AdminReview {
  id: string;
  rating: number;
  comment: string;
  isHidden: boolean;
  createdAt: string;
  user: { id: string; name: string; email: string };
  menuItem: { id: string; name: string };
}

export default function AdminReviewsPage() {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [hideConfirmId, setHideConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchReviews = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (q) params.set('search', q);
      const data = await api.authenticatedFetch<{
        reviews: AdminReview[];
        total: number;
        nextCursor: string | null;
      }>(`/api/admin/reviews?${params.toString()}`);
      setReviews(data.reviews);
      setTotal(data.total);
    } catch (e) {
      showToast('Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchReviews(search);
  };

  const handleToggleHide = async (reviewId: string, currentlyHidden: boolean) => {
    setBusy(true);
    try {
      await api.authenticatedFetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isHidden: !currentlyHidden }),
      });
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, isHidden: !r.isHidden } : r)),
      );
      showToast(currentlyHidden ? 'Review is now visible' : 'Review hidden from customers');
    } catch {
      showToast('Failed to update review', 'error');
    } finally {
      setBusy(false);
      setHideConfirmId(null);
    }
  };

  const handleDelete = async (reviewId: string) => {
    setBusy(true);
    try {
      await api.authenticatedFetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
        method: 'DELETE',
      });
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      setTotal((prev) => prev - 1);
      showToast('Review permanently deleted');
    } catch {
      showToast('Failed to delete review', 'error');
    } finally {
      setBusy(false);
      setDeleteConfirmId(null);
    }
  };

  const filteredReviews = search
    ? reviews.filter((r) => {
        const text = (r.user.name + ' ' + r.comment + ' ' + r.menuItem.name).toLowerCase();
        return text.includes(search.toLowerCase());
      })
    : reviews;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-primary tracking-wider uppercase bg-primary/10 px-2.5 py-1 rounded-full">
            Content Moderation
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-1">Review Moderation System</h1>
          <p className="text-xs text-slate-500 mt-1">
            Audit customer reviews &amp; ratings. Hide or delete inappropriate content.
          </p>
        </div>
        <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 border border-slate-200">
          Total Reviews: {total}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Icon name="Search" className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by author, comment or dish..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-primary"
          />
        </div>
      </form>

      {/* Reviews Grid */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 mt-3">Loading reviews…</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
          <Icon name="Star" className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-semibold text-slate-600 text-sm">No reviews found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReviews.map((rev) => (
            <div
              key={rev.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between space-y-3 ${
                rev.isHidden ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200">
                      {rev.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{rev.user.name}</h4>
                      <p className="text-[10px] text-slate-400">
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {rev.isHidden && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                        HIDDEN
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 text-amber-500 font-bold text-xs">
                      <Icon name="Star" className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{rev.rating}.0</span>
                    </div>
                  </div>
                </div>

                <span className="inline-block bg-slate-100 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded mb-2">
                  Dish: {rev.menuItem.name}
                </span>

                <p className="text-slate-700 text-xs leading-relaxed italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                  &quot;{rev.comment}&quot;
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setHideConfirmId(rev.id)}
                  disabled={busy}
                  className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Icon name="EyeOffIcon" className="w-3.5 h-3.5" />
                  {rev.isHidden ? 'Unhide' : 'Hide'}
                </button>
                <button
                  onClick={() => setDeleteConfirmId(rev.id)}
                  disabled={busy}
                  className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Icon name="Trash2" className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hide/Unhide Confirmation */}
      {hideConfirmId && (
        <ConfirmDialog
          open
          title={reviews.find((r) => r.id === hideConfirmId)?.isHidden ? 'Unhide this review?' : 'Hide this review?'}
          message="Hidden reviews are excluded from the public listing and rating aggregate."
          confirmLabel={reviews.find((r) => r.id === hideConfirmId)?.isHidden ? 'Unhide' : 'Hide'}
          cancelLabel="Cancel"
          busy={busy}
          onConfirm={() => {
            const rev = reviews.find((r) => r.id === hideConfirmId);
            if (rev) void handleToggleHide(rev.id, rev.isHidden);
          }}
          onCancel={() => setHideConfirmId(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <ConfirmDialog
          open
          title="Permanently delete this review?"
          message="This cannot be undone. The review will be removed from the database entirely."
          confirmLabel="Delete permanently"
          cancelLabel="Cancel"
          busy={busy}
          onConfirm={() => void handleDelete(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}
