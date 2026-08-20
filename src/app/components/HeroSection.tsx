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
      className="relative overflow-hidden min-h-[88vh] flex items-center"
      style={{
        background: 'linear-gradient(135deg, #FAF7F2 0%, #FFF3EC 40%, #FEF0E8 100%)',
      }}
    >
      {/* Luxury radial glow behind headline text — primary at 10% opacity */}
      <div
        className="absolute inset-0 hero-radial-glow pointer-events-none"
        aria-hidden="true"
      />

      {/* Subtle background blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/[0.03] blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-accent/[0.05] blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 w-full py-16 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left — Text Content */}
          <div className="order-2 lg:order-1 text-center lg:text-left">
            {/* Eyebrow badge — tracking-widest micro-copy */}
            <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-full px-5 py-1.5 mb-8 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[11px] font-semibold text-[#736B66] tracking-[0.08em] uppercase">
                Now Open · Bangalore
              </span>
            </div>

            {/* Headline — tracking-tight editorial look */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[4rem] font-black text-foreground leading-[1.05] mb-6" style={{ letterSpacing: '-0.03em' }}>
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
                    stroke="#A83E1B"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#736B66] leading-relaxed mb-10 max-w-md mx-auto lg:mx-0" style={{ letterSpacing: '0.01em' }}>
              Fresh, bold flavors crafted for the next generation. From crispy bites to hearty meals
              — delivered fast, made with love.
            </p>

            {/* CTA Buttons — pill shape, translateY(-2px) hover */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
              <Link
                href="/menu"
                className="btn-pill inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 text-sm"
                style={{ letterSpacing: '0.08em' }}
              >
                Explore Menu
                <span className="text-base">→</span>
              </Link>
              <Link
                href="/offers"
                className="btn-pill inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-foreground font-semibold border border-[rgba(0,0,0,0.06)] shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:border-primary/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] text-sm"
                style={{ letterSpacing: '0.08em' }}
              >
                View Offers
              </Link>
            </div>

            {/* Stats Row — tracking-widest micro-copy */}
            <div className="flex items-center gap-8 justify-center lg:justify-start">
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-foreground">100+</p>
                <p className="text-[11px] text-[#736B66] font-medium tracking-[0.08em] uppercase mt-0.5">Menu Items</p>
              </div>
              <div className="w-px h-10 bg-[rgba(0,0,0,0.08)]" />
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-foreground">4.8★</p>
                <p className="text-[11px] text-[#736B66] font-medium tracking-[0.08em] uppercase mt-0.5">Avg Rating</p>
              </div>
              <div className="w-px h-10 bg-[rgba(0,0,0,0.08)]" />
              <div className="text-center">
                <p className="text-2xl font-display font-bold text-foreground">30min</p>
                <p className="text-[11px] text-[#736B66] font-medium tracking-[0.08em] uppercase mt-0.5">Avg Delivery</p>
              </div>
            </div>
          </div>

          {/* Right — Continuously Rotating Dish */}
          <div className="order-1 lg:order-2 flex items-center justify-center relative py-10">
            {/* Outer decorative rings */}
            <div
              className="absolute w-[440px] h-[440px] sm:w-[600px] sm:h-[600px] rounded-full border-2 border-dashed border-primary/10 hero-ring animate-hero-spin"
              style={animStyle}
            />
            <div
              className="absolute w-[360px] h-[360px] sm:w-[520px] sm:h-[520px] rounded-full border border-primary/[0.07] hero-ring animate-hero-spin-reverse"
              style={animStyle}
            />

            {/* Dish stage — continuous 35s spin */}
            <div
              className="relative w-[360px] h-[360px] sm:w-[500px] sm:h-[500px]"
            >
              {/* The dish — rotates continuously */}
              <div
                className="absolute inset-0 hero-dish-spin"
                style={{ willChange: 'transform', ...animStyle }}
              >
                <div className="absolute inset-0 rounded-full overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.10)]">
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
                className="absolute inset-x-0 mx-auto -bottom-5 w-3/4 h-10 rounded-[50%] bg-primary/15 blur-xl pointer-events-none hero-dish-shadow"
                style={animStyle}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-30">
        <div className="w-5 h-8 rounded-full border-[1.5px] border-foreground/40 flex items-start justify-center pt-1.5">
          <div className="w-1 h-2 bg-foreground/50 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}
