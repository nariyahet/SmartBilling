const db = require("../config/db");

exports.getCustomerLedger = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { customerId } = req.params;
    const { from_date, to_date } = req.query;

    // Verify customer ownership
    const [customers] = await db.promise().query(
      `SELECT id, name, mobile, email, address FROM customers WHERE id = ? AND company_id = ?`,
      [customerId, companyId]
    );

    if (customers.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    let sql = `
      SELECT *
      FROM plastic_customer_ledger
      WHERE company_id = ? AND customer_id = ?
    `;
    const params = [companyId, customerId];

    if (from_date && to_date) {
      sql += ` AND transaction_date >= ? AND transaction_date <= ?`;
      params.push(from_date, to_date);
    }

    sql += ` ORDER BY transaction_date ASC, id ASC`;

    const [entries] = await db.promise().query(sql, params);

    let totalDebit = 0;
    let totalCredit = 0;

    for (const row of entries) {
      totalDebit += Number(row.debit) || 0;
      totalCredit += Number(row.credit) || 0;
    }

    const closingBalance = entries.length > 0
      ? Number(entries[entries.length - 1].balance) || 0
      : 0;

    res.status(200).json({
      success: true,
      customer: customers[0],
      entries,
      summary: {
        totalDebit,
        totalCredit,
        closingBalance,
        totalTransactions: entries.length,
      },
    });
  } catch (error) {
    console.error("Get Customer Ledger Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch customer ledger" });
  }
};

exports.getLedgerOverview = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [overviewRows] = await db.promise().query(
      `SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        c.email AS customer_email,
        COALESCE(SUM(l.debit), 0) AS total_debit,
        COALESCE(SUM(l.credit), 0) AS total_credit,
        (
          SELECT l2.balance
          FROM plastic_customer_ledger l2
          WHERE l2.company_id = c.company_id AND l2.customer_id = c.id
          ORDER BY l2.id DESC
          LIMIT 1
        ) AS current_balance,
        MAX(l.transaction_date) AS last_transaction_date,
        COUNT(l.id) AS total_entries
       FROM customers c
       LEFT JOIN plastic_customer_ledger l ON c.id = l.customer_id AND c.company_id = l.company_id
       WHERE c.company_id = ?
       GROUP BY c.id
       ORDER BY c.name ASC`,
      [companyId]
    );

    res.status(200).json({
      success: true,
      overview: overviewRows.map((r) => ({
        ...r,
        current_balance: Number(r.current_balance || 0),
        total_debit: Number(r.total_debit || 0),
        total_credit: Number(r.total_credit || 0),
      })),
    });
  } catch (error) {
    console.error("Get Ledger Overview Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch customer ledger overview" });
  }
};
