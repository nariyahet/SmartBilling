const db = require("../config/db");
const { postJournalEntry, getAccount } = require("../utils/accountingHelper");

exports.getAccounts = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [accounts] = await db.promise().query(
      `SELECT ba.*, a.account_name AS ledger_account_name, a.account_code AS ledger_account_code
       FROM plastic_bank_accounts ba
       LEFT JOIN plastic_accounts a ON ba.account_id = a.id AND ba.company_id = a.company_id
       WHERE ba.company_id = ?
       ORDER BY ba.account_type DESC, ba.account_name ASC`,
      [companyId]
    );

    const totalCash = accounts
      .filter((a) => a.account_type === "CASH")
      .reduce((acc, a) => acc + Number(a.current_balance || 0), 0);

    const totalBank = accounts
      .filter((a) => a.account_type === "BANK")
      .reduce((acc, a) => acc + Number(a.current_balance || 0), 0);

    res.status(200).json({
      success: true,
      summary: {
        totalCash,
        totalBank,
        totalLiquidFunds: totalCash + totalBank,
        count: accounts.length,
      },
      accounts,
    });
  } catch (error) {
    console.error("Get Cash & Bank Accounts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch cash & bank accounts" });
  }
};

exports.createAccount = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const {
      account_type = "BANK",
      bank_name,
      account_name,
      account_number,
      ifsc_code,
      branch,
      opening_balance = 0.00,
    } = req.body;

    if (!bank_name || !account_name || !account_number) {
      return res.status(400).json({
        success: false,
        message: "Bank name, account name, and account number are required",
      });
    }

    const type = String(account_type).toUpperCase() === "CASH" ? "CASH" : "BANK";
    const openBal = Number(opening_balance) || 0.00;

    await conn.beginTransaction();

    try {
      // 1. Create matching Ledger Account in Chart of Accounts
      const groupCode = "ASSET_CA";
      const [groupRows] = await conn.query(
        `SELECT id FROM plastic_account_groups WHERE company_id = ? AND code = ? LIMIT 1`,
        [companyId, groupCode]
      );
      const groupId = groupRows[0]?.id;

      let ledgerAccId = null;
      if (groupId) {
        const [lastAcc] = await conn.query(
          `SELECT account_code FROM plastic_accounts WHERE company_id = ? AND account_code LIKE '10%' ORDER BY id DESC LIMIT 1`,
          [companyId]
        );
        let nextCode = "1020";
        if (lastAcc.length > 0 && !isNaN(Number(lastAcc[0].account_code))) {
          nextCode = String(Number(lastAcc[0].account_code) + 1);
        }

        const [accRes] = await conn.query(
          `INSERT INTO plastic_accounts
            (company_id, group_id, account_code, account_name, account_type, debit_credit_nature, opening_balance, current_balance, status, reference_type, is_system)
           VALUES (?, ?, ?, ?, 'ASSET', 'DEBIT', ?, ?, 'ACTIVE', ?, 0)`,
          [companyId, groupId, nextCode, account_name.trim(), openBal, openBal, type]
        );
        ledgerAccId = accRes.insertId;
      }

      // 2. Create Bank Account Master
      const [bankRes] = await conn.query(
        `INSERT INTO plastic_bank_accounts
          (company_id, account_id, account_type, bank_name, account_name, account_number, ifsc_code, branch, opening_balance, current_balance, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [
          companyId,
          ledgerAccId,
          type,
          bank_name.trim(),
          account_name.trim(),
          account_number.trim(),
          ifsc_code ? ifsc_code.trim().toUpperCase() : null,
          branch ? branch.trim() : null,
          openBal,
          openBal,
        ]
      );

      await conn.commit();

      res.status(201).json({
        success: true,
        message: `${type === "CASH" ? "Cash" : "Bank"} account created successfully`,
        bankAccountId: bankRes.insertId,
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Create Bank Account Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create account" });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { bank_account_id, from_date, to_date, transaction_type, search } = req.query;

    let sql = `
      SELECT
        bt.*,
        ba.account_name,
        ba.account_type,
        ba.bank_name,
        ba.account_number,
        adm.name AS created_by_name
      FROM plastic_bank_transactions bt
      JOIN plastic_bank_accounts ba ON bt.bank_account_id = ba.id AND bt.company_id = ba.company_id
      LEFT JOIN admins adm ON bt.created_by = adm.id
      WHERE bt.company_id = ?
    `;
    const params = [companyId];

    if (bank_account_id && bank_account_id !== "ALL") {
      sql += ` AND bt.bank_account_id = ?`;
      params.push(bank_account_id);
    }

    if (transaction_type && transaction_type !== "ALL") {
      sql += ` AND bt.transaction_type = ?`;
      params.push(transaction_type.toUpperCase());
    }

    if (from_date && to_date) {
      sql += ` AND bt.transaction_date >= ? AND bt.transaction_date <= ?`;
      params.push(from_date, to_date);
    }

    if (search && search.trim()) {
      sql += ` AND (bt.description LIKE ? OR bt.reference_no LIKE ? OR ba.account_name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY bt.transaction_date DESC, bt.id DESC`;

    const [transactions] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, count: transactions.length, transactions });
  } catch (error) {
    console.error("Get Bank Transactions Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch bank transactions" });
  }
};

exports.recordTransaction = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      bank_account_id,
      to_bank_account_id, // For transfers
      transaction_date = new Date().toISOString().split("T")[0],
      transaction_type = "DEPOSIT", // DEPOSIT, WITHDRAWAL, TRANSFER
      amount,
      payment_mode = "BANK",
      reference_no,
      description,
    } = req.body;

    const txAmount = Number(amount);
    if (!bank_account_id || isNaN(txAmount) || txAmount <= 0) {
      return res.status(400).json({ success: false, message: "Account and positive amount are required" });
    }

    const type = String(transaction_type).toUpperCase();
    if (!["DEPOSIT", "WITHDRAWAL", "TRANSFER"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid transaction type" });
    }

    await conn.beginTransaction();

    try {
      const [accRows] = await conn.query(
        `SELECT * FROM plastic_bank_accounts WHERE id = ? AND company_id = ? FOR UPDATE`,
        [bank_account_id, companyId]
      );
      if (accRows.length === 0) {
        return res.status(404).json({ success: false, message: "Account not found" });
      }

      const sourceAcc = accRows[0];

      if (type === "TRANSFER") {
        if (!to_bank_account_id || to_bank_account_id === bank_account_id) {
          return res.status(400).json({ success: false, message: "Destination account must be different from source account" });
        }

        const [destRows] = await conn.query(
          `SELECT * FROM plastic_bank_accounts WHERE id = ? AND company_id = ? FOR UPDATE`,
          [to_bank_account_id, companyId]
        );
        if (destRows.length === 0) {
          return res.status(404).json({ success: false, message: "Destination account not found" });
        }
        const destAcc = destRows[0];

        const srcNewBal = Number(sourceAcc.current_balance) - txAmount;
        const destNewBal = Number(destAcc.current_balance) + txAmount;

        // Outward tx on source
        await conn.query(
          `INSERT INTO plastic_bank_transactions
            (company_id, bank_account_id, transaction_date, transaction_type, reference_type, reference_no, amount, balance_after, payment_mode, description, created_by)
           VALUES (?, ?, ?, 'TRANSFER', 'BANK_TRANSFER', ?, ?, ?, ?, ?, ?)`,
          [companyId, sourceAcc.id, transaction_date, reference_no || null, txAmount, srcNewBal, payment_mode, `Transfer to ${destAcc.account_name} - ${description || ""}`, adminId]
        );

        // Inward tx on destination
        await conn.query(
          `INSERT INTO plastic_bank_transactions
            (company_id, bank_account_id, transaction_date, transaction_type, reference_type, reference_no, amount, balance_after, payment_mode, description, created_by)
           VALUES (?, ?, ?, 'TRANSFER', 'BANK_TRANSFER', ?, ?, ?, ?, ?, ?)`,
          [companyId, destAcc.id, transaction_date, reference_no || null, txAmount, destNewBal, payment_mode, `Transfer from ${sourceAcc.account_name} - ${description || ""}`, adminId]
        );

        await conn.query(`UPDATE plastic_bank_accounts SET current_balance = ? WHERE id = ?`, [srcNewBal, sourceAcc.id]);
        await conn.query(`UPDATE plastic_bank_accounts SET current_balance = ? WHERE id = ?`, [destNewBal, destAcc.id]);

        // Auto double-entry journal if linked to ledger accounts
        if (sourceAcc.account_id && destAcc.account_id) {
          await postJournalEntry(conn, {
            companyId,
            entryDate: transaction_date,
            referenceType: "BANK_TRANSFER",
            referenceNo,
            narration: `Funds Transfer from ${sourceAcc.account_name} to ${destAcc.account_name}`,
            items: [
              { accountId: destAcc.account_id, entryType: "DEBIT", amount: txAmount, narration: `Transfer from ${sourceAcc.account_name}` },
              { accountId: sourceAcc.account_id, entryType: "CREDIT", amount: txAmount, narration: `Transfer to ${destAcc.account_name}` },
            ],
            createdBy: adminId,
          });
        }
      } else {
        // Direct Deposit or Withdrawal
        const isDeposit = type === "DEPOSIT";
        const newBal = isDeposit
          ? Number(sourceAcc.current_balance) + txAmount
          : Number(sourceAcc.current_balance) - txAmount;

        await conn.query(
          `INSERT INTO plastic_bank_transactions
            (company_id, bank_account_id, transaction_date, transaction_type, reference_type, reference_no, amount, balance_after, payment_mode, description, created_by)
           VALUES (?, ?, ?, ?, 'MANUAL', ?, ?, ?, ?, ?, ?)`,
          [companyId, sourceAcc.id, transaction_date, type, reference_no || null, txAmount, newBal, payment_mode, description || `${type} recorded`, adminId]
        );

        await conn.query(`UPDATE plastic_bank_accounts SET current_balance = ? WHERE id = ?`, [newBal, sourceAcc.id]);
      }

      await conn.commit();

      res.status(201).json({
        success: true,
        message: `${type} transaction recorded successfully`,
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Record Bank Transaction Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to record transaction" });
  }
};

exports.getStatement = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { from_date, to_date } = req.query;

    const [accounts] = await db.promise().query(
      `SELECT * FROM plastic_bank_accounts WHERE id = ? AND company_id = ? LIMIT 1`,
      [id, companyId]
    );

    if (accounts.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    const account = accounts[0];

    let sql = `
      SELECT * FROM plastic_bank_transactions
      WHERE bank_account_id = ? AND company_id = ?
    `;
    const params = [id, companyId];

    if (from_date) {
      sql += ` AND transaction_date >= ?`;
      params.push(from_date);
    }
    if (to_date) {
      sql += ` AND transaction_date <= ?`;
      params.push(to_date);
    }

    sql += ` ORDER BY transaction_date ASC, id ASC`;

    const [transactions] = await db.promise().query(sql, params);

    const totalDeposits = transactions
      .filter((t) => ["DEPOSIT", "RECEIPT"].includes(t.transaction_type) || (t.transaction_type === "TRANSFER" && t.description?.includes("Transfer from")))
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    const totalWithdrawals = transactions
      .filter((t) => ["WITHDRAWAL", "PAYMENT"].includes(t.transaction_type) || (t.transaction_type === "TRANSFER" && t.description?.includes("Transfer to")))
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);

    res.status(200).json({
      success: true,
      account,
      summary: {
        openingBalance: Number(account.opening_balance || 0),
        totalDeposits,
        totalWithdrawals,
        closingBalance: Number(account.current_balance || 0),
        count: transactions.length,
      },
      transactions,
    });
  } catch (error) {
    console.error("Get Bank Statement Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate statement" });
  }
};
