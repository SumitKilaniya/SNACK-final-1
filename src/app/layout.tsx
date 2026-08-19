// Validate required env vars at server startup (throws one clear error naming
// the missing var; never runs during `next build`). Kept first so it evaluates
// before any other module in this graph.
import '@/lib/env';

import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { CartProvider } from '@/lib/cart-context';
import { WishlistProvider } from '@/lib/wishlist-context';
import { ToastProvider } from '@/lib/toast-context';
import { OrdersProvider } from '@/lib/orders-context';
import { ReviewsProvider } from '@/lib/reviews-context';
import { MenuProvider } from '@/lib/menu-context';
import { OffersProvider } from '@/lib/offers-context';
import { BranchesProvider } from '@/lib/branches-context';
import GlobalFloatingCart from '@/app/menu/components/FloatingCart';
import CartDrawer from '@/components/CartDrawer';
import '../styles/tailwind.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Snack-Pod — Order Burgers, Combos & More',
  description:
    'Order your favourite snacks, combos, and meals from Snack-Pod. Delivery, pickup, or dine-in — fresh food fast across Bangalore outlets.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className={plusJakartaSans.className}>
        <AuthProvider>
          {/* Branches above Menu: the menu is branch-scoped, so MenuProvider
              reads the selected branch from BranchesProvider. */}
          <BranchesProvider>
            <MenuProvider>
              <OffersProvider>
                <OrdersProvider>
                  <ReviewsProvider>
                    {/* ToastProvider above CartProvider: the cart context shows
                        toasts (guest-cart merge outcomes, branch-switch clears). */}
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

        {/* Root Layout */}
      </body>
    </html>
  );
}
