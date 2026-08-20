import React from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/app/components/HeroSection';
import PolicyStrip from '@/app/components/PolicyStrip';
import PromoBanners from '@/app/components/PromoBanners';
import CategoryBrowser from '@/app/components/CategoryBrowser';
import TrendingDishes from '@/app/components/TrendingDishes';
import DealBanner from '@/app/components/DealBanner';
import FeaturedFlavors from '@/app/components/FeaturedFlavors';

const WeeklyBestSell = dynamic(() => import('@/app/components/WeeklyBestSell'));
const NewsletterSection = dynamic(() => import('@/app/components/NewsletterSection'));
const ReviewsStrip = dynamic(() => import('@/app/components/ReviewsStrip'));

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <PolicyStrip />
        <PromoBanners />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-16">
          <CategoryBrowser />
          <TrendingDishes />
          <DealBanner />
          <FeaturedFlavors />
          <WeeklyBestSell />
        </div>
        <NewsletterSection />
        {/* Reviews strip — sits between the 40%-off banner and the footer CTA */}
        <ReviewsStrip />
      </main>
      <Footer />
    </div>
  );
}
