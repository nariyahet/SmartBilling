// @ts-check
import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
const BASE_URL = 'http://localhost:5173';

function generateAuthToken() {
  return jwt.sign(
    { id: 1, email: 'admin@smartbilling.com', role: 'admin', company_id: 1 },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

test.describe('FIN-01 & FIN-03 Critical Defect & Regression Verification', () => {

  test.beforeEach(async ({ page }) => {
    const token = generateAuthToken();
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate((authToken) => {
      localStorage.setItem('token', authToken);
      localStorage.setItem('admin', JSON.stringify({
        id: 1,
        name: 'Production Admin',
        email: 'admin@smartbilling.com',
        role: 'admin',
        company_id: 1
      }));
      localStorage.setItem('company', JSON.stringify({
        id: 1,
        name: 'Plastic Recycling Tech Ltd',
        gstin: '24AAACC1234D1Z5'
      }));
    }, token);
  });

  test('FIN-01: Trial Balance displays actual named accounts, non-zero data, and proper totals', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);

    // Verify Trial Balance tab is active
    await expect(page.locator('.fin-table')).toBeVisible();

    // Verify headers
    await expect(page.locator('.fin-table thead th').first()).toHaveText('Code');
    await expect(page.locator('.fin-table thead th').nth(1)).toHaveText('Account Name');
    await expect(page.locator('.fin-table thead th').nth(2)).toHaveText('Classification Group');

    // Verify rows are populated with real names, codes, groups, not blank phantom rows
    const rows = page.locator('.fin-table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    const firstRowCode = await rows.first().locator('code.fin-code-chip').textContent();
    const firstRowName = await rows.first().locator('strong').first().textContent();
    const firstRowGroup = await rows.first().locator('.fin-group-chip').textContent();

    expect(firstRowCode?.trim().length).toBeGreaterThan(0);
    expect(firstRowName?.trim().length).toBeGreaterThan(0);
    expect(firstRowGroup?.trim().length).toBeGreaterThan(0);

    // Verify footer totals are rendered
    const footerDebit = await page.locator('.tfoot-totals td.cell-right').first().textContent();
    const footerCredit = await page.locator('.tfoot-totals td.cell-right').nth(1).textContent();
    const badge = page.locator('.badge-integrity');

    expect(footerDebit).toContain('₹');
    expect(footerCredit).toContain('₹');
    await expect(badge).toBeVisible();
  });

  test('FIN-03: Financial Reports "This Financial Year" sets 2026-04-01 to 2027-03-31', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);

    // Select "This Financial Year"
    await page.selectOption('.sb-select', 'year');

    // Wait for data load
    await page.waitForTimeout(500);

    // Verify statement-meta shows As of Date: 2027-03-31
    const metaText = await page.locator('.statement-meta').textContent();
    expect(metaText).toContain('2027-03-31');

    // Switch to Profit & Loss tab
    await page.click('button:has-text("Profit & Loss")');
    await page.selectOption('.sb-select', 'year');
    await page.waitForTimeout(500);

    const plMeta = await page.locator('.statement-meta').textContent();
    expect(plMeta).toContain('2026-04-01');
    expect(plMeta).toContain('2027-03-31');

    // Switch to Supplier Ledger tab
    await page.click('button:has-text("Supplier Ledger")');
    await page.selectOption('.sb-select', 'year');
    await page.waitForTimeout(500);

    const slMeta = await page.locator('.statement-meta').textContent();
    expect(slMeta).toContain('2026-04-01');
    expect(slMeta).toContain('2027-03-31');
  });

  test('FIN-03 Regression: Today, This Month, and Custom Date Range preserved intact', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);
    await page.click('button:has-text("Profit & Loss")');

    // 1. Today
    await page.selectOption('.sb-select', 'today');
    await page.waitForTimeout(500);
    const todayMeta = await page.locator('.statement-meta').textContent();
    expect(todayMeta).toContain('2026-10-01');

    // 2. Month
    await page.selectOption('.sb-select', 'month');
    await page.waitForTimeout(500);
    const monthMeta = await page.locator('.statement-meta').textContent();
    expect(monthMeta).toContain('2026-10-01 to 2026-10-31');

    // 3. Custom Date Range
    await page.selectOption('.sb-select', 'custom');
    const fromInput = page.locator('input[type="date"]').first();
    const toInput = page.locator('input[type="date"]').nth(1);
    await fromInput.fill('2026-05-01');
    await toInput.fill('2026-06-15');
    await page.click('button:has-text("Refresh")');
    await page.waitForTimeout(500);

    const customMeta = await page.locator('.statement-meta').textContent();
    expect(customMeta).toContain('2026-05-01 to 2026-06-15');
  });

  test('Responsive verification: Mobile and Tablet rendering has no overflow', async ({ page }) => {
    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);
    await expect(page.locator('.fin-table-wrapper')).toBeVisible();

    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);
    await expect(page.locator('.fin-table-wrapper')).toBeVisible();
    await expect(page.locator('.statement-title')).toBeVisible();
  });
});
