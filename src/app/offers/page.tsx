'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useOffers, type Offer } from '@/lib/offers-context';
import { useCart } from '@/lib/cart-context';
import { useToast } from '@/lib/toast-context';

const typeLabels: Record<string, { label: string; className: string }> = {
  percent: { label: 'Percentage off', className: 'bg-primary/10 text-primary' },
  flat: { label: 'Flat discount', className: 'bg-blue-50 text-blue-700' },
  'free-delivery': { label: 'Free delivery', className: 'bg-green-50 text-green-700' },
};

export default function OffersPage() {
  const { offers } = useOffers();
  const { applyOffer } = useCart();
  const { showToast } = useToast();
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeOffers = offers.filter((o) => o.isActive !== false);
  const smallOffers = activeOffers.filter((o) => o.tier === 'small');
  const bigOffers = activeOffers.filter((o) => o.tier === 'big');

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, []);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Fallback for older browsers / non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(code);
    showToast(`Code ${code} copied to clipboard`, 'info');
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied((c) => (c === code ? null : c)), 2000);
  };

  const orderNow = (code: string) => {
    const offer = offers.find((o) => o.code === code);
    if (!offer) return;
    applyOffer(offer);
    showToast(`${code} applied — ready at checkout 🎉`);
    router.push('/menu');
  };

  /** Normalize an answer: lowercase + trim + collapse inner whitespace. */
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero strip */}
        <div className="rounded-2xl promo-gradient p-8 sm:p-10 mb-10 relative overflow-hidden">
          <div className="absolute top-[-30%] right-[-5%] w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-xl">
            <span className="text-xs font-bold text-white/70 tracking-widest uppercase">
              Deals &amp; Coupons
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight mt-2 mb-2">
              Grab a deal, save some 🍔
            </h1>
            <p className="text-white/70 text-sm sm:text-base">
              Quick offers are ready to claim — our specials just need a little brain power first.
              Apply any code at checkout.
            </p>
          </div>
        </div>

        {/* ── Quick offers ─────────────────────────────────────── */}
        <section className="mb-12">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-2xl">⚡</span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">Quick offers</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">No strings attached — copy and go.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {smallOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                copied={copied}
                onCopy={() => copyCode(offer.code)}
                onOrderNow={() => orderNow(offer.code)}
              />
            ))}
          </div>
        </section>

        {/* ── Special offers — solve to unlock ─────────────────── */}
        <section>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-2xl">🔒</span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground">
              Special offers — solve to unlock
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            Answer the riddle to reveal the code. Wrong guesses are free — take as many as you need.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {bigOffers.map((offer) => (
              <RiddleOfferCard
                key={offer.id}
                offer={offer}
                copied={copied}
                onCopy={() => copyCode(offer.code)}
                onOrderNow={() => orderNow(offer.code)}
                normalize={normalize}
              />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

/** The dashed code chip + copy button, shared by quick and unlocked special offers. */
function OfferCodeRow({
  code,
  copied,
  onCopy,
  unlocked = false,
}: {
  code: string;
  copied: string | null;
  onCopy: () => void;
  unlocked?: boolean;
}) {
  return (
    <div
      className={`mt-4 flex items-center justify-between gap-3 border-2 border-dashed rounded-xl px-4 py-3 transition-all ${
        unlocked
          ? 'border-amber-400 bg-amber-50/80 offer-unlocked'
          : 'border-primary/30 bg-orange-50/60'
      }`}
    >
      <span
        className={`font-black tracking-widest text-lg ${unlocked ? 'text-amber-700' : 'text-primary'}`}
      >
        {code}
      </span>
      <button
        onClick={onCopy}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all btn-spring ${
          copied === code
            ? 'bg-green-600 text-white'
            : 'bg-primary text-primary-foreground hover:bg-accent'
        }`}
      >
        {copied === code ? (
          <>
            <Icon name="CheckIcon" size={12} /> Copied!
          </>
        ) : (
          <>
            <Icon name="ClipboardIcon" size={12} /> Copy code
          </>
        )}
      </button>
    </div>
  );
}

function OfferMeta({ offer }: { offer: Offer }) {
  const type = typeLabels[offer.type];
  return (
    <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
      <span className="flex items-center gap-1">
        <Icon name="CurrencyRupeeIcon" size={12} /> Min order ₹{offer.minOrder}
      </span>
      <span className="flex items-center gap-1">
        <Icon name="ClockIcon" size={12} /> Valid till {offer.expiry}
      </span>
      <span
        className={`ml-auto shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${type?.className ?? ''}`}
      >
        {type?.label ?? offer.type}
      </span>
    </div>
  );
}

/** Quick offer — code visible and claimable immediately. */
function OfferCard({
  offer,
  copied,
  onCopy,
  onOrderNow,
}: {
  offer: Offer;
  copied: string | null;
  onCopy: () => void;
  onOrderNow: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden card-hover shadow-sm flex flex-col isolate">
      <div className="p-6 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-2xl">🏷️</span>
              <h3 className="text-lg font-extrabold text-foreground">{offer.title}</h3>
            </div>
            {offer.badge && (
              <span className="inline-block text-[10px] font-bold text-primary bg-orange-50 border border-primary/20 px-2 py-0.5 rounded-full mb-2">
                {offer.badge}
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{offer.description}</p>
        <OfferMeta offer={offer} />
        <OfferCodeRow code={offer.code} copied={copied} onCopy={onCopy} />
      </div>

      <div className="px-6 pb-6">
        <button
          onClick={onOrderNow}
          className="w-full py-3 bg-foreground text-white font-bold text-sm rounded-xl hover:bg-black transition-colors btn-spring flex items-center justify-center gap-2"
        >
          Order now with this offer
          <Icon name="ArrowRightIcon" size={16} />
        </button>
      </div>
    </div>
  );
}

/** Special offer — code hidden behind a riddle. */
function RiddleOfferCard({
  offer,
  copied,
  onCopy,
  onOrderNow,
  normalize,
}: {
  offer: Offer;
  copied: string | null;
  onCopy: () => void;
  onOrderNow: () => void;
  normalize: (s: string) => string;
}) {
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offer.answer) return;
    const ok = normalize(answer) === normalize(offer.answer);
    if (ok) {
      setUnlocked(true);
      setError(null);
    } else {
      setError('Not quite — give it another try!');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-amber-200/70 overflow-hidden card-hover shadow-sm flex flex-col isolate ring-1 ring-amber-100">
      <div className="px-6 pt-6 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-2xl">🏆</span>
              <h3 className="text-lg font-extrabold text-foreground">{offer.title}</h3>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
              <Icon name="LockClosedIcon" size={10} />
              Riddle locked
            </span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mt-2">{offer.description}</p>
        <OfferMeta offer={offer} />

        {/* Riddle gate */}
        {!unlocked ? (
          <form
            onSubmit={handleSubmit}
            className="mt-5 bg-amber-50/70 border border-amber-200 rounded-xl p-4"
          >
            <p className="text-xs font-bold text-amber-900 mb-1">🧩 Solve to unlock</p>
            <p className="text-sm text-amber-900/80 italic leading-relaxed mb-3">
              “{offer.riddle}”
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Your answer…"
                className="flex-1 px-3 py-2 border border-amber-300 bg-white rounded-lg text-sm outline-none focus:border-amber-500 text-foreground placeholder:text-muted-foreground"
                aria-label={`Answer the riddle for ${offer.code}`}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-foreground text-white font-bold text-sm rounded-lg hover:bg-black transition-colors btn-spring"
              >
                Submit
              </button>
            </div>
            {error && (
              <p
                role="alert"
                className="text-xs text-red-600 font-semibold mt-2 flex items-center gap-1"
              >
                <Icon name="XMarkIcon" size={12} /> {error}
              </p>
            )}
          </form>
        ) : (
          <div className="mt-5 animate-fade-in-up">
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 mb-1">
              <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0">
                <Icon name="CheckIcon" size={12} />
              </span>
              <p className="text-sm font-bold text-green-800">Unlocked! Your code is ready 🎉</p>
            </div>
            <OfferCodeRow code={offer.code} copied={copied} onCopy={onCopy} unlocked />
          </div>
        )}
      </div>

      <div className="px-6 py-6">
        <button
          onClick={onOrderNow}
          disabled={!unlocked}
          className="w-full py-3 bg-foreground text-white font-bold text-sm rounded-xl hover:bg-black transition-colors btn-spring flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-foreground"
        >
          {unlocked ? (
            <>
              Order now with this offer
              <Icon name="ArrowRightIcon" size={16} />
            </>
          ) : (
            <>
              <Icon name="LockClosedIcon" size={14} />
              Solve the riddle to claim
            </>
          )}
        </button>
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          Applies automatically at checkout — no need to remember the code.
        </p>
      </div>
    </div>
  );
}
