// @ts-check
import { test, expect } from '@playwright/test';

test.describe('SmartBilling 2.0 Header Search Bar UI & Layout', () => {
  // Setup session with mock auth tokens so it loads dashboard directly
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4173/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-test-token-123');
      localStorage.setItem('admin', JSON.stringify({ name: 'Demo Admin', email: 'demo@smartbilling.com' }));
      localStorage.setItem('company', JSON.stringify({ name: 'Demo Company' }));
    });
  });

  test('Desktop (1366px): Search Bar is positioned cleanly without any overlap', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('http://localhost:4173/dashboard');

    const header = page.locator('.sb-top-header');
    await expect(header).toBeVisible();

    const titleBlock = page.locator('.sb-header-title-block');
    await expect(titleBlock).toBeVisible();

    const searchWrap = page.locator('.sb-search-wrap');
    await expect(searchWrap).toBeVisible();

    const searchInput = page.getByPlaceholder('Search products, customers, invoices...');
    await expect(searchInput).toBeVisible();

    const headerRight = page.locator('.sb-header-right');
    await expect(headerRight).toBeVisible();

    // Check bounding boxes
    const titleBox = await titleBlock.boundingBox();
    const searchBox = await searchWrap.boundingBox();
    const rightBox = await headerRight.boundingBox();

    expect(titleBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(rightBox).not.toBeNull();

    console.log(`[1366px] Title Right: ${titleBox.x + titleBox.width}, Search Left: ${searchBox.x}, Search Right: ${searchBox.x + searchBox.width}, Right Controls Left: ${rightBox.x}`);
    console.log(`[1366px] Search Bar Width: ${searchBox.width}px`);

    // Verification 1: Search bar is to the right of title block with positive gap (NO OVERLAP)
    expect(searchBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width);

    // Verification 2: Search bar is to the left of right controls with positive gap (NO OVERLAP)
    expect(rightBox.x).toBeGreaterThanOrEqual(searchBox.x + searchBox.width);

    // Verification 3: Search bar width is approximately 380-450px on desktop
    expect(searchBox.width).toBeGreaterThanOrEqual(380);
    expect(searchBox.width).toBeLessThanOrEqual(450);

    // Verification 4: Breadcrumb is fully readable
    await expect(page.locator('.sb-header-module')).toContainText(/overview/i);
    await expect(page.locator('.sb-header-page-title')).toHaveText('Executive Dashboard');
  });

  test('Desktop (1280px): Search Bar maintains safe spacing and correct dimensions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:4173/dashboard');

    const titleBlock = page.locator('.sb-header-title-block');
    const searchWrap = page.locator('.sb-search-wrap');
    const headerRight = page.locator('.sb-header-right');

    const titleBox = await titleBlock.boundingBox();
    const searchBox = await searchWrap.boundingBox();
    const rightBox = await headerRight.boundingBox();

    expect(searchBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
    expect(rightBox.x).toBeGreaterThan(searchBox.x + searchBox.width);
    expect(searchBox.width).toBeGreaterThanOrEqual(360);
    expect(searchBox.width).toBeLessThanOrEqual(450);
  });

  test('Tablet (1024px): Search Bar and page title adapt without overlap', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('http://localhost:4173/dashboard');

    const pageTitle = page.locator('.sb-header-page-title');
    await expect(pageTitle).toBeVisible();

    const searchWrap = page.locator('.sb-search-wrap');
    await expect(searchWrap).toBeVisible();

    const headerRight = page.locator('.sb-header-right');

    const pageTitleBox = await pageTitle.boundingBox();
    const searchBox = await searchWrap.boundingBox();
    const rightBox = await headerRight.boundingBox();

    console.log(`[1024px] Title Right: ${pageTitleBox.x + pageTitleBox.width}, Search Left: ${searchBox.x}, Search Width: ${searchBox.width}`);

    expect(searchBox.x).toBeGreaterThanOrEqual(pageTitleBox.x + pageTitleBox.width);
    expect(rightBox.x).toBeGreaterThanOrEqual(searchBox.x + searchBox.width);
    expect(searchBox.width).toBeLessThanOrEqual(380);
  });

  test('Tablet (768px): Gracefully sized Search Bar with zero overlap', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('http://localhost:4173/dashboard');

    const searchInput = page.getByPlaceholder('Search products, customers, invoices...');
    await expect(searchInput).toBeVisible();

    const pageTitle = page.locator('.sb-header-page-title');
    await expect(pageTitle).toBeVisible();

    const titleBox = await pageTitle.boundingBox();
    const searchBox = await page.locator('.sb-search-wrap').boundingBox();
    const rightBox = await page.locator('.sb-header-right').boundingBox();

    expect(searchBox.x).toBeGreaterThanOrEqual(titleBox.x + titleBox.width);
    expect(rightBox.x).toBeGreaterThanOrEqual(searchBox.x + searchBox.width);
  });

  test('Mobile (375px): No horizontal overflow and functional search bar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:4173/dashboard');

    const header = page.locator('.sb-top-header');
    await expect(header).toBeVisible();

    const searchInput = page.getByPlaceholder('Search products, customers, invoices...');
    await expect(searchInput).toBeVisible();

    // Verify no page horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow).toBe(false);

    // Verify search typing and clear functionality
    await searchInput.fill('Polymer Scrap');
    await expect(searchInput).toHaveValue('Polymer Scrap');

    const clearButton = page.getByLabel('Clear search');
    await expect(clearButton).toBeVisible();
    await clearButton.click();
    await expect(searchInput).toHaveValue('');
  });
});
