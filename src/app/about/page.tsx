import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function AboutPage() {
  return (
    <PolicyPage
      title="About Us"
      icon="🍔"
      subtitle="Snack-Pod exists to make great food ridiculously easy to get."
      updated="6 August 2026"
      sections={[
        {
          heading: 'Our story',
          paragraphs: [
            'Snack-Pod started in a small Bangalore kitchen with a simple frustration: ordering food online felt slow, impersonal, and often disappointing. We wanted food that arrives fast, tastes bold, and is made by people who care about the details.',
          ],
        },
        {
          heading: 'What we believe',
          paragraphs: [
            'Food is personal. That is why every dish on our menu is built around fresh ingredients, proper technique, and recipes our chefs actually enjoy eating themselves. We obsess over packaging so your order arrives as hot and crispy as the moment it left the pass.',
          ],
          list: [
            'Freshly made to order — nothing sits under a heat lamp',
            'Honest pricing — the number you see is the number you pay',
            'Delivery in about 30 minutes across Bangalore',
          ],
        },
        {
          heading: 'The numbers so far',
          paragraphs: [
            'Since our first order in 2024, we have served over 50,000 hungry customers, earned a 4.8-star average rating, and grown from one kitchen to three. The best is yet to come.',
          ],
        },
      ]}
    />
  );
}
