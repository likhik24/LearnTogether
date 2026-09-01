import Link from 'next/link';
import { AppHeader } from './ui';

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="page-canvas">
      <article className="phone-shell legal-page">
        <AppHeader />
        <span className="eyebrow purple">LEARNTOGETHER POLICIES</span>
        <h1>{title}</h1>
        <p className="section-hint">Last updated {updated}</p>
        <div className="legal-copy">{children}</div>
        <nav className="legal-links" aria-label="Policies">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund-policy">Refunds</Link>
          <Link href="/provider-agreement">Providers</Link>
        </nav>
      </article>
    </main>
  );
}
