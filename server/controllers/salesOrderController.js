const db = require("../config/db");

const generateNextSalesOrderNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT sales_order_no
     FROM plastic_sales_orders
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    if (row.sales_order_no) {
      const match = String(row.sales_order_no).match(/^SO-(\d+)$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return `SO-${maxNum + 1}`;
};

exports.getNextSalesOrderNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextSalesOrderNo(companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next SO Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate sales order number" });
  }
};

exports.getSalesOrders = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, customer_id, from_date, to_date } = req.query;

    let sql = `
      SELECT
        so.*,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        c.email AS customer_email,
        COUNT(soi.id) AS total_items,
        COALESCE(SUM(soi.quantity), 0) AS total_ordered_qty,
        COALESCE(SUM(soi.reserved_quantity), 0) AS total_reserved_qty,
        COALESCE(SUM(soi.dispatched_quantity), 0) AS total_dispatched_qty
      FROM plastic_sales_orders so
      JOIN customers c ON so.customer_id = c.id AND so.company_id = c.company_id
      LEFT JOIN plastic_sales_order_items soi ON so.id = soi.sales_order_id AND so.company_id = soi.company_id
      WHERE so.company_id = ?
    `;
    const params = [companyId];

    if (status) {
      sql += ` AND so.status = ?`;
      params.push(status);
    }
    if (customer_id) {
      sql += ` AND so.customer_id = ?`;
      params.push(customer_id);
    }
    if (from_date && to_date) {
      sql += ` AND so.order_date >= ? AND so.order_date <= ?`;
      params.push(from_date, to_date);
    }

    sql += ` GROUP BY so.id ORDER BY so.id DESC`;

    const [orders] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("Get Sales Orders Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sales orders" });
  }
};

exports.getSalesOrderById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [orders] = await db.promise().query(
      `SELECT
        so.*,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        c.email AS customer_email,
        c.address AS customer_address
       FROM plastic_sales_orders so
       JOIN customers c ON so.customer_id = c.id AND so.company_id = c.company_id
       WHERE so.id = ? AND so.company_id = ?`,
      [id, companyId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: "Sales order not found" });
    }

    const [items] = await db.promise().query(
      `SELECT
        soi.*,
        fg.fg_name,
        fg.fg_code,
        fg.plastic_type,
        fg.current_stock AS fg_current_stock,
        fgl.lot_number
       FROM plastic_sales_order_items soi
       JOIN plastic_finished_goods fg ON soi.finished_good_id = fg.id AND soi.company_id = fg.company_id
       LEFT JOIN plastic_finished_goods_lots fgl ON soi.lot_id = fgl.id AND soi.company_id = fgl.company_id
       WHERE soi.sales_order_id = ? AND soi.company_id = ?
       ORDER BY soi.id ASC`,
      [id, companyId]
    );

    const [reservations] = await db.promise().query(
      `SELECT
        res.*,
        fg.fg_name,
        fg.fg_code
       FROM plastic_fg_reservations res
       JOIN plastic_finished_goods fg ON res.finished_good_id = fg.id AND res.company_id = fg.company_id
       WHERE res.sales_order_id = ? AND res.company_id = ?
       ORDER BY res.id ASC`,
      [id, companyId]
    );

    const [dispatches] = await db.promise().query(
      `SELECT
        d.id,
        d.dispatch_no,
        d.dispatch_date,
        d.status,
        d.transporter,
        d.vehicle_number
       FROM plastic_dispatches d
       WHERE d.sales_order_id = ? AND d.company_id = ?
       ORDER BY d.id DESC`,
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      order: {
        ...orders[0],
        items,
        reservations,
        dispatches,
      },
    });
  } catch (error) {
    console.error("Get Sales Order Details Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sales order details" });
  }
};

exports.createSalesOrder = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      customer_id,
      order_date = new Date().toISOString().split("T")[0],
      expected_delivery_date,
      items,
      notes,
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, message: "Customer is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one sales order item is required" });
    }

    // Verify customer belongs to company
    const [customers] = await conn.query(
      `SELECT id, name FROM customers WHERE id = ? AND company_id = ?`,
      [customer_id, companyId]
    );

    if (customers.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found or belongs to another company" });
    }

    // Validate items and calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const preparedItems = [];

    for (const itm of items) {
      const fgId = Number(itm.finished_good_id);
      const qty = Number(itm.quantity);
      const rate = Number(itm.rate) || 0;
      const discount = Number(itm.discount) || 0;
      const tax = Number(itm.tax) || 0;

      if (!fgId || !qty || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid finished good and positive quantity required for each item",
        });
      }

      const [fgs] = await conn.query(
        `SELECT id, fg_name, fg_code, unit, current_stock FROM plastic_finished_goods WHERE id = ? AND company_id = ?`,
        [fgId, companyId]
      );

      if (fgs.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Finished good ID ${fgId} not found or belongs to another company`,
        });
      }

      const lineSubtotal = qty * rate;
      const lineTotal = Math.max(0, lineSubtotal - discount + tax);

      subtotal += lineSubtotal;
      totalDiscount += discount;
      totalTax += tax;

      preparedItems.push({
        finished_good_id: fgId,
        lot_id: itm.lot_id ? Number(itm.lot_id) : null,
        quantity: qty,
        unit: itm.unit || fgs[0].unit || "KG",
        rate,
        discount,
        tax,
        line_total: lineTotal,
      });
    }

    const grandTotal = Math.max(0, subtotal - totalDiscount + totalTax);
    const soNo = await generateNextSalesOrderNo(companyId);

    await conn.beginTransaction();

    try {
      const [orderResult] = await conn.query(
        `INSERT INTO plastic_sales_orders
          (company_id, sales_order_no, customer_id, order_date, expected_delivery_date, status, subtotal, discount, tax, grand_total, notes, created_by)
         VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          soNo,
          customer_id,
          order_date,
          expected_delivery_date || null,
          subtotal,
          totalDiscount,
          totalTax,
          grandTotal,
          notes || null,
          adminId,
        ]
      );

      const soId = orderResult.insertId;

      for (const pItem of preparedItems) {
        await conn.query(
          `INSERT INTO plastic_sales_order_items
            (company_id, sales_order_id, finished_good_id, lot_id, quantity, reserved_quantity, dispatched_quantity, unit, rate, discount, tax, line_total)
           VALUES (?, ?, ?, ?, ?, 0.00, 0.00, ?, ?, ?, ?, ?)`,
          [
            companyId,
            soId,
            pItem.finished_good_id,
            pItem.lot_id,
            pItem.quantity,
            pItem.unit,
            pItem.rate,
            pItem.discount,
            pItem.tax,
            pItem.line_total,
          ]
        );
      }

      await conn.commit();

      res.status(201).json({
        success: true,
        message: "Sales order created successfully",
        orderId: soId,
        salesOrderNo: soNo,
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Create Sales Order Error:", error);
    res.status(500).json({ success: false, message: "Failed to create sales order" });
  }
};

exports.confirmSalesOrder = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [orders] = await conn.query(
      `SELECT * FROM plastic_sales_orders WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: "Sales order not found" });
    }

    const order = orders[0];
    if (order.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        message: `Order cannot be confirmed because it is currently '${order.status}'`,
      });
    }

    const [items] = await conn.query(
      `SELECT soi.*, fg.fg_name, fg.current_stock
       FROM plastic_sales_order_items soi
       JOIN plastic_finished_goods fg ON soi.finished_good_id = fg.id AND soi.company_id = fg.company_id
       WHERE soi.sales_order_id = ? AND soi.company_id = ?`,
      [id, companyId]
    );

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: "Sales order has no items to confirm" });
    }

    await conn.beginTransaction();

    try {
      for (const item of items) {
        const fgId = item.finished_good_id;
        const requestedQty = Number(item.quantity);

        // Lock FG stock and calculate available quantity
        const [fgRows] = await conn.query(
          `SELECT id, fg_name, current_stock FROM plastic_finished_goods WHERE id = ? AND company_id = ? FOR UPDATE`,
          [fgId, companyId]
        );
        const currentStock = Number(fgRows[0]?.current_stock) || 0;

        const [resRows] = await conn.query(
          `SELECT COALESCE(SUM(reserved_quantity), 0) AS total_reserved
           FROM plastic_fg_reservations
           WHERE company_id = ? AND finished_good_id = ? AND status = 'ACTIVE'
           FOR UPDATE`,
          [companyId, fgId]
        );
        const alreadyReserved = Number(resRows[0]?.total_reserved) || 0;
        const availableToReserve = currentStock - alreadyReserved;

        if (requestedQty > availableToReserve) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: `Insufficient available stock to reserve for '${item.fg_name}'. Current stock: ${currentStock} ${item.unit}, Reserved: ${alreadyReserved} ${item.unit}, Available: ${availableToReserve} ${item.unit}, Requested: ${requestedQty} ${item.unit}.`,
          });
        }

        // Create reservation record
        await conn.query(
          `INSERT INTO plastic_fg_reservations
            (company_id, sales_order_id, sales_order_item_id, finished_good_id, lot_id, reserved_quantity, status)
           VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
          [companyId, id, item.id, fgId, item.lot_id, requestedQty]
        );

        // Update sales order item reserved_quantity
        await conn.query(
          `UPDATE plastic_sales_order_items
           SET reserved_quantity = ?
           WHERE id = ? AND company_id = ?`,
          [requestedQty, item.id, companyId]
        );
      }

      await conn.query(
        `UPDATE plastic_sales_orders
         SET status = 'RESERVED', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND company_id = ?`,
        [id, companyId]
      );

      await conn.commit();

      res.status(200).json({
        success: true,
        message: "Sales order confirmed and finished goods stock reserved successfully",
        orderId: id,
        status: "RESERVED",
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Confirm Sales Order Error:", error);
    res.status(500).json({ success: false, message: "Failed to confirm sales order" });
  }
};

exports.cancelSalesOrder = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [orders] = await conn.query(
      `SELECT * FROM plastic_sales_orders WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: "Sales order not found" });
    }

    const order = orders[0];
    if (["DISPATCHED", "COMPLETED", "CANCELLED"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled because its status is '${order.status}'`,
      });
    }

    await conn.beginTransaction();

    try {
      // 1. Release all active reservations
      await conn.query(
        `UPDATE plastic_fg_reservations
         SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP
         WHERE sales_order_id = ? AND company_id = ? AND status = 'ACTIVE'`,
        [id, companyId]
      );

      // 2. Reset reserved_quantity on items
      await conn.query(
        `UPDATE plastic_sales_order_items
         SET reserved_quantity = 0.00
         WHERE sales_order_id = ? AND company_id = ?`,
        [id, companyId]
      );

      // 3. Mark sales order as CANCELLED
      await conn.query(
        `UPDATE plastic_sales_orders
         SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND company_id = ?`,
        [id, companyId]
      );

      await conn.commit();

      res.status(200).json({
        success: true,
        message: "Sales order cancelled and reserved stock released successfully",
        orderId: id,
        status: "CANCELLED",
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Cancel Sales Order Error:", error);
    res.status(500).json({ success: false, message: "Failed to cancel sales order" });
  }
};

exports.getReservations = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [reservations] = await db.promise().query(
      `SELECT
        r.*,
        fg.fg_name,
        fg.fg_code,
        fg.current_stock,
        so.sales_order_no,
        so.order_date,
        c.name AS customer_name
       FROM plastic_fg_reservations r
       JOIN plastic_finished_goods fg ON r.finished_good_id = fg.id AND r.company_id = fg.company_id
       JOIN plastic_sales_orders so ON r.sales_order_id = so.id AND r.company_id = so.company_id
       JOIN customers c ON so.customer_id = c.id AND so.company_id = c.company_id
       WHERE r.company_id = ? AND r.status = 'ACTIVE'
       ORDER BY r.reserved_at DESC`,
      [companyId]
    );

    res.status(200).json({
      success: true,
      reservations,
    });
  } catch (error) {
    console.error("Get Reservations Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stock reservations" });
  }
};
