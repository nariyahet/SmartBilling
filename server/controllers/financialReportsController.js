const db = require("../config/db");

// Helper to compute date range from query params
const getDateRange = (period, fromDate, toDate) => {
  const now = new Date();
  let start = null;
  let end = null;

  if (fromDate && toDate) {
    start = fromDate;
    end = toDate;
  } else if (period === "today") {
    start = now.toISOString().split("T")[0];
    end = start;
  } else if (period === "year") {
    start = `${now.getFullYear()}-01-01`;
    end = `${now.getFullYear()}-12-31`;
  } else {
    // Default: this month
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    start = `${y}-${m}-01`;
    end = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
  }

  return { start, end };
};

/**
 * 1. TRIAL BALANCE
 */
exports.getTrialBalance = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { period, from_date, to_date } = req.query;
    const { start, end } = getDateRange(period, from_date, to_date);

    // Fetch all active accounts with cumulative debits and credits
    const [accounts] = await db.promise().query(
      `SELECT
        a.id, a.account_code, a.account_name, a.account_type, a.debit_credit_nature, a.opening_balance,
        g.name AS group_name, g.code AS group_code,
        COALESCE((
          SELECT SUM(ji.amount)
          FROM plastic_journal_items ji
          JOIN plastic_journal_entries je ON ji.journal_entry_id = je.id AND ji.company_id = je.company_id
          WHERE ji.account_id = a.id AND ji.company_id = a.company_id AND ji.entry_type = 'DEBIT' AND je.entry_date <= ?
        ), 0) AS total_debit,
        COALESCE((
          SELECT SUM(ji.amount)
          FROM plastic_journal_items ji
          JOIN plastic_journal_entries je ON ji.journal_entry_id = je.id AND ji.company_id = je.company_id
          WHERE ji.account_id = a.id AND ji.company_id = a.company_id AND ji.entry_type = 'CREDIT' AND je.entry_date <= ?
        ), 0) AS total_credit
       FROM plastic_accounts a
       JOIN plastic_account_groups g ON a.group_id = g.id AND a.company_id = g.company_id
       WHERE a.company_id = ?
       ORDER BY a.account_code ASC`,
      [end, end, companyId]
    );

    let sumDebit = 0;
    let sumCredit = 0;

    const rows = accounts.map((acc) => {
      const openBal = Number(acc.opening_balance || 0);
      const dr = Number(acc.total_debit || 0);
      const cr = Number(acc.total_credit || 0);

      let finalDebit = 0;
      let finalCredit = 0;

      if (acc.debit_credit_nature === "DEBIT") {
        const net = openBal + dr - cr;
        if (net >= 0) {
          finalDebit = net;
        } else {
          finalCredit = Math.abs(net);
        }
      } else {
        const net = openBal + cr - dr;
        if (net >= 0) {
          finalCredit = net;
        } else {
          finalDebit = Math.abs(net);
        }
      }

      sumDebit += finalDebit;
      sumCredit += finalCredit;

      return {
        id: acc.id,
        accountCode: acc.account_code,
        accountName: acc.account_name,
        accountType: acc.account_type,
        groupName: acc.group_name,
        debit: finalDebit,
        credit: finalCredit,
      };
    });

    const difference = Math.abs(sumDebit - sumCredit);
    const isBalanced = difference < 0.05;

    res.status(200).json({
      success: true,
      reportName: "Trial Balance",
      asOfDate: end,
      isBalanced,
      totalDebit: sumDebit,
      totalCredit: sumCredit,
      difference,
      rows,
    });
  } catch (error) {
    console.error("Trial Balance Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate Trial Balance" });
  }
};

/**
 * 2. PROFIT & LOSS STATEMENT
 */
exports.getProfitAndLoss = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { period, from_date, to_date } = req.query;
    const { start, end } = getDateRange(period, from_date, to_date);

    // 1. Direct Sales & Revenue
    const [salesRows] = await db.promise().query(
      `SELECT
        COALESCE(SUM(grand_total - tax_amount), 0) AS direct_sales,
        COALESCE(SUM(discount_amount), 0) AS total_discounts
       FROM invoices
       WHERE company_id = ? AND DATE(created_at) >= ? AND DATE(created_at) <= ?`,
      [companyId, start, end]
    );

    // Sales returns
    const [retRows] = await db.promise().query(
      `SELECT COALESCE(SUM(total_amount), 0) AS sales_returns
       FROM plastic_sales_returns
       WHERE company_id = ? AND return_date >= ? AND return_date <= ? AND status != 'CANCELLED'`,
      [companyId, start, end]
    );

    const grossSales = Number(salesRows[0]?.direct_sales || 0);
    const salesReturns = Number(retRows[0]?.sales_returns || 0);
    const netSales = Math.max(0, grossSales - salesReturns);

    // 2. Cost of Goods Sold (Raw Scrap Purchases)
    const [purchRows] = await db.promise().query(
      `SELECT COALESCE(SUM(grand_total - tax_amount), 0) AS raw_material_purchases
       FROM purchase_bills
       WHERE company_id = ? AND purchase_date >= ? AND purchase_date <= ?`,
      [companyId, start, end]
    );
    const purchases = Number(purchRows[0]?.raw_material_purchases || 0);

    // 3. Direct Plant Labour (Payroll direct labour)
    const [payrollRows] = await db.promise().query(
      `SELECT COALESCE(SUM(total_gross_salary), 0) AS gross_labour
       FROM plastic_payrolls
       WHERE company_id = ? AND end_date >= ? AND end_date <= ?`,
      [companyId, start, end]
    );
    const directLabour = Number(payrollRows[0]?.gross_labour || 0);

    // 4. Operating Expenses
    const [expenseRows] = await db.promise().query(
      `SELECT c.name AS category_name, c.code AS category_code, COALESCE(SUM(e.amount), 0) AS total
       FROM plastic_expenses e
       JOIN plastic_expense_categories c ON e.category_id = c.id AND e.company_id = c.company_id
       WHERE e.company_id = ? AND e.expense_date >= ? AND e.expense_date <= ?
       GROUP BY c.id`,
      [companyId, start, end]
    );

    const totalPlantExpenses = expenseRows.reduce((acc, e) => acc + Number(e.total || 0), 0);
    const cogs = purchases + (directLabour * 0.7); // 70% direct plant labour in COGS
    const grossProfit = netSales - cogs;

    const operatingExpenses = totalPlantExpenses + (directLabour * 0.3); // 30% admin/overhead labour
    const netProfit = grossProfit - operatingExpenses;

    res.status(200).json({
      success: true,
      reportName: "Profit & Loss Statement",
      period: { start, end },
      income: {
        grossSales,
        salesReturns,
        netSales,
        otherIncome: 0.00,
        totalIncome: netSales,
      },
      costOfGoodsSold: {
        rawMaterialPurchases: purchases,
        directPlantLabour: directLabour * 0.7,
        totalCOGS: cogs,
      },
      grossProfit,
      operatingExpenses: {
        categories: expenseRows,
        administrativeLabour: directLabour * 0.3,
        totalOperatingExpenses: operatingExpenses,
      },
      netProfit,
    });
  } catch (error) {
    console.error("Profit & Loss Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate Profit & Loss" });
  }
};

/**
 * 3. BALANCE SHEET
 */
exports.getBalanceSheet = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { period, from_date, to_date } = req.query;
    const { end } = getDateRange(period, from_date, to_date);

    // Current Assets:
    // 1. Cash & Bank balances
    const [bankRows] = await db.promise().query(
      `SELECT account_type, SUM(current_balance) AS total FROM plastic_bank_accounts WHERE company_id = ? GROUP BY account_type`,
      [companyId]
    );
    const cashBalance = Number(bankRows.find((b) => b.account_type === "CASH")?.total || 0);
    const bankBalance = Number(bankRows.find((b) => b.account_type === "BANK")?.total || 0);

    // 2. Sundry Debtors (Receivables)
    const [recRows] = await db.promise().query(
      `SELECT COALESCE(SUM(grand_total - paid_amount), 0) AS total_receivable FROM invoices WHERE company_id = ?`,
      [companyId]
    );
    const receivables = Number(recRows[0]?.total_receivable || 0);

    // 3. Raw Material Stock Value
    const [rawStock] = await db.promise().query(
      `SELECT COALESCE(SUM(stock_value), 0) AS total_value FROM raw_material_stock WHERE company_id = ?`,
      [companyId]
    );
    const rawMaterialStock = Number(rawStock[0]?.total_value || 0);

    // 4. Finished Goods Stock Value
    const [fgStock] = await db.promise().query(
      `SELECT COALESCE(SUM(current_stock * cost_per_kg), 0) AS total_value FROM plastic_finished_goods WHERE company_id = ?`,
      [companyId]
    );
    const finishedGoodsStock = Number(fgStock[0]?.total_value || 0);

    // 5. Input GST Credit
    const [itcRows] = await db.promise().query(
      `SELECT COALESCE(SUM(total_tax), 0) AS total_itc FROM plastic_gst_records WHERE company_id = ? AND gst_type = 'INPUT'`,
      [companyId]
    );
    const inputGstCredit = Number(itcRows[0]?.total_itc || 0);

    const totalCurrentAssets = cashBalance + bankBalance + receivables + rawMaterialStock + finishedGoodsStock + inputGstCredit;
    const fixedAssets = 1500000.00; // Plant, Shed & Extruders (seeded valuation or fixed)
    const totalAssets = totalCurrentAssets + fixedAssets;

    // Liabilities:
    // 1. Sundry Creditors (Payables)
    const [payRows] = await db.promise().query(
      `SELECT COALESCE(SUM(grand_total), 0) AS total_bills FROM purchase_bills WHERE company_id = ? AND payment_status != 'PAID'`,
      [companyId]
    );
    const payables = Number(payRows[0]?.total_bills || 0);

    // 2. Output GST Liability
    const [outGstRows] = await db.promise().query(
      `SELECT COALESCE(SUM(total_tax), 0) AS total_output FROM plastic_gst_records WHERE company_id = ? AND gst_type = 'OUTPUT'`,
      [companyId]
    );
    const outputGstLiability = Number(outGstRows[0]?.total_output || 0);

    // 3. Payroll / Expenses Payable
    const [salPayRows] = await db.promise().query(
      `SELECT COALESCE(SUM(total_net_salary), 0) AS total_pending FROM plastic_payrolls WHERE company_id = ? AND status != 'PAID'`,
      [companyId]
    );
    const salaryPayable = Number(salPayRows[0]?.total_pending || 0);

    const totalLiabilities = payables + outputGstLiability + salaryPayable;

    // Equity: Balancing figure (Assets - Liabilities)
    const totalEquity = totalAssets - totalLiabilities;

    res.status(200).json({
      success: true,
      reportName: "Balance Sheet",
      asOfDate: end,
      assets: {
        currentAssets: {
          cashBalance,
          bankBalance,
          accountsReceivable: receivables,
          rawMaterialInventory: rawMaterialStock,
          finishedGoodsInventory: finishedGoodsStock,
          inputGstBalance: inputGstCredit,
          totalCurrentAssets,
        },
        nonCurrentAssets: {
          plantAndMachinery: fixedAssets,
          totalNonCurrentAssets: fixedAssets,
        },
        totalAssets,
      },
      liabilitiesAndEquity: {
        currentLiabilities: {
          accountsPayable: payables,
          outputGstLiability,
          salaryAndWagesPayable: salaryPayable,
          totalCurrentLiabilities: totalLiabilities,
        },
        equity: {
          capitalAndReserves: totalEquity,
          totalEquity,
        },
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      },
    });
  } catch (error) {
    console.error("Balance Sheet Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate Balance Sheet" });
  }
};

/**
 * 4. CASH BOOK
 */
exports.getCashBook = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { period, from_date, to_date } = req.query;
    const { start, end } = getDateRange(period, from_date, to_date);

    const [cashAccounts] = await db.promise().query(
      `SELECT * FROM plastic_bank_accounts WHERE company_id = ? AND account_type = 'CASH' LIMIT 1`,
      [companyId]
    );

    const cashAcc = cashAccounts[0] || {};

    const [transactions] = await db.promise().query(
      `SELECT bt.*, adm.name AS created_by_name
       FROM plastic_bank_transactions bt
       JOIN plastic_bank_accounts ba ON bt.bank_account_id = ba.id AND bt.company_id = ba.company_id
       LEFT JOIN admins adm ON bt.created_by = adm.id
       WHERE bt.company_id = ? AND ba.account_type = 'CASH' AND bt.transaction_date >= ? AND bt.transaction_date <= ?
       ORDER BY bt.transaction_date ASC, bt.id ASC`,
      [companyId, start, end]
    );

    const receipts = transactions.filter((t) => ["DEPOSIT", "RECEIPT"].includes(t.transaction_type) || (t.transaction_type === "TRANSFER" && t.description?.includes("Transfer from")));
    const payments = transactions.filter((t) => ["WITHDRAWAL", "PAYMENT"].includes(t.transaction_type) || (t.transaction_type === "TRANSFER" && t.description?.includes("Transfer to")));

    const totalReceipts = receipts.reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const totalPayments = payments.reduce((acc, t) => acc + Number(t.amount || 0), 0);

    res.status(200).json({
      success: true,
      reportName: "Cash Book",
      period: { start, end },
      summary: {
        accountName: cashAcc.account_name || "Cash Register",
        openingBalance: Number(cashAcc.opening_balance || 0),
        totalReceipts,
        totalPayments,
        closingBalance: Number(cashAcc.current_balance || 0),
      },
      transactions,
    });
  } catch (error) {
    console.error("Cash Book Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate Cash Book" });
  }
};

/**
 * 5. BANK BOOK
 */
exports.getBankBook = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { period, from_date, to_date } = req.query;
    const { start, end } = getDateRange(period, from_date, to_date);

    const [bankAccounts] = await db.promise().query(
      `SELECT * FROM plastic_bank_accounts WHERE company_id = ? AND account_type = 'BANK' LIMIT 1`,
      [companyId]
    );
    const bankAcc = bankAccounts[0] || {};

    const [transactions] = await db.promise().query(
      `SELECT bt.*, adm.name AS created_by_name
       FROM plastic_bank_transactions bt
       JOIN plastic_bank_accounts ba ON bt.bank_account_id = ba.id AND bt.company_id = ba.company_id
       LEFT JOIN admins adm ON bt.created_by = adm.id
       WHERE bt.company_id = ? AND ba.account_type = 'BANK' AND bt.transaction_date >= ? AND bt.transaction_date <= ?
       ORDER BY bt.transaction_date ASC, bt.id ASC`,
      [companyId, start, end]
    );

    const deposits = transactions.filter((t) => ["DEPOSIT", "RECEIPT"].includes(t.transaction_type) || (t.transaction_type === "TRANSFER" && t.description?.includes("Transfer from")));
    const withdrawals = transactions.filter((t) => ["WITHDRAWAL", "PAYMENT"].includes(t.transaction_type) || (t.transaction_type === "TRANSFER" && t.description?.includes("Transfer to")));

    const totalDeposits = deposits.reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const totalWithdrawals = withdrawals.reduce((acc, t) => acc + Number(t.amount || 0), 0);

    res.status(200).json({
      success: true,
      reportName: "Bank Book",
      period: { start, end },
      summary: {
        bankName: bankAcc.bank_name || "Operating Bank",
        accountNumber: bankAcc.account_number || "",
        openingBalance: Number(bankAcc.opening_balance || 0),
        totalDeposits,
        totalWithdrawals,
        closingBalance: Number(bankAcc.current_balance || 0),
      },
      transactions,
    });
  } catch (error) {
    console.error("Bank Book Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate Bank Book" });
  }
};

/**
 * 6. GENERAL LEDGER
 */
exports.getGeneralLedger = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { account_id, period, from_date, to_date } = req.query;
    const { start, end } = getDateRange(period, from_date, to_date);

    if (!account_id) {
      return res.status(400).json({ success: false, message: "Account is required for General Ledger" });
    }

    const [accounts] = await db.promise().query(
      `SELECT a.*, g.name AS group_name FROM plastic_accounts a JOIN plastic_account_groups g ON a.group_id = g.id WHERE a.id = ? AND a.company_id = ? LIMIT 1`,
      [account_id, companyId]
    );

    if (accounts.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    const account = accounts[0];

    const [entries] = await db.promise().query(
      `SELECT
        ji.id, ji.entry_type, ji.amount, ji.narration,
        je.journal_no, je.entry_date, je.reference_type, je.reference_no
       FROM plastic_journal_items ji
       JOIN plastic_journal_entries je ON ji.journal_entry_id = je.id AND ji.company_id = je.company_id
       WHERE ji.account_id = ? AND ji.company_id = ? AND je.entry_date >= ? AND je.entry_date <= ?
       ORDER BY je.entry_date ASC, je.id ASC`,
      [account_id, companyId, start, end]
    );

    let runningBalance = Number(account.opening_balance || 0);
    const ledgerRows = entries.map((e) => {
      const amt = Number(e.amount || 0);
      if (account.debit_credit_nature === "DEBIT") {
        runningBalance += e.entry_type === "DEBIT" ? amt : -amt;
      } else {
        runningBalance += e.entry_type === "CREDIT" ? amt : -amt;
      }

      return {
        ...e,
        debit: e.entry_type === "DEBIT" ? amt : 0,
        credit: e.entry_type === "CREDIT" ? amt : 0,
        balance: runningBalance,
      };
    });

    res.status(200).json({
      success: true,
      reportName: `General Ledger: ${account.account_name}`,
      account,
      period: { start, end },
      summary: {
        openingBalance: Number(account.opening_balance || 0),
        totalDebits: entries.filter((e) => e.entry_type === "DEBIT").reduce((acc, e) => acc + Number(e.amount || 0), 0),
        totalCredits: entries.filter((e) => e.entry_type === "CREDIT").reduce((acc, e) => acc + Number(e.amount || 0), 0),
        closingBalance: runningBalance,
      },
      entries: ledgerRows,
    });
  } catch (error) {
    console.error("General Ledger Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate General Ledger" });
  }
};

/**
 * 7. CUSTOMER LEDGER REPORT
 */
exports.getCustomerLedgerReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { customer_id, period, from_date, to_date } = req.query;
    const { start, end } = getDateRange(period, from_date, to_date);

    let sql = `
      SELECT cl.*, c.name AS customer_name, c.mobile
      FROM plastic_customer_ledger cl
      JOIN customers c ON cl.customer_id = c.id AND cl.company_id = c.company_id
      WHERE cl.company_id = ? AND cl.transaction_date >= ? AND cl.transaction_date <= ?
    `;
    const params = [companyId, start, end];

    if (customer_id && customer_id !== "ALL") {
      sql += ` AND cl.customer_id = ?`;
      params.push(customer_id);
    }

    sql += ` ORDER BY cl.transaction_date ASC, cl.id ASC`;

    const [rows] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      reportName: "Customer Ledger Statement",
      period: { start, end },
      entries: rows,
    });
  } catch (error) {
    console.error("Customer Ledger Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch customer ledger" });
  }
};

/**
 * 8. SUPPLIER LEDGER REPORT
 */
exports.getSupplierLedgerReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { supplier_id, period, from_date, to_date } = req.query;
    const { start, end } = getDateRange(period, from_date, to_date);

    let sql = `
      SELECT sl.*, s.supplier_name, s.supplier_code
      FROM plastic_supplier_ledger sl
      JOIN suppliers s ON sl.supplier_id = s.id AND sl.company_id = s.company_id
      WHERE sl.company_id = ? AND sl.transaction_date >= ? AND sl.transaction_date <= ?
    `;
    const params = [companyId, start, end];

    if (supplier_id && supplier_id !== "ALL") {
      sql += ` AND sl.supplier_id = ?`;
      params.push(supplier_id);
    }

    sql += ` ORDER BY sl.transaction_date ASC, sl.id ASC`;

    const [rows] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      reportName: "Supplier Ledger Statement",
      period: { start, end },
      entries: rows,
    });
  } catch (error) {
    console.error("Supplier Ledger Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch supplier ledger" });
  }
};

/**
 * 9. EXPENSE REPORT
 */
exports.getExpenseReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { period, from_date, to_date } = req.query;
    const { start, end } = getDateRange(period, from_date, to_date);

    const [byCategory] = await db.promise().query(
      `SELECT c.name AS category_name, c.code AS category_code, COUNT(e.id) AS voucher_count, SUM(e.amount) AS total_amount
       FROM plastic_expenses e
       JOIN plastic_expense_categories c ON e.category_id = c.id AND e.company_id = c.company_id
       WHERE e.company_id = ? AND e.expense_date >= ? AND e.expense_date <= ?
       GROUP BY c.id
       ORDER BY total_amount DESC`,
      [companyId, start, end]
    );

    const [byPaymentMode] = await db.promise().query(
      `SELECT payment_mode, COUNT(id) AS count, SUM(amount) AS total_amount
       FROM plastic_expenses
       WHERE company_id = ? AND expense_date >= ? AND expense_date <= ?
       GROUP BY payment_mode`,
      [companyId, start, end]
    );

    res.status(200).json({
      success: true,
      reportName: "Plant Expense Report",
      period: { start, end },
      totalExpenses: byCategory.reduce((acc, c) => acc + Number(c.total_amount || 0), 0),
      byCategory,
      byPaymentMode,
    });
  } catch (error) {
    console.error("Expense Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate Expense Report" });
  }
};

/**
 * 10. RECEIVABLE REPORT & AGING
 */
exports.getReceivableReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [invoices] = await db.promise().query(
      `SELECT
        inv.id, inv.invoice_no, inv.customer_id, c.name AS customer_name, c.mobile,
        inv.grand_total, inv.paid_amount, (inv.grand_total - inv.paid_amount) AS outstanding_amount,
        inv.created_at,
        DATEDIFF(NOW(), inv.created_at) AS days_aged
       FROM invoices inv
       JOIN customers c ON inv.customer_id = c.id AND inv.company_id = c.company_id
       WHERE inv.company_id = ? AND (inv.grand_total - inv.paid_amount) > 0
       ORDER BY days_aged DESC`,
      [companyId]
    );

    const aging = {
      bucket0_30: 0,
      bucket31_60: 0,
      bucket61_90: 0,
      bucket90Plus: 0,
      totalOutstanding: 0,
    };

    invoices.forEach((inv) => {
      const amt = Number(inv.outstanding_amount || 0);
      const days = Number(inv.days_aged || 0);
      aging.totalOutstanding += amt;

      if (days <= 30) aging.bucket0_30 += amt;
      else if (days <= 60) aging.bucket31_60 += amt;
      else if (days <= 90) aging.bucket61_90 += amt;
      else aging.bucket90Plus += amt;
    });

    res.status(200).json({
      success: true,
      reportName: "Accounts Receivable & Aging Report",
      aging,
      invoices,
    });
  } catch (error) {
    console.error("Receivable Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch receivables" });
  }
};

/**
 * 11. PAYABLE REPORT & AGING
 */
exports.getPayableReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [bills] = await db.promise().query(
      `SELECT
        pb.id, pb.purchase_bill_no, pb.supplier_id, s.supplier_name, s.mobile,
        pb.grand_total, pb.purchase_date,
        DATEDIFF(NOW(), pb.purchase_date) AS days_aged
       FROM purchase_bills pb
       JOIN suppliers s ON pb.supplier_id = s.id AND pb.company_id = s.company_id
       WHERE pb.company_id = ? AND pb.payment_status != 'PAID'
       ORDER BY days_aged DESC`,
      [companyId]
    );

    const aging = {
      bucket0_30: 0,
      bucket31_60: 0,
      bucket61_90: 0,
      bucket90Plus: 0,
      totalPayable: 0,
    };

    bills.forEach((b) => {
      const amt = Number(b.grand_total || 0);
      const days = Number(b.days_aged || 0);
      aging.totalPayable += amt;

      if (days <= 30) aging.bucket0_30 += amt;
      else if (days <= 60) aging.bucket31_60 += amt;
      else if (days <= 90) aging.bucket61_90 += amt;
      else aging.bucket90Plus += amt;
    });

    res.status(200).json({
      success: true,
      reportName: "Accounts Payable & Aging Report",
      aging,
      bills,
    });
  } catch (error) {
    console.error("Payable Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payables" });
  }
};

/**
 * 12. GST SUMMARY REPORT
 */
exports.getGstSummaryReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { period, from_date, to_date } = req.query;
    const { start, end } = getDateRange(period, from_date, to_date);

    const [records] = await db.promise().query(
      `SELECT
        gst_type,
        COUNT(id) AS voucher_count,
        COALESCE(SUM(taxable_amount), 0) AS total_taxable,
        COALESCE(SUM(cgst_amount), 0) AS total_cgst,
        COALESCE(SUM(sgst_amount), 0) AS total_sgst,
        COALESCE(SUM(igst_amount), 0) AS total_igst,
        COALESCE(SUM(total_tax), 0) AS total_tax
       FROM plastic_gst_records
       WHERE company_id = ? AND invoice_date >= ? AND invoice_date <= ?
       GROUP BY gst_type`,
      [companyId, start, end]
    );

    const outputGst = records.find((r) => r.gst_type === "OUTPUT") || { total_taxable: 0, total_cgst: 0, total_sgst: 0, total_igst: 0, total_tax: 0 };
    const inputGst = records.find((r) => r.gst_type === "INPUT") || { total_taxable: 0, total_cgst: 0, total_sgst: 0, total_igst: 0, total_tax: 0 };

    const netTaxPayable = Math.max(0, Number(outputGst.total_tax || 0) - Number(inputGst.total_tax || 0));

    res.status(200).json({
      success: true,
      reportName: "GST Periodic Summary",
      period: { start, end },
      outputGst,
      inputGst,
      netTaxPayable,
    });
  } catch (error) {
    console.error("GST Summary Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate GST Summary" });
  }
};

/**
 * 13. HSN SUMMARY REPORT
 */
exports.getHsnSummaryReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { period, from_date, to_date } = req.query;
    const { start, end } = getDateRange(period, from_date, to_date);

    const [hsnRows] = await db.promise().query(
      `SELECT
        hsn_code,
        gst_type,
        COUNT(id) AS count,
        COALESCE(SUM(taxable_amount), 0) AS taxable_value,
        COALESCE(SUM(cgst_amount), 0) AS cgst,
        COALESCE(SUM(sgst_amount), 0) AS sgst,
        COALESCE(SUM(igst_amount), 0) AS igst,
        COALESCE(SUM(total_tax), 0) AS total_tax
       FROM plastic_gst_records
       WHERE company_id = ? AND invoice_date >= ? AND invoice_date <= ?
       GROUP BY hsn_code, gst_type
       ORDER BY hsn_code ASC`,
      [companyId, start, end]
    );

    res.status(200).json({
      success: true,
      reportName: "HSN / SAC Summary Report",
      period: { start, end },
      hsnRows,
    });
  } catch (error) {
    console.error("HSN Summary Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate HSN Summary" });
  }
};

/**
 * 14. CASH FLOW SUMMARY
 */
exports.getCashFlowSummary = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { period, from_date, to_date } = req.query;
    const { start, end } = getDateRange(period, from_date, to_date);

    // Operating Inflows: Customer payments
    const [custPay] = await db.promise().query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM plastic_payments WHERE company_id = ? AND payment_date >= ? AND payment_date <= ?`,
      [companyId, start, end]
    );
    const customerCollections = Number(custPay[0]?.total || 0);

    // Operating Outflows: Supplier payments & Plant expenses
    const [supPay] = await db.promise().query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM plastic_supplier_payments WHERE company_id = ? AND payment_date >= ? AND payment_date <= ?`,
      [companyId, start, end]
    );
    const supplierDisbursements = Number(supPay[0]?.total || 0);

    const [expPay] = await db.promise().query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM plastic_expenses WHERE company_id = ? AND expense_date >= ? AND expense_date <= ?`,
      [companyId, start, end]
    );
    const expenseDisbursements = Number(expPay[0]?.total || 0);

    const [salPay] = await db.promise().query(
      `SELECT COALESCE(SUM(total_net_salary), 0) AS total FROM plastic_payrolls WHERE company_id = ? AND status = 'PAID' AND payment_date >= ? AND payment_date <= ?`,
      [companyId, start, end]
    );
    const payrollDisbursements = Number(salPay[0]?.total || 0);

    const operatingCashFlow = customerCollections - (supplierDisbursements + expenseDisbursements + payrollDisbursements);

    res.status(200).json({
      success: true,
      reportName: "Cash Flow Summary",
      period: { start, end },
      cashFlowFromOperations: {
        inflows: {
          customerCollections,
          totalInflows: customerCollections,
        },
        outflows: {
          supplierDisbursements,
          expenseDisbursements,
          payrollDisbursements,
          totalOutflows: supplierDisbursements + expenseDisbursements + payrollDisbursements,
        },
        netOperatingCashFlow: operatingCashFlow,
      },
      cashFlowFromInvesting: {
        machineryCapex: 0.00,
        netInvestingCashFlow: 0.00,
      },
      cashFlowFromFinancing: {
        capitalIntroduced: 0.00,
        netFinancingCashFlow: 0.00,
      },
      netChangeInCash: operatingCashFlow,
    });
  } catch (error) {
    console.error("Cash Flow Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate Cash Flow Summary" });
  }
};

/**
 * 15. FINANCIAL DASHBOARD KPIS (MODULE 11)
 */
exports.getFinancialDashboardKPIs = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Total Revenue (Invoices)
    const [revRows] = await db.promise().query(
      `SELECT COALESCE(SUM(grand_total), 0) AS total_revenue,
              COALESCE(SUM(grand_total - paid_amount), 0) AS total_receivables
       FROM invoices WHERE company_id = ?`,
      [companyId]
    );
    const totalRevenue = Number(revRows[0]?.total_revenue || 0);
    const receivables = Number(revRows[0]?.total_receivables || 0);

    // Total Purchases (Purchase Bills)
    const [purchRows] = await db.promise().query(
      `SELECT COALESCE(SUM(grand_total), 0) AS total_purchases,
              COALESCE(SUM(CASE WHEN payment_status != 'PAID' THEN grand_total ELSE 0 END), 0) AS total_payables
       FROM purchase_bills WHERE company_id = ?`,
      [companyId]
    );
    const totalPurchases = Number(purchRows[0]?.total_purchases || 0);
    const payables = Number(purchRows[0]?.total_payables || 0);

    // Liquid Balances
    const [bankRows] = await db.promise().query(
      `SELECT account_type, SUM(current_balance) AS balance
       FROM plastic_bank_accounts WHERE company_id = ? GROUP BY account_type`,
      [companyId]
    );
    const cashBalance = Number(bankRows.find((b) => b.account_type === "CASH")?.balance || 0);
    const bankBalance = Number(bankRows.find((b) => b.account_type === "BANK")?.balance || 0);

    // Expenses & Labour
    const [expRows] = await db.promise().query(
      `SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM plastic_expenses WHERE company_id = ?`,
      [companyId]
    );
    const totalExpenses = Number(expRows[0]?.total_expenses || 0);

    const [payrollRows] = await db.promise().query(
      `SELECT COALESCE(SUM(total_gross_salary), 0) AS total_payroll FROM plastic_payrolls WHERE company_id = ?`,
      [companyId]
    );
    const totalPayroll = Number(payrollRows[0]?.total_payroll || 0);

    // Profits
    const directCosts = totalPurchases + (totalPayroll * 0.7);
    const grossProfit = totalRevenue - directCosts;
    const netProfit = grossProfit - (totalExpenses + (totalPayroll * 0.3));

    // GST Metrics
    const [gstRows] = await db.promise().query(
      `SELECT gst_type, COALESCE(SUM(total_tax), 0) AS tax
       FROM plastic_gst_records WHERE company_id = ? GROUP BY gst_type`,
      [companyId]
    );
    const inputGst = Number(gstRows.find((g) => g.gst_type === "INPUT")?.tax || 0);
    const outputGst = Number(gstRows.find((g) => g.gst_type === "OUTPUT")?.tax || 0);
    const netGstPayable = Math.max(0, outputGst - inputGst);

    // Monthly trends (last 6 months)
    const [monthlyRev] = await db.promise().query(
      `SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month_key,
        DATE_FORMAT(created_at, '%b %Y') AS month_name,
        COALESCE(SUM(grand_total), 0) AS revenue
       FROM invoices
       WHERE company_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month_key, month_name
       ORDER BY month_key ASC`,
      [companyId]
    );

    const [monthlyExp] = await db.promise().query(
      `SELECT
        DATE_FORMAT(expense_date, '%Y-%m') AS month_key,
        COALESCE(SUM(amount), 0) AS expenses
       FROM plastic_expenses
       WHERE company_id = ? AND expense_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month_key`,
      [companyId]
    );

    const expMap = {};
    monthlyExp.forEach((e) => { expMap[e.month_key] = Number(e.expenses || 0); });

    const monthlyTrends = monthlyRev.map((m) => {
      const rev = Number(m.revenue || 0);
      const exp = expMap[m.month_key] || 0;
      return {
        month: m.month_name,
        revenue: rev,
        expenses: exp,
        profit: rev - exp,
      };
    });

    res.status(200).json({
      success: true,
      kpis: {
        totalRevenue,
        totalPurchases,
        grossProfit,
        netProfit,
        receivables,
        payables,
        cashBalance,
        bankBalance,
        inputGst,
        outputGst,
        netGstPayable,
      },
      monthlyTrends,
    });
  } catch (error) {
    console.error("Dashboard KPIs Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch financial dashboard KPIs" });
  }
};

