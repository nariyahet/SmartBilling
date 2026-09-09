const db = require("../config/db");

exports.getAccountGroups = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { type } = req.query;

    let sql = `
      SELECT g.*, p.name AS parent_name,
        (SELECT COUNT(a.id) FROM plastic_accounts a WHERE a.group_id = g.id AND a.company_id = g.company_id) AS account_count
      FROM plastic_account_groups g
      LEFT JOIN plastic_account_groups p ON g.parent_id = p.id AND g.company_id = p.company_id
      WHERE g.company_id = ?
    `;
    const params = [companyId];

    if (type && type !== "ALL") {
      sql += ` AND g.type = ?`;
      params.push(type.toUpperCase());
    }

    sql += ` ORDER BY g.type ASC, g.name ASC`;

    const [groups] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, groups });
  } catch (error) {
    console.error("Get Account Groups Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch account groups" });
  }
};

exports.createAccountGroup = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { name, code, type, parent_id, description } = req.body;

    if (!name || !code || !type) {
      return res.status(400).json({ success: false, message: "Group name, code, and type are required" });
    }

    const validTypes = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];
    if (!validTypes.includes(type.toUpperCase())) {
      return res.status(400).json({ success: false, message: "Invalid account type" });
    }

    const cleanCode = code.toUpperCase().replace(/\s+/g, "_").trim();

    const [existing] = await db.promise().query(
      `SELECT id FROM plastic_account_groups WHERE company_id = ? AND code = ? LIMIT 1`,
      [companyId, cleanCode]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Group code already exists" });
    }

    const [result] = await db.promise().query(
      `INSERT INTO plastic_account_groups (company_id, name, code, type, parent_id, description, is_system)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [companyId, name.trim(), cleanCode, type.toUpperCase(), parent_id || null, description || null]
    );

    res.status(201).json({
      success: true,
      message: "Account group created successfully",
      groupId: result.insertId,
    });
  } catch (error) {
    console.error("Create Account Group Error:", error);
    res.status(500).json({ success: false, message: "Failed to create account group" });
  }
};

exports.getAccounts = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { type, group_id, status, search } = req.query;

    let sql = `
      SELECT
        a.*,
        g.name AS group_name,
        g.code AS group_code
      FROM plastic_accounts a
      JOIN plastic_account_groups g ON a.group_id = g.id AND a.company_id = g.company_id
      WHERE a.company_id = ?
    `;
    const params = [companyId];

    if (type && type !== "ALL") {
      sql += ` AND a.account_type = ?`;
      params.push(type.toUpperCase());
    }

    if (group_id && group_id !== "ALL") {
      sql += ` AND a.group_id = ?`;
      params.push(group_id);
    }

    if (status && status !== "ALL") {
      sql += ` AND a.status = ?`;
      params.push(status.toUpperCase());
    }

    if (search && search.trim()) {
      sql += ` AND (a.account_name LIKE ? OR a.account_code LIKE ? OR g.name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY a.account_code ASC, a.account_name ASC`;

    const [accounts] = await db.promise().query(sql, params);

    // Summary calculation
    const summary = {
      totalAccounts: accounts.length,
      assetCount: accounts.filter((a) => a.account_type === "ASSET").length,
      liabilityCount: accounts.filter((a) => a.account_type === "LIABILITY").length,
      equityCount: accounts.filter((a) => a.account_type === "EQUITY").length,
      incomeCount: accounts.filter((a) => a.account_type === "INCOME").length,
      expenseCount: accounts.filter((a) => a.account_type === "EXPENSE").length,
    };

    res.status(200).json({ success: true, summary, accounts });
  } catch (error) {
    console.error("Get Accounts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch accounts" });
  }
};

exports.getAccountById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [accounts] = await db.promise().query(
      `SELECT a.*, g.name AS group_name, g.code AS group_code
       FROM plastic_accounts a
       JOIN plastic_account_groups g ON a.group_id = g.id AND a.company_id = g.company_id
       WHERE a.id = ? AND a.company_id = ? LIMIT 1`,
      [id, companyId]
    );

    if (accounts.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    // Fetch recent journal items for this account
    const [recentEntries] = await db.promise().query(
      `SELECT
        ji.id, ji.entry_type, ji.amount, ji.narration, ji.created_at,
        je.journal_no, je.entry_date, je.reference_type, je.reference_no
       FROM plastic_journal_items ji
       JOIN plastic_journal_entries je ON ji.journal_entry_id = je.id AND ji.company_id = je.company_id
       WHERE ji.account_id = ? AND ji.company_id = ?
       ORDER BY je.entry_date DESC, je.id DESC LIMIT 50`,
      [id, companyId]
    );

    res.status(200).json({ success: true, account: accounts[0], recentEntries });
  } catch (error) {
    console.error("Get Account By ID Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch account details" });
  }
};

exports.createAccount = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const {
      group_id,
      account_code,
      account_name,
      account_type,
      debit_credit_nature = "DEBIT",
      opening_balance = 0.00,
      description,
    } = req.body;

    if (!group_id || !account_name) {
      return res.status(400).json({ success: false, message: "Group and account name are required" });
    }

    // Verify group belongs to company
    const [groupRows] = await db.promise().query(
      `SELECT id, type FROM plastic_account_groups WHERE id = ? AND company_id = ? LIMIT 1`,
      [group_id, companyId]
    );

    if (groupRows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid account group" });
    }

    const finalType = account_type || groupRows[0].type;
    const finalNature = debit_credit_nature || (["ASSET", "EXPENSE"].includes(finalType) ? "DEBIT" : "CREDIT");

    let finalCode = account_code ? String(account_code).trim() : "";
    if (!finalCode) {
      // Auto generate code based on group or sequential
      const [lastAcc] = await db.promise().query(
        `SELECT account_code FROM plastic_accounts WHERE company_id = ? ORDER BY id DESC LIMIT 1`,
        [companyId]
      );
      let nextNum = 7000;
      if (lastAcc.length > 0 && /^\d+$/.test(lastAcc[0].account_code)) {
        nextNum = Number(lastAcc[0].account_code) + 10;
      }
      finalCode = String(nextNum);
    }

    const [existing] = await db.promise().query(
      `SELECT id FROM plastic_accounts WHERE company_id = ? AND account_code = ? LIMIT 1`,
      [companyId, finalCode]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Account code already exists in this company" });
    }

    const openBal = Number(opening_balance) || 0.00;

    const [result] = await db.promise().query(
      `INSERT INTO plastic_accounts
        (company_id, group_id, account_code, account_name, account_type, debit_credit_nature, opening_balance, current_balance, status, description, is_system)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, 0)`,
      [
        companyId,
        group_id,
        finalCode,
        account_name.trim(),
        finalType,
        finalNature,
        openBal,
        openBal, // Initial current balance = opening balance
        description || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      accountId: result.insertId,
      accountCode: finalCode,
    });
  } catch (error) {
    console.error("Create Account Error:", error);
    res.status(500).json({ success: false, message: "Failed to create account" });
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { account_name, status, description, opening_balance } = req.body;

    const [existing] = await db.promise().query(
      `SELECT * FROM plastic_accounts WHERE id = ? AND company_id = ? LIMIT 1`,
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    const updates = [];
    const params = [];

    if (account_name) {
      updates.push("account_name = ?");
      params.push(account_name.trim());
    }
    if (status && ["ACTIVE", "INACTIVE"].includes(status.toUpperCase())) {
      updates.push("status = ?");
      params.push(status.toUpperCase());
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(description || null);
    }
    if (opening_balance !== undefined && !isNaN(Number(opening_balance))) {
      const openBal = Number(opening_balance);
      const delta = openBal - Number(existing[0].opening_balance || 0);
      updates.push("opening_balance = ?");
      params.push(openBal);
      updates.push("current_balance = current_balance + ?");
      params.push(delta);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    params.push(id, companyId);
    await db.promise().query(
      `UPDATE plastic_accounts SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
      params
    );

    res.status(200).json({ success: true, message: "Account updated successfully" });
  } catch (error) {
    console.error("Update Account Error:", error);
    res.status(500).json({ success: false, message: "Failed to update account" });
  }
};

exports.getIntegratedMasters = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Fetch customers with outstanding receivables from invoices and payments
    const [customers] = await db.promise().query(
      `SELECT c.id, c.name, c.mobile, c.email,
        COALESCE((SELECT SUM(grand_total - paid_amount) FROM invoices WHERE customer_id = c.id AND company_id = c.company_id), 0) AS outstanding_balance
       FROM customers c
       WHERE c.company_id = ?
       ORDER BY c.name ASC`,
      [companyId]
    );

    // Fetch suppliers with outstanding payables from purchase_bills and payments
    const [suppliers] = await db.promise().query(
      `SELECT s.id, s.supplier_code, s.supplier_name, s.mobile, s.gst_number, s.state,
        COALESCE((SELECT balance FROM plastic_supplier_ledger WHERE supplier_id = s.id AND company_id = s.company_id ORDER BY id DESC LIMIT 1), s.opening_balance) AS current_payable
       FROM suppliers s
       WHERE s.company_id = ?
       ORDER BY s.supplier_name ASC`,
      [companyId]
    );

    res.status(200).json({
      success: true,
      customers,
      suppliers,
    });
  } catch (error) {
    console.error("Get Integrated Masters Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch integrated masters" });
  }
};
