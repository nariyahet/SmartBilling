const db = require("../config/db");

exports.getReceivablesSummary = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // 1. Total Invoiced
    const [invRows] = await db.promise().query(
      `SELECT
        COALESCE(SUM(grand_total), 0) AS totalInvoiced,
        COALESCE(SUM(paid_amount), 0) AS totalPaidOnInvoices
       FROM invoices
       WHERE company_id = ?`,
      [companyId]
    );
    const totalInvoiced = Number(invRows[0]?.totalInvoiced) || 0;
    const totalPaidOnInvoices = Number(invRows[0]?.totalPaidOnInvoices) || 0;

    // 2. Total Payments Recorded
    const [payRows] = await db.promise().query(
      `SELECT COALESCE(SUM(amount), 0) AS totalCollected
       FROM plastic_payments
       WHERE company_id = ? AND status = 'RECEIVED'`,
      [companyId]
    );
    const totalCollected = Number(payRows[0]?.totalCollected) || 0;

    // 3. Total Credit Notes
    const [cnRows] = await db.promise().query(
      `SELECT COALESCE(SUM(total), 0) AS totalCreditNotes
       FROM plastic_credit_notes
       WHERE company_id = ? AND status = 'ISSUED'`,
      [companyId]
    );
    const totalCreditNotes = Number(cnRows[0]?.totalCreditNotes) || 0;

    // 4. Total Debit Notes
    const [dnRows] = await db.promise().query(
      `SELECT COALESCE(SUM(total), 0) AS totalDebitNotes
       FROM plastic_debit_notes
       WHERE company_id = ? AND status = 'ISSUED'`,
      [companyId]
    );
    const totalDebitNotes = Number(dnRows[0]?.totalDebitNotes) || 0;

    // Net Outstanding = (Invoiced + Debit Notes) - (Collected/Paid + Credit Notes)
    const effectivePaid = Math.max(totalCollected, totalPaidOnInvoices);
    const netOutstanding = Math.max(0, totalInvoiced + totalDebitNotes - effectivePaid - totalCreditNotes);

    // 5. Aging Calculation across unpaid/partially paid invoices
    const [unpaidInvoices] = await db.promise().query(
      `SELECT
        id,
        created_at,
        due_date,
        grand_total,
        paid_amount,
        (grand_total - paid_amount) AS balance_due,
        DATEDIFF(CURDATE(), COALESCE(due_date, DATE(created_at))) AS days_overdue
       FROM invoices
       WHERE company_id = ? AND (payment_status != 'PAID' OR paid_amount < grand_total)`,
      [companyId]
    );

    const aging = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
    };

    let overdueCount = 0;
    let overdueAmount = 0;

    for (const inv of unpaidInvoices) {
      const balance = Number(inv.balance_due) || 0;
      const days = Number(inv.days_overdue) || 0;

      if (days <= 0) {
        aging.current += balance;
      } else if (days <= 30) {
        aging.days1_30 += balance;
        overdueCount++;
        overdueAmount += balance;
      } else if (days <= 60) {
        aging.days31_60 += balance;
        overdueCount++;
        overdueAmount += balance;
      } else if (days <= 90) {
        aging.days61_90 += balance;
        overdueCount++;
        overdueAmount += balance;
      } else {
        aging.days90Plus += balance;
        overdueCount++;
        overdueAmount += balance;
      }
    }

    res.status(200).json({
      success: true,
      summary: {
        totalInvoiced,
        totalCollected,
        totalCreditNotes,
        totalDebitNotes,
        netOutstanding,
        overdueCount,
        overdueAmount,
        aging,
      },
    });
  } catch (error) {
    console.error("Get Receivables Summary Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch receivables summary" });
  }
};

exports.getCustomerReceivables = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Fetch all customers for this company
    const [customers] = await db.promise().query(
      `SELECT id, name, mobile, email FROM customers WHERE company_id = ? ORDER BY name ASC`,
      [companyId]
    );

    // Invoices sum per customer
    const [invRows] = await db.promise().query(
      `SELECT customer_id, COALESCE(SUM(grand_total), 0) AS total_invoiced, COALESCE(SUM(paid_amount), 0) AS total_paid_invoices
       FROM invoices
       WHERE company_id = ?
       GROUP BY customer_id`,
      [companyId]
    );
    const invMap = {};
    invRows.forEach((r) => {
      invMap[r.customer_id] = {
        invoiced: Number(r.total_invoiced) || 0,
        paidInvoices: Number(r.total_paid_invoices) || 0,
      };
    });

    // Payments sum per customer
    const [payRows] = await db.promise().query(
      `SELECT customer_id, COALESCE(SUM(amount), 0) AS total_paid
       FROM plastic_payments
       WHERE company_id = ? AND status = 'RECEIVED'
       GROUP BY customer_id`,
      [companyId]
    );
    const payMap = {};
    payRows.forEach((r) => {
      payMap[r.customer_id] = Number(r.total_paid) || 0;
    });

    // Credit notes per customer
    const [cnRows] = await db.promise().query(
      `SELECT customer_id, COALESCE(SUM(total), 0) AS total_cn
       FROM plastic_credit_notes
       WHERE company_id = ? AND status = 'ISSUED'
       GROUP BY customer_id`,
      [companyId]
    );
    const cnMap = {};
    cnRows.forEach((r) => {
      cnMap[r.customer_id] = Number(r.total_cn) || 0;
    });

    // Debit notes per customer
    const [dnRows] = await db.promise().query(
      `SELECT customer_id, COALESCE(SUM(total), 0) AS total_dn
       FROM plastic_debit_notes
       WHERE company_id = ? AND status = 'ISSUED'
       GROUP BY customer_id`,
      [companyId]
    );
    const dnMap = {};
    dnRows.forEach((r) => {
      dnMap[r.customer_id] = Number(r.total_dn) || 0;
    });

    const customerReceivables = customers.map((c) => {
      const inv = invMap[c.id] || { invoiced: 0, paidInvoices: 0 };
      const paid = Math.max(payMap[c.id] || 0, inv.paidInvoices);
      const cn = cnMap[c.id] || 0;
      const dn = dnMap[c.id] || 0;
      const outstanding = Math.max(0, inv.invoiced + dn - paid - cn);

      return {
        customer_id: c.id,
        customer_name: c.name,
        customer_mobile: c.mobile,
        customer_email: c.email,
        total_invoiced: inv.invoiced,
        total_paid: paid,
        credit_notes: cn,
        debit_notes: dn,
        outstanding,
      };
    });

    res.status(200).json({
      success: true,
      customers: customerReceivables,
    });
  } catch (error) {
    console.error("Get Customer Receivables Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch customer receivables" });
  }
};

exports.getReceivablesAging = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [invoices] = await db.promise().query(
      `SELECT
        inv.id,
        inv.invoice_no,
        inv.customer_id,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        inv.created_at AS invoice_date,
        inv.due_date,
        inv.grand_total,
        inv.paid_amount,
        (inv.grand_total - inv.paid_amount) AS outstanding,
        inv.payment_status,
        DATEDIFF(CURDATE(), COALESCE(inv.due_date, DATE(inv.created_at))) AS days_overdue
       FROM invoices inv
       JOIN customers c ON inv.customer_id = c.id AND inv.company_id = c.company_id
       WHERE inv.company_id = ? AND (inv.payment_status != 'PAID' OR inv.paid_amount < inv.grand_total)
       ORDER BY days_overdue DESC, inv.id DESC`,
      [companyId]
    );

    const agingRows = invoices.map((inv) => {
      const days = Number(inv.days_overdue) || 0;
      let bucket = "Current";

      if (days <= 0) {
        bucket = "Current";
      } else if (days <= 30) {
        bucket = "1–30 Days";
      } else if (days <= 60) {
        bucket = "31–60 Days";
      } else if (days <= 90) {
        bucket = "61–90 Days";
      } else {
        bucket = "90+ Days";
      }

      return {
        ...inv,
        aging_bucket: bucket,
      };
    });

    res.status(200).json({
      success: true,
      aging: agingRows,
    });
  } catch (error) {
    console.error("Get Receivables Aging Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch receivables aging" });
  }
};

exports.getPendingInvoices = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { customer_id } = req.query;

    let sql = `
      SELECT
        inv.id,
        inv.invoice_no,
        inv.customer_id,
        c.name AS customer_name,
        inv.grand_total,
        inv.paid_amount,
        (inv.grand_total - inv.paid_amount) AS pending_amount,
        inv.payment_status,
        inv.created_at
      FROM invoices inv
      JOIN customers c ON inv.customer_id = c.id AND inv.company_id = c.company_id
      WHERE inv.company_id = ? AND (inv.payment_status != 'PAID' OR inv.paid_amount < inv.grand_total)
    `;
    const params = [companyId];

    if (customer_id) {
      sql += ` AND inv.customer_id = ?`;
      params.push(customer_id);
    }

    sql += ` ORDER BY inv.id ASC`;

    const [invoices] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      invoices,
    });
  } catch (error) {
    console.error("Get Pending Invoices Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch pending invoices" });
  }
};
