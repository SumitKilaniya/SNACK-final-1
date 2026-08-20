'use client';

import React, { memo, useState } from 'react';
import dynamic from 'next/dynamic';
import AppImage from './AppImage';
import Icon from './AppIcon';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import { useToast } from '@/lib/toast-context';
import { getCategory, type Dish } from '@/lib/menu-data';

const DishReviewsModal = dynamic(() => import('./DishReviewsModal'), { ssr: false });

type Layout = 'grid' | 'compact' | 'row';

interface DishCardProps {
  dish: Dish;
  layout?: Layout;
  className?: string;
  /** Element id — used by the header search autocomplete to scroll to a dish. */
  id?: string;
}

function Stars({ rating, onClick }: { rating: number; onClick?: () => void }) {
  return (
    <div
      className={`flex items-center gap-0.5 ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      aria-label={`Rated ${rating} out of 5`}
      onClick={onClick}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-3 h-3 ${star <= Math.round(rating) ? 'star-filled' : 'star-empty'}`}
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-[10px] font-bold text-muted-foreground ml-0.5">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

/** Wishlist heart — toggles filled/outline instantly and persists via context. */
function WishlistButton({
  dish,
  liked,
  onToggle,
  small = false,
}: {
  dish: Dish;
  liked: boolean;
  onToggle: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={liked ? `Remove ${dish.name} from wishlist` : `Add ${dish.name} to wishlist`}
      aria-pressed={liked}
      title={liked ? 'Remove from wishlist' : 'Add to wishlist'}
      className={`${small ? 'w-7 h-7' : 'w-9 h-9'} rounded-full flex items-center justify-center shadow-md transition-all duration-200 btn-spring ${
        liked
          ? 'bg-white text-red-500'
          : 'bg-white/90 text-muted-foreground hover:text-red-500 hover:bg-white'
      }`}
    >
      <Icon name="HeartIcon" variant={liked ? 'solid' : 'outline'} size={small ? 13 : 16} />
    </button>
  );
}

/** Add-to-cart control: "Add" pill, or a quantity stepper once the dish is in the cart. */
function AddControl({
  dish,
  inCartQty,
  onAdd,
  onUpdateQty,
  round = false,
}: {
  dish: Dish;
  inCartQty: number;
  onAdd: () => void;
  onUpdateQty: (delta: number) => void;
  round?: boolean;
}) {
  if (dish.inStock === false) {
    return (
      <span className="px-3 py-1.5 bg-muted text-muted-foreground text-xs font-bold rounded-full border border-border cursor-not-allowed">
        Out of Stock
      </span>
    );
  }

  if (inCartQty === 0) {
    if (round) {
      return (
        <button
          onClick={onAdd}
          aria-label={`Add ${dish.name} to cart`}
          className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center hover:bg-accent transition-colors btn-spring shadow-[0_4px_12px_rgba(168,62,27,0.25)]"
        >
          <Icon name="ShoppingCartIcon" size={16} />
        </button>
      );
    }
    return (
      <button
        onClick={onAdd}          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-bold text-sm btn-pill hover:bg-accent transition-colors btn-spring"
      >
        <Icon name="PlusIcon" size={14} />
        Add
      </button>
    );
  }

  return (
    <div
      className={`flex items-center ${round ? 'bg-white rounded-full shadow-lg px-1 py-0.5' : 'bg-green-50 border border-green-200 rounded-full px-1 py-0.5'}`}
    >
      <button
        onClick={() => onUpdateQty(-1)}
        aria-label={`Decrease quantity of ${dish.name}`}
        className="w-7 h-7 rounded-full flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors"
      >
        <Icon name="MinusIcon" size={12} />
      </button>
      <span className="w-6 text-center text-sm font-extrabold text-green-700">{inCartQty}</span>
      <button
        onClick={() => onUpdateQty(1)}
        aria-label={`Increase quantity of ${dish.name}`}
        className="w-7 h-7 rounded-full flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors"
      >
        <Icon name="PlusIcon" size={12} />
      </button>
    </div>
  );
}

interface DishCardInnerProps extends DishCardProps {
  inCartQty: number;
  liked: boolean;
  onAdd: () => void;
  onUpdateQty: (delta: number) => void;
  onToggleWishlist: () => void;
  onOpenReviews: () => void;
}

const DishCardInner = memo(function DishCardInner({
  dish,
  layout = 'grid',
  className = '',
  id,
  inCartQty,
  liked,
  onAdd,
  onUpdateQty,
  onToggleWishlist,
  onOpenReviews,
}: DishCardInnerProps) {
  const isOutOfStock = dish.inStock === false;
  const effectivePrice =
    dish.discountPrice && dish.discountPrice < dish.price ? dish.discountPrice : dish.price;
  const hasDiscount = Boolean(dish.discountPrice && dish.discountPrice < dish.price);

  // ── Grid (menu page) ─────────────────────────────────────────────
  if (layout === 'grid') {
    return (
      <div
        id={id}
        className={`bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] overflow-hidden group card-hover flex flex-col isolate shadow-[0_14px_40px_rgba(0,0,0,0.04)] ${
          isOutOfStock ? 'opacity-85' : ''
        } ${className}`}
      >
        <div className="relative z-0 h-40 sm:h-44 overflow-hidden bg-secondary">
          <AppImage
            src={dish.image}
            alt={dish.imageAlt || dish.name}
            fill
            className={`object-cover transition-transform duration-500 ${
              isOutOfStock ? 'grayscale opacity-60' : 'group-hover:scale-105'
            }`}
            sizes="(max-width: 640px) 50vw, 25vw"
          />
          <div className="absolute top-3 left-3">
            <span className={dish.isVeg ? 'badge-veg' : 'badge-nonveg'} />
          </div>
          {isOutOfStock ? (
            <div className="absolute bottom-3 left-3 bg-gray-900/90 text-white text-[10px] font-bold px-2 py-1 rounded">
              Out of Stock
            </div>
          ) : dish.isBestseller ? (
            <div className="absolute bottom-3 left-3 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
              ★ Bestseller
            </div>
          ) : null}
          <div className="absolute top-3 right-3">
            <WishlistButton dish={dish} liked={liked} onToggle={onToggleWishlist} />
          </div>
        </div>
        <div className="p-4 flex flex-col flex-1">
          <h3 className="text-sm font-extrabold text-foreground leading-tight mb-1 line-clamp-1">
            {dish.name}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">
            {dish.description}
          </p>
          <Stars rating={dish.rating} onClick={onOpenReviews} />
          <div className="mt-auto flex items-center justify-between pt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-extrabold text-foreground">₹{effectivePrice}</span>
              {hasDiscount && (
                <span className="text-xs font-semibold text-muted-foreground line-through">
                  ₹{dish.price}
                </span>
              )}
            </div>
            <AddControl dish={dish} inCartQty={inCartQty} onAdd={onAdd} onUpdateQty={onUpdateQty} />
          </div>
        </div>
      </div>
    );
  }

  // ── Compact (home carousels & featured grids) ────────────────────
  if (layout === 'compact') {
    return (
      <div
        id={id}
        className={`flex-none w-44 sm:w-52 bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] overflow-hidden group card-hover shadow-[0_14px_40px_rgba(0,0,0,0.04)] flex flex-col isolate ${
          isOutOfStock ? 'opacity-85' : ''
        } ${className}`}
      >
        <div className="relative z-0 overflow-hidden h-36 sm:h-44 bg-secondary">
          <AppImage
            src={dish.image}
            alt={dish.imageAlt || dish.name}
            fill
            className={`object-cover transition-transform duration-500 ${
              isOutOfStock ? 'grayscale opacity-60' : 'group-hover:scale-105'
            }`}
            sizes="(max-width: 640px) 50vw, 200px"
          />
          <div className="absolute top-2 right-2">
            <WishlistButton dish={dish} liked={liked} onToggle={onToggleWishlist} />
          </div>
          {!isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <AddControl
                dish={dish}
                inCartQty={inCartQty}
                onAdd={onAdd}
                onUpdateQty={onUpdateQty}
                round
              />
            </div>
          )}
          {isOutOfStock ? (
            <div className="absolute bottom-2 left-2 bg-gray-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded">
              Out of Stock
            </div>
          ) : dish.isBestseller ? (
            <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded">
              ★ Bestseller
            </div>
          ) : null}
        </div>
        <div className="p-3 flex flex-col flex-1">
          {dish.badge && (
            <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
              {dish.badge}
            </span>
          )}
          <div className="flex items-center gap-1 mt-0.5 mb-1">
            <span className={dish.isVeg ? 'badge-veg' : 'badge-nonveg'} />
            <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-1">
              {dish.name}
            </h3>
          </div>
          <div className="mt-auto flex items-center justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-extrabold text-foreground">₹{effectivePrice}</span>
              {hasDiscount && (
                <span className="text-[10px] font-semibold text-muted-foreground line-through">
                  ₹{dish.price}
                </span>
              )}
            </div>
            <Stars rating={dish.rating} onClick={onOpenReviews} />
          </div>
        </div>
      </div>
    );
  }

  // ── Row (weekly best sellers, suggestions) ───────────────────────
  return (
    <div
      id={id}
    className={`flex items-center gap-4 bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-4 hover:border-primary/20 hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)] transition-all duration-300 group isolate shadow-[0_14px_40px_rgba(0,0,0,0.04)] ${
      isOutOfStock ? 'opacity-85' : ''
    } ${className}`}
    >
      <div className="relative z-0 w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-secondary">
        <AppImage
          src={dish.image}
          alt={dish.imageAlt || dish.name}
          fill
          className={`object-cover transition-transform duration-300 ${
            isOutOfStock ? 'grayscale opacity-60' : 'group-hover:scale-105'
          }`}
          sizes="80px"
        />
        <div className="absolute top-1 right-1">
          <WishlistButton dish={dish} liked={liked} onToggle={onToggleWishlist} small />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          <span className={dish.isVeg ? 'badge-veg' : 'badge-nonveg'} />
          <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-1">
            {dish.name}
          </h3>
        </div>
        <Stars rating={dish.rating} onClick={onOpenReviews} />
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-sm font-extrabold text-foreground">₹{effectivePrice}</span>
          {hasDiscount && (
            <span className="text-xs font-semibold text-muted-foreground line-through">
              ₹{dish.price}
            </span>
          )}
        </div>
      </div>
      <AddControl dish={dish} inCartQty={inCartQty} onAdd={onAdd} onUpdateQty={onUpdateQty} />
    </div>
  );
});

export default memo(function DishCard({
  dish,
  layout = 'grid',
  className = '',
  id,
}: DishCardProps) {
  const { items, addItem, updateQty } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { showToast } = useToast();
  const [reviewsOpen, setReviewsOpen] = useState(false);

  const dishKey = dish.key || dish.id || '';
  const inCartQty = items[dishKey]?.qty ?? 0;
  const liked = isWishlisted(dishKey);

  const handleAdd = () => {
    if (dish.inStock === false) return;
    const category = getCategory(dish.categoryId);
    const priceToUse =
      dish.discountPrice && dish.discountPrice < dish.price ? dish.discountPrice : dish.price;
    addItem({
      key: dishKey,
      name: dish.name,
      price: priceToUse,
      image: dish.image,
      imageAlt: dish.imageAlt || dish.name,
      variant: category?.name ?? 'Menu item',
    });
    showToast(`${dish.name} added to cart`);
  };

  const handleUpdateQty = (delta: number) => {
    updateQty(dish.key, delta);
    if (delta < 0 && inCartQty === 1) {
      showToast(`${dish.name} removed from cart`, 'info');
    }
  };

  const handleToggleWishlist = () => {
    const added = toggleWishlist(dish.key);
    showToast(
      added ? `${dish.name} added to wishlist` : `${dish.name} removed from wishlist`,
      'info'
    );
  };

  return (
    <>
      <DishCardInner
        dish={dish}
        layout={layout}
        className={className}
        id={id}
        inCartQty={inCartQty}
        liked={liked}
        onAdd={handleAdd}
        onUpdateQty={handleUpdateQty}
        onToggleWishlist={handleToggleWishlist}
        onOpenReviews={() => setReviewsOpen(true)}
      />
      {reviewsOpen && (
        <DishReviewsModal
          open={reviewsOpen}
          onClose={() => setReviewsOpen(false)}
          itemId={dish.id || dish.key}
          itemName={dish.name}
        />
      )}
    </>
  );
});
