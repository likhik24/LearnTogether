import { LegalPage } from '../legal-page';

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Cancellation & Refund Policy" updated="31 August 2026">
      <h2>Family cancellation</h2>
      <p>
        Eligible future bookings can be cancelled from Bookings. Any captured payment is queued for
        refund to the original method; bank processing times may vary.
      </p>
      <h2>Provider cancellation</h2>
      <p>
        If a provider cancels a session, affected paid bookings are automatically queued for a full
        refund and families are notified.
      </p>
      <h2>Rescheduling</h2>
      <p>
        Families may request another available session. The original booking remains valid until the
        provider approves the change.
      </p>
      <h2>Help</h2>
      <p>For a missing refund, contact support@learnandbuild.org with the booking reference.</p>
    </LegalPage>
  );
}
