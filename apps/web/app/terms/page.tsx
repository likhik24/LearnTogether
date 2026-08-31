import { LegalPage } from '../legal-page';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="31 August 2026">
      <h2>Using LearnTogether</h2>
      <p>
        You must provide accurate account and child-age information, safeguard your login, and use
        the service lawfully. A parent or guardian must make bookings for children.
      </p>
      <h2>Bookings</h2>
      <p>
        A booking is confirmed only after successful payment. Class schedules, eligibility,
        capacity, cancellation, and provider rules shown at checkout form part of the booking.
      </p>
      <h2>Safety and conduct</h2>
      <p>
        Providers remain responsible for safe delivery, required permissions, and truthful listings.
        Families and providers must behave respectfully. We may suspend unsafe, fraudulent, or
        abusive accounts.
      </p>
      <h2>Contact</h2>
      <p>Questions and formal notices can be sent to support@learnandbuild.org.</p>
    </LegalPage>
  );
}
