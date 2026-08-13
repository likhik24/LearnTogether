#!/usr/bin/env node
/**
 * End-to-end demo for Task 4 (scheduling) + Task 5 (search).
 * Requires the docker stack to be running.
 */
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
    displayName: 'Sensei',
    role: 'teacher',
  });
  const teacherToken = reg.body.accessToken;
  console.log(`1) Registered teacher (role=${reg.body.user?.role})`);

  const cls = await j(
    'POST',
    `${SCHED}/classes`,
    {
      activity: 'Jiu Jitsu',
      description: 'Beginner-friendly grappling, weekday evenings',
      instructorGender: 'any',
      durationMinutes: 60,
      seats: 8,
      timings: [
        { weekday: 1, startMinute: 1080 },
        { weekday: 3, startMinute: 1080 },
        { weekday: 5, startMinute: 1080 },
      ],
      location: { lat: 12.9716, lng: 77.5946 },
    },
    teacherToken,
  );
  console.log(`2) Created class status=${cls.status} id=${cls.body.id}`);

  const avail = await j('GET', `${SCHED}/classes/${cls.body.id}/availability?days=10`);
  console.log(`3) Availability: ${avail.body.length} occurrences; first:`, avail.body[0]);

  const admin = await j('POST', `${AUTH}/auth/login`, {
    email: 'admin@learnbuild.local',
    password: 'change-me-now',
  });
  const reindex = await j('POST', `${SEARCH}/search/reindex`, {}, admin.body.accessToken);
  console.log(`4) Reindex:`, reindex.body);

  const q = 'evening jiu jitsu near me';
  const search = await j(
    'GET',
    `${SEARCH}/search?q=${encodeURIComponent(q)}&lat=12.9750&lng=77.6000&radius=5000`,
  );
  console.log(`5) Query "${q}" within 5km -> ${search.body.total} hits`);
  for (const h of search.body.hits) {
    console.log(
      `   - ${h.activity} (score=${h.score.toFixed(3)}, ${Math.round(h.distanceMeters)}m)`,
    );
  }
}

main().catch((e) => {
  console.error('demo failed:', e);
  process.exit(1);
});
