import { AppHeader, BottomNav } from './ui';

export function SimplePage({ eyebrow, title, message, symbol }: { eyebrow: string; title: string; message: string; symbol: string }) {
  return (
    <main className="page-canvas">
      <div className="phone-shell simple-page">
        <AppHeader />
        <span className="eyebrow purple">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{message}</p>
        <div className="simple-illustration"><span>{symbol}</span><i /><i /><i /></div>
        <BottomNav />
      </div>
    </main>
  );
}
