const db = require("../config/db");
const { recordLedgerEntry } = require("../utils/ledgerHelper");

const generateNextReturnNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT return_no
     FROM plastic_sales_returns
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    if (row.return_no) {
      const match = String(row.return_no).match(/^SR-(\d+)$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return `SR-${maxNum + 1}`;
};

const generateNextCreditNoteNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT credit_note_no
     FROM plastic_credit_notes
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    if (row.credit_note_no) {
      const match = String(row.credit_note_no).match(/^CN-(\d+)$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return `CN-${maxNum + 1}`;
};

exports.getNextReturnNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextReturnNo(companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next Return No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate return number" });
  }
};

exports.getSalesReturns = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, customer_id, from_date, to_date } = req.query;

    let sql = `
      SELECT
        sr.*,
        MAX(c.name) AS customer_name,
        MAX(c.mobile) AS customer_mobile,
        MAX(inv.invoice_no) AS invoice_no,
        MAX(d.dispatch_no) AS dispatch_no,
        MAX(cn.credit_note_no) AS credit_note_no,
        COUNT(sri.id) AS total_items,
        COALESCE(SUM(sri.quantity), 0) AS total_return_qty
      FROM plastic_sales_returns sr
      JOIN customers c ON sr.customer_id = c.id AND sr.company_id = c.company_id
      LEFT JOIN invoices inv ON sr.invoice_id = inv.id AND sr.company_id = inv.company_id
      LEFT JOIN plastic_dispatches d ON sr.dispatch_id = d.id AND sr.company_id = d.company_id
      LEFT JOIN plastic_credit_notes cn ON sr.id = cn.sales_return_id AND sr.company_id = cn.company_id
      LEFT JOIN plastic_sales_return_items sri ON sr.id = sri.return_id AND sr.company_id = sri.company_id
      WHERE sr.company_id = ?
    `;
    const params = [companyId];

    if (status) {
      sql += ` AND sr.status = ?`;
      params.push(status);
    }
    if (customer_id) {
      sql += ` AND sr.customer_id = ?`;
      params.push(customer_id);
    }
    if (from_date && to_date) {
      sql += ` AND sr.return_date >= ? AND sr.return_date <= ?`;
      params.push(from_date, to_date);
    }

    sql += ` GROUP BY sr.id ORDER BY sr.id DESC`;

    const [returns] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      returns,
    });
  } catch (error) {
    console.error("Get Sales Returns Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sales returns" });
  }
};

exports.getSalesReturnById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [returns] = await db.promise().query(
      `SELECT
        sr.*,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        c.email AS customer_email,
        c.address AS customer_address,
        inv.invoice_no,
        d.dispatch_no,
        cn.id AS credit_note_id,
        cn.credit_note_no
       FROM plastic_sales_returns sr
       JOIN customers c ON sr.customer_id = c.id AND sr.company_id = c.company_id
       LEFT JOIN invoices inv ON sr.invoice_id = inv.id AND sr.company_id = inv.company_id
       LEFT JOIN plastic_dispatches d ON sr.dispatch_id = d.id AND sr.company_id = d.company_id
       LEFT JOIN plastic_credit_notes cn ON sr.id = cn.sales_return_id AND sr.company_id = cn.company_id
       WHERE sr.id = ? AND sr.company_id = ?`,
      [id, companyId]
    );

    if (returns.length === 0) {
      return res.status(404).json({ success: false, message: "Sales return not found" });
    }

    const [items] = await db.promise().query(
      `SELECT
        sri.*,
        fg.fg_name,
        fg.fg_code,
        fg.plastic_type,
        fgl.lot_number
       FROM plastic_sales_return_items sri
       JOIN plastic_finished_goods fg ON sri.finished_good_id = fg.id AND sri.company_id = fg.company_id
       LEFT JOIN plastic_finished_goods_lots fgl ON sri.lot_id = fgl.id AND sri.company_id = fgl.company_id
       WHERE sri.return_id = ? AND sri.company_id = ?
       ORDER BY sri.id ASC`,
      [id, companyId]
    );

    const record = {
      ...returns[0],
      items,
    };

    res.status(200).json({
      success: true,
      returnRecord: record,
      salesReturn: record,
    });
  } catch (error) {
    console.error("Get Sales Return Details Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch sales return details" });
  }
};

exports.createSalesReturn = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      customer_id,
      invoice_id,
      dispatch_id,
      reason,
      return_date = new Date().toISOString().split("T")[0],
      items,
      notes,
    } = req.body;

    if (!customer_id || !reason) {
      return res.status(400).json({ success: false, message: "Customer and reason are required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one return item is required" });
    }

    // Verify customer
    const [customers] = await conn.query(
      `SELECT id, name FROM customers WHERE id = ? AND company_id = ?`,
      [customer_id, companyId]
    );
    if (customers.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    let totalAmount = 0;
    const preparedItems = [];

    for (const itm of items) {
      const fgId = Number(itm.finished_good_id);
      const qty = Number(itm.quantity);
      const rate = Number(itm.rate) || 0;
      const unit = itm.unit || "KG";
      const qcDisp = itm.qc_disposition || "RETURN_TO_STOCK";

      if (!fgId || !qty || qty <= 0) {
        return res.status(400).json({ success: false, message: "Valid finished good and positive quantity required for each item" });
      }

      const lineTotal = qty * rate;
      totalAmount += lineTotal;

      preparedItems.push({
        finished_good_id: fgId,
        lot_id: itm.lot_id ? Number(itm.lot_id) : null,
        quantity: qty,
        unit,
        rate,
        line_total: lineTotal,
        qc_disposition: qcDisp,
      });
    }

    // Check tax settings
    const [settingsRows] = await conn.query(
      `SELECT tax_enabled, default_tax_percent FROM business_settings WHERE company_id = ? LIMIT 1`,
      [companyId]
    );
    const isTaxEnabled = settingsRows.length > 0 && settingsRows[0].tax_enabled !== null
      ? Boolean(settingsRows[0].tax_enabled)
      : true;
    const taxPercent = isTaxEnabled
      ? Number(settingsRows[0]?.default_tax_percent !== undefined ? settingsRows[0].default_tax_percent : 18)
      : 0;

    const taxAmount = isTaxEnabled ? totalAmount * (taxPercent / 100) : 0;
    const grandTotal = totalAmount + taxAmount;

    const returnNo = await generateNextReturnNo(companyId);

    await conn.beginTransaction();

    try {
      const [returnResult] = await conn.query(
        `INSERT INTO plastic_sales_returns
          (company_id, return_no, return_date, customer_id, invoice_id, dispatch_id, reason, status, total_amount, tax_amount, grand_total, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, ?)`,
        [
          companyId,
          returnNo,
          return_date,
          customer_id,
          invoice_id || null,
          dispatch_id || null,
          reason,
          totalAmount,
          taxAmount,
          grandTotal,
          notes || null,
          adminId,
        ]
      );

      const returnId = returnResult.insertId;

      for (const pItm of preparedItems) {
        await conn.query(
          `INSERT INTO plastic_sales_return_items
            (company_id, return_id, finished_good_id, lot_id, quantity, unit, rate, line_total, qc_disposition)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            returnId,
            pItm.finished_good_id,
            pItm.lot_id,
            pItm.quantity,
            pItm.unit,
            pItm.rate,
            pItm.line_total,
            pItm.qc_disposition,
          ]
        );
      }

      await conn.commit();

      res.status(201).json({
        success: true,
        message: "Sales return logged successfully in RECEIVED status",
        returnId,
        returnNo,
        status: "RECEIVED",
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Create Sales Return Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create sales return" });
  }
};

exports.completeSalesReturn = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const { id } = req.params;

    const [returns] = await conn.query(
      `SELECT * FROM plastic_sales_returns WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (returns.length === 0) {
      return res.status(404).json({ success: false, message: "Sales return not found" });
    }

    const returnRecord = returns[0];
    if (returnRecord.status === "COMPLETED") {
      return res.status(400).json({ success: false, message: "Sales return is already completed" });
    }

    const [items] = await conn.query(
      `SELECT sri.*, fg.fg_name, fg.current_stock
       FROM plastic_sales_return_items sri
       JOIN plastic_finished_goods fg ON sri.finished_good_id = fg.id AND sri.company_id = fg.company_id
       WHERE sri.return_id = ? AND sri.company_id = ?`,
      [id, companyId]
    );

    await conn.beginTransaction();

    try {
      // 1. Process items: Restock or Scrap
      for (const item of items) {
        const qty = Number(item.quantity);
        const currentStock = Number(item.current_stock) || 0;

        if (item.qc_disposition === "RETURN_TO_STOCK") {
          const newStock = currentStock + qty;

          // Increase FG stock
          await conn.query(
            `UPDATE plastic_finished_goods
             SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND company_id = ?`,
            [newStock, item.finished_good_id, companyId]
          );

          // Record SALES_RETURN stock movement
          await conn.query(
            `INSERT INTO plastic_sales_stock_movements
              (company_id, finished_good_id, lot_id, movement_type, reference_type, reference_id, quantity, rate, total_value, balance_quantity, remarks, created_by)
             VALUES (?, ?, ?, 'SALES_RETURN', 'plastic_sales_returns', ?, ?, ?, ?, ?, ?, ?)`,
            [
              companyId,
              item.finished_good_id,
              item.lot_id,
              id,
              qty,
              item.rate,
              qty * Number(item.rate),
              newStock,
              `Customer Return ${returnRecord.return_no} Restocked`,
              adminId,
            ]
          );
        } else if (item.qc_disposition === "REJECT_TO_SCRAP") {
          // Record into scrap records
          const [scrapCount] = await conn.query(
            `SELECT COUNT(id) AS cnt FROM plastic_scrap_records WHERE company_id = ?`,
            [companyId]
          );
          const scrapNo = `SCRAP-${1000 + (scrapCount[0]?.cnt || 0) + 1}`;

          await conn.query(
            `INSERT INTO plastic_scrap_records
              (company_id, scrap_no, scrap_type, material_name, quantity, unit, reason, is_reusable, status, created_by)
             VALUES (?, ?, 'RETURN_REJECT', ?, ?, ?, ?, 1, 'GENERATED', ?)`,
            [
              companyId,
              scrapNo,
              item.fg_name,
              qty,
              item.unit,
              `Sales Return ${returnRecord.return_no} rejected during QC`,
              adminId,
            ]
          );
        }
      }

      // 2. Generate Credit Note for the customer
      const creditNoteNo = await generateNextCreditNoteNo(companyId);

      const [cnResult] = await conn.query(
        `INSERT INTO plastic_credit_notes
          (company_id, credit_note_no, date, customer_id, invoice_id, sales_return_id, reason, amount, tax_percent, tax_amount, total, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, 'ISSUED', ?)`,
        [
          companyId,
          creditNoteNo,
          returnRecord.return_date,
          returnRecord.customer_id,
          returnRecord.invoice_id,
          id,
          `Sales Return: ${returnRecord.reason}`,
          returnRecord.total_amount,
          returnRecord.tax_amount,
          returnRecord.grand_total,
          adminId,
        ]
      );

      const cnId = cnResult.insertId;

      for (const itm of items) {
        await conn.query(
          `INSERT INTO plastic_credit_note_items
            (company_id, credit_note_id, description, quantity, rate, amount)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            cnId,
            `Return: ${itm.fg_name} (${itm.qc_disposition})`,
            itm.quantity,
            itm.rate,
            itm.line_total,
          ]
        );
      }

      // 3. Post Credit Note to Customer Ledger (Credit decreases receivable)
      await recordLedgerEntry(conn, {
        companyId,
        customerId: returnRecord.customer_id,
        transactionDate: returnRecord.return_date,
        referenceType: "CREDIT_NOTE",
        referenceId: cnId,
        referenceNo: creditNoteNo,
        debit: 0.00,
        credit: Number(returnRecord.grand_total),
        notes: `Credit Note for Sales Return ${returnRecord.return_no}`,
        createdBy: adminId,
      });

      // 4. Mark return as COMPLETED
      await conn.query(
        `UPDATE plastic_sales_returns
         SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND company_id = ?`,
        [id, companyId]
      );

      // Phase 5: Auto-post accounting journal & GST adjustment for Sales Return Credit Note
      const { postCreditNoteAccounting } = require("../utils/accountingHelper");
      await postCreditNoteAccounting(conn, {
        companyId,
        creditNote: {
          id: cnId,
          credit_note_no: creditNoteNo,
          customer_id: returnRecord.customer_id,
          date: returnRecord.return_date,
          amount: Number(returnRecord.total_amount || 0),
          tax_percent: 0.00,
          tax_amount: Number(returnRecord.tax_amount || 0),
          total: Number(returnRecord.grand_total || 0),
          reason: `Sales Return ${returnRecord.return_no}: ${returnRecord.reason}`,
        },
        createdBy: adminId,
      });

      await conn.commit();

      res.status(200).json({
        success: true,
        message: "Sales return approved, finished goods restocked, and Credit Note issued successfully",
        returnId: id,
        creditNoteNo,
        status: "COMPLETED",
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Complete Sales Return Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to complete sales return" });
  }
};
