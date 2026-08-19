import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms & Conditions"
      icon="📜"
      subtitle="The rules that apply when you order from Snack-Pod."
      updated="6 August 2026"
      disclaimer
      sections={[
        {
          heading: '1. Acceptance of terms',
          paragraphs: [
            'By placing an order or using the Snack-Pod website or app, you agree to these Terms & Conditions, our Privacy Policy, and any other policies referenced on this page.',
          ],
        },
        {
          heading: '2. Orders & pricing',
          paragraphs: [
            'All prices are in Indian Rupees (₹) and inclusive of applicable taxes unless stated otherwise. We reserve the right to correct pricing errors, reject orders, or cancel orders in cases of suspected fraud or stock unavailability. A confirmation on screen does not guarantee acceptance of your order.',
          ],
          list: [
            'Menu items and combos are subject to availability',
            'Offers and coupons cannot be combined unless stated',
            'Promotional codes are valid for a limited time only',
          ],
        },
        {
          heading: '3. Delivery',
          paragraphs: [
            'Delivery times are estimates and may vary due to traffic, weather, or order volume. While we aim to deliver every order fresh and on time, we are not liable for delays outside our reasonable control.',
          ],
        },
        {
          heading: '4. User conduct',
          paragraphs: [
            'You agree to provide accurate delivery and contact details and to use the service only for lawful purposes. Misuse of promotional codes or abusive behaviour toward staff or delivery partners may result in account suspension.',
          ],
        },
        {
          heading: '5. Limitation of liability',
          paragraphs: [
            'To the maximum extent permitted by law, Snack-Pod is not liable for indirect or consequential losses arising from your use of the service. Our total liability for any claim is limited to the amount you paid for the order in question.',
          ],
        },
        {
          heading: '6. Contact',
          paragraphs: [
            'Questions about these terms? Reach us at hello@snackpod.in or +91 800 123 4567.',
          ],
        },
      ]}
    />
  );
}
