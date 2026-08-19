import React from 'react';
import PolicyPage from '@/components/PolicyPage';

export default function FssaiPage() {
  return (
    <PolicyPage
      title="FSSAI License"
      icon="🛡️"
      subtitle="Food safety is a promise we take seriously."
      updated="6 August 2026"
      sections={[
        {
          heading: 'Licence details',
          paragraphs: [
            'Snack-Pod operates all of its kitchens under a valid licence issued by the Food Safety and Standards Authority of India (FSSAI), in accordance with the Food Safety and Standards Act, 2006.',
          ],
          list: [
            'FSSAI Licence No: 10020042000123',
            'GSTIN: 29AABCU9603R1ZX',
            'Registered office: Koramangala, Bangalore, Karnataka 560034',
          ],
        },
        {
          heading: 'Our food safety commitment',
          paragraphs: [
            'All kitchens follow FSSAI-mandated hygiene and storage practices. Staff are trained in food safety, ingredients are sourced from licensed vendors, and temperatures are monitored across the supply chain so your food reaches you fresh and safe.',
          ],
        },
        {
          heading: 'Report a concern',
          paragraphs: [
            'If you have a food-safety concern, contact us at fssai@snackpod.in and we will investigate promptly.',
          ],
        },
      ]}
    />
  );
}
