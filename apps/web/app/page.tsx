import Link from 'next/link';

export default function HomePage() {
  return (
    <section>
      <h1>Welcome</h1>
      <p>
        This is the admin console shell. Sign in to manage platform users and
        roles.
      </p>
      <Link
        href="/admin"
        style={{
          display: 'inline-block',
          marginTop: 16,
          padding: '10px 16px',
          background: '#3b82f6',
          color: 'white',
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        Open Admin Console
      </Link>
    </section>
  );
}
