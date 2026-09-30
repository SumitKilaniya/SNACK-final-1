// Validate required env vars at server startup (throws one clear error naming
// the missing var; never runs during `next build`). Kept first so it evaluates
// before any other module in this graph.
import '@/lib/env';

import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google';
import AppProviders from './AppProviders';
import '../styles/tailwind.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-playfair-display',
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
    <html lang="en" className={`${plusJakartaSans.variable} ${playfairDisplay.variable}`}>
      <body className={plusJakartaSans.className}>
        <AppProviders>{children}</AppProviders>

        {/* Root Layout */}
      </body>
    </html>
  );
}
