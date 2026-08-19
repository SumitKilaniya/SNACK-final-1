'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { offers as initialOffers, type Offer as BaseOffer } from './menu-data';

export interface Offer extends BaseOffer {
  isActive?: boolean;
  usageLimit?: number;
}

interface OffersContextValue {
  offers: Offer[];
  isHydrated: boolean;
  addOffer: (offerData: Omit<Offer, 'id'>) => Offer;
  updateOffer: (id: string, updates: Partial<Offer>) => void;
  deleteOffer: (id: string) => void;
  toggleOfferActive: (id: string) => void;
  getOfferByCode: (code: string) => Offer | undefined;
}

const STORAGE_KEY = 'snackpod-offers-v1';

const OffersContext = createContext<OffersContextValue | null>(null);

function normalizeOffer(
  o: Partial<Offer> & { code: string; title: string; type: Offer['type'] }
): Offer {
  const id = o.id || 'off_' + o.code.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return {
    id,
    code: o.code.toUpperCase(),
    title: o.title,
    description: o.description || '',
    type: o.type,
    value: Number(o.value) || 0,
    minOrder: Number(o.minOrder) || 0,
    expiry: o.expiry || '2026-12-31',
    badge: o.badge,
    tier: o.tier || 'small',
    riddle: o.riddle,
    answer: o.answer,
    isActive: o.isActive !== undefined ? o.isActive : true,
    usageLimit: o.usageLimit !== undefined ? o.usageLimit : 100,
  };
}

export function OffersProvider({ children }: { children: React.ReactNode }) {
  const [offers, setOffers] = useState<Offer[]>(() => initialOffers.map(normalizeOffer));
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOffers(parsed.map(normalizeOffer));
        }
      }
    } catch (err) {
      console.warn('Failed to load offers from localStorage', err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(offers));
    } catch (err) {
      console.warn('Failed to save offers to localStorage', err);
    }
  }, [offers, isHydrated]);

  const addOffer = useCallback((offerData: Omit<Offer, 'id'>) => {
    const newOffer = normalizeOffer(offerData);
    setOffers((prev) => [newOffer, ...prev]);
    return newOffer;
  }, []);

  const updateOffer = useCallback((id: string, updates: Partial<Offer>) => {
    setOffers((prev) =>
      prev.map((o) => {
        if (o.id === id || o.code === id.toUpperCase()) {
          return normalizeOffer({ ...o, ...updates });
        }
        return o;
      })
    );
  }, []);

  const deleteOffer = useCallback((id: string) => {
    setOffers((prev) => prev.filter((o) => o.id !== id && o.code !== id.toUpperCase()));
  }, []);

  const toggleOfferActive = useCallback((id: string) => {
    setOffers((prev) =>
      prev.map((o) => {
        if (o.id === id || o.code === id.toUpperCase()) {
          return { ...o, isActive: !o.isActive };
        }
        return o;
      })
    );
  }, []);

  const getOfferByCode = useCallback(
    (code: string) => {
      const normalizedCode = code.trim().toUpperCase();
      return offers.find((o) => o.code === normalizedCode && o.isActive !== false);
    },
    [offers]
  );

  const value = useMemo(
    () => ({
      offers,
      isHydrated,
      addOffer,
      updateOffer,
      deleteOffer,
      toggleOfferActive,
      getOfferByCode,
    }),
    [offers, isHydrated, addOffer, updateOffer, deleteOffer, toggleOfferActive, getOfferByCode]
  );

  return <OffersContext.Provider value={value}>{children}</OffersContext.Provider>;
}

export function useOffers() {
  const context = useContext(OffersContext);
  if (!context) {
    throw new Error('useOffers must be used within an OffersProvider');
  }
  return context;
}
