// @ts-check
import { test, expect } from '@playwright/test';

test.describe('SmartBilling 2.0 - Cash & Bank Transaction Lifecycle E2E Regression', () => {
  let dialogMessages = [];

  test.beforeEach(async ({ page, request }) => {
    dialogMessages = [];

    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Obtain authentic session token from API
    const loginRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'demo@smartbilling.com', password: 'Demo@12345' },
    });
    const loginData = await loginRes.json();
    const token = loginData.data?.token || '';
    const admin = loginData.data?.admin || { id: 4, name: 'Demo Admin', email: 'demo@smartbilling.com', company_id: 1 };
    const company = loginData.data?.company || { id: 1, name: 'Demo Company' };

    await page.goto('http://localhost:5173/');
    await page.evaluate(
      ({ token, admin, company }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('admin', JSON.stringify(admin));
        localStorage.setItem('company', JSON.stringify(company));
      },
      { token, admin, company }
    );
  });

  test('Primary Bug Verification: Cash & Bank -> Add Bank Account -> Create Account succeeds without "conn.beginTransaction is not a function"', async ({ page }) => {
    await page.goto('http://localhost:5173/plastic-erp/cash-bank');
    await expect(page.locator('h1')).toContainText(/Cash & Bank/i, { timeout: 15000 });

    // Click "Add Bank Account" button
    const addAccountBtn = page.getByRole('button', { name: /Add Bank Account/i });
    await expect(addAccountBtn).toBeVisible({ timeout: 10000 });
    await addAccountBtn.click();

    // Verify modal appears
    await expect(page.locator('.cb-modal-form')).toBeVisible({ timeout: 5000 });

    const uniqueAccNo = 'REG-' + Date.now();
    const uniqueAccName = 'Regression Account ' + Date.now();

    // Fill form
    await page.fill('input[placeholder*="HDFC Bank Ltd"]', 'State Bank of India');
    await page.fill('input[placeholder*="Factory Current Account"]', uniqueAccName);
    await page.fill('input[placeholder*="50200012345678"]', uniqueAccNo);
    await page.fill('input[placeholder*="HDFC0001234"]', 'SBIN0001234');
    await page.fill('input[placeholder*="Kim GIDC"]', 'Industrial Estate');
    await page.fill('input[type="number"]', '1000');

    // Click "Create Account" and wait for API response
    const submitBtn = page.getByRole('button', { name: 'Create Account' });
    await expect(submitBtn).toBeVisible();

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('cash-bank/accounts') && response.request().method() === 'POST'
    );
    await submitBtn.click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);

    // CRITICAL ASSERTIONS:
    // 1. No "conn.beginTransaction is not a function" error dialog!
    for (const msg of dialogMessages) {
      expect(msg).not.toContain('conn.beginTransaction is not a function');
      expect(msg).not.toContain('Failed to create account');
    }

    // 2. Modal closed
    await expect(page.locator('.cb-modal-form')).not.toBeVisible({ timeout: 10000 });

    // 3. Verify new account appears in the UI
    await expect(page.locator('h4.bank-card-name', { hasText: uniqueAccName })).toBeVisible({ timeout: 10000 });
  });
});
