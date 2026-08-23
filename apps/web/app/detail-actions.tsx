'use client';

import { useState } from 'react';
import { Icon } from './ui';

export function DetailTopActions() {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: 'Build-a-Car STEM Workshop', url: window.location.href });
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
    setShared(true);
    window.setTimeout(() => setShared(false), 1800);
  }

  return (
    <>
      <button className="round-action" aria-label={shared ? 'Link copied' : 'Share class'} onClick={() => void share()}>
        <Icon name={shared ? 'check' : 'share'} />
      </button>
      <button className={`round-action ${saved ? 'saved' : ''}`} aria-label={saved ? 'Remove saved class' : 'Save class'} aria-pressed={saved} onClick={() => setSaved((value) => !value)}>
        <Icon name="heart" />
      </button>
    </>
  );
}

export function BookingBar({ price, spots }: { price: number; spots: number }) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <>
      <aside className="booking-bar">
        <div><span><strong>₹{price}</strong> trial class</span><small><b>{spots} spots</b> left for Saturday</small></div>
        <button type="button" onClick={() => setConfirmed(true)}>Book trial <span>→</span></button>
      </aside>
      {confirmed && (
        <div className="booking-overlay" role="dialog" aria-modal="true" aria-label="Trial class reserved">
          <button className="overlay-backdrop" aria-label="Close booking confirmation" onClick={() => setConfirmed(false)} />
          <div className="booking-sheet">
            <button className="sheet-close" aria-label="Close" onClick={() => setConfirmed(false)}>×</button>
            <span className="success-mark"><Icon name="check" size={27} /></span>
            <span className="eyebrow purple">SPOT HELD FOR 10 MINUTES</span>
            <h2>Abhiram’s Saturday<br />just got more exciting.</h2>
            <p>Build-a-Car STEM Workshop<br />Sat, 17 May • 10:30 AM</p>
            <button className="primary-wide" onClick={() => setConfirmed(false)}>Continue to payment</button>
            <small>No charge until you confirm on the next step.</small>
          </div>
        </div>
      )}
    </>
  );
}
