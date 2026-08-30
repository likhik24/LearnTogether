import { expect, test } from '@playwright/test';

const user = {
  id: 'browser-auth-user',
  email: 'family@example.com',
  displayName: 'Ananya Rao',
  role: 'user',
  emailVerified: false,
};

test('anonymous identity and register, logout, login, and reload session flow', async ({
  page,
}) => {
  let authenticated = false;

  await page.route('**/api/auth/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path.endsWith('/auth/register')) {
      const body = request.postDataJSON() as { email: string; displayName: string };
      expect(body).toMatchObject({ email: user.email, displayName: user.displayName });
      authenticated = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: '', user }),
      });
      return;
    }
    if (path.endsWith('/auth/login')) {
      const body = request.postDataJSON() as { email: string; password: string };
      expect(body.email).toBe(user.email);
      if (body.password === 'incorrect-password') {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ statusCode: 401, message: 'Invalid credentials' }),
        });
        return;
      }
      authenticated = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: '', user }),
      });
      return;
    }
    if (path.endsWith('/auth/logout')) {
      authenticated = false;
      await route.fulfill({ status: 204 });
      return;
    }
    if (path.endsWith('/auth/me')) {
      await route.fulfill(
        authenticated
          ? { status: 200, contentType: 'application/json', body: JSON.stringify(user) }
          : {
              status: 401,
              contentType: 'application/json',
              body: JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
            },
      );
      return;
    }
    if (path.endsWith('/auth/refresh')) {
      await route.fulfill({
        status: authenticated ? 200 : 401,
        contentType: 'application/json',
        body: authenticated ? JSON.stringify({ accessToken: '', user }) : '{}',
      });
      return;
    }
    if (path.endsWith('/customer/notifications')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/scheduling/classes/discover**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  await page.goto('/');
  await expect(page.getByText(/Priya/i)).toHaveCount(0);
  await expect(page.locator('.app-header .eyebrow')).not.toContainText(',');
  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.getByText('Sign in to see booking and profile updates.')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Your name').fill(`  ${user.displayName}  `);
  await page.getByLabel('Email').fill(`  ${user.email.toUpperCase()}  `);
  await page.getByLabel('Password').fill('Secure-password-2026!');
  await page.getByRole('button', { name: 'Create account & sync' }).click();
  await expect(page.getByText('API CONNECTED')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email').fill(user.email.toUpperCase());
  await page.getByLabel('Password').fill('Secure-password-2026!');
  await page.getByRole('button', { name: 'Sign in & sync' }).click();
  await expect(
    page.getByRole('heading', { name: `Hi ${user.displayName}, everything’s in sync.` }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByText('API CONNECTED')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill('incorrect-password');
  await page.getByRole('button', { name: 'Sign in & sync' }).click();
  await expect(page.getByText('Email or password is incorrect.')).toBeVisible();
});
