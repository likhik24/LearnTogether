'use client';

import Link from 'next/link';

export type CustomerAccessReason = 'book' | 'save' | 'child-required';

const copy = {
  book: {
    eyebrow: 'SIGN IN TO BOOK',
    title: 'Keep this reservation with your account.',
    body: 'Bookings need a signed-in parent so we can protect the seat, show it in your plans, and let you cancel it later.',
    action: 'Sign in or create account',
    destination: 'profile',
  },
  save: {
    eyebrow: 'SIGN IN TO SAVE',
    title: 'Keep your favourites in one place.',
    body: 'Sign in to save classes securely and see them on every device.',
    action: 'Sign in or create account',
    destination: 'profile',
  },
  'child-required': {
    eyebrow: 'ONE QUICK STEP',
    title: 'Add your child before booking.',
    body: 'A child profile helps us keep bookings relevant to the right age and interests.',
    action: 'Add child profile',
    destination: 'children',
  },
} as const;

export function CustomerAccessDialog({
  reason,
  returnTo,
  onClose,
}: {
  reason: CustomerAccessReason;
  returnTo: string;
  onClose: () => void;
}) {
  const content = copy[reason];
  const href = `/${content.destination}?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className="app-overlay" role="dialog" aria-modal="true" aria-label={content.eyebrow}>
      <button className="overlay-backdrop" aria-label="Close sign-in prompt" onClick={onClose} />
      <section className="app-sheet customer-access-sheet">
        <div className="sheet-heading">
          <div>
            <span className="eyebrow purple">{content.eyebrow}</span>
            <h2>{content.title}</h2>
          </div>
          <button aria-label="Close" onClick={onClose}>×</button>
        </div>
        <p>{content.body}</p>
        <Link className="primary-wide link-button" href={href}>{content.action}</Link>
        <button className="secondary-wide" type="button" onClick={onClose}>Not now</button>
      </section>
    </div>
  );
}
