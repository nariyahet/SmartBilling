const db = require("../config/db");

const generateNextAdvanceNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT advance_no
     FROM plastic_employee_advances
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    if (row.advance_no) {
      const match = String(row.advance_no).match(/^ADV-(\d+)$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return `ADV-${maxNum + 1}`;
};

exports.getNextAdvanceNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextAdvanceNo(companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next Advance No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate advance number" });
  }
};

exports.getAdvances = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, employee_id } = req.query;

    let sql = `
      SELECT
        adv.*,
        e.employee_code,
        e.full_name AS employee_name,
        e.department,
        e.designation,
        adm.name AS created_by_name
      FROM plastic_employee_advances adv
      JOIN plastic_employees e ON adv.employee_id = e.id AND adv.company_id = e.company_id
      LEFT JOIN admins adm ON adv.created_by = adm.id
      WHERE adv.company_id = ?
    `;
    const params = [companyId];

    if (status && status !== "ALL") {
      sql += " AND adv.status = ?";
      params.push(status);
    }
    if (employee_id) {
      sql += " AND adv.employee_id = ?";
      params.push(employee_id);
    }

    sql += " ORDER BY adv.id DESC";

    const [advances] = await db.promise().query(sql, params);

    // Summary calculation
    const totalAdvances = advances.reduce((sum, a) => sum + Number(a.advance_amount || 0), 0);
    const totalRecovered = advances.reduce((sum, a) => sum + Number(a.recovery_amount || 0), 0);
    const totalOutstanding = advances.reduce((sum, a) => sum + Number(a.outstanding_amount || 0), 0);

    res.status(200).json({
      success: true,
      summary: {
        totalAdvances,
        totalRecovered,
        totalOutstanding,
        activeCount: advances.filter((a) => a.status === "ACTIVE").length,
      },
      count: advances.length,
      advances,
    });
  } catch (error) {
    console.error("Get Advances Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve employee advances" });
  }
};

exports.createAdvance = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      employee_id,
      advance_amount = req.body.amount,
      advance_date = req.body.disbursement_date || new Date().toISOString().slice(0, 10),
      reason,
      monthly_installment = 0,
      notes,
    } = req.body;

    if (!employee_id || !advance_amount || Number(advance_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid employee and advance amount (> 0) are required",
      });
    }

    const advanceNo = req.body.advance_no || (await generateNextAdvanceNo(companyId));
    const amount = Number(advance_amount);

    const [resInsert] = await db.promise().query(
      `INSERT INTO plastic_employee_advances (
        company_id, advance_no, employee_id, advance_amount, advance_date,
        reason, recovery_amount, outstanding_amount, monthly_installment,
        status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, ?, 'ACTIVE', ?, ?)`,
      [
        companyId,
        advanceNo,
        employee_id,
        amount,
        advance_date,
        reason || "Salary Advance",
        amount,
        Number(monthly_installment || 0),
        notes || null,
        adminId,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Employee advance recorded successfully",
      advanceId: resInsert.insertId,
      advance: {
        id: resInsert.insertId,
        advance_no: advanceNo,
        advance_amount: amount,
        outstanding_amount: amount,
      },
    });
  } catch (error) {
    console.error("Create Advance Error:", error);
    res.status(500).json({ success: false, message: "Failed to record employee advance" });
  }
};

exports.recordAdvanceRecovery = async (req, res) => {
  const pdb = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { recovery_amount = req.body.amount, notes } = req.body;

    const amount = Number(recovery_amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid recovery amount (> 0) is required" });
    }

    const [advances] = await pdb.query(
      "SELECT * FROM plastic_employee_advances WHERE id = ? AND company_id = ? LIMIT 1",
      [id, companyId]
    );

    if (advances.length === 0) {
      return res.status(404).json({ success: false, message: "Advance record not found" });
    }

    const adv = advances[0];
    if (adv.status !== "ACTIVE" || adv.outstanding_amount <= 0) {
      return res.status(400).json({ success: false, message: "Advance is already fully recovered" });
    }

    const newRecovered = Number(adv.recovery_amount) + amount;
    const newOutstanding = Math.max(0, Number(adv.outstanding_amount) - amount);
    const newStatus = newOutstanding === 0 ? "RECOVERED" : "ACTIVE";

    await pdb.query(
      `UPDATE plastic_employee_advances
       SET recovery_amount = ?, outstanding_amount = ?, status = ?,
           notes = CONCAT(COALESCE(notes, ''), '\n[Recovery: ₹', ?, ' on ', NOW(), ' - ', ?, ']')
       WHERE id = ? AND company_id = ?`,
      [newRecovered, newOutstanding, newStatus, amount, notes || "Manual recovery", id, companyId]
    );

    res.status(200).json({
      success: true,
      message: `Recovery of ₹${amount.toLocaleString("en-IN")} recorded`,
      outstanding_amount: newOutstanding,
      status: newStatus,
    });
  } catch (error) {
    console.error("Record Advance Recovery Error:", error);
    res.status(500).json({ success: false, message: "Failed to record advance recovery" });
  }
};
