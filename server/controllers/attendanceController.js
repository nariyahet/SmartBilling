const db = require("../config/db");

exports.getDailyAttendance = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const date = req.query.date || req.query.attendance_date || new Date().toISOString().slice(0, 10);
    const { department, shift_id } = req.query;

    let sql = `
      SELECT
        e.id AS employee_id,
        e.employee_code,
        e.full_name,
        e.department,
        e.designation,
        e.status AS employment_status,
        a.id AS attendance_id,
        COALESCE(a.status, 'UNMARKED') AS status,
        a.attendance_date,
        a.shift_id,
        ps.shift_name,
        a.check_in,
        a.check_out,
        COALESCE(a.working_hours, 8.00) AS working_hours,
        COALESCE(a.overtime_hours, 0.00) AS overtime_hours,
        a.notes
      FROM plastic_employees e
      LEFT JOIN plastic_attendance a ON e.id = a.employee_id
        AND a.company_id = e.company_id
        AND a.attendance_date = ?
      LEFT JOIN plastic_shifts ps ON a.shift_id = ps.id
      WHERE e.company_id = ? AND e.status = 'ACTIVE'
    `;
    const params = [date, companyId];

    if (department && department !== "ALL") {
      sql += " AND e.department = ?";
      params.push(department);
    }

    if (shift_id && shift_id !== "ALL") {
      sql += " AND a.shift_id = ?";
      params.push(shift_id);
    }

    sql += " ORDER BY e.department ASC, e.full_name ASC";

    const [records] = await db.promise().query(sql, params);

    // Summary counts
    const summary = {
      date,
      totalEmployees: records.length,
      present: records.filter((r) => r.status === "PRESENT").length,
      absent: records.filter((r) => r.status === "ABSENT").length,
      halfDay: records.filter((r) => r.status === "HALF_DAY").length,
      onLeave: records.filter((r) => r.status === "ON_LEAVE").length,
      unmarked: records.filter((r) => r.status === "UNMARKED").length,
    };

    res.status(200).json({ success: true, summary, records, roster: records });
  } catch (error) {
    console.error("Get Daily Attendance Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve daily attendance" });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      employee_id,
      attendance_date = req.body.date || new Date().toISOString().slice(0, 10),
      status = "PRESENT",
      shift_id,
      check_in = req.body.in_time,
      check_out = req.body.out_time,
      working_hours = 8.00,
      overtime_hours = 0.00,
      notes = req.body.remarks,
    } = req.body;

    if (!employee_id) {
      return res.status(400).json({ success: false, message: "Employee ID is required" });
    }

    await db.promise().query(
      `INSERT INTO plastic_attendance (
        company_id, employee_id, attendance_date, shift_id, status,
        check_in, check_out, working_hours, overtime_hours, notes, marked_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        shift_id = VALUES(shift_id),
        status = VALUES(status),
        check_in = VALUES(check_in),
        check_out = VALUES(check_out),
        working_hours = VALUES(working_hours),
        overtime_hours = VALUES(overtime_hours),
        notes = VALUES(notes),
        marked_by = VALUES(marked_by)`,
      [
        companyId,
        employee_id,
        attendance_date,
        shift_id || null,
        status,
        check_in || null,
        check_out || null,
        Number(working_hours || 8.00),
        Number(overtime_hours || 0.00),
        notes || null,
        adminId,
      ]
    );

    res.status(200).json({ success: true, message: "Attendance marked successfully" });
  } catch (error) {
    console.error("Mark Attendance Error:", error);
    res.status(500).json({ success: false, message: "Failed to mark attendance" });
  }
};

exports.markBulkAttendance = async (req, res) => {
  const pdb = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const { attendance_date, date, records } = req.body;
    const targetDate = attendance_date || date || new Date().toISOString().slice(0, 10);

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Date and an array of attendance records are required",
      });
    }

    await pdb.beginTransaction();

    for (const rec of records) {
      await pdb.query(
        `INSERT INTO plastic_attendance (
          company_id, employee_id, attendance_date, shift_id, status,
          check_in, check_out, working_hours, overtime_hours, notes, marked_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          shift_id = VALUES(shift_id),
          status = VALUES(status),
          check_in = VALUES(check_in),
          check_out = VALUES(check_out),
          working_hours = VALUES(working_hours),
          overtime_hours = VALUES(overtime_hours),
          notes = VALUES(notes),
          marked_by = VALUES(marked_by)`,
        [
          companyId,
          rec.employee_id,
          targetDate,
          rec.shift_id || req.body.shift_id || null,
          rec.status || "PRESENT",
          rec.check_in || rec.in_time || null,
          rec.check_out || rec.out_time || null,
          Number(rec.working_hours !== undefined ? rec.working_hours : 8.00),
          Number(rec.overtime_hours || 0.00),
          rec.notes || rec.remarks || null,
          adminId,
        ]
      );
    }

    await pdb.commit();

    res.status(200).json({
      success: true,
      message: `Bulk attendance recorded for ${records.length} employees`,
    });
  } catch (error) {
    await pdb.rollback();
    console.error("Mark Bulk Attendance Error:", error);
    res.status(500).json({ success: false, message: "Failed to record bulk attendance" });
  }
};

exports.getMonthlyAttendanceSummary = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const year = Number(req.query.year) || currentYear;
    const month = Number(req.query.month) || currentMonth;
    const { department } = req.query;

    let sql = `
      SELECT
        e.id AS employee_id,
        e.employee_code,
        e.full_name,
        e.department,
        e.designation,
        COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) AS present_days,
        COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END) AS absent_days,
        COUNT(CASE WHEN a.status = 'HALF_DAY' THEN 1 END) AS half_days,
        COUNT(CASE WHEN a.status = 'ON_LEAVE' THEN 1 END) AS leave_days,
        COUNT(CASE WHEN a.status = 'HOLIDAY' OR a.status = 'WEEK_OFF' THEN 1 END) AS holiday_days,
        COALESCE(SUM(a.working_hours), 0) AS total_working_hours,
        COALESCE(SUM(a.overtime_hours), 0) AS total_overtime_hours
      FROM plastic_employees e
      LEFT JOIN plastic_attendance a ON e.id = a.employee_id
        AND a.company_id = e.company_id
        AND YEAR(a.attendance_date) = ?
        AND MONTH(a.attendance_date) = ?
      WHERE e.company_id = ? AND e.status = 'ACTIVE'
    `;
    const params = [year, month, companyId];

    if (department && department !== "ALL") {
      sql += " AND e.department = ?";
      params.push(department);
    }

    sql += " GROUP BY e.id ORDER BY e.department ASC, e.full_name ASC";

    const [summary] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      year,
      month,
      count: summary.length,
      summary,
    });
  } catch (error) {
    console.error("Get Monthly Attendance Summary Error:", error);
    res.status(500).json({ success: false, message: "Failed to calculate monthly attendance summary" });
  }
};

exports.getEmployeeAttendanceHistory = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { employeeId } = req.params;
    const { year, month } = req.query;

    let sql = `
      SELECT a.*, ps.shift_name
      FROM plastic_attendance a
      LEFT JOIN plastic_shifts ps ON a.shift_id = ps.id
      WHERE a.employee_id = ? AND a.company_id = ?
    `;
    const params = [employeeId, companyId];

    if (year) {
      sql += " AND YEAR(a.attendance_date) = ?";
      params.push(year);
    }
    if (month) {
      sql += " AND MONTH(a.attendance_date) = ?";
      params.push(month);
    }

    sql += " ORDER BY a.attendance_date DESC";

    const [records] = await db.promise().query(sql, params);

    res.status(200).json({ success: true, count: records.length, records });
  } catch (error) {
    console.error("Get Employee Attendance History Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve employee attendance history" });
  }
};
