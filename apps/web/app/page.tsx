import Link from 'next/link';

export default function HomePage() {
  return (
    <section>
      <h1>Welcome</h1>
      <p>
        Discover classes as a customer, or sign in to the admin console to
        manage platform users and roles.
      </p>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <Link
          href="/discover"
          style={{
            display: 'inline-block',
            padding: '10px 16px',
            background: '#22c55e',
            color: 'white',
            borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          Discover Classes
        </Link>
        <Link
          href="/admin"
          style={{
            display: 'inline-block',
            padding: '10px 16px',
            background: '#3b82f6',
            color: 'white',
            borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          Open Admin Console
        </Link>
      </div>
    </section>
  );
}
