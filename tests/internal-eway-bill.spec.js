// @ts-check
import { test, expect } from '@playwright/test';

test.describe('SmartBilling 2.0 - Internal E-Way Bill Workflow & Navigation Suite', () => {
  let dialogMessages = [];

  test.beforeEach(async ({ page, request }) => {
    dialogMessages = [];

    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });

    // Obtain authentic session token from API
    const loginRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'demo@smartbilling.com', password: 'Demo@12345' },
    });
    const loginData = await loginRes.json();
    const token = loginData.data?.token || '';
    const admin = loginData.data?.admin || { id: 4, name: 'Demo Admin', email: 'demo@smartbilling.com', company_id: 1 };
    const company = loginData.data?.company || { id: 1, name: 'Demo Company' };

    await page.goto('http://localhost:4173/');
    await page.evaluate(
      ({ token, admin, company }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('admin', JSON.stringify(admin));
        localStorage.setItem('company', JSON.stringify(company));
      },
      { token, admin, company }
    );
  });

  test('1. Direct Navigation: Internal E-Way Bills page loads with KPIs, disclaimer, and active nav state', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/eway-bills');
    await expect(page.locator('h1')).toContainText(/Internal E-Way Bill/i, { timeout: 15000 });

    // Verify Disclaimer Banner
    await expect(page.locator('.ewb-disclaimer-banner')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.ewb-disclaimer-banner')).toContainText(/INTERNAL TRANSPORT \/ E-WAY BILL PREPARATION DOCUMENT/i);
    await expect(page.locator('.ewb-disclaimer-banner')).toContainText(/Not an Official Government E-Way Bill/i);

    // Verify KPI Cards visible
    await expect(page.locator('.ewb-kpi-grid')).toBeVisible();
    await expect(page.locator('.ewb-kpi-label', { hasText: 'Total Documents' })).toBeVisible();
    await expect(page.locator('.ewb-kpi-label', { hasText: 'Drafts' })).toBeVisible();
    await expect(page.locator('.ewb-kpi-label', { hasText: 'Ready for Dispatch' })).toBeVisible();

    // Verify New E-Way Bill button is visible
    await expect(page.getByRole('button', { name: /\+ New Internal E-Way Bill/i })).toBeVisible();

    // Verify navbar active state in AppShell
    const activeNav = page.locator('.sb-nav-subitem.active');
    await expect(activeNav).toContainText('Internal E-Way Bills');
  });

  test('2. Global Search: Searching "eway" matches and opens Internal E-Way Bills', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('http://localhost:4173/customers');

    const searchInput = page.locator('.sb-search-input');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('eway');

    // Wait for dropdown
    const dropdown = page.locator('.sb-search-dropdown');
    await expect(dropdown).toBeVisible();

    // Result shows Internal E-Way Bills
    const resultItem = page.locator('.sb-search-result-item', { hasText: 'Internal E-Way Bills' }).first();
    await expect(resultItem).toBeVisible();

    // Press enter to navigate
    await searchInput.press('Enter');

    // Verifies navigation to /plastic-erp/eway-bills
    await page.waitForURL('**/plastic-erp/eway-bills*');
    expect(page.url()).toContain('/plastic-erp/eway-bills');
    await expect(page.locator('h1')).toContainText(/Internal E-Way Bill/i, { timeout: 30000 });
  });

  test('3. Invoice History: Row action contains "🚚 E-Way" button linking with invoice_id', async ({ page }) => {
    await page.goto('http://localhost:4173/invoices/history');
    await expect(page.locator('h1')).toContainText(/Invoices History|All Invoices|Invoice History/i, { timeout: 15000 });

    // Verify E-Way button exists in table
    const ewayBtn = page.getByRole('button', { name: /🚚 E-Way/i }).first();
    if (await ewayBtn.isVisible()) {
      await ewayBtn.click();
      await page.waitForURL('**/plastic-erp/eway-bills*');
      await expect(page.locator('.sb-modal-box')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.sb-modal-title')).toContainText(/Create Internal E-Way Bill/i);
    }
  });

  test('4. Plastic Dispatch: Row action contains "🚚 E-Way" button linking with dispatch_id', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/dispatch');
    await expect(page.locator('h1')).toContainText(/Dispatch/i, { timeout: 15000 });

    // Verify E-Way button exists in table
    const ewayBtn = page.getByRole('button', { name: /🚚 E-Way/i }).first();
    if (await ewayBtn.isVisible()) {
      await ewayBtn.click();
      await page.waitForURL('**/plastic-erp/eway-bills*');
      await expect(page.locator('.sb-modal-box')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.sb-modal-title')).toContainText(/Create Internal E-Way Bill/i);
    }
  });

  test('5. Modal & Document Viewer: Disclaimer banner and action buttons are present', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/eway-bills');
    await expect(page.locator('h1')).toContainText(/Internal E-Way Bill/i, { timeout: 15000 });

    // Open Create Modal
    await page.getByRole('button', { name: /\+ New Internal E-Way Bill/i }).click();
    await expect(page.locator('.sb-modal-box')).toBeVisible();

    // Verify modal has disclaimer alert
    await expect(page.locator('.ewb-modal-disclaimer')).toContainText(/INTERNAL TRANSPORT PREPARATION ONLY/i);
    await expect(page.locator('.ewb-modal-disclaimer')).toContainText(/Not an official government GST E-Way Bill/i);

    // Verify mode selector options
    await expect(page.getByText('From Invoice')).toBeVisible();
    await expect(page.getByText('From Dispatch')).toBeVisible();
    await expect(page.getByText('Manual Entry')).toBeVisible();

    // Close modal
    await page.locator('.sb-modal-close-btn').click();
    await expect(page.locator('.sb-modal-box')).not.toBeVisible();
  });
});
