'use client';

import { useEffect, useState } from 'react';
import type { AccountDeletionStatusDto, NotificationPreferencesDto } from '@learn-and-build/types';
import { getCustomerClient } from '../../lib/customer-session';

export function AccountControls() {
  const [preferences, setPreferences] = useState<NotificationPreferencesDto | null>(null);
  const [deletion, setDeletion] = useState<AccountDeletionStatusDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = getCustomerClient();
    if (!client) return;
    void Promise.all([client.getNotificationPreferences(), client.getAccountDeletionStatus()])
      .then(([loadedPreferences, deletionStatus]) => {
        setPreferences(loadedPreferences);
        setDeletion(deletionStatus);
      })
      .catch(() => undefined);
  }, []);

  async function update(
    key: 'emailEnabled' | 'bookingReminders' | 'productUpdates',
    value: boolean,
  ) {
    const client = getCustomerClient();
    if (!client) return;
    setPreferences((current) => (current ? { ...current, [key]: value } : current));
    try {
      setPreferences(await client.updateNotificationPreferences({ [key]: value }));
    } catch {
      setMessage('That preference could not be saved.');
    }
  }

  async function exportData() {
    const client = getCustomerClient();
    if (!client) return;
    setBusy(true);
    try {
      const data = await client.exportAccountData();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `learntogether-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Your data export was downloaded.');
    } catch {
      setMessage('Your data export could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (
      !window.confirm(
        'Schedule account deletion in 7 days? Upcoming bookings must be cancelled first.',
      )
    )
      return;
    const client = getCustomerClient();
    if (!client) return;
    setBusy(true);
    try {
      setDeletion(await client.requestAccountDeletion());
      setMessage('Account deletion is scheduled. You can cancel it during the grace period.');
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : 'Account deletion could not be scheduled.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelDeletion() {
    const client = getCustomerClient();
    if (!client) return;
    setBusy(true);
    try {
      await client.cancelAccountDeletion();
      setDeletion({ requestedAt: null, scheduledFor: null });
      setMessage('Account deletion was cancelled.');
    } catch {
      setMessage('Account deletion could not be cancelled. Please contact support.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-controls">
      <h2>Notifications & privacy</h2>
      {preferences && (
        <fieldset>
          <label>
            <input
              type="checkbox"
              checked={preferences.emailEnabled}
              onChange={(event) => void update('emailEnabled', event.target.checked)}
            />{' '}
            Email notifications
          </label>
          <label>
            <input
              type="checkbox"
              checked={preferences.bookingReminders}
              onChange={(event) => void update('bookingReminders', event.target.checked)}
            />{' '}
            Class reminders (24 hours and 2 hours)
          </label>
          <label>
            <input
              type="checkbox"
              checked={preferences.productUpdates}
              onChange={(event) => void update('productUpdates', event.target.checked)}
            />{' '}
            Product news
          </label>
        </fieldset>
      )}
      <div className="booking-actions">
        <button type="button" disabled={busy} onClick={() => void exportData()}>
          Download my data
        </button>
        {deletion?.requestedAt ? (
          <button type="button" disabled={busy} onClick={() => void cancelDeletion()}>
            Cancel account deletion
          </button>
        ) : (
          <button
            className="danger"
            type="button"
            disabled={busy}
            onClick={() => void deleteAccount()}
          >
            Delete account
          </button>
        )}
      </div>
      {deletion?.scheduledFor && (
        <p className="section-hint">
          Deletion scheduled for {new Date(deletion.scheduledFor).toLocaleDateString('en-IN')}.
        </p>
      )}
      {message && (
        <p className="section-hint" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
