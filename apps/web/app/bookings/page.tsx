'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppHeader, BottomNav, Icon } from '../ui';

type Booking = { title: string; date: string; time: string; price: number };

export default function BookingsPage() {
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem('learn-together-booking');
    if (saved) setBooking(JSON.parse(saved) as Booking);
  }, []);

  function cancelBooking() {
    window.localStorage.removeItem('learn-together-booking');
    setBooking(null);
  }

  return (
    <main className="page-canvas">
      <div className="phone-shell bookings-page">
        <AppHeader />
        <span className="eyebrow purple">YOUR PLANS</span>
        <h1>{booking ? 'Saturday is sorted.' : 'Good things belong on the calendar.'}</h1>
        <p>{booking ? 'Everything you need for Abhiram’s upcoming class.' : 'Your trial classes and upcoming activities will live here.'}</p>
        {booking ? (
          <section className="booked-card">
            <div className="booking-date"><span>MAY</span><strong>17</strong><small>SAT</small></div>
            <div><span className="status-pill">CONFIRMED</span><h2>{booking.title}</h2><p>{booking.date} • {booking.time}</p><small>Little Makers Studio • Hitech City</small></div>
            <div className="booking-actions"><Link href="/classes/build-a-car">View details</Link><button onClick={cancelBooking}>Cancel booking</button></div>
          </section>
        ) : (
          <div className="empty-bookings"><span><Icon name="calendar" size={35} /></span><h2>No bookings yet</h2><p>Find a class Abhiram will love and reserve a trial.</p><Link href="/discover">Explore classes →</Link></div>
        )}
        <BottomNav />
      </div>
    </main>
  );
}
