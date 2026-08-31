'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AttendanceStatus,
  BookingStatus,
  OccurrenceStatus,
  type ProviderEarningsDto,
  type ProviderPayoutDto,
  type ProviderRosterEntryDto,
  type ProviderSessionDto,
} from '@learn-and-build/types';
import { createAuthClient, createPaymentsClient } from '../../lib/api';

const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export function ProviderOperations() {
  const [sessions, setSessions] = useState<ProviderSessionDto[]>([]);
  const [earnings, setEarnings] = useState<ProviderEarningsDto | null>(null);
  const [payouts, setPayouts] = useState<ProviderPayoutDto[]>([]);
  const [selected, setSelected] = useState<ProviderSessionDto | null>(null);
  const [roster, setRoster] = useState<ProviderRosterEntryDto[]>([]);
  const [newStart, setNewStart] = useState('');
  const [reason, setReason] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [loadedSessions, loadedEarnings, loadedPayouts] = await Promise.all([
        createAuthClient().listProviderSessions(60),
        createPaymentsClient().providerEarnings(),
        createPaymentsClient().listProviderPayouts(),
      ]);
      setSessions(loadedSessions);
      setEarnings(loadedEarnings);
      setPayouts(loadedPayouts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load provider operations');
    }
  }, []);

  useEffect(() => void load(), [load]);

  const upcoming = useMemo(
    () =>
      sessions
        .filter(
          (item) =>
            new Date(item.start) >= new Date() && item.status !== OccurrenceStatus.CANCELLED,
        )
        .slice(0, 12),
    [sessions],
  );
  const recent = useMemo(
    () =>
      sessions
        .filter((item) => new Date(item.start) < new Date())
        .sort((a, b) => b.start.localeCompare(a.start))
        .slice(0, 8),
    [sessions],
  );

  async function openRoster(session: ProviderSessionDto) {
    setSelected(session);
    setRoster([]);
    setNewStart('');
    setReason('');
    setConfirmingCancel(false);
    setError(null);
    try {
      setRoster(await createAuthClient().providerRoster(session.classId, session.start));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the roster');
    }
  }

  async function changeSession(cancel: boolean) {
    if (!selected) return;
    if (!cancel && !newStart) {
      setError('Choose a replacement date and time.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await createAuthClient().changeProviderOccurrence(selected.classId, {
        originalStart: selected.originalStart,
        newStart: cancel ? undefined : new Date(newStart).toISOString(),
        reason,
      });
      setMessage(cancel ? 'Session cancelled and families notified.' : 'Session rescheduled and families notified.');
      setSelected(null);
      setRoster([]);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this session');
    } finally {
      setBusy(false);
      setConfirmingCancel(false);
    }
  }

  async function markAttendance(entry: ProviderRosterEntryDto, status: AttendanceStatus) {
    setBusy(true);
    setError(null);
    try {
      const updated = await createAuthClient().markProviderAttendance(entry.bookingId, status);
      setRoster((items) =>
        items.map((item) => (item.bookingId === updated.bookingId ? updated : item)),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not mark attendance');
    } finally {
      setBusy(false);
    }
  }

  async function requestPayout() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await createPaymentsClient().requestProviderPayout();
      setMessage('Payout requested. Operations will record the transfer reference here.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not request payout');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="provider-operations" id="operations">
      <div className="section-heading">
        <div>
          <span className="eyebrow purple">OPERATIONS</span>
          <h2>Sessions, families & earnings</h2>
        </div>
      </div>

      <div className="provider-metrics" id="earnings">
        <article>
          <small>Available payout</small>
          <strong>₹{((earnings?.availableMinor ?? 0) / 100).toLocaleString('en-IN')}</strong>
        </article>
        <article>
          <small>Net earnings</small>
          <strong>₹{((earnings?.netMinor ?? 0) / 100).toLocaleString('en-IN')}</strong>
        </article>
        <article>
          <small>Upcoming sessions</small>
          <strong>{upcoming.length}</strong>
        </article>
      </div>

      {earnings && (
        <div className="provider-earnings-copy">
          <span>
            Gross ₹{(earnings.grossMinor / 100).toLocaleString('en-IN')} · refunds ₹
            {(earnings.refundedMinor / 100).toLocaleString('en-IN')} · platform fee{' '}
            {earnings.platformFeeBps / 100}%
          </span>
          <button
            type="button"
            disabled={busy || earnings.availableMinor < 10000}
            onClick={() => void requestPayout()}
          >
            Request payout
          </button>
        </div>
      )}

      {payouts.length > 0 && (
        <div className="provider-payout-list" aria-label="Payout history">
          {payouts.map((payout) => (
            <span key={payout.id}>
              ₹{(payout.amountMinor / 100).toLocaleString('en-IN')} · {payout.status}
              {payout.reference ? ` · ${payout.reference}` : ''}
            </span>
          ))}
        </div>
      )}

      <div className="provider-session-list">
        <h3>Upcoming sessions</h3>
        {upcoming.map((session) => (
          <article key={`${session.classId}-${session.originalStart}`}>
            <div>
              <strong>{session.classTitle}</strong>
              <span>{DATE_TIME.format(new Date(session.start))}</span>
              <small>
                {session.bookedSeats}/{session.seatsTotal} booked · {session.status}
              </small>
            </div>
            <button type="button" onClick={() => void openRoster(session)}>
              Manage session
            </button>
          </article>
        ))}
        {!upcoming.length && <p className="section-hint">No upcoming class sessions yet.</p>}
        {recent.length > 0 && <h3>Recent sessions & attendance</h3>}
        {recent.map((session) => (
          <article key={`recent-${session.classId}-${session.originalStart}`}>
            <div>
              <strong>{session.classTitle}</strong>
              <span>{DATE_TIME.format(new Date(session.start))}</span>
              <small>
                {session.bookedSeats}/{session.seatsTotal} booked · {session.status}
              </small>
            </div>
            <button type="button" onClick={() => void openRoster(session)}>
              Open roster
            </button>
          </article>
        ))}
      </div>

      {selected && (
        <div className="provider-session-manager">
          <header>
            <div>
              <strong>{selected.classTitle}</strong>
              <span>{DATE_TIME.format(new Date(selected.start))}</span>
            </div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close session manager">
              ×
            </button>
          </header>
          <div className="provider-roster">
            {roster.map((entry) => (
              <article key={entry.bookingId}>
                <div>
                  <strong>{entry.childName ?? 'Learner'}</strong>
                  <span>{entry.parentName} · {entry.parentEmail}</span>
                  <small>{entry.bookingStatus} · {entry.paymentStatus ?? 'payment unavailable'}</small>
                </div>
                {new Date(entry.scheduledStart) <= new Date() && entry.bookingStatus === BookingStatus.CONFIRMED && (
                  <div className="attendance-actions">
                    <button
                      type="button"
                      className={entry.attendanceStatus === AttendanceStatus.PRESENT ? 'active' : ''}
                      disabled={busy}
                      onClick={() => void markAttendance(entry, AttendanceStatus.PRESENT)}
                    >
                      Present
                    </button>
                    <button
                      type="button"
                      className={entry.attendanceStatus === AttendanceStatus.ABSENT ? 'active' : ''}
                      disabled={busy}
                      onClick={() => void markAttendance(entry, AttendanceStatus.ABSENT)}
                    >
                      Absent
                    </button>
                  </div>
                )}
              </article>
            ))}
            {!roster.length && <p className="section-hint">No families are booked into this session.</p>}
          </div>
          {selected.status !== OccurrenceStatus.CANCELLED && new Date(selected.start) > new Date() && (
            <div className="session-change-form">
              <label>
                Replacement date and time
                <input type="datetime-local" value={newStart} onChange={(event) => setNewStart(event.target.value)} />
              </label>
              <label>
                Message to families
                <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason or useful details" />
              </label>
              <button type="button" disabled={busy} onClick={() => void changeSession(false)}>
                Reschedule session
              </button>
              {!confirmingCancel ? (
                <button className="danger" type="button" disabled={busy} onClick={() => setConfirmingCancel(true)}>
                  Cancel this session
                </button>
              ) : (
                <div className="cancel-session-confirm">
                  <span>Refund paid bookings and notify every family?</span>
                  <button className="danger" type="button" disabled={busy} onClick={() => void changeSession(true)}>
                    Confirm cancellation
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirmingCancel(false)}>Keep session</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {message && <p className="form-success">{message}</p>}
      {error && <p className="form-error">{error}</p>}
      <p className="section-hint">
        Payout requests are settled by operations and receive a transfer reference when marked paid.
      </p>
    </section>
  );
}
