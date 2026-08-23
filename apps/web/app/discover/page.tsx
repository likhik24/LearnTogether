'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { categories, classes } from '../data';
import { AppHeader, BottomNav, ClassCard, Icon } from '../ui';

const filters = ['All', 'Today', 'Tomorrow', 'Weekend', 'Nearby'];

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const category = new URLSearchParams(window.location.search).get('category');
    if (category) setQuery(category);
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  const visibleClasses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return classes.filter((item) => {
      const matchesQuery = !normalized || `${item.title} ${item.category} ${item.age}`.toLowerCase().includes(normalized);
      const matchesFilter = activeFilter === 'All' || item.availability.includes(activeFilter);
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, query]);

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
          <input ref={searchInput} aria-label="Search classes" placeholder="Search activities, skills, teachers…" value={query} onChange={(event) => setQuery(event.target.value)} />
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
                <button className={`category-tile ${category.tone}`} type="button" key={category.name} onClick={() => setQuery(category.query)}>
                  <span className="category-icon">{category.icon}</span><strong>{category.name}</strong><small>{category.count} classes</small><span className="tile-arrow">↗</span>
                </button>
              ))}
            </div>
          </section>
        )}
        <section className="section-block results-section">
          <div className="section-heading">
            <div><span className="eyebrow coral">{activeFilter.toUpperCase()}</span><h2>{query ? 'Search results' : 'Popular near you'}</h2></div>
            <button type="button" className="filter-link" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}>Filters <span>⌁</span></button>
          </div>
          {filtersOpen && (
            <div className="quick-filters" role="region" aria-label="Quick filters">
              <strong>Quick filters</strong>
              <button className={activeFilter === 'Nearby' ? 'active' : ''} onClick={() => setActiveFilter('Nearby')}>Within 2 km</button>
              <button className={activeFilter === 'Weekend' ? 'active' : ''} onClick={() => setActiveFilter('Weekend')}>This weekend</button>
              <button onClick={() => { setActiveFilter('All'); setQuery(''); }}>Reset</button>
              <button className="done" onClick={() => setFiltersOpen(false)}>Done</button>
            </div>
          )}
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
