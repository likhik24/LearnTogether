'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AttendanceStatus,
  BookingStatus,
  OccurrenceStatus,
  type ProviderEarningsDto,
  type ProviderPayoutProfileDto,
  type ProviderPayoutDto,
  type ProviderRosterEntryDto,
  type ProviderSessionDto,
  type BookingRescheduleRequestDto,
  RescheduleRequestStatus,
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
  const [payoutProfile, setPayoutProfile] = useState<ProviderPayoutProfileDto | null>(null);
  const [rescheduleRequests, setRescheduleRequests] = useState<BookingRescheduleRequestDto[]>([]);
  const [selected, setSelected] = useState<ProviderSessionDto | null>(null);
  const [roster, setRoster] = useState<ProviderRosterEntryDto[]>([]);
  const [newStart, setNewStart] = useState('');
  const [reason, setReason] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [familyMessage, setFamilyMessage] = useState('');
  const [calendarView, setCalendarView] = useState(false);
  const [payoutName, setPayoutName] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'bank' | 'upi'>('bank');
  const [bankName, setBankName] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [upiMasked, setUpiMasked] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [loadedSessions, loadedEarnings, loadedPayouts, loadedProfile, loadedRequests] =
        await Promise.all([
          createAuthClient().listProviderSessions(60),
          createPaymentsClient().providerEarnings(),
          createPaymentsClient().listProviderPayouts(),
          createPaymentsClient().getProviderPayoutProfile(),
          createAuthClient().listProviderRescheduleRequests(),
        ]);
      setSessions(loadedSessions);
      setEarnings(loadedEarnings);
      setPayouts(loadedPayouts);
      setPayoutProfile(loadedProfile);
      setRescheduleRequests(loadedRequests);
      if (loadedProfile) {
        setPayoutName(loadedProfile.accountHolderName);
        setPayoutMethod(loadedProfile.payoutMethod);
        setBankName(loadedProfile.bankName ?? '');
        setIfsc(loadedProfile.ifsc ?? '');
        setAccountLast4(loadedProfile.accountLast4 ?? '');
        setUpiMasked(loadedProfile.upiIdMasked ?? '');
      }
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
      setMessage(
        cancel
          ? 'Session cancelled and families notified.'
          : 'Session rescheduled and families notified.',
      );
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

  async function savePayoutProfile() {
    setBusy(true);
    setError(null);
    try {
      const profile = await createPaymentsClient().saveProviderPayoutProfile({
        accountHolderName: payoutName,
        payoutMethod,
        bankName,
        ifsc,
        accountLast4,
        upiIdMasked: upiMasked,
      });
      setPayoutProfile(profile);
      setMessage(
        'Payout details submitted for verification. Only masked account details are stored here.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save payout details');
    } finally {
      setBusy(false);
    }
  }

  async function decideRequest(
    id: string,
    status: RescheduleRequestStatus.APPROVED | RescheduleRequestStatus.DECLINED,
  ) {
    setBusy(true);
    setError(null);
    try {
      const updated = await createAuthClient().decideProviderReschedule(id, status);
      setRescheduleRequests((items) => items.map((item) => (item.id === id ? updated : item)));
      setMessage(`Reschedule ${status}; the family was notified.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not decide request');
    } finally {
      setBusy(false);
    }
  }

  async function bulkAttendance(status: AttendanceStatus) {
    const ids = roster
      .filter((entry) => entry.bookingStatus === BookingStatus.CONFIRMED)
      .map((entry) => entry.bookingId);
    if (!ids.length) return;
    setBusy(true);
    setError(null);
    try {
      setRoster(await createAuthClient().bulkProviderAttendance(ids, status));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update attendance');
    } finally {
      setBusy(false);
    }
  }

  async function sendFamilyMessage() {
    if (!selected || !familyMessage.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createAuthClient().messageProviderSession(
        selected.classId,
        selected.start,
        familyMessage,
      );
      setFamilyMessage('');
      setMessage(
        `Message sent to ${result.recipients} ${result.recipients === 1 ? 'family' : 'families'}.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not message families');
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

      <div className="provider-report-actions">
        <button type="button" onClick={() => downloadCsv('earnings', earningsCsv(earnings))}>
          Download earnings CSV
        </button>
        <button type="button" onClick={() => setCalendarView((value) => !value)}>
          {calendarView ? 'Show session list' : 'Show calendar view'}
        </button>
      </div>

      <section className="provider-payout-profile">
        <div>
          <h3>Payout profile</h3>
          <span
            className={`status-pill ${payoutProfile?.kycStatus === 'verified' ? '' : 'pending'}`}
          >
            {payoutProfile?.kycStatus ?? 'NOT STARTED'}
          </span>
        </div>
        <div className="payout-profile-grid">
          <label>
            Account holder
            <input value={payoutName} onChange={(event) => setPayoutName(event.target.value)} />
          </label>
          <label>
            Method
            <select
              value={payoutMethod}
              onChange={(event) => setPayoutMethod(event.target.value as 'bank' | 'upi')}
            >
              <option value="bank">Bank</option>
              <option value="upi">UPI</option>
            </select>
          </label>
          {payoutMethod === 'bank' ? (
            <>
              <label>
                Bank name
                <input value={bankName} onChange={(event) => setBankName(event.target.value)} />
              </label>
              <label>
                IFSC
                <input
                  value={ifsc}
                  onChange={(event) => setIfsc(event.target.value.toUpperCase())}
                />
              </label>
              <label>
                Account last 4 digits
                <input
                  inputMode="numeric"
                  maxLength={4}
                  value={accountLast4}
                  onChange={(event) => setAccountLast4(event.target.value.replace(/\D/g, ''))}
                />
              </label>
            </>
          ) : (
            <label>
              Masked UPI ID
              <input
                value={upiMasked}
                onChange={(event) => setUpiMasked(event.target.value)}
                placeholder="pr***@bank"
              />
            </label>
          )}
          <button
            type="button"
            disabled={busy || !payoutName}
            onClick={() => void savePayoutProfile()}
          >
            Save for verification
          </button>
        </div>
        <small>
          For safety, this app stores only masked details and the last four digits. Operations links
          the verified payout account.
        </small>
      </section>

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

      {rescheduleRequests.some((item) => item.status === RescheduleRequestStatus.REQUESTED) && (
        <section className="provider-reschedule-queue">
          <h3>Family reschedule requests</h3>
          {rescheduleRequests
            .filter((item) => item.status === RescheduleRequestStatus.REQUESTED)
            .map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.childName ?? 'Learner'}</strong>
                  <span>
                    {DATE_TIME.format(new Date(item.currentStart))} →{' '}
                    {DATE_TIME.format(new Date(item.requestedStart))}
                  </span>
                  {item.reason && <small>{item.reason}</small>}
                </div>
                <div className="attendance-actions">
                  <button
                    disabled={busy}
                    onClick={() => void decideRequest(item.id, RescheduleRequestStatus.APPROVED)}
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void decideRequest(item.id, RescheduleRequestStatus.DECLINED)}
                  >
                    Decline
                  </button>
                </div>
              </article>
            ))}
        </section>
      )}

      <div className={`provider-session-list ${calendarView ? 'provider-calendar' : ''}`}>
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
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close session manager"
            >
              ×
            </button>
          </header>
          <div className="provider-roster">
            {roster.length > 0 && (
              <div className="provider-report-actions">
                <button type="button" onClick={() => downloadCsv('roster', rosterCsv(roster))}>
                  Download roster CSV
                </button>
                {new Date(selected.start) <= new Date() && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void bulkAttendance(AttendanceStatus.PRESENT)}
                    >
                      Mark all present
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void bulkAttendance(AttendanceStatus.ABSENT)}
                    >
                      Mark all absent
                    </button>
                  </>
                )}
              </div>
            )}
            {roster.map((entry) => (
              <article key={entry.bookingId}>
                <div>
                  <strong>{entry.childName ?? 'Learner'}</strong>
                  <span>
                    {entry.parentName} · {entry.parentEmail}
                  </span>
                  <small>
                    {entry.bookingStatus} · {entry.paymentStatus ?? 'payment unavailable'}
                  </small>
                </div>
                {new Date(entry.scheduledStart) <= new Date() &&
                  entry.bookingStatus === BookingStatus.CONFIRMED && (
                    <div className="attendance-actions">
                      <button
                        type="button"
                        className={
                          entry.attendanceStatus === AttendanceStatus.PRESENT ? 'active' : ''
                        }
                        disabled={busy}
                        onClick={() => void markAttendance(entry, AttendanceStatus.PRESENT)}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        className={
                          entry.attendanceStatus === AttendanceStatus.ABSENT ? 'active' : ''
                        }
                        disabled={busy}
                        onClick={() => void markAttendance(entry, AttendanceStatus.ABSENT)}
                      >
                        Absent
                      </button>
                    </div>
                  )}
              </article>
            ))}
            {!roster.length && (
              <p className="section-hint">No families are booked into this session.</p>
            )}
          </div>
          {roster.length > 0 && (
            <div className="session-message-form">
              <label>
                Message every booked family
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={familyMessage}
                  onChange={(event) => setFamilyMessage(event.target.value)}
                  placeholder="Parking, materials, arrival instructions…"
                />
              </label>
              <button
                type="button"
                disabled={busy || !familyMessage.trim()}
                onClick={() => void sendFamilyMessage()}
              >
                Send update
              </button>
            </div>
          )}
          {selected.status !== OccurrenceStatus.CANCELLED &&
            new Date(selected.start) > new Date() && (
              <div className="session-change-form">
                <label>
                  Replacement date and time
                  <input
                    type="datetime-local"
                    value={newStart}
                    onChange={(event) => setNewStart(event.target.value)}
                  />
                </label>
                <label>
                  Message to families
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Reason or useful details"
                  />
                </label>
                <button type="button" disabled={busy} onClick={() => void changeSession(false)}>
                  Reschedule session
                </button>
                {!confirmingCancel ? (
                  <button
                    className="danger"
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmingCancel(true)}
                  >
                    Cancel this session
                  </button>
                ) : (
                  <div className="cancel-session-confirm">
                    <span>Refund paid bookings and notify every family?</span>
                    <button
                      className="danger"
                      type="button"
                      disabled={busy}
                      onClick={() => void changeSession(true)}
                    >
                      Confirm cancellation
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmingCancel(false)}
                    >
                      Keep session
                    </button>
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

function downloadCsv(name: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csv(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
function rosterCsv(items: ProviderRosterEntryDto[]): string {
  return [
    ['Child', 'Parent', 'Email', 'Start', 'Booking', 'Payment', 'Attendance'],
    ...items.map((item) => [
      item.childName,
      item.parentName,
      item.parentEmail,
      item.scheduledStart,
      item.bookingStatus,
      item.paymentStatus,
      item.attendanceStatus,
    ]),
  ]
    .map((row) => row.map(csv).join(','))
    .join('\n');
}
function earningsCsv(item: ProviderEarningsDto | null): string {
  return [
    ['Class', 'Bookings', 'Gross INR', 'Refunded INR', 'Captured INR'],
    ...(item?.classes ?? []).map((value) => [
      value.classTitle,
      value.bookings,
      value.grossMinor / 100,
      value.refundedMinor / 100,
      value.netMinor / 100,
    ]),
  ]
    .map((row) => row.map(csv).join(','))
    .join('\n');
}
