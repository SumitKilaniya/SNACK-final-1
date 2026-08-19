'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useCart } from '@/lib/cart-context';
import { DELIVERY_FEE, getOfferDiscount } from '@/lib/menu-data';

export default function CartDrawer() {
  const {
    items,
    itemCount,
    subtotal,
    updateQty,
    removeItem,
    updateInstructions,
    appliedOffer,
    isCartDrawerOpen,
    closeCartDrawer,
    hasUnavailableItems,
    cartError,
    isMutating,
  } = useCart();

  const router = useRouter();
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const cartEntries = Object.values(items);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCartDrawerOpen) {
        closeCartDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCartDrawerOpen, closeCartDrawer]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isCartDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCartDrawerOpen]);

  // Price calculations
  const offerUsable = appliedOffer ? subtotal >= appliedOffer.minOrder : false;
  const deliveryFee =
    appliedOffer?.type === 'free-delivery' && offerUsable
      ? 0
      : subtotal >= 499
        ? 0
        : subtotal > 0
          ? DELIVERY_FEE
          : 0;
  const taxes = Math.round(subtotal * 0.05);
  const promoDiscount = appliedOffer && offerUsable ? getOfferDiscount(appliedOffer, subtotal) : 0;
  const total = Math.max(0, subtotal + deliveryFee + taxes - promoDiscount);

  const handleProceedToCheckout = () => {
    closeCartDrawer();
    router.push('/checkout');
  };

  const handleBrowseMenu = () => {
    closeCartDrawer();
    router.push('/menu');
  };

  const startEditingNote = (key: string, currentNote?: string) => {
    setEditingNoteKey(key);
    setNoteInput(currentNote || '');
  };

  const saveNote = (key: string) => {
    updateInstructions(key, noteInput);
    setEditingNoteKey(null);
    setNoteInput('');
  };

  return (
    <>
      {/* Semi-transparent Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] transition-opacity duration-300 ${
          isCartDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeCartDrawer}
        aria-hidden="true"
      />

      {/* Slide-in Cart Drawer Panel */}
      {/* Desktop: Slide in from right (side panel) | Mobile: Slide up from bottom (bottom sheet) */}
      <div
        className={`fixed z-[80] bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col
          bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl
          sm:top-0 sm:bottom-0 sm:left-auto sm:right-0 sm:w-full sm:max-w-md sm:max-h-none sm:rounded-t-none sm:rounded-l-3xl
          ${
            isCartDrawerOpen
              ? 'translate-y-0 sm:translate-y-0 sm:translate-x-0'
              : 'translate-y-full sm:translate-y-0 sm:translate-x-full'
          }`}
        aria-modal="true"
        role="dialog"
        aria-label="Your Cart"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-primary flex items-center justify-center font-black text-sm">
              🛒
            </div>
            <h2 className="text-lg font-black text-foreground">Your Cart</h2>
            <span className="px-2.5 py-0.5 bg-stone-100 text-stone-600 font-bold text-xs rounded-full">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button
            onClick={closeCartDrawer}
            className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-colors"
            aria-label="Close cart drawer"
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {cartEntries.length === 0 ? (
            /* Empty Cart View */
            <div className="py-12 px-4 text-center">
              <div className="w-20 h-20 bg-orange-50 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-black">
                🛒
              </div>
              <h3 className="text-lg font-black text-foreground mb-1">Your cart is empty</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-6 max-w-xs mx-auto">
                Explore our delicious burgers, biryanis, crispy fries, and refreshing beverages.
              </p>
              <button
                onClick={handleBrowseMenu}
                className="px-6 py-3 bg-primary text-white font-extrabold text-xs rounded-xl hover:bg-accent transition-all shadow-md shadow-primary/20 btn-spring"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            /* Cart Items List */
            <div className="space-y-3.5">
              {cartError && (
                <div className="px-3 py-2.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
                  ⚠️ {cartError}
                </div>
              )}
              {cartEntries.map((item) => (
                <div
                  key={item.key}
                  className={`p-3.5 bg-stone-50/80 rounded-2xl border flex flex-col gap-2.5 relative group ${
                    item.isAvailable === false
                      ? 'border-red-200/80'
                      : 'border-stone-200/80'
                  }`}
                >
                  {/* Unavailable line — clear state with its own Remove action */}
                  {item.isAvailable === false && (
                    <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-200/70 rounded-lg px-2.5 py-1.5">
                      <span className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                        ⚠️ No longer available
                      </span>
                      <button
                        onClick={() => removeItem(item.key)}
                        className="text-[11px] font-bold text-red-700 hover:text-red-900 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    {/* Image */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-stone-100 relative">
                      {item.image ? (
                        <AppImage
                          src={item.image}
                          alt={item.imageAlt || item.name}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400 text-lg">
                          🍔
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-foreground truncate">{item.name}</h4>
                      <p className="text-[11px] text-muted-foreground font-medium">
                        ₹{item.price} {item.variant ? `· ${item.variant}` : ''}
                      </p>

                      {/* Per-item Cooking Note / Instructions */}
                      {item.instructions && editingNoteKey !== item.key && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 w-fit">
                          <span>📝 Note: &quot;{item.instructions}&quot;</span>
                          <button
                            onClick={() => startEditingNote(item.key, item.instructions)}
                            className="text-amber-900 font-bold hover:underline ml-1"
                          >
                            Edit
                          </button>
                        </div>
                      )}

                      {!item.instructions && editingNoteKey !== item.key && (
                        <button
                          onClick={() => startEditingNote(item.key)}
                          className="mt-1 text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                        >
                          <span>+ Add cooking instruction</span>
                        </button>
                      )}
                    </div>

                    {/* Quantity Stepper & Price */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div
                        className={`flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5 ${
                          item.isAvailable === false
                            ? 'opacity-50 pointer-events-none'
                            : ''
                        }`}
                      >
                        <button
                          onClick={() => updateQty(item.key, -1)}
                          className="w-6 h-6 rounded flex items-center justify-center text-stone-600 hover:bg-stone-100 transition-colors"
                          aria-label={`Decrease quantity of ${item.name}`}
                        >
                          <Icon name="MinusIcon" size={12} />
                        </button>
                        <span className="w-5 text-center text-xs font-black text-foreground">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => updateQty(item.key, 1)}
                          className="w-6 h-6 rounded flex items-center justify-center text-stone-600 hover:bg-stone-100 transition-colors"
                          aria-label={`Increase quantity of ${item.name}`}
                        >
                          <Icon name="PlusIcon" size={12} />
                        </button>
                      </div>
                      <span className="text-xs font-black text-foreground">
                        ₹{item.price * item.qty}
                      </span>
                    </div>

                    {/* Remove Item Button */}
                    <button
                      onClick={() => removeItem(item.key)}
                      className="p-1 text-stone-400 hover:text-red-600 transition-colors"
                      aria-label={`Remove ${item.name} from cart`}
                    >
                      <Icon name="TrashIcon" size={14} />
                    </button>
                  </div>

                  {/* Inline Instruction Editor */}
                  {editingNoteKey === item.key && (
                    <div className="pt-2 border-t border-stone-200/80 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="e.g., Less spicy, extra cheese, no onion"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-xs border border-stone-200 rounded-lg outline-none focus:border-primary bg-white text-foreground"
                        autoFocus
                      />
                      <button
                        onClick={() => saveNote(item.key)}
                        className="px-2.5 py-1 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-accent"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingNoteKey(null)}
                        className="px-2 text-[11px] text-stone-500 font-semibold hover:text-stone-800"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Price Breakdown Section (Only shown if cart has items) */}
          {cartEntries.length > 0 && (
            <div className="pt-4 border-t border-stone-200 space-y-2 text-xs">
              <p className="font-black text-stone-800 mb-2">Bill Details</p>
              <div className="flex justify-between text-stone-600">
                <span>Item Subtotal ({itemCount} items)</span>
                <span className="font-semibold text-stone-800">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Delivery Fee</span>
                <span className="font-semibold">
                  {deliveryFee === 0 ? (
                    <span className="text-emerald-600 font-black">FREE</span>
                  ) : (
                    `₹${deliveryFee}`
                  )}
                </span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Taxes & Charges (5% GST)</span>
                <span className="font-semibold text-stone-800">₹{taxes}</span>
              </div>
              {appliedOffer && offerUsable && promoDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Coupon Savings ({appliedOffer.code})</span>
                  <span>-₹{promoDiscount}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-foreground pt-2 border-t border-stone-200/80">
                <span>To Pay</span>
                <span className="text-primary text-base">₹{total}</span>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Drawer Footer (Only shown if cart has items) */}
        {cartEntries.length > 0 && (
          <div className="p-4 border-t border-stone-200 bg-white sticky bottom-0 z-10 shrink-0 rounded-b-3xl sm:rounded-b-none shadow-lg">
            {hasUnavailableItems && (
              <p className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
                Some items in your cart are no longer available — remove them to
                continue to checkout.
              </p>
            )}
            <button
              onClick={handleProceedToCheckout}
              disabled={hasUnavailableItems || isMutating}
              className="w-full py-3.5 px-6 bg-primary hover:bg-accent text-white font-black text-sm rounded-xl shadow-lg shadow-primary/25 flex items-center justify-between transition-all btn-spring disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
            >
              <div className="flex items-center gap-2">
                <span>
                  {isMutating
                    ? 'Updating cart…'
                    : hasUnavailableItems
                      ? 'Checkout unavailable'
                      : 'Proceed to Checkout'}
                </span>
                <Icon name="ArrowRightIcon" size={16} />
              </div>
              <span className="text-base font-black">₹{total}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
