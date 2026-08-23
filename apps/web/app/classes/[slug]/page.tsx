import Link from 'next/link';
import { notFound } from 'next/navigation';
import { classes } from '../../data';
import { BookingBar, DetailTopActions, ReviewsButton } from '../../detail-actions';
import { Icon } from '../../ui';

export function generateStaticParams() {
  return classes.map((item) => ({ slug: item.slug }));
}

export default function ClassDetailsPage({ params }: { params: { slug: string } }) {
  const item = classes.find((entry) => entry.slug === params.slug);
  if (!item) notFound();

  return (
    <main className="page-canvas">
      <article className="phone-shell details-page">
        <div className="details-hero">
          <img src={item.image} alt="Children learning through hands-on play" />
          <div className="details-actions">
            <Link className="round-action" href="/discover" aria-label="Back to discover"><Icon name="arrow" /></Link>
            <div><DetailTopActions slug={item.slug} title={item.title} /></div>
          </div>
          <span className="hero-photo-count">▣ 1 / 5</span>
        </div>
        <div className="details-body">
          <div className="title-block">
            <span className="eyebrow purple">{item.category} • PERFECT FOR ABHIRAM</span>
            <h1>{item.title}</h1>
            <p>A playful hour of building, testing, and proudly showing off a car made with their own hands.</p>
            <div className="rating-line">
              <span><Icon name="star" size={17} /> {item.rating}</span>
              <ReviewsButton count={item.reviews} /><span>•</span><span>{item.age}</span>
            </div>
          </div>
          <section className="reason-card">
            <div className="reason-heading"><span>✦</span><div><small>WHY WE PICKED THIS</small><h2>A lovely match for Abhiram</h2></div></div>
            <ul>
              <li><Icon name="check" size={17} /><span>Builds on his love of <strong>vehicles and making</strong></span></li>
              <li><Icon name="check" size={17} /><span>Fits your usual <strong>Saturday morning</strong> routine</span></li>
              <li><Icon name="check" size={17} /><span>Only <strong>{item.distance}</strong> from home</span></li>
            </ul>
          </section>
          <section className="details-section">
            <span className="eyebrow coral">WHEN & WHERE</span><h2>Your Saturday plan</h2>
            <div className="schedule-card">
              <div className="date-tile"><span>MAY</span><strong>17</strong><small>SAT</small></div>
              <div><strong>10:30 AM – 11:30 AM</strong><span><Icon name="location" size={16} /> Little Makers Studio, Hitech City</span></div>
              <a href="https://www.google.com/maps/search/?api=1&query=Little+Makers+Studio+Hitech+City+Hyderabad" target="_blank" rel="noreferrer" aria-label="Open directions">›</a>
            </div>
            <div className="mini-map">
              <div className="map-road one" /><div className="map-road two" /><div className="map-road three" />
              <span className="map-pin"><Icon name="location" size={21} /></span>
              <div><strong>2.3 km away</strong><small>About 8 min drive</small></div>
            </div>
          </section>
          <section className="details-section included-section">
            <span className="eyebrow coral">THE GOOD STUFF</span><h2>Everything’s taken care of</h2>
            <div className="included-grid">
              <div><span>◌</span><strong>Small group</strong><small>Just 8 children</small></div>
              <div><span>♧</span><strong>All materials</strong><small>Nothing to bring</small></div>
              <div><span>⌂</span><strong>Take it home</strong><small>Their car is theirs</small></div>
              <div><span>✓</span><strong>Verified teacher</strong><small>Background checked</small></div>
            </div>
          </section>
          <section className="teacher-card">
            <img src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=240&q=85" alt="Workshop teacher" />
            <div><span className="eyebrow purple">YOUR EDUCATOR</span><h3>Meera Rao</h3><p>STEM educator • 7 years experience</p><small>“Kids learn best when their hands are busy.”</small></div>
            <span className="verified-badge">✓</span>
          </section>
        </div>
        <BookingBar classRef={item.slug} title={item.title} price={item.price} spots={item.spots} />
      </article>
    </main>
  );
}
