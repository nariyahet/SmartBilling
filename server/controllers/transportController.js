const db = require("../config/db");

// ==========================================
// 1. VEHICLE / TRANSPORT MANAGEMENT
// ==========================================

exports.getVehicles = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status } = req.query;

    let sql = `SELECT * FROM plastic_vehicles WHERE company_id = ?`;
    const params = [companyId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY vehicle_number ASC`;

    const [vehicles] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      vehicles,
    });
  } catch (error) {
    console.error("Get Vehicles Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch vehicles" });
  }
};

exports.createVehicle = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const {
      vehicle_number,
      vehicle_type,
      transporter_name,
      transporter_mobile,
      driver_name,
      driver_mobile,
      status = "ACTIVE",
    } = req.body;

    if (!vehicle_number) {
      return res.status(400).json({ success: false, message: "Vehicle number is required" });
    }

    const cleanVehNo = vehicle_number.trim().toUpperCase();

    const [existing] = await db.promise().query(
      `SELECT id FROM plastic_vehicles WHERE vehicle_number = ? AND company_id = ?`,
      [cleanVehNo, companyId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "A vehicle with this registration number already exists" });
    }

    const [result] = await db.promise().query(
      `INSERT INTO plastic_vehicles
        (company_id, vehicle_number, vehicle_type, transporter_name, transporter_mobile, driver_name, driver_mobile, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        cleanVehNo,
        vehicle_type || null,
        transporter_name || null,
        transporter_mobile || null,
        driver_name || null,
        driver_mobile || null,
        status,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      vehicleId: result.insertId,
      vehicleNumber: cleanVehNo,
    });
  } catch (error) {
    console.error("Create Vehicle Error:", error);
    res.status(500).json({ success: false, message: "Failed to create vehicle" });
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const {
      vehicle_number,
      vehicle_type,
      transporter_name,
      transporter_mobile,
      driver_name,
      driver_mobile,
      status,
    } = req.body;

    const [existing] = await db.promise().query(
      `SELECT * FROM plastic_vehicles WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Vehicle not found" });
    }

    const cleanVehNo = vehicle_number ? vehicle_number.trim().toUpperCase() : existing[0].vehicle_number;

    await db.promise().query(
      `UPDATE plastic_vehicles
       SET vehicle_number = ?,
           vehicle_type = COALESCE(?, vehicle_type),
           transporter_name = COALESCE(?, transporter_name),
           transporter_mobile = COALESCE(?, transporter_mobile),
           driver_name = COALESCE(?, driver_name),
           driver_mobile = COALESCE(?, driver_mobile),
           status = COALESCE(?, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [
        cleanVehNo,
        vehicle_type,
        transporter_name,
        transporter_mobile,
        driver_name,
        driver_mobile,
        status,
        id,
        companyId,
      ]
    );

    res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
    });
  } catch (error) {
    console.error("Update Vehicle Error:", error);
    res.status(500).json({ success: false, message: "Failed to update vehicle" });
  }
};

// ==========================================
// 2. DELIVERY CHALLAN MANAGEMENT
// ==========================================

const generateNextChallanNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT challan_no
     FROM plastic_delivery_challans
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    if (row.challan_no) {
      const match = String(row.challan_no).match(/^DC-(\d+)$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return `DC-${maxNum + 1}`;
};

exports.getNextChallanNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextChallanNo(companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next Challan No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate challan number" });
  }
};

exports.getChallans = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, customer_id, from_date, to_date } = req.query;

    let sql = `
      SELECT
        dc.*,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        d.dispatch_no,
        COUNT(dci.id) AS total_items,
        COALESCE(SUM(dci.quantity), 0) AS total_quantity
      FROM plastic_delivery_challans dc
      JOIN customers c ON dc.customer_id = c.id AND dc.company_id = c.company_id
      JOIN plastic_dispatches d ON dc.dispatch_id = d.id AND dc.company_id = d.company_id
      LEFT JOIN plastic_delivery_challan_items dci ON dc.id = dci.challan_id AND dc.company_id = dci.company_id
      WHERE dc.company_id = ?
    `;
    const params = [companyId];

    if (status) {
      sql += ` AND dc.status = ?`;
      params.push(status);
    }
    if (customer_id) {
      sql += ` AND dc.customer_id = ?`;
      params.push(customer_id);
    }
    if (from_date && to_date) {
      sql += ` AND dc.challan_date >= ? AND dc.challan_date <= ?`;
      params.push(from_date, to_date);
    }

    sql += ` GROUP BY dc.id ORDER BY dc.id DESC`;

    const [challans] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      challans,
    });
  } catch (error) {
    console.error("Get Challans Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch delivery challans" });
  }
};

exports.getChallanById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [challans] = await db.promise().query(
      `SELECT
        dc.*,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        c.email AS customer_email,
        c.address AS customer_address,
        d.dispatch_no,
        d.dispatch_date,
        so.sales_order_no
       FROM plastic_delivery_challans dc
       JOIN customers c ON dc.customer_id = c.id AND dc.company_id = c.company_id
       JOIN plastic_dispatches d ON dc.dispatch_id = d.id AND dc.company_id = d.company_id
       LEFT JOIN plastic_sales_orders so ON d.sales_order_id = so.id AND d.company_id = so.company_id
       WHERE dc.id = ? AND dc.company_id = ?`,
      [id, companyId]
    );

    if (challans.length === 0) {
      return res.status(404).json({ success: false, message: "Delivery challan not found" });
    }

    const [items] = await db.promise().query(
      `SELECT
        dci.*,
        fg.fg_name,
        fg.fg_code,
        fg.plastic_type,
        fgl.lot_number
       FROM plastic_delivery_challan_items dci
       JOIN plastic_finished_goods fg ON dci.finished_good_id = fg.id AND dci.company_id = fg.company_id
       LEFT JOIN plastic_finished_goods_lots fgl ON dci.lot_id = fgl.id AND dci.company_id = fgl.company_id
       WHERE dci.challan_id = ? AND dci.company_id = ?
       ORDER BY dci.id ASC`,
      [id, companyId]
    );

    const [settings] = await db.promise().query(
      `SELECT business_name, tagline, logo, address, phone, email, tax_number FROM business_settings WHERE company_id = ? LIMIT 1`,
      [companyId]
    );

    res.status(200).json({
      success: true,
      challan: {
        ...challans[0],
        items,
        business: settings[0] || null,
      },
    });
  } catch (error) {
    console.error("Get Challan Details Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch delivery challan details" });
  }
};

exports.createChallan = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      dispatch_id,
      challan_date = new Date().toISOString().split("T")[0],
      remarks,
    } = req.body;

    if (!dispatch_id) {
      return res.status(400).json({ success: false, message: "Dispatch ID is required" });
    }

    const [dispatches] = await conn.query(
      `SELECT * FROM plastic_dispatches WHERE id = ? AND company_id = ?`,
      [dispatch_id, companyId]
    );

    if (dispatches.length === 0) {
      return res.status(404).json({ success: false, message: "Dispatch not found" });
    }

    const dispatch = dispatches[0];

    // Check if challan already exists for this dispatch
    const [existingChallan] = await conn.query(
      `SELECT id, challan_no FROM plastic_delivery_challans WHERE dispatch_id = ? AND company_id = ?`,
      [dispatch_id, companyId]
    );

    if (existingChallan.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Delivery challan ${existingChallan[0].challan_no} already exists for this dispatch`,
        challanId: existingChallan[0].id,
      });
    }

    // Fetch dispatch items
    const [dispatchItems] = await conn.query(
      `SELECT * FROM plastic_dispatch_items WHERE dispatch_id = ? AND company_id = ?`,
      [dispatch_id, companyId]
    );

    if (dispatchItems.length === 0) {
      return res.status(400).json({ success: false, message: "Dispatch has no items" });
    }

    const challanNo = await generateNextChallanNo(companyId);

    await conn.beginTransaction();

    try {
      const [challanResult] = await conn.query(
        `INSERT INTO plastic_delivery_challans
          (company_id, challan_no, challan_date, customer_id, dispatch_id, vehicle_id, vehicle_number, transporter, destination, status, remarks, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED', ?, ?)`,
        [
          companyId,
          challanNo,
          challan_date,
          dispatch.customer_id,
          dispatch_id,
          dispatch.vehicle_id,
          dispatch.vehicle_number,
          dispatch.transporter,
          dispatch.destination,
          remarks || null,
          adminId,
        ]
      );

      const challanId = challanResult.insertId;

      for (const item of dispatchItems) {
        await conn.query(
          `INSERT INTO plastic_delivery_challan_items
            (company_id, challan_id, finished_good_id, lot_id, quantity, unit, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            challanId,
            item.finished_good_id,
            item.lot_id,
            item.quantity,
            item.unit,
            `Delivery for Dispatch ${dispatch.dispatch_no}`,
          ]
        );
      }

      await conn.commit();

      res.status(201).json({
        success: true,
        message: "Delivery challan generated successfully",
        challanId,
        challanNo,
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Create Delivery Challan Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate delivery challan" });
  }
};

exports.updateChallanStatus = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { status } = req.body;

    if (!["DRAFT", "ISSUED", "DELIVERED", "CANCELLED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid challan status" });
    }

    const [result] = await db.promise().query(
      `UPDATE plastic_delivery_challans
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [status, id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Delivery challan not found" });
    }

    res.status(200).json({
      success: true,
      message: `Challan status updated to ${status} successfully`,
      status,
    });
  } catch (error) {
    console.error("Update Challan Status Error:", error);
    res.status(500).json({ success: false, message: "Failed to update challan status" });
  }
};
