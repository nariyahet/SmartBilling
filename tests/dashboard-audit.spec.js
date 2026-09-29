// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Dashboard Chart & Responsive Verification', () => {
  test.setTimeout(120000);

  test('Verify chart renders immediately and no horizontal overflow across test matrix', async ({ page }) => {
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => consoleLogs.push(`[PAGE ERROR] ${err.message}`));

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

    // 2. Navigate to Dashboard at standard desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/dashboard');
    await page.waitForSelector('.sb-exec-title', { timeout: 15000 });
    await page.waitForTimeout(2000); // Allow initial data fetch & chart render

    // 3. Inspect Chart on INITIAL LOAD (NO clicks, NO hover, NO resize)
    const initialChart = await page.evaluate(() => {
      const el = document.querySelector('.sb-chart-wrapper');
      const areaPath = el?.querySelector('.recharts-area-area');
      const areaCurve = el?.querySelector('.recharts-area-curve');
      const dots = Array.from(el?.querySelectorAll('.recharts-area-dots circle') || []);
      const allTickTexts = Array.from(el?.querySelectorAll('.recharts-cartesian-axis-tick-value') || []).map(t => t.textContent?.trim() || '');
      const xAxisTicks = allTickTexts.filter(t => !t.startsWith('₹'));
      const yAxisTicks = allTickTexts.filter(t => t.startsWith('₹'));

      return {
        svgPresent: !!el?.querySelector('svg'),
        hasAreaPath: !!areaPath,
        areaPathD: areaPath?.getAttribute('d'),
        hasAreaCurve: !!areaCurve,
        areaCurveD: areaCurve?.getAttribute('d'),
        dotCount: dots.length,
        xAxisTicks,
        yAxisTicks,
        wrapperWidth: el?.clientWidth,
        wrapperHeight: el?.clientHeight,
      };
    });

    console.log('=== INITIAL CHART RENDER INSPECTION ===');
    console.log(JSON.stringify(initialChart, null, 2));

    expect(initialChart.svgPresent, 'SVG should be present').toBe(true);
    expect(initialChart.hasAreaPath, 'Area path should render immediately').toBe(true);
    expect(initialChart.hasAreaCurve, 'Area curve should render immediately').toBe(true);
    expect(initialChart.xAxisTicks.length, 'X-axis should have ticks').toBeGreaterThan(0);

    // 4. Test Period Switching
    console.log('\n=== PERIOD SWITCHING VERIFICATION ===');
    for (const p of ['Today', 'This Month', 'This Year']) {
      await page.click(`.sb-period-tab:has-text("${p}")`);
      await page.waitForTimeout(1000);
      const tabChart = await page.evaluate(() => {
        const el = document.querySelector('.sb-chart-wrapper');
        const emptyState = el?.querySelector('.sb-empty-chart-state');
        const areaPath = el?.querySelector('.recharts-area-area');
        return {
          isEmptyState: !!emptyState,
          emptyText: emptyState?.textContent,
          hasAreaPath: !!areaPath,
          areaPathD: areaPath?.getAttribute('d'),
        };
      });
      console.log(`[Tab: ${p}] State:`, JSON.stringify(tabChart));
    }

    // Return to "This Month"
    await page.click('.sb-period-tab:has-text("This Month")');
    await page.waitForTimeout(1000);

    // 5. Test Responsive Viewport Matrix
    const viewports = [
      { width: 1670, height: 1000, name: 'Desktop 1670x1000' },
      { width: 1440, height: 900, name: 'Desktop 1440x900' },
      { width: 1366, height: 768, name: 'Desktop 1366x768' },
      { width: 1200, height: 800, name: 'Desktop 1200x800' },
      { width: 1024, height: 768, name: 'Laptop 1024x768' },
      { width: 1024, height: 600, name: 'Laptop 1024x600' },
      { width: 900, height: 750, name: 'Half-screen 900x750' },
      { width: 900, height: 600, name: 'Half-screen 900x600' },
      { width: 800, height: 750, name: 'Half-screen 800x750' },
      { width: 768, height: 1024, name: 'Tablet 768x1024' },
      { width: 768, height: 600, name: 'Tablet 768x600' },
      { width: 700, height: 750, name: 'Mobile 700x750' },
      { width: 650, height: 750, name: 'Mobile 650x750' },
      { width: 600, height: 750, name: 'Mobile 600x750' },
      { width: 430, height: 932, name: 'Mobile 430x932' },
      { width: 414, height: 896, name: 'Mobile 414x896' },
      { width: 390, height: 844, name: 'Mobile 390x844' },
      { width: 390, height: 667, name: 'Mobile 390x667' },
      { width: 375, height: 667, name: 'Mobile 375x667' },
      { width: 360, height: 740, name: 'Mobile 360x740' },
      { width: 320, height: 568, name: 'Mobile 320x568' },
    ];

    console.log('\n=== RESPONSIVE VIEWPORT MATRIX OVERFLOW VERIFICATION ===');
    let failedViewports = 0;

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(400);

      const check = await page.evaluate((expectedWidth) => {
        const docScrollWidth = document.documentElement.scrollWidth;
        const bodyScrollWidth = document.body.scrollWidth;
        const windowWidth = window.innerWidth;
        const isOverflow = docScrollWidth > windowWidth + 1 || bodyScrollWidth > windowWidth + 1;

        let culprits = [];
        if (isOverflow) {
          document.querySelectorAll('*').forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.right > windowWidth + 2) {
              const insideTable = el.closest('.sb-table-responsive');
              if (!insideTable || el.classList.contains('sb-card-panel') || el.classList.contains('sb-card')) {
                culprits.push({
                  tag: el.tagName,
                  className: typeof el.className === 'string' ? el.className.slice(0, 40) : '',
                  right: Math.round(rect.right),
                  width: Math.round(rect.width),
                  excess: Math.round(rect.right - windowWidth),
                });
              }
            }
          });
        }

        return {
          windowWidth,
          docScrollWidth,
          bodyScrollWidth,
          isOverflow,
          culprits: culprits.slice(0, 5),
        };
      }, vp.width);

      if (check.isOverflow) {
        failedViewports++;
        console.error(`❌ [FAIL] ${vp.name}: docScrollWidth=${check.docScrollWidth}, body=${check.bodyScrollWidth} vs windowWidth=${check.windowWidth}`);
        console.error('   Culprits:', JSON.stringify(check.culprits, null, 2));
      } else {
        console.log(`✅ [PASS] ${vp.name}: docScrollWidth=${check.docScrollWidth} <= windowWidth=${check.windowWidth}`);
      }

      expect(check.isOverflow, `Viewport ${vp.name} should NOT have horizontal overflow`).toBe(false);
    }

    console.log(`\nAll ${viewports.length} viewports verified! Failed: ${failedViewports}`);

    // 6. Check console errors
    const errorLogs = consoleLogs.filter(l => l.startsWith('[error]') || l.startsWith('[PAGE ERROR]'));
    console.log(`\n=== CONSOLE ERRORS: ${errorLogs.length} ===`);
    if (errorLogs.length > 0) {
      errorLogs.forEach(e => console.error(e));
    }
    expect(errorLogs.length, 'Should have 0 console errors').toBe(0);
  });
});
