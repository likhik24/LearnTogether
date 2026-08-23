'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ClassCardData } from './data';

type IconName =
  | 'home' | 'search' | 'calendar' | 'child' | 'profile' | 'location'
  | 'bell' | 'arrow' | 'heart' | 'share' | 'clock' | 'star' | 'shield' | 'check';

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  child: <><circle cx="12" cy="8" r="4"/><path d="M5 21c.8-5 3-7 7-7s6.2 2 7 7"/></>,
  profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 3.7-7 8-7s7 2.5 8 7"/></>,
  location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  arrow: <path d="m15 18-6-6 6-6"/>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
  share: <><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>,
  shield: <path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z"/>,
  check: <path d="m5 12 4 4L19 6"/>,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export function AppHeader({ greeting = true }: { greeting?: boolean }) {
  return (
    <header className="app-header">
      <div>
        {greeting && <span className="eyebrow">Good morning, Priya</span>}
        <button className="location-button" type="button" aria-label="Change location">
          <Icon name="location" size={16} /> Hitech City, Hyderabad <span>⌄</span>
        </button>
      </div>
      <button className="icon-button notification" type="button" aria-label="Notifications">
        <Icon name="bell" size={21} /><span className="notification-dot" />
      </button>
    </header>
  );
}

const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/discover', label: 'Discover', icon: 'search' },
  { href: '/bookings', label: 'Bookings', icon: 'calendar' },
  { href: '/children', label: 'My Child', icon: 'child' },
  { href: '/profile', label: 'Profile', icon: 'profile' },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link className={active ? 'active' : ''} href={item.href} key={item.label}>
            <Icon name={item.icon} size={21} /><span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function ClassCard({ item, compact = false }: { item: ClassCardData; compact?: boolean }) {
  return (
    <Link className={`class-card ${compact ? 'class-card-compact' : ''}`} href={`/classes/${item.slug}`}>
      <div className={`class-image image-${item.tone}`}>
        <img src={item.image} alt="" />
        {!compact && <span className="category-tag">{item.category}</span>}
      </div>
      <div className="class-card-copy">
        <div className="class-card-topline"><h3>{item.title}</h3>{!compact && <span className="small-heart">♡</span>}</div>
        <p>{item.age} <span>•</span> {item.distance}</p>
        <p>{item.time} <span>•</span> {item.spots} spots left</p>
        <div className="class-card-meta">
          <span className="rating"><Icon name="star" size={14} /> {item.rating} ({item.reviews})</span>
          <strong>₹{item.price} <small>Trial</small></strong>
        </div>
      </div>
    </Link>
  );
}
