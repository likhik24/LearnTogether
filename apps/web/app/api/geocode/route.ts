import { NextResponse } from 'next/server';

/**
 * Server-side geocoding proxy.
 *
 * The provider forms need to turn a typed address/venue into coordinates. They
 * used to call OpenStreetMap Nominatim directly from the browser, but Nominatim
 * does not send permissive CORS headers and enforces a usage policy that
 * requires a real User-Agent, so browser calls fail with "Failed to fetch"
 * (especially from a production origin).
 *
 * Routing the lookup through this same-origin handler avoids CORS entirely and
 * lets us send the required User-Agent from the server. Results are normalized
 * to `{ label, lat, lng }`.
 */
export const runtime = 'nodejs';
// Geocoding results are stable enough to cache briefly; avoids hammering the
// upstream and speeds up repeat searches. Still dynamic per query.
export const dynamic = 'force-dynamic';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Nominatim's usage policy requires an identifying User-Agent with contact info.
const USER_AGENT =
  'LearnAndBuild/1.0 (+https://www.learnandbuild.org; admin@learnandbuild.org)';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter q' }, { status: 400 });
  }

  const upstream = `${NOMINATIM_URL}?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(upstream, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      // Never let a slow upstream hang the request indefinitely.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Geocoding failed (${res.status})` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
    }>;
    const results = data.map((r) => ({ label: r.display_name, lat: r.lat, lng: r.lon }));
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Geocoding request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
