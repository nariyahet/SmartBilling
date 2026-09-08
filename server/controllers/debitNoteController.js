const db = require("../config/db");
const { recordLedgerEntry } = require("../utils/ledgerHelper");

const generateNextDebitNoteNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT debit_note_no
     FROM plastic_debit_notes
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    if (row.debit_note_no) {
      const match = String(row.debit_note_no).match(/^DN-(\d+)$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return `DN-${maxNum + 1}`;
};

exports.getNextDebitNoteNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextDebitNoteNo(companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next Debit Note No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate debit note number" });
  }
};

exports.getDebitNotes = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { customer_id, from_date, to_date } = req.query;

    let sql = `
      SELECT
        dn.*,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        inv.invoice_no
      FROM plastic_debit_notes dn
      JOIN customers c ON dn.customer_id = c.id AND dn.company_id = c.company_id
      LEFT JOIN invoices inv ON dn.invoice_id = inv.id AND dn.company_id = inv.company_id
      WHERE dn.company_id = ?
    `;
    const params = [companyId];

    if (customer_id) {
      sql += ` AND dn.customer_id = ?`;
      params.push(customer_id);
    }
    if (from_date && to_date) {
      sql += ` AND dn.date >= ? AND dn.date <= ?`;
      params.push(from_date, to_date);
    }

    sql += ` ORDER BY dn.id DESC`;

    const [debitNotes] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      debitNotes,
    });
  } catch (error) {
    console.error("Get Debit Notes Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch debit notes" });
  }
};

exports.getDebitNoteById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [debitNotes] = await db.promise().query(
      `SELECT
        dn.*,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        c.email AS customer_email,
        c.address AS customer_address,
        inv.invoice_no
       FROM plastic_debit_notes dn
       JOIN customers c ON dn.customer_id = c.id AND dn.company_id = c.company_id
       LEFT JOIN invoices inv ON dn.invoice_id = inv.id AND dn.company_id = inv.company_id
       WHERE dn.id = ? AND dn.company_id = ?`,
      [id, companyId]
    );

    if (debitNotes.length === 0) {
      return res.status(404).json({ success: false, message: "Debit note not found" });
    }

    const [items] = await db.promise().query(
      `SELECT * FROM plastic_debit_note_items WHERE debit_note_id = ? AND company_id = ? ORDER BY id ASC`,
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      debitNote: {
        ...debitNotes[0],
        items,
      },
    });
  } catch (error) {
    console.error("Get Debit Note Details Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch debit note details" });
  }
};

exports.createDebitNote = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      customer_id,
      invoice_id,
      reason,
      date = new Date().toISOString().split("T")[0],
      items,
      tax_percent = 0,
    } = req.body;

    if (!customer_id || !reason) {
      return res.status(400).json({ success: false, message: "Customer and reason are required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one debit note line item is required" });
    }

    // Verify customer
    const [customers] = await conn.query(
      `SELECT id, name FROM customers WHERE id = ? AND company_id = ?`,
      [customer_id, companyId]
    );
    if (customers.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    let subtotal = 0;
    const preparedItems = [];

    for (const itm of items) {
      const desc = itm.description || "Debit Adjustment / Surcharge";
      const qty = Number(itm.quantity) || 1;
      const rate = Number(itm.rate) || 0;
      const lineTotal = Number(itm.amount) || (qty * rate);

      subtotal += lineTotal;
      preparedItems.push({
        description: desc,
        quantity: qty,
        rate,
        amount: lineTotal,
      });
    }

    const taxP = Number(tax_percent) || 0;
    const taxAmount = subtotal * (taxP / 100);
    const grandTotal = subtotal + taxAmount;

    const debitNoteNo = await generateNextDebitNoteNo(companyId);

    await conn.beginTransaction();

    try {
      const [dnResult] = await conn.query(
        `INSERT INTO plastic_debit_notes
          (company_id, debit_note_no, date, customer_id, invoice_id, reason, amount, tax_percent, tax_amount, total, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED', ?)`,
        [
          companyId,
          debitNoteNo,
          date,
          customer_id,
          invoice_id || null,
          reason,
          subtotal,
          taxP,
          taxAmount,
          grandTotal,
          adminId,
        ]
      );

      const dnId = dnResult.insertId;

      for (const pItm of preparedItems) {
        await conn.query(
          `INSERT INTO plastic_debit_note_items
            (company_id, debit_note_id, description, quantity, rate, amount)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            dnId,
            pItm.description,
            pItm.quantity,
            pItm.rate,
            pItm.amount,
          ]
        );
      }

      // Post debit to customer ledger (debit increases receivable)
      await recordLedgerEntry(conn, {
        companyId,
        customerId: customer_id,
        transactionDate: date,
        referenceType: "DEBIT_NOTE",
        referenceId: dnId,
        referenceNo: debitNoteNo,
        debit: grandTotal,
        credit: 0.00,
        notes: `Debit Note ${debitNoteNo} - ${reason}`,
        createdBy: adminId,
      });

      await conn.commit();

      res.status(201).json({
        success: true,
        message: "Debit note issued and customer ledger updated successfully",
        debitNoteId: dnId,
        debitNoteNo,
        total: grandTotal,
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Create Debit Note Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create debit note" });
  }
};
