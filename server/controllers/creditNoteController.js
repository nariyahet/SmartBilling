const db = require("../config/db");
const { recordLedgerEntry } = require("../utils/ledgerHelper");

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

exports.getNextCreditNoteNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextCreditNoteNo(companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next Credit Note No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate credit note number" });
  }
};

exports.getCreditNotes = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { customer_id, from_date, to_date } = req.query;

    let sql = `
      SELECT
        cn.*,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        inv.invoice_no,
        sr.return_no
      FROM plastic_credit_notes cn
      JOIN customers c ON cn.customer_id = c.id AND cn.company_id = c.company_id
      LEFT JOIN invoices inv ON cn.invoice_id = inv.id AND cn.company_id = inv.company_id
      LEFT JOIN plastic_sales_returns sr ON cn.sales_return_id = sr.id AND cn.company_id = sr.company_id
      WHERE cn.company_id = ?
    `;
    const params = [companyId];

    if (customer_id) {
      sql += ` AND cn.customer_id = ?`;
      params.push(customer_id);
    }
    if (from_date && to_date) {
      sql += ` AND cn.date >= ? AND cn.date <= ?`;
      params.push(from_date, to_date);
    }

    sql += ` ORDER BY cn.id DESC`;

    const [creditNotes] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      creditNotes,
    });
  } catch (error) {
    console.error("Get Credit Notes Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch credit notes" });
  }
};

exports.getCreditNoteById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [creditNotes] = await db.promise().query(
      `SELECT
        cn.*,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        c.email AS customer_email,
        c.address AS customer_address,
        inv.invoice_no,
        sr.return_no
       FROM plastic_credit_notes cn
       JOIN customers c ON cn.customer_id = c.id AND cn.company_id = c.company_id
       LEFT JOIN invoices inv ON cn.invoice_id = inv.id AND cn.company_id = inv.company_id
       LEFT JOIN plastic_sales_returns sr ON cn.sales_return_id = sr.id AND cn.company_id = sr.company_id
       WHERE cn.id = ? AND cn.company_id = ?`,
      [id, companyId]
    );

    if (creditNotes.length === 0) {
      return res.status(404).json({ success: false, message: "Credit note not found" });
    }

    const [items] = await db.promise().query(
      `SELECT * FROM plastic_credit_note_items WHERE credit_note_id = ? AND company_id = ? ORDER BY id ASC`,
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      creditNote: {
        ...creditNotes[0],
        items,
      },
    });
  } catch (error) {
    console.error("Get Credit Note Details Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch credit note details" });
  }
};

exports.createCreditNote = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      customer_id,
      invoice_id,
      sales_return_id,
      reason,
      date = new Date().toISOString().split("T")[0],
      items,
      tax_percent = 0,
    } = req.body;

    if (!customer_id || !reason) {
      return res.status(400).json({ success: false, message: "Customer and reason are required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one credit note line item is required" });
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
      const desc = itm.description || "Credit Adjustment";
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

    const creditNoteNo = await generateNextCreditNoteNo(companyId);

    await conn.beginTransaction();

    try {
      const [cnResult] = await conn.query(
        `INSERT INTO plastic_credit_notes
          (company_id, credit_note_no, date, customer_id, invoice_id, sales_return_id, reason, amount, tax_percent, tax_amount, total, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED', ?)`,
        [
          companyId,
          creditNoteNo,
          date,
          customer_id,
          invoice_id || null,
          sales_return_id || null,
          reason,
          subtotal,
          taxP,
          taxAmount,
          grandTotal,
          adminId,
        ]
      );

      const cnId = cnResult.insertId;

      for (const pItm of preparedItems) {
        await conn.query(
          `INSERT INTO plastic_credit_note_items
            (company_id, credit_note_id, description, quantity, rate, amount)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            cnId,
            pItm.description,
            pItm.quantity,
            pItm.rate,
            pItm.amount,
          ]
        );
      }

      // Post credit to customer ledger
      await recordLedgerEntry(conn, {
        companyId,
        customerId: customer_id,
        transactionDate: date,
        referenceType: "CREDIT_NOTE",
        referenceId: cnId,
        referenceNo: creditNoteNo,
        debit: 0.00,
        credit: grandTotal,
        notes: `Credit Note ${creditNoteNo} - ${reason}`,
        createdBy: adminId,
      });

      await conn.commit();

      res.status(201).json({
        success: true,
        message: "Credit note issued and customer ledger updated successfully",
        creditNoteId: cnId,
        creditNoteNo,
        total: grandTotal,
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Create Credit Note Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create credit note" });
  }
};
