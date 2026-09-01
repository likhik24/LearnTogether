'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Role, type ProviderEarningsDto, type ProviderPayoutDto, type PublicUser } from '@learn-and-build/types';
import { createPaymentsClient } from '../../../lib/api';
import { hydrateCustomerSession } from '../../../lib/customer-session';
import { AppHeader, ProviderNav } from '../../ui';
import { DATE_TIME, SessionManager, useProviderSessions } from '../provider-sessions';

export default function ProviderEarningsPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [notProvider, setNotProvider] = useState(false);
  const [ready, setReady] = useState(false);

  const [earnings, setEarnings] = useState<ProviderEarningsDto | null>(null);
  const [payouts, setPayouts] = useState<ProviderPayoutDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sessions = useProviderSessions();
  const { recent, openRoster } = sessions;

  const loadEarnings = useCallback(async () => {
    setError(null);
    try {
      const [loadedEarnings, loadedPayouts] = await Promise.all([
        createPaymentsClient().providerEarnings(),
        createPaymentsClient().listProviderPayouts(),
      ]);
      setEarnings(loadedEarnings);
      setPayouts(loadedPayouts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load earnings');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void hydrateCustomerSession().then((existing) => {
      if (!active) return;
      if (existing && existing.role !== Role.TEACHER) {
        setNotProvider(true);
      } else {
        setUser(existing);
        if (existing) void loadEarnings();
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [loadEarnings]);

  async function requestPayout() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await createPaymentsClient().requestProviderPayout();
      setMessage('Payout requested. Operations will record the transfer reference here.');
      await loadEarnings();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not request payout');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-canvas">
      <div className="phone-shell teacher-page">
        <AppHeader />
        <span className="eyebrow coral">PROVIDER STUDIO</span>
        <h1>Earnings &amp; finished sessions.</h1>
        <p className="teacher-lede">
          Track your payouts and review attendance for sessions that have already run.
        </p>

        {!ready ? (
          <p className="section-hint" role="status">
            Loading your earnings…
          </p>
        ) : notProvider || !user ? (
          <section className="provider-gate">
            <span className="eyebrow purple">PROVIDER ACCOUNT REQUIRED</span>
            <h2>Sign in as a provider.</h2>
            <p>Open your provider profile to sign in, then return to view earnings.</p>
            <Link className="primary-wide" href="/provider">
              Go to provider profile
            </Link>
          </section>
        ) : (
          <>
            <nav className="provider-subnav" aria-label="Provider studio tabs">
              <Link href="/provider/classes">Classes</Link>
              <Link className="active" href="/provider/earnings">
                Earnings
              </Link>
            </nav>

            <section className="provider-operations" id="earnings">
              <div className="provider-metrics">
                <article>
                  <small>Available payout</small>
                  <strong>₹{((earnings?.availableMinor ?? 0) / 100).toLocaleString('en-IN')}</strong>
                </article>
                <article>
                  <small>Net earnings</small>
                  <strong>₹{((earnings?.netMinor ?? 0) / 100).toLocaleString('en-IN')}</strong>
                </article>
                <article>
                  <small>Finished sessions</small>
                  <strong>{recent.length}</strong>
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

              <div className="provider-class-sessions">
                <div className="section-heading">
                  <h3>Finished sessions &amp; attendance</h3>
                  <span>{recent.length}</span>
                </div>
                {recent.map((session) => (
                  <article
                    className="provider-session-row"
                    key={`recent-${session.classId}-${session.originalStart}`}
                  >
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
                {!recent.length && (
                  <p className="section-hint">Finished sessions will appear here after they run.</p>
                )}
              </div>

              <SessionManager state={sessions} />
              {message && <p className="form-success">{message}</p>}
              {error && <p className="form-error">{error}</p>}
              {sessions.message && <p className="form-success">{sessions.message}</p>}
              {sessions.error && <p className="form-error">{sessions.error}</p>}
              <p className="section-hint">
                Payout requests are settled by operations and receive a transfer reference when
                marked paid.
              </p>
            </section>
          </>
        )}
        <ProviderNav />
      </div>
    </main>
  );
}
