const db = require("../config/db");
const { recordLedgerEntry } = require("../utils/ledgerHelper");

const generateNextPaymentNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT payment_no
     FROM plastic_payments
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    if (row.payment_no) {
      const match = String(row.payment_no).match(/^PAY-(\d+)$/i);
      if (match) {
        const num = Number(match[1]);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return `PAY-${maxNum + 1}`;
};

exports.getNextPaymentNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextPaymentNo(companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next Payment No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate payment number" });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { customer_id, invoice_id, payment_method, status, from_date, to_date } = req.query;

    let sql = `
      SELECT
        p.*,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        inv.invoice_no,
        inv.grand_total AS invoice_grand_total,
        inv.payment_status AS current_invoice_status
      FROM plastic_payments p
      JOIN customers c ON p.customer_id = c.id AND p.company_id = c.company_id
      LEFT JOIN invoices inv ON p.invoice_id = inv.id AND p.company_id = inv.company_id
      WHERE p.company_id = ?
    `;
    const params = [companyId];

    if (customer_id) {
      sql += ` AND p.customer_id = ?`;
      params.push(customer_id);
    }
    if (invoice_id) {
      sql += ` AND p.invoice_id = ?`;
      params.push(invoice_id);
    }
    if (payment_method) {
      sql += ` AND p.payment_method = ?`;
      params.push(payment_method);
    }
    if (status) {
      sql += ` AND p.status = ?`;
      params.push(status);
    }
    if (from_date && to_date) {
      sql += ` AND p.payment_date >= ? AND p.payment_date <= ?`;
      params.push(from_date, to_date);
    }

    sql += ` ORDER BY p.id DESC`;

    const [payments] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error("Get Payments Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payments" });
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [payments] = await db.promise().query(
      `SELECT
        p.*,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        c.email AS customer_email,
        c.address AS customer_address,
        inv.invoice_no,
        inv.grand_total AS invoice_total
       FROM plastic_payments p
       JOIN customers c ON p.customer_id = c.id AND p.company_id = c.company_id
       LEFT JOIN invoices inv ON p.invoice_id = inv.id AND p.company_id = inv.company_id
       WHERE p.id = ? AND p.company_id = ?`,
      [id, companyId]
    );

    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    res.status(200).json({
      success: true,
      payment: payments[0],
    });
  } catch (error) {
    console.error("Get Payment Details Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payment details" });
  }
};

exports.createPayment = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      customer_id,
      invoice_id,
      payment_date = new Date().toISOString().split("T")[0],
      amount,
      payment_method = "BANK",
      reference_number,
      notes,
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ success: false, message: "Customer is required" });
    }

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, message: "A valid positive payment amount is required" });
    }

    const validMethods = ["CASH", "BANK", "UPI", "CHEQUE", "OTHER"];
    if (!validMethods.includes(payment_method)) {
      return res.status(400).json({ success: false, message: "Invalid payment method" });
    }

    // Verify customer
    const [customers] = await conn.query(
      `SELECT id, name FROM customers WHERE id = ? AND company_id = ?`,
      [customer_id, companyId]
    );
    if (customers.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found or belongs to another company" });
    }

    // If invoice_id is specified, verify ownership
    let invoice = null;
    if (invoice_id) {
      const [invRows] = await conn.query(
        `SELECT id, invoice_no, grand_total, paid_amount, payment_status FROM invoices WHERE id = ? AND company_id = ?`,
        [invoice_id, companyId]
      );
      if (invRows.length === 0) {
        return res.status(404).json({ success: false, message: "Invoice not found or belongs to another company" });
      }
      invoice = invRows[0];
    }

    const paymentNo = await generateNextPaymentNo(companyId);

    await conn.beginTransaction();

    try {
      // 1. Insert payment record
      const [paymentResult] = await conn.query(
        `INSERT INTO plastic_payments
          (company_id, payment_no, customer_id, invoice_id, payment_date, amount, payment_method, reference_number, notes, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?)`,
        [
          companyId,
          paymentNo,
          customer_id,
          invoice_id || null,
          payment_date,
          payAmount,
          payment_method,
          reference_number || null,
          notes || null,
          adminId,
        ]
      );

      const paymentId = paymentResult.insertId;

      // 2. If invoice linked, update invoice paid_amount and payment_status
      if (invoice) {
        const newPaidAmount = (Number(invoice.paid_amount) || 0) + payAmount;
        const grandTotal = Number(invoice.grand_total) || 0;
        let newStatus = "PARTIAL";
        if (newPaidAmount >= grandTotal) {
          newStatus = "PAID";
        } else if (newPaidAmount <= 0) {
          newStatus = "UNPAID";
        }

        await conn.query(
          `UPDATE invoices
           SET paid_amount = ?, payment_status = ?
           WHERE id = ? AND company_id = ?`,
          [newPaidAmount, newStatus, invoice.id, companyId]
        );
      }

      // 3. Post credit entry to customer ledger
      const refNote = invoice
        ? `Payment ${paymentNo} received for Invoice ${invoice.invoice_no}`
        : `Payment ${paymentNo} received on account (${payment_method})`;

      await recordLedgerEntry(conn, {
        companyId,
        customerId: customer_id,
        transactionDate: payment_date,
        referenceType: "PAYMENT",
        referenceId: paymentId,
        referenceNo: paymentNo,
        debit: 0.00,
        credit: payAmount,
        notes: notes ? `${refNote} - ${notes}` : refNote,
        createdBy: adminId,
      });

      // Phase 5: Auto-post accounting journal & bank/cash ledger transaction
      const { postPaymentReceivedAccounting } = require("../utils/accountingHelper");
      await postPaymentReceivedAccounting(conn, {
        companyId,
        payment: {
          id: paymentId,
          payment_no: paymentNo,
          amount: payAmount,
          payment_date,
          payment_method,
        },
        customerId: customer_id,
        createdBy: adminId,
      });

      await conn.commit();

      res.status(201).json({
        success: true,
        message: "Payment recorded successfully",
        paymentId,
        paymentNo,
        amount: payAmount,
        status: "RECEIVED",
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Create Payment Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to record payment" });
  }
};

exports.cancelPayment = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const { id } = req.params;

    const [payments] = await conn.query(
      `SELECT * FROM plastic_payments WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const payment = payments[0];
    if (payment.status === "CANCELLED") {
      return res.status(400).json({ success: false, message: "Payment is already cancelled" });
    }

    await conn.beginTransaction();

    try {
      // 1. Revert invoice paid amount if linked
      if (payment.invoice_id) {
        const [invRows] = await conn.query(
          `SELECT id, grand_total, paid_amount FROM invoices WHERE id = ? AND company_id = ?`,
          [payment.invoice_id, companyId]
        );

        if (invRows.length > 0) {
          const inv = invRows[0];
          const newPaid = Math.max(0, (Number(inv.paid_amount) || 0) - Number(payment.amount));
          const grandTotal = Number(inv.grand_total) || 0;
          let newStatus = "UNPAID";
          if (newPaid >= grandTotal) {
            newStatus = "PAID";
          } else if (newPaid > 0) {
            newStatus = "PARTIAL";
          }

          await conn.query(
            `UPDATE invoices SET paid_amount = ?, payment_status = ? WHERE id = ? AND company_id = ?`,
            [newPaid, newStatus, payment.invoice_id, companyId]
          );
        }
      }

      // 2. Post reversing debit entry to customer ledger
      await recordLedgerEntry(conn, {
        companyId,
        customerId: payment.customer_id,
        transactionDate: new Date(),
        referenceType: "PAYMENT",
        referenceId: payment.id,
        referenceNo: payment.payment_no,
        debit: Number(payment.amount),
        credit: 0.00,
        notes: `Cancelled Payment ${payment.payment_no} Reversal`,
        createdBy: adminId,
      });

      // 3. Mark payment as CANCELLED
      await conn.query(
        `UPDATE plastic_payments SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
        [id, companyId]
      );

      await conn.commit();

      res.status(200).json({
        success: true,
        message: "Payment cancelled and ledger reversed successfully",
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    console.error("Cancel Payment Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to cancel payment" });
  }
};
