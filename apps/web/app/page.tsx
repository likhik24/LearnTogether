import Link from 'next/link';
import { categories, classes } from './data';
import { AppHeader, BottomNav, ClassCard, Icon } from './ui';

export default function HomePage() {
  return (
    <main className="page-canvas">
      <div className="phone-shell home-page">
        <AppHeader />
        <section className="welcome-row">
          <div>
            <h1>Let’s find something<br />Abhiram will love.</h1>
            <p>Thoughtful picks for a curious little builder.</p>
          </div>
          <Link className="child-avatar" href="/children" aria-label="Open Abhiram’s profile">A</Link>
        </section>
        <section className="recommendation-hero">
          <div className="hero-content">
            <span className="hero-kicker">JUST FOR ABHIRAM ✦</span>
            <h2>Big ideas.<br />Tiny wheels.</h2>
            <p>Because he loved rhythm class and vehicle play, this hands-on STEM workshop feels just right.</p>
            <Link className="light-button" href="/classes/build-a-car">See why we picked this <span>→</span></Link>
          </div>
          <img src={classes[0].image} alt="Child enjoying a hands-on learning activity" />
        </section>
        <section className="section-block">
          <div className="section-heading">
            <div><span className="eyebrow purple">THIS WEEKEND</span><h2>Ready when you are</h2></div>
            <Link href="/discover">See all</Link>
          </div>
          <ClassCard item={classes[0]} compact />
        </section>
        <section className="section-block category-strip-section">
          <div className="section-heading"><div><h2>Explore their interests</h2></div></div>
          <div className="category-strip">
            {categories.slice(0, 4).map((category) => (
              <Link href={`/discover?category=${encodeURIComponent(category.query)}`} key={category.name}>
                <span className={`category-icon ${category.tone}`}>{category.icon}</span><span>{category.name}</span>
              </Link>
            ))}
          </div>
        </section>
        <Link className="trust-note" href="/profile">
          <Icon name="shield" size={22} />
          <div><strong>Grown-up peace of mind</strong><span>Every educator is identity-verified.</span></div>
          <span>→</span>
        </Link>
        <BottomNav />
      </div>
    </main>
  );
}
