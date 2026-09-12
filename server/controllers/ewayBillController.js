const db = require("../config/db");

/**
 * Generate next sequential internal reference number per company: EWB-DRAFT-000001
 */
const generateNextSequentialEwbNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT ewb_number
     FROM internal_eway_bills
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  let maxSequentialNumber = 0;

  for (const row of rows) {
    if (row.ewb_number) {
      const match = String(row.ewb_number).trim().match(/^EWB-DRAFT-(\d{1,6})$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxSequentialNumber) {
          maxSequentialNumber = num;
        }
      }
    }
  }

  const nextNumber = maxSequentialNumber + 1;
  return `EWB-DRAFT-${String(nextNumber).padStart(6, "0")}`;
};

/**
 * GET /api/plastic-erp/eway-bills/next-no
 */
exports.getNextEwbNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextSequentialEwbNo(companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next EWB No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate next E-Way Bill reference" });
  }
};

/**
 * GET /api/plastic-erp/eway-bills/kpi
 */
exports.getEWayBillKPIs = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [rows] = await db.promise().query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) as draft_count,
         SUM(CASE WHEN status = 'READY_FOR_DISPATCH' THEN 1 ELSE 0 END) as ready_count,
         SUM(CASE WHEN status = 'DISPATCHED' THEN 1 ELSE 0 END) as dispatched_count,
         SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
         SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count,
         COALESCE(SUM(total_amount), 0) as total_value,
         COALESCE(SUM(total_weight_kg), 0) as total_weight
       FROM internal_eway_bills
       WHERE company_id = ?`,
      [companyId]
    );

    const stats = rows[0] || {};
    res.status(200).json({
      success: true,
      kpis: {
        total: Number(stats.total) || 0,
        draft: Number(stats.draft_count) || 0,
        ready: Number(stats.ready_count) || 0,
        dispatched: Number(stats.dispatched_count) || 0,
        completed: Number(stats.completed_count) || 0,
        cancelled: Number(stats.cancelled_count) || 0,
        totalValue: Number(stats.total_value) || 0,
        totalWeight: Number(stats.total_weight) || 0,
      },
    });
  } catch (error) {
    console.error("Get EWB KPIs Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch E-Way Bill metrics" });
  }
};

/**
 * GET /api/plastic-erp/eway-bills/source-data?invoice_id=...&dispatch_id=...
 * Auto-extracts existing data from Invoice or Dispatch without duplicating inputs
 */
exports.getSourceData = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { invoice_id, dispatch_id } = req.query;

    if (!invoice_id && !dispatch_id) {
      return res.status(400).json({
        success: false,
        message: "Either invoice_id or dispatch_id is required to fetch source data",
      });
    }

    const conn = db.promise();

    // 1. Fetch Company Business Settings for Dispatch From information
    const [settingsRows] = await conn.query(
      `SELECT business_name, address, tax_number, phone, email, default_tax_percent, tax_enabled
       FROM business_settings
       WHERE company_id = ? LIMIT 1`,
      [companyId]
    );
    const settings = settingsRows[0] || {};

    let sourceInfo = {
      dispatch_from_name: settings.business_name || "SmartBilling Plant",
      dispatch_from_gstin: settings.tax_number || "",
      dispatch_from_address: settings.address || "",
      transport_mode: "ROAD",
      vehicle_type: "REGULAR",
      dispatch_date: new Date().toISOString().split("T")[0],
      items: [],
    };

    // Case A: From Invoice
    if (invoice_id) {
      const [invRows] = await conn.query(
        `SELECT i.*, c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email, c.address AS customer_address
         FROM invoices i
         LEFT JOIN customers c ON i.customer_id = c.id
         WHERE i.id = ? AND i.company_id = ?`,
        [invoice_id, companyId]
      );

      if (invRows.length === 0) {
        return res.status(404).json({ success: false, message: "Invoice not found" });
      }

      const inv = invRows[0];
      const [invItems] = await conn.query(
        `SELECT * FROM invoice_items WHERE invoice_id = ? AND company_id = ?`,
        [invoice_id, companyId]
      );

      // If linked to dispatch, fetch dispatch transport details
      let linkedDispatch = null;
      if (inv.dispatch_id) {
        const [dispRows] = await conn.query(
          `SELECT * FROM plastic_dispatches WHERE id = ? AND company_id = ?`,
          [inv.dispatch_id, companyId]
        );
        if (dispRows.length > 0) linkedDispatch = dispRows[0];
      }

      sourceInfo = {
        ...sourceInfo,
        invoice_id: inv.id,
        invoice_no: inv.invoice_no,
        invoice_date: inv.created_at ? new Date(inv.created_at).toISOString().split("T")[0] : sourceInfo.dispatch_date,
        dispatch_id: linkedDispatch ? linkedDispatch.id : null,
        dispatch_no: linkedDispatch ? linkedDispatch.dispatch_no : "",
        customer_id: inv.customer_id,
        customer_name: inv.customer_name || "",
        customer_phone: inv.customer_mobile || "",
        customer_email: inv.customer_email || "",
        billing_address: inv.customer_address || "",
        shipping_address: inv.customer_address || "",
        transporter_name: linkedDispatch ? linkedDispatch.transporter : "",
        vehicle_id: linkedDispatch ? linkedDispatch.vehicle_id : null,
        vehicle_number: linkedDispatch ? linkedDispatch.vehicle_number : "",
        driver_name: linkedDispatch ? linkedDispatch.driver_name : "",
        driver_mobile: linkedDispatch ? linkedDispatch.driver_mobile : "",
        items: invItems.map((item) => {
          const qty = Number(item.quantity) || 0;
          const rate = Number(item.price) || 0;
          const lineTotal = Number(item.total) || qty * rate;
          const taxPct = Number(inv.tax_percent) || 18;
          const taxAmt = (lineTotal * taxPct) / 100;
          return {
            product_id: item.product_id,
            product_name: item.product_name,
            hsn_code: "3915",
            quantity: qty,
            unit: "KG",
            rate: rate,
            taxable_amount: lineTotal,
            tax_percent: taxPct,
            tax_amount: taxAmt,
            total_amount: lineTotal + taxAmt,
            weight_kg: qty, // Default 1:1 for plastic granules/scrap in KG
          };
        }),
      };
    }

    // Case B: From Dispatch
    else if (dispatch_id) {
      const [dispRows] = await conn.query(
        `SELECT d.*, c.name AS customer_name, c.mobile AS customer_mobile, c.email AS customer_email, c.address AS customer_address,
                inv.id AS linked_inv_id, inv.invoice_no AS linked_inv_no, inv.created_at AS linked_inv_date, inv.tax_percent AS inv_tax_percent
         FROM plastic_dispatches d
         LEFT JOIN customers c ON d.customer_id = c.id
         LEFT JOIN invoices inv ON d.id = inv.dispatch_id AND d.company_id = inv.company_id
         WHERE d.id = ? AND d.company_id = ?`,
        [dispatch_id, companyId]
      );

      if (dispRows.length === 0) {
        return res.status(404).json({ success: false, message: "Dispatch not found" });
      }

      const disp = dispRows[0];
      const [dispItems] = await conn.query(
        `SELECT di.*, fg.fg_name, fg.fg_code, fg.unit AS fg_unit
         FROM plastic_dispatch_items di
         JOIN plastic_finished_goods fg ON di.finished_good_id = fg.id AND di.company_id = fg.company_id
         WHERE di.dispatch_id = ? AND di.company_id = ?`,
        [dispatch_id, companyId]
      );

      sourceInfo = {
        ...sourceInfo,
        dispatch_id: disp.id,
        dispatch_no: disp.dispatch_no,
        dispatch_date: disp.dispatch_date ? new Date(disp.dispatch_date).toISOString().split("T")[0] : sourceInfo.dispatch_date,
        invoice_id: disp.linked_inv_id || null,
        invoice_no: disp.linked_inv_no || "",
        invoice_date: disp.linked_inv_date ? new Date(disp.linked_inv_date).toISOString().split("T")[0] : null,
        customer_id: disp.customer_id,
        customer_name: disp.customer_name || "",
        customer_phone: disp.customer_mobile || "",
        customer_email: disp.customer_email || "",
        billing_address: disp.customer_address || "",
        shipping_address: disp.destination || disp.customer_address || "",
        transporter_name: disp.transporter || "",
        vehicle_id: disp.vehicle_id || null,
        vehicle_number: disp.vehicle_number || "",
        driver_name: disp.driver_name || "",
        driver_mobile: disp.driver_mobile || "",
        items: dispItems.map((item) => {
          const qty = Number(item.quantity) || 0;
          const rate = Number(item.rate) || 0;
          const taxable = qty * rate;
          const taxPct = Number(disp.inv_tax_percent) || 18;
          const taxAmt = (taxable * taxPct) / 100;
          return {
            product_id: item.finished_good_id,
            product_name: `${item.fg_name}${item.fg_code ? ` (${item.fg_code})` : ""}`,
            hsn_code: "3915",
            quantity: qty,
            unit: item.fg_unit || item.unit || "KG",
            rate: rate,
            taxable_amount: taxable,
            tax_percent: taxPct,
            tax_amount: taxAmt,
            total_amount: taxable + taxAmt,
            weight_kg: qty,
          };
        }),
      };
    }

    res.status(200).json({ success: true, sourceData: sourceInfo });
  } catch (error) {
    console.error("Get Source Data Error:", error);
    res.status(500).json({ success: false, message: "Failed to extract source data for E-Way Bill" });
  }
};

/**
 * GET /api/plastic-erp/eway-bills
 */
exports.getEWayBills = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { search, status, customer_id, from_date, to_date } = req.query;

    let sql = `
      SELECT e.*, c.name AS cust_name
      FROM internal_eway_bills e
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.company_id = ?
    `;
    const params = [companyId];

    if (status && status.trim()) {
      sql += ` AND e.status = ?`;
      params.push(status.trim());
    }

    if (customer_id) {
      sql += ` AND e.customer_id = ?`;
      params.push(Number(customer_id));
    }

    if (from_date) {
      sql += ` AND e.dispatch_date >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      sql += ` AND e.dispatch_date <= ?`;
      params.push(to_date);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += ` AND (
        e.ewb_number LIKE ? OR
        e.invoice_no LIKE ? OR
        e.dispatch_no LIKE ? OR
        e.customer_name LIKE ? OR
        e.vehicle_number LIKE ? OR
        e.transporter_name LIKE ? OR
        e.driver_name LIKE ?
      )`;
      params.push(q, q, q, q, q, q, q);
    }

    sql += ` ORDER BY e.id DESC`;

    const [rows] = await db.promise().query(sql, params);

    if (rows.length > 0) {
      const billIds = rows.map((r) => r.id);
      const [items] = await db.promise().query(
        `SELECT * FROM internal_eway_bill_items
         WHERE eway_bill_id IN (?) AND company_id = ?
         ORDER BY id ASC`,
        [billIds, companyId]
      );
      const itemsMap = {};
      for (const it of items) {
        if (!itemsMap[it.eway_bill_id]) itemsMap[it.eway_bill_id] = [];
        itemsMap[it.eway_bill_id].push(it);
      }
      for (const row of rows) {
        row.items = itemsMap[row.id] || [];
      }
    }

    res.status(200).json({ success: true, ewayBills: rows });
  } catch (error) {
    console.error("Get EWayBills Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch Internal E-Way Bills" });
  }
};

/**
 * GET /api/plastic-erp/eway-bills/:id
 */
exports.getEWayBillById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [bills] = await db.promise().query(
      `SELECT e.*
       FROM internal_eway_bills e
       WHERE e.id = ? AND e.company_id = ?`,
      [id, companyId]
    );

    if (bills.length === 0) {
      return res.status(404).json({ success: false, message: "Internal E-Way Bill not found" });
    }

    const bill = bills[0];

    const [items] = await db.promise().query(
      `SELECT * FROM internal_eway_bill_items
       WHERE eway_bill_id = ? AND company_id = ?
       ORDER BY id ASC`,
      [id, companyId]
    );

    const [settingsRows] = await db.promise().query(
      `SELECT * FROM business_settings WHERE company_id = ? LIMIT 1`,
      [companyId]
    );

    res.status(200).json({
      success: true,
      ewayBill: {
        ...bill,
        items,
        companySettings: settingsRows[0] || null,
      },
    });
  } catch (error) {
    console.error("Get EWayBill By Id Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch Internal E-Way Bill details" });
  }
};

/**
 * POST /api/plastic-erp/eway-bills
 */
exports.createEWayBill = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;

    const {
      invoice_id,
      invoice_no,
      invoice_date,
      dispatch_id,
      dispatch_no,
      customer_id,
      customer_name,
      customer_gstin,
      customer_phone,
      customer_email,
      billing_address,
      shipping_address,
      dispatch_from_name,
      dispatch_from_gstin,
      dispatch_from_address,
      transport_mode = "ROAD",
      distance_km = 0,
      transporter_name,
      transporter_id,
      vehicle_id,
      vehicle_number,
      vehicle_type = "REGULAR",
      driver_name,
      driver_mobile,
      dispatch_date = new Date().toISOString().split("T")[0],
      status = "DRAFT",
      notes,
      items,
    } = req.body;

    if (!customer_name || !String(customer_name).trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one item is required in the E-Way Bill" });
    }

    if (!vehicle_number || !String(vehicle_number).trim()) {
      return res.status(400).json({ success: false, message: "Vehicle number is required for transport documentation" });
    }

    // Auto-generate internal reference number
    const ewbNumber = await generateNextSequentialEwbNo(companyId);

    // Compute totals
    let totalTaxable = 0;
    let totalTax = 0;
    let grandTotal = 0;
    let totalWeight = 0;

    const preparedItems = items.map((item) => {
      const qty = Math.max(0, Number(item.quantity) || 0);
      const rate = Math.max(0, Number(item.rate) || 0);
      const taxable = item.taxable_amount !== undefined && item.taxable_amount !== null
        ? Number(item.taxable_amount)
        : qty * rate;
      const taxPct = Number(item.tax_percent) || 18;
      const taxAmt = item.tax_amount !== undefined && item.tax_amount !== null
        ? Number(item.tax_amount)
        : (taxable * taxPct) / 100;
      const total = item.total_amount !== undefined && item.total_amount !== null
        ? Number(item.total_amount)
        : taxable + taxAmt;
      const weight = Math.max(0, Number(item.weight_kg) || qty);

      totalTaxable += taxable;
      totalTax += taxAmt;
      grandTotal += total;
      totalWeight += weight;

      return {
        product_id: item.product_id ? Number(item.product_id) : null,
        product_name: String(item.product_name || "Plastic Goods").trim(),
        hsn_code: String(item.hsn_code || "3915").trim(),
        quantity: qty,
        unit: String(item.unit || "KG").trim().toUpperCase(),
        rate,
        taxable_amount: taxable,
        tax_percent: taxPct,
        tax_amount: taxAmt,
        total_amount: total,
        weight_kg: weight,
      };
    });

    await conn.beginTransaction();

    const [insertResult] = await conn.query(
      `INSERT INTO internal_eway_bills (
        company_id, ewb_number, invoice_id, invoice_no, invoice_date,
        dispatch_id, dispatch_no, customer_id, customer_name, customer_gstin,
        customer_phone, customer_email, billing_address, shipping_address,
        dispatch_from_name, dispatch_from_gstin, dispatch_from_address,
        transport_mode, distance_km, transporter_name, transporter_id,
        vehicle_id, vehicle_number, vehicle_type, driver_name, driver_mobile,
        dispatch_date, status, total_taxable_amount, total_tax_amount,
        total_amount, total_weight_kg, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        ewbNumber,
        invoice_id ? Number(invoice_id) : null,
        invoice_no ? String(invoice_no).trim() : null,
        invoice_date || null,
        dispatch_id ? Number(dispatch_id) : null,
        dispatch_no ? String(dispatch_no).trim() : null,
        customer_id ? Number(customer_id) : null,
        String(customer_name).trim(),
        customer_gstin ? String(customer_gstin).trim() : null,
        customer_phone ? String(customer_phone).trim() : null,
        customer_email ? String(customer_email).trim() : null,
        billing_address ? String(billing_address).trim() : null,
        shipping_address ? String(shipping_address).trim() : null,
        dispatch_from_name ? String(dispatch_from_name).trim() : null,
        dispatch_from_gstin ? String(dispatch_from_gstin).trim() : null,
        dispatch_from_address ? String(dispatch_from_address).trim() : null,
        String(transport_mode).trim().toUpperCase(),
        Math.max(0, Number(distance_km) || 0),
        transporter_name ? String(transporter_name).trim() : null,
        transporter_id ? String(transporter_id).trim() : null,
        vehicle_id ? Number(vehicle_id) : null,
        String(vehicle_number).trim().toUpperCase(),
        String(vehicle_type).trim().toUpperCase(),
        driver_name ? String(driver_name).trim() : null,
        driver_mobile ? String(driver_mobile).trim() : null,
        dispatch_date,
        ["DRAFT", "READY_FOR_DISPATCH", "DISPATCHED", "COMPLETED", "CANCELLED"].includes(status) ? status : "DRAFT",
        totalTaxable,
        totalTax,
        grandTotal,
        totalWeight,
        notes ? String(notes).trim() : null,
        adminId,
      ]
    );

    const ewbId = insertResult.insertId;

    for (const it of preparedItems) {
      await conn.query(
        `INSERT INTO internal_eway_bill_items (
          company_id, eway_bill_id, product_id, product_name, hsn_code,
          quantity, unit, rate, taxable_amount, tax_percent, tax_amount,
          total_amount, weight_kg
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          ewbId,
          it.product_id,
          it.product_name,
          it.hsn_code,
          it.quantity,
          it.unit,
          it.rate,
          it.taxable_amount,
          it.tax_percent,
          it.tax_amount,
          it.total_amount,
          it.weight_kg,
        ]
      );
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: `Internal E-Way Bill ${ewbNumber} created successfully`,
      ewayBill: {
        id: ewbId,
        ewb_number: ewbNumber,
        status,
        grand_total: grandTotal,
      },
    });
  } catch (error) {
    await conn.rollback();
    console.error("Create EWayBill Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create Internal E-Way Bill" });
  }
};

/**
 * PUT /api/plastic-erp/eway-bills/:id
 */
exports.updateEWayBill = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [existing] = await conn.query(
      `SELECT * FROM internal_eway_bills WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Internal E-Way Bill not found" });
    }

    const currentBill = existing[0];
    if (["COMPLETED", "CANCELLED"].includes(currentBill.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot edit an E-Way Bill in '${currentBill.status}' status`,
      });
    }

    const {
      transport_mode,
      distance_km,
      transporter_name,
      transporter_id,
      vehicle_id,
      vehicle_number,
      vehicle_type,
      driver_name,
      driver_mobile,
      dispatch_date,
      shipping_address,
      billing_address,
      notes,
      items,
    } = req.body;

    let totalTaxable = 0;
    let totalTax = 0;
    let grandTotal = 0;
    let totalWeight = 0;

    let preparedItems = null;
    if (Array.isArray(items) && items.length > 0) {
      preparedItems = items.map((item) => {
        const qty = Math.max(0, Number(item.quantity) || 0);
        const rate = Math.max(0, Number(item.rate) || 0);
        const taxable = item.taxable_amount !== undefined ? Number(item.taxable_amount) : qty * rate;
        const taxPct = Number(item.tax_percent) || 18;
        const taxAmt = item.tax_amount !== undefined ? Number(item.tax_amount) : (taxable * taxPct) / 100;
        const total = item.total_amount !== undefined ? Number(item.total_amount) : taxable + taxAmt;
        const weight = Math.max(0, Number(item.weight_kg) || qty);

        totalTaxable += taxable;
        totalTax += taxAmt;
        grandTotal += total;
        totalWeight += weight;

        return {
          product_id: item.product_id ? Number(item.product_id) : null,
          product_name: String(item.product_name || "Plastic Goods").trim(),
          hsn_code: String(item.hsn_code || "3915").trim(),
          quantity: qty,
          unit: String(item.unit || "KG").trim().toUpperCase(),
          rate,
          taxable_amount: taxable,
          tax_percent: taxPct,
          tax_amount: taxAmt,
          total_amount: total,
          weight_kg: weight,
        };
      });
    }

    await conn.beginTransaction();

    await conn.query(
      `UPDATE internal_eway_bills SET
        transport_mode = COALESCE(?, transport_mode),
        distance_km = COALESCE(?, distance_km),
        transporter_name = COALESCE(?, transporter_name),
        transporter_id = COALESCE(?, transporter_id),
        vehicle_id = COALESCE(?, vehicle_id),
        vehicle_number = COALESCE(?, vehicle_number),
        vehicle_type = COALESCE(?, vehicle_type),
        driver_name = COALESCE(?, driver_name),
        driver_mobile = COALESCE(?, driver_mobile),
        dispatch_date = COALESCE(?, dispatch_date),
        shipping_address = COALESCE(?, shipping_address),
        billing_address = COALESCE(?, billing_address),
        notes = COALESCE(?, notes),
        total_taxable_amount = CASE WHEN ? IS NOT NULL THEN ? ELSE total_taxable_amount END,
        total_tax_amount = CASE WHEN ? IS NOT NULL THEN ? ELSE total_tax_amount END,
        total_amount = CASE WHEN ? IS NOT NULL THEN ? ELSE total_amount END,
        total_weight_kg = CASE WHEN ? IS NOT NULL THEN ? ELSE total_weight_kg END
       WHERE id = ? AND company_id = ?`,
      [
        transport_mode ? String(transport_mode).trim().toUpperCase() : null,
        distance_km !== undefined ? Math.max(0, Number(distance_km) || 0) : null,
        transporter_name !== undefined ? String(transporter_name).trim() : null,
        transporter_id !== undefined ? String(transporter_id).trim() : null,
        vehicle_id !== undefined ? (vehicle_id ? Number(vehicle_id) : null) : null,
        vehicle_number ? String(vehicle_number).trim().toUpperCase() : null,
        vehicle_type ? String(vehicle_type).trim().toUpperCase() : null,
        driver_name !== undefined ? String(driver_name).trim() : null,
        driver_mobile !== undefined ? String(driver_mobile).trim() : null,
        dispatch_date || null,
        shipping_address !== undefined ? String(shipping_address).trim() : null,
        billing_address !== undefined ? String(billing_address).trim() : null,
        notes !== undefined ? String(notes).trim() : null,
        preparedItems ? 1 : null,
        totalTaxable,
        preparedItems ? 1 : null,
        totalTax,
        preparedItems ? 1 : null,
        grandTotal,
        preparedItems ? 1 : null,
        totalWeight,
        id,
        companyId,
      ]
    );

    if (preparedItems) {
      await conn.query(`DELETE FROM internal_eway_bill_items WHERE eway_bill_id = ? AND company_id = ?`, [id, companyId]);
      for (const it of preparedItems) {
        await conn.query(
          `INSERT INTO internal_eway_bill_items (
            company_id, eway_bill_id, product_id, product_name, hsn_code,
            quantity, unit, rate, taxable_amount, tax_percent, tax_amount,
            total_amount, weight_kg
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            id,
            it.product_id,
            it.product_name,
            it.hsn_code,
            it.quantity,
            it.unit,
            it.rate,
            it.taxable_amount,
            it.tax_percent,
            it.tax_amount,
            it.total_amount,
            it.weight_kg,
          ]
        );
      }
    }

    await conn.commit();

    res.status(200).json({
      success: true,
      message: "Internal E-Way Bill updated successfully",
    });
  } catch (error) {
    await conn.rollback();
    console.error("Update EWayBill Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to update Internal E-Way Bill" });
  }
};

/**
 * PATCH /api/plastic-erp/eway-bills/:id/status
 * Validates logical state transitions:
 * DRAFT -> READY_FOR_DISPATCH -> DISPATCHED -> COMPLETED
 * Any active state -> CANCELLED
 */
exports.updateStatus = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["DRAFT", "READY_FOR_DISPATCH", "DISPATCHED", "COMPLETED", "CANCELLED"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status '${status}'. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const [bills] = await db.promise().query(
      `SELECT id, ewb_number, status FROM internal_eway_bills WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (bills.length === 0) {
      return res.status(404).json({ success: false, message: "Internal E-Way Bill not found" });
    }

    const current = bills[0].status;

    // Allowed transition mapping
    const allowedTransitions = {
      DRAFT: ["READY_FOR_DISPATCH", "CANCELLED"],
      READY_FOR_DISPATCH: ["DISPATCHED", "DRAFT", "CANCELLED"],
      DISPATCHED: ["COMPLETED", "CANCELLED"],
      COMPLETED: [], // Terminal state
      CANCELLED: [], // Terminal state
    };

    if (current === status) {
      return res.status(200).json({ success: true, message: `Status is already ${status}`, status });
    }

    if (!allowedTransitions[current]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${current}' to '${status}'.`,
      });
    }

    await db.promise().query(
      `UPDATE internal_eway_bills SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
      [status, id, companyId]
    );

    res.status(200).json({
      success: true,
      message: `Internal E-Way Bill status updated to ${status}`,
      status,
    });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ success: false, message: "Failed to update E-Way Bill status" });
  }
};

/**
 * DELETE /api/plastic-erp/eway-bills/:id
 * Only allowed if status is DRAFT
 */
exports.deleteEWayBill = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [bills] = await conn.query(
      `SELECT id, ewb_number, status FROM internal_eway_bills WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (bills.length === 0) {
      return res.status(404).json({ success: false, message: "Internal E-Way Bill not found" });
    }

    if (bills[0].status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: `Only DRAFT E-Way Bills can be deleted. Current status is '${bills[0].status}'. Use Cancel instead.`,
      });
    }

    await conn.beginTransaction();
    await conn.query(`DELETE FROM internal_eway_bill_items WHERE eway_bill_id = ? AND company_id = ?`, [id, companyId]);
    await conn.query(`DELETE FROM internal_eway_bills WHERE id = ? AND company_id = ?`, [id, companyId]);
    await conn.commit();

    res.status(200).json({
      success: true,
      message: `Draft E-Way Bill ${bills[0].ewb_number} deleted successfully`,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Delete EWayBill Error:", error);
    res.status(500).json({ success: false, message: "Failed to delete Internal E-Way Bill" });
  }
};
