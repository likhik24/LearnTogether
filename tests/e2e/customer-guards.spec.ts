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
  reviews?: Array<Record<string, unknown>>;
  discoveryUrls?: string[];
  lastBookingBody?: Record<string, unknown>;
}

async function mockCustomerApis(page: Page, state: ApiState) {
  await page.route('**/api/auth/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path.endsWith('/auth/login')) {
      state.authenticated = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: '', user }),
      });
      return;
    }
    if (path.endsWith('/auth/me')) {
      await route.fulfill({
        status: state.authenticated ? 200 : 401,
        contentType: 'application/json',
        body: state.authenticated
          ? JSON.stringify(user)
          : JSON.stringify({ message: 'Unauthorized' }),
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
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(state.hasChild ? [child] : []),
        });
      } else {
        state.hasChild = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(child),
        });
      }
      return;
    }
    if (path.includes('/customer/saved-classes')) {
      if (request.method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      } else {
        state.savedCalls += 1;
        await route.fulfill({
          status: request.method() === 'DELETE' ? 204 : 200,
          contentType: 'application/json',
          body:
            request.method() === 'DELETE'
              ? ''
              : JSON.stringify({
                  id: 'saved-1',
                  userId: user.id,
                  classRef: 'build-a-car',
                  title: 'Build-a-Car STEM Workshop',
                  createdAt: new Date().toISOString(),
                }),
        });
      }
      return;
    }
    if (path.endsWith('/customer/bookings') && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.bookings),
      });
      return;
    }
    if (path.endsWith('/customer/reviews') && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.reviews ?? []),
      });
      return;
    }
    if (path.includes('/customer/reviews/bookings/') && request.method() === 'POST') {
      const input = request.postDataJSON() as { rating: number; comment?: string };
      const review = {
        id: 'review-1',
        bookingId: path.split('/').at(-1),
        classId: '11111111-1111-4111-8111-111111111111',
        userId: user.id,
        parentName: user.displayName,
        rating: input.rating,
        comment: input.comment ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.reviews = [review];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(review),
      });
      return;
    }
    if (path.endsWith('/customer/bookings') && request.method() === 'POST') {
      state.bookingCalls += 1;
      state.lastBookingBody = request.postDataJSON() as Record<string, unknown>;
      const booking = {
        id: 'booking-1',
        userId: user.id,
        classRef: '11111111-1111-4111-8111-111111111111',
        classSlug: 'build-a-car',
        reservationId: 'reservation-1',
        childId: child.id,
        childName: child.name,
        title: 'Build-a-Car STEM Workshop',
        scheduledStart: occurrenceStart,
        amountMinor: 49900,
        currency: 'INR',
        status: 'pending_payment',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state.bookings = [booking];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(booking),
      });
      return;
    }
    if (path.endsWith('/cancel')) {
      state.bookings = [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      return;
    }
    if (path.endsWith('/customer/notifications')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/scheduling/**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname;
    if (path.endsWith('/classes/discover')) state.discoveryUrls?.push(requestUrl.toString());
    const occurrence = {
      start: occurrenceStart,
      end: '2031-05-17T06:00:00.000Z',
      seatsTotal: 8,
      seatsAvailable: 6,
    };
    const secondOccurrence = {
      start: '2031-05-24T05:00:00.000Z',
      end: '2031-05-24T06:00:00.000Z',
      seatsTotal: 8,
      seatsAvailable: 4,
    };
    if (path.endsWith('/availability')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([occurrence, secondOccurrence]),
      });
      return;
    }
    if (path.includes('/classes/slug/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', ageMin: 4, ageMax: 12 }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/search/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hits: [] }),
    }),
  );

  await page.route('**/api/payments/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/payments/ready')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ready: true, provider: 'mock' }) });
      return;
    }
    if (path.endsWith('/payments/intents')) {
      const bookingId = (request.postDataJSON() as { bookingId: string }).bookingId;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        payment: { id: 'payment-1', userId: user.id, bookingId, classId: '11111111-1111-4111-8111-111111111111', amountMinor: 49900, currency: 'INR', status: 'pending', provider: 'mock', providerRef: null, providerOrderId: `order_mock_${bookingId}`, failureReason: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        publicKey: 'mock_key', providerOrderId: `order_mock_${bookingId}`,
      }) });
      return;
    }
    if (path.endsWith('/verify')) {
      state.bookings = state.bookings.map((booking) => ({ ...booking, status: 'confirmed' }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'payment-1', status: 'succeeded' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  });
}

test('anonymous customers are never given false save, booking, profile, or bookings success', async ({
  page,
}) => {
  const state: ApiState = {
    authenticated: false,
    hasChild: false,
    savedCalls: 0,
    bookingCalls: 0,
    bookings: [],
  };
  await mockCustomerApis(page, state);
  await page.addInitScript(() => {
    localStorage.setItem(
      'learn-together-booking',
      JSON.stringify({ title: 'Legacy fake booking' }),
    );
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
  await expect(
    page.getByRole('heading', { name: 'Sign in to manage child profiles' }),
  ).toBeVisible();
  await expect(page.getByText('Legacy child')).toHaveCount(0);
  await page.goto('/recommendations');
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to see saved classes' })).toBeVisible();
});

test('discovery starts broad and only applies coordinates after a customer chooses an area', async ({
  page,
}) => {
  const state: ApiState = {
    authenticated: false,
    hasChild: false,
    savedCalls: 0,
    bookingCalls: 0,
    bookings: [],
    discoveryUrls: [],
  };
  await mockCustomerApis(page, state);
  await page.goto('/discover');
  await expect
    .poll(() =>
      state.discoveryUrls?.some((url) => {
        const params = new URL(url).searchParams;
        return !params.has('lat') && !params.has('lng') && !params.has('radius');
      }),
    )
    .toBe(true);
  await expect(page.getByRole('button', { name: 'Nearby' })).toBeDisabled();

  await page.getByRole('button', { name: 'Change location' }).click();
  await page.getByRole('button', { name: /Gachibowli, Hyderabad/ }).click();
  await expect
    .poll(() =>
      state.discoveryUrls?.some(
        (url) =>
          url.includes('lat=17.4401') &&
          url.includes('lng=78.3489') &&
          url.includes('radius=25000'),
      ),
    )
    .toBe(true);
  await expect(page.getByRole('button', { name: 'Nearby' })).toBeEnabled();

  await page.getByRole('button', { name: 'Change location' }).click();
  await page.getByRole('button', { name: /All locations/ }).click();
  await expect
    .poll(() => {
      const latest = state.discoveryUrls?.at(-1);
      if (!latest) return false;
      const params = new URL(latest).searchParams;
      return !params.has('lat') && !params.has('lng') && !params.has('radius');
    })
    .toBe(true);
});

test('signed-in parents add a child and return to the interrupted booking flow', async ({
  page,
}) => {
  const state: ApiState = {
    authenticated: true,
    hasChild: false,
    savedCalls: 0,
    bookingCalls: 0,
    bookings: [],
  };
  await mockCustomerApis(page, state);

  await page.goto('/classes/build-a-car');
  await expect(page.getByRole('button', { name: 'Book trial' })).toBeEnabled();
  await page.getByRole('button', { name: 'Book trial' }).click();
  const childGate = page.getByRole('dialog', { name: 'ONE QUICK STEP' });
  await expect(childGate).toBeVisible();
  await expect(childGate.getByRole('link', { name: 'Add child profile' })).toHaveAttribute(
    'href',
    /children/,
  );
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

test('a parent can publish and edit only a verified completed-booking review', async ({ page }) => {
  const pastStart = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
  const state: ApiState = {
    authenticated: true,
    hasChild: true,
    savedCalls: 0,
    bookingCalls: 0,
    reviews: [],
    bookings: [
      {
        id: 'booking-past',
        userId: user.id,
        classRef: '11111111-1111-4111-8111-111111111111',
        classSlug: 'build-a-car',
        reservationId: 'reservation-past',
        childId: child.id,
        childName: child.name,
        title: 'Build-a-Car STEM Workshop',
        scheduledStart: pastStart,
        amountMinor: 49900,
        currency: 'INR',
        status: 'confirmed',
        attendanceStatus: 'present',
        attendanceNotes: null,
        createdAt: pastStart,
        updatedAt: pastStart,
      },
    ],
  };
  await mockCustomerApis(page, state);

  await page.goto('/bookings');
  await expect(page.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Review class' }).click();
  const dialog = page.getByRole('dialog', { name: 'Review class' });
  await dialog.getByRole('button', { name: '4 stars' }).click();
  await dialog.getByPlaceholder('What did your child enjoy?').fill('Patient teacher and a great project.');
  await dialog.getByRole('button', { name: 'Publish verified review' }).click();

  await expect(page.getByRole('button', { name: 'Edit 4-star review' })).toBeVisible();
  expect(state.reviews?.[0]).toEqual(
    expect.objectContaining({ rating: 4, comment: 'Patient teacher and a great project.' }),
  );
});

test('sign-in returns an anonymous customer to the interrupted class', async ({ page }) => {
  const state: ApiState = {
    authenticated: false,
    hasChild: true,
    savedCalls: 0,
    bookingCalls: 0,
    bookings: [],
  };
  await mockCustomerApis(page, state);

  await page.goto('/classes/build-a-car');
  await expect(page.getByRole('button', { name: 'Book trial' })).toBeEnabled();
  await page.getByRole('button', { name: 'Book trial' }).click();
  await page
    .getByRole('dialog', { name: 'SIGN IN TO BOOK' })
    .getByRole('link', { name: 'Sign in or create account' })
    .click();
  await page.waitForURL('**/profile?returnTo=*');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill('Secure-password-2026!');
  await page.getByRole('button', { name: 'Sign in & sync' }).click();
  await page.waitForURL('**/classes/build-a-car');
  await page.getByRole('button', { name: 'Book trial' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirm trial booking' })).toBeVisible();
});

test('eligible customer can reserve, view, and deliberately cancel a booking', async ({ page }) => {
  const state: ApiState = {
    authenticated: true,
    hasChild: true,
    savedCalls: 0,
    bookingCalls: 0,
    bookings: [],
  };
  await mockCustomerApis(page, state);

  await page.goto('/classes/build-a-car');
  await expect(page.getByRole('button', { name: 'Book trial' })).toBeEnabled();
  await page.getByRole('button', { name: 'Book trial' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Confirm trial booking' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByText('Secure online checkout')).toBeVisible();
  await confirmation.getByRole('button', { name: 'Pay ₹499 & reserve for Ari' }).click();
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

test('customer can choose a later occurrence and the booking keeps child and time context', async ({
  page,
}) => {
  const state: ApiState = {
    authenticated: true,
    hasChild: true,
    savedCalls: 0,
    bookingCalls: 0,
    bookings: [],
  };
  await mockCustomerApis(page, state);
  await page.goto('/classes/build-a-car');
  await page.getByRole('button', { name: 'Book trial' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Confirm trial booking' });
  await confirmation.getByRole('button', { name: /Sat, 24 May/ }).click();
  await confirmation.getByRole('button', { name: 'Pay ₹499 & reserve for Ari' }).click();
  await expect(page.getByRole('dialog', { name: 'Booking confirmed' })).toBeVisible();
  expect(state.lastBookingBody).toMatchObject({
    childId: child.id,
    scheduledStart: '2031-05-24T05:00:00.000Z',
  });
});
