import React from 'react';

const policies = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 18H3a1 1 0 01-1-1V7a1 1 0 011-1h10a1 1 0 011 1v11" />
        <path d="M14 9l3 3 3-3" />
        <rect x="6" y="11" width="8" height="7" rx="1" />
        <path d="M18 11h2a1 1 0 011 1v6a1 1 0 01-1 1h-2" />
        <circle cx="10" cy="14.5" r="1.5" />
      </svg>
    ),
    title: 'Free Delivery',
    sub: 'On orders over ₹499',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        <path d="M12 2l3 3M12 2l-3 3" />
      </svg>
    ),
    title: 'Get 20% Off',
    sub: 'On your first order',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
        <path d="M16.5 16.5l5 5" />
      </svg>
    ),
    title: 'Excellence Support',
    sub: '24/7 dedicated service',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    title: '100% Fresh & Hygienic',
    sub: 'Chef-crafted daily',
  },
];

export default function PolicyStrip() {
  return (
    <section className="bg-white border-b border-[rgba(0,0,0,0.06)]">
      <div className="max-w-7xl mx-auto px-4 py-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {policies.map((p) => (
            <div key={p.title} className="flex items-center gap-3 py-2 group">
              <div className="shrink-0 w-11 h-11 rounded-full border border-primary/15 flex items-center justify-center text-primary bg-primary/[0.04] group-hover:bg-primary/[0.08] transition-colors">
                {p.icon}
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground leading-tight" style={{ letterSpacing: '-0.02em' }}>{p.title}</p>
                <p className="text-[11px] text-[#736B66]" style={{ letterSpacing: '0.02em' }}>{p.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
