'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createSchedulingClient } from '../../lib/api';
import { toClassCard } from '../../lib/class-data';
import {
  getCustomerClient,
  getPrimaryChild,
  hydrateCustomerSession,
} from '../../lib/customer-session';
import type { ClassCardData } from '../data';
import { AppHeader, BottomNav, Icon } from '../ui';
import {
  customerDiscoveryCoordinates,
  readCustomerLocation,
  subscribeCustomerLocation,
} from '../../lib/customer-location';

const tabs = ['For You', 'Today', 'Weekend', 'Saved'] as const;
type TimelineTab = (typeof tabs)[number];
export default function RecommendationsPage() {
  const [origin, setOrigin] = useState(readCustomerLocation);
  const [activeTab, setActiveTab] = useState<TimelineTab>('For You');
  const [items, setItems] = useState<ClassCardData[]>([]);
  const [savedRefs, setSavedRefs] = useState<string[]>([]);
  const [childName, setChildName] = useState('your child');
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [hasChild, setHasChild] = useState(false);

  useEffect(() => {
    return subscribeCustomerLocation(setOrigin);
  }, []);

  useEffect(() => {
    let active = true;
    void hydrateCustomerSession()
      .then(async (user) => {
        if (!active) return null;
        setSignedIn(Boolean(user));
        const customer = user ? getCustomerClient() : null;
        return Promise.all([
          createSchedulingClient().discoverClasses({
            ...customerDiscoveryCoordinates(origin),
            days: 21,
          }),
          getPrimaryChild(),
          customer ? customer.listSavedClasses().catch(() => []) : Promise.resolve([]),
        ]);
      })
      .then((result) => {
        if (!active || !result) return;
        const [offerings, child, saved] = result;
        const interests = (child?.interests ?? []).map((interest) => interest.toLowerCase());
        const ranked = offerings.map(toClassCard).sort((a, b) => {
          const score = (item: ClassCardData) =>
            interests.some((interest) =>
              `${item.category} ${item.title}`.toLowerCase().includes(interest),
            )
              ? 0
              : 1;
          return score(a) - score(b);
        });
        setItems(ranked);
        setChildName(child?.name ?? 'your child');
        setHasChild(Boolean(child));
        setSavedRefs(saved.map((savedItem) => savedItem.classRef));
      })
      .catch(async () => {
        if (!active) return;
        const child = await getPrimaryChild();
        setChildName(child?.name ?? 'your child');
        setHasChild(Boolean(child));
        setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [origin?.lat, origin?.lng]);

  const events = useMemo(() => {
    if (activeTab === 'For You') return items.slice(0, 6);
    if (activeTab === 'Saved')
      return items.filter(
        (item) => savedRefs.includes(item.backendId ?? '') || savedRefs.includes(item.slug),
      );
    return items.filter((item) => item.availability.includes(activeTab));
  }, [activeTab, items, savedRefs]);

  const leadDate = events[0]?.occurrenceStart ? new Date(events[0].occurrenceStart) : new Date();

  return (
    <main className="page-canvas">
      <div className="phone-shell timeline-page">
        <AppHeader greeting={false} />
        <section className="timeline-intro">
          <span className="eyebrow purple">
            {hasChild
              ? `PERSONALISED FOR ${childName.toUpperCase()}`
              : signedIn
                ? 'ADD A CHILD FOR PERSONALISED PICKS'
                : 'LIVE CLASSES NEAR YOU'}
          </span>
          <h1>
            A little plan for
            <br />a brilliant day.
          </h1>
          <p>Live availability, ordered around your family’s schedule.</p>
          {signedIn && !hasChild && (
            <Link className="inline-cta" href="/children?returnTo=%2Frecommendations">
              Add a child profile →
            </Link>
          )}
        </section>
        <div className="timeline-tabs" aria-label="Recommendation timeline filters">
          {tabs.map((tab) => (
            <button
              type="button"
              aria-pressed={activeTab === tab}
              className={activeTab === tab ? 'active' : ''}
              key={tab}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="timeline-date-row">
          <div>
            <span>{leadDate.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}</span>
            <strong>{leadDate.getDate()}</strong>
            <small>{leadDate.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</small>
          </div>
          <p>
            <strong>
              {activeTab === 'Today'
                ? 'Today’s ideas'
                : activeTab === 'Saved'
                  ? 'Saved for later'
                  : 'Upcoming picks'}
            </strong>
            <span>
              {loading ? 'Syncing live availability…' : `${events.length} classes that fit`}
            </span>
          </p>
        </div>
        {activeTab === 'Saved' && !signedIn ? (
          <div className="empty-state timeline-empty">
            <span>
              <Icon name="profile" size={24} />
            </span>
            <h3>Sign in to see saved classes</h3>
            <p>Your favourites are securely tied to your LearnTogether account.</p>
            <Link href="/profile?returnTo=%2Frecommendations">Sign in or create account</Link>
          </div>
        ) : events.length > 0 ? (
          <section className="class-timeline" aria-label={`${activeTab} class timeline`}>
            {events.map((item, index) => {
              const start = item.occurrenceStart ? new Date(item.occurrenceStart) : null;
              return (
                <div
                  className={
                    index === 0 && activeTab === 'For You'
                      ? 'timeline-event recommended'
                      : 'timeline-event'
                  }
                  key={item.slug}
                >
                  <time>
                    {start
                      ? start.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
                      : 'TBA'}
                  </time>
                  <span className="timeline-node" />
                  <Link href={`/classes/${item.slug}`}>
                    {index === 0 && activeTab === 'For You' && (
                      <span className="recommendation-label">✦ TOP MATCH</span>
                    )}
                    <div className="timeline-card-top">
                      <div>
                        <h2>{item.title}</h2>
                        <p>
                          {item.age} • {item.durationMinutes ?? 60} min
                        </p>
                      </div>
                      <img src={item.image} alt="" />
                    </div>
                    {index === 0 && activeTab === 'For You' && (
                      <p className="timeline-reason">
                        Because {childName}’s interests match this class.
                      </p>
                    )}
                    <div className="timeline-meta">
                      <span>
                        <Icon name="location" size={14} /> {item.distance}
                      </span>
                      <strong>₹{item.price} Trial →</strong>
                    </div>
                  </Link>
                </div>
              );
            })}
          </section>
        ) : (
          <div className="empty-state timeline-empty">
            <span>♡</span>
            <h3>
              {loading
                ? 'Finding live classes…'
                : activeTab === 'Saved'
                  ? 'No saved classes yet'
                  : 'No classes fit this view yet'}
            </h3>
            <p>
              {loading
                ? 'This should only take a moment.'
                : 'Explore live classes and save the ones you love.'}
            </p>
            <Link href="/discover">Explore classes</Link>
          </div>
        )}
        <BottomNav />
      </div>
    </main>
  );
}
