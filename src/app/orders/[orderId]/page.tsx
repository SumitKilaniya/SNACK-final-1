import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import OrderTracking from './OrderTracking';

/**
 * Live order confirmation / tracking — the single success destination after
 * checkout. The page is protected by the middleware ('/orders' prefix) and
 * every API it calls is owner-scoped server-side.
 */
export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <OrderTracking orderId={orderId} />
      <Footer />
    </div>
  );
}
