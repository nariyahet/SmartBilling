const db = require("../config/db");

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
      // Treat only standard sequential invoice numbers matching INV-<1 to 6 digits>
      // Ignore legacy timestamp-style 8-digit invoice numbers (e.g. INV-62755951)
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

const createInvoice = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const {
      customer_id,
      items,
      discount_percent = 0,
      tax_percent = 18,
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Customer is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product is required",
      });
    }

    const [customers] = await db.promise().query(
      `SELECT id, name, mobile, email, address
       FROM customers
       WHERE id = ? AND company_id = ?`,
      [customer_id, companyId],
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    let subtotal = 0;
    const invoiceItems = [];

    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);

      if (!productId || !quantity || quantity <= 0 || !Number.isInteger(quantity)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product or quantity. Quantity must be a positive integer.",
        });
      }

      const [products] = await db.promise().query(
        `SELECT id, name, price, stock
         FROM products
         WHERE id = ? AND company_id = ?`,
        [productId, companyId],
      );

      if (products.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Product ${productId} not found`,
        });
      }

      const product = products[0];

      if (Number(product.stock) < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      const total = Number(product.price) * quantity;

      subtotal += total;

      invoiceItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity,
        price: Number(product.price),
        total,
      });
    }

    const discountPercent =
      discount_percent !== undefined && discount_percent !== null && discount_percent !== ""
        ? Number(discount_percent)
        : 0;

    if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return res.status(400).json({
        success: false,
        message: "Discount percentage must be a number between 0 and 100",
      });
    }

    const taxPercent =
      tax_percent !== undefined && tax_percent !== null && tax_percent !== ""
        ? Number(tax_percent)
        : 18;

    if (isNaN(taxPercent) || taxPercent < 0 || taxPercent > 100) {
      return res.status(400).json({
        success: false,
        message: "Tax percentage must be a number between 0 and 100",
      });
    }

    const discountAmount = subtotal * (discountPercent / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (taxPercent / 100);
    const grandTotal = afterDiscount + taxAmount;

    let invoiceNo = req.body.invoice_no ? String(req.body.invoice_no).trim() : "";
    if (!invoiceNo) {
      invoiceNo = await generateNextSequentialInvoiceNo(companyId);
    }

    const conn = db.promise();
    await conn.beginTransaction();

    try {
      const invoiceResult = await conn.query(
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
            grand_total
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          invoiceNo,
          customer_id,
          subtotal,
          discountPercent,
          discountAmount,
          taxPercent,
          taxAmount,
          grandTotal,
        ],
      );

      const invoiceId = invoiceResult[0].insertId;

      for (const item of invoiceItems) {
        await conn.query(
          `INSERT INTO invoice_items
            (
              company_id,
              invoice_id,
              product_id,
              product_name,
              quantity,
              price,
              total
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            invoiceId,
            item.product_id,
            item.product_name,
            item.quantity,
            item.price,
            item.total,
          ],
        );

        await conn.query(
          `UPDATE products
           SET stock = stock - ?
           WHERE id = ? AND company_id = ?`,
          [item.quantity, item.product_id, companyId],
        );
      }

      await conn.commit();

      return res.status(201).json({
        success: true,
        message: "Invoice created successfully",
        invoice: {
          id: invoiceId,
          invoice_no: invoiceNo,
          customer: customers[0],
          items: invoiceItems,
          subtotal,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          tax_percent: taxPercent,
          tax_amount: taxAmount,
          grand_total: grandTotal,
        },
      });
    } catch (txnErr) {
      await conn.rollback();
      throw txnErr;
    }
  } catch (error) {
    next(error);
  }
};

const getNewInvoice = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const invoiceNo = await generateNextSequentialInvoiceNo(companyId);

    res.status(200).json({
      success: true,
      invoiceNo,
    });
  } catch (error) {
    console.error("Get New Invoice Error:", error);

    next(error);
  }
};

const getInvoices = async (req, res, next) => {
  try {
    const companyId = req.user.company_id;

    const [invoices] = await db.promise().query(
      `SELECT
         i.*,
         c.name AS customer_name,
         c.mobile AS customer_mobile
       FROM invoices i
       LEFT JOIN customers c
         ON i.customer_id = c.id
       WHERE i.company_id = ?
       ORDER BY i.id DESC`,
      [companyId],
    );

    res.status(200).json({
      success: true,
      invoices,
    });
  } catch (error) {
    next(error);
  }
};

const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const [invoices] = await db.promise().query(
      `SELECT
         i.*,
         c.name AS customer_name,
         c.mobile AS customer_mobile,
         c.email AS customer_email,
         c.address AS customer_address
       FROM invoices i
       LEFT JOIN customers c
         ON i.customer_id = c.id
       WHERE i.id = ? AND i.company_id = ?`,
      [id, companyId],
    );

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const [items] = await db.promise().query(
      `SELECT *
       FROM invoice_items
       WHERE invoice_id = ? AND company_id = ?
       ORDER BY id ASC`,
      [id, companyId],
    );

    res.status(200).json({
      success: true,
      invoice: {
        ...invoices[0],
        items,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInvoice,
  getNewInvoice,
  getInvoices,
  getInvoiceById,
};
