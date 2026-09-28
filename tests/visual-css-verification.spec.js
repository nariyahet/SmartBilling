import { test, expect } from '@playwright/test';

test('Verify Typography, Form Controls, and Tabs Visual Styling', async ({ page, request }) => {
  // 1. Authenticate
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

  // 2. Financial Reports
  await page.goto('http://localhost:4173/plastic-erp/financial-reports');
  await expect(page.locator('h1')).toBeVisible();

  // Check body font family
  const bodyFont = await page.evaluate(() => window.getComputedStyle(document.body).fontFamily);
  console.log('Body font family:', bodyFont);
  expect(bodyFont.toLowerCase()).toContain('inter');

  // Check tabs container
  const tabsContainer = page.locator('.fin-tabs-bar.sb-tabs-container');
  await expect(tabsContainer).toBeVisible();

  // Check active tab button styling
  const activeTab = page.locator('.fin-tabs-bar .sb-tab-btn.is-active');
  await expect(activeTab).toBeVisible();
  const activeTabBg = await activeTab.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  console.log('Active tab background:', activeTabBg);

  // Check select styling
  const periodSelect = page.locator('.sb-select').first();
  await expect(periodSelect).toBeVisible();
  const selectBgImg = await periodSelect.evaluate((el) => window.getComputedStyle(el).backgroundImage);
  console.log('Select background image:', selectBgImg);
  expect(selectBgImg).toContain('data:image/svg+xml');

  // Check filter item label
  const filterLabel = page.locator('.filter-item label').first();
  await expect(filterLabel).toBeVisible();
  const labelWeight = await filterLabel.evaluate((el) => window.getComputedStyle(el).fontWeight);
  console.log('Filter label font weight:', labelWeight);
  expect(Number(labelWeight)).toBeGreaterThanOrEqual(600);

  // Switch tabs and verify
  await page.click('button:has-text("Profit & Loss")');
  await expect(page.locator('h1')).toContainText(/Profit & Loss/i);
  await expect(page.locator('.pl-container')).toBeVisible();

  await page.click('button:has-text("Balance Sheet")');
  await expect(page.locator('h1')).toContainText(/Balance Sheet/i);
  await expect(page.locator('.bs-grid')).toBeVisible();

  // 3. Customer Ledger
  await page.goto('http://localhost:4173/plastic-erp/customer-ledger');
  await expect(page.locator('h1')).toContainText(/Customer Ledger/i);
  const custSelect = page.locator('select.sb-select').first();
  await expect(custSelect).toBeVisible();
  const custSelectBg = await custSelect.evaluate((el) => window.getComputedStyle(el).backgroundImage);
  expect(custSelectBg).toContain('data:image/svg+xml');

  // 4. Supplier Ledger
  await page.goto('http://localhost:4173/plastic-erp/supplier-ledger');
  await expect(page.locator('h1')).toContainText(/Supplier Ledger/i);
  const supplierTab = page.locator('.fin-tabs-bar .sb-tab-btn.is-active');
  await expect(supplierTab).toContainText(/Supplier Ledger/i);

  console.log('ALL VISUAL CSS CHECKS PASSED PERFECTLY!');
});
