import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { DiscoverClassDto } from '@learn-and-build/types';
import { toClassCard } from '../../../lib/class-data';
import {
  BookingBar,
  ClassLocationMap,
  DetailTopActions,
  ReviewsButton,
} from '../../detail-actions';
import { BottomNav, Icon } from '../../ui';
import { ChildName, ChildInterests } from '../../child-name';

export const dynamic = 'force-dynamic';

async function loadClass(slug: string): Promise<DiscoverClassDto | null> {
  const origin = process.env.SCHEDULING_SERVICE_ORIGIN ?? 'http://localhost:3004';
  try {
    const response = await fetch(`${origin}/classes/discover?days=21`, { cache: 'no-store' });
    if (!response.ok) return null;
    const offerings = (await response.json()) as DiscoverClassDto[];
    return offerings.find((item) => item.slug === slug || item.id === slug) ?? null;
  } catch {
    return null;
  }
}

export default async function ClassDetailsPage({ params }: { params: { slug: string } }) {
  const offering = await loadClass(params.slug);
  if (!offering) notFound();
  const item = toClassCard(offering);
  const start = offering.nextOccurrence ? new Date(offering.nextOccurrence.start) : null;
  const end = offering.nextOccurrence ? new Date(offering.nextOccurrence.end) : null;
  const mapQuery = encodeURIComponent(`${offering.venueName ?? offering.activity} Hyderabad`);

  return (
    <main className="page-canvas">
      <article className="phone-shell details-page">
        <div className="details-hero">
          <img src={item.image} alt={`${item.title} class`} />
          <div className="details-actions">
            <Link className="round-action" href="/discover" aria-label="Back to discover">
              <Icon name="arrow" />
            </Link>
            <div>
              <DetailTopActions slug={item.slug} title={item.title} />
            </div>
          </div>
          <span className="hero-photo-count">▣ 1 / 1</span>
        </div>
        <div className="details-body">
          <div className="title-block">
            <span className="eyebrow purple">
              {item.category} • PERFECT FOR <ChildName uppercase />
            </span>
            <h1>{item.title}</h1>
            <p>
              {offering.description ||
                `A playful, hands-on ${item.category.toLowerCase()} class led by a verified Learn & Build provider.`}
            </p>
            <div className="rating-line">
              <span>
                <Icon name="star" size={17} /> {item.rating}
              </span>
              <ReviewsButton
                classId={offering.id}
                count={item.reviews}
                rating={offering.rating}
              />
              <span>•</span>
              <span>{item.age}</span>
            </div>
          </div>
          <section className="reason-card">
            <div className="reason-heading">
              <span>✦</span>
              <div>
                <small>WHY WE PICKED THIS</small>
                <h2>
                  A lovely match for <ChildName />
                </h2>
              </div>
            </div>
            <ul>
              <li>
                <Icon name="check" size={17} />
                <span>
                  Builds on a love of{' '}
                  <strong>
                    <ChildInterests />
                  </strong>
                </span>
              </li>
              <li>
                <Icon name="check" size={17} />
                <span>
                  Fits an upcoming{' '}
                  <strong>
                    {start ? start.toLocaleDateString('en-IN', { weekday: 'long' }) : 'weekend'}
                  </strong>{' '}
                  routine
                </span>
              </li>
              <li>
                <Icon name="check" size={17} />
                <span>
                  <strong>{item.spots} live seats</strong> available for the next class
                </span>
              </li>
            </ul>
          </section>
          <section className="details-section">
            <span className="eyebrow coral">WHEN & WHERE</span>
            <h2>Your next class plan</h2>
            <div className="schedule-card">
              <div className="date-tile">
                <span>
                  {start
                    ? start.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()
                    : 'TBA'}
                </span>
                <strong>{start?.getDate() ?? '—'}</strong>
                <small>
                  {start
                    ? start.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()
                    : ''}
                </small>
              </div>
              <div>
                <strong>
                  {start && end
                    ? `${start.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
                    : 'Schedule coming soon'}
                </strong>
                <span>
                  <Icon name="location" size={16} />{' '}
                  {offering.venueName || 'Venue shared after booking'}
                </span>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Open directions"
              >
                ›
              </a>
            </div>
            <ClassLocationMap item={item} />
          </section>
          <section className="details-section included-section">
            <span className="eyebrow coral">THE GOOD STUFF</span>
            <h2>Everything’s taken care of</h2>
            <div className="included-grid">
              <div>
                <span>◌</span>
                <strong>Small group</strong>
                <small>Up to {offering.seats} children</small>
              </div>
              <div>
                <span>♧</span>
                <strong>Clear schedule</strong>
                <small>{offering.durationMinutes} minutes</small>
              </div>
              <div>
                <span>⌂</span>
                <strong>Local venue</strong>
                <small>{offering.venueName || 'Details soon'}</small>
              </div>
              <div>
                <span>✓</span>
                <strong>Verified teacher</strong>
                <small>Approved provider</small>
              </div>
            </div>
          </section>
          <section className="teacher-card">
            <div>
              <span className="eyebrow purple">YOUR EDUCATOR</span>
              <h3>Verified Learn &amp; Build provider</h3>
              <p>Profile and class reviewed by our team</p>
              <small>Provider details are shared with confirmed families.</small>
            </div>
            <span className="verified-badge">✓</span>
          </section>
        </div>
        <BookingBar classRef={item.slug} title={item.title} price={item.price} spots={item.spots} />
        <BottomNav />
      </article>
    </main>
  );
}
