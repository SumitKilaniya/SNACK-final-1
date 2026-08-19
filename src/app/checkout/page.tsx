import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CheckoutClient from '@/app/checkout/components/CheckoutClient';

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CheckoutClient />
      <Footer />
    </div>
  );
}
