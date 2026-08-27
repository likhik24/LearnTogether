import Link from 'next/link';
import { classes } from './data';
import { AppHeader, BottomNav, ClassCard, Icon } from './ui';
import { HomeHero } from './home-hero';
import { InterestCategoryStrip } from './interest-categories';

export default function HomePage() {
  return (
    <main className="page-canvas">
      <div className="phone-shell home-page">
        <AppHeader />
        <HomeHero />
        <section className="section-block">
          <div className="section-heading">
            <div><span className="eyebrow purple">THIS WEEKEND</span><h2>Ready when you are</h2></div>
            <Link href="/recommendations">View timeline</Link>
          </div>
          <ClassCard item={classes[0]} compact />
        </section>
        <section className="section-block category-strip-section">
          <div className="section-heading"><div><h2>Explore their interests</h2></div></div>
          <InterestCategoryStrip />
        </section>
        <Link className="trust-note" href="/profile">
          <Icon name="shield" size={22} />
          <div><strong>Grown-up peace of mind</strong><span>Every educator is identity-verified.</span></div>
          <span>→</span>
        </Link>
        <Link className="trust-note provider-cta" href="/provider">
          <Icon name="star" size={22} />
          <div><strong>Teach with Learn &amp; Build</strong><span>Share your craft and set your availability.</span></div>
          <span>→</span>
        </Link>
        <BottomNav />
      </div>
    </main>
  );
}
