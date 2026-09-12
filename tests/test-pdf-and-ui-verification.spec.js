// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';

test('Verify Internal E-Way Bill Form Labels, Line Item Mapping, and PDF Output', async ({ page, request }) => {
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

  await page.goto('http://localhost:4173/plastic-erp/eway-bills');
  await expect(page.locator('h1')).toContainText(/Internal E-Way Bill/i);

  // 2. Open Create Modal and verify all 6 Consignment Line Item labels are visible
  await page.getByRole('button', { name: /\+ New Internal E-Way Bill/i }).click();
  await expect(page.locator('.sb-modal-box')).toBeVisible();

  // Verify visible labels above each input
  await expect(page.locator('.ewb-add-item-card')).toBeVisible();
  await expect(page.locator('label', { hasText: 'Product Description' })).toBeVisible();
  await expect(page.locator('label', { hasText: 'HSN / SAC Code' })).toBeVisible();
  await expect(page.locator('label', { hasText: 'Quantity' })).toBeVisible();
  await expect(page.locator('label', { hasText: /^Unit \*/ })).toBeVisible();
  await expect(page.locator('label', { hasText: 'Rate per Unit' })).toBeVisible();
  await expect(page.locator('label', { hasText: 'GST / Tax Rate %' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add Item/i })).toBeVisible();

  // Close create modal
  await page.locator('.sb-modal-close-btn').click();
  await expect(page.locator('.sb-modal-box')).not.toBeVisible();

  // 3. Find EWB-DRAFT-000002 row in the table
  const row = page.locator('tr', { hasText: 'EWB-DRAFT-000002' }).first();
  await expect(row).toBeVisible();

  // 4. Click View button to open preview modal sheet
  await row.getByRole('button', { name: /🖨️ View/i }).click();
  await expect(page.locator('.sb-modal-box')).toBeVisible();
  await expect(page.locator('#printable-ewb-doc')).toBeVisible();

  // Verify modal preview has complete line item row
  const table = page.locator('#printable-ewb-doc .ewb-doc-table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(1);

  // Verify columns in modal preview
  const itemRow = table.locator('tbody tr').first();
  await expect(itemRow).toContainText('Recycled Plastic Granules');
  await expect(itemRow).toContainText('3915');
  await expect(itemRow).toContainText('100');
  await expect(itemRow).toContainText('KG');
  await expect(itemRow).toContainText('₹50.00');
  await expect(itemRow).toContainText('₹5,000.00');
  await expect(itemRow).toContainText('₹900.00');
  await expect(itemRow).toContainText('₹5,900.00');

  // Verify totals in summary box
  const summaryBox = page.locator('#printable-ewb-doc .ewb-summary-right');
  await expect(summaryBox).toBeVisible();
  await expect(summaryBox).toContainText('₹5,000.00');
  await expect(summaryBox).toContainText('₹900.00');
  await expect(summaryBox).toContainText('₹5,900.00');

  // Take screenshot of document sheet
  await page.locator('#printable-ewb-doc').screenshot({ path: 'tests/ewb-doc-preview.png' });

  // 5. Test PDF Generation and download
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.sb-modal-box').getByRole('button', { name: /📥 Download PDF/i }).click();
  const download = await downloadPromise;
  const downloadPath = 'tests/downloaded_ewb_test.pdf';
  await download.saveAs(downloadPath);

  // Read PDF bytes and verify contents
  const pdfBytes = fs.readFileSync(downloadPath);
  expect(pdfBytes.length).toBeGreaterThan(10000);

  // Decompress and decode streams using embedded CMap
  const zlib = await import('zlib');
  const buf = pdfBytes;
  let str = buf.toString('binary');
  let start = 0;
  let streams = [];
  while ((start = str.indexOf('stream', start)) !== -1) {
    let streamStart = start + 6;
    if (buf[streamStart] === 13 && buf[streamStart + 1] === 10) streamStart += 2;
    else if (buf[streamStart] === 10) streamStart += 1;
    const end = str.indexOf('endstream', streamStart);
    if (end === -1) break;
    try {
      const decompressed = zlib.inflateSync(buf.slice(streamStart, end)).toString();
      streams.push(decompressed);
    } catch {}
    start = end + 9;
  }

  // Build CMap from all font cmap streams
  const cmapStreams = streams.filter((s) => s.includes('beginbfchar'));
  const cmap = {};
  for (const cs of cmapStreams) {
    const bfRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let match;
    while ((match = bfRegex.exec(cs)) !== null) {
      const cid = match[1].toLowerCase();
      const uniHex = match[2];
      cmap[cid] = String.fromCharCode(parseInt(uniHex, 16));
    }
  }

  // Decode text in stream 0
  const contentStream = streams[0] || '';
  const tjRegex = /<([0-9a-fA-F]+)>\s*Tj/g;
  let decodedWords = [];
  let tjMatch;
  while ((tjMatch = tjRegex.exec(contentStream)) !== null) {
    const hex = tjMatch[1];
    let word = '';
    for (let i = 0; i < hex.length; i += 4) {
      const code = hex.slice(i, i + 4).toLowerCase();
      word += cmap[code] || '?';
    }
    decodedWords.push(word);
  }

  const allDecodedText = decodedWords.join(' ');

  // Assertions on the downloaded PDF text
  expect(allDecodedText).toContain('EWB-DRAFT-000002');
  expect(allDecodedText).toContain('NOT AN OFFICIAL GOVERNMENT E-WAY BILL');
  expect(allDecodedText).toContain('Shree Plastic Industries');
  expect(allDecodedText).toContain('Rahul Patel');
  expect(allDecodedText).toContain('Recycled Plastic Granules');
  expect(allDecodedText).toContain('3915');
  expect(allDecodedText).toContain('100');
  expect(allDecodedText).toContain('KG');
  expect(allDecodedText).toContain('₹50.00');
  expect(allDecodedText).toContain('₹5,000.00');
  expect(allDecodedText).toContain('₹900.00');
  expect(allDecodedText).toContain('₹5,900.00');

  // Verify no spaced out numbers
  expect(allDecodedText).not.toContain('5 , 0 0 0');
  expect(allDecodedText).not.toContain('5 , 9 0 0');
});
