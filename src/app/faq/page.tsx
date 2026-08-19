import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function FaqPage() {
  return (
    <PolicyPage
      title="Frequently Asked Questions"
      icon="❓"
      subtitle="Quick answers to the things people ask us most."
      updated="6 August 2026"
      faq
      sections={[
        {
          heading: 'How long does delivery take?',
          paragraphs: [
            'Most orders arrive within 30–40 minutes of placing them. During peak hours it can take a little longer — you can follow your order live on the Orders page.',
          ],
        },
        {
          heading: 'What are your delivery hours?',
          paragraphs: [
            'We deliver every day from 10:00 AM to 11:30 PM. Orders placed after 11:00 PM are scheduled for the next morning.',
          ],
        },
        {
          heading: 'How do I apply an offer code?',
          paragraphs: [
            'Head to the Offers page, copy a code (or use “Order now” to apply it automatically), then paste it into the coupon box at checkout. Big offers need a riddle solved first — answers are case-insensitive, so relax!',
          ],
        },
        {
          heading: 'Can I cancel or modify my order?',
          paragraphs: [
            'Yes — as long as the kitchen hasn’t started preparing it. Once preparation begins, the order can no longer be cancelled, but you can contact support for a refund if something goes wrong.',
          ],
        },
        {
          heading: 'Do you deliver outside Bangalore?',
          paragraphs: [
            'Not yet. We currently deliver across Koramangala, HSR Layout, and surrounding areas, with new zones coming soon.',
          ],
        },
        {
          heading: 'How does the veg filter work?',
          paragraphs: [
            'The veg-only toggle on the menu page hides every non-vegetarian dish instantly. All veg dishes carry a green square mark (FSSAI standard), and non-veg dishes carry a red one.',
          ],
        },
        {
          heading: 'What payment methods do you accept?',
          paragraphs: [
            'Cash on Delivery, UPI (GPay, PhonePe, Paytm), and online card payments via Razorpay. All online payments are encrypted and secure.',
          ],
        },
        {
          heading: 'I have a food allergy — what should I know?',
          paragraphs: [
            'We list the main ingredients for every dish, but our kitchens handle nuts, dairy, gluten and more. If you have a serious allergy, please call us before ordering so we can advise on safe options.',
          ],
        },
      ]}
    />
  );
}
