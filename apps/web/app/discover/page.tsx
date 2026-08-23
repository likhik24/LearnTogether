'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiscoverClassDto } from '@learn-and-build/types';
import { createSchedulingClient, createSearchClient } from '../../lib/api';
import { categories, classes, type ClassCardData } from '../data';
import { AppHeader, BottomNav, ClassCard, Icon } from '../ui';
import { RealDiscoveryMap } from './real-discovery-map';

const filters = ['All', 'Today', 'Tomorrow', 'Weekend', 'Nearby'];
const viewModes = ['Categories', 'List', 'Map'] as const;
type ViewMode = (typeof viewModes)[number];

const origin = { lat: 17.4485, lng: 78.3915 };

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('Categories');
  const [allClasses, setAllClasses] = useState<ClassCardData[]>(classes);
  const [selectedSlug, setSelectedSlug] = useState(classes[0].slug);
  const [recenterKey, setRecenterKey] = useState(0);
  const [dataStatus, setDataStatus] = useState<'loading' | 'live' | 'offline'>('loading');
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const category = new URLSearchParams(window.location.search).get('category');
    const requestedView = new URLSearchParams(window.location.search).get('view');
    if (category) { setQuery(category); setViewMode('List'); }
    if (requestedView === 'map') setViewMode('Map');
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const scheduling = createSchedulingClient();
      const search = createSearchClient();
      setDataStatus('loading');
      void Promise.all([
        scheduling.discoverClasses({ ...origin, radiusMeters: 5000, days: 21 }),
        query.trim() ? search.searchClasses(query.trim(), { ...origin, radiusMeters: 5000 }).catch(() => null) : Promise.resolve(null),
      ]).then(([offerings, searchResponse]) => {
        if (cancelled) return;
        let mapped = offerings.map(toClassCard);
        if (query.trim()) {
          const rank = new Map(searchResponse?.hits.map((hit, index) => [hit.classId, index]) ?? []);
          const normalized = query.trim().toLowerCase();
          mapped = rank.size
            ? mapped.filter((item) => item.backendId && rank.has(item.backendId)).sort((a, b) => rank.get(a.backendId!)! - rank.get(b.backendId!)!)
            : mapped.filter((item) => `${item.title} ${item.category} ${item.age}`.toLowerCase().includes(normalized));
        }
        setAllClasses(mapped);
        setSelectedSlug((current) => mapped.some((item) => item.slug === current) ? current : mapped[0]?.slug ?? '');
        setDataStatus('live');
      }).catch(() => {
        if (cancelled) return;
        setAllClasses(classes);
        setDataStatus('offline');
      });
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query]);

  const visibleClasses = useMemo(() => allClasses.filter((item) => (
    activeFilter === 'All' || item.availability.includes(activeFilter)
  )), [activeFilter, allClasses]);
  const selectedClass = visibleClasses.find((item) => item.slug === selectedSlug) ?? visibleClasses[0];
  const selectClass = useCallback((slug: string) => setSelectedSlug(slug), []);

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
          <input ref={searchInput} aria-label="Search classes" placeholder="Search activities, skills, teachers…" value={query} onChange={(event) => { setQuery(event.target.value); setViewMode('List'); }} />
          <kbd>⌘ K</kbd>
        </label>
        <div className="view-switcher" aria-label="Discover view">
          {viewModes.map((mode) => <button type="button" aria-pressed={viewMode === mode} className={viewMode === mode ? 'active' : ''} key={mode} onClick={() => setViewMode(mode)}>{mode}</button>)}
        </div>
        <div className="filter-row" aria-label="Class filters">
          {filters.map((filter) => <button className={activeFilter === filter ? 'active' : ''} key={filter} type="button" onClick={() => setActiveFilter(filter)}>{filter}</button>)}
        </div>
        {viewMode === 'Categories' && !query && (
          <section className="section-block discover-categories">
            <div className="section-heading"><div><h2>Browse by interest</h2></div><span className={`api-source ${dataStatus}`}>{dataStatus === 'live' ? 'LIVE API' : dataStatus === 'loading' ? 'SYNCING' : 'OFFLINE'}</span></div>
            <div className="category-grid">
              {categories.map((category) => (
                <button className={`category-tile ${category.tone}`} type="button" key={category.name} onClick={() => { setQuery(category.query); setViewMode('List'); }}>
                  <span className="category-icon">{category.icon}</span><strong>{category.name}</strong><small>{category.count} classes</small><span className="tile-arrow">↗</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {viewMode === 'List' && <section className="section-block results-section">
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
        </section>}
        {viewMode === 'Map' && (
          <section className="section-block map-results-section">
            <div className="section-heading"><div><span className="eyebrow coral">{dataStatus === 'live' ? 'LIVE MAP' : dataStatus === 'loading' ? 'MAP • SYNCING' : 'MAP • OFFLINE DATA'}</span><h2>{visibleClasses.length} classes around you</h2></div><button className="filter-link" onClick={() => setRecenterKey((value) => value + 1)}>Recenter</button></div>
            <RealDiscoveryMap items={visibleClasses} selectedSlug={selectedClass?.slug} onSelect={selectClass} recenterKey={recenterKey} />
            {selectedClass ? <div className="map-preview"><ClassCard item={selectedClass} compact /></div> : <div className="empty-state"><h3>No classes on this map</h3><p>Try another day or reset your filters.</p></div>}
          </section>
        )}
        <BottomNav />
      </div>
    </main>
  );
}

function toClassCard(item: DiscoverClassDto): ClassCardData {
  const occurrence = item.nextOccurrence ? new Date(item.nextOccurrence.start) : null;
  const availability: string[] = [];
  if (occurrence) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const occurrenceDay = new Date(occurrence.getFullYear(), occurrence.getMonth(), occurrence.getDate()).getTime();
    if (occurrenceDay === today) availability.push('Today');
    if (occurrenceDay === today + 86_400_000) availability.push('Tomorrow');
    if (occurrence.getDay() === 0 || occurrence.getDay() === 6) availability.push('Weekend');
  }
  if (item.distanceMeters !== null && item.distanceMeters <= 2000) availability.push('Nearby');
  return {
    backendId: item.id,
    slug: item.slug ?? item.id,
    title: item.activity,
    category: item.category,
    age: `${item.ageMin}–${item.ageMax} years`,
    time: occurrence ? new Intl.DateTimeFormat('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(occurrence) : 'Schedule coming soon',
    distance: item.distanceMeters === null ? 'Location TBA' : `${(item.distanceMeters / 1000).toFixed(1)} km`,
    rating: item.rating.toFixed(1),
    reviews: item.reviewCount,
    price: item.priceMinor / 100,
    spots: item.nextOccurrence?.seatsAvailable ?? 0,
    image: item.imageUrl ?? '/images/build-a-car-workshop.jpg',
    tone: item.tone,
    availability,
    occurrenceStart: item.nextOccurrence?.start,
    latitude: item.location?.lat,
    longitude: item.location?.lng,
    venueName: item.venueName ?? undefined,
  };
}
