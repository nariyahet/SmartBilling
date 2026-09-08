const db = require("../config/db");

exports.getWorkforceOverview = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Fetch operators with linked employees
    const [operators] = await db.promise().query(
      `SELECT
        op.*,
        e.employee_code,
        e.full_name AS employee_name,
        e.mobile AS employee_mobile,
        e.department,
        e.designation,
        e.joining_date,
        s.salary_type,
        s.base_salary,
        s.overtime_rate_per_hour
      FROM plastic_operators op
      LEFT JOIN plastic_employees e ON op.employee_id = e.id AND op.company_id = e.company_id
      LEFT JOIN (
        SELECT * FROM plastic_employee_salaries WHERE status = 'ACTIVE'
      ) s ON e.id = s.employee_id AND e.company_id = s.company_id
      WHERE op.company_id = ?
      ORDER BY op.id DESC`,
      [companyId]
    );

    // Fetch shifts
    const [shifts] = await db.promise().query(
      "SELECT * FROM plastic_shifts WHERE company_id = ? ORDER BY id ASC",
      [companyId]
    );

    // Fetch unlinked active production employees who can be mapped
    const [unlinkedEmployees] = await db.promise().query(
      `SELECT e.id, e.employee_code, e.full_name, e.department, e.designation
       FROM plastic_employees e
       LEFT JOIN plastic_operators op ON e.id = op.employee_id AND e.company_id = op.company_id
       WHERE e.company_id = ? AND e.status = 'ACTIVE' AND op.id IS NULL`,
      [companyId]
    );

    // Today's shift attendance breakdown
    const todayStr = new Date().toISOString().slice(0, 10);
    const [shiftAttendance] = await db.promise().query(
      `SELECT
        ps.id AS shift_id,
        ps.shift_name,
        COUNT(a.id) AS assigned_workers,
        COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) AS present_count,
        COALESCE(SUM(a.overtime_hours), 0) AS overtime_hours
       FROM plastic_shifts ps
       LEFT JOIN plastic_attendance a ON ps.id = a.shift_id
         AND a.company_id = ps.company_id
         AND a.attendance_date = ?
       WHERE ps.company_id = ?
       GROUP BY ps.id`,
      [todayStr, companyId]
    );

    res.status(200).json({
      success: true,
      operators,
      shifts,
      unlinkedEmployees,
      shiftAttendance,
    });
  } catch (error) {
    console.error("Get Workforce Overview Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve workforce data" });
  }
};

exports.mapOperatorToEmployee = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { operator_id, employee_id } = req.body;

    if (!operator_id) {
      return res.status(400).json({ success: false, message: "Operator ID is required" });
    }

    // Check operator belongs to company
    const [ops] = await db.promise().query(
      "SELECT id FROM plastic_operators WHERE id = ? AND company_id = ? LIMIT 1",
      [operator_id, companyId]
    );

    if (ops.length === 0) {
      return res.status(404).json({ success: false, message: "Operator not found" });
    }

    // If employee_id provided, check employee belongs to company
    if (employee_id) {
      const [emps] = await db.promise().query(
        "SELECT id, full_name, mobile FROM plastic_employees WHERE id = ? AND company_id = ? LIMIT 1",
        [employee_id, companyId]
      );
      if (emps.length === 0) {
        return res.status(404).json({ success: false, message: "Employee not found" });
      }

      // Sync name and mobile from employee to operator for consistency
      await db.promise().query(
        `UPDATE plastic_operators
         SET employee_id = ?, name = COALESCE(?, name), mobile = COALESCE(?, mobile)
         WHERE id = ? AND company_id = ?`,
        [employee_id, emps[0].full_name, emps[0].mobile, operator_id, companyId]
      );
    } else {
      // Unlink
      await db.promise().query(
        "UPDATE plastic_operators SET employee_id = NULL WHERE id = ? AND company_id = ?",
        [operator_id, companyId]
      );
    }

    res.status(200).json({ success: true, message: "Operator mapping updated successfully" });
  } catch (error) {
    console.error("Map Operator Error:", error);
    res.status(500).json({ success: false, message: "Failed to map operator" });
  }
};

exports.getShiftLabourCost = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date, shift_id } = req.query;

    let sql = `
      SELECT
        a.attendance_date,
        ps.shift_name,
        COUNT(a.id) AS workers_present,
        SUM(a.working_hours) AS total_regular_hours,
        SUM(a.overtime_hours) AS total_overtime_hours,
        SUM(
          CASE
            WHEN s.salary_type = 'HOURLY' THEN (a.working_hours * s.base_salary) + (a.overtime_hours * s.overtime_rate_per_hour)
            WHEN s.salary_type = 'DAILY' THEN s.base_salary + (a.overtime_hours * s.overtime_rate_per_hour)
            ELSE ((s.base_salary / 26) * (a.working_hours / 8)) + (a.overtime_hours * s.overtime_rate_per_hour)
          END
        ) AS estimated_labour_cost
      FROM plastic_attendance a
      JOIN plastic_shifts ps ON a.shift_id = ps.id AND a.company_id = ps.company_id
      JOIN plastic_employees e ON a.employee_id = e.id AND a.company_id = e.company_id
      LEFT JOIN (
        SELECT * FROM plastic_employee_salaries WHERE status = 'ACTIVE'
      ) s ON e.id = s.employee_id AND e.company_id = s.company_id
      WHERE a.company_id = ? AND a.status IN ('PRESENT', 'HALF_DAY')
    `;
    const params = [companyId];

    if (from_date) {
      sql += " AND a.attendance_date >= ?";
      params.push(from_date);
    }
    if (to_date) {
      sql += " AND a.attendance_date <= ?";
      params.push(to_date);
    }
    if (shift_id && shift_id !== "ALL") {
      sql += " AND a.shift_id = ?";
      params.push(shift_id);
    }

    sql += " GROUP BY a.attendance_date, ps.id ORDER BY a.attendance_date DESC";

    const [rows] = await db.promise().query(sql, params);

    const totalLabourCost = rows.reduce((sum, r) => sum + Number(r.estimated_labour_cost || 0), 0);
    const totalHours = rows.reduce((sum, r) => sum + Number(r.total_regular_hours || 0) + Number(r.total_overtime_hours || 0), 0);

    res.status(200).json({
      success: true,
      summary: {
        totalLabourCost: Math.round(totalLabourCost),
        totalHours,
        recordsCount: rows.length,
      },
      records: rows,
    });
  } catch (error) {
    console.error("Get Shift Labour Cost Error:", error);
    res.status(500).json({ success: false, message: "Failed to calculate shift labour cost" });
  }
};
