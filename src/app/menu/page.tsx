import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MenuPageClient from '@/app/menu/components/MenuPageClient';

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; wishlist?: string; dish?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <MenuPageClient
          initialSearch={sp.search ?? ''}
          initialWishlistOnly={sp.wishlist === '1' || sp.wishlist === 'true'}
          initialDish={sp.dish ?? ''}
        />
      </main>
      <Footer />
    </div>
  );
}
