'use client';
import React, { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';

// Slug matches the anchor id of the matching section on /menu (see src/lib/menu-data.ts).
const categories = [
  {
    id: 'main-course',
    name: 'Main Courses',
    image: '/images/categories/cat_main-course.webp',
    alt: 'Colorful main course bowl with grains and vegetables on a white background',
  },
  {
    id: 'seafood',
    name: 'Seafood',
    image: '/images/categories/cat_seafood.webp',
    alt: 'Grilled seafood platter with prawns and fish on a dark background',
  },
  {
    id: 'vegetarian',
    name: 'Vegetarian',
    image: '/images/categories/cat_vegetarian.webp',
    alt: 'Vibrant vegetarian dish with fresh vegetables and herbs on a plate',
  },
  {
    id: 'soups',
    name: 'Soups',
    image: '/images/categories/cat_soups.webp',
    alt: 'Creamy orange soup in a white bowl with herbs on top',
  },
  {
    id: 'grilled-meat',
    name: 'Grilled Meat',
    image: '/images/categories/cat_grilled-meat.webp',
    alt: 'Perfectly grilled meat steak on a wooden board with herbs',
  },
  {
    id: 'salads',
    name: 'Salads',
    image: '/images/categories/cat_salads.webp',
    alt: 'Fresh garden salad with colorful vegetables in a white bowl',
  },
  {
    id: 'beverages',
    name: 'Beverages',
    image: '/images/categories/cat_beverages.webp',
    alt: 'Refreshing tropical cocktail with orange slice and ice in a tall glass',
  },
  {
    id: 'desserts',
    name: 'Desserts',
    image: '/images/categories/cat_desserts.webp',
    alt: 'Elegant chocolate dessert cake with berries on a dark plate',
  },
  {
    id: 'speciality',
    name: 'Speciality',
    image: '/images/categories/cat_speciality.webp',
    alt: 'Indian specialty dish with colorful spices and garnish',
  },
  {
    id: 'pasta',
    name: 'Pasta',
    image: '/images/categories/cat_pasta.webp',
    alt: 'Creamy pasta dish with sauce being poured from above',
  },
  {
    id: 'side-dishes',
    name: 'Side Dishes',
    image: '/images/categories/cat_side-dishes.webp',
    alt: 'Golden crispy fries in a bowl with dipping sauce',
  },
  {
    id: 'starters',
    name: 'Starters',
    image: '/images/categories/cat_starters.webp',
    alt: 'Grilled skewers appetizer platter on a wooden board',
  },
];

export default function CategoryBrowser() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef?.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className={`scroll-pop ${visible ? 'popped' : ''}`}>
      <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-2xl font-black text-foreground">Top Flavor Picks</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Browse by category</p>
          </div>
          <Link
            href="/menu"
            className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-full hover:bg-accent transition-colors btn-spring shadow-sm shadow-primary/20"
          >
            See All
          </Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6">
          {categories?.map((cat, i) => (
            <Link
              key={cat?.name}
              href={`/menu#${cat.id}`}
              className={`flex flex-col items-center gap-2.5 py-5 px-3 hover:bg-orange-50 transition-colors group ${
                i < categories?.length - (categories?.length % 6 === 0 ? 6 : categories?.length % 6)
                  ? 'border-b border-border'
                  : ''
              } ${(i + 1) % 6 !== 0 ? 'border-r border-border' : ''}`}
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-border group-hover:border-primary transition-all duration-300 group-hover:shadow-md group-hover:shadow-primary/20">
                <AppImage
                  src={cat?.image}
                  alt={cat?.alt}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </div>
              <span className="text-xs font-semibold text-foreground text-center leading-tight group-hover:text-primary transition-colors">
                {cat?.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
