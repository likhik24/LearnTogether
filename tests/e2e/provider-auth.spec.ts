import { expect, test, type Page } from '@playwright/test';

const customer = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'family@example.com',
  displayName: 'Ananya Rao',
  role: 'user',
  provider: 'local',
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const provider = {
  ...customer,
  id: '33333333-3333-4333-8333-333333333333',
  email: 'provider@example.com',
  displayName: 'Meera Shah',
  role: 'teacher',
};

function profile(status = 'pending', documents: Array<Record<string, unknown>> = []) {
  return {
    id: 'profile-1',
    userId: provider.id,
    displayName: provider.displayName,
    phone: '9000000000',
    email: provider.email,
    locality: 'Hitech City',
    city: 'Hyderabad',
    category: 'stem',
    skills: ['STEM / science'],
    skillDescription: 'Hands-on robotics projects for curious children.',
    whyJoin: 'I enjoy helping children learn by building.',
    subjects: [],
    documents,
    verificationStatus: status,
    rejectionReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function classOffering(activity = 'Saturday Robotics Lab') {
  return {
    id: 'class-1',
    teacherId: provider.id,
    slug: null,
    activity,
    description: 'Build a moving robot.',
    category: 'STEM / Robotics',
    ageMin: 3,
    ageMax: 6,
    priceMinor: 49900,
    currency: 'INR',
    imageUrl: null,
    tone: 'mint',
    rating: 0,
    reviewCount: 0,
    venueName: 'Hitech City Studio',
    instructorGender: 'any',
    durationMinutes: 60,
    seats: 8,
    location: { lat: 17.4485, lng: 78.3915 },
    timings: [{ weekday: 6, startMinute: 600 }],
    status: 'active',
    moderationStatus: 'pending',
    moderationReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

async function silenceSharedShellApis(page: Page) {
  await page.route('**/api/search/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"hits":[]}' }),
  );
}

test('provider entry, password sign-in, studio session, logout and re-login work end to end', async ({
  page,
}) => {
  let authenticated = false;
  let attendanceMarked = false;
  let occurrenceChanged = false;
  let payoutRequested = false;
  const classes = [classOffering('Existing Robotics Club')];
  const upcomingStart = '2031-05-17T05:00:00.000Z';
  const recentStart = '2026-08-29T05:00:00.000Z';
  const sessions = [
    {
      classId: 'class-1',
      classTitle: 'Upcoming Robotics Lab',
      originalStart: upcomingStart,
      start: upcomingStart,
      end: '2031-05-17T06:00:00.000Z',
      status: 'scheduled',
      reason: null,
      seatsTotal: 8,
      seatsAvailable: 7,
      bookedSeats: 1,
    },
    {
      classId: 'class-1',
      classTitle: 'Recent Robotics Lab',
      originalStart: recentStart,
      start: recentStart,
      end: '2026-08-29T06:00:00.000Z',
      status: 'scheduled',
      reason: null,
      seatsTotal: 8,
      seatsAvailable: 7,
      bookedSeats: 1,
    },
  ];
  await silenceSharedShellApis(page);
  await page.route('**/api/auth/**', async (route) => {
    const request = route.request();
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/oidc/providers')) return route.fulfill({ status: 200, body: '[]' });
    if (path.endsWith('/auth/password-reset/request')) {
      return route.fulfill({ status: 204, body: '' });
    }
    if (path.endsWith('/auth/login')) {
      authenticated = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: '', user: provider }),
      });
    }
    if (path.endsWith('/auth/logout')) {
      authenticated = false;
      return route.fulfill({ status: 204, body: '' });
    }
    if (path.endsWith('/auth/me')) {
      return route.fulfill({
        status: authenticated ? 200 : 401,
        contentType: 'application/json',
        body: authenticated ? JSON.stringify(provider) : '{"message":"Unauthorized"}',
      });
    }
    if (path.endsWith('/provider/sessions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sessions),
      });
    }
    if (path.includes('/provider/classes/class-1/roster')) {
      const start = new URL(request.url()).searchParams.get('start') ?? upcomingStart;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            bookingId: 'booking-1',
            classId: 'class-1',
            parentName: 'Ananya Rao',
            parentEmail: 'family@example.com',
            childId: 'child-1',
            childName: 'Ari',
            scheduledStart: start,
            bookingStatus: 'confirmed',
            paymentStatus: 'succeeded',
            attendanceStatus: attendanceMarked ? 'present' : null,
            attendanceNotes: null,
          },
        ]),
      });
    }
    if (path.includes('/provider/bookings/booking-1/attendance')) {
      attendanceMarked = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bookingId: 'booking-1',
          classId: 'class-1',
          parentName: 'Ananya Rao',
          parentEmail: 'family@example.com',
          childId: 'child-1',
          childName: 'Ari',
          scheduledStart: recentStart,
          bookingStatus: 'confirmed',
          paymentStatus: 'succeeded',
          attendanceStatus: 'present',
          attendanceNotes: null,
        }),
      });
    }
    if (path.includes('/provider/classes/class-1/occurrences/change')) {
      occurrenceChanged = true;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(sessions[0]),
      });
    }
    if (path.includes('/customer/notifications')) return route.fulfill({ status: 200, body: '[]' });
    return route.fulfill({ status: 404, body: '{}' });
  });
  await page.route('**/api/provider/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(profile('approved')),
    }),
  );
  await page.route('**/api/scheduling/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(classes) }),
  );
  await page.route('**/api/payments/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/payments/provider/earnings')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          currency: 'INR',
          platformFeeBps: 1000,
          grossMinor: 20000,
          refundedMinor: 0,
          feeMinor: 2000,
          netMinor: 18000,
          requestedMinor: 0,
          paidMinor: 0,
          availableMinor: 18000,
          classes: [],
        }),
      });
    }
    if (path.endsWith('/payments/provider/payouts') && request.method() === 'POST') {
      payoutRequested = true;
      return route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
    }
    if (path.endsWith('/payments/provider/payouts')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Provider sign in or apply' }).click();
  await expect(page).toHaveURL(/\/provider$/);
  await expect(page.getByRole('button', { name: 'Provider sign in' })).toHaveAttribute(
    'class',
    /active/,
  );
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page).toHaveURL(/\/profile\?mode=forgot/);
  await page.getByLabel('Email').fill(provider.email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByText('If that account exists, a reset link is on its way.')).toBeVisible();

  await page.goto('/provider');
  await page.getByLabel('Email').fill(provider.email);
  await page.getByLabel('Password').fill('provider-pass');
  await page.getByRole('button', { name: 'Sign in to Provider Studio' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Meera Shah.' })).toBeVisible();

  await page
    .getByRole('link', { name: '3. Studio Create and manage classes.', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Class details' })).toBeVisible();
  await expect(page.getByText('Existing Robotics Club', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Manage session' }).click();
  await page.getByLabel('Replacement date and time').fill('2031-05-24T10:30');
  await page.getByLabel('Message to families').fill('Venue maintenance');
  await page.getByRole('button', { name: 'Reschedule session' }).click();
  await expect(page.getByText(/Session rescheduled and families notified/)).toBeVisible();
  expect(occurrenceChanged).toBe(true);

  await page
    .getByRole('navigation', { name: 'Provider studio tabs' })
    .getByRole('link', { name: 'Earnings', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Earnings & finished sessions.' })).toBeVisible();
  await page.getByRole('button', { name: 'Request payout' }).click();
  await expect(page.getByText(/Payout requested/)).toBeVisible();
  expect(payoutRequested).toBe(true);

  await page
    .getByText('Recent Robotics Lab', { exact: true })
    .locator('..')
    .locator('..')
    .getByRole('button', { name: 'Open roster' })
    .click();
  await expect(page.getByText('family@example.com')).toBeVisible();
  await page.getByRole('button', { name: 'Present' }).click();
  expect(attendanceMarked).toBe(true);
  await page.getByRole('button', { name: 'Close session manager' }).click();

  await page
    .getByRole('navigation', { name: 'Provider studio tabs' })
    .getByRole('link', { name: 'Classes', exact: true })
    .click();
  await page.getByRole('button', { name: 'Sign out of Provider Studio' }).click();
  await expect(page.getByRole('button', { name: 'Open provider studio' })).toBeVisible();
  await page.getByLabel('Email').fill(provider.email);
  await page.getByLabel('Password').fill('provider-pass');
  await page.getByRole('button', { name: 'Open provider studio' }).click();
  await expect(page.getByText('Existing Robotics Club', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of ['/provider/classes', '/provider']) {
    await page.goto(route);
    await expect(page.locator('body')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${route} should not overflow at desktop width`).toBeLessThanOrEqual(1);
  }
});

test('a family account can complete provider onboarding, review submission, and class creation', async ({
  page,
}) => {
  let currentUser = customer;
  let savedProfile: ReturnType<typeof profile> | null = null;
  let documents: Array<Record<string, unknown>> = [];
  let submitted = false;
  const classes: Array<Record<string, unknown>> = [];
  await silenceSharedShellApis(page);
  await page.route('**/api/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/oidc/providers')) return route.fulfill({ status: 200, body: '[]' });
    if (path.endsWith('/auth/provider-account')) {
      currentUser = provider;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: '', user: provider }),
      });
    }
    if (path.endsWith('/auth/me'))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentUser),
      });
    if (path.includes('/customer/notifications')) return route.fulfill({ status: 200, body: '[]' });
    return route.fulfill({ status: 404, body: '{}' });
  });
  await page.route('**/test-upload/**', (route) =>
    route.fulfill({ status: 200, body: '' }),
  );
  await page.route('**/api/provider/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/teachers/me/documents/presign')) {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          uploadUrl: '/test-upload/portfolio',
          storageKey: `teachers/${provider.id}/portfolio.pdf`,
          expiresIn: 900,
        }),
      });
    }
    if (path.endsWith('/teachers/me/documents')) {
      documents = [
        {
          id: 'document-1',
          type: 'other',
          fileName: 'portfolio.pdf',
          storageKey: `teachers/${provider.id}/portfolio.pdf`,
          createdAt: new Date().toISOString(),
        },
      ];
      savedProfile = profile('pending', documents);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(savedProfile),
      });
    }
    if (path.endsWith('/teachers/me/submit')) {
      submitted = true;
      savedProfile = profile('submitted', documents);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(savedProfile),
      });
    }
    if (path.endsWith('/teachers/me') && request.method() === 'PUT') {
      savedProfile = profile('pending', documents);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(savedProfile),
      });
    }
    if (path.endsWith('/teachers/me')) {
      return route.fulfill({
        status: savedProfile ? 200 : 404,
        contentType: 'application/json',
        body: savedProfile ? JSON.stringify(savedProfile) : '{}',
      });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
  await page.route('**/api/scheduling/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/classes/mine'))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(classes),
      });
    if (path.endsWith('/classes') && request.method() === 'POST') {
      const created = classOffering((request.postDataJSON() as { activity: string }).activity);
      classes.push(created);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });
  await page.route('**/api/geocode?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [{ label: 'Hitech City Studio, Hyderabad', lat: '17.4485', lng: '78.3915' }],
      }),
    }),
  );

  await page.goto('/provider');
  await expect(page.getByRole('heading', { name: 'Ananya Rao, become a provider?' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue as a provider' }).click();
  await expect(page.getByRole('button', { name: 'Save provider profile' })).toBeVisible();
  await expect(page.getByText('Save profile to enable upload')).toBeVisible();
  await page.getByLabel('Phone / WhatsApp number *').fill('9000000000');
  await page.getByLabel('Which area/locality do you live in? *').fill('Hitech City');
  await page.getByLabel('Your city *').fill('Hyderabad');
  await page.getByRole('button', { name: 'STEM / Robotics', exact: true }).click();
  await page
    .getByRole('group', { name: 'What skills would you like to teach/share with children?' })
    .getByRole('button', { name: 'STEM / science', exact: true })
    .click();
  await page
    .getByLabel('Tell us about your skill in your own words *')
    .fill('Hands-on robotics projects for curious children.');
  await page
    .getByLabel('Share what draws you to teaching with us *')
    .fill('I enjoy helping children learn by building.');
  await page.getByRole('button', { name: 'Save provider profile' }).click();
  await expect(page.getByText('Profile changes saved.')).toBeVisible();
  await page
    .locator('input[type="file"][accept="application/pdf"]')
    .setInputFiles({
      name: 'portfolio.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\nprovider portfolio'),
    });
  await expect(page.getByText('portfolio.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'Submit profile for review' }).click();
  await expect(page.getByText(/Verification status: submitted/i)).toBeVisible();
  expect(submitted).toBe(true);

  await page.getByRole('link', { name: 'Open class studio' }).click();
  await expect(page.getByText(/Profile review: submitted/i)).toBeVisible();
  await page.getByLabel('Class name').fill('Saturday Robotics Lab');
  await page.getByPlaceholder('Search a studio, address or landmark').fill('Hitech City Studio');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Hitech City Studio, Hyderabad' }).click();
  await page.getByRole('button', { name: 'Submit class for approval' }).click();
  await expect(
    page.getByText('Class submitted. It will appear in discovery after moderation.'),
  ).toBeVisible();
  await expect(page.getByText('Saturday Robotics Lab', { exact: true })).toBeVisible();
});

test('an administrator can process a provider payout with a required transfer reference', async ({
  page,
}) => {
  const admin = { ...customer, id: 'admin-1', email: 'admin@example.com', role: 'admin' };
  let payout = {
    id: 'payout-1',
    teacherId: provider.id,
    amountMinor: 18000,
    currency: 'INR',
    status: 'requested',
    reference: null as string | null,
    note: null,
    createdAt: '2026-08-30T10:00:00.000Z',
    updatedAt: '2026-08-30T10:00:00.000Z',
  };
  await page.route('**/api/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(admin) });
    }
    if (path.endsWith('/auth/oidc/providers')) return route.fulfill({ status: 200, body: '[]' });
    if (path.endsWith('/admin/users')) return route.fulfill({ status: 200, body: '[]' });
    return route.fulfill({ status: 404, body: '{}' });
  });
  await page.route('**/api/provider/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/scheduling/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/payments/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/payments/admin/payouts') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([payout]),
      });
    }
    if (path.includes('/payments/admin/payouts/payout-1') && request.method() === 'POST') {
      const input = request.postDataJSON() as { status: string; reference?: string };
      payout = {
        ...payout,
        status: input.status,
        reference: input.reference ?? payout.reference,
        updatedAt: new Date().toISOString(),
      };
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(payout),
      });
    }
    return route.fulfill({ status: 404, body: '{}' });
  });

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Provider payouts' })).toBeVisible();
  await page.getByRole('button', { name: 'Start processing' }).click();
  await expect(page.getByText('processing', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept('bank-transfer-123'));
  await page.getByRole('button', { name: 'Mark paid' }).click();
  await expect(page.getByText('paid', { exact: true })).toBeVisible();
  await expect(page.getByText(/reference bank-transfer-123/)).toBeVisible();
});

test('provider UI hydrates a secure cookie session after social sign-in', async ({ page }) => {
  await silenceSharedShellApis(page);
  await page.route('**/api/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me'))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(provider),
      });
    if (path.endsWith('/auth/oidc/providers')) return route.fulfill({ status: 200, body: '[]' });
    if (path.includes('/customer/notifications')) return route.fulfill({ status: 200, body: '[]' });
    return route.fulfill({ status: 404, body: '{}' });
  });
  await page.route('**/api/provider/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(profile('approved')),
    }),
  );
  await page.goto('/provider');
  await expect(page.getByRole('heading', { name: 'Welcome, Meera Shah.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save provider profile' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Provider sign in' })).toHaveCount(0);
});
