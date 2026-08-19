'use client';
import React from 'react';
import DishCard from '@/components/ui/DishCard';
import { dishByKey } from '@/lib/menu-data';

const suggestionKeys = ['peri-peri-fries', 'cold-coffee-frappe', 'chocolate-lava-cake'];

export default function SuggestedDishes() {
  const dishes = suggestionKeys.map((key) => dishByKey[key]).filter(Boolean);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⚡</span>
        <h3 className="text-sm font-extrabold text-foreground">Frequently ordered together</h3>
      </div>
      <div className="space-y-3">
        {dishes.map((dish) => (
          <DishCard key={dish.key} dish={dish} layout="row" />
        ))}
      </div>
    </div>
  );
}
