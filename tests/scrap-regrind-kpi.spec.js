// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Scrap & Regrind Operations KPI Layout & Regression Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4173/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-token-123');
      localStorage.setItem('admin', JSON.stringify({ name: 'Demo Admin', email: 'demo@smartbilling.com' }));
      localStorage.setItem('company', JSON.stringify({ name: 'Demo Company' }));
    });
  });

  test('1. Desktop (~1366px): KPI cards are compact, 3-column grid, with visible titles, icons, values, and subtexts', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('http://localhost:4173/plastic-erp/scrap-regrind');

    // Verify page header
    await expect(page.locator('h1')).toHaveText('Scrap & Regrind Operations');

    // KPI Container verification
    const kpiContainer = page.locator('.regrind-kpis-grid');
    await expect(kpiContainer).toBeVisible();

    const cards = kpiContainer.locator('.sb-stat-card');
    await expect(cards).toHaveCount(3);

    // Card 1: Total Process Scrap
    const card1 = cards.nth(0);
    await expect(card1.locator('.sb-stat-title')).toHaveText(/Total Process Scrap/i);
    await expect(card1.locator('.sb-stat-value')).toContainText('0 KG');
    await expect(card1.locator('.sb-stat-sub')).toContainText('0 KG reusable');
    await expect(card1.locator('.sb-stat-icon-wrap')).toContainText('♻️');

    // Card 2: Current Regrind Stock
    const card2 = cards.nth(1);
    await expect(card2.locator('.sb-stat-title')).toHaveText(/Current Regrind Stock/i);
    await expect(card2.locator('.sb-stat-value')).toContainText('0 KG');
    await expect(card2.locator('.sb-stat-sub')).toContainText('Available for extrusion batches');
    await expect(card2.locator('.sb-stat-icon-wrap')).toContainText('📦');

    // Card 3: Regrind Generated
    const card3 = cards.nth(2);
    await expect(card3.locator('.sb-stat-title')).toHaveText(/Regrind Generated/i);
    await expect(card3.locator('.sb-stat-value')).toContainText('0 KG');
    await expect(card3.locator('.sb-stat-sub')).toContainText('0 KG consumed');
    await expect(card3.locator('.sb-stat-icon-wrap')).toContainText('⚙️');

    // Dimensions check: cards must be compact (height between 80px and 160px), aligned horizontally
    const cardBBoxes = await Promise.all([
      card1.boundingBox(),
      card2.boundingBox(),
      card3.boundingBox(),
    ]);

    const [box1, box2, box3] = cardBBoxes;
    expect(box1).not.toBeNull();
    expect(box2).not.toBeNull();
    expect(box3).not.toBeNull();
    if (!box1 || !box2 || !box3) throw new Error('Card bounding boxes not found');

    for (let i = 0; i < 3; i++) {
      const box = cardBBoxes[i];
      expect(box).not.toBeNull();
      if (!box) continue;
      // Compact height check
      expect(box.height).toBeGreaterThanOrEqual(80);
      expect(box.height).toBeLessThanOrEqual(160);
      // Width check: each card takes ~1/3 of the container, not 1000px wide
      expect(box.width).toBeGreaterThanOrEqual(280);
      expect(box.width).toBeLessThanOrEqual(450);
    }

    // Check that card 1, 2, and 3 are on the same vertical line (side-by-side in 1 row)
    expect(Math.abs(box1.y - box2.y)).toBeLessThanOrEqual(4);
    expect(Math.abs(box2.y - box3.y)).toBeLessThanOrEqual(4);

    // Verify preservation of action buttons
    await expect(page.getByRole('button', { name: 'ERP Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Record Process Scrap' })).toBeVisible();

    // Verify preservation of tabs and empty state
    await expect(page.getByRole('tab', { name: /Process Scrap & Waste/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Regrind Transactions/i })).toBeVisible();
    await expect(page.getByText('No scrap records logged.')).toBeVisible();

    // Take screenshot for visual evidence
    await page.screenshot({ path: 'tests/scrap-regrind-desktop-fixed.png', fullPage: true });
  });

  test('2. Tablet (~768px): Responsive grid wrapping, no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:4173/plastic-erp/scrap-regrind');

    await expect(page.locator('h1')).toHaveText('Scrap & Regrind Operations');

    const cards = page.locator('.regrind-kpis-grid .sb-stat-card');
    await expect(cards).toHaveCount(3);

    // Assert all cards content visible
    for (let i = 0; i < 3; i++) {
      const card = cards.nth(i);
      await expect(card.locator('.sb-stat-title')).toBeVisible();
      await expect(card.locator('.sb-stat-value')).toBeVisible();
      await expect(card.locator('.sb-stat-sub')).toBeVisible();
    }

    // Check no horizontal page overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    await page.screenshot({ path: 'tests/scrap-regrind-tablet-fixed.png', fullPage: true });
  });

  test('3. Mobile (~375px): Clean single-column stack, no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:4173/plastic-erp/scrap-regrind');

    await expect(page.locator('h1')).toHaveText('Scrap & Regrind Operations');

    const cards = page.locator('.regrind-kpis-grid .sb-stat-card');
    await expect(cards).toHaveCount(3);

    // Cards should stack vertically
    const b1 = await cards.nth(0).boundingBox();
    const b2 = await cards.nth(1).boundingBox();
    const b3 = await cards.nth(2).boundingBox();

    expect(b1).not.toBeNull();
    expect(b2).not.toBeNull();
    expect(b3).not.toBeNull();
    if (!b1 || !b2 || !b3) throw new Error('Mobile card bounding boxes not found');

    expect(b2.y).toBeGreaterThan(b1.y);
    expect(b3.y).toBeGreaterThan(b2.y);

    // Check card heights on mobile are compact
    expect(b1.height).toBeLessThanOrEqual(160);
    expect(b2.height).toBeLessThanOrEqual(160);
    expect(b3.height).toBeLessThanOrEqual(160);

    // Check no horizontal overflow on mobile
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    await page.screenshot({ path: 'tests/scrap-regrind-mobile-fixed.png', fullPage: true });
  });

  test('4. Tab switching and action buttons functionality preserved', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('http://localhost:4173/plastic-erp/scrap-regrind');

    // Switch to Regrind Transactions tab
    const regrindTab = page.getByRole('tab', { name: /Regrind Transactions/i });
    await regrindTab.click();

    // The button switches to "+ Generate Regrind Stock"
    await expect(page.getByRole('button', { name: '+ Generate Regrind Stock' })).toBeVisible();

    // Modal opens when clicked
    await page.getByRole('button', { name: '+ Generate Regrind Stock' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog')).toContainText('Generate Regrind Stock');

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Switch back to Process Scrap tab
    const scrapTab = page.getByRole('tab', { name: /Process Scrap & Waste/i });
    await scrapTab.click();
    await expect(page.getByRole('button', { name: '+ Record Process Scrap' })).toBeVisible();
  });
});
