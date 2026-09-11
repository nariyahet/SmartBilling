// @ts-check
import { test, expect } from '@playwright/test';

test.describe('SmartBilling 2.0 - 9 ERP Bug Fixes & Regression Suite', () => {
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

  // --------------------------------------------------------------------------
  // BUG 1: Sales Returns
  // --------------------------------------------------------------------------
  test('1. Sales Returns: page loads without "Failed to load sales returns" alert and controls visible', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/sales-returns');
    await expect(page.locator('h1')).toContainText(/Sales Returns/i, { timeout: 15000 });

    // Assert no error alert
    expect(dialogMessages).not.toContain('Failed to load sales returns');

    // Controls visible
    await expect(page.getByRole('button', { name: /\+ Log Sales Return/i })).toBeVisible();

    // Verify navbar active state
    const activeNav = page.locator('.sb-nav-subitem.active');
    await expect(activeNav).toContainText('Sales Returns');
  });

  // --------------------------------------------------------------------------
  // BUG 2: Customer Ledger
  // --------------------------------------------------------------------------
  test('2. Customer Ledger: direct and navbar navigation opens without "Route Not Found"', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/customer-ledger');
    await expect(page.locator('h1')).toContainText(/Customer Ledger/i, { timeout: 15000 });

    // Assert no "Route Not Found" alert
    expect(dialogMessages).not.toContain('Route Not Found');
    await expect(page.getByText('Route Not Found')).not.toBeVisible();

    // Navbar navigation check: start from an adjacent page like sales-orders
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('http://localhost:4173/plastic-erp/sales-orders');
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    const salesGroupBtn = page.locator('.sb-nav-group-btn', { hasText: 'Sales & Dispatch' });
    const isSubitemVisible = await page.locator('.sb-nav-subitem', { hasText: 'Customer Ledger' }).isVisible();
    if (!isSubitemVisible) {
      await salesGroupBtn.click();
    }
    const ledgerLink = page.locator('.sb-nav-subitem', { hasText: 'Customer Ledger' });
    await ledgerLink.click();
    await page.waitForURL('**/plastic-erp/customer-ledger*');
    expect(page.url()).toContain('/plastic-erp/customer-ledger');
    expect(dialogMessages).not.toContain('Route Not Found');
  });

  // --------------------------------------------------------------------------
  // BUG 3: Receivables
  // --------------------------------------------------------------------------
  test('3. Receivables: page loads without "Failed" alert and displays data', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/receivables');
    await expect(page.locator('h1')).toContainText(/Receivable/i, { timeout: 15000 });

    // Assert no Failed alert
    expect(dialogMessages.some((m) => m.toLowerCase().includes('failed'))).toBeFalsy();

    // Verify KPI cards container
    await expect(page.locator('.prec-kpis, .sb-kpis-grid, .plastic-kpis-grid')).toBeVisible();

    // Verify navbar active state
    const activeNav = page.locator('.sb-nav-subitem.active');
    await expect(activeNav).toContainText('Receivables');
  });

  // --------------------------------------------------------------------------
  // BUG 4: Payments
  // --------------------------------------------------------------------------
  test('4. Payments: page loads with clean CSS, table headers, and responsive layout', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/payments');
    await expect(page.locator('h1')).toContainText(/Payment/i, { timeout: 15000 });

    // Assert table headers exist (TH tags inside THEAD)
    const thead = page.locator('.sb-data-table thead th');
    await expect(thead.first()).toBeVisible({ timeout: 10000 });
    const headersCount = await thead.count();
    expect(headersCount).toBeGreaterThanOrEqual(5);

    // Assert filter controls exist
    await expect(page.locator('.pay-filter-bar, .prec-filters-bar')).toBeVisible();

    // Responsive checks: mobile width 375px
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toBeVisible();

    // Reset viewport
    await page.setViewportSize({ width: 1366, height: 768 });

    // Verify navbar active state
    const activeNav = page.locator('.sb-nav-subitem.active');
    await expect(activeNav).toContainText('Payments');
  });

  // --------------------------------------------------------------------------
  // BUG 5: Delivery Challans
  // --------------------------------------------------------------------------
  test('5. Delivery Challans: page loads without "Failed" alert and controls visible', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/delivery-challans');
    await expect(page.locator('h1')).toContainText(/Delivery Challan/i, { timeout: 15000 });

    // Assert no Failed alert
    expect(dialogMessages.some((m) => m.toLowerCase().includes('failed'))).toBeFalsy();

    // Controls visible
    await expect(page.getByRole('button', { name: /\+ Issue Challan/i })).toBeVisible();

    // Verify navbar active state
    const activeNav = page.locator('.sb-nav-subitem.active');
    await expect(activeNav).toContainText('Delivery Challans');
  });

  // --------------------------------------------------------------------------
  // BUG 6: Dispatch
  // --------------------------------------------------------------------------
  test('6. Dispatch: page loads with clean CSS, table headers, and 5-card KPI layout', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:4173/plastic-erp/dispatch');
    await expect(page.locator('h1')).toContainText(/Dispatch & Outward/i, { timeout: 15000 });

    // Actions
    await expect(page.getByRole('button', { name: /\+ New Dispatch/i })).toBeVisible();

    // Table Header Verification
    const tableHeaders = page.locator('.sb-data-table thead th');
    await expect(tableHeaders.first()).toBeVisible();
    await expect(tableHeaders).toContainText(['Dispatch #', 'Customer', 'Status']);

    // KPI Cards check
    const kpiCards = page.locator('.sb-kpis-grid .sb-stat-card');
    await expect(kpiCards).toHaveCount(5);

    // Tablet Viewport Check (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await expect(kpiCards.first()).toBeVisible();

    // Mobile Viewport Check (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    const container = page.locator('.sb-page-container');
    await expect(container).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // BUG 7: Customer Ledger Reports
  // --------------------------------------------------------------------------
  test('7. Customer Ledger Reports: direct navigation works without "Route Not Found"', async ({ page }) => {
    await page.goto('http://localhost:4173/plastic-erp/customer-ledger-reports');
    await expect(page.locator('h1')).toContainText(/Customer Ledger/i, { timeout: 15000 });

    // Assert no "Route Not Found" alert
    expect(dialogMessages).not.toContain('Route Not Found');
    await expect(page.getByText('Route Not Found')).not.toBeVisible();

    // Verify navbar active state
    const activeNav = page.locator('.sb-nav-subitem.active');
    await expect(activeNav).toContainText('Customer Ledger Reports');
  });

  // --------------------------------------------------------------------------
  // BUG 8: Procurement Reports
  // --------------------------------------------------------------------------
  test('8. Procurement Reports: page loads with clean CSS and horizontally scrollable tabs', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:4173/plastic-erp/procurement-reports');
    await expect(page.locator('h1')).toContainText(/Procurement & Vendor Intelligence/i, { timeout: 15000 });

    // Tabs container
    const scrollContainer = page.locator('.proc-pills-scroll');
    await expect(scrollContainer).toBeVisible();

    // Date Filter Bar
    const filterCard = page.locator('.sb-filter-card');
    await expect(filterCard).toBeVisible();

    // Mobile Viewport Check (375x667) - verify no horizontal overflow blowout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    const container = page.locator('.sb-page-container');
    await expect(container).toBeVisible();
    const box = await container.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(375);
    }
  });

  // --------------------------------------------------------------------------
  // BUG 9: Financial Reports
  // --------------------------------------------------------------------------
  test('9. Financial Reports: direct and compatibility routes load without "Route Not Found"', async ({ page }) => {
    // Direct canonical route
    await page.goto('http://localhost:4173/plastic-erp/financial-reports');
    await expect(page.locator('h1')).toContainText(/Financial Reports/i, { timeout: 15000 });

    expect(dialogMessages).not.toContain('Route Not Found');
    await expect(page.getByText('Route Not Found')).not.toBeVisible();
    const errorBanner = page.locator('.fin-error-banner');
    if (await errorBanner.isVisible()) {
      await expect(errorBanner).not.toContainText('Route Not Found');
    }

    // Verify report tabs are visible
    const tabs = page.locator('.fin-pills-scroll .fin-tab-pill');
    await expect(tabs.first()).toBeVisible();

    // Compatibility route: /plastic-erp/accounting/financial-reports
    await page.goto('http://localhost:4173/plastic-erp/accounting/financial-reports');
    await expect(page.locator('h1')).toContainText(/Financial Reports/i, { timeout: 15000 });
    expect(dialogMessages).not.toContain('Route Not Found');
    await expect(page.getByText('Route Not Found')).not.toBeVisible();
  });
});
