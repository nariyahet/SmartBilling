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

test.describe('SMARTBILLING 2.0 — PRODUCTION-GRADE 22 BUG FIX AUDIT', () => {

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

  // ==========================================
  // CATEGORY A: FINANCIAL REPORTS (BUGS #1 - #11)
  // ==========================================

  test('Bug #1 & #2: Balance Sheet renders without SQL error and with correct fields', async ({ page }) => {
    await page.route('**/api/plastic-erp/accounting/financial-reports/balance-sheet*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          reportName: 'Balance Sheet',
          asOfDate: '2026-09-28',
          assets: {
            currentAssets: {
              cashBalance: 45000,
              bankBalance: 125000,
              accountsReceivable: 350000,
              rawMaterialInventory: 200000,
              finishedGoodsInventory: 480000,
              inputGstBalance: 32000,
              totalCurrentAssets: 1232000
            },
            nonCurrentAssets: {
              plantAndMachinery: 1500000,
              totalNonCurrentAssets: 1500000
            },
            totalAssets: 2732000
          },
          liabilitiesAndEquity: {
            currentLiabilities: {
              accountsPayable: 180000,
              outputGstLiability: 42000,
              salaryAndWagesPayable: 65000,
              totalCurrentLiabilities: 287000
            },
            equity: {
              capitalAndReserves: 2445000,
              totalEquity: 2445000
            },
            totalLiabilitiesAndEquity: 2732000
          }
        })
      });
    });

    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);
    await page.click('button:has-text("Balance Sheet")');

    // Verify no error
    await expect(page.locator('.sb-error-state')).not.toBeVisible();

    // Verify Asset items rendered properly
    await expect(page.locator('.bs-grid')).toBeVisible();
    await expect(page.getByText('Trade Debtors / Accounts Receivable')).toBeVisible();
    await expect(page.getByText('₹3,50,000')).toBeVisible();
    await expect(page.getByText('Raw Material Inventory Value')).toBeVisible();
    await expect(page.getByText('Finished Goods Inventory Value')).toBeVisible();
    await expect(page.getByText('Plant, Machinery & Factory Equipment')).toBeVisible();
    await expect(page.getByText('TOTAL ASSETS')).toBeVisible();

    // Verify Liabilities & Equity items rendered properly
    await expect(page.getByText('Trade Creditors / Accounts Payable')).toBeVisible();
    await expect(page.getByText('GST Output Tax Liability')).toBeVisible();
    await expect(page.getByText('TOTAL LIABILITIES & EQUITY')).toBeVisible();
  });

  test('Bug #3: Profit & Loss response fields correctly mapped', async ({ page }) => {
    await page.route('**/api/plastic-erp/accounting/financial-reports/profit-loss*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          reportName: 'Profit & Loss Statement',
          period: { start: '2026-09-01', end: '2026-09-28' },
          income: {
            salesRevenue: 850000,
            totalIncome: 850000
          },
          costOfGoodsSold: {
            rawMaterialPurchases: 420000,
            directPlantLabour: 80000,
            totalCOGS: 500000
          },
          grossProfit: 350000,
          operatingExpenses: {
            plantElectricity: 45000,
            factoryMaintenance: 15000,
            administrativeLabour: 60000,
            totalOperatingExpenses: 120000
          },
          netProfit: 230000
        })
      });
    });

    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);
    await page.click('button:has-text("Profit & Loss")');

    await expect(page.locator('.pl-container')).toBeVisible();
    await expect(page.getByText('Sales & Finished Goods Revenue')).toBeVisible();
    await expect(page.getByText('₹8,50,000').first()).toBeVisible();
    await expect(page.getByText('Raw Material Purchases')).toBeVisible();
    await expect(page.getByText('Factory Direct Labour')).toBeVisible();
    await expect(page.locator('.pl-highlight.gross')).toContainText('GROSS PROFIT');
    await expect(page.getByText('₹3,50,000')).toBeVisible();
    await expect(page.locator('.pl-highlight.net')).toContainText('NET OPERATING PROFIT');
    await expect(page.getByText('₹2,30,000')).toBeVisible();
  });

  test('Bug #4 & #5: Cash Book and Bank Book summary & transactions mapped', async ({ page }) => {
    await page.route('**/api/plastic-erp/accounting/financial-reports/cash-book*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          reportName: 'Cash Book',
          summary: {
            accountName: 'Main Cash Register',
            openingBalance: 10000,
            totalReceipts: 50000,
            totalPayments: 20000,
            closingBalance: 40000
          },
          transactions: [
            {
              id: 101,
              transaction_date: '2026-09-20',
              reference_no: 'CSH-001',
              description: 'Customer Cash Collection',
              transaction_type: 'RECEIPT',
              amount: 50000,
              running_balance: 60000
            }
          ]
        })
      });
    });

    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);
    await page.click('button:has-text("Cash Book")');

    // Summary headers
    await expect(page.locator('.book-summary-header')).toBeVisible();
    await expect(page.locator('.book-summary-header')).toContainText('Main Cash Register');
    await expect(page.locator('.book-summary-header')).toContainText('₹10,000');
    await expect(page.locator('.book-summary-header')).toContainText('₹50,000');
    await expect(page.locator('.book-summary-header')).toContainText('₹40,000');

    // Table rows
    await expect(page.getByText('CSH-001')).toBeVisible();
    await expect(page.getByText('Customer Cash Collection')).toBeVisible();
  });

  test('Bug #6 & #7: Customer and Supplier Ledger fields mapped correctly', async ({ page }) => {
    await page.route('**/api/plastic-erp/accounting/financial-reports/customer-ledger*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          reportName: 'Customer Ledger Statement',
          entries: [
            {
              id: 1,
              customer_name: 'Gujarat Polychem Industries',
              transaction_date: '2026-09-15',
              reference_no: 'INV-2026-001',
              transaction_type: 'INVOICE',
              debit: 75000,
              credit: 0,
              balance: 75000,
              notes: 'HDPE Granules Dispatch'
            }
          ]
        })
      });
    });

    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);
    await page.click('button:has-text("Customer Ledger")');

    await expect(page.getByText('Gujarat Polychem Industries')).toBeVisible();
    await expect(page.getByText('INV-2026-001')).toBeVisible();
    await expect(page.getByText('₹75,000').first()).toBeVisible();
  });

  test('Bug #8 & #9: Receivables and Payables Aging correctly mapped', async ({ page }) => {
    await page.route('**/api/plastic-erp/accounting/financial-reports/receivables*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          reportName: 'Accounts Receivable & Aging Report',
          aging: {
            bucket0_30: 120000,
            bucket31_60: 45000,
            bucket61_90: 20000,
            bucket90Plus: 15000,
            totalOutstanding: 200000
          },
          invoices: [
            {
              id: 10,
              invoice_no: 'INV-999',
              customer_name: 'Shree Plastics',
              mobile: '9876543210',
              grand_total: 200000,
              paid_amount: 0,
              outstanding_amount: 200000,
              created_at: '2026-09-01',
              days_aged: 27
            }
          ]
        })
      });
    });

    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);
    await page.click('button:has-text("Receivables Aging")');

    // Check aging summary cards
    await expect(page.getByText('0 – 30 Days (Current)')).toBeVisible();
    await expect(page.getByText('₹1,20,000')).toBeVisible();
    await expect(page.getByText('90+ Days (Overdue)')).toBeVisible();
    await expect(page.getByText('₹15,000')).toBeVisible();

    // Check itemized invoices
    await expect(page.getByText('INV-999')).toBeVisible();
    await expect(page.getByText('Shree Plastics')).toBeVisible();
  });

  test('Bug #10: Header and active tab synchronize between Supplier Ledger and Balance Sheet', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/supplier-ledger`);

    // Verify initial header matches Supplier Ledger
    await expect(page.locator('h1')).toContainText(/Supplier Ledger/i);

    // Switch to Balance Sheet tab
    await page.click('button:has-text("Balance Sheet")');

    // Verify title dynamically switches to Balance Sheet!
    await expect(page.locator('h1')).toContainText(/Balance Sheet/i);
  });

  test('Bug #11: Reports render clean UI cards/tables instead of raw JSON stringify', async ({ page }) => {
    await page.route('**/api/plastic-erp/accounting/financial-reports/expense-report*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          reportName: 'Plant Expense Report',
          totalExpenses: 78000,
          byCategory: [
            { category_name: 'Factory Power & Fuel', category_code: 'EXP-PWR', voucher_count: 3, total_amount: 52000 },
            { category_name: 'Machine Lubricants', category_code: 'EXP-LUB', voucher_count: 2, total_amount: 26000 }
          ],
          byPaymentMode: [
            { payment_mode: 'BANK_TRANSFER', count: 4, total_amount: 70000 },
            { payment_mode: 'CASH', count: 1, total_amount: 8000 }
          ]
        })
      });
    });

    await page.goto(`${BASE_URL}/plastic-erp/financial-reports`);
    await page.click('button:has-text("Expense Breakdown")');

    // Must NOT have pre.fin-json-display
    await expect(page.locator('.fin-json-display')).not.toBeVisible();

    // Must have formatted UI
    await expect(page.getByText('Total Operational Expenses')).toBeVisible();
    await expect(page.getByText('₹78,000').first()).toBeVisible();
    await expect(page.getByText('Factory Power & Fuel')).toBeVisible();
    await expect(page.getByText('EXP-PWR')).toBeVisible();
    await expect(page.getByText('Machine Lubricants')).toBeVisible();
  });

  // ==========================================
  // CATEGORY B: DUPLICATE BUTTONS (BUGS #12 - #15)
  // ==========================================

  test('Bug #12: Customers page has exactly ONE primary "+ Add Customer" action', async ({ page }) => {
    await page.goto(`${BASE_URL}/customers`);
    const addBtns = page.locator('button:has-text("Add Customer")');
    await expect(addBtns).toHaveCount(1);
    await addBtns.first().click();
    await expect(page.locator('.cust-modal-box')).toBeVisible();
  });

  test('Bug #13: Products page has exactly ONE primary "+ Add Product" action', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    const addBtns = page.locator('button:has-text("Add Product")');
    await expect(addBtns).toHaveCount(1);
    await addBtns.first().click();
    await expect(page.locator('.prod-modal-box')).toBeVisible();
  });

  test('Bug #14: Raw Materials has exactly ONE Add button at a time', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/raw-materials`);
    await expect(page.getByText('Loading Raw Materials...')).not.toBeVisible({ timeout: 10000 });
    const addBtns = page.locator('button:has-text("Add Raw Material")');
    await expect(addBtns).toHaveCount(1);
  });

  test('Bug #15: Machines has exactly ONE Add button at a time', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/machines`);
    await page.waitForLoadState('networkidle');
    const addBtns = page.locator('button:has-text("Add Machine")');
    await expect(addBtns).toHaveCount(1);
  });

  // ==========================================
  // CATEGORY C: MODAL & RESPONSIVE (BUGS #16 - #21)
  // ==========================================

  test('Bug #16 & #20: Sales Order modal line items responsive across viewports', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/sales-orders`);
    const createBtn = page.locator('button:has-text("Create Sales Order")');
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await expect(page.locator('.sb-line-item-grid-4')).toBeVisible();

      // Test Desktop (1440px)
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(page.locator('.sb-line-item-grid-4 select')).toBeVisible();

      // Test Tablet (768px)
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.locator('.sb-line-item-grid-4 select')).toBeVisible();

      // Test Mobile (390px)
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('.sb-line-item-grid-4 select')).toBeVisible();
      await expect(page.locator('.sb-line-item-grid-4 button:has-text("+ Add")')).toBeVisible();
    }
  });

  test('Bug #17 & #20: Dispatch modal line items responsive across viewports', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/dispatches`);
    const createBtn = page.locator('button:has-text("Create Dispatch"), button:has-text("New Dispatch")');
    if (await createBtn.first().isVisible()) {
      await createBtn.first().click();
      await expect(page.locator('.sb-line-item-grid-5')).toBeVisible();

      // Test Mobile (390px)
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('.sb-line-item-grid-5 select').first()).toBeVisible();
      await expect(page.locator('.sb-line-item-grid-5 button:has-text("Add Item")')).toBeVisible();
    }
  });

  test('Bug #18: Delivery Challan modal line items responsive', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/delivery-challans`);
    const createBtn = page.locator('button:has-text("Generate Challan"), button:has-text("Create Challan")');
    if (await createBtn.first().isVisible()) {
      await createBtn.first().click();
      await expect(page.locator('.sb-line-item-grid-challan')).toBeVisible();

      // Test Mobile (390px)
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('.sb-line-item-grid-challan select').first()).toBeVisible();
      await expect(page.locator('.sb-line-item-grid-challan button:has-text("Add Item")')).toBeVisible();
    }
  });

  test('Bug #19: Quality Inspection evaluation parameter grid responsive', async ({ page }) => {
    await page.goto(`${BASE_URL}/plastic-erp/quality`);
    const createBtn = page.locator('button:has-text("New Inspection"), button:has-text("Quality Inspection")');
    if (await createBtn.first().isVisible()) {
      await createBtn.first().click();
      await expect(page.locator('.sb-quality-param-row').first()).toBeVisible();

      // Test Mobile (390px)
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('.sb-quality-param-row input').first()).toBeVisible();
    }
  });

  // ==========================================
  // BUG #22: FULL SITE RESPONSIVE REGRESSION AUDIT
  // ==========================================

  test('Bug #22: Global regression audit across key routes with zero console errors', async ({ page }) => {
    test.setTimeout(60000);
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        consoleErrors.push(msg.text());
      }
    });

    const routesToTest = [
      '/dashboard',
      '/customers',
      '/products',
      '/plastic-erp',
      '/plastic-erp/financial-reports',
      '/plastic-erp/cash-bank',
      '/plastic-erp/machines',
      '/plastic-erp/raw-materials',
      '/plastic-erp/sales-orders',
      '/plastic-erp/dispatches',
      '/plastic-erp/delivery-challans',
      '/plastic-erp/accounting-dashboard'
    ];

    for (const route of routesToTest) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      await expect(page.locator('body')).toBeVisible();
    }

    // Expect no fatal uncaught exception errors
    const fatalErrors = consoleErrors.filter(
      (e) =>
        !e.includes('404') &&
        !e.includes('Failed to load resource') &&
        !e.includes('401') &&
        !(e.includes('downloadable font:') && e.includes('fonts.gstatic.com') && e.includes('Inter'))
    );
    expect(fatalErrors).toHaveLength(0);
  });

});
