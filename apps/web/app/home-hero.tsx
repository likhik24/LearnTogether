'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSchedulingClient } from '../lib/api';
import { toClassCard } from '../lib/class-data';
import { getPrimaryChild } from '../lib/customer-session';
import type { ClassCardData } from './data';
import { ClassCard } from './ui';

const origin = { lat: 17.4485, lng: 78.3915 };

export function HomeHero() {
  const [name, setName] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [picks, setPicks] = useState<ClassCardData[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getPrimaryChild(),
      createSchedulingClient().discoverClasses({ ...origin, radiusMeters: 5_000, days: 21 }),
    ])
      .then(([child, offerings]) => {
        if (!active) return;
        setName(child?.name ?? null);
        setInterests(child?.interests ?? []);
        const normalized = (child?.interests ?? []).map((interest) => interest.toLowerCase());
        const mapped = offerings.map(toClassCard).sort((a, b) => {
          const score = (item: ClassCardData) =>
            normalized.some((interest) =>
              `${item.category} ${item.title}`.toLowerCase().includes(interest),
            )
              ? 0
              : 1;
          return score(a) - score(b);
        });
        setPicks(mapped);
        setLive(true);
      })
      .catch(async () => {
        const child = await getPrimaryChild();
        if (!active) return;
        setName(child?.name ?? null);
        setInterests(child?.interests ?? []);
        setPicks([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const displayName = name ?? 'your child';
  const initial = (name ?? 'Y').charAt(0).toUpperCase();
  const featured = picks[0];
  const interestText = interests.slice(0, 2).join(' and ').toLowerCase();

  return (
    <>
      <section className="welcome-row">
        <div>
          <h1>
            Let’s find something
            <br />
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
      {featured ? (
        <section className="recommendation-hero">
          <div className="hero-content">
            <span className="hero-kicker">JUST FOR {displayName.toUpperCase()} ✦</span>
            <h2>{featured.title}</h2>
            <p>
              {interests.length
                ? `Because ${displayName} loves ${interestText}, ${featured.category.toLowerCase()} feels like a lovely match.`
                : `A nearby ${featured.category.toLowerCase()} class we think ${displayName} will enjoy.`}
            </p>
            <Link className="light-button" href={`/classes/${featured.slug}`}>
              See why we picked this <span>→</span>
            </Link>
          </div>
          <img src={featured.image} alt={`${featured.title} class`} />
        </section>
      ) : (
        <section className="recommendation-hero recommendation-loading">
          <div className="hero-content">
            <span className="hero-kicker">FINDING A GREAT MATCH ✦</span>
            <h2>Fresh ideas are on their way.</h2>
            <Link className="light-button" href="/discover">
              Browse all classes →
            </Link>
          </div>
        </section>
      )}
      <section className="section-block home-live-pick">
        <div className="section-heading">
          <div>
            <span className="eyebrow purple">THIS WEEKEND</span>
            <h2>Ready when you are</h2>
          </div>
          <div className="home-pick-tools">
            <span className={`api-source ${live ? 'live' : 'offline'}`}>
              {live ? 'LIVE API' : 'OFFLINE'}
            </span>
            <Link href="/recommendations">View timeline</Link>
          </div>
        </div>
        {picks[1] ? (
          <ClassCard item={picks[1]} compact />
        ) : (
          <p className="section-hint">New weekend classes will appear here after approval.</p>
        )}
      </section>
    </>
  );
}
