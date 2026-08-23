'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCustomerClient } from '../lib/customer-session';
import { Icon } from './ui';

export function DetailTopActions({ slug, title }: { slug: string; title: string }) {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const client = getCustomerClient();
    if (client) {
      client.listSavedClasses()
        .then((items) => setSaved(items.some((item) => item.classRef === slug)))
        .catch(() => setSaved(window.localStorage.getItem(`learn-together-saved-${slug}`) === 'true'));
      return;
    }
    setSaved(window.localStorage.getItem(`learn-together-saved-${slug}`) === 'true');
  }, [slug]);

  async function toggleSaved() {
    const nextValue = !saved;
    setSaved(nextValue);
    window.localStorage.setItem(`learn-together-saved-${slug}`, String(nextValue));
    const client = getCustomerClient();
    if (!client) return;
    try {
      if (nextValue) await client.saveClass(slug, title);
      else await client.removeSavedClass(slug);
    } catch {
      // Keep the local copy so the interaction remains usable while offline.
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      // Cancelling the native share sheet should leave the page unchanged.
    }
  }

  return (
    <>
      <button className="round-action" aria-label={shared ? 'Link copied' : 'Share class'} onClick={() => void share()}>
        <Icon name={shared ? 'check' : 'share'} />
      </button>
      <button className={`round-action ${saved ? 'saved' : ''}`} aria-label={saved ? 'Remove saved class' : 'Save class'} aria-pressed={saved} onClick={() => void toggleSaved()}>
        <Icon name="heart" />
      </button>
    </>
  );
}

export function BookingBar({ classRef, title, price, spots }: { classRef: string; title: string; price: number; spots: number }) {
  const [step, setStep] = useState<'idle' | 'held' | 'booked'>('idle');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingPending, setBookingPending] = useState(false);

  async function confirmBooking() {
    if (bookingPending) return;
    setBookingPending(true);
    setBookingError(null);
    const localBooking = { classRef, title, date: 'Sat, 17 May', time: '10:30 AM', price };
    const client = getCustomerClient();
    try {
      const booking = client ? await client.createBooking({
        classRef,
        title,
        scheduledStart: '2031-05-17T05:00:00.000Z',
        amountMinor: price * 100,
        currency: 'INR',
      }) : null;
      window.localStorage.setItem('learn-together-booking', JSON.stringify({ ...localBooking, id: booking?.id }));
      setStep('booked');
    } catch {
      window.localStorage.setItem('learn-together-booking', JSON.stringify(localBooking));
      setBookingError('The API is unavailable, so this booking was saved on this device.');
      setStep('booked');
    } finally {
      setBookingPending(false);
    }
  }

  return (
    <>
      <aside className="booking-bar">
        <div><span><strong>₹{price}</strong> trial class</span><small><b>{spots} spots</b> left for Saturday</small></div>
        <button type="button" onClick={() => setStep('held')}>Book trial <span>→</span></button>
      </aside>
      {step !== 'idle' && (
        <div className="booking-overlay" role="dialog" aria-modal="true" aria-label="Trial class reserved">
          <button className="overlay-backdrop" aria-label="Close booking confirmation" onClick={() => setStep('idle')} />
          <div className="booking-sheet">
            <button className="sheet-close" aria-label="Close" onClick={() => setStep('idle')}>×</button>
            <span className="success-mark"><Icon name="check" size={27} /></span>
            {step === 'held' ? (
              <>
                <span className="eyebrow purple">SPOT HELD FOR 10 MINUTES</span>
                <h2>Abhiram’s Saturday<br />just got more exciting.</h2>
                <p>{title}<br />Sat, 17 May • 10:30 AM</p>
                <button className="primary-wide" disabled={bookingPending} onClick={() => void confirmBooking()}>{bookingPending ? 'Confirming…' : `Confirm ₹${price} booking`}</button>
                <small>Demo checkout — no payment will be charged.</small>
              </>
            ) : (
              <>
                <span className="eyebrow purple">BOOKING CONFIRMED</span>
                <h2>You’re all set.</h2>
                <p>We’ve added the workshop to your bookings.<br />Sat, 17 May • 10:30 AM</p>
                <Link className="primary-wide link-button" href="/bookings">View my bookings</Link>
                <small>{bookingError ?? (getCustomerClient() ? 'Synced to your LearnTogether account.' : 'Saved on this device. Sign in to sync future bookings.')}</small>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function ReviewsButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>{count} parent reviews</button>
      {open && (
        <div className="app-overlay" role="dialog" aria-modal="true" aria-label="Parent reviews">
          <button className="overlay-backdrop" aria-label="Close reviews" onClick={() => setOpen(false)} />
          <section className="app-sheet reviews-sheet">
            <div className="sheet-heading"><div><span className="eyebrow purple">4.9 OUT OF 5</span><h2>Parents loved it</h2></div><button aria-label="Close" onClick={() => setOpen(false)}>×</button></div>
            <article><strong>“He talked about his car all evening.”</strong><p>The group was small, Meera was wonderfully patient, and every child got hands-on time.</p><small>— Kavya, parent of a 5-year-old</small></article>
            <article><strong>“Exactly the right level of challenge.”</strong><p>Fun enough to feel like play, but he learned how wheels and axles work too.</p><small>— Arjun, parent of a 4-year-old</small></article>
            <button className="secondary-wide" onClick={() => setOpen(false)}>Done</button>
          </section>
        </div>
      )}
    </>
  );
}
