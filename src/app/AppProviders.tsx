'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth-context';
import { CartProvider } from '@/lib/cart-context';
import { BranchesProvider } from '@/lib/branches-context';
import { MenuProvider } from '@/lib/menu-context';
import { OffersProvider } from '@/lib/offers-context';
import { OrdersProvider } from '@/lib/orders-context';
import { ReviewsProvider } from '@/lib/reviews-context';
import { ToastProvider } from '@/lib/toast-context';
import { WishlistProvider } from '@/lib/wishlist-context';
import GlobalFloatingCart from '@/app/menu/components/FloatingCart';
import CartDrawer from '@/components/CartDrawer';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/admin' || pathname?.startsWith('/admin/')) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <AuthProvider>
      <BranchesProvider>
        <MenuProvider>
          <OffersProvider>
            <OrdersProvider>
              <ReviewsProvider>
                <ToastProvider>
                  <CartProvider>
                    <WishlistProvider>
                      {children}
                      <GlobalFloatingCart />
                      <CartDrawer />
                    </WishlistProvider>
                  </CartProvider>
                </ToastProvider>
              </ReviewsProvider>
            </OrdersProvider>
          </OffersProvider>
        </MenuProvider>
      </BranchesProvider>
    </AuthProvider>
  );
}