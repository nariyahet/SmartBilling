const db = require("../config/db");

// Default plant categories seed
const DEFAULT_CATEGORIES = [
  { name: "Electricity & Power", code: "POWER", description: "Factory electrical power, generator diesel & utility bills" },
  { name: "Machine Spares & Maintenance", code: "MAINT", description: "Plant machinery repairs, spare parts, servicing & lubricants" },
  { name: "Fuel & Factory Transport", code: "FUEL", description: "Internal plant vehicle fuel, forklift running & logistics" },
  { name: "Packing & Bagging Materials", code: "PACKING", description: "PP woven sacks, jumbo bags, strapping & packaging supplies" },
  { name: "Factory Rent & Lease", code: "RENT", description: "Premises rent, industrial shed lease & municipal property charges" },
  { name: "Water & Effluent Treatment", code: "WATER_ETP", description: "Industrial washing water, recycling filters & ETP maintenance" },
  { name: "Consumables & Hardware", code: "CONSUMABLES", description: "Safety PPE, blades, mesh filters, grease, tools & shop consumables" },
  { name: "Office & Administration", code: "ADMIN", description: "Stationery, internet, telecom, tea/pantry & office supplies" },
  { name: "Miscellaneous & Sundry", code: "MISC", description: "General unforeseen factory sundry expenses" },
];

const seedDefaultCategories = async (companyId) => {
  for (const cat of DEFAULT_CATEGORIES) {
    await db.promise().query(
      `INSERT IGNORE INTO plastic_expense_categories (company_id, name, code, description, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [companyId, cat.name, cat.code, cat.description]
    );
  }
};

exports.getCategories = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    let [rows] = await db.promise().query(
      "SELECT * FROM plastic_expense_categories WHERE company_id = ? ORDER BY name ASC",
      [companyId]
    );

    if (rows.length === 0) {
      await seedDefaultCategories(companyId);
      [rows] = await db.promise().query(
        "SELECT * FROM plastic_expense_categories WHERE company_id = ? ORDER BY name ASC",
        [companyId]
      );
    }

    res.status(200).json({ success: true, categories: rows });
  } catch (error) {
    console.error("Get Expense Categories Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch expense categories" });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: "Category name and code are required" });
    }

    const cleanCode = code.toUpperCase().replace(/\s+/g, "_").trim();

    const [existing] = await db.promise().query(
      "SELECT id FROM plastic_expense_categories WHERE company_id = ? AND code = ? LIMIT 1",
      [companyId, cleanCode]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Category code already exists" });
    }

    const [result] = await db.promise().query(
      `INSERT INTO plastic_expense_categories (company_id, name, code, description, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [companyId, name.trim(), cleanCode, description || null]
    );

    res.status(201).json({
      success: true,
      message: "Expense category created successfully",
      categoryId: result.insertId,
    });
  } catch (error) {
    console.error("Create Category Error:", error);
    res.status(500).json({ success: false, message: "Failed to create category" });
  }
};

exports.getNextExpenseNumber = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `EXP-${yearMonth}-`;

    const [rows] = await db.promise().query(
      `SELECT expense_no FROM plastic_expenses
       WHERE company_id = ? AND expense_no LIKE ?
       ORDER BY id DESC LIMIT 1`,
      [companyId, `${prefix}%`]
    );

    let nextNumber = "0001";
    if (rows.length > 0) {
      const lastNo = rows[0].expense_no;
      const parts = lastNo.split("-");
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) {
        nextNumber = String(lastSeq + 1).padStart(4, "0");
      }
    }

    res.status(200).json({ success: true, nextExpenseNumber: `${prefix}${nextNumber}` });
  } catch (error) {
    console.error("Get Next Expense Number Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate expense number" });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date, category_id, payment_status, approval_status, payment_mode, search } = req.query;

    let sql = `
      SELECT
        e.*,
        c.name AS category_name,
        c.code AS category_code,
        a.name AS created_by_name
      FROM plastic_expenses e
      JOIN plastic_expense_categories c ON e.category_id = c.id AND e.company_id = c.company_id
      LEFT JOIN admins a ON e.created_by = a.id
      WHERE e.company_id = ?
    `;
    const params = [companyId];

    if (from_date) {
      sql += " AND e.expense_date >= ?";
      params.push(from_date);
    }
    if (to_date) {
      sql += " AND e.expense_date <= ?";
      params.push(to_date);
    }
    if (category_id && category_id !== "ALL") {
      sql += " AND e.category_id = ?";
      params.push(category_id);
    }
    if (payment_status && payment_status !== "ALL") {
      sql += " AND e.payment_status = ?";
      params.push(payment_status);
    }
    if (approval_status && approval_status !== "ALL") {
      sql += " AND e.approval_status = ?";
      params.push(approval_status);
    }
    if (payment_mode && payment_mode !== "ALL") {
      sql += " AND e.payment_mode = ?";
      params.push(payment_mode);
    }
    if (search) {
      sql += " AND (e.expense_no LIKE ? OR e.title LIKE ? OR e.vendor_name LIKE ? OR e.reference_no LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += " ORDER BY e.expense_date DESC, e.id DESC";

    const [rows] = await db.promise().query(sql, params);

    // Summary calculations
    const totalAmount = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const paidAmount = rows.filter((r) => r.payment_status === "PAID").reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const pendingAmount = rows.filter((r) => r.payment_status === "PENDING").reduce((acc, r) => acc + Number(r.amount || 0), 0);

    res.status(200).json({
      success: true,
      summary: {
        totalAmount,
        paidAmount,
        pendingAmount,
        count: rows.length,
      },
      expenses: rows,
    });
  } catch (error) {
    console.error("Get Expenses Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch expenses" });
  }
};

exports.getExpenseById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [rows] = await db.promise().query(
      `SELECT
        e.*,
        c.name AS category_name,
        c.code AS category_code,
        a.name AS created_by_name
       FROM plastic_expenses e
       JOIN plastic_expense_categories c ON e.category_id = c.id AND e.company_id = c.company_id
       LEFT JOIN admins a ON e.created_by = a.id
       WHERE e.id = ? AND e.company_id = ? LIMIT 1`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    res.status(200).json({ success: true, expense: rows[0] });
  } catch (error) {
    console.error("Get Expense By Id Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch expense details" });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      expense_no,
      category_id,
      title,
      amount,
      expense_date,
      description,
      payment_mode,
      reference_no,
      vendor_name,
      approval_status,
      payment_status,
    } = req.body;

    if (!category_id || !title || !amount || !expense_date) {
      return res.status(400).json({
        success: false,
        message: "Category, title, amount, and expense date are required",
      });
    }

    // Verify category belongs to company
    const [cats] = await db.promise().query(
      "SELECT id FROM plastic_expense_categories WHERE id = ? AND company_id = ? LIMIT 1",
      [category_id, companyId]
    );
    if (cats.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid expense category" });
    }

    let finalExpenseNo = expense_no;
    if (!finalExpenseNo) {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const prefix = `EXP-${yearMonth}-`;

      const [rows] = await db.promise().query(
        `SELECT expense_no FROM plastic_expenses
         WHERE company_id = ? AND expense_no LIKE ?
         ORDER BY id DESC LIMIT 1`,
        [companyId, `${prefix}%`]
      );

      let nextSeq = 1;
      if (rows.length > 0) {
        const parts = rows[0].expense_no.split("-");
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) nextSeq = parsed + 1;
      }
      finalExpenseNo = `${prefix}${String(nextSeq).padStart(4, "0")}`;
    }

    const [result] = await db.promise().query(
      `INSERT INTO plastic_expenses
       (company_id, expense_no, category_id, title, amount, expense_date, description,
        payment_mode, reference_no, vendor_name, approval_status, payment_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        finalExpenseNo,
        category_id,
        title.trim(),
        Number(amount),
        expense_date,
        description || null,
        payment_mode || "CASH",
        reference_no || null,
        vendor_name || null,
        approval_status || "APPROVED",
        payment_status || "PAID",
        adminId,
      ]
    );

    const expenseId = result.insertId;

    // Phase 5: Auto-post accounting journal & bank/cash ledger transaction
    const { postExpenseAccounting } = require("../utils/accountingHelper");
    await postExpenseAccounting(db.promise(), {
      companyId,
      expense: {
        id: expenseId,
        expense_no: finalExpenseNo,
        category_id,
        title: title.trim(),
        amount: Number(amount),
        expense_date,
        payment_mode: payment_mode || "CASH",
      },
      createdBy: adminId,
    });

    res.status(201).json({
      success: true,
      message: "Expense recorded successfully",
      expenseId: expenseId,
      expense_no: finalExpenseNo,
    });
  } catch (error) {
    console.error("Create Expense Error:", error);
    res.status(500).json({ success: false, message: "Failed to record expense" });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const {
      category_id,
      title,
      amount,
      expense_date,
      description,
      payment_mode,
      reference_no,
      vendor_name,
      approval_status,
      payment_status,
    } = req.body;

    const [existing] = await db.promise().query(
      "SELECT id FROM plastic_expenses WHERE id = ? AND company_id = ? LIMIT 1",
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    await db.promise().query(
      `UPDATE plastic_expenses
       SET category_id = COALESCE(?, category_id),
           title = COALESCE(?, title),
           amount = COALESCE(?, amount),
           expense_date = COALESCE(?, expense_date),
           description = COALESCE(?, description),
           payment_mode = COALESCE(?, payment_mode),
           reference_no = COALESCE(?, reference_no),
           vendor_name = COALESCE(?, vendor_name),
           approval_status = COALESCE(?, approval_status),
           payment_status = COALESCE(?, payment_status)
       WHERE id = ? AND company_id = ?`,
      [
        category_id,
        title ? title.trim() : null,
        amount !== undefined ? Number(amount) : null,
        expense_date,
        description,
        payment_mode,
        reference_no,
        vendor_name,
        approval_status,
        payment_status,
        id,
        companyId,
      ]
    );

    res.status(200).json({ success: true, message: "Expense updated successfully" });
  } catch (error) {
    console.error("Update Expense Error:", error);
    res.status(500).json({ success: false, message: "Failed to update expense" });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [result] = await db.promise().query(
      "DELETE FROM plastic_expenses WHERE id = ? AND company_id = ?",
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    res.status(200).json({ success: true, message: "Expense deleted successfully" });
  } catch (error) {
    console.error("Delete Expense Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete expense" });
  }
};
