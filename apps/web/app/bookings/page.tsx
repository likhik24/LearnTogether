'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { BookingDto } from '@learn-and-build/types';
import { BookingStatus } from '@learn-and-build/types';
import { getCustomerClient, hydrateCustomerSession } from '../../lib/customer-session';
import { AppHeader, BottomNav, Icon } from '../ui';
import { ChildName } from '../child-name';

type PageState = 'checking' | 'anonymous' | 'loading' | 'ready' | 'error';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [pageState, setPageState] = useState<PageState>('checking');
  const [cancelTarget, setCancelTarget] = useState<BookingDto | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    setError(null);
    const user = await hydrateCustomerSession();
    if (!user) {
      setBookings([]);
      setPageState('anonymous');
      return;
    }
    const client = getCustomerClient();
    if (!client) {
      setPageState('anonymous');
      return;
    }
    setPageState('loading');
    try {
      const items = await client.listBookings();
      setBookings(items.filter((item) => item.status === BookingStatus.CONFIRMED));
      setPageState('ready');
    } catch {
      setPageState('error');
      setError('We could not load your bookings. Please try again.');
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  async function cancelBooking() {
    if (!cancelTarget || cancelling) return;
    const client = getCustomerClient();
    if (!client) {
      setCancelTarget(null);
      setPageState('anonymous');
      return;
    }
    setCancelling(true);
    setError(null);
    try {
      await client.cancelBooking(cancelTarget.id);
      setBookings((current) => current.filter((item) => item.id !== cancelTarget.id));
      setCancelTarget(null);
    } catch {
      setError('That booking was not cancelled. Please try again.');
      setCancelTarget(null);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="page-canvas">
      <div className="phone-shell bookings-page">
        <AppHeader />
        <span className="eyebrow purple">YOUR PLANS</span>
        <h1>{bookings.length ? 'Your family calendar.' : 'Good things belong on the calendar.'}</h1>
        <p>
          {bookings.length ? (
            <>
              Everything you need for <ChildName possessive /> upcoming classes.
            </>
          ) : (
            'Your trial classes and upcoming activities will live here.'
          )}
        </p>

        {(pageState === 'checking' || pageState === 'loading') && (
          <div className="empty-bookings" role="status">
            <span>
              <Icon name="calendar" size={35} />
            </span>
            <h2>Loading your plans…</h2>
            <p>Checking your secure account.</p>
          </div>
        )}
        {pageState === 'anonymous' && (
          <div className="empty-bookings">
            <span>
              <Icon name="profile" size={35} />
            </span>
            <h2>Sign in to see your bookings</h2>
            <p>Bookings are tied to your account so only you can view or cancel them.</p>
            <Link href="/profile?returnTo=%2Fbookings">Sign in or create account →</Link>
          </div>
        )}
        {pageState === 'error' && (
          <div className="empty-bookings">
            <span>
              <Icon name="calendar" size={35} />
            </span>
            <h2>We couldn’t load your plans</h2>
            <p>{error}</p>
            <button className="primary-wide" type="button" onClick={() => void loadBookings()}>
              Try again
            </button>
          </div>
        )}
        {pageState === 'ready' && bookings.length === 0 && (
          <div className="empty-bookings">
            <span>
              <Icon name="calendar" size={35} />
            </span>
            <h2>No bookings yet</h2>
            <p>
              Find a class <ChildName /> will love and reserve a trial.
            </p>
            <Link href="/discover">Explore classes →</Link>
          </div>
        )}
        {pageState === 'ready' && bookings.length > 0 && (
          <section className="bookings-list" aria-label="Upcoming bookings">
            {bookings.map((booking) => {
              const start = new Date(booking.scheduledStart);
              const month = new Intl.DateTimeFormat('en-IN', { month: 'short' })
                .format(start)
                .toUpperCase();
              const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })
                .format(start)
                .toUpperCase();
              return (
                <article className="booked-card" key={booking.id}>
                  <div className="booking-date">
                    <span>{month}</span>
                    <strong>{start.getDate()}</strong>
                    <small>{weekday}</small>
                  </div>
                  <div>
                    <span className="status-pill">CONFIRMED</span>
                    <h2>{booking.title}</h2>
                    <p>
                      {new Intl.DateTimeFormat('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(start)}
                    </p>
                    <small>
                      {booking.childName ? `For ${booking.childName} • ` : ''}₹
                      {booking.amountMinor / 100} payable at venue • Synced with your account
                    </small>
                  </div>
                  <div className="booking-actions">
                    <Link href={`/classes/${booking.classSlug ?? booking.classRef}`}>
                      View details
                    </Link>
                    <button onClick={() => setCancelTarget(booking)}>Cancel booking</button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
        {error && pageState === 'ready' && (
          <p className="form-error account-feedback" role="alert">
            {error}
          </p>
        )}
        <BottomNav />
      </div>
      {cancelTarget && (
        <div className="app-overlay" role="dialog" aria-modal="true" aria-label="Cancel booking">
          <button
            className="overlay-backdrop"
            aria-label="Keep booking"
            onClick={() => setCancelTarget(null)}
          />
          <section className="app-sheet customer-access-sheet">
            <div className="sheet-heading">
              <div>
                <span className="eyebrow coral">CANCEL BOOKING?</span>
                <h2>Release this class spot?</h2>
              </div>
              <button aria-label="Close" onClick={() => setCancelTarget(null)}>
                ×
              </button>
            </div>
            <p>
              {cancelTarget.title} will be removed from your plans and its seat will become
              available to another family.
            </p>
            <button
              className="danger-wide"
              type="button"
              disabled={cancelling}
              onClick={() => void cancelBooking()}
            >
              {cancelling ? 'Cancelling…' : 'Yes, cancel booking'}
            </button>
            <button
              className="secondary-wide"
              type="button"
              disabled={cancelling}
              onClick={() => setCancelTarget(null)}
            >
              Keep booking
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
