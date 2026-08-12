import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 520, margin: '3rem auto', textAlign: 'center' }}>
      <h1>Page not found</h1>
      <p style={{ color: 'var(--muted)' }}>The page you requested does not exist or has moved.</p>
      <Link href="/" className="btn btn-primary">
        Return home
      </Link>
    </div>
  );
}
