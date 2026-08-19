'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import DishCard from '@/components/ui/DishCard';
import { useWishlist } from '@/lib/wishlist-context';
import { useAuth } from '@/lib/auth-context';
import { useMenu } from '@/lib/menu-context';

export default function FavouritesPage() {
  const { isWishlisted } = useWishlist();
  const { isLoggedIn } = useAuth();
  const { dishes } = useMenu();

  const favouritedItems = dishes.filter((item) => isWishlisted(item.id || item.key));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">Your Favourites ❤️</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your saved dishes for quick and easy ordering.
            </p>
          </div>
          <Link
            href="/menu"
            className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-full hover:bg-accent transition-colors btn-spring"
          >
            Explore Menu
          </Link>
        </div>

        {!isLoggedIn ? (
          <div className="text-center py-16 px-6 bg-white rounded-2xl border border-border shadow-sm max-w-lg mx-auto my-8">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              ❤️
            </div>
            <h2 className="text-xl font-extrabold text-foreground mb-2">
              Sign in to view Favourites
            </h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Liking dishes works locally while browsing, but viewing your permanent saved
              collection requires signing into your Snack-Pod account.
            </p>
            <Link
              href="/signin?returnUrl=/favourites"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-sm font-bold rounded-xl hover:bg-[#C94816] transition-all shadow-md shadow-primary/20"
            >
              <Icon name="UserIcon" size={18} />
              <span>Sign In to View Favourites</span>
            </Link>
          </div>
        ) : favouritedItems.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-border max-w-xl mx-auto">
            <p className="text-4xl mb-3">💔</p>
            <h2 className="text-lg font-bold text-foreground mb-1">No favourite dishes yet</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Tap the heart icon on any dish while browsing the menu to save it to your favourites.
            </p>
            <Link
              href="/menu"
              className="inline-block px-6 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-full hover:bg-accent transition-colors"
            >
              Browse Menu
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favouritedItems.map((dish) => (
              <DishCard key={dish.key} dish={dish} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
