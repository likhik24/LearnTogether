'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BookingDto } from '@learn-and-build/types';
import { BookingStatus } from '@learn-and-build/types';
import { getCustomerClient } from '../../lib/customer-session';
import { AppHeader, BottomNav, Icon } from '../ui';
import { ChildName } from '../child-name';

type LocalBooking = { id?: string; classRef?: string; classSlug?: string; title: string; date: string; time: string; price: number };
type DisplayBooking = LocalBooking & { source?: BookingDto };

export default function BookingsPage() {
  const [booking, setBooking] = useState<DisplayBooking | null>(null);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    const loadLocal = () => {
      const saved = window.localStorage.getItem('learn-together-booking');
      if (saved) {
        try { setBooking(JSON.parse(saved) as LocalBooking); } catch { window.localStorage.removeItem('learn-together-booking'); }
      }
    };
    const client = getCustomerClient();
    if (!client) { loadLocal(); return; }
    client.listBookings().then((items) => {
      const item = items.find((entry) => entry.status === BookingStatus.CONFIRMED);
      if (!item) { loadLocal(); return; }
      const start = new Date(item.scheduledStart);
      setBooking({
        id: item.id,
        classRef: item.classRef,
        classSlug: item.classSlug ?? undefined,
        title: item.title,
        date: new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(start),
        time: new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(start),
        price: item.amountMinor / 100,
        source: item,
      });
      setSyncMessage('Synced with your account');
    }).catch(() => { setSyncMessage('API unavailable — showing this device'); loadLocal(); });
  }, []);

  async function cancelBooking() {
    const client = getCustomerClient();
    if (client && booking?.id) {
      try { await client.cancelBooking(booking.id); } catch { setSyncMessage('Could not cancel. Please try again.'); return; }
    }
    window.localStorage.removeItem('learn-together-booking');
    setBooking(null);
  }

  const calendarDate = booking?.source ? new Date(booking.source.scheduledStart) : null;
  const calendarMonth = calendarDate ? new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(calendarDate).toUpperCase() : 'MAY';
  const calendarDay = calendarDate ? calendarDate.getDate() : 17;
  const calendarWeekday = calendarDate ? new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(calendarDate).toUpperCase() : 'SAT';

  return (
    <main className="page-canvas">
      <div className="phone-shell bookings-page">
        <AppHeader />
        <span className="eyebrow purple">YOUR PLANS</span>
        <h1>{booking ? 'Saturday is sorted.' : 'Good things belong on the calendar.'}</h1>
        <p>{booking ? <>Everything you need for <ChildName possessive /> upcoming class.</> : 'Your trial classes and upcoming activities will live here.'}</p>
        {booking ? (
          <section className="booked-card">
            <div className="booking-date"><span>{calendarMonth}</span><strong>{calendarDay}</strong><small>{calendarWeekday}</small></div>
            <div><span className="status-pill">CONFIRMED</span><h2>{booking.title}</h2><p>{booking.date} • {booking.time}</p><small>Little Makers Studio • Hitech City{syncMessage ? ` • ${syncMessage}` : ''}</small></div>
            <div className="booking-actions"><Link href={`/classes/${booking.classSlug ?? booking.classRef ?? 'build-a-car'}`}>View details</Link><button onClick={() => void cancelBooking()}>Cancel booking</button></div>
          </section>
        ) : (
          <div className="empty-bookings"><span><Icon name="calendar" size={35} /></span><h2>No bookings yet</h2><p>Find a class <ChildName /> will love and reserve a trial.</p><Link href="/discover">Explore classes →</Link></div>
        )}
        <BottomNav />
      </div>
    </main>
  );
}
