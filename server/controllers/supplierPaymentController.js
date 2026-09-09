const db = require("../config/db");
const { postSupplierPaymentAccounting } = require("../utils/accountingHelper");

const generateNextSupPaymentNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT payment_no FROM plastic_supplier_payments WHERE company_id = ? ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    if (row.payment_no) {
      const match = String(row.payment_no).match(/^SPAY-(\d+)$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return `SPAY-${maxNum + 1}`;
};

exports.getSupplierPayments = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { supplier_id, from_date, to_date, payment_method, search } = req.query;

    let sql = `
      SELECT
        sp.*,
        s.supplier_name,
        s.supplier_code,
        s.mobile AS supplier_mobile,
        pb.purchase_bill_no,
        pb.grand_total AS bill_amount,
        ba.account_name AS bank_account_name
      FROM plastic_supplier_payments sp
      JOIN suppliers s ON sp.supplier_id = s.id AND sp.company_id = s.company_id
      LEFT JOIN purchase_bills pb ON sp.purchase_bill_id = pb.id AND sp.company_id = pb.company_id
      LEFT JOIN plastic_bank_accounts ba ON sp.bank_account_id = ba.id AND sp.company_id = ba.company_id
      WHERE sp.company_id = ?
    `;
    const params = [companyId];

    if (supplier_id && supplier_id !== "ALL") {
      sql += ` AND sp.supplier_id = ?`;
      params.push(supplier_id);
    }
    if (payment_method && payment_method !== "ALL") {
      sql += ` AND sp.payment_method = ?`;
      params.push(payment_method);
    }
    if (from_date && to_date) {
      sql += ` AND sp.payment_date >= ? AND sp.payment_date <= ?`;
      params.push(from_date, to_date);
    }
    if (search && search.trim()) {
      sql += ` AND (sp.payment_no LIKE ? OR s.supplier_name LIKE ? OR sp.reference_number LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY sp.payment_date DESC, sp.id DESC`;

    const [payments] = await db.promise().query(sql, params);
    const totalAmount = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

    res.status(200).json({
      success: true,
      summary: {
        totalPayments: payments.length,
        totalAmount,
      },
      payments,
    });
  } catch (error) {
    console.error("Get Supplier Payments Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch supplier payments" });
  }
};

exports.getSupplierPaymentById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [payments] = await db.promise().query(
      `SELECT
        sp.*,
        s.supplier_name,
        s.supplier_code,
        s.mobile AS supplier_mobile,
        s.gst_number,
        pb.purchase_bill_no,
        ba.account_name AS bank_account_name,
        adm.name AS created_by_name
       FROM plastic_supplier_payments sp
       JOIN suppliers s ON sp.supplier_id = s.id AND sp.company_id = s.company_id
       LEFT JOIN purchase_bills pb ON sp.purchase_bill_id = pb.id AND sp.company_id = pb.company_id
       LEFT JOIN plastic_bank_accounts ba ON sp.bank_account_id = ba.id AND sp.company_id = ba.company_id
       LEFT JOIN admins adm ON sp.created_by = adm.id
       WHERE sp.id = ? AND sp.company_id = ? LIMIT 1`,
      [id, companyId]
    );

    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    res.status(200).json({ success: true, payment: payments[0] });
  } catch (error) {
    console.error("Get Supplier Payment Details Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payment details" });
  }
};

exports.recordSupplierPayment = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      supplier_id,
      purchase_bill_id,
      bank_account_id,
      payment_date = new Date().toISOString().split("T")[0],
      amount,
      payment_method = "BANK",
      reference_number,
      notes,
    } = req.body;

    const payAmount = Number(amount);
    if (!supplier_id || isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, message: "Supplier and a valid positive amount are required" });
    }

    const [supRows] = await conn.query(
      `SELECT id, supplier_name FROM suppliers WHERE id = ? AND company_id = ? LIMIT 1`,
      [supplier_id, companyId]
    );
    if (supRows.length === 0) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    const paymentNo = await generateNextSupPaymentNo(companyId);

    await conn.beginTransaction();

    try {
      const [resPayment] = await conn.query(
        `INSERT INTO plastic_supplier_payments
          (company_id, payment_no, supplier_id, purchase_bill_id, bank_account_id, payment_date, amount, payment_method, reference_number, notes, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?)`,
        [
          companyId,
          paymentNo,
          supplier_id,
          purchase_bill_id || null,
          bank_account_id || null,
          payment_date,
          payAmount,
          payment_method,
          reference_number || null,
          notes || null,
          adminId,
        ]
      );

      const paymentRecord = {
        id: resPayment.insertId,
        payment_no: paymentNo,
        amount: payAmount,
        payment_date,
        payment_method,
      };

      // If linked to a purchase bill, update its payment status
      if (purchase_bill_id) {
        const [billRows] = await conn.query(
          `SELECT id, grand_total FROM purchase_bills WHERE id = ? AND company_id = ?`,
          [purchase_bill_id, companyId]
        );
        if (billRows.length > 0) {
          const grandTotal = Number(billRows[0].grand_total || 0);
          const newStatus = payAmount >= grandTotal ? "PAID" : "PARTIAL";
          await conn.query(
            `UPDATE purchase_bills SET payment_status = ? WHERE id = ? AND company_id = ?`,
            [newStatus, purchase_bill_id, companyId]
          );
        }
      }

      // Auto-post accounting journal & update supplier ledger
      await postSupplierPaymentAccounting(conn, {
        companyId,
        payment: paymentRecord,
        supplierId: supplier_id,
        createdBy: adminId,
      });

      await conn.commit();

      res.status(201).json({
        success: true,
        message: "Supplier payment recorded successfully",
        paymentId: resPayment.insertId,
        paymentNo,
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Record Supplier Payment Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to record payment" });
  }
};

exports.getSupplierLedger = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { supplier_id } = req.params;
    const { from_date, to_date } = req.query;

    const [suppliers] = await db.promise().query(
      `SELECT * FROM suppliers WHERE id = ? AND company_id = ? LIMIT 1`,
      [supplier_id, companyId]
    );
    if (suppliers.length === 0) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }
    const supplier = suppliers[0];

    let sql = `
      SELECT sl.*, adm.name AS created_by_name
      FROM plastic_supplier_ledger sl
      LEFT JOIN admins adm ON sl.created_by = adm.id
      WHERE sl.supplier_id = ? AND sl.company_id = ?
    `;
    const params = [supplier_id, companyId];

    if (from_date) {
      sql += ` AND sl.transaction_date >= ?`;
      params.push(from_date);
    }
    if (to_date) {
      sql += ` AND sl.transaction_date <= ?`;
      params.push(to_date);
    }

    sql += ` ORDER BY sl.transaction_date ASC, sl.id ASC`;

    const [entries] = await db.promise().query(sql, params);

    const totalCredits = entries.reduce((acc, e) => acc + Number(e.credit || 0), 0);
    const totalDebits = entries.reduce((acc, e) => acc + Number(e.debit || 0), 0);
    const latestBalance = entries.length > 0 ? Number(entries[entries.length - 1].balance) : Number(supplier.opening_balance || 0);

    res.status(200).json({
      success: true,
      supplier,
      summary: {
        openingBalance: Number(supplier.opening_balance || 0),
        totalPurchases: totalCredits,
        totalPayments: totalDebits,
        closingBalance: latestBalance,
      },
      entries,
    });
  } catch (error) {
    console.error("Get Supplier Ledger Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch supplier ledger" });
  }
};
