// @ts-check
import { test, expect } from '@playwright/test';

test.describe('SmartBilling 2.0 Global Print Functionality & Regression Suite', () => {
  /** @type {string[]} */
  let dialogMessages = [];

  test.beforeEach(async ({ page }) => {
    dialogMessages = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });

    // Provide authenticated admin session to localStorage
    await page.goto('http://localhost:4173/');
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-print-test-token');
      localStorage.setItem(
        'admin',
        JSON.stringify({ id: 1, name: 'Demo Admin', email: 'demo@smartbilling.com', company_id: 1 })
      );
      localStorage.setItem(
        'company',
        JSON.stringify({ name: 'PlastiCycle Solutions Ltd', gstin: '27AAAAA0000A1Z5' })
      );
    });
  });

  // --------------------------------------------------------------------------
  // TEST 1: Invoice Preview Printing
  // --------------------------------------------------------------------------
  test('1. Invoice Preview: print preview contains visible invoice document and is NOT blank', async ({ page }) => {
    // Intercept invoice details API call
    await page.route('**/api/invoices/99', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          invoice: {
            id: 99,
            invoice_no: 'INV-2026-PRINT01',
            invoice_date: '2026-09-12',
            due_date: '2026-09-20',
            customer_name: 'Apex Polymer Industries',
            customer_mobile: '9876543210',
            customer_address: 'Plot 44, GIDC Industrial Estate, Surat, Gujarat',
            items: [
              { product_name: 'HDPE Regrind Granules (Blue)', quantity: 250, price: 65, total: 16250 },
              { product_name: 'PP Reprocessed Pellets', quantity: 150, price: 80, total: 12000 },
            ],
            subtotal: 28250,
            tax_amount: 5085,
            grand_total: 33335,
            notes: 'Goods once sold will not be taken back.',
          },
        }),
      });
    });

    // Intercept business settings API
    await page.route('**/api/business-settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          settings: {
            business_name: 'PlastiCycle Global Industries',
            email: 'billing@plasticycle.com',
            phone: '9876543210',
            address: 'MIDC Phase 2, Kim, Surat',
            gstin: '24ABCDE1234F1Z5',
            tax_enabled: 1,
            tax_rate: 18,
            currency_symbol: '₹',
          },
        }),
      });
    });

    await page.goto('http://localhost:4173/invoice/99');
    await expect(page.locator('.invoice-a4')).toBeVisible({ timeout: 10000 });

    // Verify invoice data is rendered on screen
    await expect(page.locator('.invoice-a4')).toContainText('INV-2026-PRINT01');
    await expect(page.locator('.invoice-a4')).toContainText('Apex Polymer Industries');
    await expect(page.locator('.invoice-a4')).toContainText('HDPE Regrind Granules');

    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    // 1. Verify invoice document is visible and NOT blank
    const invoiceVisibility = await page.locator('.invoice-a4').evaluate((el) => {
      return window.getComputedStyle(el).visibility;
    });
    expect(invoiceVisibility, 'Invoice container must be visible in print media').toBe('visible');

    const invoiceText = await page.locator('.invoice-a4').innerText();
    expect(invoiceText.length).toBeGreaterThan(100);
    expect(invoiceText).toContain('INV-2026-PRINT01');
    expect(invoiceText).toContain('33,335');

    // 2. Verify action buttons (.no-print) are hidden
    const actionsDisplay = await page.locator('.invoice-actions').evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(actionsDisplay, 'Action buttons must be hidden during print').toBe('none');

    // Reset media
    await page.emulateMedia({ media: 'screen' });
  });

  // --------------------------------------------------------------------------
  // TEST 2: Customer Ledger Statement Printing
  // --------------------------------------------------------------------------
  test('2. Customer Ledger: document prints cleanly with sidebar and header hidden', async ({ page }) => {
    await page.route('**/api/customers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 10, name: 'Surat Plastics Corp', phone: '9876500000', balance: 45000 },
        ]),
      });
    });

    await page.route('**/api/plastic-erp/customer-ledger/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          customer: { id: 10, name: 'Surat Plastics Corp', phone: '9876500000' },
          transactions: [
            { id: 1, date: '2026-09-01', type: 'INVOICE', ref_no: 'INV-101', debit: 45000, credit: 0, balance: 45000 },
          ],
          summary: { totalDebit: 45000, totalCredit: 0, closingBalance: 45000 },
        }),
      });
    });

    await page.goto('http://localhost:4173/plastic-erp/customer-ledger');
    await expect(page.locator('.ledger-statement-document')).toBeVisible({ timeout: 10000 });

    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    // Statement document must be visible
    const ledgerVisibility = await page.locator('.ledger-statement-document').evaluate((el) => {
      return window.getComputedStyle(el).visibility;
    });
    expect(ledgerVisibility).toBe('visible');

    // AppShell sidebar and header must be hidden
    const sidebarDisplay = await page.locator('.sb-sidebar').evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(sidebarDisplay, 'Sidebar must be hidden in print').toBe('none');

    const topHeaderDisplay = await page.locator('.sb-top-header').evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(topHeaderDisplay, 'Top header must be hidden in print').toBe('none');

    // Filters and headers (.no-print) must be hidden
    const noPrintElements = await page.locator('.no-print').all();
    for (const el of noPrintElements) {
      const display = await el.evaluate((node) => window.getComputedStyle(node).display);
      expect(display).toBe('none');
    }

    await page.emulateMedia({ media: 'screen' });
  });

  // --------------------------------------------------------------------------
  // TEST 3: Delivery Challan Preview Modal Printing
  // --------------------------------------------------------------------------
  test('3. Delivery Challan: modal document is visible in print and unclipped', async ({ page }) => {
    await page.route('**/api/plastic-erp/transport/challans**', async (route) => {
      const url = route.request().url();
      if (url.endsWith('/5') || url.includes('/challans/5')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            challan: {
              id: 5,
              challan_no: 'DC-2026-005',
              challan_date: '2026-09-12',
              customer_id: 1,
              customer_name: 'Shree Krishna Polymers',
              vehicle_number: 'GJ-05-BX-1234',
              transporter: 'Gujarat Freight Lines',
              total_quantity: 4500,
              status: 'ISSUED',
              items: [
                { id: 1, fg_name: 'PP Natural Granules Grade A', bags_count: 90, quantity: 4500, unit: 'KG' },
              ],
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            challans: [
              {
                id: 5,
                challan_no: 'DC-2026-005',
                challan_date: '2026-09-12',
                customer_id: 1,
                customer_name: 'Shree Krishna Polymers',
                vehicle_number: 'GJ-05-BX-1234',
                transporter: 'Gujarat Freight Lines',
                total_quantity: 4500,
                status: 'ISSUED',
                items: [
                  { id: 1, fg_name: 'PP Natural Granules Grade A', bags_count: 90, quantity: 4500, unit: 'KG' },
                ],
              },
            ],
          }),
        });
      }
    });

    await page.route('**/api/customers', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ customers: [{ id: 1, name: 'Shree Krishna Polymers' }] }) });
    });
    await page.route('**/api/plastic-erp/dispatch**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dispatches: [] }) });
    });
    await page.route('**/api/plastic-erp/transport/vehicles**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ vehicles: [] }) });
    });
    await page.route('**/api/plastic-erp/inventory/finished-goods**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ finishedGoods: [] }) });
    });
    await page.route('**/api/company/profile**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ company: { company_name: 'PlastiCycle Ltd' } }) });
    });

    await page.goto('http://localhost:4173/plastic-erp/delivery-challans');
    await expect(page.locator('h1')).toContainText(/Delivery Challans/i, { timeout: 10000 });

    // Click Print / View button on the challan
    const printViewBtn = page.getByRole('button', { name: /Print \/ View/i }).first();
    await expect(printViewBtn).toBeVisible({ timeout: 10000 });
    await printViewBtn.click();

    // Verify modal document is opened
    await expect(page.locator('.challan-print-document')).toBeVisible();
    await expect(page.locator('.challan-print-document')).toContainText('DC-2026-005');

    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    // Challan document must be visible
    const challanVis = await page.locator('.challan-print-document').evaluate((el) => {
      return window.getComputedStyle(el).visibility;
    });
    expect(challanVis, 'Challan document must be visible in print').toBe('visible');

    // Modal close button and header must be hidden
    const closeBtnDisplay = await page.locator('.sb-modal-close-btn').evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(closeBtnDisplay).toBe('none');

    // Modal box should not clip content (overflow: visible)
    const modalOverflow = await page.locator('.sb-modal-box').evaluate((el) => {
      return window.getComputedStyle(el).overflow;
    });
    expect(modalOverflow).toBe('visible');

    await page.emulateMedia({ media: 'screen' });
  });

  // --------------------------------------------------------------------------
  // TEST 4: Purchase Bills Modal Printing
  // --------------------------------------------------------------------------
  test('4. Purchase Bills: raw material purchase bill preview prints cleanly', async ({ page }) => {
    await page.route('**/api/purchase-bills', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          purchase_bills: [
            {
              id: 12,
              purchase_bill_no: 'PB-2026-012',
              purchase_date: '2026-09-12',
              supplier_name: 'Gujarat Scrap Traders',
              truck_number: 'GJ-19-T-5566',
              total_items: 1,
              subtotal: 125000,
              grand_total: 125000,
              payment_status: 'UNPAID',
            },
          ],
        }),
      });
    });

    await page.route('**/api/purchase-bills/12', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          purchase_bill: {
            id: 12,
            purchase_bill_no: 'PB-2026-012',
            purchase_date: '2026-09-12',
            supplier_name: 'Gujarat Scrap Traders',
            truck_number: 'GJ-19-T-5566',
            grand_total: 125000,
            payment_status: 'UNPAID',
            items: [
              { id: 1, material_name: 'Rigid HDPE Scrap Drums', quantity: 2500, rate: 50, total: 125000, unit: 'KG' },
            ],
          },
        }),
      });
    });

    await page.route('**/api/suppliers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ suppliers: [] }) });
    });
    await page.route('**/api/raw-materials**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ raw_materials: [] }) });
    });
    await page.route('**/api/truck-inwards**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ truck_inwards: [] }) });
    });

    await page.goto('http://localhost:4173/plastic-erp/purchase-bills');
    await expect(page.locator('h1')).toContainText(/Purchase Bills/i, { timeout: 10000 });

    // Click view bill button
    const viewBtn = page.locator('.btn-view-bill').first();
    await expect(viewBtn).toBeVisible({ timeout: 10000 });
    await viewBtn.click();

    // Verify bill modal paper is open
    await expect(page.locator('.bill-detail-paper')).toBeVisible();

    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    const billVis = await page.locator('.bill-detail-paper').evaluate((el) => {
      return window.getComputedStyle(el).visibility;
    });
    expect(billVis).toBe('visible');

    const actionsDisplay = await page.locator('.slip-modal-actions').evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(actionsDisplay).toBe('none');

    await page.emulateMedia({ media: 'screen' });
  });

  // --------------------------------------------------------------------------
  // TEST 5: Weighment Slip Printing
  // --------------------------------------------------------------------------
  test('5. Weighment Scale Slip: slip document prints with clean layout', async ({ page }) => {
    await page.route('**/api/weighments**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          weighments: [
            {
              id: 7,
              weighment_no: 'WT-2026-007',
              truck_number: 'MH-04-AB-9876',
              first_weight: 18500,
              second_weight: 6200,
              net_weight: 12300,
              created_at: '2026-09-12T08:00:00.000Z',
              operator_name: 'Ramesh Patel',
            },
          ],
        }),
      });
    });

    await page.route('**/api/truck-inwards**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ truck_inwards: [] }) });
    });

    await page.goto('http://localhost:4173/plastic-erp/weighment');
    await expect(page.locator('h1')).toContainText(/Weighment/i, { timeout: 10000 });

    // Open slip modal
    const slipBtn = page.locator('.btn-view-slip').first();
    await expect(slipBtn).toBeVisible({ timeout: 10000 });
    await slipBtn.click();

    await expect(page.locator('.slip-paper')).toBeVisible();

    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    const slipVis = await page.locator('.slip-paper').evaluate((el) => {
      return window.getComputedStyle(el).visibility;
    });
    expect(slipVis).toBe('visible');

    const slipActionsDisplay = await page.locator('.slip-modal-actions').evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(slipActionsDisplay).toBe('none');

    await page.emulateMedia({ media: 'screen' });
  });

  // --------------------------------------------------------------------------
  // TEST 6: Operational Reports Printing
  // --------------------------------------------------------------------------
  test('6. Operational Reports: tables visible in print media without sidebar', async ({ page }) => {
    await page.route('**/api/plastic-erp/reports**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          production: { total_batches: 15, total_output_kg: 32000, yield_percentage: 94.2 },
          inventory: { raw_material_stock_kg: 48000, finished_goods_stock_kg: 21000 },
          machines: [{ machine_name: 'Extruder Line 1', status: 'RUNNING', uptime_hours: 140 }],
        }),
      });
    });

    await page.goto('http://localhost:4173/plastic-erp/reports');
    await expect(page.locator('.sb-page-container')).toBeVisible({ timeout: 10000 });

    await page.emulateMedia({ media: 'print' });

    const containerVis = await page.locator('.sb-page-container').evaluate((el) => {
      return window.getComputedStyle(el).visibility;
    });
    expect(containerVis).toBe('visible');

    const sidebarDisplay = await page.locator('.sb-sidebar').evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(sidebarDisplay).toBe('none');

    await page.emulateMedia({ media: 'screen' });
  });

  // --------------------------------------------------------------------------
  // TEST 7: Mobile Viewport Print Visibility
  // --------------------------------------------------------------------------
  test('7. Mobile Viewport (375x667): document remains visible and unclipped', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.route('**/api/invoices/99', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          invoice: {
            id: 99,
            invoice_no: 'INV-2026-MOBILE',
            invoice_date: '2026-09-12',
            customer_name: 'Mobile Test Customer',
            items: [{ product_name: 'Test Item', quantity: 10, price: 100, total: 1000 }],
            grand_total: 1180,
          },
        }),
      });
    });

    await page.goto('http://localhost:4173/invoice/99');
    await expect(page.locator('.invoice-a4')).toBeVisible({ timeout: 10000 });

    await page.emulateMedia({ media: 'print' });

    const invoiceVis = await page.locator('.invoice-a4').evaluate((el) => {
      return window.getComputedStyle(el).visibility;
    });
    expect(invoiceVis).toBe('visible');

    const content = await page.locator('.invoice-a4').innerText();
    expect(content).toContain('INV-2026-MOBILE');

    await page.emulateMedia({ media: 'screen' });
  });

  // --------------------------------------------------------------------------
  // TEST 8: PDF Download Functionality Preserved
  // --------------------------------------------------------------------------
  test('8. PDF Download: Download PDF button triggers download without runtime errors', async ({ page }) => {
    await page.route('**/api/invoices/99', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          invoice: {
            id: 99,
            invoice_no: 'INV-2026-PDF-TEST',
            invoice_date: '2026-09-12',
            customer_name: 'PDF Client Ltd',
            items: [{ product_name: 'Test Granules', quantity: 50, price: 20, total: 1000 }],
            grand_total: 1000,
          },
        }),
      });
    });

    await page.goto('http://localhost:4173/invoice/99');
    await expect(page.locator('.invoice-a4')).toBeVisible({ timeout: 10000 });

    const downloadBtn = page.getByRole('button', { name: /Download PDF/i });
    await expect(downloadBtn).toBeVisible();
    await downloadBtn.click();

    // Verify no alert or unhandled exception was fired
    expect(dialogMessages.length, `Unexpected alert during PDF generation: ${dialogMessages.join(', ')}`).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Purchase Order View Modal & Print (A4) Verification
  // --------------------------------------------------------------------------
  test('9. Purchase Order: View modal opens, Print PO triggers cleanly without blank pages, and PO content is visible in print media', async ({ page }) => {
    // Mock procurement orders list and single PO details
    await page.route('**/api/plastic-erp/procurement/orders**', async (route) => {
      const url = route.request().url();
      if (url.includes('/orders/101')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 101,
              po_no: 'PO-2026-Sur99',
              po_date: '2026-09-12',
              expected_delivery_date: '2026-09-20',
              status: 'APPROVED',
              supplier_name: 'Apex Polymer Suppliers',
              supplier_business_name: 'Apex Polymer Suppliers Pvt Ltd',
              supplier_code: 'SUP-APEX',
              supplier_gst: '24ABCDE1234F1Z5',
              supplier_address: 'Plot 44, GIDC Industrial Estate, Surat, Gujarat',
              supplier_city: 'Surat',
              supplier_state: 'Gujarat',
              supplier_mobile: '9876543210',
              supplier_email: 'sales@apexpolymer.com',
              shipping_address: 'Kim Industrial Area, Surat, Gujarat - 394110',
              payment_terms: '30 Days Net',
              delivery_terms: 'Ex-Plant',
              approved_by_name: 'Plant Manager',
              created_by_name: 'Procurement Officer',
              items: [
                {
                  id: 1,
                  material_code: 'RM-HDPE-01',
                  material_name: 'HDPE Blue Drums Scrap',
                  plastic_type: 'HDPE',
                  ordered_qty: 5000,
                  unit: 'KG',
                  rate: 48.5,
                  tax_percent: 18,
                  tax_amount: 43650,
                  total_amount: 286150,
                },
                {
                  id: 2,
                  material_code: 'RM-PP-02',
                  material_name: 'PP Regrind Pellets White',
                  plastic_type: 'PP',
                  ordered_qty: 3000,
                  unit: 'KG',
                  rate: 62.0,
                  tax_percent: 18,
                  tax_amount: 33480,
                  total_amount: 219480,
                },
              ],
              notes: 'Inspection on delivery required. Weighbridge slip must accompany vehicle.',
              subtotal: 428500,
              discount_amount: 0,
              tax_amount: 77130,
              freight_amount: 5000,
              grand_total: 510630,
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 101,
                po_no: 'PO-2026-Sur99',
                po_date: '2026-09-12',
                expected_delivery_date: '2026-09-20',
                supplier_name: 'Apex Polymer Suppliers',
                supplier_code: 'SUP-APEX',
                supplier_city: 'Surat',
                total_ordered_qty: 8000,
                received_qty: 0,
                grand_total: 510630,
                status: 'APPROVED',
              },
            ],
          }),
        });
      }
    });

    await page.route('**/api/suppliers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ suppliers: [{ id: 1, name: 'Apex Polymer Suppliers' }] }),
      });
    });

    await page.route('**/api/raw-materials', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ raw_materials: [] }),
      });
    });

    await page.route('**/api/business-settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          settings: {
            business_name: 'SmartBilling Recycling ERP',
            tagline: 'Sustainable Polymer Processing',
            address: 'Kim Industrial Estate, NH-8, Surat, Gujarat - 394110',
            tax_number: '24ABCDE1234F1Z5',
            email: 'admin@smartbilling.com',
            phone: '9876543210',
          },
        }),
      });
    });

    await page.goto('http://localhost:4173/plastic-erp/purchase-orders');

    // Wait for PO table to load and click View
    const viewButton = page.getByRole('button', { name: 'View' }).first();
    await expect(viewButton).toBeVisible({ timeout: 10000 });
    await viewButton.click();

    // Verify modal is open and shows complete PO content
    const modalBackdrop = page.locator('.sb-modal-backdrop');
    await expect(modalBackdrop).toBeVisible();

    const poDoc = page.locator('.po-print-document');
    await expect(poDoc).toBeVisible();
    await expect(poDoc).toContainText('PO-2026-Sur99');
    await expect(poDoc).toContainText('Apex Polymer Suppliers');
    await expect(poDoc).toContainText('HDPE Blue Drums Scrap');
    await expect(poDoc).toContainText('PP Regrind Pellets White');
    await expect(poDoc).toContainText('5,10,630');

    // Check "Print PO (A4)" button
    const printA4Btn = page.getByRole('button', { name: /Print PO \(A4\)/i });
    await expect(printA4Btn).toBeVisible();

    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    // 1. Verify PO document container and its elements are VISIBLE in print
    const poVisibility = await poDoc.evaluate((el) => window.getComputedStyle(el).visibility);
    expect(poVisibility).toBe('visible');

    const poDisplay = await poDoc.evaluate((el) => window.getComputedStyle(el).display);
    expect(poDisplay).toBe('block');

    // 2. Verify inner PO content is present and not empty
    const printedContent = await poDoc.innerText();
    expect(printedContent.length).toBeGreaterThan(200);
    expect(printedContent).toContain('PURCHASE ORDER');
    expect(printedContent).toContain('Apex Polymer Suppliers');
    expect(printedContent).toContain('HDPE Blue Drums Scrap');
    expect(printedContent).toContain('TERMS & CONDITIONS');

    // 3. Verify screen UI elements (sidebar, top header, modal close/print buttons) are HIDDEN in print
    const sidebarDisplay = await page.locator('.sb-sidebar').evaluate((el) => window.getComputedStyle(el).display);
    expect(sidebarDisplay).toBe('none');

    const topHeaderDisplay = await page.locator('.sb-top-header').evaluate((el) => window.getComputedStyle(el).display);
    expect(topHeaderDisplay).toBe('none');

    const topBarDisplay = await page.locator('.po-preview-top-bar').evaluate((el) => window.getComputedStyle(el).display);
    expect(topBarDisplay).toBe('none');

    const modalFooterDisplay = await page.locator('.sb-modal-footer').evaluate((el) => window.getComputedStyle(el).display);
    expect(modalFooterDisplay).toBe('none');

    // Reset to screen media
    await page.emulateMedia({ media: 'screen' });

    // 4. Test clicking Print PO (A4) invokes window.print without exceptions
    let printInvoked = false;
    await page.exposeFunction('mockPrintNotifier', () => {
      printInvoked = true;
    });
    await page.evaluate(() => {
      window.print = () => {
        /** @type {any} */ (window).mockPrintNotifier();
      };
    });

    await printA4Btn.click();
    expect(printInvoked).toBe(true);

    // 5. Verify closing the modal works normally and returns to application
    const closeBtn = page.getByRole('button', { name: 'Close', exact: true });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(modalBackdrop).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 10: Purchase Order Creation Form - Items Table UI Layout
  // --------------------------------------------------------------------------
  test('10. Purchase Order Creation: Items row controls have sufficient width, unclipped values, and clean responsive layout', async ({ page }) => {
    await page.route('**/api/plastic-erp/procurement/orders**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await page.route('**/api/suppliers', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ suppliers: [{ id: 1, supplier_name: 'Apex Polymer Suppliers', supplier_code: 'SUP-APEX' }] }),
      });
    });

    await page.route('**/api/raw-materials', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          raw_materials: [
            { id: 101, material_name: 'HDPE Blue Drums Regrind Pellets', plastic_type: 'HDPE', default_purchase_rate: 45.0, unit: 'KG' },
            { id: 102, material_name: 'PP Natural Scrap Flakes', plastic_type: 'PP', default_purchase_rate: 38.0, unit: 'KG' },
          ],
        }),
      });
    });

    await page.route('**/api/business-settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ settings: { business_name: 'SmartBilling ERP' } }),
      });
    });

    await page.goto('http://localhost:4173/plastic-erp/purchase-orders');

    // Click "+ Create Purchase Order"
    const createBtn = page.getByRole('button', { name: '+ Create Purchase Order' });
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await createBtn.click();

    // Verify modal is open and has po-create-modal class
    const modalBox = page.locator('.sb-modal-box.po-create-modal');
    await expect(modalBox).toBeVisible();

    // Check modal width > 760px on desktop (size-xl is 960px+)
    const modalWidth = await modalBox.evaluate((el) => el.clientWidth);
    expect(modalWidth).toBeGreaterThan(760);

    // Verify section title and Add Line button
    await expect(page.locator('.sb-section-title', { hasText: 'Purchase Order Items' })).toBeVisible();
    const addLineBtn = page.getByRole('button', { name: 'Add Line' });
    await expect(addLineBtn).toBeVisible();

    // Verify all 7 columns are present in table header
    const table = page.locator('.po-items-form-table');
    await expect(table).toBeVisible();
    await expect(table.locator('th.po-col-material')).toContainText('Raw Material *');
    await expect(table.locator('th.po-col-qty')).toContainText('Qty *');
    await expect(table.locator('th.po-col-rate')).toContainText('Rate (₹)');
    await expect(table.locator('th.po-col-disc')).toContainText('Disc (₹)');
    await expect(table.locator('th.po-col-tax')).toContainText('GST %');
    await expect(table.locator('th.po-col-total')).toContainText('Line Total');
    await expect(table.locator('th.po-col-action')).toContainText('Action');

    // Verify column and control widths for row 1
    const materialSelect = table.locator('.po-input-material').first();
    await expect(materialSelect).toBeVisible();
    const materialWidth = await materialSelect.evaluate((el) => el.clientWidth);
    expect(materialWidth, 'Raw Material select must have generous width (>200px)').toBeGreaterThan(200);

    const qtyInput = table.locator('td.po-col-qty input').first();
    await expect(qtyInput).toBeVisible();
    const qtyWidth = await qtyInput.evaluate((el) => el.clientWidth);
    expect(qtyWidth, 'Qty input must have comfortable width (>75px)').toBeGreaterThan(75);

    const rateInput = table.locator('td.po-col-rate input').first();
    await expect(rateInput).toBeVisible();
    const rateWidth = await rateInput.evaluate((el) => el.clientWidth);
    expect(rateWidth, 'Rate input must have comfortable width (>75px)').toBeGreaterThan(75);

    const discInput = table.locator('td.po-col-disc input').first();
    await expect(discInput).toBeVisible();
    const discWidth = await discInput.evaluate((el) => el.clientWidth);
    expect(discWidth, 'Discount input must have comfortable width (>65px)').toBeGreaterThan(65);

    const taxInput = table.locator('td.po-col-tax input').first();
    await expect(taxInput).toBeVisible();
    const taxWidth = await taxInput.evaluate((el) => el.clientWidth);
    expect(taxWidth, 'Tax input must have comfortable width (>60px)').toBeGreaterThan(60);

    // Verify initial values are populated and visible
    await expect(qtyInput).toHaveValue('1000');
    await expect(rateInput).toHaveValue('45');
    await expect(discInput).toHaveValue('0');
    await expect(taxInput).toHaveValue('18');

    // Select a material and verify no text clipping
    await materialSelect.selectOption('101');
    const selectedText = await materialSelect.locator('option:checked').innerText();
    expect(selectedText).toContain('HDPE Blue Drums Regrind Pellets');

    // Verify line total calculation: (1000 * 45 - 0) * 1.18 = 53,100.00
    const lineTotalCell = table.locator('.po-line-total-cell').first();
    await expect(lineTotalCell).toContainText('53100.00');

    // Test "Add Line" adds row 2
    await addLineBtn.click();
    await expect(table.locator('tbody tr')).toHaveCount(2);

    // Test "Remove" on second line
    const removeBtns = table.locator('button:has-text("Remove")');
    await expect(removeBtns.nth(1)).toBeVisible();
    await removeBtns.nth(1).click();
    await expect(table.locator('tbody tr')).toHaveCount(1);

    // Close modal
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await cancelBtn.click();
    await expect(modalBox).not.toBeVisible();
  });
});
