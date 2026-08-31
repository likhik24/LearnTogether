'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AttendanceStatus,
  BookingStatus,
  OccurrenceStatus,
  type ProviderRosterEntryDto,
  type ProviderSessionDto,
} from '@learn-and-build/types';
import { createAuthClient } from '../../lib/api';

export const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Shared provider-session state: loads the next 60 days of sessions, and owns
 * the roster / reschedule / cancel / attendance actions used by both the class
 * studio (upcoming) and the earnings tab (finished sessions).
 */
export function useProviderSessions() {
  const [sessions, setSessions] = useState<ProviderSessionDto[]>([]);
  const [selected, setSelected] = useState<ProviderSessionDto | null>(null);
  const [roster, setRoster] = useState<ProviderRosterEntryDto[]>([]);
  const [newStart, setNewStart] = useState('');
  const [reason, setReason] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setError(null);
    try {
      setSessions(await createAuthClient().listProviderSessions(60));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your sessions');
    }
  }, []);

  useEffect(() => void loadSessions(), [loadSessions]);

  const upcoming = useMemo(
    () =>
      sessions
        .filter(
          (item) =>
            new Date(item.start) >= new Date() && item.status !== OccurrenceStatus.CANCELLED,
        )
        .sort((a, b) => a.start.localeCompare(b.start)),
    [sessions],
  );

  const recent = useMemo(
    () =>
      sessions
        .filter((item) => new Date(item.start) < new Date())
        .sort((a, b) => b.start.localeCompare(a.start))
        .slice(0, 12),
    [sessions],
  );

  /** First upcoming session per class (classId -> session). */
  const firstUpcomingByClass = useMemo(() => {
    const map = new Map<string, ProviderSessionDto>();
    for (const s of upcoming) if (!map.has(s.classId)) map.set(s.classId, s);
    return map;
  }, [upcoming]);

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

  function closeRoster() {
    setSelected(null);
    setRoster([]);
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
      await loadSessions();
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

  return {
    sessions,
    upcoming,
    recent,
    firstUpcomingByClass,
    selected,
    roster,
    newStart,
    setNewStart,
    reason,
    setReason,
    confirmingCancel,
    setConfirmingCancel,
    busy,
    error,
    message,
    loadSessions,
    openRoster,
    closeRoster,
    changeSession,
    markAttendance,
  };
}

export type ProviderSessionsState = ReturnType<typeof useProviderSessions>;

/** The roster + reschedule/cancel modal, driven by the shared session state. */
export function SessionManager({ state }: { state: ProviderSessionsState }) {
  const {
    selected,
    roster,
    newStart,
    setNewStart,
    reason,
    setReason,
    confirmingCancel,
    setConfirmingCancel,
    busy,
    closeRoster,
    changeSession,
    markAttendance,
  } = state;

  if (!selected) return null;

  return (
    <div className="provider-session-manager">
      <header>
        <div>
          <strong>{selected.classTitle}</strong>
          <span>{DATE_TIME.format(new Date(selected.start))}</span>
        </div>
        <button type="button" onClick={closeRoster} aria-label="Close session manager">
          ×
        </button>
      </header>
      <div className="provider-roster">
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
        {!roster.length && (
          <p className="section-hint">No families are booked into this session.</p>
        )}
      </div>
      {selected.status !== OccurrenceStatus.CANCELLED && new Date(selected.start) > new Date() && (
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
              <button type="button" disabled={busy} onClick={() => setConfirmingCancel(false)}>
                Keep session
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
