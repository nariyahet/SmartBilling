const db = require("../config/db");

exports.getSalaryRegister = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { month, year, department } = req.query;

    if (!month || !year) {
      return res.status(400).json({ success: false, message: "Month and year are required" });
    }

    let sql = `
      SELECT
        p.id AS payroll_id,
        p.payroll_batch_no,
        p.month,
        p.year,
        p.status AS batch_status,
        pi.id AS item_id,
        pi.payslip_no,
        pi.present_days,
        pi.absent_days,
        pi.half_days,
        pi.paid_leaves,
        pi.overtime_hours,
        pi.earned_basic,
        pi.allowances,
        pi.overtime_amount,
        pi.bonus_incentive,
        pi.gross_salary,
        pi.pf_deduction,
        pi.esic_deduction,
        pi.pt_deduction,
        pi.advance_recovery,
        pi.other_deductions,
        pi.total_deductions,
        pi.net_salary,
        pi.payment_status,
        pi.payment_mode,
        e.id AS employee_id,
        e.employee_code,
        e.full_name,
        e.department,
        e.designation,
        e.bank_name,
        e.bank_account_no AS account_number,
        e.bank_account_no,
        e.bank_ifsc AS ifsc_code,
        e.bank_ifsc,
        e.pan_number
      FROM plastic_payroll_items pi
      JOIN plastic_payrolls p ON pi.payroll_id = p.id AND pi.company_id = p.company_id
      JOIN plastic_employees e ON pi.employee_id = e.id AND pi.company_id = e.company_id
      WHERE pi.company_id = ? AND p.month = ? AND p.year = ?
    `;
    const params = [companyId, Number(month), Number(year)];

    if (department && department !== "ALL") {
      sql += " AND e.department = ?";
      params.push(department);
    }

    sql += " ORDER BY e.employee_code ASC";

    const [rows] = await db.promise().query(sql, params);

    const summary = {
      totalEmployees: rows.length,
      totalGross: rows.reduce((s, r) => s + Number(r.gross_salary || 0), 0),
      totalNet: rows.reduce((s, r) => s + Number(r.net_salary || 0), 0),
      totalDeductions: rows.reduce((s, r) => s + Number(r.total_deductions || 0), 0),
      totalAdvanceRecovered: rows.reduce((s, r) => s + Number(r.advance_recovery || 0), 0),
      totalOvertime: rows.reduce((s, r) => s + Number(r.overtime_amount || 0), 0),
    };

    res.status(200).json({ success: true, summary, register: rows });
  } catch (error) {
    console.error("Get Salary Register Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate salary register" });
  }
};

exports.getAttendanceSummaryReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date, department } = req.query;

    let sql = `
      SELECT
        e.id AS employee_id,
        e.employee_code,
        e.full_name,
        e.department,
        e.designation,
        COUNT(a.id) AS total_logged_days,
        COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) AS present_days,
        COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END) AS absent_days,
        COUNT(CASE WHEN a.status = 'HALF_DAY' THEN 1 END) AS half_days,
        COUNT(CASE WHEN a.status = 'LEAVE' THEN 1 END) AS leave_days,
        COUNT(CASE WHEN a.status = 'HOLIDAY' THEN 1 END) AS holidays,
        COUNT(CASE WHEN a.status = 'WEEKLY_OFF' THEN 1 END) AS weekly_offs,
        COALESCE(SUM(a.working_hours), 0) AS total_regular_hours,
        COALESCE(SUM(a.overtime_hours), 0) AS total_overtime_hours
      FROM plastic_employees e
      LEFT JOIN plastic_attendance a ON e.id = a.employee_id
        AND a.company_id = e.company_id
        AND a.attendance_date >= ?
        AND a.attendance_date <= ?
      WHERE e.company_id = ? AND e.status = 'ACTIVE'
    `;
    const params = [from_date || "2000-01-01", to_date || "2099-12-31", companyId];

    if (department && department !== "ALL") {
      sql += " AND e.department = ?";
      params.push(department);
    }

    sql += " GROUP BY e.id ORDER BY e.department ASC, e.employee_code ASC";

    const [rows] = await db.promise().query(sql, params);

    res.status(200).json({ success: true, records: rows });
  } catch (error) {
    console.error("Get Attendance Summary Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch attendance summary" });
  }
};

exports.getLeaveReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const year = Number(req.query.year) || new Date().getFullYear();

    const [balances] = await db.promise().query(
      `SELECT
        e.id AS employee_id,
        e.employee_code,
        e.full_name,
        e.department,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        lb.total_allocated,
        lb.used AS used_days,
        lb.used,
        lb.balance AS remaining_days,
        lb.balance
       FROM plastic_leave_balances lb
       JOIN plastic_employees e ON lb.employee_id = e.id AND lb.company_id = e.company_id
       JOIN plastic_leave_types lt ON lb.leave_type_id = lt.id AND lb.company_id = lt.company_id
       WHERE lb.company_id = ? AND lb.year = ?
       ORDER BY e.employee_code ASC, lt.code ASC`,
      [companyId, year]
    );

    const [recentRequests] = await db.promise().query(
      `SELECT
        lr.*,
        e.employee_code,
        e.full_name,
        e.department,
        lt.name AS leave_type_name
       FROM plastic_leave_requests lr
       JOIN plastic_employees e ON lr.employee_id = e.id AND lr.company_id = e.company_id
       JOIN plastic_leave_types lt ON lr.leave_type_id = lt.id AND lr.company_id = lt.company_id
       WHERE lr.company_id = ?
       ORDER BY lr.created_at DESC LIMIT 50`,
      [companyId]
    );

    res.status(200).json({ success: true, year, balances, recentRequests });
  } catch (error) {
    console.error("Get Leave Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch leave report" });
  }
};

exports.getAdvanceRecoveryReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [advances] = await db.promise().query(
      `SELECT
        a.*,
        a.advance_amount AS amount,
        a.advance_date AS disbursement_date,
        e.employee_code,
        e.full_name,
        e.department,
        e.designation,
        e.mobile
       FROM plastic_employee_advances a
       JOIN plastic_employees e ON a.employee_id = e.id AND a.company_id = e.company_id
       WHERE a.company_id = ?
       ORDER BY a.status ASC, a.advance_date DESC`,
      [companyId]
    );

    const totalAdvanced = advances.reduce((s, a) => s + Number(a.advance_amount || a.amount || 0), 0);
    const totalRecovered = advances.reduce((s, a) => s + Number(a.recovery_amount || 0), 0);
    const totalOutstanding = advances.reduce((s, a) => s + Number(a.outstanding_amount || 0), 0);
    const activeCount = advances.filter((a) => a.status === "ACTIVE").length;

    res.status(200).json({
      success: true,
      summary: {
        totalAdvanced,
        totalRecovered,
        totalOutstanding,
        activeCount,
      },
      advances,
    });
  } catch (error) {
    console.error("Get Advance Recovery Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch advance report" });
  }
};

exports.getExpenseSummaryReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date } = req.query;

    const start = from_date || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const end = to_date || new Date().toISOString().slice(0, 10);

    // Group by category
    const [byCategory] = await db.promise().query(
      `SELECT
        c.id AS category_id,
        c.name AS category_name,
        c.code AS category_code,
        COUNT(e.id) AS expense_count,
        COALESCE(SUM(e.amount), 0) AS total_amount,
        COALESCE(SUM(CASE WHEN e.payment_status = 'PAID' THEN e.amount ELSE 0 END), 0) AS paid_amount,
        COALESCE(SUM(CASE WHEN e.payment_status = 'PENDING' THEN e.amount ELSE 0 END), 0) AS pending_amount
       FROM plastic_expense_categories c
       LEFT JOIN plastic_expenses e ON c.id = e.category_id
         AND e.company_id = c.company_id
         AND e.expense_date >= ?
         AND e.expense_date <= ?
       WHERE c.company_id = ?
       GROUP BY c.id
       ORDER BY total_amount DESC`,
      [start, end, companyId]
    );

    // Group by month
    const [byMonth] = await db.promise().query(
      `SELECT
        DATE_FORMAT(expense_date, '%Y-%m') AS month_label,
        COUNT(id) AS count,
        COALESCE(SUM(amount), 0) AS total_amount
       FROM plastic_expenses
       WHERE company_id = ? AND expense_date >= ? AND expense_date <= ?
       GROUP BY month_label
       ORDER BY month_label ASC`,
      [companyId, start, end]
    );

    // Top vendors
    const [topVendors] = await db.promise().query(
      `SELECT
        COALESCE(vendor_name, 'Direct Cash/Sundry') AS vendor,
        COUNT(id) AS bill_count,
        COALESCE(SUM(amount), 0) AS total_amount
       FROM plastic_expenses
       WHERE company_id = ? AND expense_date >= ? AND expense_date <= ?
       GROUP BY vendor
       ORDER BY total_amount DESC LIMIT 10`,
      [companyId, start, end]
    );

    const overallTotal = byCategory.reduce((s, c) => s + Number(c.total_amount || 0), 0);

    res.status(200).json({
      success: true,
      period: { from_date: start, to_date: end },
      overallTotal,
      byCategory,
      byMonth,
      topVendors,
    });
  } catch (error) {
    console.error("Get Expense Summary Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate expense summary" });
  }
};

exports.getPlantLabourCostReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date } = req.query;

    const start = from_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const end = to_date || new Date().toISOString().slice(0, 10);

    // Attendance labour cost
    const [labourRows] = await db.promise().query(
      `SELECT
        a.attendance_date,
        COUNT(a.id) AS total_workers,
        SUM(a.working_hours) AS regular_hours,
        SUM(a.overtime_hours) AS overtime_hours,
        SUM(
          CASE
            WHEN s.salary_type = 'HOURLY' THEN (a.working_hours * s.base_salary) + (a.overtime_hours * s.overtime_rate_per_hour)
            WHEN s.salary_type = 'DAILY' THEN s.base_salary + (a.overtime_hours * s.overtime_rate_per_hour)
            ELSE ((s.base_salary / 26) * (a.working_hours / 8)) + (a.overtime_hours * s.overtime_rate_per_hour)
          END
        ) AS estimated_labour_cost
       FROM plastic_attendance a
       JOIN plastic_employees e ON a.employee_id = e.id AND a.company_id = e.company_id
       LEFT JOIN (SELECT * FROM plastic_employee_salaries WHERE status = 'ACTIVE') s
         ON e.id = s.employee_id AND e.company_id = s.company_id
       WHERE a.company_id = ? AND a.attendance_date >= ? AND a.attendance_date <= ?
         AND a.status IN ('PRESENT', 'HALF_DAY')
       GROUP BY a.attendance_date
       ORDER BY a.attendance_date ASC`,
      [companyId, start, end]
    );

    // Production output in the same date range
    const [prodRows] = await db.promise().query(
      `SELECT
        COALESCE(batch_date, DATE(created_at)) AS prod_date,
        COALESCE(SUM(actual_quantity), 0) AS total_produced_kg,
        COUNT(id) AS batches_count
       FROM plastic_production_batches
       WHERE company_id = ? AND batch_date >= ? AND batch_date <= ?
       GROUP BY prod_date`,
      [companyId, start, end]
    );

    const prodMap = {};
    prodRows.forEach((p) => {
      const d = p.prod_date instanceof Date ? p.prod_date.toISOString().slice(0, 10) : String(p.prod_date);
      prodMap[d] = {
        kg: Number(p.total_produced_kg || 0),
        batches: p.batches_count,
      };
    });

    let totalLabour = 0;
    let totalProducedKg = 0;

    const dailyBreakdown = labourRows.map((l) => {
      const d = l.attendance_date instanceof Date ? l.attendance_date.toISOString().slice(0, 10) : String(l.attendance_date);
      const prod = prodMap[d] || { kg: 0, batches: 0 };
      const cost = Math.round(Number(l.estimated_labour_cost || 0));
      const kg = prod.kg;
      const costPerKg = kg > 0 ? Number((cost / kg).toFixed(2)) : 0;

      totalLabour += cost;
      totalProducedKg += kg;

      return {
        date: d,
        workers: l.total_workers,
        regularHours: l.regular_hours,
        overtimeHours: l.overtime_hours,
        labourCost: cost,
        producedKg: kg,
        costPerKg,
      };
    });

    const avgCostPerKg = totalProducedKg > 0 ? Number((totalLabour / totalProducedKg).toFixed(2)) : 0;

    res.status(200).json({
      success: true,
      summary: {
        totalLabourCost: totalLabour,
        totalProducedKg,
        averageLabourCostPerKg: avgCostPerKg,
      },
      dailyBreakdown,
    });
  } catch (error) {
    console.error("Get Plant Labour Cost Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate plant labour cost report" });
  }
};
