'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError } from '@learn-and-build/api-client';
import { getCustomerClient, hydrateCustomerSession } from '../lib/customer-session';
import { createSchedulingClient } from '../lib/api';
import { Icon } from './ui';
import { ChildName } from './child-name';
import type { ClassCardData } from './data';
import { RealDiscoveryMap } from './discover/real-discovery-map';
import { CustomerAccessDialog, type CustomerAccessReason } from './customer-access-dialog';

export function ClassLocationMap({ item }: { item: ClassCardData }) {
  const [selected, setSelected] = useState(item.slug);
  return (
    <div className="mini-map live-mini-map">
      <RealDiscoveryMap items={[item]} selectedSlug={selected} onSelect={setSelected} recenterKey={0} />
      <div className="mini-map-caption"><strong>{item.distance} away</strong><small>{item.venueName ?? 'Hitech City'} • interactive map</small></div>
    </div>
  );
}

export function DetailTopActions({ slug, title }: { slug: string; title: string }) {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  const [accessReason, setAccessReason] = useState<CustomerAccessReason | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void hydrateCustomerSession().then(async (user) => {
      if (!active || !user) return;
      try {
        const items = await getCustomerClient()?.listSavedClasses();
        if (active) setSaved(items?.some((item) => item.classRef === slug) ?? false);
      } catch {
        if (active) setActionError('We could not load your saved classes. Please try again.');
      }
    });
    return () => { active = false; };
  }, [slug]);

  async function toggleSaved() {
    if (savePending) return;
    setActionError(null);
    const user = await hydrateCustomerSession();
    if (!user) {
      setAccessReason('save');
      return;
    }
    const client = getCustomerClient();
    if (!client) {
      setAccessReason('save');
      return;
    }
    const nextValue = !saved;
    setSavePending(true);
    try {
      if (nextValue) await client.saveClass(slug, title);
      else await client.removeSavedClass(slug);
      setSaved(nextValue);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) setAccessReason('save');
      else setActionError('That change was not saved. Please try again.');
    } finally {
      setSavePending(false);
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
      <button className={`round-action ${saved ? 'saved' : ''}`} aria-label={saved ? 'Remove saved class' : 'Save class'} aria-pressed={saved} disabled={savePending} onClick={() => void toggleSaved()}>
        <Icon name="heart" />
      </button>
      {actionError && <span className="action-toast" role="status">{actionError}</span>}
      {accessReason && <CustomerAccessDialog reason={accessReason} returnTo={`/classes/${slug}`} onClose={() => setAccessReason(null)} />}
    </>
  );
}

export function BookingBar({ classRef, title, price }: { classRef: string; title: string; price: number; spots: number }) {
  const [step, setStep] = useState<'idle' | 'held' | 'booked'>('idle');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingPending, setBookingPending] = useState(false);
  const [accessPending, setAccessPending] = useState(false);
  const [accessReason, setAccessReason] = useState<CustomerAccessReason | null>(null);
  const [inventory, setInventory] = useState<{ classId: string; occurrenceStart: string; spots: number } | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const scheduling = createSchedulingClient();
    void scheduling.getClassBySlug(classRef)
      .then(async (offering) => ({ offering, occurrences: await scheduling.classAvailability(offering.id, 21) }))
      .then(({ offering, occurrences }) => {
        if (cancelled) return;
        const occurrence = occurrences.find((item) => item.seatsAvailable > 0);
        if (occurrence) setInventory({ classId: offering.id, occurrenceStart: occurrence.start, spots: occurrence.seatsAvailable });
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setInventoryLoading(false); });
    return () => { cancelled = true; };
  }, [classRef]);

  async function startBooking() {
    if (accessPending || inventoryLoading || !inventory) return;
    setAccessPending(true);
    setBookingError(null);
    try {
      const user = await hydrateCustomerSession();
      if (!user) {
        setAccessReason('book');
        return;
      }
      const client = getCustomerClient();
      if (!client) {
        setAccessReason('book');
        return;
      }
      const children = await client.listChildren();
      if (children.length === 0) {
        setAccessReason('child-required');
        return;
      }
      setStep('held');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) setAccessReason('book');
      else setBookingError('We could not verify your family profile. Please try again.');
    } finally {
      setAccessPending(false);
    }
  }

  async function confirmBooking() {
    if (bookingPending) return;
    setBookingPending(true);
    setBookingError(null);
    const user = await hydrateCustomerSession();
    const customerClient = user ? getCustomerClient() : null;
    if (!customerClient) {
      setStep('idle');
      setAccessReason('book');
      setBookingPending(false);
      return;
    }
    if (!inventory) {
      setBookingError('Live availability could not be confirmed. Please try again when Scheduling is online.');
      setBookingPending(false);
      return;
    }
    try {
      await customerClient.createBooking({
        classRef: inventory.classId,
        classSlug: classRef,
        title,
        scheduledStart: inventory.occurrenceStart,
        amountMinor: price * 100,
        currency: 'INR',
      });
      setStep('booked');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setStep('idle');
        setAccessReason('book');
      } else if (caught instanceof ApiError && caught.status === 400 && caught.message.toLowerCase().includes('child')) {
        setStep('idle');
        setAccessReason('child-required');
      } else {
        setBookingError(caught instanceof Error && caught.message.includes('sold out')
          ? 'That class has just sold out. Please choose another time.'
          : 'We could not reserve a seat. Nothing was booked—please try again.');
      }
    } finally {
      setBookingPending(false);
    }
  }

  const scheduleLabel = inventory
    ? new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(inventory.occurrenceStart))
    : 'Next Saturday • 10:30 AM';

  return (
    <>
      <aside className="booking-bar">
        <div><span><strong>₹{price}</strong> trial class</span><small>{inventoryLoading ? 'Checking live availability…' : inventory ? <><b>{inventory.spots} spots</b> left for the next class</> : 'Live booking is temporarily unavailable'}</small>{bookingError && step === 'idle' && <small className="booking-error">{bookingError}</small>}</div>
        <button type="button" disabled={inventoryLoading || !inventory || accessPending} onClick={() => void startBooking()}>{accessPending ? 'Checking…' : inventoryLoading ? 'Checking…' : inventory ? <>Book trial <span>→</span></> : 'Unavailable'}</button>
      </aside>
      {accessReason && <CustomerAccessDialog reason={accessReason} returnTo={`/classes/${classRef}`} onClose={() => setAccessReason(null)} />}
      {step !== 'idle' && (
        <div className="booking-overlay" role="dialog" aria-modal="true" aria-label={step === 'booked' ? 'Booking confirmed' : 'Confirm trial booking'}>
          <button className="overlay-backdrop" aria-label="Close booking confirmation" onClick={() => setStep('idle')} />
          <div className="booking-sheet">
            <button className="sheet-close" aria-label="Close" onClick={() => setStep('idle')}>×</button>
            <span className="success-mark"><Icon name="check" size={27} /></span>
            {step === 'held' ? (
              <>
                <span className="eyebrow purple">READY TO RESERVE</span>
                <h2><ChildName possessive /> Saturday<br />just got more exciting.</h2>
                <p>{title}<br />{scheduleLabel}</p>
                <button className="primary-wide" disabled={bookingPending} onClick={() => void confirmBooking()}>{bookingPending ? 'Reserving…' : 'Reserve this spot'}</button>
                {bookingError && <small className="booking-error">{bookingError}</small>}
                <small>₹{price} is payable at the venue. Nothing is charged online.</small>
              </>
            ) : (
              <>
                <span className="eyebrow purple">BOOKING CONFIRMED</span>
                <h2>You’re all set.</h2>
                <p>We’ve added the workshop to your bookings.<br />{scheduleLabel}</p>
                <Link className="primary-wide link-button" href="/bookings">View my bookings</Link>
                <small>{bookingError ?? 'Synced to your LearnTogether account.'}</small>
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
