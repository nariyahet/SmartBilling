const db = require("../config/db");
const { recordLedgerEntry } = require("../utils/ledgerHelper");

const generateNextDispatchNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT dispatch_no
     FROM plastic_dispatches
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    if (row.dispatch_no) {
      const match = String(row.dispatch_no).match(/^DSP-(\d+)$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return `DSP-${maxNum + 1}`;
};

const generateNextSequentialInvoiceNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT invoice_no
     FROM invoices
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  let maxSequentialNumber = 1000;
  let foundSequential = false;

  for (const row of rows) {
    if (row.invoice_no) {
      const match = String(row.invoice_no).trim().match(/^INV-(\d{1,6})$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxSequentialNumber) {
          maxSequentialNumber = num;
          foundSequential = true;
        }
      }
    }
  }

  const nextNumber = foundSequential ? maxSequentialNumber + 1 : 1001;
  return `INV-${nextNumber}`;
};

exports.getNextDispatchNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextDispatchNo(companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next Dispatch No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate dispatch number" });
  }
};

exports.getDispatches = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, customer_id, from_date, to_date } = req.query;

    let sql = `
      SELECT
        d.*,
        MAX(c.name) AS customer_name,
        MAX(c.mobile) AS customer_mobile,
        MAX(so.sales_order_no) AS sales_order_no,
        COUNT(di.id) AS total_items,
        COALESCE(SUM(di.quantity), 0) AS total_dispatched_qty,
        MAX(inv.id) AS invoice_id,
        MAX(inv.invoice_no) AS invoice_no,
        MAX(inv.grand_total) AS invoice_grand_total,
        MAX(inv.payment_status) AS invoice_payment_status,
        MAX(dc.id) AS challan_id,
        MAX(dc.challan_no) AS challan_no
      FROM plastic_dispatches d
      JOIN customers c ON d.customer_id = c.id AND d.company_id = c.company_id
      LEFT JOIN plastic_sales_orders so ON d.sales_order_id = so.id AND d.company_id = so.company_id
      LEFT JOIN plastic_dispatch_items di ON d.id = di.dispatch_id AND d.company_id = di.company_id
      LEFT JOIN invoices inv ON d.id = inv.dispatch_id AND d.company_id = inv.company_id
      LEFT JOIN plastic_delivery_challans dc ON d.id = dc.dispatch_id AND d.company_id = dc.company_id
      WHERE d.company_id = ?
    `;
    const params = [companyId];

    if (status) {
      sql += ` AND d.status = ?`;
      params.push(status);
    }
    if (customer_id) {
      sql += ` AND d.customer_id = ?`;
      params.push(customer_id);
    }
    if (from_date && to_date) {
      sql += ` AND d.dispatch_date >= ? AND d.dispatch_date <= ?`;
      params.push(from_date, to_date);
    }

    sql += ` GROUP BY d.id ORDER BY d.id DESC`;

    const [dispatches] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      dispatches,
    });
  } catch (error) {
    console.error("Get Dispatches Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch dispatches" });
  }
};

exports.getDispatchById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [dispatches] = await db.promise().query(
      `SELECT
        d.*,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        c.email AS customer_email,
        c.address AS customer_address,
        so.sales_order_no,
        so.order_date AS sales_order_date,
        v.vehicle_number AS registered_vehicle_no,
        v.transporter_name AS registered_transporter,
        inv.id AS invoice_id,
        inv.invoice_no,
        inv.payment_status AS invoice_payment_status,
        dc.id AS challan_id,
        dc.challan_no,
        dc.status AS challan_status
       FROM plastic_dispatches d
       JOIN customers c ON d.customer_id = c.id AND d.company_id = c.company_id
       LEFT JOIN plastic_sales_orders so ON d.sales_order_id = so.id AND d.company_id = so.company_id
       LEFT JOIN plastic_vehicles v ON d.vehicle_id = v.id AND d.company_id = v.company_id
       LEFT JOIN invoices inv ON d.id = inv.dispatch_id AND d.company_id = inv.company_id
       LEFT JOIN plastic_delivery_challans dc ON d.id = dc.dispatch_id AND d.company_id = dc.company_id
       WHERE d.id = ? AND d.company_id = ?`,
      [id, companyId]
    );

    if (dispatches.length === 0) {
      return res.status(404).json({ success: false, message: "Dispatch not found" });
    }

    const [items] = await db.promise().query(
      `SELECT
        di.*,
        fg.fg_name,
        fg.fg_code,
        fg.plastic_type,
        fg.current_stock AS fg_current_stock,
        fgl.lot_number
       FROM plastic_dispatch_items di
       JOIN plastic_finished_goods fg ON di.finished_good_id = fg.id AND di.company_id = fg.company_id
       LEFT JOIN plastic_finished_goods_lots fgl ON di.lot_id = fgl.id AND di.company_id = fgl.company_id
       WHERE di.dispatch_id = ? AND di.company_id = ?
       ORDER BY di.id ASC`,
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      dispatch: {
        ...dispatches[0],
        items,
      },
    });
  } catch (error) {
    console.error("Get Dispatch Details Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch dispatch details" });
  }
};

exports.createDispatch = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      customer_id,
      sales_order_id,
      vehicle_id,
      vehicle_number,
      driver_name,
      driver_mobile,
      transporter,
      destination,
      dispatch_date = new Date().toISOString().split("T")[0],
      items,
      notes,
      auto_dispatch = false, // If true, immediately perform stock deduction in the same transaction
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, message: "Customer is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one dispatch item is required" });
    }

    // Verify customer belongs to company
    const [customers] = await conn.query(
      `SELECT id, name FROM customers WHERE id = ? AND company_id = ?`,
      [customer_id, companyId]
    );
    if (customers.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found or belongs to another company" });
    }

    // If sales order provided, verify
    if (sales_order_id) {
      const [soRows] = await conn.query(
        `SELECT id, status FROM plastic_sales_orders WHERE id = ? AND company_id = ?`,
        [sales_order_id, companyId]
      );
      if (soRows.length === 0) {
        return res.status(404).json({ success: false, message: "Sales order not found" });
      }
    }

    // If vehicle provided, fetch details
    let vehNo = vehicle_number;
    let drvName = driver_name;
    let drvMob = driver_mobile;
    let trans = transporter;

    if (vehicle_id) {
      const [vRows] = await conn.query(
        `SELECT * FROM plastic_vehicles WHERE id = ? AND company_id = ?`,
        [vehicle_id, companyId]
      );
      if (vRows.length > 0) {
        vehNo = vehNo || vRows[0].vehicle_number;
        drvName = drvName || vRows[0].driver_name;
        drvMob = drvMob || vRows[0].driver_mobile;
        trans = trans || vRows[0].transporter_name;
      }
    }

    const dispatchNo = await generateNextDispatchNo(companyId);

    await conn.beginTransaction();

    try {
      const initialStatus = auto_dispatch ? "DISPATCHED" : "READY";

      const [dispatchResult] = await conn.query(
        `INSERT INTO plastic_dispatches
          (company_id, dispatch_no, dispatch_date, customer_id, sales_order_id, vehicle_id, vehicle_number, driver_name, driver_mobile, transporter, destination, status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          dispatchNo,
          dispatch_date,
          customer_id,
          sales_order_id || null,
          vehicle_id || null,
          vehNo || null,
          drvName || null,
          drvMob || null,
          trans || null,
          destination || null,
          initialStatus,
          notes || null,
          adminId,
        ]
      );

      const dispatchId = dispatchResult.insertId;

      for (const itm of items) {
        const fgId = Number(itm.finished_good_id);
        const qty = Number(itm.quantity);
        const rate = Number(itm.rate) || 0;
        const unit = itm.unit || "KG";
        const soItemId = itm.sales_order_item_id ? Number(itm.sales_order_item_id) : null;
        const lotId = itm.lot_id ? Number(itm.lot_id) : null;

        if (!fgId || !qty || qty <= 0) {
          throw new Error("Valid finished good and positive quantity required for each item");
        }

        // Verify FG ownership and lock stock
        const [fgRows] = await conn.query(
          `SELECT id, fg_name, current_stock FROM plastic_finished_goods WHERE id = ? AND company_id = ? FOR UPDATE`,
          [fgId, companyId]
        );

        if (fgRows.length === 0) {
          throw new Error(`Finished good ID ${fgId} not found or belongs to another company`);
        }

        const currentStock = Number(fgRows[0].current_stock) || 0;

        // If auto dispatching, verify stock and deduct
        if (auto_dispatch) {
          if (currentStock < qty) {
            throw new Error(`Insufficient stock for ${fgRows[0].fg_name}. Available: ${currentStock} ${unit}, Required: ${qty} ${unit}`);
          }

          const newStock = currentStock - qty;

          // 1. Deduct FG stock
          await conn.query(
            `UPDATE plastic_finished_goods
             SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND company_id = ?`,
            [newStock, fgId, companyId]
          );

          // 2. Create outward stock movement
          await conn.query(
            `INSERT INTO plastic_sales_stock_movements
              (company_id, finished_good_id, lot_id, movement_type, reference_type, reference_id, quantity, rate, total_value, balance_quantity, remarks, created_by)
             VALUES (?, ?, ?, 'SALES_OUTWARD', 'plastic_dispatches', ?, ?, ?, ?, ?, ?, ?)`,
            [
              companyId,
              fgId,
              lotId,
              dispatchId,
              qty,
              rate,
              qty * rate,
              newStock,
              `Dispatch ${dispatchNo} to Customer #${customer_id}`,
              adminId,
            ]
          );

          // 3. Update reservation if linked
          if (soItemId) {
            await conn.query(
              `UPDATE plastic_sales_order_items
               SET dispatched_quantity = dispatched_quantity + ?,
                   reserved_quantity = GREATEST(0.00, reserved_quantity - ?)
               WHERE id = ? AND company_id = ?`,
              [qty, qty, soItemId, companyId]
            );

            await conn.query(
              `UPDATE plastic_fg_reservations
               SET status = 'DISPATCHED'
               WHERE sales_order_item_id = ? AND company_id = ? AND status = 'ACTIVE'`,
              [soItemId, companyId]
            );
          }
        }

        // Insert dispatch item
        await conn.query(
          `INSERT INTO plastic_dispatch_items
            (company_id, dispatch_id, sales_order_item_id, finished_good_id, lot_id, quantity, unit, rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            dispatchId,
            soItemId,
            fgId,
            lotId,
            qty,
            unit,
            rate,
          ]
        );
      }

      // Update SO status if applicable
      if (sales_order_id && auto_dispatch) {
        const [soCheck] = await conn.query(
          `SELECT
            COALESCE(SUM(quantity), 0) AS total_ordered,
            COALESCE(SUM(dispatched_quantity), 0) AS total_dispatched
           FROM plastic_sales_order_items
           WHERE sales_order_id = ? AND company_id = ?`,
          [sales_order_id, companyId]
        );
        const ordered = Number(soCheck[0]?.total_ordered) || 0;
        const dispatched = Number(soCheck[0]?.total_dispatched) || 0;
        const newSoStatus = dispatched >= ordered ? "DISPATCHED" : "PARTIALLY_DISPATCHED";

        await conn.query(
          `UPDATE plastic_sales_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
          [newSoStatus, sales_order_id, companyId]
        );
      }

      await conn.commit();

      res.status(201).json({
        success: true,
        message: auto_dispatch
          ? "Dispatch created and stock deducted successfully"
          : "Dispatch created in READY status",
        dispatchId,
        dispatchNo,
        status: initialStatus,
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Create Dispatch Error:", error);
    res.status(400).json({ success: false, message: error.message || "Failed to create dispatch" });
  }
};

exports.updateDispatchStatus = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    if (!["READY", "DISPATCHED", "DELIVERED", "CANCELLED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid dispatch status" });
    }

    const [dispatches] = await conn.query(
      `SELECT * FROM plastic_dispatches WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (dispatches.length === 0) {
      return res.status(404).json({ success: false, message: "Dispatch not found" });
    }

    const dispatch = dispatches[0];
    const prevStatus = dispatch.status;

    if (prevStatus === status) {
      return res.status(200).json({ success: true, message: "Status unchanged", status });
    }

    await conn.beginTransaction();

    try {
      // 1. Transitioning to DISPATCHED from READY/DRAFT -> Deduct stock
      if (status === "DISPATCHED" && ["DRAFT", "READY"].includes(prevStatus)) {
        const [items] = await conn.query(
          `SELECT di.*, fg.fg_name, fg.current_stock
           FROM plastic_dispatch_items di
           JOIN plastic_finished_goods fg ON di.finished_good_id = fg.id AND di.company_id = fg.company_id
           WHERE di.dispatch_id = ? AND di.company_id = ?`,
          [id, companyId]
        );

        for (const item of items) {
          const qty = Number(item.quantity);
          const currentStock = Number(item.current_stock) || 0;

          if (currentStock < qty) {
            throw new Error(`Insufficient stock for ${item.fg_name}. Available: ${currentStock} ${item.unit}, Required: ${qty} ${item.unit}`);
          }

          const newStock = currentStock - qty;

          // Deduct stock
          await conn.query(
            `UPDATE plastic_finished_goods
             SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND company_id = ?`,
            [newStock, item.finished_good_id, companyId]
          );

          // Create stock movement
          await conn.query(
            `INSERT INTO plastic_sales_stock_movements
              (company_id, finished_good_id, lot_id, movement_type, reference_type, reference_id, quantity, rate, total_value, balance_quantity, remarks, created_by)
             VALUES (?, ?, ?, 'SALES_OUTWARD', 'plastic_dispatches', ?, ?, ?, ?, ?, ?, ?)`,
            [
              companyId,
              item.finished_good_id,
              item.lot_id,
              id,
              qty,
              item.rate,
              qty * Number(item.rate),
              newStock,
              `Dispatch ${dispatch.dispatch_no} to Customer #${dispatch.customer_id}`,
              adminId,
            ]
          );

          // Update reservation & SO item
          if (item.sales_order_item_id) {
            await conn.query(
              `UPDATE plastic_sales_order_items
               SET dispatched_quantity = dispatched_quantity + ?,
                   reserved_quantity = GREATEST(0.00, reserved_quantity - ?)
               WHERE id = ? AND company_id = ?`,
              [qty, qty, item.sales_order_item_id, companyId]
            );

            await conn.query(
              `UPDATE plastic_fg_reservations
               SET status = 'DISPATCHED'
               WHERE sales_order_item_id = ? AND company_id = ? AND status = 'ACTIVE'`,
              [item.sales_order_item_id, companyId]
            );
          }
        }

        // Update Sales Order status
        if (dispatch.sales_order_id) {
          const [soCheck] = await conn.query(
            `SELECT
              COALESCE(SUM(quantity), 0) AS total_ordered,
              COALESCE(SUM(dispatched_quantity), 0) AS total_dispatched
             FROM plastic_sales_order_items
             WHERE sales_order_id = ? AND company_id = ?`,
            [dispatch.sales_order_id, companyId]
          );
          const ordered = Number(soCheck[0]?.total_ordered) || 0;
          const dispatched = Number(soCheck[0]?.total_dispatched) || 0;
          const newSoStatus = dispatched >= ordered ? "DISPATCHED" : "PARTIALLY_DISPATCHED";

          await conn.query(
            `UPDATE plastic_sales_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
            [newSoStatus, dispatch.sales_order_id, companyId]
          );
        }
      }

      // 2. Transitioning to CANCELLED from DISPATCHED -> Reverse stock
      if (status === "CANCELLED" && ["DISPATCHED", "DELIVERED"].includes(prevStatus)) {
        const [items] = await conn.query(
          `SELECT di.*, fg.current_stock
           FROM plastic_dispatch_items di
           JOIN plastic_finished_goods fg ON di.finished_good_id = fg.id AND di.company_id = fg.company_id
           WHERE di.dispatch_id = ? AND di.company_id = ?`,
          [id, companyId]
        );

        for (const item of items) {
          const qty = Number(item.quantity);
          const currentStock = Number(item.current_stock) || 0;
          const newStock = currentStock + qty;

          await conn.query(
            `UPDATE plastic_finished_goods
             SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND company_id = ?`,
            [newStock, item.finished_good_id, companyId]
          );

          await conn.query(
            `INSERT INTO plastic_sales_stock_movements
              (company_id, finished_good_id, lot_id, movement_type, reference_type, reference_id, quantity, rate, total_value, balance_quantity, remarks, created_by)
             VALUES (?, ?, ?, 'SALES_RETURN', 'plastic_dispatches', ?, ?, ?, ?, ?, ?, ?)`,
            [
              companyId,
              item.finished_good_id,
              item.lot_id,
              id,
              qty,
              item.rate,
              qty * Number(item.rate),
              newStock,
              `Cancelled Dispatch ${dispatch.dispatch_no} Reversal`,
              adminId,
            ]
          );

          if (item.sales_order_item_id) {
            await conn.query(
              `UPDATE plastic_sales_order_items
               SET dispatched_quantity = GREATEST(0.00, dispatched_quantity - ?)
               WHERE id = ? AND company_id = ?`,
              [qty, item.sales_order_item_id, companyId]
            );
          }
        }
      }

      await conn.query(
        `UPDATE plastic_dispatches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
        [status, id, companyId]
      );

      await conn.commit();

      res.status(200).json({
        success: true,
        message: `Dispatch status updated to ${status} successfully`,
        status,
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Update Dispatch Status Error:", error);
    res.status(400).json({ success: false, message: error.message || "Failed to update dispatch status" });
  }
};

/**
 * Creates and links an invoice using the EXACT SmartBilling existing invoice architecture!
 */
exports.createInvoiceFromDispatch = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const { id } = req.params;

    // 1. Fetch dispatch
    const [dispatches] = await conn.query(
      `SELECT * FROM plastic_dispatches WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (dispatches.length === 0) {
      return res.status(404).json({ success: false, message: "Dispatch not found" });
    }

    const dispatch = dispatches[0];

    // Check if an invoice already exists for this dispatch
    const [existingInv] = await conn.query(
      `SELECT id, invoice_no FROM invoices WHERE dispatch_id = ? AND company_id = ?`,
      [id, companyId]
    );
    if (existingInv.length > 0) {
      return res.status(409).json({
        success: false,
        message: `An invoice (${existingInv[0].invoice_no}) is already linked to this dispatch`,
        invoiceId: existingInv[0].id,
        invoiceNo: existingInv[0].invoice_no,
      });
    }

    // 2. Fetch dispatch items
    const [dispatchItems] = await conn.query(
      `SELECT di.*, fg.fg_name, fg.product_id
       FROM plastic_dispatch_items di
       JOIN plastic_finished_goods fg ON di.finished_good_id = fg.id AND di.company_id = fg.company_id
       WHERE di.dispatch_id = ? AND di.company_id = ?`,
      [id, companyId]
    );

    if (dispatchItems.length === 0) {
      return res.status(400).json({ success: false, message: "Dispatch has no items to invoice" });
    }

    // 3. Fetch company tax settings
    const [settingsRows] = await conn.query(
      `SELECT tax_enabled, default_tax_percent FROM business_settings WHERE company_id = ? LIMIT 1`,
      [companyId]
    );
    const isTaxEnabled =
      settingsRows.length > 0 && settingsRows[0].tax_enabled !== null
        ? Boolean(settingsRows[0].tax_enabled)
        : true;
    const taxPercent = isTaxEnabled
      ? Number(settingsRows[0]?.default_tax_percent !== undefined ? settingsRows[0].default_tax_percent : 18)
      : 0;

    let subtotal = 0;
    const invoiceItems = [];

    for (const item of dispatchItems) {
      const lineTotal = Number(item.quantity) * Number(item.rate);
      subtotal += lineTotal;

      // Find or create product mapping in `products` table if needed
      let prodId = item.product_id;
      if (!prodId) {
        // Look for existing product with same name
        const [matchedProducts] = await conn.query(
          `SELECT id FROM products WHERE name = ? AND company_id = ? LIMIT 1`,
          [item.fg_name, companyId]
        );
        if (matchedProducts.length > 0) {
          prodId = matchedProducts[0].id;
        } else {
          // Add product record to products table for seamless compatibility with existing invoice history/search
          const [newProd] = await conn.query(
            `INSERT INTO products (company_id, name, price, stock) VALUES (?, ?, ?, 0)`,
            [companyId, item.fg_name, item.rate]
          );
          prodId = newProd.insertId;
        }
        // Link product_id back to finished good
        await conn.query(
          `UPDATE plastic_finished_goods SET product_id = ? WHERE id = ? AND company_id = ?`,
          [prodId, item.finished_good_id, companyId]
        );
      }

      invoiceItems.push({
        product_id: prodId,
        product_name: item.fg_name,
        quantity: Math.round(Number(item.quantity)),
        price: Number(item.rate),
        total: lineTotal,
      });
    }

    const discountAmount = 0;
    const taxAmount = isTaxEnabled ? subtotal * (taxPercent / 100) : 0;
    const grandTotal = subtotal + taxAmount;
    const invoiceNo = await generateNextSequentialInvoiceNo(companyId);

    await conn.beginTransaction();

    try {
      // 4. Insert into existing invoices table
      const [invoiceResult] = await conn.query(
        `INSERT INTO invoices
          (
            company_id,
            invoice_no,
            customer_id,
            subtotal,
            discount_percent,
            discount_amount,
            tax_percent,
            tax_amount,
            grand_total,
            sales_order_id,
            dispatch_id,
            payment_status,
            paid_amount
          )
         VALUES (?, ?, ?, ?, 0.00, 0.00, ?, ?, ?, ?, ?, 'UNPAID', 0.00)`,
        [
          companyId,
          invoiceNo,
          dispatch.customer_id,
          subtotal,
          taxPercent,
          taxAmount,
          grandTotal,
          dispatch.sales_order_id,
          id,
        ]
      );

      const invoiceId = invoiceResult.insertId;

      // 5. Insert invoice items
      for (const itm of invoiceItems) {
        await conn.query(
          `INSERT INTO invoice_items
            (company_id, invoice_id, product_id, product_name, quantity, price, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            invoiceId,
            itm.product_id,
            itm.product_name,
            itm.quantity,
            itm.price,
            itm.total,
          ]
        );
      }

      // 6. Post debit entry to customer ledger
      await recordLedgerEntry(conn, {
        companyId,
        customerId: dispatch.customer_id,
        transactionDate: dispatch.dispatch_date,
        referenceType: "INVOICE",
        referenceId: invoiceId,
        referenceNo: invoiceNo,
        debit: grandTotal,
        credit: 0.00,
        notes: `Sales Invoice for Dispatch ${dispatch.dispatch_no}`,
        createdBy: adminId,
      });

      await conn.commit();

      res.status(201).json({
        success: true,
        message: "Invoice generated successfully and linked to dispatch",
        invoice: {
          id: invoiceId,
          invoice_no: invoiceNo,
          customer_id: dispatch.customer_id,
          grand_total: grandTotal,
          payment_status: "UNPAID",
        },
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Create Invoice from Dispatch Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create invoice from dispatch" });
  }
};
