'use client';

import { useEffect, useState } from 'react';
import { getPrimaryChild } from '../lib/customer-session';

interface ChildNameProps {
  fallback?: string;
  uppercase?: boolean;
  possessive?: boolean;
}

/**
 * Renders the signed-in parent's first child name (falling back to a neutral
 * label). Safe to drop into server components since it is a client component.
 */
export function ChildName({
  fallback = 'your child',
  uppercase = false,
  possessive = false,
}: ChildNameProps) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getPrimaryChild().then((child) => {
      if (active && child) setName(child.name);
    });
    return () => {
      active = false;
    };
  }, []);

  let text = name ?? fallback;
  if (possessive) text = text.endsWith('s') ? `${text}’` : `${text}’s`;
  if (uppercase) text = text.toUpperCase();
  return <>{text}</>;
}

/**
 * Renders the signed-in child's interests (up to `max`), with a neutral
 * fallback when there are none / the parent isn't signed in.
 */
export function ChildInterests({
  max = 2,
  fallback = 'hands-on play',
}: {
  max?: number;
  fallback?: string;
}) {
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

  if (interests.length === 0) return <>{fallback}</>;
  const shown = interests.slice(0, max).map((i) => i.toLowerCase());
  const text =
    shown.length > 1
      ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
      : shown[0];
  return <>{text}</>;
}
