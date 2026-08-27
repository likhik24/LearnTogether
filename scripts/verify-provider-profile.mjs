#!/usr/bin/env node
/** End-to-end check: register a provider, upsert a full profile, read it back. */
const AUTH = 'http://localhost:3001';
const TEACHER = 'http://localhost:3002';

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
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

async function main() {
  const email = `provider_${Date.now()}@example.com`;
  const reg = await j('POST', `${AUTH}/auth/register`, {
    email, password: 'supersecret', displayName: 'Chitra', role: 'teacher',
  });
  const token = reg.body.accessToken;
  console.log(`Registered: ${email} role=${reg.body.user?.role}`);

  const profile = {
    displayName: 'Chitra',
    phone: '+91 90000 00000',
    email,
    ageBand: '40-50',
    locality: 'Nanakramguda',
    city: 'Hyderabad',
    category: 'music',
    subcategories: ['Carnatic music'],
    skills: ['Carnatic music', 'Storytelling'],
    skillDescription: 'I have taught Carnatic vocal for over a decade.',
    yearsExperience: '10+',
    portfolio: 'https://youtube.com/@chitra',
    childrenExperience: 'regularly',
    childrenExperienceDetail: 'Weekend music circles for 6-10 yr olds.',
    childAgeGroups: ['4-6', '6-8', '8-10'],
    teachingFormats: ['small_group', 'weekend_experiences'],
    venuePreferences: ['home_studio', 'partner_space'],
    travelRadius: 'within_5km',
    availableDays: ['saturday', 'sunday'],
    timeSlots: ['9-11am', '11am-1pm'],
    preferredAvailability: 'Saturday 10 AM-1 PM, Sunday 4-7 PM',
    sessionFrequency: 'weekends_only',
    whyJoin: 'I want to pass on our musical traditions to the next generation.',
  };

  const put = await j('PUT', `${TEACHER}/teachers/me`, profile, token);
  console.log(`Upsert: status=${put.status}`);
  if (put.status !== 200) { console.log('  ->', JSON.stringify(put.body)); return; }

  const got = await j('GET', `${TEACHER}/teachers/me`, null, token);
  const p = got.body;
  console.log('Read back:');
  console.log(JSON.stringify({
    displayName: p.displayName,
    phone: p.phone,
    ageBand: p.ageBand,
    locality: p.locality,
    city: p.city,
    category: p.category,
    subcategories: p.subcategories,
    skills: p.skills,
    yearsExperience: p.yearsExperience,
    childrenExperience: p.childrenExperience,
    childAgeGroups: p.childAgeGroups,
    teachingFormats: p.teachingFormats,
    venuePreferences: p.venuePreferences,
    travelRadius: p.travelRadius,
    availableDays: p.availableDays,
    timeSlots: p.timeSlots,
    preferredAvailability: p.preferredAvailability,
    sessionFrequency: p.sessionFrequency,
    whyJoin: p.whyJoin,
  }, null, 2));

  // Partial update must not wipe earlier answers.
  const partial = await j('PUT', `${TEACHER}/teachers/me`, { displayName: 'Chitra', city: 'Hyderabad' }, token);
  const after = await j('GET', `${TEACHER}/teachers/me`, null, token);
  console.log(`Partial-save preserved category=${after.body.category} subcategories=${JSON.stringify(after.body.subcategories)} (expected music / ["Carnatic music"])`);
}

main().catch((e) => { console.error('failed:', e); process.exit(1); });
