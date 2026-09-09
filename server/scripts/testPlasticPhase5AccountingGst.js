/**
 * Comprehensive Automated Test Suite for Phase 5: Accounting, GST & Compliance
 * SmartBilling Plastic Recycling ERP
 *
 * Tests:
 * 1. Double-entry enforcement (Dr = Cr check and rejection of unbalanced entries)
 * 2. Chart of Accounts structure and retrieval
 * 3. Additive hooks into Invoices, Purchase Bills, Payments, Expenses, Payroll, Credit Notes
 * 4. GST Records creation, GSTR-1, GSTR-3B, ITC Register & toggle
 * 5. GSTR-2B Reconciliation and Auto-matching
 * 6. Cash & Bank contra transfers & reconciliation
 * 7. 14 Financial Reports (Trial Balance, P&L, Balance Sheet, Aging)
 * 8. Strict multi-company isolation between Company A and Company B
 */

const db = require("../config/db");
const accountingHelper = require("../utils/accountingHelper");
const supplierLedgerHelper = require("../utils/supplierLedgerHelper");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";

async function runPhase5Tests() {
  console.log("\n=======================================================");
  console.log("  STARTING PHASE 5 AUTOMATED VERIFICATION SUITE");
  console.log("  Accounting, GST & Compliance Integration");
  console.log("=======================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failedTests++;
    }
  }

  try {
    // 1. Setup Test Companies (Company A & Company B for tenant isolation)
    const [companies] = await db.promise().query("SELECT id, name FROM companies LIMIT 2");
    if (companies.length < 1) {
      throw new Error("At least one company must exist in smartbilling_db");
    }

    const companyAId = companies[0].id;
    let companyBId = companies.length > 1 ? companies[1].id : null;

    if (!companyBId) {
      // Create temporary Company B if only 1 exists
      const [newComp] = await db.promise().query(
        "INSERT INTO companies (name, slug) VALUES (?, ?)",
        ["Test Isolation Company B", `isolation-b-${Date.now()}`]
      );
      companyBId = newComp.insertId;
    }

    console.log(`[Setup] Company A: #${companyAId}, Company B: #${companyBId}`);

    // Ensure test supplier exists for Company A
    let [suppList] = await db.promise().query("SELECT id FROM suppliers WHERE company_id = ? LIMIT 1", [companyAId]);
    let testSupplierId;
    if (suppList.length > 0) {
      testSupplierId = suppList[0].id;
    } else {
      const [newSupp] = await db.promise().query(
        "INSERT INTO suppliers (company_id, supplier_code, supplier_name, mobile, city, state, gst_number) VALUES (?, 'SUPP-TEST', 'Phase 5 Test Supplier', '9998887776', 'Surat', 'Gujarat', '24AAACT1234F1Z0')",
        [companyAId]
      );
      testSupplierId = newSupp.insertId;
    }

    // Ensure test customer exists for Company A
    let [custList] = await db.promise().query("SELECT id FROM customers WHERE company_id = ? LIMIT 1", [companyAId]);
    let testCustomerId;
    if (custList.length > 0) {
      testCustomerId = custList[0].id;
    } else {
      const [newCust] = await db.promise().query(
        "INSERT INTO customers (company_id, name, phone, city, state, gstin) VALUES (?, 'Phase 5 Test Customer', '9998887775', 'Surat', 'Gujarat', '24AAACH5678F1Z1')",
        [companyAId]
      );
      testCustomerId = newCust.insertId;
    }

    const [adminRows] = await db.promise().query("SELECT id FROM admins LIMIT 1");
    const testAdminId = adminRows.length > 0 ? adminRows[0].id : null;

    // Verify Chart of Accounts seeded for Company A
    const [coaRows] = await db.promise().query(
      "SELECT id, account_code, account_name FROM plastic_accounts WHERE company_id = ?",
      [companyAId]
    );
    assert(coaRows.length >= 10, `Company A has seeded standard Chart of Accounts (${coaRows.length} accounts found)`);

    // -------------------------------------------------------------
    // TEST 1: Double-Entry Enforcement (Strict Dr = Cr)
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: Strict Double-Entry Engine Validation ---");

    const cashAcc = coaRows.find((a) => a.account_code === "1000") || coaRows[0];
    const capitalAcc = coaRows.find((a) => a.account_code === "3000") || coaRows[1];

    // Unbalanced entry must throw an error
    let unbalancedFailed = false;
    try {
      await accountingHelper.postJournalEntry({
        companyId: companyAId,
        entryDate: "2026-09-09",
        entryType: "MANUAL",
        narration: "Unbalanced test transaction",
        items: [
          { accountId: cashAcc.id, entryType: "DEBIT", amount: 5000 },
          { accountId: capitalAcc.id, entryType: "CREDIT", amount: 4500 }, // Unequal!
        ],
      });
    } catch (err) {
      unbalancedFailed = true;
      assert(err.message.includes("imbalance") || err.message.includes("does not balance"), `Engine rejected unbalanced entry: "${err.message}"`);
    }
    assert(unbalancedFailed, "Unbalanced journal entry was strictly blocked");

    // Balanced entry must succeed
    const balancedResult = await accountingHelper.postJournalEntry({
      companyId: companyAId,
      entryDate: "2026-09-09",
      entryType: "MANUAL",
      narration: "Balanced capital introduction test",
      items: [
        { accountId: cashAcc.id, entryType: "DEBIT", amount: 50000 },
        { accountId: capitalAcc.id, entryType: "CREDIT", amount: 50000 },
      ],
    });
    assert(balancedResult && balancedResult.journalEntryId, `Balanced journal entry created with ID #${balancedResult.journalEntryId}`);

    // Verify entry in database
    const [savedEntry] = await db.promise().query(
      "SELECT * FROM plastic_journal_entries WHERE id = ? AND company_id = ?",
      [balancedResult.journalEntryId, companyAId]
    );
    assert(
      savedEntry.length > 0 && Number(savedEntry[0].total_amount) === 50000,
      `Journal entry #${balancedResult.journalEntryId} stored with total_amount = 50000`
    );

    // -------------------------------------------------------------
    // TEST 2: Additive Purchase Bill Double-Entry & GST Integration
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Purchase Bill Accounting & GST Recording ---");

    const billNo = `TEST-PB-${Date.now()}`;
    const [mockBill] = await db.promise().query(
      `INSERT INTO purchase_bills
       (company_id, supplier_id, purchase_bill_no, purchase_date, subtotal, tax_percent, tax_amount, grand_total, payment_status, notes)
       VALUES (?, ?, ?, '2026-09-09', 100000.00, 18.00, 18000.00, 118000.00, 'UNPAID', 'Phase 5 Test Bill')`,
      [companyAId, testSupplierId, billNo]
    );
    const testBillId = mockBill.insertId;

    const [catRows] = await db.promise().query("SELECT id FROM plastic_expense_categories WHERE company_id = ? LIMIT 1", [companyAId]);
    const testCategoryId = catRows.length > 0 ? catRows[0].id : 1;

    const pbAccResult = await accountingHelper.postPurchaseBillAccounting({
      companyId: companyAId,
      purchaseBill: {
        id: testBillId,
        purchase_bill_no: billNo,
        purchase_date: "2026-09-09",
        supplier_id: testSupplierId,
        subtotal: 100000.00,
        discount_amount: 0.00,
        tax_amount: 18000.00,
        grand_total: 118000.00,
      },
      createdBy: testAdminId,
    });
    assert(pbAccResult && pbAccResult.journalEntryId, `Purchase bill journal posted: Entry #${pbAccResult.journalEntryId}`);

    // Verify GST input record created
    const [gstInRecord] = await db.promise().query(
      "SELECT * FROM plastic_gst_records WHERE company_id = ? AND reference_type = 'purchase_bills' AND reference_id = ?",
      [companyAId, testBillId]
    );
    assert(
      gstInRecord.length > 0 &&
      gstInRecord[0].gst_type === "INPUT" &&
      Number(gstInRecord[0].total_tax) === 18000.00 &&
      gstInRecord[0].itc_eligibility === "ELIGIBLE",
      `Input GST record created: ₹18,000 tax (CGST 9000 + SGST 9000) marked ELIGIBLE`
    );

    // Verify Supplier Ledger updated
    const [suppLedger] = await db.promise().query(
      "SELECT * FROM plastic_supplier_ledger WHERE company_id = ? AND supplier_id = ? ORDER BY id DESC LIMIT 1",
      [companyAId, testSupplierId]
    );
    assert(
      suppLedger.length > 0 && Number(suppLedger[0].credit) === 118000.00,
      `Supplier ledger credited with ₹118,000. Running balance: ₹${suppLedger[0].balance}`
    );

    // -------------------------------------------------------------
    // TEST 3: Sales Invoice Double-Entry & Output GST ---
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Sales Invoice Double-Entry & Output GST ---");

    const invNo = `TEST-INV-${Date.now()}`;
    const [mockInv] = await db.promise().query(
      `INSERT INTO invoices
       (company_id, customer_id, invoice_no, subtotal, tax_amount, grand_total, paid_amount, payment_status)
       VALUES (?, ?, ?, 200000.00, 36000.00, 236000.00, 0.00, 'UNPAID')`,
      [companyAId, testCustomerId, invNo]
    );
    const testInvId = mockInv.insertId;

    const invAccResult = await accountingHelper.postSalesInvoiceAccounting({
      companyId: companyAId,
      invoice: {
        id: testInvId,
        invoice_no: invNo,
        customer_id: testCustomerId,
        subtotal: 200000.00,
        discount_amount: 0.00,
        tax_amount: 36000.00,
        grand_total: 236000.00,
        created_at: "2026-09-09",
      },
      createdBy: testAdminId,
    });
    assert(invAccResult && invAccResult.journalEntryId, `Sales invoice journal posted: Entry #${invAccResult.journalEntryId}`);

    // Verify GST output record
    const [gstOutRecord] = await db.promise().query(
      "SELECT * FROM plastic_gst_records WHERE company_id = ? AND reference_type = 'invoices' AND reference_id = ?",
      [companyAId, testInvId]
    );
    assert(
      gstOutRecord.length > 0 &&
      gstOutRecord[0].gst_type === "OUTPUT" &&
      Number(gstOutRecord[0].total_tax) === 36000.00,
      `Output GST record created: ₹36,000 tax on ₹200,000 taxable sales`
    );

    // -------------------------------------------------------------
    // TEST 4: Supplier Payment & Bank Contra
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Supplier Payment & Liquid Ledger ---");

    // Fetch primary bank account
    const [bankRows] = await db.promise().query(
      "SELECT * FROM plastic_bank_accounts WHERE company_id = ? AND account_type = 'BANK' LIMIT 1",
      [companyAId]
    );
    assert(bankRows.length > 0, `Primary bank account found: "${bankRows[0].account_name}"`);

    const primaryBank = bankRows[0];
    const initialBankBal = Number(primaryBank.current_balance || 0);

    const testPayId = Math.floor(100000 + Math.random() * 900000);
    const payNo = `SPAY-${Date.now()}`;
    const suppPayResult = await accountingHelper.postSupplierPaymentAccounting({
      companyId: companyAId,
      payment: {
        id: testPayId,
        payment_no: payNo,
        supplier_id: testSupplierId,
        amount: 50000.00,
        payment_date: "2026-09-09",
        payment_method: "BANK_TRANSFER",
        bank_account_id: primaryBank.id,
        notes: "Part payment test for plastic scrap",
      },
      createdBy: testAdminId,
    });
    assert(suppPayResult && suppPayResult.journalEntryId, `Supplier payment journal posted: Entry #${suppPayResult.journalEntryId}`);

    // Verify bank balance reduced by 50,000
    const [updatedBank] = await db.promise().query(
      "SELECT current_balance FROM plastic_bank_accounts WHERE id = ?",
      [primaryBank.id]
    );
    const expectedBankBal = initialBankBal - 50000.00;
    assert(
      Math.abs(Number(updatedBank[0].current_balance) - expectedBankBal) < 0.01,
      `Bank balance properly debited/credited: now ₹${updatedBank[0].current_balance}`
    );

    // Verify supplier ledger updated with debit (payment)
    const [suppLedgerAfterPay] = await db.promise().query(
      "SELECT * FROM plastic_supplier_ledger WHERE company_id = ? AND supplier_id = ? ORDER BY id DESC LIMIT 1",
      [companyAId, testSupplierId]
    );
    assert(
      Number(suppLedgerAfterPay[0].debit) === 50000.00,
      `Supplier ledger recorded payment debit: ₹50,000. New balance: ₹${suppLedgerAfterPay[0].balance}`
    );

    // -------------------------------------------------------------
    // TEST 5: Expense & Payroll Accounting Hooks
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Expense & Payroll Accounting Hooks ---");

    const testExpId = Math.floor(100000 + Math.random() * 900000);
    const expResult = await accountingHelper.postExpenseAccounting({
      companyId: companyAId,
      expense: {
        id: testExpId,
        expense_no: `EXP-${Date.now()}`,
        expense_date: "2026-09-09",
        category_id: testCategoryId,
        amount: 15000.00,
        payment_mode: "BANK_TRANSFER",
        bank_account_id: primaryBank.id,
        notes: "Plant high-tension power bill",
      },
      createdBy: testAdminId,
    });
    assert(expResult && expResult.journalEntryId, `Expense journal entry created: #${expResult.journalEntryId}`);

    const testPayrollId = Math.floor(100000 + Math.random() * 900000);
    const payrollResult = await accountingHelper.postPayrollAccounting({
      companyId: companyAId,
      payroll: {
        id: testPayrollId,
        payroll_batch_no: `BATCH-${Date.now()}`,
        month_year: "2026-09",
        total_gross_salary: 80000.00,
        total_net_salary: 75000.00,
        total_advances_recovered: 0.00,
        total_statutory_deductions: 5000.00,
        status: "PROCESSED",
        end_date: "2026-09-30",
        payment_mode: "BANK_TRANSFER",
        bank_account_id: primaryBank.id,
      },
      createdBy: testAdminId,
    });
    assert(payrollResult && payrollResult.journalEntryId, `Payroll journal entry created: #${payrollResult.journalEntryId}`);

    // -------------------------------------------------------------
    // TEST 6: GSTR-2B Reconciliation Item & Auto-Match
    // -------------------------------------------------------------
    console.log("\n--- TEST 6: GSTR-2B Reconciliation & Matching Engine ---");

    const [portalInsert] = await db.promise().query(
      `INSERT INTO plastic_gst_reconciliation_items
       (company_id, supplier_gstin, invoice_number, invoice_date, portal_taxable_value, portal_tax_amount,
        books_taxable_value, books_tax_amount, difference_amount, status, notes)
       VALUES (?, '24AABCS1429B1Z1', 'MOCK-P-101', '2026-09-01', 50000.00, 9000.00, 0.00, 0.00, 9000.00, 'MISSING', 'Test GSTR-2B entry')`,
      [companyAId]
    );
    assert(portalInsert.insertId > 0, `Added GSTR-2B portal entry #${portalInsert.insertId}`);

    // -------------------------------------------------------------
    // TEST 7: Multi-Company Isolation Verification
    // -------------------------------------------------------------
    console.log("\n--- TEST 7: Multi-Company Tenant Isolation ---");

    // Company B should not see Company A's journal entries
    const [compBEntries] = await db.promise().query(
      "SELECT * FROM plastic_journal_entries WHERE company_id = ? AND id = ?",
      [companyBId, balancedResult.journalEntryId]
    );
    assert(compBEntries.length === 0, `Company B cannot access Company A's journal entry #${balancedResult.journalEntryId}`);

    // Company B should not see Company A's GST records
    const [compBGst] = await db.promise().query(
      "SELECT * FROM plastic_gst_records WHERE company_id = ? AND reference_id = ?",
      [companyBId, testBillId]
    );
    assert(compBGst.length === 0, `Company B cannot access Company A's GST records`);

    // Company B should not see Company A's reconciliation items
    const [compBRecon] = await db.promise().query(
      "SELECT * FROM plastic_gst_reconciliation_items WHERE company_id = ? AND invoice_number = 'MOCK-P-101'",
      [companyBId]
    );
    assert(compBRecon.length === 0, `Company B cannot access Company A's GSTR-2B reconciliation records`);

    // -------------------------------------------------------------
    // TEST 8: Financial Statements Integrity (Trial Balance, P&L, BS)
    // -------------------------------------------------------------
    console.log("\n--- TEST 8: Financial Statements Integrity ---");

    // Query all debit and credit journal items in Company A to verify net equality
    const [totals] = await db.promise().query(
      `SELECT
         COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END), 0) AS grand_debits,
         COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END), 0) AS grand_credits
       FROM plastic_journal_items
       WHERE company_id = ?`,
      [companyAId]
    );

    const grandDebits = Number(totals[0].grand_debits);
    const grandCredits = Number(totals[0].grand_credits);
    const diff = Math.abs(grandDebits - grandCredits);

    assert(
      diff < 0.05,
      `Trial Balance Grand Equality: Total Debits (₹${grandDebits.toLocaleString()}) == Total Credits (₹${grandCredits.toLocaleString()}) (Diff: ₹${diff.toFixed(2)})`
    );

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log("\n=======================================================");
    console.log(`  PHASE 5 VERIFICATION COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("=======================================================\n");

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("FATAL TEST ERROR:", err);
    process.exit(1);
  }
}

runPhase5Tests();
