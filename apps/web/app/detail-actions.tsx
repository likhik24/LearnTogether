'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from './ui';

export function DetailTopActions({ slug, title }: { slug: string; title: string }) {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    setSaved(window.localStorage.getItem(`learn-together-saved-${slug}`) === 'true');
  }, [slug]);

  function toggleSaved() {
    setSaved((value) => {
      const nextValue = !value;
      window.localStorage.setItem(`learn-together-saved-${slug}`, String(nextValue));
      return nextValue;
    });
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
      <button className={`round-action ${saved ? 'saved' : ''}`} aria-label={saved ? 'Remove saved class' : 'Save class'} aria-pressed={saved} onClick={toggleSaved}>
        <Icon name="heart" />
      </button>
    </>
  );
}

export function BookingBar({ price, spots }: { price: number; spots: number }) {
  const [step, setStep] = useState<'idle' | 'held' | 'booked'>('idle');

  function confirmBooking() {
    window.localStorage.setItem('learn-together-booking', JSON.stringify({ title: 'Build-a-Car STEM Workshop', date: 'Sat, 17 May', time: '10:30 AM', price }));
    setStep('booked');
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
                <p>Build-a-Car STEM Workshop<br />Sat, 17 May • 10:30 AM</p>
                <button className="primary-wide" onClick={confirmBooking}>Confirm ₹{price} booking</button>
                <small>Demo checkout — no payment will be charged.</small>
              </>
            ) : (
              <>
                <span className="eyebrow purple">BOOKING CONFIRMED</span>
                <h2>You’re all set.</h2>
                <p>We’ve added the workshop to your bookings.<br />Sat, 17 May • 10:30 AM</p>
                <Link className="primary-wide link-button" href="/bookings">View my bookings</Link>
                <small>A confirmation has been saved to this demo.</small>
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
