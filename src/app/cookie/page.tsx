import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function CookiePage() {
  return (
    <PolicyPage
      title="Cookie Policy"
      icon="🍪"
      subtitle="How we use cookies and similar technologies to keep Snack-Pod working and improving."
      updated="6 August 2026"
      disclaimer
      sections={[
        {
          heading: '1. What are cookies?',
          paragraphs: [
            'Cookies are small text files stored on your device that help websites remember your preferences and understand how they are used.',
          ],
        },
        {
          heading: '2. Cookies we use',
          paragraphs: [
            'We use essential cookies that keep the service working (for example, remembering your cart), analytics cookies that help us understand usage, and — with your consent — marketing cookies that let us show relevant offers.',
          ],
          list: [
            'Essential: cart contents, session, security tokens',
            'Analytics: anonymous usage statistics',
            'Preference: delivery address, language, veg-only filter',
          ],
        },
        {
          heading: '3. Managing cookies',
          paragraphs: [
            'You can block or delete cookies in your browser settings at any time. Please note that blocking essential cookies may break parts of the service, such as keeping items in your cart across page loads.',
          ],
        },
      ]}
    />
  );
}
