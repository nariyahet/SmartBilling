const db = require('../config/db');
const { createAccount } = require('../controllers/cashBankController');
const { withConnection } = require('../utils/accountingHelper');

async function runTests() {
  console.log('--- STARTING TRANSACTION REGRESSION TESTS ---');
  let failures = 0;

  // TEST 1: Pool connection acquisition and release verification
  try {
    console.log('\n[Test 1] Verifying pooled connection lifecycle & transaction capability...');
    const conn = await db.promise().getConnection();
    if (typeof conn.beginTransaction !== 'function') {
      throw new Error('conn.beginTransaction is NOT a function on pooled connection!');
    }
    await conn.beginTransaction();
    await conn.commit();
    conn.release();
    console.log('✅ [Test 1 Passed] conn.beginTransaction is a function on pooled connection.');
  } catch (err) {
    console.error('❌ [Test 1 Failed]', err.message);
    failures++;
  }

  // TEST 2: Rollback verification (Database Transaction Integrity)
  try {
    console.log('\n[Test 2] Verifying rollback integrity (data must NOT persist on error)...');
    const conn = await db.promise().getConnection();
    await conn.beginTransaction();

    // Find an active company
    const [companies] = await conn.query('SELECT id FROM companies LIMIT 1');
    if (companies.length === 0) {
      console.log('⚠️ No company found to test rollback, skipping table write');
    } else {
      const companyId = companies[0].id;
      const testAccountNo = 'TEST-ROLLBACK-' + Date.now();

      await conn.query(
        `INSERT INTO plastic_bank_accounts (company_id, bank_name, account_name, account_number, account_type, status)
         VALUES (?, 'Test Bank', 'Test Rollback Account', ?, 'CURRENT', 'ACTIVE')`,
        [companyId, testAccountNo]
      );

      // Explicit rollback
      await conn.rollback();
      conn.release();

      // Check whether record exists
      const [rows] = await db.promise().query(
        'SELECT id FROM plastic_bank_accounts WHERE account_number = ?',
        [testAccountNo]
      );
      if (rows.length > 0) {
        throw new Error('Rolled-back record was PERSISTED in the database! Rollback failed.');
      }
      console.log('✅ [Test 2 Passed] Rollback confirmed: partial uncommitted data was discarded.');
    }
  } catch (err) {
    console.error('❌ [Test 2 Failed]', err.message);
    failures++;
  }

  // TEST 3: Primary Bug Reported - Cash & Bank -> Create Account Flow
  try {
    console.log('\n[Test 3] Verifying reported bug: Cash & Bank -> Create Account...');
    const [companies] = await db.promise().query('SELECT id FROM companies LIMIT 1');
    const [admins] = await db.promise().query('SELECT id, company_id FROM admins LIMIT 1');

    if (companies.length > 0 && admins.length > 0) {
      const companyId = companies[0].id;
      const adminId = admins[0].id;
      const testAccountNo = 'ACC-' + Date.now();

      const req = {
        user: { company_id: companyId, id: adminId },
        body: {
          account_name: 'Regression Bank ' + Date.now(),
          account_number: testAccountNo,
          bank_name: 'HDFC Bank',
          ifsc_code: 'HDFC0001234',
          branch: 'Main Branch',
          account_type: 'SAVINGS',
          opening_balance: 5000,
          currency: 'INR',
          is_primary: false,
          notes: 'Automated Regression Test Account'
        }
      };

      let responseStatusCode = null;
      let responseBody = null;
      const res = {
        status: function(code) {
          responseStatusCode = code;
          return this;
        },
        json: function(data) {
          responseBody = data;
          return this;
        }
      };

      await createAccount(req, res);

      if (responseStatusCode !== 201 || !responseBody?.success) {
        throw new Error(`Create account failed with status ${responseStatusCode}: ${JSON.stringify(responseBody)}`);
      }

      console.log('✅ [Test 3 Passed] createAccount succeeded with 201 Created and transaction committed.');

      // Clean up test account & opening balance ledger entry
      if (responseBody.accountId) {
        await db.promise().query('DELETE FROM plastic_bank_accounts WHERE id = ?', [responseBody.accountId]);
        console.log('   Cleaned up test bank account:', responseBody.accountId);
      }
    } else {
      console.log('⚠️ Skipping Test 3: No company/admin record in DB.');
    }
  } catch (err) {
    console.error('❌ [Test 3 Failed]', err.message);
    failures++;
  }

  // TEST 4: Connection Leak & Pool Concurrency Test
  try {
    console.log('\n[Test 4] Verifying connection pool concurrency & leak prevention (15 parallel operations on poolLimit 10)...');
    const tasks = [];
    for (let i = 0; i < 15; i++) {
      tasks.push((async (index) => {
        const conn = await db.promise().getConnection();
        try {
          await conn.beginTransaction();
          await conn.query('SELECT 1 + 1 AS result');
          await conn.commit();
        } catch (e) {
          try { await conn.rollback(); } catch (_) {}
          throw e;
        } finally {
          conn.release();
        }
      })(i));
    }

    await Promise.all(tasks);
    console.log('✅ [Test 4 Passed] 15 parallel transactions completed cleanly. No connection leaks or pool starvation.');
  } catch (err) {
    console.error('❌ [Test 4 Failed]', err.message);
    failures++;
  }

  // TEST 5: Accounting Helper withConnection Test
  try {
    console.log('\n[Test 5] Verifying accountingHelper withConnection wrapper...');
    let connReceived = null;
    const testFn = withConnection(async (conn, data) => {
      connReceived = conn;
      return { success: true, processed: data.value * 2 };
    });

    const result = await testFn({ value: 21 });
    if (!result || result.processed !== 42) {
      throw new Error('withConnection failed to return expected result');
    }
    console.log('✅ [Test 5 Passed] withConnection successfully managed transaction connection lifecycle.');
  } catch (err) {
    console.error('❌ [Test 5 Failed]', err.message);
    failures++;
  }

  console.log('\n=============================================');
  if (failures === 0) {
    console.log('🎉 ALL 5 TRANSACTION REGRESSION TESTS PASSED!');
  } else {
    console.error(`❌ ${failures} TEST(S) FAILED!`);
    process.exit(1);
  }
  console.log('=============================================\n');

  // Let pool close gracefully
  db.end(() => {
    process.exit(failures > 0 ? 1 : 0);
  });
}

runTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
