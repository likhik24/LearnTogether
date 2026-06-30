import type { ReactNode } from 'react';

export const metadata = {
  title: 'Learn&Build Admin Console',
  description: 'Admin console shell for the Learn&Build platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          background: '#0b1020',
          color: '#e7ecff',
        }}
      >
        <header
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #243',
            fontWeight: 600,
          }}
        >
          Learn&amp;Build Admin Console
        </header>
        <main style={{ padding: 24 }}>{children}</main>
      </body>
    </html>
  );
}
