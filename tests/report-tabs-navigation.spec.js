// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Sales, Dispatch & Finance Reports Tab Navigation & Sidebar Active State', () => {
  test.beforeEach(async ({ page, request }) => {
    // Login as Demo Admin
    const loginRes = await request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'demo@smartbilling.com', password: 'Demo@12345' },
    });
    const loginData = await loginRes.json();
    const token = loginData.data?.token || '';
    const admin = loginData.data?.admin || { id: 4, name: 'Demo Admin', email: 'demo@smartbilling.com', company_id: 1 };
    const company = loginData.data?.company || { id: 1, name: 'Demo Company' };

    await page.goto(`${BASE_URL}/login`);
    await page.evaluate(
      ({ token, admin, company }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('admin', JSON.stringify(admin));
        localStorage.setItem('company', JSON.stringify(company));
      },
      { token, admin, company }
    );
  });

  test('Internal Report Buttons update URL and sync Sidebar Active state dynamically', async ({ page }) => {
    /** @type {string[]} */
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 1. Navigate to Sales Reports
    await page.goto(`${BASE_URL}/plastic-erp/sales-reports`);
    await page.waitForLoadState('networkidle');

    // Sidebar: "Reports & Analytics" group should be expanded
    // "Sales Reports" should have .active and aria-current="page"
    const activeSubitem = page.locator('.sb-nav-subitem.active');
    await expect(activeSubitem).toBeVisible();
    await expect(activeSubitem).toContainText('Sales Reports');
    await expect(activeSubitem).toHaveAttribute('href', '/plastic-erp/sales-reports');
    await expect(activeSubitem).toHaveAttribute('aria-current', 'page');

    // Tab button 1: "Sales Orders" should be active
    const salesTab = page.locator('.prep-tabs .tab-btn').filter({ hasText: 'Sales Orders' });
    await expect(salesTab).toHaveClass(/active/);
    await expect(salesTab).toHaveAttribute('aria-current', 'page');

    // 2. Click Tab 2: "Dispatches & Logistics"
    const dispatchTab = page.locator('.prep-tabs .tab-btn').filter({ hasText: 'Dispatches & Logistics' });
    await dispatchTab.click();
    await page.waitForURL('**/plastic-erp/dispatch-reports');

    // Verify Tab 2 is active
    await expect(dispatchTab).toHaveClass(/active/);
    await expect(dispatchTab).toHaveAttribute('aria-current', 'page');
    await expect(salesTab).not.toHaveClass(/active/);

    // Verify Sidebar: "Dispatch Reports" is now active
    const dispatchNav = page.locator('.sb-nav-subitem.active');
    await expect(dispatchNav).toContainText('Dispatch Reports');
    await expect(dispatchNav).toHaveAttribute('href', '/plastic-erp/dispatch-reports');
    await expect(dispatchNav).toHaveAttribute('aria-current', 'page');

    // 3. Click Tab 3: "Collections & Cash Flow"
    const collectionsTab = page.locator('.prep-tabs .tab-btn').filter({ hasText: 'Collections & Cash Flow' });
    await collectionsTab.click();
    await page.waitForURL('**/plastic-erp/payment-reports');

    // Verify Tab 3 is active
    await expect(collectionsTab).toHaveClass(/active/);
    await expect(collectionsTab).toHaveAttribute('aria-current', 'page');
    await expect(dispatchTab).not.toHaveClass(/active/);

    // Verify Sidebar: "Payment Reports" is now active
    const paymentNav = page.locator('.sb-nav-subitem.active');
    await expect(paymentNav).toContainText('Payment Reports');
    await expect(paymentNav).toHaveAttribute('href', '/plastic-erp/payment-reports');
    await expect(paymentNav).toHaveAttribute('aria-current', 'page');

    // 4. Click Tab 4: "Profit & Gross Margin"
    const profitTab = page.locator('.prep-tabs .tab-btn').filter({ hasText: 'Profit & Gross Margin' });
    await profitTab.click();
    await page.waitForURL('**/plastic-erp/executive-analytics');

    // Verify Tab 4 is active
    await expect(profitTab).toHaveClass(/active/);
    await expect(profitTab).toHaveAttribute('aria-current', 'page');
    await expect(collectionsTab).not.toHaveClass(/active/);

    // Verify Sidebar: "Executive Analytics" is now active
    const analyticsNav = page.locator('.sb-nav-subitem.active');
    await expect(analyticsNav).toContainText('Executive Analytics');
    await expect(analyticsNav).toHaveAttribute('href', '/plastic-erp/executive-analytics');
    await expect(analyticsNav).toHaveAttribute('aria-current', 'page');

    // 5. Test Browser Refresh on current view (/plastic-erp/executive-analytics)
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.sb-nav-subitem.active')).toContainText('Executive Analytics');
    await expect(page.locator('.prep-tabs .tab-btn').filter({ hasText: 'Profit & Gross Margin' })).toHaveClass(/active/);

    // 6. Test Browser Back to /plastic-erp/payment-reports
    await page.goBack();
    await page.waitForURL('**/plastic-erp/payment-reports');
    await expect(page.locator('.sb-nav-subitem.active')).toContainText('Payment Reports');
    await expect(page.locator('.prep-tabs .tab-btn').filter({ hasText: 'Collections & Cash Flow' })).toHaveClass(/active/);

    // 7. Test Browser Forward back to /plastic-erp/executive-analytics
    await page.goForward();
    await page.waitForURL('**/plastic-erp/executive-analytics');
    await expect(page.locator('.sb-nav-subitem.active')).toContainText('Executive Analytics');
    await expect(page.locator('.prep-tabs .tab-btn').filter({ hasText: 'Profit & Gross Margin' })).toHaveClass(/active/);

    // 8. Test Direct URL navigation to /plastic-erp/dispatch-reports
    await page.goto(`${BASE_URL}/plastic-erp/dispatch-reports`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.sb-nav-subitem.active')).toContainText('Dispatch Reports');
    await expect(page.locator('.prep-tabs .tab-btn').filter({ hasText: 'Dispatches & Logistics' })).toHaveClass(/active/);

    // Verify 0 unhandled console errors
    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR_'));
    expect(criticalErrors).toHaveLength(0);
  });
});
