// @ts-check
import { test, expect } from '@playwright/test';

const ROUTES_TO_AUDIT = [
  '/dashboard',
  '/customers',
  '/products',
  '/invoices/create',
  '/invoices/history',
  '/sales-report',
  '/settings',
  '/plastic-erp/suppliers',
  '/plastic-erp/raw-materials',
  '/plastic-erp/purchase-requisitions',
  '/plastic-erp/purchase-orders',
  '/plastic-erp/truck-inward',
  '/plastic-erp/weighment',
  '/plastic-erp/purchase-bills',
  '/plastic-erp/stock',
  '/plastic-erp/production',
  '/plastic-erp/recipes',
  '/plastic-erp/wip-fg',
  '/plastic-erp/quality',
  '/plastic-erp/scrap-regrind',
  '/plastic-erp/machines',
  '/plastic-erp/dispatch',
  '/plastic-erp/payments',
  '/plastic-erp/receivables',
  '/plastic-erp/customer-ledger',
  '/plastic-erp/employees',
  '/plastic-erp/attendance',
  '/plastic-erp/payroll',
  '/plastic-erp/expenses',
  '/plastic-erp/gst',
  '/plastic-erp/cash-bank',
  '/plastic-erp/chart-of-accounts',
  '/plastic-erp/financial-reports',
];

const VIEWPORTS = [
  { width: 1670, height: 1000, name: 'Desktop 1670' },
  { width: 1440, height: 900, name: 'Desktop 1440' },
  { width: 1200, height: 800, name: 'Desktop 1200' },
  { width: 1024, height: 768, name: 'Laptop 1024' },
  { width: 900, height: 750, name: 'Half-screen 900' },
  { width: 800, height: 750, name: 'Half-screen 800' },
  { width: 768, height: 1024, name: 'Tablet 768' },
  { width: 430, height: 932, name: 'Mobile 430' },
  { width: 390, height: 844, name: 'Mobile 390' },
  { width: 360, height: 740, name: 'Mobile 360' },
  { width: 320, height: 568, name: 'Mobile 320' },
];

test.describe('SmartBilling Global Responsive Audit', () => {
  test('Audit all key routes across all viewports', async ({ page }) => {
    test.setTimeout(120000);
    // 1. Obtain token & set local storage
    const loginRes = await page.request.post('http://localhost:5000/api/auth/login', {
      data: { email: 'demo@smartbilling.com', password: 'Demo@12345' },
    });
    const loginData = await loginRes.json();
    const token = loginData.data?.token || '';
    const admin = loginData.data?.admin || { id: 4, name: 'Demo Admin', email: 'demo@smartbilling.com', company_id: 1 };
    const company = loginData.data?.company || { id: 1, name: 'Demo Company' };

    await page.goto('http://localhost:5173/');
    await page.evaluate(
      ({ token, admin, company }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('admin', JSON.stringify(admin));
        localStorage.setItem('company', JSON.stringify(company));
      },
      { token, admin, company }
    );

    const issues = [];

    // Test a selected core subset of pages across viewports first
    const primaryRoutes = [
      '/dashboard',
      '/customers',
      '/products',
      '/invoices/create',
      '/invoices/history',
      '/sales-report',
      '/settings',
      '/plastic-erp/purchase-orders',
      '/plastic-erp/purchase-bills',
      '/plastic-erp/production',
      '/plastic-erp/payroll',
      '/plastic-erp/gst',
    ];

    for (const route of primaryRoutes) {
      await page.goto(`http://localhost:5173${route}`);
      await page.waitForTimeout(1000);

      // Disable overflow-x: hidden on layout container to detect real unconstrained content overflow
      await page.evaluate(() => {
        const layout = document.querySelector('.sb-app-layout');
        if (layout) layout.style.overflowX = 'visible';
      });

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(300);

        const res = await page.evaluate((vpWidth) => {
          const docScrollWidth = document.documentElement.scrollWidth;
          const bodyScrollWidth = document.body.scrollWidth;
          const windowWidth = window.innerWidth;
          const hasOverflow = docScrollWidth > windowWidth + 1 || bodyScrollWidth > windowWidth + 1;

          let culprits = [];
          if (hasOverflow) {
            document.querySelectorAll('*').forEach((el) => {
              const rect = el.getBoundingClientRect();
              if (rect.right > windowWidth + 2) {
                // Ignore elements that are inside legitimate horizontal scroll containers
                const isInsideScrollContainer = el.closest('.sb-table-responsive') || el.closest('.sb-table-wrapper') || el.closest('.sb-tabs-container') || el.closest('[style*="overflow-x: auto"]');
                if (!isInsideScrollContainer || el.classList.contains('sb-card-panel') || el.classList.contains('sb-card') || el.tagName === 'SECTION' || el.tagName === 'DIV' && rect.width > windowWidth) {
                  culprits.push({
                    tag: el.tagName,
                    cls: typeof el.className === 'string' ? el.className.slice(0, 40) : '',
                    right: Math.round(rect.right),
                    width: Math.round(rect.width),
                    excess: Math.round(rect.right - windowWidth)
                  });
                }
              }
            });
          }

          return {
            hasOverflow,
            docScrollWidth,
            windowWidth,
            culprits: culprits.slice(0, 5)
          };
        }, vp.width);

        if (res.hasOverflow) {
          issues.push({
            route,
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            docScrollWidth: res.docScrollWidth,
            culprits: res.culprits
          });
        }
      }
    }

    console.log(`\n=== GLOBAL RESPONSIVE AUDIT RESULTS ===`);
    console.log(`Total Overflow Issues Found: ${issues.length}`);
    if (issues.length > 0) {
      console.log(JSON.stringify(issues, null, 2));
    }
  });
});
