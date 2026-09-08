const db = require("../config/db");

exports.getLeaveTypes = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [leaveTypes] = await db.promise().query(
      "SELECT * FROM plastic_leave_types WHERE company_id = ? ORDER BY id ASC",
      [companyId]
    );
    res.status(200).json({ success: true, leaveTypes });
  } catch (error) {
    console.error("Get Leave Types Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve leave types" });
  }
};

exports.createLeaveType = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { name, code, annual_quota = 12, is_paid = 1 } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: "Name and code are required" });
    }

    const [resInsert] = await db.promise().query(
      `INSERT INTO plastic_leave_types (company_id, name, code, annual_quota, is_paid)
       VALUES (?, ?, ?, ?, ?)`,
      [companyId, name.trim(), code.trim().toUpperCase(), Number(annual_quota), is_paid ? 1 : 0]
    );

    res.status(201).json({
      success: true,
      message: "Leave type created successfully",
      leaveTypeId: resInsert.insertId,
    });
  } catch (error) {
    console.error("Create Leave Type Error:", error);
    res.status(500).json({ success: false, message: "Failed to create leave type" });
  }
};

exports.getLeaveBalances = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const currentYear = new Date().getFullYear();
    const year = Number(req.query.year) || currentYear;
    const { employee_id } = req.query;

    let sql = `
      SELECT
        lb.*,
        e.employee_code,
        e.full_name AS employee_name,
        e.department,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        lt.is_paid
      FROM plastic_leave_balances lb
      JOIN plastic_employees e ON lb.employee_id = e.id AND lb.company_id = e.company_id
      JOIN plastic_leave_types lt ON lb.leave_type_id = lt.id AND lb.company_id = lt.company_id
      WHERE lb.company_id = ? AND lb.year = ?
    `;
    const params = [companyId, year];

    if (employee_id) {
      sql += " AND lb.employee_id = ?";
      params.push(employee_id);
    }

    sql += " ORDER BY e.full_name ASC, lt.id ASC";

    const [balances] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, count: balances.length, balances });
  } catch (error) {
    console.error("Get Leave Balances Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve leave balances" });
  }
};

exports.getLeaveRequests = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, employee_id } = req.query;

    let sql = `
      SELECT
        lr.*,
        e.employee_code,
        e.full_name AS employee_name,
        e.department,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        lt.is_paid,
        adm.name AS approver_name
      FROM plastic_leave_requests lr
      JOIN plastic_employees e ON lr.employee_id = e.id AND lr.company_id = e.company_id
      JOIN plastic_leave_types lt ON lr.leave_type_id = lt.id AND lr.company_id = lt.company_id
      LEFT JOIN admins adm ON lr.approved_by = adm.id
      WHERE lr.company_id = ?
    `;
    const params = [companyId];

    if (status && status !== "ALL") {
      sql += " AND lr.status = ?";
      params.push(status);
    }
    if (employee_id) {
      sql += " AND lr.employee_id = ?";
      params.push(employee_id);
    }

    sql += " ORDER BY lr.id DESC";

    const [requests] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error("Get Leave Requests Error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve leave requests" });
  }
};

exports.createLeaveRequest = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { employee_id, leave_type_id, start_date, end_date, days, total_days, reason } = req.body;

    if (!employee_id || !leave_type_id || !start_date || !end_date || !reason) {
      return res.status(400).json({
        success: false,
        message: "Employee, leave type, start date, end date, and reason are required",
      });
    }

    const leaveDays = Number(days || total_days) || 1.0;


    // Check balance for this year
    const requestYear = new Date(start_date).getFullYear();
    const [balanceRow] = await db.promise().query(
      `SELECT balance FROM plastic_leave_balances
       WHERE company_id = ? AND employee_id = ? AND leave_type_id = ? AND year = ? LIMIT 1`,
      [companyId, employee_id, leave_type_id, requestYear]
    );

    if (balanceRow.length > 0 && balanceRow[0].balance < leaveDays) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance. Available: ${balanceRow[0].balance} days, Requested: ${leaveDays} days`,
      });
    }

    const [resInsert] = await db.promise().query(
      `INSERT INTO plastic_leave_requests (
        company_id, employee_id, leave_type_id, start_date, end_date, days, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [companyId, employee_id, leave_type_id, start_date, end_date, leaveDays, reason.trim()]
    );

    res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      requestId: resInsert.insertId,
    });
  } catch (error) {
    console.error("Create Leave Request Error:", error);
    res.status(500).json({ success: false, message: "Failed to submit leave request" });
  }
};

exports.approveLeaveRequest = async (req, res) => {
  const pdb = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const { id } = req.params;

    const [requests] = await pdb.query(
      "SELECT * FROM plastic_leave_requests WHERE id = ? AND company_id = ? LIMIT 1",
      [id, companyId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    const reqData = requests[0];
    if (reqData.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve request with status '${reqData.status}'`,
      });
    }

    await pdb.beginTransaction();

    // 1. Mark request APPROVED
    await pdb.query(
      `UPDATE plastic_leave_requests
       SET status = 'APPROVED', approved_by = ?, approval_date = NOW()
       WHERE id = ? AND company_id = ?`,
      [adminId, id, companyId]
    );

    // 2. Update employee leave balance
    const reqYear = new Date(reqData.start_date).getFullYear();
    await pdb.query(
      `UPDATE plastic_leave_balances
       SET used = used + ?, balance = balance - ?
       WHERE company_id = ? AND employee_id = ? AND leave_type_id = ? AND year = ?`,
      [reqData.days, reqData.days, companyId, reqData.employee_id, reqData.leave_type_id, reqYear]
    );

    // 3. Mark attendance records as ON_LEAVE for the range
    const start = new Date(reqData.start_date);
    const end = new Date(reqData.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      await pdb.query(
        `INSERT INTO plastic_attendance (
          company_id, employee_id, attendance_date, status, working_hours, notes, marked_by
        ) VALUES (?, ?, ?, 'ON_LEAVE', 0, 'Approved Leave', ?)
        ON DUPLICATE KEY UPDATE
          status = 'ON_LEAVE', working_hours = 0, notes = 'Approved Leave', marked_by = ?`,
        [companyId, reqData.employee_id, dateStr, adminId, adminId]
      );
    }

    await pdb.commit();

    res.status(200).json({ success: true, message: "Leave request approved successfully" });
  } catch (error) {
    await pdb.rollback();
    console.error("Approve Leave Request Error:", error);
    res.status(500).json({ success: false, message: "Failed to approve leave request" });
  }
};

exports.rejectLeaveRequest = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const { id } = req.params;
    const { rejection_reason } = req.body;

    const [requests] = await db.promise().query(
      "SELECT id, status FROM plastic_leave_requests WHERE id = ? AND company_id = ? LIMIT 1",
      [id, companyId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    if (requests[0].status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with status '${requests[0].status}'`,
      });
    }

    await db.promise().query(
      `UPDATE plastic_leave_requests
       SET status = 'REJECTED', approved_by = ?, rejection_reason = ?, approval_date = NOW()
       WHERE id = ? AND company_id = ?`,
      [adminId, rejection_reason || "Declined by management", id, companyId]
    );

    res.status(200).json({ success: true, message: "Leave request rejected" });
  } catch (error) {
    console.error("Reject Leave Request Error:", error);
    res.status(500).json({ success: false, message: "Failed to reject leave request" });
  }
};

exports.updateLeaveRequestStatus = async (req, res) => {
  const { status, approval_notes, rejection_reason } = req.body;
  if (status === "APPROVED") {
    req.body.approval_notes = approval_notes;
    return exports.approveLeaveRequest(req, res);
  } else if (status === "REJECTED") {
    req.body.rejection_reason = rejection_reason || approval_notes;
    return exports.rejectLeaveRequest(req, res);
  } else {
    return res.status(400).json({ success: false, message: "Invalid status value" });
  }
};

exports.initializeBalances = async (req, res) => {
  const pdb = db.promise();
  try {
    const companyId = req.user.company_id;
    const year = Number(req.body.year) || new Date().getFullYear();

    const [employees] = await pdb.query(
      "SELECT id FROM plastic_employees WHERE company_id = ? AND status = 'ACTIVE'",
      [companyId]
    );
    const [leaveTypes] = await pdb.query(
      "SELECT id, annual_quota FROM plastic_leave_types WHERE company_id = ?",
      [companyId]
    );

    for (const emp of employees) {
      for (const lt of leaveTypes) {
        await pdb.query(
          `INSERT INTO plastic_leave_balances (company_id, employee_id, leave_type_id, year, total_allocated, used, balance)
           VALUES (?, ?, ?, ?, ?, 0, ?)
           ON DUPLICATE KEY UPDATE total_allocated = VALUES(total_allocated), balance = VALUES(total_allocated) - used`,
          [companyId, emp.id, lt.id, year, lt.annual_quota, lt.annual_quota]
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Leave balances initialized for ${employees.length} employees for year ${year}`,
    });
  } catch (error) {
    console.error("Initialize Balances Error:", error);
    res.status(500).json({ success: false, message: "Failed to initialize leave balances" });
  }
};

