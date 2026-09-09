const db = require("../config/db");

// Helper: Generate next Quote Number QUOT-YYYYMMDD-XXXX
async function generateNextQuoteNo(conn, companyId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `QUOT-${dateStr}-`;

  const [rows] = await conn.query(
    "SELECT quotation_no FROM plastic_supplier_quotations WHERE company_id = ? AND quotation_no LIKE ? ORDER BY id DESC LIMIT 1",
    [companyId, `${prefix}%`]
  );

  let seq = 1;
  if (rows.length > 0) {
    const parts = rows[0].quotation_no.split("-");
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

exports.getNextQuoteNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextQuoteNo(db.promise(), companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next Quote No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate quotation number" });
  }
};

exports.getQuotations = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { supplier_id, status, from_date, to_date, search } = req.query;

    let sql = `
      SELECT
        q.*,
        s.supplier_name,
        s.supplier_code,
        s.mobile AS supplier_mobile,
        pr.pr_no,
        COUNT(qi.id) AS items_count,
        COALESCE(SUM(qi.quantity), 0) AS total_quantity
      FROM plastic_supplier_quotations q
      JOIN suppliers s ON q.supplier_id = s.id AND q.company_id = s.company_id
      LEFT JOIN plastic_purchase_requisitions pr ON q.requisition_id = pr.id AND q.company_id = pr.company_id
      LEFT JOIN plastic_supplier_quotation_items qi ON q.id = qi.quotation_id AND qi.company_id = q.company_id
      WHERE q.company_id = ?
    `;
    const params = [companyId];

    if (supplier_id && supplier_id !== "ALL") {
      sql += " AND q.supplier_id = ?";
      params.push(supplier_id);
    }
    if (status && status !== "ALL") {
      sql += " AND q.status = ?";
      params.push(status);
    }
    if (from_date) {
      sql += " AND q.quotation_date >= ?";
      params.push(from_date);
    }
    if (to_date) {
      sql += " AND q.quotation_date <= ?";
      params.push(to_date);
    }
    if (search) {
      sql += " AND (q.quotation_no LIKE ? OR s.supplier_name LIKE ? OR q.reference_no LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += " GROUP BY q.id ORDER BY q.id DESC";

    const [rows] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Get Quotations Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch quotations" });
  }
};

exports.getQuotationById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [quotes] = await db.promise().query(
      `SELECT
        q.*,
        s.supplier_name,
        s.supplier_code,
        s.mobile AS supplier_mobile,
        s.email AS supplier_email,
        s.gst_number AS supplier_gst,
        pr.pr_no
      FROM plastic_supplier_quotations q
      JOIN suppliers s ON q.supplier_id = s.id AND q.company_id = s.company_id
      LEFT JOIN plastic_purchase_requisitions pr ON q.requisition_id = pr.id AND q.company_id = pr.company_id
      WHERE q.id = ? AND q.company_id = ?`,
      [id, companyId]
    );

    if (quotes.length === 0) {
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }

    const quotation = quotes[0];

    const [items] = await db.promise().query(
      `SELECT
        qi.*,
        rm.material_code,
        rm.material_name,
        rm.plastic_type
      FROM plastic_supplier_quotation_items qi
      JOIN raw_materials rm ON qi.raw_material_id = rm.id AND qi.company_id = rm.company_id
      WHERE qi.quotation_id = ? AND qi.company_id = ?
      ORDER BY qi.id ASC`,
      [id, companyId]
    );

    res.status(200).json({ success: true, data: { ...quotation, items } });
  } catch (error) {
    console.error("Get Quotation Details Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch quotation details" });
  }
};

exports.createQuotation = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      supplier_id,
      requisition_id,
      quotation_date,
      validity_date,
      reference_no,
      payment_terms,
      delivery_terms,
      lead_time_days,
      notes,
      items,
    } = req.body;

    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Supplier and at least one quotation line item are required",
      });
    }

    await conn.query("START TRANSACTION");

    const quoteNo = await generateNextQuoteNo(conn, companyId);

    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalFreight = 0;
    let grandTotal = 0;

    const processedItems = [];

    for (const itm of items) {
      const qty = Number(itm.quantity);
      const rate = Number(itm.rate);
      if (isNaN(qty) || qty <= 0 || isNaN(rate) || rate < 0) {
        throw new Error("Invalid quantity or rate in quotation items");
      }

      const lineBase = qty * rate;
      const discPct = Number(itm.discount_percent || 0);
      const discAmt = Number(itm.discount_amount || (lineBase * discPct / 100));
      const taxable = Math.max(0, lineBase - discAmt);
      const taxPct = Number(itm.tax_percent || 0);
      const taxAmt = Number(itm.tax_amount || (taxable * taxPct / 100));
      const freightAmt = Number(itm.freight_amount || 0);
      const lineTotal = taxable + taxAmt + freightAmt;
      const effectiveLanded = qty > 0 ? (lineTotal / qty) : rate;

      subtotal += lineBase;
      totalDiscount += discAmt;
      totalTax += taxAmt;
      totalFreight += freightAmt;
      grandTotal += lineTotal;

      processedItems.push({
        raw_material_id: itm.raw_material_id,
        quantity: qty,
        unit: itm.unit || "KG",
        rate,
        discount_percent: discPct,
        discount_amount: discAmt,
        tax_percent: taxPct,
        tax_amount: taxAmt,
        freight_amount: freightAmt,
        total_amount: lineTotal,
        effective_landed_rate: effectiveLanded,
      });
    }

    const [qResult] = await conn.query(
      `INSERT INTO plastic_supplier_quotations (
        company_id, quotation_no, supplier_id, requisition_id, quotation_date,
        validity_date, reference_no, payment_terms, delivery_terms, lead_time_days,
        subtotal, discount_amount, tax_amount, freight_amount, grand_total,
        notes, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        companyId,
        quoteNo,
        supplier_id,
        requisition_id || null,
        quotation_date || new Date().toISOString().slice(0, 10),
        validity_date || null,
        reference_no || null,
        payment_terms || "30 Days Net",
        delivery_terms || "Ex-Plant",
        lead_time_days || 3,
        subtotal,
        totalDiscount,
        totalTax,
        totalFreight,
        grandTotal,
        notes || null,
        adminId || null,
      ]
    );

    const quotationId = qResult.insertId;

    for (const itm of processedItems) {
      await conn.query(
        `INSERT INTO plastic_supplier_quotation_items (
          company_id, quotation_id, raw_material_id, quantity, unit,
          rate, discount_percent, discount_amount, tax_percent, tax_amount,
          freight_amount, total_amount, effective_landed_rate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          quotationId,
          itm.raw_material_id,
          itm.quantity,
          itm.unit,
          itm.rate,
          itm.discount_percent,
          itm.discount_amount,
          itm.tax_percent,
          itm.tax_amount,
          itm.freight_amount,
          itm.total_amount,
          itm.effective_landed_rate,
        ]
      );
    }

    await conn.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Supplier quotation created successfully",
      data: { id: quotationId, quotation_no: quoteNo, grand_total: grandTotal },
    });
  } catch (error) {
    await conn.query("ROLLBACK");
    console.error("Create Quotation Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create quotation" });
  }
};

exports.compareQuotations = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { raw_material_id, requisition_id } = req.query;

    let sql = `
      SELECT
        qi.*,
        q.quotation_no,
        q.quotation_date,
        q.validity_date,
        q.payment_terms,
        q.delivery_terms,
        q.lead_time_days,
        q.status AS quotation_status,
        s.id AS supplier_id,
        s.supplier_name,
        s.supplier_code,
        s.mobile AS supplier_mobile,
        rm.material_name,
        rm.material_code,
        rm.plastic_type,
        COALESCE(sp.delivery_score, 90.0) AS supplier_delivery_score,
        COALESCE(sp.quality_score, 92.0) AS supplier_quality_score,
        COALESCE(sp.overall_score, 91.0) AS supplier_overall_score
      FROM plastic_supplier_quotation_items qi
      JOIN plastic_supplier_quotations q ON qi.quotation_id = q.id AND qi.company_id = q.company_id
      JOIN suppliers s ON q.supplier_id = s.id AND q.company_id = s.company_id
      JOIN raw_materials rm ON qi.raw_material_id = rm.id AND qi.company_id = rm.company_id
      LEFT JOIN plastic_supplier_performance sp ON s.id = sp.supplier_id AND sp.company_id = s.company_id
      WHERE qi.company_id = ? AND q.status != 'REJECTED'
    `;
    const params = [companyId];

    if (raw_material_id) {
      sql += " AND qi.raw_material_id = ?";
      params.push(raw_material_id);
    }
    if (requisition_id) {
      sql += " AND q.requisition_id = ?";
      params.push(requisition_id);
    }

    sql += " ORDER BY qi.raw_material_id ASC, qi.effective_landed_rate ASC";

    const [rows] = await db.promise().query(sql, params);

    // Group items by material and compute highlights
    const grouped = {};
    for (const r of rows) {
      const mId = r.raw_material_id;
      if (!grouped[mId]) {
        grouped[mId] = {
          raw_material_id: mId,
          material_name: r.material_name,
          material_code: r.material_code,
          plastic_type: r.plastic_type,
          quotes: [],
        };
      }
      grouped[mId].quotes.push(r);
    }

    const comparisons = Object.values(grouped).map((group) => {
      const quotes = group.quotes;
      if (quotes.length === 0) return group;

      // Find min landed rate
      const minLanded = Math.min(...quotes.map((q) => Number(q.effective_landed_rate)));
      const minLeadTime = Math.min(...quotes.map((q) => Number(q.lead_time_days || 999)));
      const maxQuality = Math.max(...quotes.map((q) => Number(q.supplier_quality_score || 0)));

      const annotated = quotes.map((q) => ({
        ...q,
        is_lowest_rate: Number(q.effective_landed_rate) === minLanded,
        is_fastest_delivery: Number(q.lead_time_days) === minLeadTime,
        is_highest_quality: Number(q.supplier_quality_score) === maxQuality,
        is_best_commercial: Number(q.effective_landed_rate) === minLanded,
      }));

      return {
        ...group,
        quotes: annotated,
      };
    });

    res.status(200).json({ success: true, data: comparisons });
  } catch (error) {
    console.error("Compare Quotations Error:", error);
    res.status(500).json({ success: false, message: "Failed to compare quotations" });
  }
};

exports.convertQuoteToPO = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const { id } = req.params;
    const { expected_delivery_date, notes } = req.body;

    await conn.query("START TRANSACTION");

    const [quotes] = await conn.query(
      "SELECT * FROM plastic_supplier_quotations WHERE id = ? AND company_id = ? FOR UPDATE",
      [id, companyId]
    );

    if (quotes.length === 0) {
      await conn.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }

    const quote = quotes[0];

    const [items] = await conn.query(
      "SELECT * FROM plastic_supplier_quotation_items WHERE quotation_id = ? AND company_id = ?",
      [id, companyId]
    );

    if (items.length === 0) {
      await conn.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Quotation has no items to convert" });
    }

    // Generate PO-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const poPrefix = `PO-${dateStr}-`;

    const [lastPO] = await conn.query(
      "SELECT po_no FROM plastic_purchase_orders WHERE company_id = ? AND po_no LIKE ? ORDER BY id DESC LIMIT 1",
      [companyId, `${poPrefix}%`]
    );

    let poSeq = 1;
    if (lastPO.length > 0) {
      const parts = lastPO[0].po_no.split("-");
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) poSeq = parsed + 1;
      }
    }
    const poNo = `${poPrefix}${String(poSeq).padStart(4, "0")}`;

    const [poResult] = await conn.query(
      `INSERT INTO plastic_purchase_orders (
        company_id, po_no, supplier_id, quotation_id, requisition_id,
        po_date, expected_delivery_date, payment_terms, delivery_terms,
        subtotal, discount_amount, tax_amount, freight_amount, grand_total,
        notes, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
      [
        companyId,
        poNo,
        quote.supplier_id,
        id,
        quote.requisition_id || null,
        new Date().toISOString().slice(0, 10),
        expected_delivery_date || null,
        quote.payment_terms,
        quote.delivery_terms,
        quote.subtotal,
        quote.discount_amount,
        quote.tax_amount,
        quote.freight_amount,
        quote.grand_total,
        notes || `Generated from Quotation ${quote.quotation_no}`,
        adminId || null,
      ]
    );

    const poId = poResult.insertId;

    for (const itm of items) {
      await conn.query(
        `INSERT INTO plastic_purchase_order_items (
          company_id, purchase_order_id, raw_material_id, ordered_qty,
          unit, rate, discount_amount, tax_percent, tax_amount, total_amount,
          received_qty, pending_qty, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, 'PENDING')`,
        [
          companyId,
          poId,
          itm.raw_material_id,
          itm.quantity,
          itm.unit,
          itm.rate,
          itm.discount_amount,
          itm.tax_percent,
          itm.tax_amount,
          itm.total_amount,
          itm.quantity,
        ]
      );
    }

    // Mark quotation as ACCEPTED
    await conn.query(
      "UPDATE plastic_supplier_quotations SET status = 'ACCEPTED' WHERE id = ? AND company_id = ?",
      [id, companyId]
    );

    // If linked to a PR, mark PR as CONVERTED_TO_PO and other quotes as REJECTED
    if (quote.requisition_id) {
      await conn.query(
        "UPDATE plastic_purchase_requisitions SET status = 'CONVERTED_TO_PO' WHERE id = ? AND company_id = ?",
        [quote.requisition_id, companyId]
      );
      await conn.query(
        "UPDATE plastic_supplier_quotations SET status = 'REJECTED' WHERE requisition_id = ? AND id != ? AND company_id = ?",
        [quote.requisition_id, id, companyId]
      );
    }

    await conn.query("COMMIT");

    res.status(201).json({
      success: true,
      message: `Quotation ${quote.quotation_no} accepted and converted to PO ${poNo}`,
      data: { purchaseOrderId: poId, po_no: poNo },
    });
  } catch (error) {
    await conn.query("ROLLBACK");
    console.error("Convert Quote to PO Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to convert quote to PO" });
  }
};
