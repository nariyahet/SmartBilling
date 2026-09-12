// @ts-check
import { test, expect } from '@playwright/test';

test.describe('SmartBilling 2.0 Global Search Bar Navigation & Robust Matching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4173/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-test-token-123');
      localStorage.setItem('admin', JSON.stringify({ name: 'Demo Admin', email: 'demo@smartbilling.com' }));
      localStorage.setItem('company', JSON.stringify({ name: 'Demo Company' }));
    });
  });

  // Helper to test search input, dropdown visibility, Enter navigation, and destination assertion
  async function testSearchEnter(page, query, expectedPath, expectedHeadingPattern) {
    await page.goto('http://localhost:4173/dashboard');
    const searchInput = page.locator('.sb-search-input');
    await expect(searchInput).toBeVisible();

    await searchInput.fill(query);
    // Wait for dropdown
    const dropdown = page.locator('.sb-search-dropdown');
    await expect(dropdown).toBeVisible();

    // Verify first result has "is-selected" class
    const firstItem = page.locator('.sb-search-result-item').first();
    await expect(firstItem).toBeVisible();

    // Press Enter to navigate
    await searchInput.press('Enter');

    // Verify URL
    await page.waitForURL(`**${expectedPath}*`);
    expect(page.url()).toContain(expectedPath);

    // Verify page content
    if (expectedHeadingPattern) {
      await expect(page.locator('h1')).toContainText(expectedHeadingPattern);
    }
  }

  test('1. "payments" navigates to Payments page and NEVER to Products or Finished Goods', async ({ page }) => {
    await page.goto('http://localhost:4173/dashboard');
    const searchInput = page.locator('.sb-search-input');
    await searchInput.fill('payments');

    const dropdown = page.locator('.sb-search-dropdown');
    await expect(dropdown).toBeVisible();

    // First item must be Payments
    const firstItem = page.locator('.sb-search-result-item').first();
    await expect(firstItem).toContainText('Payments');
    await expect(firstItem).toContainText('Sales & Dispatch');

    // Critical assertion: First item must NOT be Products or Finished Goods
    await expect(firstItem).not.toContainText('WIP & Finished Goods');
    await expect(firstItem).not.toContainText('Products');

    // Press Enter
    await searchInput.press('Enter');
    await page.waitForURL('**/plastic-erp/payments');
    expect(page.url()).toContain('/plastic-erp/payments');
    expect(page.url()).not.toContain('/products');
    expect(page.url()).not.toContain('/wip-fg');
  });

  test('2. Singular "payment" also navigates to Payments page', async ({ page }) => {
    await testSearchEnter(page, 'payment', '/plastic-erp/payments', /Payment/i);
  });

  test('3. "products" and "product" navigate to Products page', async ({ page }) => {
    await testSearchEnter(page, 'products', '/products', /Product/i);
    await testSearchEnter(page, 'product', '/products', /Product/i);
  });

  test('4. "finished goods" and "finished" navigate to WIP & Finished Goods page', async ({ page }) => {
    await testSearchEnter(page, 'finished goods', '/plastic-erp/wip-fg', /Finished Goods/i);
    await testSearchEnter(page, 'finished', '/plastic-erp/wip-fg', /Finished Goods/i);
  });

  test('5. "procurement" navigates to Procurement Dashboard', async ({ page }) => {
    await testSearchEnter(page, 'procurement', '/plastic-erp/procurement-dashboard', /Procurement/i);
  });

  test('6. "production" navigates to Production Management', async ({ page }) => {
    await testSearchEnter(page, 'production', '/plastic-erp/production', /Production/i);
  });

  test('7. "sales" navigates to Sales Orders and "dispatch" navigates to Dispatch', async ({ page }) => {
    await testSearchEnter(page, 'sales', '/plastic-erp/sales-orders', /Sales/i);
    await testSearchEnter(page, 'dispatch', '/plastic-erp/dispatch', /Dispatch/i);
  });

  test('8. "customers" and "customer" navigate to Customers page', async ({ page }) => {
    await testSearchEnter(page, 'customers', '/customers', /Customer/i);
    await testSearchEnter(page, 'customer', '/customers', /Customer/i);
  });

  test('9. "invoices" and "invoice" navigate to Invoices History', async ({ page }) => {
    await testSearchEnter(page, 'invoices', '/invoices/history', /Invoice/i);
    await testSearchEnter(page, 'invoice', '/invoices/history', /Invoice/i);
  });

  test('10. "accounting" navigates to Accounting Dashboard', async ({ page }) => {
    await testSearchEnter(page, 'accounting', '/plastic-erp/accounting-dashboard', /Accounting/i);
  });

  test('11. "gst" navigates to GST Management', async ({ page }) => {
    await testSearchEnter(page, 'gst', '/plastic-erp/gst-management', /GST/i);
  });

  test('12. "reports" navigates to Reports & Analytics', async ({ page }) => {
    await testSearchEnter(page, 'reports', '/plastic-erp/reports', /Report/i);
  });

  test('13. "settings" navigates to Business Settings', async ({ page }) => {
    await testSearchEnter(page, 'settings', '/settings', /Settings/i);
  });

  test('14. Case-insensitive and trimmed query matching ("  PAYMENTS  ", "  PrOdUcTs  ")', async ({ page }) => {
    await testSearchEnter(page, '  PAYMENTS  ', '/plastic-erp/payments', /Payment/i);
    await testSearchEnter(page, '  PrOdUcTs  ', '/products', /Product/i);
  });

  test('15. No-result search shows empty state and DOES NOT navigate on Enter', async ({ page }) => {
    await page.goto('http://localhost:4173/dashboard');
    const searchInput = page.locator('.sb-search-input');
    await searchInput.fill('nonexistentrandomquery123');

    // Verify empty state is displayed
    const emptyState = page.locator('.sb-search-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No matching pages found');

    // Press Enter: Must NOT navigate anywhere!
    await searchInput.press('Enter');
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/dashboard');
    expect(page.url()).not.toContain('/products');
  });

  test('16. Clear button (✕) clears the query and closes the dropdown', async ({ page }) => {
    await page.goto('http://localhost:4173/dashboard');
    const searchInput = page.locator('.sb-search-input');
    await searchInput.fill('payments');

    const dropdown = page.locator('.sb-search-dropdown');
    await expect(dropdown).toBeVisible();

    const clearBtn = page.locator('.sb-search-clear');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    await expect(searchInput).toHaveValue('');
    await expect(dropdown).not.toBeVisible();
  });

  test('17. Search query from URL (?search=...) is prefilled on Products and Invoices', async ({ page }) => {
    await page.goto('http://localhost:4173/products?search=Granules');
    const searchInput = page.locator('.sb-search-input');
    await expect(searchInput).toHaveValue('Granules');

    await page.goto('http://localhost:4173/invoices/history?search=INV-001');
    await expect(searchInput).toHaveValue('INV-001');
  });

  test('18. Keyboard navigation: ArrowDown and ArrowUp change active selection', async ({ page }) => {
    await page.goto('http://localhost:4173/dashboard');
    const searchInput = page.locator('.sb-search-input');
    await searchInput.click();
    await searchInput.fill('purchase');

    const dropdown = page.locator('.sb-search-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 10000 });

    const items = page.locator('.sb-search-result-item');
    await expect(items.first()).toBeVisible({ timeout: 10000 });
    const count = await items.count();
    expect(count).toBeGreaterThan(1);

    // Initial item 0 is selected
    await expect(items.nth(0)).toHaveClass(/is-selected/);

    // Press ArrowDown -> item 1 is selected
    await searchInput.press('ArrowDown');
    await expect(items.nth(1)).toHaveClass(/is-selected/);

    // Press ArrowUp -> returns to item 0
    await searchInput.press('ArrowUp');
    await expect(items.nth(0)).toHaveClass(/is-selected/);
  });
});
