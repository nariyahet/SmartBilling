// @ts-check
import { test } from '@playwright/test';

test('Test clicking/hovering on chart in Dashboard', async ({ page }) => {
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

  await page.goto('http://localhost:5173/dashboard');
  await page.waitForSelector('.sb-exec-title', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Inspect chart before any interaction
  const before = await page.evaluate(() => {
    const el = document.querySelector('.sb-chart-wrapper');
    return {
      svg: !!el?.querySelector('svg'),
      areaPath: el?.querySelector('.recharts-area-area')?.getAttribute('d'),
      areaCurve: el?.querySelector('.recharts-area-curve')?.getAttribute('d'),
      allPaths: Array.from(el?.querySelectorAll('path') || []).map(p => ({
        cls: p.className?.baseVal || p.className,
        d: p.getAttribute('d')?.slice(0, 50)
      }))
    };
  });
  console.log('BEFORE INTERACTION:', JSON.stringify(before, null, 2));

  // Hover over the center of the chart
  const chartWrapper = page.locator('.sb-chart-wrapper');
  await chartWrapper.hover({ position: { x: 150, y: 100 } });
  await page.waitForTimeout(500);

  const afterHover = await page.evaluate(() => {
    const el = document.querySelector('.sb-chart-wrapper');
    return {
      areaPath: el?.querySelector('.recharts-area-area')?.getAttribute('d'),
      areaCurve: el?.querySelector('.recharts-area-curve')?.getAttribute('d'),
      allPaths: Array.from(el?.querySelectorAll('path') || []).map(p => ({
        cls: p.className?.baseVal || p.className,
        d: p.getAttribute('d')?.slice(0, 50)
      }))
    };
  });
  console.log('AFTER HOVER:', JSON.stringify(afterHover, null, 2));

  // Click on the center of the chart
  await chartWrapper.click({ position: { x: 150, y: 100 } });
  await page.waitForTimeout(500);

  const afterClick = await page.evaluate(() => {
    const el = document.querySelector('.sb-chart-wrapper');
    return {
      areaPath: el?.querySelector('.recharts-area-area')?.getAttribute('d'),
      areaCurve: el?.querySelector('.recharts-area-curve')?.getAttribute('d'),
      allPaths: Array.from(el?.querySelectorAll('path') || []).map(p => ({
        cls: p.className?.baseVal || p.className,
        d: p.getAttribute('d')?.slice(0, 50)
      }))
    };
  });
  console.log('AFTER CLICK:', JSON.stringify(afterClick, null, 2));

  // Click on period buttons: Today, This Month, This Year
  console.log('Testing Period Tabs:');
  for (const p of ['Today', 'This Month', 'This Year']) {
    await page.click(`.sb-period-tab:has-text("${p}")`);
    await page.waitForTimeout(1000);
    const tabState = await page.evaluate(() => {
      const el = document.querySelector('.sb-chart-wrapper');
      return {
        areaPath: el?.querySelector('.recharts-area-area')?.getAttribute('d'),
        areaCurve: el?.querySelector('.recharts-area-curve')?.getAttribute('d'),
        xAxisTicks: Array.from(el?.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick-value') || []).map(t => t.textContent)
      };
    });
    console.log(`AFTER TAB [${p}]:`, JSON.stringify(tabState, null, 2));
  }
});
