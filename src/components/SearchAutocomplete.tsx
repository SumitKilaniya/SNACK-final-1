'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { type Dish } from '@/lib/menu-data';
import { useMenu } from '@/lib/menu-context';

const MAX_SUGGESTIONS = 8;
const DEBOUNCE_MS = 200;

interface SearchAutocompleteProps {
  /** 'desktop' = the top-nav search bar; 'drawer' = the mobile slide-in search. */
  variant?: 'desktop' | 'drawer';
  /** Called right before navigating away (e.g. to close the mobile drawer). */
  onNavigate?: () => void;
}

/**
 * Live search suggestions: dishes whose name contains the typed text
 * (case-insensitive), matches at the start of the name ranked first.
 * Supports mouse clicks and keyboard navigation (↑/↓ + Enter), and shows a
 * "No dishes found" state. Selecting a suggestion jumps to /menu?dish=<key>
 * where the menu page scrolls to and highlights that dish.
 */
export default function SearchAutocomplete({
  variant = 'desktop',
  onNavigate,
}: SearchAutocompleteProps) {
  const { dishes } = useMenu();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  // Debounce so filtering doesn't run on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Close when clicking outside the search box.
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const suggestions = useMemo<Dish[]>(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return [];
    const nameStarts: Dish[] = [];
    const nameIncludes: Dish[] = [];
    const descIncludes: Dish[] = [];
    for (const d of dishes) {
      const name = d.name.toLowerCase();
      if (name.startsWith(q)) nameStarts.push(d);
      else if (name.includes(q)) nameIncludes.push(d);
      else if (d.description.toLowerCase().includes(q)) descIncludes.push(d);
      if (nameStarts.length + nameIncludes.length + descIncludes.length >= MAX_SUGGESTIONS * 2)
        break;
    }
    return [...nameStarts, ...nameIncludes, ...descIncludes].slice(0, MAX_SUGGESTIONS);
  }, [debounced, dishes]);

  const q = query.trim();
  const showDropdown = open && debounced.trim().length > 0;
  const noResults = showDropdown && suggestions.length === 0;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    onNavigate?.();
    if (q) {
      window.location.href = `/menu?search=${encodeURIComponent(q)}`;
    } else {
      window.location.href = '/menu';
    }
  };

  const selectDish = (key: string) => {
    setOpen(false);
    setQuery('');
    onNavigate?.();
    window.location.href = `/menu?dish=${key}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        selectDish(suggestions[activeIndex].key);
      }
      // Otherwise fall through to the form's normal submit (search-all).
    }
  };

  const inputClasses =
    variant === 'drawer'
      ? 'flex-1 bg-transparent py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground'
      : 'flex-1 bg-transparent py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground';

  return (
    <div
      ref={rootRef}
      className={variant === 'drawer' ? 'relative' : 'relative flex-1 max-w-sm hidden lg:block'}
    >
      <form
        onSubmit={submitSearch}
        className={
          variant === 'drawer'
            ? 'flex items-center border border-border rounded-xl overflow-hidden bg-secondary/60'
            : 'flex items-center border border-border rounded-full overflow-hidden bg-secondary/60 hover:border-primary/40 transition-colors ml-2'
        }
      >
        <div className="px-3 text-muted-foreground">
          <Icon name="MagnifyingGlassIcon" size={16} />
        </div>
        <input
          type="text"
          placeholder={variant === 'drawer' ? 'Search snacks...' : 'Search snacks, meals...'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (debounced.trim()) setOpen(true);
          }}
          className={inputClasses}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-suggestions"
          aria-activedescendant={
            activeIndex >= 0 ? `suggestion-${suggestions[activeIndex]?.key}` : undefined
          }
          aria-autocomplete="list"
          aria-label="Search menu"
        />
        <button
          type="submit"
          aria-label="Search menu"
          className="px-3 text-primary hover:opacity-80 transition-opacity"
        >
          <Icon name="ArrowRightIcon" size={16} />
        </button>
      </form>

      {showDropdown && (
        <div
          id="search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
          className={`absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-border shadow-xl shadow-black/10 overflow-hidden z-[80] ${
            variant === 'drawer' ? '' : 'ml-2'
          }`}
        >
          {noResults ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-semibold text-foreground">No dishes found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Try a different word — or search the full menu below.
              </p>
              <button
                onClick={submitSearch}
                className="mt-3 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-full hover:bg-accent transition-colors btn-spring"
              >
                Search all for “{debounced.trim()}”
              </button>
            </div>
          ) : (
            <>
              <ul className="py-1.5">
                {suggestions.map((dish, i) => (
                  <li key={dish.key}>
                    <button
                      id={`suggestion-${dish.key}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      onClick={() => selectDish(dish.key)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2 text-left transition-colors ${
                        i === activeIndex ? 'bg-orange-50' : 'hover:bg-secondary/70'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 relative bg-secondary">
                        <AppImage
                          src={dish.image}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{dish.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {dish.description}
                        </p>
                      </div>
                      <span className="text-sm font-extrabold text-primary shrink-0">
                        ₹{dish.price}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border px-4 py-2 bg-secondary/50">
                <button
                  onClick={submitSearch}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Icon name="MagnifyingGlassIcon" size={12} />
                  Search all for “{debounced.trim()}”
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
