import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function RefundPage() {
  return (
    <PolicyPage
      title="Refund & Cancellation Policy"
      icon="💳"
      subtitle="What happens when you cancel an order or something goes wrong with delivery."
      updated="6 August 2026"
      disclaimer
      sections={[
        {
          heading: '1. Cancelling an order',
          paragraphs: [
            'You can cancel an order free of charge as long as it has not entered the preparation stage. Once the kitchen starts preparing your food, cancellation is no longer possible, but we will still help you resolve any issue with the order.',
          ],
        },
        {
          heading: '2. Refunds',
          paragraphs: [
            'Refunds are processed to the original payment method within 5–7 business days after approval. For Cash on Delivery orders, we can issue a refund via bank transfer or wallet credit.',
          ],
          list: [
            'Wrong item delivered — full refund for that item',
            'Item missing from your order — full refund for that item',
            'Order arrived damaged or inedible — full refund or replacement',
            'Quality complaint verified by our team — full refund or replacement',
          ],
        },
        {
          heading: '3. How to request a refund',
          paragraphs: [
            'Report any issue within 2 hours of delivery via the app, by calling +91 800 123 4567, or by emailing support@snackpod.in with your order number and a photo where relevant. Our team typically responds within a few hours.',
          ],
        },
        {
          heading: '4. Non-refundable cases',
          paragraphs: [
            'Refunds are not available where the order was delivered correctly and consumed, or where the issue was caused by incorrect delivery details provided by the customer.',
          ],
        },
      ]}
    />
  );
}
