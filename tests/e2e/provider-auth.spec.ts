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
  const classes = [classOffering('Existing Robotics Club')];
  await silenceSharedShellApis(page);
  await page.route('**/api/auth/**', async (route) => {
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
    if (path.includes('/customer/notifications')) return route.fulfill({ status: 200, body: '[]' });
    return route.fulfill({ status: 404, body: '{}' });
  });
  await page.route('**/api/teacher/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(profile('approved')),
    }),
  );
  await page.route('**/api/scheduling/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(classes) }),
  );

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

  await page.getByRole('link', { name: 'Provider studio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Class details' })).toBeVisible();
  await expect(page.getByText('Existing Robotics Club', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out of Provider Studio' }).click();
  await expect(page.getByRole('button', { name: 'Open provider studio' })).toBeVisible();
  await page.getByLabel('Email').fill(provider.email);
  await page.getByLabel('Password').fill('provider-pass');
  await page.getByRole('button', { name: 'Open provider studio' }).click();
  await expect(page.getByText('Existing Robotics Club', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of ['/teacher', '/provider']) {
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
  await page.route('**/api/teacher/**', async (route) => {
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

  await page.getByRole('link', { name: 'Open Provider Studio' }).click();
  await expect(page.getByText(/Profile review: submitted/i)).toBeVisible();
  await page.getByLabel('Class name').fill('Saturday Robotics Lab');
  await page.getByLabel('Venue name').fill('Hitech City Studio');
  await page.getByRole('button', { name: 'Submit class for approval' }).click();
  await expect(
    page.getByText('Class submitted. It will appear in discovery after moderation.'),
  ).toBeVisible();
  await expect(page.getByText('Saturday Robotics Lab', { exact: true })).toBeVisible();
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
  await page.route('**/api/teacher/**', (route) =>
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
