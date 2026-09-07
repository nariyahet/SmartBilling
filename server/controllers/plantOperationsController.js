const db = require("../config/db");

// ==========================================
// 1. MACHINES MANAGEMENT
// ==========================================

exports.getMachines = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, type } = req.query;

    let sql = `SELECT * FROM plastic_machines WHERE company_id = ?`;
    const params = [companyId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (type) {
      sql += ` AND machine_type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY machine_name ASC`;

    const [machines] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      machines,
    });
  } catch (error) {
    console.error("Get Machines Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch machines",
    });
  }
};

exports.getMachineById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [rows] = await db.promise().query(
      `SELECT * FROM plastic_machines WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Machine not found",
      });
    }

    res.status(200).json({
      success: true,
      machine: rows[0],
    });
  } catch (error) {
    console.error("Get Machine By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch machine details",
    });
  }
};

exports.createMachine = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const {
      machine_code,
      machine_name,
      machine_type,
      capacity = 0,
      unit = "KG/HR",
      location,
      status = "ACTIVE",
      installation_date,
      notes,
    } = req.body;

    if (!machine_name || !machine_type) {
      return res.status(400).json({
        success: false,
        message: "Machine name and machine type are required",
      });
    }

    let code = machine_code;
    if (!code) {
      const [maxCode] = await db.promise().query(
        `SELECT COUNT(id) AS count FROM plastic_machines WHERE company_id = ?`,
        [companyId]
      );
      const nextNum = (maxCode[0]?.count || 0) + 1;
      code = `MCH-${1000 + nextNum}`;
    }

    const [result] = await db.promise().query(
      `INSERT INTO plastic_machines
        (company_id, machine_code, machine_name, machine_type, capacity, unit, location, status, installation_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        code.trim().toUpperCase(),
        machine_name.trim(),
        machine_type.trim(),
        Number(capacity) || 0,
        unit || "KG/HR",
        location || null,
        status || "ACTIVE",
        installation_date || null,
        notes || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Machine created successfully",
      machineId: result.insertId,
      machineCode: code,
    });
  } catch (error) {
    console.error("Create Machine Error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A machine with this code already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to create machine",
    });
  }
};

exports.updateMachine = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const {
      machine_name,
      machine_type,
      capacity,
      unit,
      location,
      status,
      installation_date,
      notes,
    } = req.body;

    const [existing] = await db.promise().query(
      `SELECT id FROM plastic_machines WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Machine not found",
      });
    }

    await db.promise().query(
      `UPDATE plastic_machines
       SET machine_name = COALESCE(?, machine_name),
           machine_type = COALESCE(?, machine_type),
           capacity = COALESCE(?, capacity),
           unit = COALESCE(?, unit),
           location = COALESCE(?, location),
           status = COALESCE(?, status),
           installation_date = COALESCE(?, installation_date),
           notes = COALESCE(?, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [
        machine_name,
        machine_type,
        capacity !== undefined ? Number(capacity) : null,
        unit,
        location,
        status,
        installation_date,
        notes,
        id,
        companyId,
      ]
    );

    res.status(200).json({
      success: true,
      message: "Machine updated successfully",
    });
  } catch (error) {
    console.error("Update Machine Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update machine",
    });
  }
};

// ==========================================
// 2. MACHINE DOWNTIME
// ==========================================

exports.getDowntimeLogs = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { machine_id, category } = req.query;

    let sql = `
      SELECT
        d.*,
        m.machine_name,
        m.machine_code
      FROM plastic_machine_downtime d
      JOIN plastic_machines m ON d.machine_id = m.id AND d.company_id = m.company_id
      WHERE d.company_id = ?
    `;
    const params = [companyId];

    if (machine_id) {
      sql += ` AND d.machine_id = ?`;
      params.push(machine_id);
    }
    if (category) {
      sql += ` AND d.category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY d.start_time DESC`;

    const [logs] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      downtimeLogs: logs,
    });
  } catch (error) {
    console.error("Get Downtime Logs Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch downtime logs",
    });
  }
};

exports.logDowntime = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      machine_id,
      batch_id,
      shift_id,
      category = "BREAKDOWN",
      start_time,
      end_time,
      duration_minutes = 0,
      reason,
      action_taken,
    } = req.body;

    if (!machine_id || !reason) {
      return res.status(400).json({
        success: false,
        message: "Machine ID and reason for downtime are required",
      });
    }

    // Verify machine
    const [machines] = await db.promise().query(
      `SELECT id FROM plastic_machines WHERE id = ? AND company_id = ?`,
      [machine_id, companyId]
    );
    if (machines.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Machine not found",
      });
    }

    const [countRows] = await db.promise().query(
      `SELECT COUNT(id) AS count FROM plastic_machine_downtime WHERE company_id = ?`,
      [companyId]
    );
    const downtimeNo = `DWN-${1000 + (countRows[0]?.count || 0) + 1}`;

    const startTimeVal = start_time ? new Date(start_time) : new Date();
    let duration = Number(duration_minutes) || 0;
    if (end_time && !duration) {
      const diffMs = new Date(end_time).getTime() - startTimeVal.getTime();
      duration = Math.max(0, Math.round(diffMs / (1000 * 60)));
    }

    const [result] = await db.promise().query(
      `INSERT INTO plastic_machine_downtime
        (company_id, downtime_no, machine_id, batch_id, shift_id, category, start_time, end_time, duration_minutes, reason, action_taken, logged_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        downtimeNo,
        machine_id,
        batch_id || null,
        shift_id || null,
        category,
        startTimeVal,
        end_time ? new Date(end_time) : null,
        duration,
        reason.trim(),
        action_taken || null,
        adminId || null,
      ]
    );

    // Update machine status to BREAKDOWN if still active
    if (!end_time && (category === "BREAKDOWN" || category === "MAINTENANCE")) {
      await db.promise().query(
        `UPDATE plastic_machines SET status = ? WHERE id = ? AND company_id = ?`,
        [category, machine_id, companyId]
      );
    }

    res.status(201).json({
      success: true,
      message: "Downtime logged successfully",
      downtimeId: result.insertId,
      downtimeNo,
    });
  } catch (error) {
    console.error("Log Downtime Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record machine downtime",
    });
  }
};

// ==========================================
// 3. MAINTENANCE MANAGEMENT
// ==========================================

exports.getMaintenanceRecords = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { machine_id, status, type } = req.query;

    let sql = `
      SELECT
        m.*,
        pm.machine_name,
        pm.machine_code
      FROM plastic_maintenance_records m
      JOIN plastic_machines pm ON m.machine_id = pm.id AND m.company_id = pm.company_id
      WHERE m.company_id = ?
    `;
    const params = [companyId];

    if (machine_id) {
      sql += ` AND m.machine_id = ?`;
      params.push(machine_id);
    }
    if (status) {
      sql += ` AND m.status = ?`;
      params.push(status);
    }
    if (type) {
      sql += ` AND m.maintenance_type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY m.scheduled_date DESC`;

    const [records] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      maintenanceRecords: records,
    });
  } catch (error) {
    console.error("Get Maintenance Records Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch maintenance records",
    });
  }
};

exports.createMaintenance = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      machine_id,
      maintenance_type = "PREVENTIVE",
      title,
      scheduled_date,
      performed_date,
      next_maintenance_date,
      cost = 0,
      spare_parts_used,
      technician_name,
      status = "SCHEDULED",
      notes,
    } = req.body;

    if (!machine_id || !title || !scheduled_date) {
      return res.status(400).json({
        success: false,
        message: "Machine ID, maintenance title, and scheduled date are required",
      });
    }

    const [countRows] = await db.promise().query(
      `SELECT COUNT(id) AS count FROM plastic_maintenance_records WHERE company_id = ?`,
      [companyId]
    );
    const maintenanceNo = `MNT-${1000 + (countRows[0]?.count || 0) + 1}`;

    const [result] = await db.promise().query(
      `INSERT INTO plastic_maintenance_records
        (company_id, maintenance_no, machine_id, maintenance_type, title, scheduled_date, performed_date, next_maintenance_date, cost, spare_parts_used, technician_name, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        maintenanceNo,
        machine_id,
        maintenance_type,
        title.trim(),
        scheduled_date,
        performed_date || null,
        next_maintenance_date || null,
        Number(cost) || 0,
        spare_parts_used || null,
        technician_name || null,
        status,
        notes || null,
        adminId || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Maintenance schedule created successfully",
      maintenanceId: result.insertId,
      maintenanceNo,
    });
  } catch (error) {
    console.error("Create Maintenance Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create maintenance record",
    });
  }
};

// ==========================================
// 4. SHIFTS MANAGEMENT
// ==========================================

exports.getShifts = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [shifts] = await db.promise().query(
      `SELECT * FROM plastic_shifts WHERE company_id = ? ORDER BY start_time ASC`,
      [companyId]
    );

    res.status(200).json({
      success: true,
      shifts,
    });
  } catch (error) {
    console.error("Get Shifts Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch shifts",
    });
  }
};

exports.createShift = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const {
      shift_name,
      start_time,
      end_time,
      break_duration_minutes = 60,
      status = "ACTIVE",
    } = req.body;

    if (!shift_name || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: "Shift name, start time, and end time are required",
      });
    }

    const [result] = await db.promise().query(
      `INSERT INTO plastic_shifts
        (company_id, shift_name, start_time, end_time, break_duration_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        shift_name.trim(),
        start_time,
        end_time,
        Number(break_duration_minutes) || 60,
        status,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Shift created successfully",
      shiftId: result.insertId,
    });
  } catch (error) {
    console.error("Create Shift Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create shift",
    });
  }
};

// ==========================================
// 5. OPERATORS MANAGEMENT
// ==========================================

exports.getOperators = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [operators] = await db.promise().query(
      `SELECT * FROM plastic_operators WHERE company_id = ? ORDER BY name ASC`,
      [companyId]
    );

    res.status(200).json({
      success: true,
      operators,
    });
  } catch (error) {
    console.error("Get Operators Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch operators",
    });
  }
};

exports.createOperator = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const {
      operator_code,
      name,
      mobile,
      skill_level = "Operator",
      status = "ACTIVE",
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Operator name is required",
      });
    }

    let code = operator_code;
    if (!code) {
      const [countRows] = await db.promise().query(
        `SELECT COUNT(id) AS count FROM plastic_operators WHERE company_id = ?`,
        [companyId]
      );
      code = `OP-${1000 + (countRows[0]?.count || 0) + 1}`;
    }

    const [result] = await db.promise().query(
      `INSERT INTO plastic_operators
        (company_id, operator_code, name, mobile, skill_level, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        code.trim().toUpperCase(),
        name.trim(),
        mobile || null,
        skill_level || "Operator",
        status,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Operator created successfully",
      operatorId: result.insertId,
      operatorCode: code,
    });
  } catch (error) {
    console.error("Create Operator Error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "An operator with this code already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to create operator",
    });
  }
};
