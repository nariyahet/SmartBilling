const db = require("../config/db");

const generateNextPurchaseBillNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT purchase_bill_no FROM purchase_bills WHERE company_id = ? ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    const match = String(row.purchase_bill_no || "").trim().match(/^PB-(\d+)$/i);
    if (match) {
      const num = Number(match[1]);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `PB-${maxNum + 1}`;
};

const ALLOWED_PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"];

exports.getPurchaseBills = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { payment_status, supplier_id, search } = req.query;

    let sql = `
      SELECT
        pb.id,
        pb.company_id,
        pb.purchase_bill_no,
        pb.supplier_id,
        s.supplier_name,
        s.supplier_code,
        pb.truck_inward_id,
        ti.inward_no,
        ti.truck_number,
        pb.purchase_date,
        pb.subtotal,
        pb.discount_amount,
        pb.tax_percent,
        pb.tax_amount,
        pb.grand_total,
        pb.payment_status,
        pb.notes,
        pb.created_at,
        COUNT(pbi.id) AS total_items
      FROM purchase_bills pb
      JOIN suppliers s ON pb.supplier_id = s.id AND pb.company_id = s.company_id
      LEFT JOIN truck_inwards ti ON pb.truck_inward_id = ti.id AND pb.company_id = ti.company_id
      LEFT JOIN purchase_bill_items pbi ON pb.id = pbi.purchase_bill_id AND pb.company_id = pbi.company_id
      WHERE pb.company_id = ?
    `;
    const params = [companyId];

    if (payment_status) {
      sql += ` AND pb.payment_status = ?`;
      params.push(payment_status.toUpperCase());
    }

    if (supplier_id) {
      sql += ` AND pb.supplier_id = ?`;
      params.push(supplier_id);
    }

    if (search && search.trim()) {
      sql += ` AND (pb.purchase_bill_no LIKE ? OR s.supplier_name LIKE ? OR ti.truck_number LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += `
      GROUP BY pb.id
      ORDER BY pb.id DESC
    `;

    const [bills] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      purchase_bills: bills,
    });
  } catch (error) {
    console.error("Get Purchase Bills Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchase bills",
    });
  }
};

exports.getPurchaseBillById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const [rows] = await db.promise().query(
      `SELECT
        pb.*,
        s.supplier_name,
        s.supplier_code,
        s.mobile AS supplier_mobile,
        s.gst_number AS supplier_gst,
        s.address AS supplier_address,
        ti.inward_no,
        ti.truck_number,
        ti.net_weight AS truck_net_weight
       FROM purchase_bills pb
       JOIN suppliers s ON pb.supplier_id = s.id AND pb.company_id = s.company_id
       LEFT JOIN truck_inwards ti ON pb.truck_inward_id = ti.id AND pb.company_id = ti.company_id
       WHERE pb.id = ? AND pb.company_id = ?`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Purchase bill not found",
      });
    }

    const [items] = await db.promise().query(
      `SELECT
        pbi.*,
        rm.material_code,
        rm.plastic_type
       FROM purchase_bill_items pbi
       JOIN raw_materials rm ON pbi.raw_material_id = rm.id AND pbi.company_id = rm.company_id
       WHERE pbi.purchase_bill_id = ? AND pbi.company_id = ?
       ORDER BY pbi.id ASC`,
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      purchase_bill: {
        ...rows[0],
        items,
      },
    });
  } catch (error) {
    console.error("Get Purchase Bill Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchase bill details",
    });
  }
};

exports.createPurchaseBill = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id || null;

    const {
      supplier_id,
      truck_inward_id,
      purchase_date,
      items,
      discount_amount = 0,
      tax_percent,
      payment_status = "UNPAID",
      notes,
    } = req.body;

    // 1. Validation
    if (!supplier_id) {
      return res.status(400).json({
        success: false,
        message: "Supplier is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one raw material item is required",
      });
    }

    // 2. Validate supplier ownership
    const [suppliers] = await db.promise().query(
      `SELECT id, supplier_name, company_id FROM suppliers WHERE id = ? AND company_id = ?`,
      [supplier_id, companyId]
    );
    if (suppliers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found or belongs to another company",
      });
    }

    // 3. Validate truck inward ownership if provided
    if (truck_inward_id) {
      const [inwards] = await db.promise().query(
        `SELECT id, company_id FROM truck_inwards WHERE id = ? AND company_id = ?`,
        [truck_inward_id, companyId]
      );
      if (inwards.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Truck inward record not found or belongs to another company",
        });
      }
    }

    // 4. Validate items and prepare data
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const rawMaterialId = Number(item.raw_material_id);
      const quantity = Number(item.quantity);
      const rate = Number(item.rate);

      if (!rawMaterialId || isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Each item must have a valid raw material and positive quantity",
        });
      }

      if (isNaN(rate) || rate < 0) {
        return res.status(400).json({
          success: false,
          message: "Rate cannot be negative",
        });
      }

      const [materials] = await db.promise().query(
        `SELECT id, material_name, unit, company_id FROM raw_materials WHERE id = ? AND company_id = ?`,
        [rawMaterialId, companyId]
      );

      if (materials.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Raw material ID ${rawMaterialId} not found or belongs to another company`,
        });
      }

      const material = materials[0];
      const lineTotal = quantity * rate;
      subtotal += lineTotal;

      validatedItems.push({
        raw_material_id: material.id,
        material_name: material.material_name,
        quantity,
        unit: item.unit ? String(item.unit).trim().toUpperCase() : material.unit || "KG",
        rate,
        total: lineTotal,
      });
    }

    // 5. Discount calculation
    const discount = Number(discount_amount) || 0;
    if (discount < 0) {
      return res.status(400).json({
        success: false,
        message: "Discount amount cannot be negative",
      });
    }
    if (discount > subtotal) {
      return res.status(400).json({
        success: false,
        message: "Discount amount cannot exceed subtotal",
      });
    }

    const afterDiscount = subtotal - discount;

    // 6. Tax Settings Integration (Reuse existing business_settings.tax_enabled)
    const [settingsRows] = await db.promise().query(
      `SELECT tax_enabled, default_tax_percent FROM business_settings WHERE company_id = ? LIMIT 1`,
      [companyId]
    );

    // Strict boolean and numeric safe check for database TINYINT(1) (0 vs 1)
    const isTaxEnabled =
      settingsRows.length > 0 &&
      (settingsRows[0].tax_enabled === true || Number(settingsRows[0].tax_enabled) === 1);

    let finalTaxPercent = 0;
    if (isTaxEnabled) {
      const defaultRate = settingsRows[0]?.default_tax_percent !== undefined
        ? Number(settingsRows[0].default_tax_percent)
        : 18;
      const parsedTax = tax_percent !== undefined && tax_percent !== null && tax_percent !== ""
        ? Number(tax_percent)
        : defaultRate;

      if (isNaN(parsedTax) || parsedTax < 0 || parsedTax > 100) {
        return res.status(400).json({
          success: false,
          message: "Tax percentage must be a number between 0 and 100",
        });
      }
      finalTaxPercent = parsedTax;
    } else {
      // If company has GST/Tax disabled, strictly enforce 0%
      finalTaxPercent = 0;
    }

    const taxAmount = isTaxEnabled ? afterDiscount * (finalTaxPercent / 100) : 0;
    const grandTotal = afterDiscount + taxAmount;

    let purchaseBillNo = req.body.purchase_bill_no ? String(req.body.purchase_bill_no).trim() : "";
    if (!purchaseBillNo) {
      purchaseBillNo = await generateNextPurchaseBillNo(companyId);
    } else {
      const [existing] = await db.promise().query(
        `SELECT id FROM purchase_bills WHERE company_id = ? AND purchase_bill_no = ? LIMIT 1`,
        [companyId, purchaseBillNo]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Purchase bill number already exists for this company",
        });
      }
    }

    const billDate = purchase_date ? new Date(purchase_date) : new Date();
    const validatedPayment = ALLOWED_PAYMENT_STATUSES.includes(String(payment_status).toUpperCase())
      ? String(payment_status).toUpperCase()
      : "UNPAID";

    // 7. ATOMIC TRANSACTION
    const conn = db.promise();
    await conn.beginTransaction();

    try {
      // 7a. Insert purchase bill
      const [billResult] = await conn.query(
        `INSERT INTO purchase_bills
          (
            company_id,
            purchase_bill_no,
            supplier_id,
            truck_inward_id,
            purchase_date,
            subtotal,
            discount_amount,
            tax_percent,
            tax_amount,
            grand_total,
            payment_status,
            notes,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          purchaseBillNo,
          supplier_id,
          truck_inward_id || null,
          billDate,
          subtotal,
          discount,
          finalTaxPercent,
          taxAmount,
          grandTotal,
          validatedPayment,
          notes ? notes.trim() : null,
          adminId,
        ]
      );

      const purchaseBillId = billResult.insertId;

      // 7b. Insert items and update inventory atomically
      for (const item of validatedItems) {
        await conn.query(
          `INSERT INTO purchase_bill_items
            (
              company_id,
              purchase_bill_id,
              raw_material_id,
              material_name,
              quantity,
              unit,
              rate,
              total
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            purchaseBillId,
            item.raw_material_id,
            item.material_name,
            item.quantity,
            item.unit,
            item.rate,
            item.total,
          ]
        );

        // Fetch current stock
        const [stockRows] = await conn.query(
          `SELECT id, quantity, average_rate, stock_value
           FROM raw_material_stock
           WHERE company_id = ? AND raw_material_id = ?
           FOR UPDATE`,
          [companyId, item.raw_material_id]
        );

        let currentQty = 0;
        let currentStockValue = 0;

        if (stockRows.length > 0) {
          currentQty = Number(stockRows[0].quantity) || 0;
          currentStockValue = Number(stockRows[0].stock_value) || 0;
        }

        const newQty = currentQty + item.quantity;
        const newStockValue = currentStockValue + item.total;
        const newAvgRate = newQty > 0 ? newStockValue / newQty : item.rate;

        // Upsert stock record
        await conn.query(
          `INSERT INTO raw_material_stock
            (
              company_id,
              raw_material_id,
              quantity,
              average_rate,
              stock_value
            )
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              quantity = VALUES(quantity),
              average_rate = VALUES(average_rate),
              stock_value = VALUES(stock_value),
              updated_at = CURRENT_TIMESTAMP`,
          [
            companyId,
            item.raw_material_id,
            newQty,
            newAvgRate,
            newStockValue,
          ]
        );

        // Insert stock movement record (audit trail)
        await conn.query(
          `INSERT INTO raw_material_stock_movements
            (
              company_id,
              raw_material_id,
              movement_type,
              reference_type,
              reference_id,
              quantity,
              rate,
              total_value,
              balance_quantity,
              movement_date,
              remarks,
              created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            item.raw_material_id,
            "PURCHASE",
            "PURCHASE_BILL",
            purchaseBillId,
            item.quantity,
            item.rate,
            item.total,
            newQty,
            billDate,
            `Purchase Bill ${purchaseBillNo}`,
            adminId,
          ]
        );
      }

      // Phase 5: Auto-post accounting journal, supplier ledger & Input GST
      const { postPurchaseBillAccounting } = require("../utils/accountingHelper");
      await postPurchaseBillAccounting(conn, {
        companyId,
        purchaseBill: {
          id: purchaseBillId,
          purchase_bill_no: purchaseBillNo,
          supplier_id,
          purchase_date: billDate,
          subtotal,
          discount_amount: discount,
          tax_percent: finalTaxPercent,
          tax_amount: taxAmount,
          grand_total: grandTotal,
          payment_status: validatedPayment,
        },
        createdBy: adminId,
      });

      await conn.commit();

      res.status(201).json({
        success: true,
        message: "Purchase bill created successfully",
        purchase_bill: {
          id: purchaseBillId,
          purchase_bill_no: purchaseBillNo,
          supplier_id,
          subtotal,
          discount_amount: discount,
          tax_percent: finalTaxPercent,
          tax_amount: taxAmount,
          grand_total: grandTotal,
          payment_status: validatedPayment,
          items: validatedItems,
        },
      });
    } catch (txnError) {
      await conn.rollback();
      throw txnError;
    }
  } catch (error) {
    console.error("Create Purchase Bill Error:", error);
    next(error);
  }
};
