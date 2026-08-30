import { expect, test } from '@playwright/test';

const provider = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'provider@example.com',
  displayName: 'Meera Shah',
  role: 'teacher',
  provider: 'google',
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

test('provider UI hydrates a secure cookie session after social sign-in', async ({ page }) => {
  await page.route('**/api/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(provider) });
      return;
    }
    if (path.endsWith('/auth/oidc/providers')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/teacher/**', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
  );

  await page.goto('/provider');
  await expect(page.getByRole('heading', { name: 'Welcome, Meera Shah.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save provider profile' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
});
