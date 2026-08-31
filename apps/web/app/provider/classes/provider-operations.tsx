'use client';

import { useState } from 'react';
import {
  ClassOfferingStatus,
  type ClassOfferingDto,
  type ProviderSessionDto,
} from '@learn-and-build/types';
import { DATE_TIME, SessionManager, useProviderSessions } from '../provider-sessions';

/** Class management wired in from the page so classes + their next session render together. */
export interface ProviderClassControls {
  classes: ClassOfferingDto[];
  onChangeStatus: (id: string, status: ClassOfferingStatus) => void;
  onSaveTimings: (id: string, timings: { weekday: number; startMinute: number }[]) => Promise<void>;
}

type TimingRow = { weekday: number; start: string };

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];
const WEEKDAY_LABEL = new Map(WEEKDAYS.map((d) => [d.value, d.label]));

function toStart(startMinute: number): string {
  return `${String(Math.floor(startMinute / 60)).padStart(2, '0')}:${String(startMinute % 60).padStart(2, '0')}`;
}
function toMinutes(start: string): number {
  const [h, m] = start.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Class studio list: each class with its single next upcoming session and an
 * inline editor for just the recurring weekly timings (schedule). Earnings and
 * finished sessions live on the /provider/earnings tab.
 */
export function ProviderOperations({ classControls }: { classControls: ProviderClassControls }) {
  const { classes, onChangeStatus, onSaveTimings } = classControls;
  const state = useProviderSessions();
  const { firstUpcomingByClass, openRoster, message, error } = state;

  return (
    <section className="provider-operations" id="operations">
      <div className="provider-class-sessions">
        <div className="section-heading">
          <h3>Your classes &amp; next session</h3>
          <span>{classes.length}</span>
        </div>
        {classes.map((item) => (
          <ClassCard
            key={item.id}
            item={item}
            next={firstUpcomingByClass.get(item.id)}
            onChangeStatus={onChangeStatus}
            onSaveTimings={onSaveTimings}
            onManageSession={openRoster}
          />
        ))}
        {!classes.length && (
          <p className="section-hint">Your submitted classes will appear here.</p>
        )}
      </div>

      <SessionManager state={state} />
      {message && <p className="form-success">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

function ClassCard({
  item,
  next,
  onChangeStatus,
  onSaveTimings,
  onManageSession,
}: {
  item: ClassOfferingDto;
  next: ProviderSessionDto | undefined;
  onChangeStatus: (id: string, status: ClassOfferingStatus) => void;
  onSaveTimings: (id: string, timings: { weekday: number; startMinute: number }[]) => Promise<void>;
  onManageSession: (session: ProviderSessionDto) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<TimingRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  function startEdit() {
    setRows(
      (item.timings ?? []).map((t) => ({ weekday: t.weekday, start: toStart(t.startMinute) })),
    );
    setRowError(null);
    setEditing(true);
  }

  function updateRow(index: number, patch: Partial<TimingRow>) {
    setRows((cur) => cur.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function save() {
    if (rows.length === 0) {
      setRowError('Add at least one weekly slot.');
      return;
    }
    setSaving(true);
    setRowError(null);
    try {
      await onSaveTimings(
        item.id,
        rows.map((r) => ({ weekday: r.weekday, startMinute: toMinutes(r.start) })),
      );
      setEditing(false);
    } catch (caught) {
      setRowError(caught instanceof Error ? caught.message : 'Could not update the schedule');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="provider-class-block">
      <div className="provider-class-copy">
        <strong>{item.activity}</strong>
        <small>
          {item.category} · ages {item.ageMin}–{item.ageMax} · ₹{item.priceMinor / 100} ·{' '}
          {item.timings.length} recurring slot{item.timings.length === 1 ? '' : 's'}
        </small>
        <div className="class-timing-summary">
          {(item.timings ?? []).map((t, i) => (
            <span key={`${t.weekday}-${t.startMinute}-${i}`}>
              {WEEKDAY_LABEL.get(t.weekday) ?? `Day ${t.weekday}`} {toStart(t.startMinute)}
            </span>
          ))}
        </div>
        <div className="provider-statuses">
          <span data-status={item.status}>{item.status}</span>
          <span data-status={item.moderationStatus}>{item.moderationStatus}</span>
        </div>
        {item.moderationReason && (
          <small className="moderation-reason">Moderator note: {item.moderationReason}</small>
        )}
        <div className="provider-class-actions">
          <button type="button" onClick={editing ? () => setEditing(false) : startEdit}>
            {editing ? 'Close' : 'Edit timings'}
          </button>
          {item.status === ClassOfferingStatus.ACTIVE ? (
            <button type="button" onClick={() => onChangeStatus(item.id, ClassOfferingStatus.PAUSED)}>
              Pause
            </button>
          ) : (
            <button type="button" onClick={() => onChangeStatus(item.id, ClassOfferingStatus.ACTIVE)}>
              Resume
            </button>
          )}
          {item.status !== ClassOfferingStatus.UNPUBLISHED && (
            <button
              className="danger"
              type="button"
              onClick={() => onChangeStatus(item.id, ClassOfferingStatus.UNPUBLISHED)}
            >
              Unpublish
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="class-timings-editor">
          <p className="section-hint">
            Edit the recurring weekly schedule. Saving resubmits the class for moderation.
          </p>
          {rows.map((row, index) => (
            <div className="schedule-row" key={index}>
              <select
                aria-label="Day"
                value={row.weekday}
                onChange={(e) => updateRow(index, { weekday: Number(e.target.value) })}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Start time"
                type="time"
                value={row.start}
                onChange={(e) => updateRow(index, { start: e.target.value })}
              />
              <span className="schedule-repeat">Every week</span>
              <button
                type="button"
                className="remove-row"
                aria-label="Remove slot"
                onClick={() => setRows((cur) => cur.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="add-row"
            onClick={() => setRows((cur) => [...cur, { weekday: 6, start: '10:00' }])}
          >
            + Add another slot
          </button>
          {rowError && <p className="form-error">{rowError}</p>}
          <div className="class-timings-actions">
            <button type="button" className="primary-wide" disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save schedule'}
            </button>
            <button type="button" className="secondary-wide" disabled={saving} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="provider-class-session-rows">
        {next ? (
          <div className="provider-session-row">
            <div>
              <small className="next-session-label">Next session</small>
              <span>{DATE_TIME.format(new Date(next.start))}</span>
              <small>
                {next.bookedSeats}/{next.seatsTotal} booked · {next.status}
              </small>
            </div>
            <button type="button" onClick={() => onManageSession(next)}>
              Manage session
            </button>
          </div>
        ) : (
          <p className="section-hint">No upcoming sessions in the next 60 days.</p>
        )}
      </div>
    </article>
  );
}
