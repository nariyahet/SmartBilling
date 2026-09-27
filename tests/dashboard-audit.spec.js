// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Dashboard Audit & Overflow Diagnostics', () => {
  test('Audit Dashboard Chart and Responsive Viewports without overflow-x hidden on app-layout', async ({ page }) => {
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

    // 2. Navigate to Dashboard
    await page.goto('http://localhost:5173/dashboard');
    await page.waitForSelector('.sb-exec-title', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 3. Inspect Chart Component and DOM
    const chartDataInspect = await page.evaluate(() => {
      // Find react internal state or props if possible, or salesChartData
      const chartWrapper = document.querySelector('.sb-chart-wrapper');
      const area = chartWrapper?.querySelector('.recharts-area');
      const areaPath = chartWrapper?.querySelector('.recharts-area-area');
      const pathEl = chartWrapper?.querySelector('path');
      const paths = Array.from(chartWrapper?.querySelectorAll('path') || []).map(p => ({
        className: p.getAttribute('class'),
        d: p.getAttribute('d'),
        fill: p.getAttribute('fill'),
        stroke: p.getAttribute('stroke')
      }));

      return {
        paths,
        innerHTML: chartWrapper?.innerHTML
      };
    });

    console.log('=== CHART PATHS & INNER HTML ===');
    console.log(JSON.stringify(chartDataInspect, null, 2));

    // 4. Temporarily disable overflow-x: hidden on .sb-app-layout and inspect real content overflow
    await page.evaluate(() => {
      const layout = document.querySelector('.sb-app-layout');
      if (layout) {
        layout.style.overflowX = 'visible';
      }
      document.body.style.overflowX = 'visible';
      document.documentElement.style.overflowX = 'visible';
    });

    const viewports = [
      { width: 1670, height: 1000, name: 'Desktop 1670' },
      { width: 1440, height: 900, name: 'Desktop 1440' },
      { width: 1200, height: 800, name: 'Desktop 1200' },
      { width: 1024, height: 768, name: 'Desktop 1024' },
      { width: 900, height: 750, name: 'Half-screen 900' },
      { width: 800, height: 750, name: 'Half-screen 800' },
      { width: 700, height: 750, name: 'Half-screen 700' },
      { width: 650, height: 750, name: 'Half-screen 650' },
      { width: 600, height: 750, name: 'Half-screen 600' },
      { width: 768, height: 1024, name: 'Tablet 768' },
      { width: 430, height: 932, name: 'Mobile 430' },
      { width: 414, height: 896, name: 'Mobile 414' },
      { width: 390, height: 844, name: 'Mobile 390' },
      { width: 375, height: 667, name: 'Mobile 375' },
      { width: 360, height: 740, name: 'Mobile 360' },
      { width: 320, height: 568, name: 'Mobile 320' },
    ];

    console.log('\n=== RESPONSIVE OVERFLOW AUDIT (WITHOUT OVERFLOW-X: HIDDEN) ===');
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(400);

      const overflowResult = await page.evaluate(() => {
        const docScrollWidth = document.documentElement.scrollWidth;
        const bodyScrollWidth = document.body.scrollWidth;
        const windowWidth = window.innerWidth;
        const mainWrapper = document.querySelector('.sb-main-wrapper');
        const mainScrollWidth = mainWrapper?.scrollWidth || 0;
        const mainClientWidth = mainWrapper?.clientWidth || 0;

        const canvas = document.querySelector('.sb-page-content-canvas');
        const canvasScrollWidth = canvas?.scrollWidth || 0;
        const canvasClientWidth = canvas?.clientWidth || 0;

        const isOverflow = docScrollWidth > windowWidth || mainScrollWidth > mainClientWidth || canvasScrollWidth > canvasClientWidth;

        let overflowingElements = [];
        if (isOverflow) {
          const all = document.querySelectorAll('*');
          all.forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.right > windowWidth + 1) {
              overflowingElements.push({
                tag: el.tagName,
                className: typeof el.className === 'string' ? el.className.slice(0, 50) : '',
                rectRight: Math.round(rect.right),
                rectWidth: Math.round(rect.width),
                excess: Math.round(rect.right - windowWidth),
              });
            }
          });
        }

        return {
          windowWidth,
          docScrollWidth,
          mainScrollWidth,
          mainClientWidth,
          canvasScrollWidth,
          canvasClientWidth,
          isOverflow,
          overflowingElements: overflowingElements.slice(0, 8),
        };
      });

      console.log(`[${vp.name} (${vp.width}x${vp.height})] Overflow: ${overflowResult.isOverflow ? 'YES (doc: ' + overflowResult.docScrollWidth + ', main: ' + overflowResult.mainScrollWidth + '/' + overflowResult.mainClientWidth + ', canvas: ' + overflowResult.canvasScrollWidth + '/' + overflowResult.canvasClientWidth + ')' : 'NO'}`);
      if (overflowResult.isOverflow && overflowResult.overflowingElements.length > 0) {
        console.log('   Culprits:', JSON.stringify(overflowResult.overflowingElements, null, 2));
      }
    }
  });
});
