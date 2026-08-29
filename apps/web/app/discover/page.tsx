'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSchedulingClient, createSearchClient } from '../../lib/api';
import { getCustomerClient } from '../../lib/customer-session';
import { toClassCard } from '../../lib/class-data';
import { categories, type ClassCardData } from '../data';
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
  const [allClasses, setAllClasses] = useState<ClassCardData[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [recenterKey, setRecenterKey] = useState(0);
  const [dataStatus, setDataStatus] = useState<'loading' | 'live' | 'error'>('loading');
  const [childName, setChildName] = useState<string | null>(null);
  const [childInterests, setChildInterests] = useState<string[]>([]);
  const searchInput = useRef<HTMLInputElement>(null);

  // Load the signed-in parent's child (with a local fallback) so the page is
  // personalized to their child and interests, not a hardcoded sample.
  useEffect(() => {
    function applyLocal() {
      try {
        const raw = window.localStorage.getItem('learn-together-child-profile');
        if (!raw) return;
        const local = JSON.parse(raw) as { name?: string; interests?: string[] };
        setChildName(local.name ?? null);
        setChildInterests(local.interests ?? []);
      } catch {
        /* ignore malformed local data */
      }
    }
    const client = getCustomerClient();
    if (!client) {
      applyLocal();
      return;
    }
    client
      .listChildren()
      .then((items) => {
        const first = items[0];
        if (first) {
          setChildName(first.name);
          setChildInterests(first.interests ?? []);
        } else {
          applyLocal();
        }
      })
      .catch(applyLocal);
  }, []);

  useEffect(() => {
    const category = new URLSearchParams(window.location.search).get('category');
    const requestedView = new URLSearchParams(window.location.search).get('view');
    if (category) {
      setQuery(category);
      setViewMode('List');
    }
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
      const typed = query.trim();
      // With no typed query, rank by the child's interests so relevant classes
      // surface first (personalized discovery).
      const rankQuery = typed || childInterests.join(' ');
      setDataStatus('loading');
      void Promise.all([
        scheduling.discoverClasses({ ...origin, radiusMeters: 5000, days: 21 }),
        rankQuery
          ? search.searchClasses(rankQuery, { ...origin, radiusMeters: 5000 }).catch(() => null)
          : Promise.resolve(null),
      ])
        .then(([offerings, searchResponse]) => {
          if (cancelled) return;
          let mapped = offerings.map(toClassCard);
          const rank = new Map(
            searchResponse?.hits.map((hit, index) => [hit.classId, index]) ?? [],
          );
          const rankOf = (item: ClassCardData) =>
            item.backendId && rank.has(item.backendId)
              ? rank.get(item.backendId)!
              : Number.MAX_SAFE_INTEGER;
          if (typed) {
            // Explicit search: filter to matches (semantic rank, else text match).
            const normalized = typed.toLowerCase();
            mapped = rank.size
              ? mapped
                  .filter((item) => item.backendId && rank.has(item.backendId))
                  .sort((a, b) => rankOf(a) - rankOf(b))
              : mapped.filter((item) =>
                  `${item.title} ${item.category} ${item.age}`.toLowerCase().includes(normalized),
                );
          } else if (rank.size) {
            // Interest-based: reorder (don't filter) so matches lead the list.
            mapped = [...mapped].sort((a, b) => rankOf(a) - rankOf(b));
          }
          setAllClasses(mapped);
          setSelectedSlug((current) =>
            mapped.some((item) => item.slug === current) ? current : (mapped[0]?.slug ?? ''),
          );
          setDataStatus('live');
        })
        .catch(() => {
          if (cancelled) return;
          setAllClasses([]);
          setSelectedSlug('');
          setDataStatus('error');
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, childInterests.join(',')]);

  const visibleClasses = useMemo(
    () =>
      allClasses.filter(
        (item) => activeFilter === 'All' || item.availability.includes(activeFilter),
      ),
    [activeFilter, allClasses],
  );
  const selectedClass =
    visibleClasses.find((item) => item.slug === selectedSlug) ?? visibleClasses[0];
  const selectClass = useCallback((slug: string) => setSelectedSlug(slug), []);

  return (
    <main className="page-canvas">
      <div className="phone-shell discover-page">
        <AppHeader greeting={false} />
        <section className="discover-intro">
          <span className="eyebrow purple">DISCOVER</span>
          <h1>
            What would {childName ?? 'your child'}
            <br />
            like to explore?
          </h1>
          <p>
            {childInterests.length
              ? `Classes close to home for ${childInterests.slice(0, 3).join(', ')}.`
              : 'Classes close to home, picked for your family.'}
          </p>
        </section>
        <label className="search-field">
          <Icon name="search" size={20} />
          <input
            ref={searchInput}
            aria-label="Search classes"
            placeholder="Search activities, skills, teachers…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setViewMode('List');
            }}
          />
          <kbd>⌘ K</kbd>
        </label>
        <div className="view-switcher" aria-label="Discover view">
          {viewModes.map((mode) => (
            <button
              type="button"
              aria-pressed={viewMode === mode}
              className={viewMode === mode ? 'active' : ''}
              key={mode}
              onClick={() => setViewMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="filter-row" aria-label="Class filters">
          {filters.map((filter) => (
            <button
              className={activeFilter === filter ? 'active' : ''}
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        {viewMode === 'Categories' && !query && (
          <section className="section-block discover-categories">
            <div className="section-heading">
              <div>
                <h2>Browse by interest</h2>
              </div>
            </div>
            {dataStatus === 'loading' && <p className="section-hint">Loading nearby classes…</p>}
            {dataStatus === 'error' && (
              <p className="form-error" role="alert">
                Classes are temporarily unavailable. Please refresh and try again.
              </p>
            )}
            <div className="category-grid">
              {categories.map((category) => (
                <button
                  className={`category-tile ${category.tone}`}
                  type="button"
                  key={category.name}
                  onClick={() => {
                    setQuery(category.query);
                    setViewMode('List');
                  }}
                >
                  <span className="category-icon">{category.icon}</span>
                  <strong>{category.name}</strong>
                  <small>{categoryCount(category.query)} classes</small>
                  <span className="tile-arrow">↗</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {viewMode === 'List' && (
          <section className="section-block results-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow coral">{activeFilter.toUpperCase()}</span>
                <h2>
                  {query
                    ? 'Search results'
                    : childInterests.length
                      ? `Picked for ${childName ?? 'your child'}`
                      : 'Popular near you'}
                </h2>
              </div>
              <button
                type="button"
                className="filter-link"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((value) => !value)}
              >
                Filters <span>⌁</span>
              </button>
            </div>
            {filtersOpen && (
              <div className="quick-filters" role="region" aria-label="Quick filters">
                <strong>Quick filters</strong>
                <button
                  className={activeFilter === 'Nearby' ? 'active' : ''}
                  onClick={() => setActiveFilter('Nearby')}
                >
                  Within 2 km
                </button>
                <button
                  className={activeFilter === 'Weekend' ? 'active' : ''}
                  onClick={() => setActiveFilter('Weekend')}
                >
                  This weekend
                </button>
                <button
                  onClick={() => {
                    setActiveFilter('All');
                    setQuery('');
                  }}
                >
                  Reset
                </button>
                <button className="done" onClick={() => setFiltersOpen(false)}>
                  Done
                </button>
              </div>
            )}
            <div className="class-list">
              {visibleClasses.map((item) => (
                <ClassCard item={item} key={item.slug} />
              ))}
              {visibleClasses.length === 0 && (
                <div className="empty-state">
                  <span>✦</span>
                  <h3>No perfect match yet</h3>
                  <p>Try searching for art, music, STEM, or stories.</p>
                </div>
              )}
            </div>
          </section>
        )}
        {viewMode === 'Map' && (
          <section className="section-block map-results-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow coral">
                  {dataStatus === 'loading' ? 'LOADING NEARBY CLASSES' : 'NEAR YOU'}
                </span>
                <h2>{visibleClasses.length} classes around you</h2>
              </div>
              <button className="filter-link" onClick={() => setRecenterKey((value) => value + 1)}>
                Recenter
              </button>
            </div>
            <RealDiscoveryMap
              items={visibleClasses}
              selectedSlug={selectedClass?.slug}
              onSelect={selectClass}
              recenterKey={recenterKey}
            />
            {selectedClass ? (
              <div className="map-preview">
                <ClassCard item={selectedClass} compact />
              </div>
            ) : (
              <div className="empty-state">
                <h3>No classes on this map</h3>
                <p>Try another day or reset your filters.</p>
              </div>
            )}
          </section>
        )}
        <BottomNav />
      </div>
    </main>
  );

  function categoryCount(categoryQuery: string): number {
    const normalized = categoryQuery.toLowerCase();
    return allClasses.filter((item) =>
      `${item.category} ${item.title}`.toLowerCase().includes(normalized),
    ).length;
  }
}
