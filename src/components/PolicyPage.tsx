import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export interface PolicySection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

interface PolicyPageProps {
  title: string;
  icon: string;
  subtitle: string;
  updated?: string;
  sections: PolicySection[];
  /** Renders sections as Q&A accordions instead of plain paragraphs. */
  faq?: boolean;
  /** Shows a placeholder-legal disclaimer under the content. */
  disclaimer?: boolean;
}

/**
 * Shared shell for the footer's text pages (privacy, terms, refund, cookies,
 * FSSAI, about, contact, FAQ) so they all share the site header/footer,
 * typography and spacing.
 */
export default function PolicyPage({
  title,
  icon,
  subtitle,
  updated,
  sections,
  faq = false,
  disclaimer = false,
}: PolicyPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden isolate">
          {/* Hero */}
          <div className="promo-gradient px-6 sm:px-10 py-8 sm:py-10">
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
              <span>{icon}</span>
              <span>{title}</span>
            </h1>
            <p className="text-white/70 text-sm mt-1.5 leading-relaxed">{subtitle}</p>
            {updated && <p className="text-white/50 text-xs mt-3">Last updated: {updated}</p>}
          </div>

          {/* Body */}
          <div className="px-6 sm:px-10 py-8 sm:py-10 space-y-8">
            {sections.map((section) =>
              faq ? (
                <details
                  key={section.heading}
                  className="group border border-border rounded-xl overflow-hidden"
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-foreground hover:bg-secondary/60 transition-colors">
                    <span>{section.heading}</span>
                    <span className="text-primary text-base transition-transform group-open:rotate-45">
                      ＋
                    </span>
                  </summary>
                  <div className="px-5 pb-5">
                    {section.paragraphs.map((p, i) => (
                      <p
                        key={i}
                        className="text-sm text-muted-foreground leading-relaxed mb-2 last:mb-0"
                      >
                        {p}
                      </p>
                    ))}
                  </div>
                </details>
              ) : (
                <section key={section.heading}>
                  <h2 className="text-base sm:text-lg font-extrabold text-foreground mb-2">
                    {section.heading}
                  </h2>
                  {section.paragraphs.map((p, i) => (
                    <p
                      key={i}
                      className="text-sm text-muted-foreground leading-relaxed mb-2 last:mb-0"
                    >
                      {p}
                    </p>
                  ))}
                  {section.list && (
                    <ul className="mt-2 space-y-1.5">
                      {section.list.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed"
                        >
                          <span className="text-primary mt-1 shrink-0">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )
            )}

            {disclaimer && (
              <div className="border-t border-border pt-6">
                <p className="text-xs text-muted-foreground leading-relaxed bg-secondary rounded-xl p-4">
                  <strong className="text-foreground">Note:</strong> This page contains placeholder
                  policy text for demonstration purposes only and is not a substitute for legal
                  advice. Before going live with real customer data and payments, have your privacy
                  policy and terms reviewed against the Indian Digital Personal Data Protection Act
                  (DPDP) 2023 and applicable consumer protection laws.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
