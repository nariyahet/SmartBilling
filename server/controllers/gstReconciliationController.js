const db = require("../config/db");

exports.getGstReconciliationItems = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, from_date, to_date, search } = req.query;

    let sql = `
      SELECT
        ri.*,
        gr.party_name AS books_supplier_name,
        gr.party_gstin AS books_supplier_gstin
      FROM plastic_gst_reconciliation_items ri
      LEFT JOIN plastic_gst_records gr ON ri.gst_record_id = gr.id AND ri.company_id = gr.company_id
      WHERE ri.company_id = ?
    `;
    const params = [companyId];

    if (status && status !== "ALL") {
      sql += ` AND ri.status = ?`;
      params.push(status.toUpperCase());
    }

    if (from_date && to_date) {
      sql += ` AND ri.invoice_date >= ? AND ri.invoice_date <= ?`;
      params.push(from_date, to_date);
    }

    if (search && search.trim()) {
      sql += ` AND (ri.invoice_number LIKE ? OR ri.supplier_gstin LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    sql += ` ORDER BY ri.invoice_date DESC, ri.id DESC`;

    const [rows] = await db.promise().query(sql, params);

    const matched = rows.filter((r) => r.status === "MATCHED").length;
    const partial = rows.filter((r) => r.status === "PARTIAL").length;
    const mismatch = rows.filter((r) => r.status === "MISMATCH").length;
    const missing = rows.filter((r) => r.status === "MISSING").length;

    res.status(200).json({
      success: true,
      summary: {
        total: rows.length,
        matched,
        partial,
        mismatch,
        missing,
      },
      items: rows,
    });
  } catch (error) {
    console.error("Get GST Recon Items Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch GST reconciliation items" });
  }
};

exports.addPortalItem = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const {
      supplier_gstin,
      invoice_number,
      invoice_date,
      portal_taxable_value = 0.00,
      portal_tax_amount = 0.00,
      notes,
    } = req.body;

    if (!invoice_number || !invoice_date) {
      return res.status(400).json({ success: false, message: "Invoice number and invoice date are required" });
    }

    const pTaxable = Number(portal_taxable_value) || 0;
    const pTax = Number(portal_tax_amount) || 0;

    // Search for match in internal purchase books (plastic_gst_records INPUT)
    const [bookRows] = await conn.query(
      `SELECT * FROM plastic_gst_records
       WHERE company_id = ? AND gst_type = 'INPUT' AND (invoice_no = ? OR invoice_no LIKE ?)
       LIMIT 1`,
      [companyId, invoice_number.trim(), `%${invoice_number.trim()}%`]
    );

    let gstRecordId = null;
    let bTaxable = 0;
    let bTax = 0;
    let status = "MISSING"; // If not in books, it's missing from books

    if (bookRows.length > 0) {
      const bRec = bookRows[0];
      gstRecordId = bRec.id;
      bTaxable = Number(bRec.taxable_amount || 0);
      bTax = Number(bRec.total_tax || 0);

      const taxDiff = Math.abs(pTax - bTax);
      const taxableDiff = Math.abs(pTaxable - bTaxable);

      if (taxDiff < 1.0 && taxableDiff < 5.0) {
        status = "MATCHED";
      } else if (taxDiff < 50.0) {
        status = "PARTIAL";
      } else {
        status = "MISMATCH";
      }
    }

    const diffAmount = Math.abs(pTax - bTax);

    const [result] = await conn.query(
      `INSERT INTO plastic_gst_reconciliation_items
        (company_id, gst_record_id, supplier_gstin, invoice_number, invoice_date, portal_taxable_value, portal_tax_amount, books_taxable_value, books_tax_amount, difference_amount, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        gstRecordId,
        supplier_gstin ? supplier_gstin.trim().toUpperCase() : null,
        invoice_number.trim(),
        invoice_date,
        pTaxable,
        pTax,
        bTaxable,
        bTax,
        diffAmount,
        status,
        notes || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Portal record added and matched",
      reconId: result.insertId,
      status,
      differenceAmount: diffAmount,
    });
  } catch (error) {
    console.error("Add Portal Recon Item Error:", error);
    res.status(500).json({ success: false, message: "Failed to record portal reconciliation item" });
  }
};

exports.autoMatchPortalItems = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;

    // Fetch all unresolved reconciliation items
    const [unresolved] = await conn.query(
      `SELECT * FROM plastic_gst_reconciliation_items WHERE company_id = ? AND status != 'MATCHED'`,
      [companyId]
    );

    let matchCount = 0;

    for (const item of unresolved) {
      const [bookRows] = await conn.query(
        `SELECT * FROM plastic_gst_records
         WHERE company_id = ? AND gst_type = 'INPUT' AND (invoice_no = ? OR invoice_no LIKE ?)
         LIMIT 1`,
        [companyId, item.invoice_number, `%${item.invoice_number}%`]
      );

      if (bookRows.length > 0) {
        const bRec = bookRows[0];
        const bTaxable = Number(bRec.taxable_amount || 0);
        const bTax = Number(bRec.total_tax || 0);
        const pTax = Number(item.portal_tax_amount || 0);
        const pTaxable = Number(item.portal_tax_value || 0);

        const taxDiff = Math.abs(pTax - bTax);
        let newStatus = "MISMATCH";

        if (taxDiff < 1.0) {
          newStatus = "MATCHED";
          matchCount++;
        } else if (taxDiff < 50.0) {
          newStatus = "PARTIAL";
        }

        await conn.query(
          `UPDATE plastic_gst_reconciliation_items
           SET gst_record_id = ?, books_taxable_value = ?, books_tax_amount = ?, difference_amount = ?, status = ?, reconciled_at = NOW()
           WHERE id = ?`,
          [bRec.id, bTaxable, bTax, taxDiff, newStatus, item.id]
        );

        if (newStatus === "MATCHED") {
          await conn.query(
            `UPDATE plastic_gst_records SET itc_reconciliation_status = 'MATCHED' WHERE id = ?`,
            [bRec.id]
          );
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Reconciliation auto-matching completed. ${matchCount} items newly matched.`,
      newMatches: matchCount,
    });
  } catch (error) {
    console.error("Auto Match GST Error:", error);
    res.status(500).json({ success: false, message: "Auto match failed" });
  }
};
