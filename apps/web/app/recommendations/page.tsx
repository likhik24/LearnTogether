'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { classes } from '../data';
import { getCustomerClient } from '../../lib/customer-session';
import { AppHeader, BottomNav, Icon } from '../ui';

const tabs = ['For You', 'Today', 'Weekend', 'Saved'] as const;
type TimelineTab = (typeof tabs)[number];

const timelineItems = [
  { item: classes[1], time: '10:00 AM', duration: '50 min', group: 'Today' },
  { item: classes[0], time: '10:30 AM', duration: '60 min', group: 'Weekend', recommended: true },
  { item: classes[2], time: '11:30 AM', duration: '45 min', group: 'Weekend' },
  { item: classes[3], time: '4:00 PM', duration: '45 min', group: 'Weekend' },
];

export default function RecommendationsPage() {
  const [activeTab, setActiveTab] = useState<TimelineTab>('For You');
  const [savedSlugs, setSavedSlugs] = useState<string[]>([]);

  useEffect(() => {
    const localSaved = () => classes.filter((item) => window.localStorage.getItem(`learn-together-saved-${item.slug}`) === 'true').map((item) => item.slug);
    const client = getCustomerClient();
    if (client) {
      client.listSavedClasses().then((items) => setSavedSlugs(items.map((item) => item.classRef))).catch(() => setSavedSlugs(localSaved()));
      return;
    }
    setSavedSlugs(localSaved());
  }, []);

  const events = useMemo(() => {
    if (activeTab === 'For You') return timelineItems.slice(0, 3);
    if (activeTab === 'Saved') return timelineItems.filter(({ item }) => savedSlugs.includes(item.slug));
    return timelineItems.filter((entry) => entry.group === activeTab);
  }, [activeTab, savedSlugs]);

  return (
    <main className="page-canvas">
      <div className="phone-shell timeline-page">
        <AppHeader greeting={false} />
        <section className="timeline-intro">
          <span className="eyebrow purple">PERSONALISED FOR ABHIRAM</span>
          <h1>A little plan for<br />a brilliant day.</h1>
          <p>Thoughtful options, ordered around your family’s schedule.</p>
        </section>
        <div className="timeline-tabs" aria-label="Recommendation timeline filters">
          {tabs.map((tab) => <button type="button" aria-pressed={activeTab === tab} className={activeTab === tab ? 'active' : ''} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
        </div>
        <div className="timeline-date-row">
          <div><span>SAT</span><strong>17</strong><small>MAY</small></div>
          <p><strong>{activeTab === 'Today' ? 'Today’s ideas' : 'Saturday picks'}</strong><span>{events.length} classes that fit</span></p>
        </div>
        {events.length > 0 ? (
          <section className="class-timeline" aria-label={`${activeTab} class timeline`}>
            {events.map(({ item, time, duration, recommended }) => (
              <div className={recommended ? 'timeline-event recommended' : 'timeline-event'} key={item.slug}>
                <time>{time}</time>
                <span className="timeline-node" />
                <Link href={`/classes/${item.slug}`}>
                  {recommended && <span className="recommendation-label">✦ TOP MATCH</span>}
                  <div className="timeline-card-top"><div><h2>{item.title}</h2><p>{item.age} • {duration}</p></div><img src={item.image} alt="" /></div>
                  {recommended && <p className="timeline-reason">Because Abhiram enjoyed rhythm class and vehicle play.</p>}
                  <div className="timeline-meta"><span><Icon name="location" size={14} /> {item.distance}</span><strong>₹{item.price} Trial →</strong></div>
                </Link>
              </div>
            ))}
          </section>
        ) : (
          <div className="empty-state timeline-empty"><span>♡</span><h3>No saved classes yet</h3><p>Tap the heart on a class to keep it here.</p><Link href="/discover">Explore classes</Link></div>
        )}
        <BottomNav />
      </div>
    </main>
  );
}
