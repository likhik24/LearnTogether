'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPrimaryChild } from '../lib/customer-session';
import { categories } from './data';

/**
 * Home "Explore their interests" strip, ordered so categories matching the
 * signed-in child's interests appear first. Falls back to the default order.
 */
export function InterestCategoryStrip({ limit = 4 }: { limit?: number }) {
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    void getPrimaryChild().then((child) => {
      if (active && child) setInterests(child.interests ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  const norm = interests.map((i) => i.toLowerCase());
  const matches = (c: (typeof categories)[number]) =>
    norm.some(
      (i) => c.query.toLowerCase() === i || c.name.toLowerCase().includes(i),
    );

  // Stable sort: interest-matching categories float to the front.
  const ordered = [...categories].sort(
    (a, b) => (matches(a) ? 0 : 1) - (matches(b) ? 0 : 1),
  );

  return (
    <div className="category-strip">
      {ordered.slice(0, limit).map((category) => (
        <Link
          href={`/discover?category=${encodeURIComponent(category.query)}`}
          key={category.name}
        >
          <span className={`category-icon ${category.tone}`}>{category.icon}</span>
          <span>{category.name}</span>
        </Link>
      ))}
    </div>
  );
}
