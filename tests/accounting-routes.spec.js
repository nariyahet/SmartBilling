// @ts-check
import { test, expect } from '@playwright/test';

test.describe('SmartBilling 2.0 Accounting & GST Routing Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4173/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-token-123');
      localStorage.setItem('admin', JSON.stringify({ name: 'Demo Admin', email: 'demo@smartbilling.com' }));
      localStorage.setItem('company', JSON.stringify({ name: 'Demo Company' }));
    });
  });

  test('Direct navigation: 1. GST Management opens without "Route Not Found"', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/gst-management');
    await expect(page.locator('.sb-header-page-title')).toHaveText('GST Management');
    await expect(page.getByText('Route Not Found')).not.toBeVisible();
    await expect(page.locator('h1')).toContainText(/GST/i);

    // Verify navbar active state
    const activeSubitem = page.locator('.sb-nav-subitem.active');
    await expect(activeSubitem).toContainText('GST Management');
  });

  test('Direct navigation: 2. GST Reconciliation opens without "Route Not Found"', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/gst-reconciliation');
    await expect(page.locator('.sb-header-page-title')).toHaveText('GST Reconciliation');
    await expect(page.getByText('Route Not Found')).not.toBeVisible();
    await expect(page.locator('h1')).toContainText(/Reconciliation/i);

    // Verify navbar active state
    const activeSubitem = page.locator('.sb-nav-subitem.active');
    await expect(activeSubitem).toContainText('GST Reconciliation');
  });

  test('Direct navigation: 3. Accounting Dashboard opens without "Route Not Found"', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/accounting-dashboard');
    await expect(page.locator('.sb-header-page-title')).toHaveText('Accounting Dashboard');
    await expect(page.getByText('Route Not Found')).not.toBeVisible();
    await expect(page.locator('h1')).toContainText(/Accounting/i);

    // Verify navbar active state
    const activeSubitem = page.locator('.sb-nav-subitem.active');
    await expect(activeSubitem).toContainText('Accounting Dashboard');
  });

  test('Direct navigation: 4. Supplier Ledger opens without "Route Not Found"', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/supplier-ledger');
    await expect(page.locator('.sb-header-page-title')).toHaveText('Supplier Ledger');
    await expect(page.getByText('Route Not Found')).not.toBeVisible();
    await expect(page.locator('h1')).toContainText(/Supplier Ledger/i);

    // Verify navbar active state
    const activeSubitem = page.locator('.sb-nav-subitem.active');
    await expect(activeSubitem).toContainText('Supplier Ledger');
  });

  test('Navbar click navigation: All 4 routes can be opened via sidebar clicks', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('http://localhost:4173/dashboard');

    // Click Accounting & GST accordion in sidebar
    const accountingGroupBtn = page.getByRole('button', { name: /Accounting & GST/i });
    await accountingGroupBtn.click();

    // 1. Click GST Management
    await page.getByRole('link', { name: /GST Management/i }).click();
    await expect(page).toHaveURL(/.*\/plastic-erp\/gst-management/);
    await expect(page.locator('.sb-header-page-title')).toHaveText('GST Management');
    await expect(page.getByText('Route Not Found')).not.toBeVisible();

    // 2. Click GST Reconciliation
    await page.getByRole('link', { name: /GST Reconciliation/i }).click();
    await expect(page).toHaveURL(/.*\/plastic-erp\/gst-reconciliation/);
    await expect(page.locator('.sb-header-page-title')).toHaveText('GST Reconciliation');
    await expect(page.getByText('Route Not Found')).not.toBeVisible();

    // 3. Click Accounting Dashboard
    await page.getByRole('link', { name: /Accounting Dashboard/i }).click();
    await expect(page).toHaveURL(/.*\/plastic-erp\/accounting-dashboard/);
    await expect(page.locator('.sb-header-page-title')).toHaveText('Accounting Dashboard');
    await expect(page.getByText('Route Not Found')).not.toBeVisible();

    // 4. Click Supplier Ledger
    await page.getByRole('link', { name: /Supplier Ledger/i }).click();
    await expect(page).toHaveURL(/.*\/plastic-erp\/supplier-ledger/);
    await expect(page.locator('.sb-header-page-title')).toHaveText('Supplier Ledger');
    await expect(page.getByText('Route Not Found')).not.toBeVisible();
  });

  test('Preservation check: Reports & Analytics routes remain distinct without collisions', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/payment-reports');
    await expect(page.locator('.sb-nav-subitem.active')).toHaveText(/Payment Reports/i);

    await page.goto('http://localhost:4173/plastic-erp/financial-reports');
    await expect(page.locator('.sb-nav-subitem.active')).toHaveText(/Financial Reports/i);

    await page.goto('http://localhost:4173/plastic-erp/customer-ledger-reports');
    await expect(page.locator('.sb-nav-subitem.active')).toHaveText(/Customer Ledger Reports/i);
  });
});
