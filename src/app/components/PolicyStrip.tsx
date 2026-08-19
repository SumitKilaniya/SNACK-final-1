import React from 'react';
import Icon from '@/components/ui/AppIcon';

const policies = [
  { icon: 'TruckIcon', title: 'Free Shipping Policy', sub: 'Orders ₹500 or more' },
  { icon: 'ArrowPathIcon', title: 'Free Returns Policy', sub: 'Within 30 days' },
  { icon: 'CurrencyRupeeIcon', title: 'Get 20% Off 1 Item Buy', sub: 'When you sign up' },
  { icon: 'PhoneIcon', title: 'We Excellence Support', sub: '24/7 amazing services' },
];

export default function PolicyStrip() {
  return (
    <section className="bg-white border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {policies.map((p) => (
            <div key={p.title} className="flex items-center gap-3 py-2">
              <div className="shrink-0 w-10 h-10 rounded-full border-2 border-primary/20 flex items-center justify-center text-primary">
                <Icon
                  name={p.icon as Parameters<typeof Icon>[0]['name']}
                  size={20}
                  variant="outline"
                />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-tight">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
