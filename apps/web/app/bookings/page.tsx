'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type {
  BookingDto,
  BookingRescheduleRequestDto,
  ClassOccurrence,
  ClassReviewDto,
  ClassWaitlistDto,
} from '@learn-and-build/types';
import { BookingStatus } from '@learn-and-build/types';
import { getCustomerClient, hydrateCustomerSession } from '../../lib/customer-session';
import { runPaymentCheckout } from '../../lib/payment-checkout';
import { AppHeader, BottomNav, Icon } from '../ui';
import { ChildName } from '../child-name';
import { createSchedulingClient } from '../../lib/api';

type PageState = 'checking' | 'anonymous' | 'loading' | 'ready' | 'error';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [reviews, setReviews] = useState<ClassReviewDto[]>([]);
  const [waitlist, setWaitlist] = useState<ClassWaitlistDto[]>([]);
  const [rescheduleRequests, setRescheduleRequests] = useState<BookingRescheduleRequestDto[]>([]);
  const [pageState, setPageState] = useState<PageState>('checking');
  const [cancelTarget, setCancelTarget] = useState<BookingDto | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<BookingDto | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingDto | null>(null);
  const [rescheduleOptions, setRescheduleOptions] = useState<ClassOccurrence[]>([]);
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

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
      const [items, loadedReviews, loadedWaitlist, loadedReschedules] = await Promise.all([
        client.listBookings(),
        client.listMyReviews(),
        client.listWaitlist(),
        client.listRescheduleRequests(),
      ]);
      setBookings(items.filter((item) => item.status !== BookingStatus.CANCELLED));
      setReviews(loadedReviews);
      setWaitlist(loadedWaitlist);
      setRescheduleRequests(loadedReschedules);
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

  async function completePayment(booking: BookingDto) {
    setPayingId(booking.id);
    setError(null);
    try {
      await runPaymentCheckout(booking);
      setBookings((items) =>
        items.map((item) =>
          item.id === booking.id ? { ...item, status: BookingStatus.CONFIRMED } : item,
        ),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Payment could not be completed.');
    } finally {
      setPayingId(null);
    }
  }

  function openReview(booking: BookingDto) {
    const existing = reviews.find((item) => item.bookingId === booking.id);
    setReviewTarget(booking);
    setReviewRating(existing?.rating ?? 5);
    setReviewComment(existing?.comment ?? '');
  }

  async function submitReview() {
    if (!reviewTarget || reviewing) return;
    const client = getCustomerClient();
    if (!client) {
      setReviewTarget(null);
      setPageState('anonymous');
      return;
    }
    setReviewing(true);
    setError(null);
    try {
      const saved = await client.reviewBooking(reviewTarget.id, reviewRating, reviewComment);
      setReviews((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setReviewTarget(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your review could not be saved.');
    } finally {
      setReviewing(false);
    }
  }

  async function openReschedule(booking: BookingDto) {
    setError(null);
    setRescheduleTarget(booking);
    setRescheduleOptions([]);
    setRescheduleStart('');
    try {
      const options = (
        await createSchedulingClient().classAvailability(booking.classRef, 120)
      ).filter((item) => item.seatsAvailable > 0 && item.start !== booking.scheduledStart);
      setRescheduleOptions(options);
      setRescheduleStart(options[0]?.start ?? '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load alternate sessions.');
    }
  }

  async function requestReschedule() {
    if (!rescheduleTarget || !rescheduleStart) return;
    const client = getCustomerClient();
    if (!client) return;
    setRescheduling(true);
    try {
      const request = await client.requestBookingReschedule(rescheduleTarget.id, rescheduleStart);
      setRescheduleRequests((items) => [
        request,
        ...items.filter((item) => item.bookingId !== request.bookingId),
      ]);
      setRescheduleTarget(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not request this change.');
    } finally {
      setRescheduling(false);
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
              const existingReview = reviews.find((item) => item.bookingId === booking.id);
              const canReview =
                booking.status === BookingStatus.CONFIRMED && start.getTime() < Date.now();
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
                    <span
                      className={`status-pill ${booking.status === BookingStatus.PENDING_PAYMENT ? 'pending' : ''}`}
                    >
                      {booking.status === BookingStatus.PENDING_PAYMENT
                        ? 'PAYMENT PENDING'
                        : 'CONFIRMED'}
                    </span>
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
                      {booking.amountMinor / 100}{' '}
                      {booking.status === BookingStatus.PENDING_PAYMENT ? 'due online' : 'paid'} •
                      Synced with your account
                    </small>
                  </div>
                  <div className="booking-actions">
                    {booking.status === BookingStatus.PENDING_PAYMENT && (
                      <button
                        onClick={() => void completePayment(booking)}
                        disabled={payingId === booking.id}
                      >
                        {payingId === booking.id ? 'Opening payment…' : 'Pay now'}
                      </button>
                    )}
                    <Link href={`/classes/${booking.classSlug ?? booking.classRef}`}>
                      View details
                    </Link>
                    {booking.status === BookingStatus.CONFIRMED && (
                      <button onClick={() => downloadCalendarEvent(booking)}>
                        Add to calendar
                      </button>
                    )}
                    {start.getTime() > Date.now() && (
                      <>
                        {booking.status === BookingStatus.CONFIRMED && (
                          <button
                            disabled={rescheduleRequests.some(
                              (item) =>
                                item.bookingId === booking.id && item.status === 'requested',
                            )}
                            onClick={() => void openReschedule(booking)}
                          >
                            {rescheduleRequests.some(
                              (item) =>
                                item.bookingId === booking.id && item.status === 'requested',
                            )
                              ? 'Change requested'
                              : 'Request another time'}
                          </button>
                        )}
                        <button onClick={() => setCancelTarget(booking)}>Cancel booking</button>
                      </>
                    )}
                    {canReview && (
                      <button className="review-booking-action" onClick={() => openReview(booking)}>
                        {existingReview
                          ? `Edit ${existingReview.rating}-star review`
                          : 'Review class'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
        {pageState === 'ready' && waitlist.length > 0 && (
          <section className="bookings-list waitlist-list" aria-label="Class waitlist">
            <h2>Your waitlist</h2>
            {waitlist
              .filter((item) => item.status === 'waiting' || item.status === 'offered')
              .map((item) => (
                <article className="booked-card" key={item.id}>
                  <div className="booking-date">
                    <strong>{item.position || '!'}</strong>
                    <small>QUEUE</small>
                  </div>
                  <div>
                    <span className="status-pill pending">{item.status.toUpperCase()}</span>
                    <h2>{item.childName}</h2>
                    <p>
                      {new Intl.DateTimeFormat('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(item.occurrenceStart))}
                    </p>
                    {item.offerExpiresAt && (
                      <small>
                        Seat offer expires {new Date(item.offerExpiresAt).toLocaleString('en-IN')}
                      </small>
                    )}
                  </div>
                  <div className="booking-actions">
                    <button
                      onClick={() =>
                        void getCustomerClient()
                          ?.leaveWaitlist(item.id)
                          .then(() =>
                            setWaitlist((items) => items.filter((entry) => entry.id !== item.id)),
                          )
                      }
                    >
                      Leave waitlist
                    </button>
                  </div>
                </article>
              ))}
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
      {reviewTarget && (
        <div className="app-overlay" role="dialog" aria-modal="true" aria-label="Review class">
          <button
            className="overlay-backdrop"
            aria-label="Close review"
            onClick={() => setReviewTarget(null)}
          />
          <section className="app-sheet customer-access-sheet review-sheet">
            <div className="sheet-heading">
              <div>
                <span className="eyebrow purple">VERIFIED REVIEW</span>
                <h2>How was {reviewTarget.title}?</h2>
              </div>
              <button aria-label="Close" onClick={() => setReviewTarget(null)}>
                ×
              </button>
            </div>
            <fieldset className="review-rating-picker">
              <legend>Your rating</legend>
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  className={rating <= reviewRating ? 'active' : ''}
                  aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
                  aria-pressed={reviewRating === rating}
                  onClick={() => setReviewRating(rating)}
                >
                  ★
                </button>
              ))}
            </fieldset>
            <label className="provider-label">
              <span>Share something helpful (optional)</span>
              <textarea
                maxLength={2000}
                rows={4}
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="What did your child enjoy?"
              />
            </label>
            <button
              className="primary-wide"
              disabled={reviewing}
              onClick={() => void submitReview()}
            >
              {reviewing ? 'Saving…' : 'Publish verified review'}
            </button>
          </section>
        </div>
      )}
      {rescheduleTarget && (
        <div
          className="app-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Request another class time"
        >
          <button
            className="overlay-backdrop"
            aria-label="Close"
            onClick={() => setRescheduleTarget(null)}
          />
          <section className="app-sheet customer-access-sheet">
            <div className="sheet-heading">
              <div>
                <span className="eyebrow purple">CHANGE SESSION</span>
                <h2>Choose another available time</h2>
              </div>
              <button aria-label="Close" onClick={() => setRescheduleTarget(null)}>
                ×
              </button>
            </div>
            <label className="provider-label">
              <span>Available sessions</span>
              <select
                value={rescheduleStart}
                onChange={(event) => setRescheduleStart(event.target.value)}
              >
                {rescheduleOptions.map((item) => (
                  <option key={item.start} value={item.start}>
                    {new Date(item.start).toLocaleString('en-IN')} · {item.seatsAvailable} seats
                  </option>
                ))}
              </select>
            </label>
            {!rescheduleOptions.length && <p>No alternate sessions currently have space.</p>}
            <button
              className="primary-wide"
              disabled={!rescheduleStart || rescheduling}
              onClick={() => void requestReschedule()}
            >
              {rescheduling ? 'Sending request…' : 'Send request to provider'}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function downloadCalendarEvent(booking: BookingDto): void {
  const start = new Date(booking.scheduledStart);
  const end = new Date(start.getTime() + 60 * 60_000);
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const escape = (value: string) => value.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LearnTogether//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@learnandbuild.org`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(booking.title)}`,
    `DESCRIPTION:${escape(`Booked for ${booking.childName ?? 'learner'}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${booking.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
