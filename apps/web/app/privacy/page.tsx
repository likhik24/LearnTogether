import { LegalPage } from '../legal-page';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="31 August 2026">
      <h2>Data we use</h2>
      <p>
        We process account details, child profiles supplied by guardians, bookings, payments, saved
        classes, communications, provider verification records, and security logs to operate the
        marketplace.
      </p>
      <h2>Sharing and retention</h2>
      <p>
        Providers receive only the roster and contact information needed to deliver booked classes.
        Payment and infrastructure vendors process data under their own safeguards. Records are
        retained only for service, legal, fraud, and accounting needs.
      </p>
      <h2>Your choices</h2>
      <p>
        You can change email preferences, export your account data, or request account deletion from
        Profile. Financial and safety records may be retained where law requires.
      </p>
      <h2>Children</h2>
      <p>
        Child profiles must be created by a parent or guardian. We do not knowingly invite children
        to create accounts themselves.
      </p>
    </LegalPage>
  );
}
