#!/usr/bin/env node
/** Creates a Jiu Jitsu listing and makes it searchable. Stack must be running. */
const AUTH = 'http://localhost:3001';
const SCHED = 'http://localhost:3004';
const SEARCH = 'http://localhost:3003';

async function j(method, url, body, token) {
  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function main() {
  const email = `sensei_${Date.now()}@example.com`;
  const reg = await j('POST', `${AUTH}/auth/register`, {
    email,
    password: 'supersecret',
    displayName: 'Sensei Marcelo',
    role: 'teacher',
  });
  const token = reg.body.accessToken;
  console.log(`Teacher: ${email} (role=${reg.body.user?.role})`);

  const listing = {
    activity: 'Jiu Jitsu',
    description:
      'Brazilian Jiu Jitsu for all levels. Gi and no-gi, live sparring, weekday evenings.',
    instructorGender: 'any',
    durationMinutes: 60,
    seats: 8,
    timings: [
      { weekday: 1, startMinute: 18 * 60 }, // Mon 18:00
      { weekday: 3, startMinute: 18 * 60 }, // Wed 18:00
      { weekday: 5, startMinute: 19 * 60 }, // Fri 19:00
    ],
    location: { lat: 12.9716, lng: 77.5946 },
  };
  const created = await j('POST', `${SCHED}/classes`, listing, token);
  console.log(`Listing created: status=${created.status} id=${created.body.id}`);
  if (created.status !== 201) {
    console.log('  ->', JSON.stringify(created.body));
    return;
  }

  const admin = await j('POST', `${AUTH}/auth/login`, {
    email: 'admin@learnbuild.local',
    password: 'change-me-now',
  });
  const reindex = await j('POST', `${SEARCH}/search/reindex`, {}, admin.body.accessToken);
  console.log(`Reindexed: ${JSON.stringify(reindex.body)}`);

  const check = await j(
    'GET',
    `${SEARCH}/search?q=${encodeURIComponent('evening jiu jitsu')}&lat=12.975&lng=77.6&radius=5000`,
  );
  console.log(`Searchable now: ${check.body.total} hit(s)`);
  for (const h of check.body.hits) {
    console.log(`  - ${h.activity} (${Math.round(h.distanceMeters)}m, score ${h.score.toFixed(2)})`);
  }
}

main().catch((e) => {
  console.error('failed:', e);
  process.exit(1);
});
