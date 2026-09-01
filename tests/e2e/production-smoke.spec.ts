import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const runId = process.env.E2E_RUN_ID ?? Date.now().toString();
const password = `Smoke-${runId}-Pass!`;
const customerEmail = `smoke.customer.${runId}@learnandbuild.org`;
const providerEmail = `smoke.provider.${runId}@learnandbuild.org`;
const childName = `Ari${runId.slice(-4)}`;
const className = `Smoke Robotics ${runId}`;
const screenshotDir = '.tmp_e2e/screenshots';

mkdirSync(screenshotDir, { recursive: true });

async function clearSession(page: Page) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
}

async function discoverClass(request: APIRequestContext, slug: string) {
  const response = await request.get('/api/scheduling/classes/discover?days=21');
  expect(response.ok()).toBeTruthy();
  const classes = (await response.json()) as Array<{
    id: string;
    slug: string | null;
    nextOccurrence: { start: string; seatsAvailable: number } | null;
  }>;
  const found = classes.find((item) => item.slug === slug);
  expect(found, `Expected discovery class ${slug}`).toBeTruthy();
  expect(found?.nextOccurrence).toBeTruthy();
  return found!;
}

test.describe.serial('live production journeys', () => {
  test.skip(
    process.env.RUN_PRODUCTION_E2E !== 'true',
    'Set RUN_PRODUCTION_E2E=true with E2E_BASE_URL for live production checks.',
  );
  test('customer account, child, discovery, saved class, booking and notifications', async ({
    page,
    request,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await clearSession(page);
    await expect(page.getByRole('heading', { name: /Let’s find something/ })).toBeVisible();
    await expect(page.getByText(/Priya/i)).toHaveCount(0);

    await page.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByRole('dialog', { name: 'Notifications panel' })).toBeVisible();
    await expect(page.getByText('Sign in to see booking and profile updates.')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('button', { name: 'Change location' }).click();
    await expect(page.getByRole('dialog', { name: 'Choose your location' })).toBeVisible();
    await page.getByRole('button', { name: /Gachibowli, Hyderabad/ }).click();
    await expect(page.getByRole('button', { name: 'Change location' })).toContainText('Gachibowli');

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByLabel('Your name').fill(`Smoke Customer ${runId}`);
    await page.getByLabel('Email').fill(customerEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create account & sync' }).click();
    await expect(page.getByText('API CONNECTED')).toBeVisible();
    expect(
      await page.evaluate(() => window.localStorage.getItem('learn-together-access-token')),
    ).toBeNull();
    const sessionCookies = await page.context().cookies();
    expect(sessionCookies.find((cookie) => cookie.name === 'lt_access')?.httpOnly).toBeTruthy();
    expect(sessionCookies.find((cookie) => cookie.name === 'lt_refresh')?.httpOnly).toBeTruthy();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Sign in & sync' })).toBeVisible();
    await page.getByLabel('Email').fill(customerEmail.toUpperCase());
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in & sync' }).click();
    await expect(page.getByText('API CONNECTED')).toBeVisible();

    await page.goto('/children');
    await page.getByLabel('Name').fill(childName);
    await page.getByLabel('Birthday').fill('2021-05-17');
    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    await page.getByRole('button', { name: 'STEM', exact: true }).click();
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Saved to LearnTogether')).toBeVisible();

    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: new RegExp(`${childName} will love`) }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByText(`${childName}'s profile is ready`)).toBeVisible();
    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.screenshot({ path: `${screenshotDir}/customer-home.png`, fullPage: true });

    await page.goto('/discover');
    await expect(page.getByRole('heading', { name: 'Browse by interest' })).toBeVisible();
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await page.getByLabel('Search classes').fill('car');
    await expect(page.getByRole('heading', { name: 'Build-a-Car STEM Workshop' })).toBeVisible();
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(
      page.getByRole('application', { name: 'Interactive map of nearby classes' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Select Build-a-Car STEM Workshop/ }),
    ).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/discover-map.png`, fullPage: true });

    const before = await discoverClass(request, 'build-a-car');
    const beforeSeats = before.nextOccurrence!.seatsAvailable;

    await page.goto('/classes/build-a-car');
    await page.getByRole('button', { name: 'Save class' }).click();
    await expect(page.getByRole('button', { name: 'Remove saved class' })).toBeVisible();
    await page.getByRole('button', { name: /parent reviews/ }).click();
    await expect(page.getByRole('dialog', { name: 'Parent reviews' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('checking live availability')).toBeHidden();
    await page.getByRole('button', { name: /Book trial/ }).click();
    const bookingDialog = page.getByRole('dialog', { name: 'Confirm trial booking' });
    await expect(bookingDialog).toBeVisible();
    await bookingDialog.getByRole('button', { name: 'Reserve this spot' }).click();
    const bookedDialog = page.getByRole('dialog', { name: 'Booking confirmed' });
    await expect(bookedDialog.getByText('BOOKING CONFIRMED')).toBeVisible();

    const held = await discoverClass(request, 'build-a-car');
    expect(held.nextOccurrence!.seatsAvailable).toBe(beforeSeats - 1);

    await bookedDialog.getByRole('link', { name: 'View my bookings' }).click();
    await expect(page.getByText('CONFIRMED')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel booking' }).click();
    await page.getByRole('dialog', { name: 'Cancel booking' }).getByRole('button', { name: 'Yes, cancel booking' }).click();
    await expect(page.getByRole('heading', { name: 'No bookings yet' })).toBeVisible();

    const released = await discoverClass(request, 'build-a-car');
    expect(released.nextOccurrence!.seatsAvailable).toBe(beforeSeats);

    await page.goto('/recommendations');
    await page.getByRole('button', { name: 'Saved', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Build-a-Car STEM Workshop' })).toBeVisible();

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Sign in & sync' })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('provider registration, profile review, S3 PDF upload and class publishing', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await clearSession(page);

    await page.goto('/provider?mode=register');
    await page.getByRole('button', { name: 'Apply to teach' }).click();
    await page.getByLabel('Full name').fill(`Smoke Provider ${runId}`);
    await page.getByLabel('Email').fill(providerEmail);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Create provider account' }).click();
    await expect(page.getByRole('heading', { name: /Welcome, Smoke Provider/ })).toBeVisible();
    await page.getByLabel(/Phone \/ WhatsApp number/).fill('9000000000');
    await page.getByLabel(/Which area\/locality/).fill('Hitech City');
    await page.getByRole('button', { name: 'STEM / Robotics', exact: true }).click();
    await page
      .getByRole('group', { name: 'What skills would you like to teach/share with children?' })
      .getByRole('button', { name: 'STEM / science', exact: true })
      .click();
    await page
      .getByLabel(/Tell us about your skill/)
      .fill('I enjoy helping children build simple machines and understand how they work.');
    await page
      .getByLabel(/Share what draws you/)
      .fill('I want children to learn through practical, hands-on projects.');
    await page.getByRole('button', { name: 'Save provider profile' }).click();
    await expect(page.getByText('Profile changes saved.')).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: `smoke-portfolio-${runId}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n% Learn & Build production smoke test\n'),
    });
    await expect(page.getByText(`smoke-portfolio-${runId}.pdf`)).toBeVisible();
    await page.getByRole('button', { name: 'Submit profile for review' }).click();
    await expect(page.getByText(/Verification status: submitted/i)).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/provider-profile.png`, fullPage: true });

    await page.getByRole('link', { name: 'Open Provider Studio' }).click();
    await expect(page.getByRole('heading', { name: 'Class details' })).toBeVisible();
    await page.getByLabel('Class name').fill(className);
    await page
      .getByLabel('What will families learn?')
      .fill('A production smoke-test robotics class.');
    await page.getByLabel('Venue name').fill('Hitech City Community Studio');
    await page.getByPlaceholder('painting, craft, creative, beginner').fill('robotics, smoke-test');
    await page.getByRole('button', { name: 'Submit class for approval' }).click();
    await expect(
      page.getByText('Class submitted. It will appear in discovery after moderation.'),
    ).toBeVisible();
    await expect(page.getByText(className, { exact: true })).toBeVisible();

    await page.goto('/provider');
    await page.getByRole('button', { name: 'Sign out of provider account' }).click();
    await expect(
      page.getByRole('heading', { name: 'Share your craft with young learners.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Provider sign in' }).click();
    const loginForm = page.locator('form.customer-auth-form');
    await loginForm.getByLabel('Email').fill(providerEmail);
    await loginForm.getByLabel('Password').fill(password);
    await loginForm.getByRole('button', { name: 'Sign in to Provider Studio' }).click();
    await expect(page.getByRole('heading', { name: /Welcome, Smoke Provider/ })).toBeVisible();
    await expect(page.getByLabel(/Phone \/ WhatsApp number/)).toHaveValue('9000000000');
    await expect(page.getByText(`smoke-portfolio-${runId}.pdf`)).toBeVisible();

    await page.goto('/teacher');
    await expect(page.getByRole('heading', { name: 'Class details' })).toBeVisible();
    await expect(page.getByText(className, { exact: true })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('admin page handles rejected authentication without a client crash', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/admin');
    await page.getByPlaceholder('admin email').fill('not-admin@learnandbuild.org');
    await page.getByPlaceholder('password').fill('definitely-wrong');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Invalid credentials')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('key pages render at desktop size without horizontal overflow', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await clearSession(page);

    for (const route of [
      '/',
      '/discover',
      '/recommendations',
      '/classes/build-a-car',
      '/bookings',
      '/children',
      '/profile',
      '/provider',
      '/teacher',
      '/admin',
    ]) {
      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} should not overflow the desktop viewport`).toBeLessThanOrEqual(0);
    }

    await page.goto('/');
    await page.screenshot({ path: `${screenshotDir}/desktop-home.png`, fullPage: true });
    expect(pageErrors).toEqual([]);
  });
});
