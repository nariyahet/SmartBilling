import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5175';

test.describe('Login Redesign - Verification Suite', () => {
  test('1. Visual, structure, and accessibility checks', async ({ page }) => {
    await page.goto(BASE_URL);

    // Verify main brand heading
    const heading = page.getByRole('heading', { name: /Smart Billing/i });
    await expect(heading).toBeVisible();

    // Verify Admin Login subtitle and ERP badge
    await expect(page.getByText('Admin Login')).toBeVisible();
    await expect(page.getByText(/Plastic Recycling ERP/i)).toBeVisible();

    // Verify accessible inputs
    const emailInput = page.getByPlaceholder('Enter your email');
    const passwordInput = page.getByPlaceholder('Enter your password');
    const loginButton = page.getByRole('button', { name: /Login/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();

    // Verify labels and inputs are associated
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();

    // Verify password toggle control exists and is accessible
    const toggleBtn = page.getByRole('button', { name: /Show password|Hide password/i });
    await expect(toggleBtn).toBeVisible();

    // Verify Register link exists
    const registerLink = page.getByRole('link', { name: /Start 3-day free trial/i });
    await expect(registerLink).toBeVisible();
  });

  test('2. Password show/hide toggle functionality and value preservation', async ({ page }) => {
    await page.goto(BASE_URL);

    const passwordInput = page.getByPlaceholder('Enter your password');
    const toggleBtn = page.getByRole('button', { name: /Show password/i });

    // Initial state: password input is of type "password"
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Type a secret password
    const testSecret = 'SuperSecretPass123!';
    await passwordInput.fill(testSecret);

    // Click toggle to reveal
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(passwordInput).toHaveValue(testSecret);

    // Toggle button aria-label updates
    const hideBtn = page.getByRole('button', { name: /Hide password/i });
    await expect(hideBtn).toBeVisible();

    // Click toggle again to conceal
    await hideBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveValue(testSecret);
  });

  test('3. Client-side empty validation', async ({ page }) => {
    await page.goto(BASE_URL);

    const loginButton = page.getByRole('button', { name: /Login/i });
    const emailInput = page.getByPlaceholder('Enter your email');
    const passwordInput = page.getByPlaceholder('Enter your password');

    // HTML5 validation or error state check
    await loginButton.click();

    // The fields have 'required' attributes
    const emailValidationMessage = await emailInput.evaluate((el) => el.validationMessage);
    expect(emailValidationMessage.length).toBeGreaterThan(0);
  });

  test('4. Authentication error state banner display', async ({ page }) => {
    await page.goto(BASE_URL);

    const emailInput = page.getByPlaceholder('Enter your email');
    const passwordInput = page.getByPlaceholder('Enter your password');
    const loginButton = page.getByRole('button', { name: /Login/i });

    await emailInput.fill('invalid-user@example.com');
    await passwordInput.fill('WrongPassword123!');
    await loginButton.click();

    // Error banner should appear
    const errorBanner = page.locator('.sb-login-error');
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
    const errorText = await errorBanner.textContent();
    expect(errorText).toBeTruthy();
  });

  test('5. Enter key submission works', async ({ page }) => {
    await page.goto(BASE_URL);

    const emailInput = page.getByPlaceholder('Enter your email');
    const passwordInput = page.getByPlaceholder('Enter your password');

    await emailInput.fill('invalid-user@example.com');
    await passwordInput.fill('WrongPassword123!');
    await passwordInput.press('Enter');

    // Form submitted on Enter
    const errorBanner = page.locator('.sb-login-error');
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
  });

  test('6. Register link navigation', async ({ page }) => {
    await page.goto(BASE_URL);

    const registerLink = page.getByRole('link', { name: /Start 3-day free trial/i });
    await registerLink.click();

    await expect(page).toHaveURL(/.*\/register/, { timeout: 10000 });
    await expect(page.getByText('Create your business account')).toBeVisible();
  });

  test('7. Valid account login succeeds, stores session, and redirects to dashboard', async ({ page }) => {
    // Intercept login API to simulate valid auth response
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: 'mock-valid-jwt-token',
            admin: {
              id: 1,
              name: 'Demo Admin',
              email: 'demo@smartbilling.com',
              company_id: 1,
            },
            company: {
              id: 1,
              name: 'SmartBilling Demo Corp',
              subscription_status: 'active',
              is_demo: 1,
            },
          },
        }),
      });
    });

    await page.goto(BASE_URL);

    const emailInput = page.getByPlaceholder('Enter your email');
    const passwordInput = page.getByPlaceholder('Enter your password');
    const loginButton = page.getByRole('button', { name: /Login/i });

    await emailInput.fill('demo@smartbilling.com');
    await passwordInput.fill('Demo@12345');
    await loginButton.click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

    // Verify localStorage has token, admin, and company stored
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const admin = await page.evaluate(() => localStorage.getItem('admin'));
    const company = await page.evaluate(() => localStorage.getItem('company'));

    expect(token).toBe('mock-valid-jwt-token');
    expect(admin).toContain('Demo Admin');
    expect(company).toContain('SmartBilling Demo Corp');
  });

  // Responsive layout verification at all requested viewports
  const viewports = [
    { name: 'Desktop Ultra-Wide', width: 1670, height: 1000 },
    { name: 'Desktop Standard', width: 1440, height: 900 },
    { name: 'Desktop Medium', width: 1200, height: 800 },
    { name: 'Desktop Small', width: 1024, height: 768 },
    { name: 'Tablet Wide', width: 947, height: 700 },
    { name: 'Tablet Medium', width: 900, height: 700 },
    { name: 'Tablet Small', width: 768, height: 1024 },
    { name: 'Mobile Large', width: 430, height: 932 },
    { name: 'Mobile Medium', width: 390, height: 844 },
    { name: 'Mobile Standard', width: 375, height: 667 },
  ];

  for (const vp of viewports) {
    test(`Responsive Check - ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(BASE_URL);

      // Verify no horizontal scrolling on the page
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Horizontal scroll detected at ${vp.width}px`).toBe(false);

      // Verify login card is visible and fits within viewport
      const card = page.locator('.sb-login-card');
      await expect(card).toBeVisible();

      const cardBox = await card.boundingBox();
      expect(cardBox).not.toBeNull();
      if (cardBox) {
        expect(cardBox.width).toBeLessThanOrEqual(vp.width);
        expect(cardBox.x).toBeGreaterThanOrEqual(0);
      }

      // Verify form elements are all visible and interactive
      await expect(page.getByRole('heading', { name: /Smart Billing/i })).toBeVisible();
      await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
      await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
      await expect(page.getByRole('button', { name: /Login/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /Start 3-day free trial/i })).toBeVisible();
    });
  }
});
