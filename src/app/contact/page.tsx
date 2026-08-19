'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && message.trim()) setSent(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden isolate">
          <div className="promo-gradient px-6 sm:px-10 py-8 sm:py-10">
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
              <span>📬</span>
              <span>Contact Us</span>
            </h1>
            <p className="text-white/70 text-sm mt-1.5 leading-relaxed">
              Questions, feedback, or a missing spring roll? We read everything.
            </p>
          </div>

          <div className="px-6 sm:px-10 py-8 sm:py-10 grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Contact details */}
            <div className="space-y-5">
              <h2 className="text-base font-extrabold text-foreground">Reach us directly</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="MapPinIcon" size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Head office</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      42, 3rd Cross, HSR Layout, Sector 2, Bangalore, Karnataka 560102
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="PhoneIcon" size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Phone</p>
                    <a
                      href="tel:+918001234567"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      +91 800 123 4567
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="EnvelopeIcon" size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Email</p>
                    <a
                      href="mailto:hello@snackpod.in"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      hello@snackpod.in
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="ClockIcon" size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Hours</p>
                    <p className="text-xs text-muted-foreground">
                      Open every day, 10:00 AM – 11:30 PM
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Message form */}
            <div>
              <h2 className="text-base font-extrabold text-foreground mb-4">Send a message</h2>
              {sent ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <p className="text-3xl mb-2">🎉</p>
                  <p className="text-sm font-bold text-green-800">Message sent!</p>
                  <p className="text-xs text-green-700/80 mt-1">
                    Thanks {name.trim()} — we usually reply within a few hours.
                  </p>
                  <button
                    onClick={() => {
                      setSent(false);
                      setName('');
                      setMessage('');
                    }}
                    className="mt-4 text-xs font-bold text-green-700 hover:underline"
                  >
                    Send another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary bg-secondary text-foreground placeholder:text-muted-foreground"
                    required
                  />
                  <textarea
                    placeholder="How can we help?"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl text-sm outline-none focus:border-primary bg-secondary text-foreground placeholder:text-muted-foreground resize-none"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full py-3 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-accent transition-colors btn-spring"
                  >
                    Send message
                  </button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    For order issues, include your order number (e.g. QSR-20260806-0042).
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
