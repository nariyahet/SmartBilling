// @ts-check
import { test, expect } from '@playwright/test';

test.describe('SmartBilling E2E - Authentication and Dashboard', () => {
  // Capture screenshot on failure
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const screenshotPath = `test-results/failure-${testInfo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Test failed. Screenshot saved to ${screenshotPath}`);
    }
  });

  test('should load login page, authenticate with Demo account, and display dashboard', async ({ page }) => {
    // Track any alert dialogs (such as login failure alerts)
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      console.log(`Alert dialog received: "${dialogMessage}"`);
      await dialog.dismiss();
    });

    // 1. Open the live SmartBilling web application
    await page.goto('https://smartbilling-sigma.vercel.app/');

    // 2. Check that the login page loads
    // Verify login heading and brand elements
    await expect(page.getByRole('heading', { name: /Smart Billing/i })).toBeVisible();
    await expect(page.getByText('Admin Login')).toBeVisible();

    // Verify form input fields and submit button using accessible locators
    const emailInput = page.getByPlaceholder('Enter your email');
    const passwordInput = page.getByPlaceholder('Enter your password');
    const loginButton = page.getByRole('button', { name: /Login/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();

    // 3. Log in using Demo test account credentials
    await emailInput.fill('demo@smartbilling.com');
    await passwordInput.fill('Demo@12345');
    await loginButton.click();

    // 4. Verify login succeeds and redirects to the Dashboard
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 35000 });
    expect(dialogMessage, `Unexpected login error dialog: "${dialogMessage}"`).toBe('');

    // 5. Verify that the Dashboard is visible after login
    // Check navigation item for Dashboard
    const dashboardNavLink = page.getByRole('link', { name: /Dashboard/i });
    await expect(dashboardNavLink).toBeVisible({ timeout: 20000 });

    // Check header search input
    await expect(
      page.getByPlaceholder('Search products, customers, invoices...')
    ).toBeVisible({ timeout: 20000 });

    // Check welcome subtitle on dashboard canvas
    await expect(
      page.getByText("Here's what's happening with your business today.")
    ).toBeVisible({ timeout: 20000 });

    // Check sidebar brand tagline
    await expect(page.getByText('Billing & ERP Suite')).toBeVisible();
  });
});
