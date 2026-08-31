'use client';

import { ClassOfferingStatus, type ClassOfferingDto } from '@learn-and-build/types';
import { DATE_TIME, SessionManager, useProviderSessions } from '../provider-sessions';

/** Class management wired in from the page so classes + their next session render together. */
export interface ProviderClassControls {
  classes: ClassOfferingDto[];
  onEdit: (item: ClassOfferingDto) => void;
  onChangeStatus: (id: string, status: ClassOfferingStatus) => void;
}

/**
 * Class studio list: each class with its single next upcoming session. Earnings
 * and finished sessions live on the /provider/earnings tab.
 */
export function ProviderOperations({ classControls }: { classControls: ProviderClassControls }) {
  const { classes, onEdit, onChangeStatus } = classControls;
  const state = useProviderSessions();
  const { firstUpcomingByClass, openRoster, message, error } = state;

  return (
    <section className="provider-operations" id="operations">
      <div className="provider-class-sessions">
        <div className="section-heading">
          <h3>Your classes &amp; next session</h3>
          <span>{classes.length}</span>
        </div>
        {classes.map((item) => {
          const next = firstUpcomingByClass.get(item.id);
          return (
            <article className="provider-class-block" key={item.id}>
              <div className="provider-class-copy">
                <strong>{item.activity}</strong>
                <small>
                  {item.category} · ages {item.ageMin}–{item.ageMax} · ₹{item.priceMinor / 100} ·{' '}
                  {item.timings.length} recurring slot{item.timings.length === 1 ? '' : 's'}
                </small>
                <div className="provider-statuses">
                  <span data-status={item.status}>{item.status}</span>
                  <span data-status={item.moderationStatus}>{item.moderationStatus}</span>
                </div>
                {item.moderationReason && (
                  <small className="moderation-reason">Moderator note: {item.moderationReason}</small>
                )}
                <div className="provider-class-actions">
                  <button type="button" onClick={() => onEdit(item)}>
                    Edit
                  </button>
                  {item.status === ClassOfferingStatus.ACTIVE ? (
                    <button
                      type="button"
                      onClick={() => onChangeStatus(item.id, ClassOfferingStatus.PAUSED)}
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onChangeStatus(item.id, ClassOfferingStatus.ACTIVE)}
                    >
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
                    <button type="button" onClick={() => void openRoster(next)}>
                      Manage session
                    </button>
                  </div>
                ) : (
                  <p className="section-hint">No upcoming sessions in the next 60 days.</p>
                )}
              </div>
            </article>
          );
        })}
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
