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

test.describe('Phase 3 Production High Fix & Regression Suite', () => {

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

  // =========================================================================
  // 1. PROD-01: Resume Paused Batch
  // =========================================================================
  test('PROD-01: Production Management Resume updates batch state, sends API request, and displays feedback', async ({ page }) => {
    let resumeRequested = false;
    let resumeUrl = '';

    // Intercept resume API call so production DB state is not mutated
    await page.route('**/api/plastic-erp/production/batches/*/resume', async (route) => {
      resumeRequested = true;
      resumeUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Batch BATCH-1001 resumed and is now RUNNING',
        }),
      });
    });

    await page.goto(`${BASE_URL}/plastic-erp/production?tab=shopfloor`);
    await page.waitForLoadState('networkidle');

    // Look for Resume button on paused batch
    const resumeButton = page.locator('button:has-text("Resume")').first();
    await expect(resumeButton).toBeVisible({ timeout: 10000 });

    // Click Resume
    await resumeButton.click();
    await page.waitForTimeout(500);

    // Verify API was called
    expect(resumeRequested).toBe(true);
    expect(resumeUrl).toMatch(/\/batches\/\d+\/resume/);

    // Verify immediate UI feedback message
    const alertBanner = page.locator('.sb-alert-banner, .alert-banner, [class*="alert"]').first();
    await expect(alertBanner).toBeVisible({ timeout: 5000 });
    await expect(alertBanner).toContainText(/resumed|RUNNING/i);
  });

  // =========================================================================
  // 2. PROD-02: Start / Same-Machine Conflict Handling
  // =========================================================================
  test('PROD-02: Start displays explicit machine scheduling conflict error without silent failure', async ({ page }) => {
    // Intercept start API call with a 409 Conflict response
    await page.route('**/api/plastic-erp/production/batches/*/start', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Machine scheduling conflict: QA TEST - Production Machine is currently running batch BATCH-1001. Please pause or complete the active batch before starting another batch on this machine.',
        }),
      });
    });

    await page.goto(`${BASE_URL}/plastic-erp/production?tab=shopfloor`);
    await page.waitForLoadState('networkidle');

    // Find Start Batch button
    const startButton = page.locator('button:has-text("Start Batch")').first();
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(500);

      // Verify explicit error banner is displayed
      const errorBanner = page.locator('.sb-alert-banner-danger, .alert-danger, [class*="danger"], [class*="error"]').first();
      await expect(errorBanner).toBeVisible({ timeout: 5000 });
      await expect(errorBanner).toContainText(/Machine scheduling conflict/i);
      await expect(errorBanner).toContainText(/currently running batch/i);
    }
  });

  // =========================================================================
  // 3. PROD-04: Completed Batch Excluded from WIP
  // =========================================================================
  test('PROD-04: WIP & Finished Goods excludes completed batches from Current WIP Volume and active table', async ({ page }) => {
    // First, verify backend API directly
    const token = generateAuthToken();
    const apiRes = await page.request.get('http://localhost:5000/api/plastic-erp/inventory/wip', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(apiRes.ok()).toBeTruthy();
    const wipData = await apiRes.json();

    // Verify completed batches (e.g. BATCH-1003) are NOT in wipStock
    const completedInWip = wipData.wipStock.filter((w) => w.batch_no === 'BATCH-1003' || w.status === 'COMPLETED');
    expect(completedInWip.length).toBe(0);

    // Verify summary only sums active batches
    const sumActiveQty = wipData.wipStock.reduce((acc, w) => acc + (Number(w.wip_quantity) || 0), 0);
    expect(Number(wipData.summary.totalWipKg)).toBe(sumActiveQty);

    // Now visit the frontend page
    await page.goto(`${BASE_URL}/plastic-erp/wip-fg`);
    await page.waitForLoadState('networkidle');

    // Verify KPI Card "Current WIP Volume" matches active quantity, not including BATCH-1003's 3.00 KG
    const kpiCards = page.locator('.sb-kpis-grid, .sb-kpi-grid');
    await expect(kpiCards).toBeVisible();
    await expect(kpiCards).toContainText(`${sumActiveQty.toLocaleString()} KG`);

    // Verify BATCH-1003 is NOT in the active WIP table
    const wipTable = page.locator('table').first();
    await expect(wipTable).toBeVisible();
    const tableText = await wipTable.textContent();
    expect(tableText).not.toContain('BATCH-1003');
  });

  // =========================================================================
  // 4. PROD-05: Production Costing NaN Prevention
  // =========================================================================
  test('PROD-05: Production Costing displays valid numeric Standard/KG and Variance without NaN', async ({ page }) => {
    // Verify API returns enriched numeric fields
    const token = generateAuthToken();
    const apiRes = await page.request.get('http://localhost:5000/api/plastic-erp/costing', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(apiRes.ok()).toBeTruthy();
    const costingData = await apiRes.json();

    expect(costingData.costs.length).toBeGreaterThan(0);
    const firstCost = costingData.costs[0];
    expect(isNaN(firstCost.standard_cost_per_kg)).toBeFalsy();
    expect(isNaN(firstCost.variance_amount)).toBeFalsy();
    expect(isNaN(firstCost.variance_percent)).toBeFalsy();
    expect(Number(firstCost.standard_cost_per_kg)).toBeGreaterThan(0);

    // Visit frontend Production Costing page
    await page.goto(`${BASE_URL}/plastic-erp/costing`);
    await page.waitForLoadState('networkidle');

    // Verify table has rendered
    const table = page.locator('table').first();
    await expect(table).toBeVisible();

    // Check table content for BATCH-1003 row
    const batchRow = page.locator('tr:has-text("BATCH-1003")');
    await expect(batchRow).toBeVisible();

    const rowText = await batchRow.textContent();
    expect(rowText).not.toContain('NaN');
    expect(rowText).not.toContain('undefined%');

    // Std / KG should show valid formatted rupee amount (e.g. ₹45.00)
    await expect(batchRow).toContainText(/₹45\.00/);

    // Variance should show valid numeric variance amount
    await expect(batchRow).toContainText(/₹2,295\.63|₹2295\.63/);
  });

  // =========================================================================
  // 5. PROD-07: Production Reports Filter Period
  // =========================================================================
  test('PROD-07: Production Reports Filter Period retains date inputs, updates data, and handles empty period without blanking', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/reports`);
    await page.waitForLoadState('networkidle');

    // Find date inputs
    const fromInput = page.locator('input[type="date"]').first();
    const toInput = page.locator('input[type="date"]').nth(1);
    await expect(fromInput).toBeVisible();
    await expect(toInput).toBeVisible();

    // Fill a historical empty date range (January 2025)
    await fromInput.fill('2025-01-01');
    await toInput.fill('2025-01-31');

    // Click Filter Period button
    const filterBtn = page.locator('button:has-text("Filter Period")');
    await filterBtn.click();
    await page.waitForTimeout(500);

    // CRITICAL: Inputs MUST remain populated and NOT cleared!
    await expect(fromInput).toHaveValue('2025-01-01');
    await expect(toInput).toHaveValue('2025-01-31');

    // The page must NOT have crashed or been replaced by full-screen loading
    await expect(page.locator('.sb-page-container')).toBeVisible();

    // Verify report reflects the zero-data state for January 2025 (total batches: 0)
    const summaryCard = page.locator('.sb-kpis-grid, .sb-kpi-grid, [class*="kpi"]').first();
    await expect(summaryCard).toBeVisible();
    await expect(summaryCard).toContainText('0');

    // Click Clear button
    const clearBtn = page.locator('button:has-text("Clear")');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await page.waitForTimeout(500);

    // Verify inputs are cleared and all-time data returns
    await expect(fromInput).toHaveValue('');
    await expect(toInput).toHaveValue('');
  });

});
