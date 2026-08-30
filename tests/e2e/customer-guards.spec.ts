import { expect, test, type Page } from '@playwright/test';

const occurrenceStart = '2031-05-17T05:00:00.000Z';
const user = {
  id: 'customer-user',
  email: 'family@example.com',
  displayName: 'Ananya Rao',
  role: 'user',
  emailVerified: true,
};
const child = {
  id: 'child-1',
  userId: user.id,
  name: 'Ari',
  birthDate: '2021-05-17',
  interests: ['STEM'],
  avatarColor: '#7c5cff',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

interface ApiState {
  authenticated: boolean;
  hasChild: boolean;
  savedCalls: number;
  bookingCalls: number;
  bookings: Array<Record<string, unknown>>;
}

async function mockCustomerApis(page: Page, state: ApiState) {
  await page.route('**/api/auth/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path.endsWith('/auth/login')) {
      state.authenticated = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: '', user }) });
      return;
    }
    if (path.endsWith('/auth/me')) {
      await route.fulfill({
        status: state.authenticated ? 200 : 401,
        contentType: 'application/json',
        body: state.authenticated ? JSON.stringify(user) : JSON.stringify({ message: 'Unauthorized' }),
      });
      return;
    }
    if (path.endsWith('/auth/refresh')) {
      await route.fulfill({
        status: state.authenticated ? 200 : 401,
        contentType: 'application/json',
        body: state.authenticated ? JSON.stringify({ accessToken: '', user }) : '{}',
      });
      return;
    }
    if (path.endsWith('/customer/children')) {
      if (request.method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.hasChild ? [child] : []) });
      } else {
        state.hasChild = true;
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(child) });
      }
      return;
    }
    if (path.includes('/customer/saved-classes')) {
      if (request.method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      } else {
        state.savedCalls += 1;
        await route.fulfill({ status: request.method() === 'DELETE' ? 204 : 200, contentType: 'application/json', body: request.method() === 'DELETE' ? '' : JSON.stringify({ id: 'saved-1', userId: user.id, classRef: 'build-a-car', title: 'Build-a-Car STEM Workshop', createdAt: new Date().toISOString() }) });
      }
      return;
    }
    if (path.endsWith('/customer/bookings') && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.bookings) });
      return;
    }
    if (path.endsWith('/customer/bookings') && request.method() === 'POST') {
      state.bookingCalls += 1;
      const booking = {
        id: 'booking-1',
        userId: user.id,
        classRef: '11111111-1111-4111-8111-111111111111',
        classSlug: 'build-a-car',
        reservationId: 'reservation-1',
        title: 'Build-a-Car STEM Workshop',
        scheduledStart: occurrenceStart,
        amountMinor: 49900,
        currency: 'INR',
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.bookings = [booking];
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(booking) });
      return;
    }
    if (path.endsWith('/cancel')) {
      state.bookings = [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'cancelled' }) });
      return;
    }
    if (path.endsWith('/customer/notifications')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/scheduling/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const occurrence = { start: occurrenceStart, end: '2031-05-17T06:00:00.000Z', seatsTotal: 8, seatsAvailable: 6 };
    if (path.endsWith('/availability')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([occurrence]) });
      return;
    }
    if (path.includes('/classes/slug/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: '11111111-1111-4111-8111-111111111111' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/search/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hits: [] }) }));
}

test('anonymous customers are never given false save, booking, profile, or bookings success', async ({ page }) => {
  const state: ApiState = { authenticated: false, hasChild: false, savedCalls: 0, bookingCalls: 0, bookings: [] };
  await mockCustomerApis(page, state);
  await page.addInitScript(() => {
    localStorage.setItem('learn-together-booking', JSON.stringify({ title: 'Legacy fake booking' }));
    localStorage.setItem('learn-together-child-profile', JSON.stringify({ name: 'Legacy child' }));
    localStorage.setItem('learn-together-saved-build-a-car', 'true');
  });

  await page.goto('/classes/build-a-car');
  await expect(page.getByRole('button', { name: 'Book trial' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save class' }).click();
  await expect(page.getByRole('dialog', { name: 'SIGN IN TO SAVE' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Book trial' }).click();
  await expect(page.getByRole('dialog', { name: 'SIGN IN TO BOOK' })).toBeVisible();
  expect(state.savedCalls).toBe(0);
  expect(state.bookingCalls).toBe(0);

  await page.goto('/bookings');
  await expect(page.getByRole('heading', { name: 'Sign in to see your bookings' })).toBeVisible();
  await expect(page.getByText('Legacy fake booking')).toHaveCount(0);
  await page.goto('/children');
  await expect(page.getByRole('heading', { name: 'Sign in to manage child profiles' })).toBeVisible();
  await expect(page.getByText('Legacy child')).toHaveCount(0);
  await page.goto('/recommendations');
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to see saved classes' })).toBeVisible();
});

test('signed-in parents add a child and return to the interrupted booking flow', async ({ page }) => {
  const state: ApiState = { authenticated: true, hasChild: false, savedCalls: 0, bookingCalls: 0, bookings: [] };
  await mockCustomerApis(page, state);

  await page.goto('/classes/build-a-car');
  await expect(page.getByRole('button', { name: 'Book trial' })).toBeEnabled();
  await page.getByRole('button', { name: 'Book trial' }).click();
  const childGate = page.getByRole('dialog', { name: 'ONE QUICK STEP' });
  await expect(childGate).toBeVisible();
  await expect(childGate.getByRole('link', { name: 'Add child profile' })).toHaveAttribute('href', /children/);
  expect(state.bookingCalls).toBe(0);
  await childGate.getByRole('link', { name: 'Add child profile' }).click();
  await page.waitForURL('**/children?returnTo=*');
  await page.getByLabel('Name').fill('Ari');
  await page.getByRole('button', { name: 'STEM', exact: true }).click();
  await page.getByRole('button', { name: 'Save & continue booking' }).click();
  await page.waitForURL('**/classes/build-a-car');
  await page.getByRole('button', { name: 'Book trial' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Confirm trial booking' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: 'Save class' }).click();
  await expect(page.getByRole('button', { name: 'Remove saved class' })).toBeVisible();
  expect(state.savedCalls).toBe(1);
});

test('sign-in returns an anonymous customer to the interrupted class', async ({ page }) => {
  const state: ApiState = { authenticated: false, hasChild: true, savedCalls: 0, bookingCalls: 0, bookings: [] };
  await mockCustomerApis(page, state);

  await page.goto('/classes/build-a-car');
  await expect(page.getByRole('button', { name: 'Book trial' })).toBeEnabled();
  await page.getByRole('button', { name: 'Book trial' }).click();
  await page.getByRole('dialog', { name: 'SIGN IN TO BOOK' }).getByRole('link', { name: 'Sign in or create account' }).click();
  await page.waitForURL('**/profile?returnTo=*');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill('Secure-password-2026!');
  await page.getByRole('button', { name: 'Sign in & sync' }).click();
  await page.waitForURL('**/classes/build-a-car');
  await page.getByRole('button', { name: 'Book trial' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm trial booking' })).toBeVisible();
});

test('eligible customer can reserve, view, and deliberately cancel a booking', async ({ page }) => {
  const state: ApiState = { authenticated: true, hasChild: true, savedCalls: 0, bookingCalls: 0, bookings: [] };
  await mockCustomerApis(page, state);

  await page.goto('/classes/build-a-car');
  await expect(page.getByRole('button', { name: 'Book trial' })).toBeEnabled();
  await page.getByRole('button', { name: 'Book trial' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Confirm trial booking' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByText('payable at the venue')).toBeVisible();
  await confirmation.getByRole('button', { name: 'Reserve this spot' }).click();
  await expect(page.getByRole('dialog', { name: 'Booking confirmed' })).toBeVisible();
  expect(state.bookingCalls).toBe(1);

  await page.getByRole('link', { name: 'View my bookings' }).click();
  await page.waitForURL('**/bookings');
  await expect(page.locator('.status-pill', { hasText: 'CONFIRMED' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel booking' }).click();
  const cancelDialog = page.getByRole('dialog', { name: 'Cancel booking' });
  await expect(cancelDialog).toContainText('Release this class spot?');
  await cancelDialog.getByRole('button', { name: 'Yes, cancel booking' }).click();
  await expect(page.getByRole('heading', { name: 'No bookings yet' })).toBeVisible();
});
