// @ts-check
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('SmartBilling 2.0 Navigation Active State, Button Colors & 3-Month Trial Verification', () => {
  test.beforeEach(async ({ page, request }) => {
    // Obtain session token
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

  test('PART 1 & 3: Navigation active state derived from current route across clicks, direct URL, refresh, back/forward', async ({ page }) => {
    // 1. Direct URL navigation to Suppliers
    await page.goto(`${BASE_URL}/plastic-erp/suppliers`);
    await page.waitForLoadState('networkidle');

    // Verify Procurement parent group is expanded and Suppliers subitem is active
    const activeSubitem = page.locator('.sb-nav-subitem.active');
    await expect(activeSubitem).toBeVisible();
    await expect(activeSubitem).toContainText('Suppliers');
    await expect(activeSubitem).toHaveAttribute('href', '/plastic-erp/suppliers');
    await expect(activeSubitem).toHaveAttribute('aria-current', 'page');

    // 2. Direct URL navigation to Raw Materials
    await page.goto(`${BASE_URL}/plastic-erp/raw-materials`);
    await page.waitForLoadState('networkidle');

    const activeRaw = page.locator('.sb-nav-subitem.active');
    await expect(activeRaw).toBeVisible();
    await expect(activeRaw).toContainText('Raw Materials');
    await expect(activeRaw).toHaveAttribute('href', '/plastic-erp/raw-materials');

    // 3. In-page click navigation via sidebar
    // Click Sales & Dispatch -> Sales Orders
    const salesGroupBtn = page.getByRole('button', { name: /Sales & Dispatch/i });
    await salesGroupBtn.click();
    const salesOrderLink = page.locator('.sb-nav-subitem[href="/plastic-erp/sales-orders"]');
    await salesOrderLink.click();
    await page.waitForURL('**/plastic-erp/sales-orders');

    await expect(page.locator('.sb-nav-subitem.active')).toContainText('Sales Orders');

    // 4. Nested child route / Financial Reports parent navigation remains active
    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);
    await page.waitForLoadState('networkidle');
    const activeFin = page.locator('.sb-nav-subitem.active');
    await expect(activeFin).toContainText('Financial Reports');

    // 5. Browser refresh preserves correct active state
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.sb-nav-subitem.active')).toContainText('Financial Reports');

    // 6. Browser Back / Forward navigation updates active state
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.sb-nav-subitem.active')).toContainText('Sales Orders');

    await page.goForward();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.sb-nav-subitem.active')).toContainText('Financial Reports');
  });

  test('PART 2 & 3: Active filter chips and buttons use SmartBilling Blue (#0879D1), semantic green preserved', async ({ page }) => {
    // 1. Plastic Suppliers page
    await page.goto(`${BASE_URL}/plastic-erp/suppliers`);
    await page.waitForLoadState('networkidle');

    // Check ALL active filter chip computed background
    const activeFilterChip = page.locator('.filter-chip.active').first();
    await expect(activeFilterChip).toBeVisible();

    const activeChipBg = await activeFilterChip.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // #0879D1 in rgb is rgb(8, 121, 209)
    expect(activeChipBg).toBe('rgb(8, 121, 209)');

    // Click "ACTIVE" filter chip and check its color
    const activeStatusChip = page.getByRole('button', { name: /^ACTIVE$/i });
    await activeStatusChip.click();
    await expect(activeStatusChip).toHaveClass(/active/);

    // Hover state is #0769B7 -> rgb(7, 105, 183)
    await expect(activeStatusChip).toHaveCSS('background-color', 'rgb(7, 105, 183)');

    // Move mouse away: Normal active state is #0879D1 -> rgb(8, 121, 209)
    await page.mouse.move(0, 0);
    await expect(activeStatusChip).toHaveCSS('background-color', 'rgb(8, 121, 209)');

    // Check semantic status pill in table retains green (rgb(220, 252, 231) background or green text)
    const statusPill = page.locator('.status-pill.active').first();
    if (await statusPill.isVisible()) {
      const statusColor = await statusPill.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return { bg: style.backgroundColor, color: style.color };
      });
      // Semantic active pill is light green background rgb(220, 252, 231)
      expect(statusColor.bg).toBe('rgb(220, 252, 231)');
    }

    // 2. Plastic Raw Materials page
    await page.goto(`${BASE_URL}/plastic-erp/raw-materials`);
    await page.waitForLoadState('networkidle');

    const rawActiveChip = page.locator('.filter-chip.active').first();
    await expect(rawActiveChip).toBeVisible();
    await expect(rawActiveChip).toHaveCSS('background-color', 'rgb(8, 121, 209)');

    // Check search button is SmartBilling blue
    const searchBtn = page.locator('.btn-search').first();
    if (await searchBtn.isVisible()) {
      await expect(searchBtn).toHaveCSS('background-color', 'rgb(8, 121, 209)');
    }

    // 3. Plastic Dashboard period pills
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    const activePeriodPill = page.locator('.period-pill.active').first();
    if (await activePeriodPill.isVisible()) {
      await expect(activePeriodPill).toHaveCSS('background-color', 'rgb(8, 121, 209)');
    }
  });

  test('PART 5: Frontend 3-Month Trial text everywhere', async ({ page }) => {
    // 1. Clear session to view clean unauthenticated login page
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    const registerLink = page.getByRole('link', { name: /Start 3-month free trial/i });
    await expect(registerLink).toBeVisible();

    // 2. Register page
    await registerLink.click();
    await page.waitForURL('**/register');

    await expect(page.getByText('3-Month Full-Feature Free Trial')).toBeVisible();
    await expect(page.getByRole('button', { name: /Start 3-Month Free Trial/i })).toBeVisible();

    // 3. Trial Expired page
    await page.goto(`${BASE_URL}/trial-expired`);
    await expect(page.getByRole('heading', { name: /Your 3-month trial has expired/i })).toBeVisible();
  });
});
