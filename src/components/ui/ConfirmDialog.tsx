'use client';

import React, { useEffect } from 'react';

/**
 * Minimal reusable confirm dialog — the codebase had no Modal/Dialog
 * component, so this follows the same fixed-overlay pattern already used by
 * CartDrawer and the Header's mobile drawer (backdrop + centered card).
 * Rendered by callers via a `open` prop (e.g. the cart context's branch-switch
 * confirmation).
 */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Disables both buttons while the confirmed action is running. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Close on Escape, matching CartDrawer's behavior.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop — click to cancel */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-border p-6 animate-fade-in-up"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="w-11 h-11 rounded-full bg-orange-50 text-primary flex items-center justify-center text-xl mb-3">
          ⚠️
        </div>
        <h3 className="text-base font-black text-foreground mb-2">{title}</h3>
        <div className="text-sm text-muted-foreground leading-relaxed mb-6">{message}</div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2.5 px-3 border border-border rounded-xl text-sm font-bold text-foreground hover:bg-secondary transition-colors disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-2.5 px-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-accent transition-colors disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
