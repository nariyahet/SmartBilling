const db = require("../config/db");
const { recordSupplierLedgerEntry } = require("./supplierLedgerHelper");

/**
 * Generate next sequential journal number for a company (e.g. JRN-1001)
 */
const generateNextJournalNo = async (conn, companyId) => {
  const [rows] = await conn.query(
    `SELECT journal_no FROM plastic_journal_entries WHERE company_id = ? ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    if (row.journal_no) {
      const match = String(row.journal_no).match(/^JRN-(\d+)$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return `JRN-${maxNum + 1}`;
};

/**
 * Helper to fetch a ledger account by code or reference type
 */
const getAccount = async (conn, companyId, { code, refType }) => {
  if (code) {
    const [rows] = await conn.query(
      `SELECT * FROM plastic_accounts WHERE company_id = ? AND account_code = ? LIMIT 1`,
      [companyId, code]
    );
    if (rows.length > 0) return rows[0];
  }
  if (refType) {
    const [rows] = await conn.query(
      `SELECT * FROM plastic_accounts WHERE company_id = ? AND reference_type = ? LIMIT 1`,
      [companyId, refType]
    );
    if (rows.length > 0) return rows[0];
  }
  return null;
};

/**
 * Post a double-entry journal voucher enforcing TOTAL DEBIT = TOTAL CREDIT
 * @param {Object} conn - MySQL connection with active transaction
 * @param {Object} data - Journal payload
 */
const postJournalEntry = async (conn, {
  companyId,
  journalNo = null,
  entryDate = new Date(),
  referenceType = "MANUAL",
  referenceId = null,
  referenceNo = null,
  narration = "",
  items = [],
  createdBy = null,
}) => {
  if (!items || items.length < 2) {
    throw new Error("Journal entry must contain at least two line items (Debit and Credit).");
  }

  let totalDebit = 0;
  let totalCredit = 0;
  let debitAccountId = null;
  let creditAccountId = null;

  for (const item of items) {
    const amt = Number(item.amount);
    if (isNaN(amt) || amt <= 0) {
      throw new Error(`Invalid journal line amount: ${item.amount}`);
    }
    const type = String(item.entryType).toUpperCase();
    if (type === "DEBIT") {
      totalDebit += amt;
      if (!debitAccountId) debitAccountId = item.accountId;
    } else if (type === "CREDIT") {
      totalCredit += amt;
      if (!creditAccountId) creditAccountId = item.accountId;
    } else {
      throw new Error(`Invalid entry type: ${item.entryType}. Must be DEBIT or CREDIT.`);
    }
  }

  // Double entry balance verification (tolerance 0.01 for rounding)
  if (Math.abs(totalDebit - totalCredit) > 0.02) {
    throw new Error(
      `Double entry imbalance! Total Debit (₹${totalDebit.toFixed(2)}) must equal Total Credit (₹${totalCredit.toFixed(2)}).`
    );
  }

  const finalJournalNo = journalNo || (await generateNextJournalNo(conn, companyId));
  const finalDate = entryDate ? new Date(entryDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

  // 1. Insert Journal Header
  const [journalResult] = await conn.query(
    `INSERT INTO plastic_journal_entries
      (company_id, journal_no, entry_date, reference_type, reference_id, reference_no, narration, debit_account_id, credit_account_id, total_amount, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?)`,
    [
      companyId,
      finalJournalNo,
      finalDate,
      referenceType,
      referenceId,
      referenceNo,
      narration || null,
      items.length === 2 && items[0].entryType === "DEBIT" ? items[0].accountId : debitAccountId,
      items.length === 2 && items[1].entryType === "CREDIT" ? items[1].accountId : creditAccountId,
      totalDebit,
      createdBy,
    ]
  );

  const journalEntryId = journalResult.insertId;

  // 2. Insert Items & Update Account Current Balances
  for (const itm of items) {
    const amt = Number(itm.amount);
    const type = String(itm.entryType).toUpperCase();

    await conn.query(
      `INSERT INTO plastic_journal_items
        (company_id, journal_entry_id, account_id, entry_type, amount, narration)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [companyId, journalEntryId, itm.accountId, type, amt, itm.narration || narration || null]
    );

    // Fetch account nature to calculate balance change
    const [accRows] = await conn.query(
      `SELECT id, debit_credit_nature, current_balance FROM plastic_accounts WHERE id = ? AND company_id = ? FOR UPDATE`,
      [itm.accountId, companyId]
    );

    if (accRows.length > 0) {
      const acc = accRows[0];
      const nature = acc.debit_credit_nature || "DEBIT";
      let balanceDelta = 0;

      if (nature === "DEBIT") {
        balanceDelta = type === "DEBIT" ? amt : -amt;
      } else {
        balanceDelta = type === "CREDIT" ? amt : -amt;
      }

      await conn.query(
        `UPDATE plastic_accounts SET current_balance = current_balance + ? WHERE id = ? AND company_id = ?`,
        [balanceDelta, itm.accountId, companyId]
      );
    }
  }

  return {
    journalEntryId,
    journalNo: finalJournalNo,
    totalAmount: totalDebit,
  };
};

/**
 * AUTOMATIC INTEGRATION: Purchase Bill
 * Dr Purchase / Raw Material Inventory
 * Dr Input GST (if tax enabled)
 * Cr Supplier (Sundry Creditors)
 */
const postPurchaseBillAccounting = async (conn, { companyId, purchaseBill, createdBy = null }) => {
  // Check if already posted
  const [existing] = await conn.query(
    `SELECT id FROM plastic_journal_entries WHERE company_id = ? AND reference_type = 'PURCHASE_BILL' AND reference_id = ? LIMIT 1`,
    [companyId, purchaseBill.id]
  );
  if (existing.length > 0) return { journalEntryId: existing[0].id, ...existing[0] };

  const purchaseAcc = (await getAccount(conn, companyId, { code: "5000" })) || (await getAccount(conn, companyId, { refType: "PURCHASES" }));
  const supplierAcc = (await getAccount(conn, companyId, { code: "2000" })) || (await getAccount(conn, companyId, { refType: "SUPPLIER" }));

  if (!purchaseAcc || !supplierAcc) {
    console.warn(`Default accounts missing for company ${companyId}. Skipping purchase accounting.`);
    return null;
  }

  const subtotal = Number(purchaseBill.subtotal) || 0;
  const discount = Number(purchaseBill.discount_amount) || 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const taxAmount = Number(purchaseBill.tax_amount) || 0;
  const grandTotal = Number(purchaseBill.grand_total) || (taxableAmount + taxAmount);

  const items = [];

  // Dr Purchase
  items.push({
    accountId: purchaseAcc.id,
    entryType: "DEBIT",
    amount: taxableAmount,
    narration: `Purchase Bill ${purchaseBill.purchase_bill_no} - Raw Materials`,
  });

  // Fetch supplier state / tax settings
  const [suppRows] = await conn.query(
    `SELECT supplier_name, gst_number, state FROM suppliers WHERE id = ? AND company_id = ?`,
    [purchaseBill.supplier_id, companyId]
  );
  const supplier = suppRows[0] || {};

  const [settingsRows] = await conn.query(
    `SELECT tax_enabled, default_tax_percent FROM business_settings WHERE company_id = ? LIMIT 1`,
    [companyId]
  );
  const isTaxEnabled = settingsRows.length > 0 && Boolean(settingsRows[0].tax_enabled);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isTaxEnabled && taxAmount > 0) {
    const isInterState = supplier.state && supplier.state.trim().toLowerCase() !== "gujarat";

    if (isInterState) {
      igstAmount = taxAmount;
      const igstAcc = (await getAccount(conn, companyId, { code: "1320" })) || purchaseAcc;
      items.push({
        accountId: igstAcc.id,
        entryType: "DEBIT",
        amount: igstAmount,
        narration: `Input IGST on ${purchaseBill.purchase_bill_no}`,
      });
    } else {
      cgstAmount = parseFloat((taxAmount / 2).toFixed(2));
      sgstAmount = parseFloat((taxAmount - cgstAmount).toFixed(2));
      const cgstAcc = (await getAccount(conn, companyId, { code: "1300" })) || purchaseAcc;
      const sgstAcc = (await getAccount(conn, companyId, { code: "1310" })) || purchaseAcc;

      items.push({
        accountId: cgstAcc.id,
        entryType: "DEBIT",
        amount: cgstAmount,
        narration: `Input CGST on ${purchaseBill.purchase_bill_no}`,
      });
      items.push({
        accountId: sgstAcc.id,
        entryType: "DEBIT",
        amount: sgstAmount,
        narration: `Input SGST on ${purchaseBill.purchase_bill_no}`,
      });
    }
  }

  // Cr Supplier
  items.push({
    accountId: supplierAcc.id,
    entryType: "CREDIT",
    amount: grandTotal,
    narration: `Payable to ${supplier.supplier_name || "Supplier"} for ${purchaseBill.purchase_bill_no}`,
  });

  const journal = await postJournalEntry(conn, {
    companyId,
    entryDate: purchaseBill.purchase_date,
    referenceType: "PURCHASE_BILL",
    referenceId: purchaseBill.id,
    referenceNo: purchaseBill.purchase_bill_no,
    narration: `Purchase Bill ${purchaseBill.purchase_bill_no} from ${supplier.supplier_name || "Supplier"}`,
    items,
    createdBy,
  });

  // Record in Supplier Ledger
  await recordSupplierLedgerEntry(conn, {
    companyId,
    supplierId: purchaseBill.supplier_id,
    transactionDate: purchaseBill.purchase_date,
    referenceType: "PURCHASE_BILL",
    referenceId: purchaseBill.id,
    referenceNo: purchaseBill.purchase_bill_no,
    debit: 0.00,
    credit: grandTotal,
    notes: `Purchase Bill ${purchaseBill.purchase_bill_no} recorded`,
    createdBy,
  });

  // Record in GST Audit Records if tax enabled
  if (isTaxEnabled && taxAmount > 0) {
    await conn.query(
      `INSERT INTO plastic_gst_records
        (company_id, gst_type, transaction_type, reference_type, reference_id, invoice_no, invoice_date,
         party_type, party_id, party_name, party_gstin, place_of_supply, hsn_code,
         taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
         total_tax, total_amount, itc_eligibility, itc_reconciliation_status)
       VALUES (?, 'INPUT', 'PURCHASE', 'purchase_bills', ?, ?, ?, 'SUPPLIER', ?, ?, ?, ?, '3915', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ELIGIBLE', 'UNMATCHED')`,
      [
        companyId,
        purchaseBill.id,
        purchaseBill.purchase_bill_no,
        purchaseBill.purchase_date,
        purchaseBill.supplier_id,
        supplier.supplier_name || "Supplier",
        supplier.gst_number || null,
        supplier.state || "Gujarat (24)",
        taxableAmount,
        cgstAmount > 0 ? (Number(purchaseBill.tax_percent) / 2 || 9.0) : 0,
        cgstAmount,
        sgstAmount > 0 ? (Number(purchaseBill.tax_percent) / 2 || 9.0) : 0,
        sgstAmount,
        igstAmount > 0 ? (Number(purchaseBill.tax_percent) || 18.0) : 0,
        igstAmount,
        taxAmount,
        grandTotal,
      ]
    );
  }

  return journal;
};

/**
 * AUTOMATIC INTEGRATION: Sales Invoice
 * Dr Customer (Sundry Debtors)
 * Cr Sales (Plastic Recycling Sales)
 * Cr Output GST (if tax enabled)
 */
const postSalesInvoiceAccounting = async (conn, { companyId, invoice, createdBy = null }) => {
  const [existing] = await conn.query(
    `SELECT id FROM plastic_journal_entries WHERE company_id = ? AND reference_type = 'INVOICE' AND reference_id = ? LIMIT 1`,
    [companyId, invoice.id]
  );
  if (existing.length > 0) return { journalEntryId: existing[0].id, ...existing[0] };

  const customerAcc = (await getAccount(conn, companyId, { code: "1100" })) || (await getAccount(conn, companyId, { refType: "CUSTOMER" }));
  const salesAcc = (await getAccount(conn, companyId, { code: "4000" })) || (await getAccount(conn, companyId, { refType: "SALES" }));

  if (!customerAcc || !salesAcc) {
    console.warn(`Default accounts missing for company ${companyId}. Skipping sales accounting.`);
    return null;
  }

  const subtotal = Number(invoice.subtotal) || 0;
  const discount = Number(invoice.discount_amount) || 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const taxAmount = Number(invoice.tax_amount) || 0;
  const grandTotal = Number(invoice.grand_total) || (taxableAmount + taxAmount);

  const [custRows] = await conn.query(
    `SELECT name, mobile, address FROM customers WHERE id = ? AND company_id = ?`,
    [invoice.customer_id, companyId]
  );
  const customer = custRows[0] || {};

  const [settingsRows] = await conn.query(
    `SELECT tax_enabled FROM business_settings WHERE company_id = ? LIMIT 1`,
    [companyId]
  );
  const isTaxEnabled = settingsRows.length > 0 && Boolean(settingsRows[0].tax_enabled);

  const items = [];

  // Dr Customer
  items.push({
    accountId: customerAcc.id,
    entryType: "DEBIT",
    amount: grandTotal,
    narration: `Receivable from ${customer.name || "Customer"} for Invoice ${invoice.invoice_no}`,
  });

  // Cr Sales
  items.push({
    accountId: salesAcc.id,
    entryType: "CREDIT",
    amount: taxableAmount,
    narration: `Sales revenue for Invoice ${invoice.invoice_no}`,
  });

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isTaxEnabled && taxAmount > 0) {
    cgstAmount = parseFloat((taxAmount / 2).toFixed(2));
    sgstAmount = parseFloat((taxAmount - cgstAmount).toFixed(2));

    const cgstAcc = (await getAccount(conn, companyId, { code: "2100" })) || salesAcc;
    const sgstAcc = (await getAccount(conn, companyId, { code: "2110" })) || salesAcc;

    items.push({
      accountId: cgstAcc.id,
      entryType: "CREDIT",
      amount: cgstAmount,
      narration: `Output CGST on Invoice ${invoice.invoice_no}`,
    });
    items.push({
      accountId: sgstAcc.id,
      entryType: "CREDIT",
      amount: sgstAmount,
      narration: `Output SGST on Invoice ${invoice.invoice_no}`,
    });
  }

  const journal = await postJournalEntry(conn, {
    companyId,
    entryDate: invoice.created_at || new Date(),
    referenceType: "INVOICE",
    referenceId: invoice.id,
    referenceNo: invoice.invoice_no,
    narration: `Sales Invoice ${invoice.invoice_no} to ${customer.name || "Customer"}`,
    items,
    createdBy,
  });

  // Record GST Audit Record if tax enabled
  if (isTaxEnabled && taxAmount > 0) {
    await conn.query(
      `INSERT INTO plastic_gst_records
        (company_id, gst_type, transaction_type, reference_type, reference_id, invoice_no, invoice_date,
         party_type, party_id, party_name, place_of_supply, hsn_code,
         taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
         total_tax, total_amount)
       VALUES (?, 'OUTPUT', 'SALE', 'invoices', ?, ?, ?, 'CUSTOMER', ?, ?, 'Gujarat (24)', '3915', ?, ?, ?, ?, ?, 0.00, 0.00, ?, ?)`,
      [
        companyId,
        invoice.id,
        invoice.invoice_no,
        invoice.created_at || new Date(),
        invoice.customer_id,
        customer.name || "Customer",
        taxableAmount,
        Number(invoice.tax_percent) / 2 || 9.0,
        cgstAmount,
        Number(invoice.tax_percent) / 2 || 9.0,
        sgstAmount,
        taxAmount,
        grandTotal,
      ]
    );
  }

  return journal;
};

/**
 * AUTOMATIC INTEGRATION: Customer Payment Received
 * Dr Cash / Bank
 * Cr Customer (Sundry Debtors)
 */
const postPaymentReceivedAccounting = async (conn, { companyId, payment, customerId, createdBy = null }) => {
  const [existing] = await conn.query(
    `SELECT id FROM plastic_journal_entries WHERE company_id = ? AND reference_type = 'PAYMENT_RECEIVED' AND reference_id = ? LIMIT 1`,
    [companyId, payment.id]
  );
  if (existing.length > 0) return { journalEntryId: existing[0].id, ...existing[0] };

  const customerAcc = (await getAccount(conn, companyId, { code: "1100" })) || (await getAccount(conn, companyId, { refType: "CUSTOMER" }));
  const isCash = String(payment.payment_method).toUpperCase() === "CASH";
  const bankCashAcc = isCash
    ? (await getAccount(conn, companyId, { code: "1000" }))
    : (await getAccount(conn, companyId, { code: "1010" }));

  if (!customerAcc || !bankCashAcc) return null;

  const payAmount = Number(payment.amount) || 0;

  const items = [
    {
      accountId: bankCashAcc.id,
      entryType: "DEBIT",
      amount: payAmount,
      narration: `Payment Received ${payment.payment_no} via ${payment.payment_method}`,
    },
    {
      accountId: customerAcc.id,
      entryType: "CREDIT",
      amount: payAmount,
      narration: `Customer payment received on account (${payment.payment_no})`,
    },
  ];

  const journal = await postJournalEntry(conn, {
    companyId,
    entryDate: payment.payment_date,
    referenceType: "PAYMENT_RECEIVED",
    referenceId: payment.id,
    referenceNo: payment.payment_no,
    narration: `Payment ${payment.payment_no} received from Customer`,
    items,
    createdBy,
  });

  // Link to plastic_bank_transactions
  const [bankAccs] = await conn.query(
    `SELECT id, current_balance FROM plastic_bank_accounts
     WHERE company_id = ? AND account_type = ? AND status = 'ACTIVE' LIMIT 1`,
    [companyId, isCash ? "CASH" : "BANK"]
  );

  if (bankAccs.length > 0) {
    const bAcc = bankAccs[0];
    const newBal = Number(bAcc.current_balance || 0) + payAmount;

    await conn.query(
      `INSERT INTO plastic_bank_transactions
        (company_id, bank_account_id, transaction_date, transaction_type, reference_type, reference_id, reference_no, amount, balance_after, payment_mode, description, created_by)
       VALUES (?, ?, ?, 'RECEIPT', 'plastic_payments', ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        bAcc.id,
        payment.payment_date,
        payment.id,
        payment.payment_no,
        payAmount,
        newBal,
        payment.payment_method,
        `Customer payment collection ${payment.payment_no}`,
        createdBy,
      ]
    );

    await conn.query(
      `UPDATE plastic_bank_accounts SET current_balance = ? WHERE id = ? AND company_id = ?`,
      [newBal, bAcc.id, companyId]
    );
  }

  return journal;
};

/**
 * AUTOMATIC INTEGRATION: Supplier Payment
 * Dr Supplier (Sundry Creditors)
 * Cr Cash / Bank
 */
const postSupplierPaymentAccounting = async (conn, { companyId, payment, supplierId, createdBy = null }) => {
  const actualSupplierId = supplierId || payment.supplier_id;
  const [existing] = await conn.query(
    `SELECT id FROM plastic_journal_entries WHERE company_id = ? AND reference_type = 'SUPPLIER_PAYMENT' AND reference_id = ? LIMIT 1`,
    [companyId, payment.id]
  );
  if (existing.length > 0) return { journalEntryId: existing[0].id, ...existing[0] };

  const supplierAcc = (await getAccount(conn, companyId, { code: "2000" })) || (await getAccount(conn, companyId, { refType: "SUPPLIER" }));
  const isCash = String(payment.payment_method).toUpperCase() === "CASH";
  const bankCashAcc = isCash
    ? (await getAccount(conn, companyId, { code: "1000" }))
    : (await getAccount(conn, companyId, { code: "1010" }));

  if (!supplierAcc || !bankCashAcc) return null;

  const payAmount = Number(payment.amount) || 0;

  const items = [
    {
      accountId: supplierAcc.id,
      entryType: "DEBIT",
      amount: payAmount,
      narration: `Payment made to supplier (${payment.payment_no})`,
    },
    {
      accountId: bankCashAcc.id,
      entryType: "CREDIT",
      amount: payAmount,
      narration: `Disbursement via ${payment.payment_method} for ${payment.payment_no}`,
    },
  ];

  const journal = await postJournalEntry(conn, {
    companyId,
    entryDate: payment.payment_date,
    referenceType: "SUPPLIER_PAYMENT",
    referenceId: payment.id,
    referenceNo: payment.payment_no,
    narration: `Supplier Payment ${payment.payment_no}`,
    items,
    createdBy,
  });

  // Record in Supplier Ledger
  await recordSupplierLedgerEntry(conn, {
    companyId,
    supplierId: actualSupplierId,
    transactionDate: payment.payment_date,
    referenceType: "PAYMENT",
    referenceId: payment.id,
    referenceNo: payment.payment_no,
    debit: payAmount,
    credit: 0.00,
    notes: `Supplier payment voucher ${payment.payment_no}`,
    createdBy,
  });

  // Update bank account and transaction
  const [bankAccs] = await conn.query(
    `SELECT id, current_balance FROM plastic_bank_accounts
     WHERE company_id = ? AND account_type = ? AND status = 'ACTIVE' LIMIT 1`,
    [companyId, isCash ? "CASH" : "BANK"]
  );

  if (bankAccs.length > 0) {
    const bAcc = bankAccs[0];
    const newBal = Number(bAcc.current_balance || 0) - payAmount;

    await conn.query(
      `INSERT INTO plastic_bank_transactions
        (company_id, bank_account_id, transaction_date, transaction_type, reference_type, reference_id, reference_no, amount, balance_after, payment_mode, description, created_by)
       VALUES (?, ?, ?, 'PAYMENT', 'plastic_supplier_payments', ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        bAcc.id,
        payment.payment_date,
        payment.id,
        payment.payment_no,
        payAmount,
        newBal,
        payment.payment_method,
        `Supplier payment voucher ${payment.payment_no}`,
        createdBy,
      ]
    );

    await conn.query(
      `UPDATE plastic_bank_accounts SET current_balance = ? WHERE id = ? AND company_id = ?`,
      [newBal, bAcc.id, companyId]
    );
  }

  return journal;
};

/**
 * AUTOMATIC INTEGRATION: Plant Expenses
 * Dr Expense (by category code)
 * Cr Cash / Bank
 */
const postExpenseAccounting = async (conn, { companyId, expense, createdBy = null }) => {
  const [existing] = await conn.query(
    `SELECT id FROM plastic_journal_entries WHERE company_id = ? AND reference_type = 'EXPENSE' AND reference_id = ? LIMIT 1`,
    [companyId, expense.id]
  );
  if (existing.length > 0) return { journalEntryId: existing[0].id, ...existing[0] };

  // Map category to account
  let expenseAccCode = "6400"; // default misc
  const [catRows] = await conn.query(
    `SELECT code FROM plastic_expense_categories WHERE id = ? AND company_id = ? LIMIT 1`,
    [expense.category_id, companyId]
  );

  const catCode = (catRows[0]?.code || "").toUpperCase();
  if (catCode.includes("POWER") || catCode.includes("ELEC")) expenseAccCode = "5200";
  else if (catCode.includes("MAINT")) expenseAccCode = "5300";
  else if (catCode.includes("FUEL") || catCode.includes("TRANS")) expenseAccCode = "5050";
  else if (catCode.includes("PACK") || catCode.includes("CONSUM")) expenseAccCode = "5400";
  else if (catCode.includes("RENT")) expenseAccCode = "6200";
  else if (catCode.includes("ADMIN") || catCode.includes("OFFICE")) expenseAccCode = "6100";
  else if (catCode.includes("LABOUR")) expenseAccCode = "5100";

  const expAcc = (await getAccount(conn, companyId, { code: expenseAccCode })) || (await getAccount(conn, companyId, { code: "6400" }));
  const isCash = String(expense.payment_mode || "CASH").toUpperCase() === "CASH";
  const bankCashAcc = isCash
    ? (await getAccount(conn, companyId, { code: "1000" }))
    : (await getAccount(conn, companyId, { code: "1010" }));

  if (!expAcc || !bankCashAcc) return null;

  const amt = Number(expense.amount) || 0;

  const items = [
    {
      accountId: expAcc.id,
      entryType: "DEBIT",
      amount: amt,
      narration: `Expense: ${expense.title} (${expense.expense_no})`,
    },
    {
      accountId: bankCashAcc.id,
      entryType: "CREDIT",
      amount: amt,
      narration: `Paid via ${expense.payment_mode || "CASH"} for ${expense.expense_no}`,
    },
  ];

  const journal = await postJournalEntry(conn, {
    companyId,
    entryDate: expense.expense_date,
    referenceType: "EXPENSE",
    referenceId: expense.id,
    referenceNo: expense.expense_no,
    narration: `Plant Expense: ${expense.title}`,
    items,
    createdBy,
  });

  return journal;
};

/**
 * AUTOMATIC INTEGRATION: Monthly Payroll Run & Payment
 */
const postPayrollAccounting = async (conn, { companyId, payroll, status = "PROCESSED", createdBy = null }) => {
  const refType = status === "PAID" ? "PAYROLL_PAID" : "PAYROLL_PROCESSED";
  const [existing] = await conn.query(
    `SELECT id FROM plastic_journal_entries WHERE company_id = ? AND reference_type = ? AND reference_id = ? LIMIT 1`,
    [companyId, refType, payroll.id]
  );
  if (existing.length > 0) return { journalEntryId: existing[0].id, ...existing[0] };

  const totalNet = Number(payroll.total_net_salary) || 0;
  const totalGross = Number(payroll.total_gross_salary) || totalNet;
  const totalAdvances = Number(payroll.total_advances_recovered) || 0;
  const totalStatutory = Math.max(0, totalGross - totalNet - totalAdvances);

  if (status === "PROCESSED") {
    // Dr Salary Expense (6000)
    // Cr Salary Payable (2200)
    // Cr Employee Advance Recovery (1400)
    // Cr Statutory Payables (2300)
    const salExpAcc = (await getAccount(conn, companyId, { code: "6000" })) || (await getAccount(conn, companyId, { code: "5100" }));
    const salPayAcc = (await getAccount(conn, companyId, { code: "2200" }));
    const advRecAcc = (await getAccount(conn, companyId, { code: "1400" }));
    const statPayAcc = (await getAccount(conn, companyId, { code: "2300" }));

    if (totalGross <= 0 || !salExpAcc || !salPayAcc) return null;

    const items = [
      {
        accountId: salExpAcc.id,
        entryType: "DEBIT",
        amount: totalGross,
        narration: `Payroll expense for batch ${payroll.payroll_batch_no}`,
      },
    ];

    if (totalNet > 0) {
      items.push({
        accountId: salPayAcc.id,
        entryType: "CREDIT",
        amount: totalNet,
        narration: `Net salary payable for batch ${payroll.payroll_batch_no}`,
      });
    }

    if (totalAdvances > 0 && advRecAcc) {
      items.push({
        accountId: advRecAcc.id,
        entryType: "CREDIT",
        amount: totalAdvances,
        narration: `Employee advance recovered in batch ${payroll.payroll_batch_no}`,
      });
    }

    if (totalStatutory > 0 && statPayAcc) {
      items.push({
        accountId: statPayAcc.id,
        entryType: "CREDIT",
        amount: totalStatutory,
        narration: `Statutory deductions payable for batch ${payroll.payroll_batch_no}`,
      });
    }

    return await postJournalEntry(conn, {
      companyId,
      entryDate: payroll.end_date || new Date(),
      referenceType: "PAYROLL_PROCESSED",
      referenceId: payroll.id,
      referenceNo: payroll.payroll_batch_no,
      narration: `Payroll Provision for Batch ${payroll.payroll_batch_no}`,
      items,
      createdBy,
    });
  } else if (status === "PAID") {
    // Dr Salary Payable (2200)
    // Cr Bank Account (1010)
    const salPayAcc = await getAccount(conn, companyId, { code: "2200" });
    const bankAcc = await getAccount(conn, companyId, { code: "1010" });

    if (!salPayAcc || !bankAcc || totalNet <= 0) return null;

    const items = [
      {
        accountId: salPayAcc.id,
        entryType: "DEBIT",
        amount: totalNet,
        narration: `Settlement of Salary Payable for ${payroll.payroll_batch_no}`,
      },
      {
        accountId: bankAcc.id,
        entryType: "CREDIT",
        amount: totalNet,
        narration: `Bank disbursement for payroll ${payroll.payroll_batch_no}`,
      },
    ];

    return await postJournalEntry(conn, {
      companyId,
      entryDate: payroll.payment_date || new Date(),
      referenceType: "PAYROLL_PAID",
      referenceId: payroll.id,
      referenceNo: payroll.payroll_batch_no,
      narration: `Salary Payout for Batch ${payroll.payroll_batch_no}`,
      items,
      createdBy,
    });
  }

  return null;
};

/**
 * AUTOMATIC INTEGRATION: Credit Note / Sales Return Adjustment
 * Dr Sales Returns (4100)
 * Dr Output GST (if tax enabled)
 * Cr Customer (1100)
 */
const postCreditNoteAccounting = async (conn, { companyId, creditNote, createdBy = null }) => {
  const [existing] = await conn.query(
    `SELECT id FROM plastic_journal_entries WHERE company_id = ? AND reference_type = 'CREDIT_NOTE' AND reference_id = ? LIMIT 1`,
    [companyId, creditNote.id]
  );
  if (existing.length > 0) return existing[0];

  const salesReturnAcc = (await getAccount(conn, companyId, { code: "4100" })) || (await getAccount(conn, companyId, { code: "4000" }));
  const customerAcc = (await getAccount(conn, companyId, { code: "1100" })) || (await getAccount(conn, companyId, { refType: "CUSTOMER" }));

  if (!salesReturnAcc || !customerAcc) return null;

  const baseAmount = Number(creditNote.amount) || 0;
  const taxAmount = Number(creditNote.tax_amount) || 0;
  const totalAmount = Number(creditNote.total) || (baseAmount + taxAmount);

  const [settingsRows] = await conn.query(
    `SELECT tax_enabled FROM business_settings WHERE company_id = ? LIMIT 1`,
    [companyId]
  );
  const isTaxEnabled = settingsRows.length > 0 && Boolean(settingsRows[0].tax_enabled);

  const items = [];

  // Dr Sales Return
  items.push({
    accountId: salesReturnAcc.id,
    entryType: "DEBIT",
    amount: baseAmount,
    narration: `Credit Note ${creditNote.credit_note_no} - Sales Return / Adjustment`,
  });

  let cgstAmount = 0;
  let sgstAmount = 0;

  if (isTaxEnabled && taxAmount > 0) {
    cgstAmount = parseFloat((taxAmount / 2).toFixed(2));
    sgstAmount = parseFloat((taxAmount - cgstAmount).toFixed(2));

    const cgstAcc = (await getAccount(conn, companyId, { code: "2100" })) || salesReturnAcc;
    const sgstAcc = (await getAccount(conn, companyId, { code: "2110" })) || salesReturnAcc;

    items.push({
      accountId: cgstAcc.id,
      entryType: "DEBIT",
      amount: cgstAmount,
      narration: `Output CGST adjustment on CN ${creditNote.credit_note_no}`,
    });
    items.push({
      accountId: sgstAcc.id,
      entryType: "DEBIT",
      amount: sgstAmount,
      narration: `Output SGST adjustment on CN ${creditNote.credit_note_no}`,
    });
  }

  // Cr Customer
  items.push({
    accountId: customerAcc.id,
    entryType: "CREDIT",
    amount: totalAmount,
    narration: `Credit adjustment allowed to customer (${creditNote.credit_note_no})`,
  });

  const journal = await postJournalEntry(conn, {
    companyId,
    entryDate: creditNote.date,
    referenceType: "CREDIT_NOTE",
    referenceId: creditNote.id,
    referenceNo: creditNote.credit_note_no,
    narration: `Credit Note ${creditNote.credit_note_no} - ${creditNote.reason}`,
    items,
    createdBy,
  });

  // Record GST adjustment in GST records
  if (isTaxEnabled && taxAmount > 0) {
    const [custRows] = await conn.query(
      `SELECT name FROM customers WHERE id = ? AND company_id = ?`,
      [creditNote.customer_id, companyId]
    );

    await conn.query(
      `INSERT INTO plastic_gst_records
        (company_id, gst_type, transaction_type, reference_type, reference_id, invoice_no, invoice_date,
         party_type, party_id, party_name, place_of_supply, hsn_code,
         taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
         total_tax, total_amount)
       VALUES (?, 'OUTPUT', 'CREDIT_NOTE', 'plastic_credit_notes', ?, ?, ?, 'CUSTOMER', ?, ?, 'Gujarat (24)', '3915', ?, ?, ?, ?, ?, 0.00, 0.00, ?, ?)`,
      [
        companyId,
        creditNote.id,
        creditNote.credit_note_no,
        creditNote.date,
        creditNote.customer_id,
        custRows[0]?.name || "Customer",
        baseAmount,
        Number(creditNote.tax_percent) / 2 || 9.0,
        cgstAmount,
        Number(creditNote.tax_percent) / 2 || 9.0,
        sgstAmount,
        taxAmount,
        totalAmount,
      ]
    );
  }

  return journal;
};

/**
 * Higher-order helper to permit calling accounting helpers either with an existing
 * connection/transaction `(conn, payload)` or standalone `(payload)`.
 */
const withConnection = (fn) => async (connOrData, maybeData) => {
  let conn = connOrData;
  let data = maybeData;
  let isInternalConn = false;

  if (!maybeData && (!connOrData || typeof connOrData.query !== "function")) {
    data = connOrData;
    conn = db.promise();
    await conn.beginTransaction();
    isInternalConn = true;
  }

  try {
    const result = await fn(conn, data);
    if (isInternalConn) {
      await conn.commit();
    }
    return result;
  } catch (error) {
    if (isInternalConn) {
      await conn.rollback();
    }
    throw error;
  }
};

module.exports = {
  generateNextJournalNo,
  getAccount,
  postJournalEntry: withConnection(postJournalEntry),
  postPurchaseBillAccounting: withConnection(postPurchaseBillAccounting),
  postSalesInvoiceAccounting: withConnection(postSalesInvoiceAccounting),
  postPaymentReceivedAccounting: withConnection(postPaymentReceivedAccounting),
  postSupplierPaymentAccounting: withConnection(postSupplierPaymentAccounting),
  postExpenseAccounting: withConnection(postExpenseAccounting),
  postPayrollAccounting: withConnection(postPayrollAccounting),
  postCreditNoteAccounting: withConnection(postCreditNoteAccounting),
};
