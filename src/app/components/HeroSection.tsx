'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!sectionRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const animStyle = isVisible ? {} : { animationPlayState: 'paused' };

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-gradient-to-br from-[#FFF8F3] via-[#FFF3EC] to-[#FEF0E8] min-h-[88vh] flex items-center"
    >
      {/* Subtle background blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-accent/8 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 w-full py-16 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left — Text Content */}
          <div className="order-2 lg:order-1 text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-primary/20 rounded-full px-4 py-1.5 mb-6 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold text-primary tracking-widest uppercase">
                Now Open · Bangalore
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-foreground leading-[1.1] mb-5">
              Snack Smarter,{' '}
              <span className="relative inline-block">
                <span className="text-primary">Live Better</span>
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  height="6"
                  viewBox="0 0 200 6"
                  fill="none"
                >
                  <path
                    d="M0 3 Q50 0 100 3 Q150 6 200 3"
                    stroke="#C2410C"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-8 max-w-md mx-auto lg:mx-0">
              Fresh, bold flavors crafted for the next generation. From crispy bites to hearty meals
              — delivered fast, made with love.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-10">
              <Link
                href="/menu"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-gradient-to-r from-primary to-accent text-white font-bold rounded-2xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-200 text-sm"
              >
                Explore Menu
                <span className="text-base">→</span>
              </Link>
              <Link
                href="/offers"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-foreground font-semibold rounded-2xl border border-border shadow-sm hover:border-primary/40 hover:shadow-md transition-all duration-200 text-sm"
              >
                View Offers 🎁
              </Link>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-6 justify-center lg:justify-start">
              <div className="text-center">
                <p className="text-2xl font-black text-foreground">100+</p>
                <p className="text-xs text-muted-foreground font-medium">Menu Items</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-black text-foreground">4.8★</p>
                <p className="text-xs text-muted-foreground font-medium">Avg Rating</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="text-center">
                <p className="text-2xl font-black text-foreground">30min</p>
                <p className="text-xs text-muted-foreground font-medium">Avg Delivery</p>
              </div>
            </div>
          </div>

          {/* Right — 3D Spinning Dish */}
          <div className="order-1 lg:order-2 flex items-center justify-center relative py-10">
            {/* Outer decorative rings */}
            <div
              className="absolute w-[440px] h-[440px] sm:w-[600px] sm:h-[600px] rounded-full border-2 border-dashed border-primary/15 hero-ring animate-[spin_30s_linear_infinite]"
              style={animStyle}
            />
            <div
              className="absolute w-[360px] h-[360px] sm:w-[520px] sm:h-[520px] rounded-full border border-primary/10 hero-ring animate-[spin_20s_linear_infinite_reverse]"
              style={animStyle}
            />

            {/* Dish stage — CSS perspective makes the subtle tilt read as real depth */}
            <div
              className="relative w-[360px] h-[360px] sm:w-[500px] sm:h-[500px]"
              style={{ perspective: '1400px' }}
            >
              {/* The dish — photo stays static; tilt and glare give 3D depth */}
              <div
                className="absolute inset-0 hero-dish-tilt"
                style={{ transformStyle: 'preserve-3d', willChange: 'transform', ...animStyle }}
              >
                <div className="absolute inset-0 rounded-full overflow-hidden shadow-2xl shadow-primary/25">
                  <AppImage
                    src="/images/hero/hero_dish.webp"
                    alt="Delicious food plate with colorful fresh ingredients beautifully arranged on a white plate"
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 640px) 360px, 500px"
                  />
                  {/* Animated light sweep */}
                  <div
                    className="absolute -inset-[15%] hero-dish-glare pointer-events-none"
                    style={animStyle}
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Ground shadow */}
              <div
                className="absolute inset-x-0 mx-auto -bottom-5 w-3/4 h-10 rounded-[50%] bg-primary/20 blur-xl pointer-events-none hero-dish-shadow"
                style={animStyle}
              />
            </div>

            {/* 100+ Items Badge */}
            <div className="absolute bottom-4 left-4 sm:bottom-8 sm:left-6 bg-gradient-to-br from-primary to-accent text-white rounded-2xl px-4 py-3 shadow-xl shadow-primary/30 animate-[fadeInUp_0.8s_ease_forwards]">
              <p className="text-2xl font-black leading-none">100+</p>
              <p className="text-xs font-semibold opacity-90 mt-0.5">ITEMS</p>
            </div>

            {/* Floating food chips */}
            <div className="absolute top-4 right-0 sm:top-8 sm:-right-4 bg-white rounded-2xl px-3 py-2 shadow-lg border border-border animate-[fadeInUp_1s_ease_forwards]">
              <p className="text-xs font-bold text-foreground">🔥 Trending</p>
              <p className="text-[10px] text-muted-foreground">Zinger Combo</p>
            </div>

            <div className="absolute top-1/2 -translate-y-1/2 -right-2 sm:-right-6 bg-white rounded-2xl px-3 py-2 shadow-lg border border-border animate-[fadeInUp_1.2s_ease_forwards]">
              <p className="text-xs font-bold text-green-600">✓ Fresh</p>
              <p className="text-[10px] text-muted-foreground">Daily Made</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40">
        <div className="w-5 h-8 rounded-full border-2 border-foreground flex items-start justify-center pt-1.5">
          <div className="w-1 h-2 bg-foreground rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}
