#!/usr/bin/env node
/**
 * Creates the "Puppetry & Storytelling" Saturday-morning class in Financial
 * District, Hyderabad, and makes it searchable. Stack must be running.
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

const sessionDescription = `Puppets & Stories – An Independence Day Special! 🇮🇳

What does freedom really mean?

This Independence Day weekend, join us for a special family storytelling experience that celebrates courage, hope, and the power of standing up for what is right.

📚 Experience two unique performances:
🎭 A specially crafted puppet show that brings a powerful story to life.
📖 An interactive storytelling performance celebrating the legendary folk hero Birsa Munda whose courage inspired his people and whose legacy continues to resonate today.

Together, these stories invite children and adults to reflect on the meaning of freedom—not just as a moment in history, but as a value we continue to protect and celebrate.

Led by Chitra. For ages 3–10.`;

async function main() {
  const email = `chitra_${Date.now()}@example.com`;
  const reg = await j('POST', `${AUTH}/auth/register`, {
    email,
    password: 'supersecret',
    displayName: 'Chitra',
    role: 'teacher',
  });
  const token = reg.body.accessToken;
  console.log(`Teacher: ${email} (role=${reg.body.user?.role})`);

  const listing = {
    activity: 'Puppetry & Storytelling',
    description: sessionDescription,
    category: 'Storytelling',
    ageMin: 3,
    ageMax: 10,
    priceMinor: 45000, // ₹450.00 per person (INR minor units)
    currency: 'INR',
    venueName: 'Financial District, Hyderabad (500032)',
    instructorGender: 'any',
    durationMinutes: 60,
    seats: 10,
    timings: [
      { weekday: 6, startMinute: 10 * 60 }, // Saturday 10:00
    ],
    location: { lat: 17.4156, lng: 78.3376 }, // Financial District, Hyderabad
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
    `${SEARCH}/search?q=${encodeURIComponent('puppetry storytelling')}&lat=17.4156&lng=78.3376&radius=5000`,
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
