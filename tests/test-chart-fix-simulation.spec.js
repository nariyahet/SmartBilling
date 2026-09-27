// @ts-check
import { test, expect } from '@playwright/test';

test('Test with both dailySales and report.dailySales having day property', async ({ page }) => {
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

  await page.route('**/api/dashboard/sales-report', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const formatItem = (d) => ({
      ...d,
      day: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    });

    if (json.dailySales) json.dailySales = json.dailySales.map(formatItem).reverse();
    if (json.report?.dailySales) json.report.dailySales = json.report.dailySales.map(formatItem).reverse();

    await route.fulfill({ json });
  });

  await page.goto('http://localhost:5173/dashboard');
  await page.waitForSelector('.sb-exec-title', { timeout: 15000 });
  await page.waitForTimeout(2000);

  const fixedChart = await page.evaluate(() => {
    const el = document.querySelector('.sb-chart-wrapper');
    return {
      svg: !!el?.querySelector('svg'),
      areaPath: el?.querySelector('.recharts-area-area')?.getAttribute('d'),
      areaCurve: el?.querySelector('.recharts-area-curve')?.getAttribute('d'),
      ticks: Array.from(el?.querySelectorAll('.recharts-xAxis text') || []).map(t => t.textContent),
    };
  });
  console.log('CHART WITH VALID DAY IN BOTH:', JSON.stringify(fixedChart, null, 2));
});
