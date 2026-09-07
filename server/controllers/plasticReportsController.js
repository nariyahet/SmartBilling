const db = require("../config/db");

exports.getOperationalReports = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date, machine_id, shift_id } = req.query;

    let dateCondBatch = "";
    let dateCondConsump = "";
    const paramsBatch = [companyId];
    const paramsConsump = [companyId];

    if (from_date && to_date) {
      dateCondBatch = " AND DATE(b.batch_date) >= ? AND DATE(b.batch_date) <= ?";
      dateCondConsump = " AND DATE(c.consumed_at) >= ? AND DATE(c.consumed_at) <= ?";
      paramsBatch.push(from_date, to_date);
      paramsConsump.push(from_date, to_date);
    }

    // 1. Production Summary
    const [prodSummary] = await db.promise().query(
      `SELECT
        COUNT(b.id) AS total_batches,
        COALESCE(SUM(b.planned_quantity), 0) AS total_planned_kg,
        COALESCE(SUM(b.actual_quantity), 0) AS total_actual_kg,
        COALESCE(SUM(b.scrap_quantity), 0) AS total_scrap_kg,
        COALESCE(SUM(b.rejected_quantity), 0) AS total_rejected_kg,
        COALESCE(AVG(b.efficiency_percent), 0) AS avg_efficiency_percent
       FROM plastic_production_batches b
       WHERE b.company_id = ? ${dateCondBatch}`,
      paramsBatch
    );

    // 2. Material-wise Consumption
    const [materialConsumption] = await db.promise().query(
      `SELECT
        c.raw_material_id,
        c.material_name,
        c.unit,
        COALESCE(SUM(c.actual_quantity), 0) AS total_consumed,
        COALESCE(SUM(c.total_cost), 0) AS total_cost
       FROM plastic_material_consumptions c
       WHERE c.company_id = ? ${dateCondConsump}
       GROUP BY c.raw_material_id, c.material_name, c.unit
       ORDER BY total_consumed DESC`,
      paramsConsump
    );

    // 3. Machine Downtime Summary
    const [downtimeSummary] = await db.promise().query(
      `SELECT
        m.id AS machine_id,
        m.machine_name,
        m.machine_code,
        COUNT(d.id) AS incident_count,
        COALESCE(SUM(d.duration_minutes), 0) AS total_downtime_minutes
       FROM plastic_machines m
       LEFT JOIN plastic_machine_downtime d ON m.id = d.machine_id AND m.company_id = d.company_id
       WHERE m.company_id = ?
       GROUP BY m.id, m.machine_name, m.machine_code`,
      [companyId]
    );

    // 4. Quality Control Summary
    const [qcSummary] = await db.promise().query(
      `SELECT
        overall_status,
        COUNT(id) AS count
       FROM plastic_quality_inspections
       WHERE company_id = ?
       GROUP BY overall_status`,
      [companyId]
    );

    res.status(200).json({
      success: true,
      reports: {
        production: prodSummary[0] || {},
        materialConsumption,
        downtimeSummary,
        qcSummary,
      },
    });
  } catch (error) {
    console.error("Get Operational Reports Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate operational reports",
    });
  }
};

exports.getOperationalAlerts = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const alerts = [];

    // 1. Check Low Raw Material Stock
    const [lowStock] = await db.promise().query(
      `SELECT rm.material_name, rm.minimum_stock, COALESCE(rms.quantity, 0) AS current_stock, rm.unit
       FROM raw_materials rm
       LEFT JOIN raw_material_stock rms ON rm.id = rms.raw_material_id AND rm.company_id = rms.company_id
       WHERE rm.company_id = ? AND rm.status = 'ACTIVE' AND COALESCE(rms.quantity, 0) <= rm.minimum_stock`,
      [companyId]
    );

    for (const item of lowStock) {
      alerts.push({
        id: `low-stock-${item.material_name}`,
        type: "WARNING",
        category: "LOW_STOCK",
        title: `Low Stock: ${item.material_name}`,
        message: `Current stock (${item.current_stock} ${item.unit}) is at or below minimum required (${item.minimum_stock} ${item.unit}).`,
        severity: "HIGH",
      });
    }

    // 2. Check Breakdown Machines
    const [breakdownMachines] = await db.promise().query(
      `SELECT machine_name, machine_code, status
       FROM plastic_machines
       WHERE company_id = ? AND status = 'BREAKDOWN'`,
      [companyId]
    );

    for (const m of breakdownMachines) {
      alerts.push({
        id: `machine-breakdown-${m.machine_code}`,
        type: "DANGER",
        category: "MACHINE_BREAKDOWN",
        title: `Machine Breakdown: ${m.machine_name} (${m.machine_code})`,
        message: `Machine is currently flagged as BREAKDOWN. Immediate maintenance required.`,
        severity: "CRITICAL",
      });
    }

    // 3. Check Scheduled Maintenance Due
    const [maintenanceDue] = await db.promise().query(
      `SELECT m.title, m.scheduled_date, pm.machine_name
       FROM plastic_maintenance_records m
       JOIN plastic_machines pm ON m.machine_id = pm.id AND m.company_id = pm.company_id
       WHERE m.company_id = ? AND m.status = 'SCHEDULED' AND m.scheduled_date <= CURDATE()`,
      [companyId]
    );

    for (const m of maintenanceDue) {
      alerts.push({
        id: `maintenance-due-${m.title}`,
        type: "INFO",
        category: "MAINTENANCE_DUE",
        title: `Maintenance Due: ${m.machine_name}`,
        message: `${m.title} was scheduled on or before ${m.scheduled_date}.`,
        severity: "MEDIUM",
      });
    }

    // 4. Batches on HOLD
    const [holdBatches] = await db.promise().query(
      `SELECT batch_no, product_name, notes
       FROM plastic_production_batches
       WHERE company_id = ? AND status = 'HOLD'`,
      [companyId]
    );

    for (const b of holdBatches) {
      alerts.push({
        id: `batch-hold-${b.batch_no}`,
        type: "WARNING",
        category: "BATCH_HOLD",
        title: `Batch on Hold: ${b.batch_no}`,
        message: `Production of ${b.product_name} is currently paused on HOLD.`,
        severity: "HIGH",
      });
    }

    res.status(200).json({
      success: true,
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    console.error("Get Operational Alerts Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch operational alerts",
    });
  }
};
