const db = require("../config/db");

exports.getReconciliations = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { bank_account_id, status, from_date, to_date } = req.query;

    let sql = `
      SELECT
        br.*,
        ba.bank_name,
        ba.account_name,
        ba.account_number,
        bt.transaction_date AS matched_date,
        bt.amount AS matched_amount,
        bt.transaction_type AS matched_type,
        bt.reference_no AS matched_ref
      FROM plastic_bank_reconciliations br
      JOIN plastic_bank_accounts ba ON br.bank_account_id = ba.id AND br.company_id = ba.company_id
      LEFT JOIN plastic_bank_transactions bt ON br.matched_transaction_id = bt.id AND br.company_id = bt.company_id
      WHERE br.company_id = ?
    `;
    const params = [companyId];

    if (bank_account_id && bank_account_id !== "ALL") {
      sql += ` AND br.bank_account_id = ?`;
      params.push(bank_account_id);
    }
    if (status && status !== "ALL") {
      sql += ` AND br.status = ?`;
      params.push(status.toUpperCase());
    }
    if (from_date && to_date) {
      sql += ` AND br.statement_date >= ? AND br.statement_date <= ?`;
      params.push(from_date, to_date);
    }

    sql += ` ORDER BY br.statement_date DESC, br.id DESC`;

    const [rows] = await db.promise().query(sql, params);

    res.status(200).json({ success: true, count: rows.length, reconciliations: rows });
  } catch (error) {
    console.error("Get Reconciliations Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reconciliations" });
  }
};

exports.createStatementLine = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      bank_account_id,
      statement_date = new Date().toISOString().split("T")[0],
      reference_no,
      description,
      withdrawal_amount = 0.00,
      deposit_amount = 0.00,
      bank_balance = 0.00,
    } = req.body;

    if (!bank_account_id) {
      return res.status(400).json({ success: false, message: "Bank account is required" });
    }

    const [result] = await db.promise().query(
      `INSERT INTO plastic_bank_reconciliations
        (company_id, bank_account_id, statement_date, reference_no, description, withdrawal_amount, deposit_amount, bank_balance, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UNRECONCILED', ?)`,
      [
        companyId,
        bank_account_id,
        statement_date,
        reference_no || null,
        description || "Bank Statement Entry",
        Number(withdrawal_amount) || 0,
        Number(deposit_amount) || 0,
        Number(bank_balance) || 0,
        adminId,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Statement entry recorded successfully",
      statementId: result.insertId,
    });
  } catch (error) {
    console.error("Create Statement Line Error:", error);
    res.status(500).json({ success: false, message: "Failed to create statement line" });
  }
};

exports.matchTransaction = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { transaction_id } = req.body;

    if (!transaction_id) {
      return res.status(400).json({ success: false, message: "Transaction ID is required to match" });
    }

    await conn.beginTransaction();

    try {
      const [reconRows] = await conn.query(
        `SELECT * FROM plastic_bank_reconciliations WHERE id = ? AND company_id = ? LIMIT 1`,
        [id, companyId]
      );
      if (reconRows.length === 0) {
        return res.status(404).json({ success: false, message: "Reconciliation statement entry not found" });
      }
      const recon = reconRows[0];

      const [txRows] = await conn.query(
        `SELECT * FROM plastic_bank_transactions WHERE id = ? AND company_id = ? LIMIT 1`,
        [transaction_id, companyId]
      );
      if (txRows.length === 0) {
        return res.status(404).json({ success: false, message: "Bank transaction not found" });
      }
      const tx = txRows[0];

      const stmtAmount = Number(recon.deposit_amount) > 0 ? Number(recon.deposit_amount) : Number(recon.withdrawal_amount);
      const txAmount = Number(tx.amount);
      const diff = Math.abs(stmtAmount - txAmount);

      await conn.query(
        `UPDATE plastic_bank_reconciliations
         SET matched_transaction_id = ?, status = 'RECONCILED', difference_amount = ?, reconciled_at = NOW()
         WHERE id = ? AND company_id = ?`,
        [tx.id, diff, id, companyId]
      );

      await conn.query(
        `UPDATE plastic_bank_transactions
         SET is_reconciled = 1, reconciled_at = NOW()
         WHERE id = ? AND company_id = ?`,
        [tx.id, companyId]
      );

      await conn.commit();

      res.status(200).json({
        success: true,
        message: "Transaction reconciled successfully",
        differenceAmount: diff,
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Match Transaction Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to match transaction" });
  }
};

exports.unmatchTransaction = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    await conn.beginTransaction();

    try {
      const [reconRows] = await conn.query(
        `SELECT * FROM plastic_bank_reconciliations WHERE id = ? AND company_id = ? LIMIT 1`,
        [id, companyId]
      );
      if (reconRows.length === 0) {
        return res.status(404).json({ success: false, message: "Entry not found" });
      }
      const recon = reconRows[0];

      if (recon.matched_transaction_id) {
        await conn.query(
          `UPDATE plastic_bank_transactions SET is_reconciled = 0, reconciled_at = NULL WHERE id = ? AND company_id = ?`,
          [recon.matched_transaction_id, companyId]
        );
      }

      await conn.query(
        `UPDATE plastic_bank_reconciliations
         SET matched_transaction_id = NULL, status = 'UNRECONCILED', difference_amount = 0.00, reconciled_at = NULL
         WHERE id = ? AND company_id = ?`,
        [id, companyId]
      );

      await conn.commit();

      res.status(200).json({ success: true, message: "Entry marked unreconciled" });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Unmatch Transaction Error:", error);
    res.status(500).json({ success: false, message: "Failed to unmatch transaction" });
  }
};

exports.getReconSummary = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { bank_account_id } = req.query;

    if (!bank_account_id) {
      return res.status(400).json({ success: false, message: "Bank account is required" });
    }

    const [accRows] = await db.promise().query(
      `SELECT * FROM plastic_bank_accounts WHERE id = ? AND company_id = ? LIMIT 1`,
      [bank_account_id, companyId]
    );
    if (accRows.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }
    const account = accRows[0];

    // Unreconciled in bank statement
    const [unreconStmt] = await db.promise().query(
      `SELECT
        COUNT(id) AS count,
        COALESCE(SUM(deposit_amount), 0) AS total_deposits,
        COALESCE(SUM(withdrawal_amount), 0) AS total_withdrawals
       FROM plastic_bank_reconciliations
       WHERE bank_account_id = ? AND company_id = ? AND status = 'UNRECONCILED'`,
      [bank_account_id, companyId]
    );

    // Unreconciled in ledger transactions
    const [unreconTx] = await db.promise().query(
      `SELECT
        COUNT(id) AS count,
        COALESCE(SUM(CASE WHEN transaction_type IN ('DEPOSIT', 'RECEIPT') THEN amount ELSE 0 END), 0) AS book_deposits,
        COALESCE(SUM(CASE WHEN transaction_type IN ('WITHDRAWAL', 'PAYMENT') THEN amount ELSE 0 END), 0) AS book_withdrawals
       FROM plastic_bank_transactions
       WHERE bank_account_id = ? AND company_id = ? AND is_reconciled = 0`,
      [bank_account_id, companyId]
    );

    const booksBalance = Number(account.current_balance || 0);
    const unrecBookDeposits = Number(unreconTx[0]?.book_deposits || 0);
    const unrecBookWithdrawals = Number(unreconTx[0]?.book_withdrawals || 0);
    const adjustedBankBalance = booksBalance + unrecBookWithdrawals - unrecBookDeposits;

    res.status(200).json({
      success: true,
      summary: {
        accountName: account.account_name,
        accountNumber: account.account_number,
        booksBalance,
        unreconciledBookDeposits: unrecBookDeposits,
        unreconciledBookWithdrawals: unrecBookWithdrawals,
        adjustedBankBalance,
        statementUnreconciledDeposits: Number(unreconStmt[0]?.total_deposits || 0),
        statementUnreconciledWithdrawals: Number(unreconStmt[0]?.total_withdrawals || 0),
      },
    });
  } catch (error) {
    console.error("Get Recon Summary Error:", error);
    res.status(500).json({ success: false, message: "Failed to calculate reconciliation summary" });
  }
};
