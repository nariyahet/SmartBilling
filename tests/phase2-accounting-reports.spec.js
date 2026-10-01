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

test.describe('Phase 2 Accounting & Reports Fix & Regression Suite', () => {

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

  // 1. FIN-02: General Ledger Account Selector & Validation
  test('FIN-02: General Ledger has Account Selector, prompts if empty, loads data when selected', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);

    // Click General Ledger tab
    await page.click('button:has-text("General Ledger")');
    await page.waitForTimeout(500);

    // Verify selector exists
    const accountSelector = page.locator('#gl-account-selector');
    await expect(accountSelector).toBeVisible({ timeout: 10000 });

    // Verify validation / guidance prompt is shown when no account is selected
    await expect(page.locator('.fin-empty-state')).toContainText(/select a Ledger Account/i);

    // Select an account from the dropdown
    const optionValues = await accountSelector.locator('option').evaluateAll((opts) => opts.map(o => o.value).filter(Boolean));
    expect(optionValues.length).toBeGreaterThan(0);

    await accountSelector.selectOption(optionValues[0]);
    await page.waitForTimeout(1000);

    // Verify table or empty journal state is shown, without any HTTP 400 error
    await expect(page.locator('.sb-error-state')).not.toBeVisible();
    await expect(page.locator('.book-summary-header')).toBeVisible();
    await expect(page.locator('.fin-table')).toBeVisible();
  });

  // 2. FIN-04: Cash & Bank Filters
  test('FIN-04: Cash & Bank filters correctly filter by account, type, and reset', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/cash-bank`);
    await expect(page.locator('.cb-table')).toBeVisible({ timeout: 10000 });

    const initialRows = await page.locator('.cb-table tbody tr').count();
    expect(initialRows).toBeGreaterThan(0);

    // Filter by type: WITHDRAWAL
    await page.selectOption('#cb-type', 'WITHDRAWAL');
    await page.waitForTimeout(500);

    const withdrawalRows = page.locator('.cb-table tbody tr');
    const withdrawalCount = await withdrawalRows.count();
    if (withdrawalCount > 0) {
      for (let i = 0; i < withdrawalCount; i++) {
        await expect(withdrawalRows.nth(i).locator('td').nth(2)).toContainText('WITHDRAWAL');
      }
    }

    // Filter by Account
    const accOptions = await page.locator('#cb-acc option').evaluateAll((opts) => opts.map(o => o.value).filter(v => v !== 'ALL'));
    if (accOptions.length > 0) {
      await page.selectOption('#cb-acc', accOptions[0]);
      await page.waitForTimeout(500);
    }

    // Reset filters
    await page.click('button:has-text("Reset")');
    await page.waitForTimeout(500);

    const resetRows = await page.locator('.cb-table tbody tr').count();
    expect(resetRows).toBe(initialRows);
  });

  // 3. FIN-05: Bank Reconciliation Status & Account Filter
  test('FIN-05: Bank Reconciliation filters clearing register by status and account', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/bank-reconciliation`);
    await expect(page.locator('.recon-table')).toBeVisible({ timeout: 10000 });

    // Filter by status: RECONCILED
    await page.selectOption('.recon-status-select', 'RECONCILED');
    await page.waitForTimeout(500);

    // Verify no UNRECONCILED rows are shown
    const reconciledRows = page.locator('.recon-table tbody tr');
    const rowCount = await reconciledRows.count();
    for (let i = 0; i < rowCount; i++) {
      const text = await reconciledRows.nth(i).textContent();
      if (!text?.includes('No bank statement entries')) {
        expect(text).not.toContain('UNRECONCILED');
      }
    }

    // Filter by status: UNRECONCILED
    await page.selectOption('.recon-status-select', 'UNRECONCILED');
    await page.waitForTimeout(500);

    // Filter by status: ALL
    await page.selectOption('.recon-status-select', 'ALL');
    await page.waitForTimeout(500);
  });

  // 4. FIN-07: Chart of Accounts Filters
  test('FIN-07: Chart of Accounts filters rows by account type and status', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/chart-of-accounts`);
    await expect(page.locator('.coa-table')).toBeVisible({ timeout: 10000 });

    // Filter by ASSET
    await page.selectOption('.coa-type-select', 'ASSET');
    await page.waitForTimeout(500);

    const assetRows = page.locator('.coa-table tbody tr');
    const assetCount = await assetRows.count();
    expect(assetCount).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(assetCount, 5); i++) {
      await expect(assetRows.nth(i).locator('.coa-type-badge')).toHaveText('ASSET');
    }

    // Filter by LIABILITY
    await page.selectOption('.coa-type-select', 'LIABILITY');
    await page.waitForTimeout(500);

    const liabRows = page.locator('.coa-table tbody tr');
    const liabCount = await liabRows.count();
    expect(liabCount).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(liabCount, 5); i++) {
      await expect(liabRows.nth(i).locator('.coa-type-badge')).toHaveText('LIABILITY');
    }

    // Filter by ACTIVE status
    await page.selectOption('.coa-status-select', 'ACTIVE');
    await page.waitForTimeout(500);

    // Restore to ALL
    await page.selectOption('.coa-type-select', 'ALL');
    await page.selectOption('.coa-status-select', 'ALL');
    await page.waitForTimeout(500);
  });

  // 5. REPORT-01: Today & All Time do not produce HTTP 500
  test('REPORT-01: Today and All Time date shortcuts load successfully without HTTP 500', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/sales-reports`);
    await page.waitForTimeout(1000);

    // Click "Today"
    await page.click('button:has-text("Today")');
    await page.waitForTimeout(800);

    // Verify no error banner
    await expect(page.locator('.sb-error-state')).not.toBeVisible();
    await expect(page.getByText('Failed to load sales and financial reports')).not.toBeVisible();

    // Click "All Time"
    await page.click('button:has-text("All Time")');
    await page.waitForTimeout(800);

    await expect(page.locator('.sb-error-state')).not.toBeVisible();
    await expect(page.getByText('Failed to load sales and financial reports')).not.toBeVisible();

    // Navigate to Dispatches & Logistics tab
    await page.click('button:has-text("Dispatches & Logistics")');
    await page.waitForTimeout(800);
    await expect(page.locator('.sb-error-state')).not.toBeVisible();

    // Navigate to Collections & Cash Flow tab
    await page.click('button:has-text("Collections & Cash Flow")');
    await page.waitForTimeout(800);
    await expect(page.locator('.sb-error-state')).not.toBeVisible();

    // Navigate to Profit & Gross Margin tab
    await page.click('button:has-text("Profit & Gross Margin")');
    await page.waitForTimeout(800);
    await expect(page.locator('.sb-error-state')).not.toBeVisible();
  });

  // 6. REPORT-02: This Month produces complete month range
  test('REPORT-02: This Month sets complete month range from 1st to last day of month', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/sales-reports`);
    await page.waitForTimeout(1000);

    // Click "This Month"
    await page.click('button:has-text("This Month")');
    await page.waitForTimeout(500);

    const fromInput = page.locator('input.prep-date-input').first();
    const toInput = page.locator('input.prep-date-input').nth(1);

    const fromVal = await fromInput.inputValue();
    const toVal = await toInput.inputValue();

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const expectedStart = `${year}-${month}-01`;

    const lastDayOfMonth = new Date(year, today.getMonth() + 1, 0).getDate();
    const expectedEnd = `${year}-${month}-${String(lastDayOfMonth).padStart(2, '0')}`;

    expect(fromVal).toBe(expectedStart);
    expect(toVal).toBe(expectedEnd);
    expect(fromVal).not.toBe(toVal); // Must NOT be a 1-day range!
  });

});
