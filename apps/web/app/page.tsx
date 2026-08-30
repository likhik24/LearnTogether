import Link from 'next/link';
import { AppHeader, BottomNav, Icon } from './ui';
import { HomeHero } from './home-hero';
import { InterestCategoryStrip } from './interest-categories';

export default function HomePage() {
  return (
    <main className="page-canvas">
      <div className="phone-shell home-page">
        <AppHeader />
        <HomeHero />
        <section className="section-block category-strip-section">
          <div className="section-heading">
            <div>
              <h2>Explore their interests</h2>
            </div>
          </div>
          <InterestCategoryStrip />
        </section>
        <Link className="trust-note" href="/profile">
          <Icon name="shield" size={22} />
          <div>
            <strong>Grown-up peace of mind</strong>
            <span>Every educator is identity-verified.</span>
          </div>
          <span>→</span>
        </Link>
        <Link className="trust-note provider-cta" href="/teacher">
          <Icon name="star" size={22} />
          <div>
            <strong>Provider sign in or apply</strong>
            <span>Open your studio, or start a new educator application.</span>
          </div>
          <span>→</span>
        </Link>
        <BottomNav />
      </div>
    </main>
  );
}
