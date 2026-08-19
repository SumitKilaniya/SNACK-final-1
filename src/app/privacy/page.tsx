import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy Policy"
      icon="🔒"
      subtitle="How Snack-Pod collects, uses, and protects your personal information."
      updated="6 August 2026"
      disclaimer
      sections={[
        {
          heading: '1. Information we collect',
          paragraphs: [
            'When you use Snack-Pod we collect information you provide directly — such as your name, phone number, delivery address, email address and payment details — as well as information collected automatically, like device type, IP address and how you interact with the app.',
          ],
          list: [
            'Account & order details (name, contact, addresses, order history)',
            'Payment information (processed by our payment partners; we never store full card numbers)',
            'Device and usage data (app version, pages visited, crash reports)',
          ],
        },
        {
          heading: '2. How we use your information',
          paragraphs: [
            'We use your information to process orders, deliver food, provide customer support, send order updates, and improve our service. With your consent we may also send offers and promotional updates.',
          ],
        },
        {
          heading: '3. Sharing your information',
          paragraphs: [
            'We share data only with the parties needed to run the service — delivery partners, payment processors, and analytics providers — under contracts that require them to protect your data. We never sell your personal information.',
          ],
        },
        {
          heading: '4. Data security & retention',
          paragraphs: [
            'Your data is encrypted in transit and at rest, and access is restricted to authorised staff. We retain order records as required for tax and legal compliance, and delete or anonymise other data when it is no longer needed.',
          ],
        },
        {
          heading: '5. Your rights',
          paragraphs: [
            'Under the Indian Digital Personal Data Protection Act (DPDP) 2023 you have the right to access, correct, and request deletion of your personal data, and to withdraw consent at any time. Write to us at privacy@snackpod.in to exercise these rights.',
          ],
        },
      ]}
    />
  );
}
