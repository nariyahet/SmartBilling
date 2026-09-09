// @ts-check
import { test, expect } from '@playwright/test';

test.describe('SmartBilling E2E - Products CRUD Lifecycle', () => {
  // Generate a distinct timestamped test product name for safe scoping and cleanup
  const testTimestamp = Date.now();
  const testProductName = `PW-Test-Product-${testTimestamp}`;
  const initialPrice = '149.50';
  const initialStock = '42';
  const updatedPrice = '249.99';
  const updatedStock = '88';

  // Track console errors and dialog messages
  /** @type {string[]} */
  const consoleErrors = [];
  /** @type {string[]} */
  const dialogLogs = [];

  // Capture screenshot on failure
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const screenshotPath = `test-results/failure-${testInfo.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[QA Report] Failure screenshot captured at: ${screenshotPath}`);
    }

    // Safety cleanup: If test product still exists in table, clean it up safely
    try {
      const remainingRow = page.locator('tbody tr').filter({ hasText: testProductName });
      const count = await remainingRow.count();
      if (count === 1) {
        console.log(`[Safety Cleanup] Removing created test product: ${testProductName}`);
        page.once('dialog', async (d) => await d.accept());
        await remainingRow.getByRole('button', { name: /Delete/i }).click();
        await page.waitForTimeout(1000);
      }
    } catch {
      // Ignore cleanup error in teardown
    }
  });

  test('should successfully CREATE, READ, UPDATE, and DELETE a product', async ({ page }) => {
    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for window alerts / confirms
    page.on('dialog', async (dialog) => {
      dialogLogs.push(`[${dialog.type()}] ${dialog.message()}`);
    });

    // -------------------------------------------------------------
    // Step 1: Open application & Step 2: Login using Demo account
    // -------------------------------------------------------------
    console.log('[Step 1 & 2] Navigating to login page and authenticating with Demo account...');
    await page.goto('https://smartbilling-sigma.vercel.app/');

    await expect(page.getByRole('heading', { name: /Smart Billing/i })).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder('Enter your email').fill('demo@smartbilling.com');
    await page.getByPlaceholder('Enter your password').fill('Demo@12345');
    await page.getByRole('button', { name: /Login/i }).click();

    // -------------------------------------------------------------
    // Step 3: Verify Dashboard loads successfully
    // -------------------------------------------------------------
    console.log('[Step 3] Verifying Dashboard load...');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 25000 });
    await expect(page.getByRole('link', { name: /Dashboard/i })).toBeVisible({ timeout: 20000 });

    // -------------------------------------------------------------
    // Step 4: Navigate to Products
    // -------------------------------------------------------------
    console.log('[Step 4] Navigating to Products page...');
    const productsNavLink = page.getByRole('link', { name: /Products/i });
    await expect(productsNavLink).toBeVisible();
    await productsNavLink.click();

    // -------------------------------------------------------------
    // Step 5 & 6: Inspect and verify the Products page loads
    // -------------------------------------------------------------
    console.log('[Step 5 & 6] Verifying Products page loaded correctly...');
    await expect(page).toHaveURL(/.*\/products/, { timeout: 15000 });

    // Check header section and catalog elements
    await expect(page.getByRole('heading', { name: 'Products Management' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Manage your product catalog, prices, and warehouse inventory stock levels.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Products Catalog' })).toBeVisible();

    // Verify KPI summary cards
    await expect(page.getByText('Total Products')).toBeVisible();
    await expect(page.locator('.prod-kpi-card', { hasText: 'In Stock' })).toBeVisible();

    // -------------------------------------------------------------
    // Step 7: CREATE - Add a NEW test product
    // -------------------------------------------------------------
    console.log(`[Step 7 - CREATE] Creating new test product: ${testProductName}...`);
    // Click the Add Product button to open modal
    const openAddModalBtn = page.getByRole('button', { name: /Add Product/i }).first();
    await expect(openAddModalBtn).toBeVisible();
    await openAddModalBtn.click();

    // Verify Add Product modal opened
    const modalBox = page.locator('.prod-modal-box');
    await expect(modalBox).toBeVisible({ timeout: 5000 });
    await expect(modalBox.getByText('➕ Add New Product')).toBeVisible();

    // Fill form fields
    const nameInput = page.getByPlaceholder('e.g. Premium Cotton Shirt, Plastic Pellets');
    const priceInput = page.getByPlaceholder('0.00');
    const stockInput = page.getByPlaceholder('e.g. 50');

    await nameInput.fill(testProductName);
    await priceInput.fill(initialPrice);
    await stockInput.fill(initialStock);

    // Save product
    const submitAddBtn = modalBox.getByRole('button', { name: 'Add Product' });
    await expect(submitAddBtn).toBeVisible();
    await submitAddBtn.click();

    // Verify modal closes
    await expect(modalBox).not.toBeVisible({ timeout: 10000 });

    // Verify newly created product appears in the table
    const createdProductRow = page.locator('tbody tr').filter({ hasText: testProductName });
    await expect(createdProductRow).toBeVisible({ timeout: 15000 });
    console.log('[Step 7 - CREATE: PASS] Product created and visible in catalog.');

    // -------------------------------------------------------------
    // Step 8: READ - Search / find the newly created test product
    // -------------------------------------------------------------
    console.log(`[Step 8 - READ] Searching for test product: ${testProductName}...`);
    const filterInput = page.getByPlaceholder('Filter by name...');
    await filterInput.fill(testProductName);

    // Verify row displays expected details
    await expect(createdProductRow).toBeVisible({ timeout: 10000 });
    await expect(createdProductRow.locator('.prod-name-text')).toHaveText(testProductName);
    await expect(createdProductRow.locator('.prod-price-text')).toContainText('149.50');
    await expect(createdProductRow.locator('.prod-stock-num')).toHaveText('42 units');

    // Clear filter to return catalog to unfiltered view
    await filterInput.fill('');
    await expect(createdProductRow).toBeVisible({ timeout: 10000 });
    console.log('[Step 8 - READ: PASS] Product found with matching name, price, and stock.');

    // -------------------------------------------------------------
    // Step 9: UPDATE - Edit ONLY the newly created test product
    // -------------------------------------------------------------
    console.log(`[Step 9 - UPDATE] Updating test product: ${testProductName}...`);
    // Safety check: ensure target row strictly matches our unique product name
    await expect(createdProductRow).toHaveCount(1);

    const editBtn = createdProductRow.getByRole('button', { name: /Edit/i });
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Verify Edit Product modal opened
    await expect(modalBox).toBeVisible({ timeout: 5000 });
    await expect(modalBox.getByText('✏️ Edit Product')).toBeVisible();

    // Verify fields are pre-populated with current values
    await expect(nameInput).toHaveValue(testProductName);

    // Update Price and Stock
    await priceInput.fill(updatedPrice);
    await stockInput.fill(updatedStock);

    // Save updates
    const submitUpdateBtn = modalBox.getByRole('button', { name: 'Update Product' });
    await expect(submitUpdateBtn).toBeVisible();
    await submitUpdateBtn.click();

    // Verify modal closes
    await expect(modalBox).not.toBeVisible({ timeout: 10000 });

    // Verify updated values appear in the Products list
    await expect(createdProductRow.locator('.prod-price-text')).toContainText('249.99', { timeout: 10000 });
    await expect(createdProductRow.locator('.prod-stock-num')).toHaveText('88 units');
    console.log('[Step 9 - UPDATE: PASS] Product updated and verified with new price (249.99) and stock (88 units).');

    // -------------------------------------------------------------
    // Step 10 & 11: DELETE & SAFETY - Delete ONLY the created test product
    // -------------------------------------------------------------
    console.log(`[Step 10 & 11 - DELETE & SAFETY] Safely deleting test product: ${testProductName}...`);
    // STRICT SAFETY CHECK:
    // 1. Confirm product name follows our unique automated test pattern
    expect(
      testProductName.startsWith('PW-Test-Product-'),
      'CRITICAL SAFETY CHECK: Product name does not match expected test pattern!'
    ).toBe(true);

    // 2. Filter to our exact row and ensure exactly 1 matching record exists
    const deleteCandidate = page.locator('tbody tr').filter({ hasText: testProductName });
    const matchCount = await deleteCandidate.count();
    expect(
      matchCount,
      `CRITICAL SAFETY CHECK: Expected exactly 1 match for test product, found ${matchCount}. Aborting delete!`
    ).toBe(1);

    // 3. Register one-time handler for confirmation dialog
    page.once('dialog', async (confirmDialog) => {
      console.log(`[Delete Dialog] Accepting confirmation: "${confirmDialog.message()}"`);
      await confirmDialog.accept();
    });

    // 4. Click delete on ONLY the target test product
    const deleteBtn = deleteCandidate.getByRole('button', { name: /Delete/i });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // 5. Verify the product is no longer present in the list
    await expect(page.locator('tbody tr').filter({ hasText: testProductName })).toHaveCount(0, { timeout: 15000 });

    // 6. Double check using the search filter
    await filterInput.fill(testProductName);
    await expect(page.getByText('No Products Found')).toBeVisible({ timeout: 10000 });
    console.log('[Step 10 & 11 - DELETE & SAFETY: PASS] Test product successfully deleted and cleanup verified.');

    // -------------------------------------------------------------
    // Step 12: VALIDATION - Check for errors
    // -------------------------------------------------------------
    console.log(`[Step 12 - VALIDATION] Dialog logs during run: ${JSON.stringify(dialogLogs)}`);
    console.log(`[Step 12 - VALIDATION] Console error count: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log(`[Step 12 - VALIDATION] Console errors encountered: ${JSON.stringify(consoleErrors)}`);
    }
  });
});
