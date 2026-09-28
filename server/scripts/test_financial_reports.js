require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

async function testReports() {
  const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
  const token = jwt.sign(
    { id: 1, email: 'admin@smartbilling.com', role: 'admin', company_id: 1 },
    secret,
    { expiresIn: '1h' }
  );

  const baseURL = 'http://localhost:5000/api/plastic-erp/accounting/financial-reports';

  const reports = [
    'balance-sheet',
    'profit-loss',
    'cash-book',
    'bank-book',
    'customer-ledger',
    'supplier-ledger',
    'receivables',
    'payables',
    'expense-report',
    'gst-summary',
    'hsn-summary',
    'cash-flow',
    'trial-balance'
  ];

  console.log('Testing Financial Reports Endpoints...');
  let allPassed = true;

  for (const rep of reports) {
    try {
      const res = await fetch(`${baseURL}/${rep}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.status === 200 && data.success) {
        console.log(`PASS: /${rep} -> 200 OK (${data.reportName || rep})`);
      } else {
        console.log(`FAIL: /${rep} -> status: ${res.status}, success: ${data.success}, message: ${data.message}`);
        allPassed = false;
      }
    } catch (err) {
      console.log(`ERROR: /${rep} ->`, err.message);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\nALL 13 FINANCIAL REPORT ENDPOINTS PASSED CLEANLY!');
  } else {
    console.log('\nSOME FINANCIAL REPORT ENDPOINTS FAILED.');
    process.exit(1);
  }
}

testReports().catch(err => {
  console.error(err);
  process.exit(1);
});
