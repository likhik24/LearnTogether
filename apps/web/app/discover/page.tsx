'use client';

import { useEffect, useMemo, useState } from 'react';
import { categories, classes } from '../data';
import { AppHeader, BottomNav, ClassCard, Icon } from '../ui';

const filters = ['All', 'Today', 'Tomorrow', 'Weekend', 'Nearby'];

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    const category = new URLSearchParams(window.location.search).get('category');
    if (category) setQuery(category);
  }, []);
  const visibleClasses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return classes;
    return classes.filter((item) => `${item.title} ${item.category} ${item.age}`.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <main className="page-canvas">
      <div className="phone-shell discover-page">
        <AppHeader greeting={false} />
        <section className="discover-intro">
          <span className="eyebrow purple">DISCOVER</span>
          <h1>What would Abhiram<br />like to explore?</h1>
          <p>Classes close to home, picked for ages 3–6.</p>
        </section>
        <label className="search-field">
          <Icon name="search" size={20} />
          <input aria-label="Search classes" placeholder="Search activities, skills, teachers…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <kbd>⌘ K</kbd>
        </label>
        <div className="filter-row" aria-label="Class filters">
          {filters.map((filter) => (
            <button className={activeFilter === filter ? 'active' : ''} key={filter} type="button" onClick={() => setActiveFilter(filter)}>{filter}</button>
          ))}
        </div>
        {!query && (
          <section className="section-block discover-categories">
            <div className="section-heading"><div><h2>Browse by interest</h2></div></div>
            <div className="category-grid">
              {categories.map((category) => (
                <button className={`category-tile ${category.tone}`} type="button" key={category.name} onClick={() => setQuery(category.name)}>
                  <span className="category-icon">{category.icon}</span><strong>{category.name}</strong><small>{category.count} classes</small><span className="tile-arrow">↗</span>
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="section-block results-section">
          <div className="section-heading">
            <div><span className="eyebrow coral">{activeFilter.toUpperCase()}</span><h2>{query ? 'Search results' : 'Popular near you'}</h2></div>
            <button type="button" className="filter-link">Filters <span>⌁</span></button>
          </div>
          <div className="class-list">
            {visibleClasses.map((item) => <ClassCard item={item} key={item.slug} />)}
            {visibleClasses.length === 0 && <div className="empty-state"><span>✦</span><h3>No perfect match yet</h3><p>Try searching for art, music, STEM, or stories.</p></div>}
          </div>
        </section>
        <BottomNav />
      </div>
    </main>
  );
}
