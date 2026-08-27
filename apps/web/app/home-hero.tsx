'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCustomerClient } from '../lib/customer-session';
import { classes } from './data';

/**
 * Personalized welcome + recommendation hero for the home page. Loads the
 * signed-in parent's child (with a local fallback) so copy reflects the real
 * child and interests instead of hardcoded sample data.
 */
export function HomeHero() {
  const [name, setName] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    function applyLocal() {
      try {
        const raw = window.localStorage.getItem('learn-together-child-profile');
        if (!raw) return;
        const local = JSON.parse(raw) as { name?: string; interests?: string[] };
        setName(local.name ?? null);
        setInterests(local.interests ?? []);
      } catch {
        /* ignore malformed local data */
      }
    }
    const client = getCustomerClient();
    if (!client) {
      applyLocal();
      return;
    }
    client
      .listChildren()
      .then((items) => {
        const first = items[0];
        if (first) {
          setName(first.name);
          setInterests(first.interests ?? []);
        } else {
          applyLocal();
        }
      })
      .catch(applyLocal);
  }, []);

  const displayName = name ?? 'your child';
  const initial = (name ?? 'Y').charAt(0).toUpperCase();
  const interestText =
    interests.length >= 2
      ? `${interests[0].toLowerCase()} and ${interests[1].toLowerCase()}`
      : interests[0]?.toLowerCase() ?? 'hands-on play';

  return (
    <>
      <section className="welcome-row">
        <div>
          <h1>
            Let’s find something<br />
            {displayName} will love.
          </h1>
          <p>Thoughtful picks for a curious little learner.</p>
        </div>
        <Link
          className="child-avatar"
          href="/children"
          aria-label={`Open ${displayName}’s profile`}
        >
          {initial}
        </Link>
      </section>
      <section className="recommendation-hero">
        <div className="hero-content">
          <span className="hero-kicker">JUST FOR {displayName.toUpperCase()} ✦</span>
          <h2>
            Big ideas.<br />
            Tiny wheels.
          </h2>
          <p>
            {interests.length
              ? `Because ${displayName} loves ${interestText}, this hands-on STEM workshop feels just right.`
              : `A hands-on STEM workshop we think ${displayName} will enjoy.`}
          </p>
          <Link className="light-button" href="/classes/build-a-car">
            See why we picked this <span>→</span>
          </Link>
        </div>
        <img src={classes[0].image} alt="Child enjoying a hands-on learning activity" />
      </section>
    </>
  );
}
