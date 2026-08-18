const db = require("../config/db");

// CREATE INVOICE
const createInvoice = async (req, res, next) => {
  try {
    const {
      customer_id,
      items,
      discount_percent = 0,
      tax_percent = 18,
    } = req.body;

    // Validate customer
    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "Customer is required",
      });
    }

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product is required",
      });
    }

    // Check customer
    const [customers] = await db.promise().query(
      `SELECT id, name, mobile, email, address
             FROM customers
             WHERE id = ?`,
      [customer_id],
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    let subtotal = 0;
    const invoiceItems = [];

    // Check products and calculate subtotal
    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);

      if (!productId || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid product or quantity",
        });
      }

      const [products] = await db.promise().query(
        `SELECT id, name, price, stock
                 FROM products
                 WHERE id = ?`,
        [productId],
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

    // Discount
    const discountPercent = Number(discount_percent) || 0;

    const taxPercent = Number(tax_percent) || 0;

    const discountAmount = subtotal * (discountPercent / 100);

    const afterDiscount = subtotal - discountAmount;

    // Tax
    const taxAmount = afterDiscount * (taxPercent / 100);

    // Grand Total
    const grandTotal = afterDiscount + taxAmount;

    // Generate invoice number
    const invoiceNo = "INV-" + Date.now().toString().slice(-8);

    // Create invoice
    const invoiceResult = await db.promise().query(
      `INSERT INTO invoices
                (
                    invoice_no,
                    customer_id,
                    subtotal,
                    discount_percent,
                    discount_amount,
                    tax_percent,
                    tax_amount,
                    grand_total
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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

    // Insert invoice items
    for (const item of invoiceItems) {
      await db.promise().query(
        `INSERT INTO invoice_items
                (
                    invoice_id,
                    product_id,
                    product_name,
                    quantity,
                    price,
                    total
                )
                VALUES (?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.price,
          item.total,
        ],
      );

      // Reduce stock
      await db.promise().query(
        `UPDATE products
                 SET stock = stock - ?
                 WHERE id = ?`,
        [item.quantity, item.product_id],
      );
    }

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
  } catch (error) {
    next(error);
  }
};

// GET NEW INVOICE NUMBER
const getNewInvoice = async (req, res, next) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT invoice_no
             FROM invoices
             ORDER BY id DESC
             LIMIT 1`,
    );

    let nextNumber = 1001;

    if (rows.length > 0 && rows[0].invoice_no) {
      const lastInvoice = String(rows[0].invoice_no);

      const match = lastInvoice.match(/(\d+)$/);

      if (match) {
        nextNumber = Number(match[1]) + 1;
      }
    }

    const invoiceNo = `INV-${nextNumber}`;

    res.status(200).json({
      success: true,
      invoiceNo,
    });
  } catch (error) {
    console.error("Get New Invoice Error:", error);

    next(error);
  }
};

// GET ALL INVOICES
const getInvoices = async (req, res, next) => {
  try {
    const [invoices] = await db.promise().query(
      `
                SELECT
                    i.*,
                    c.name AS customer_name,
                    c.mobile AS customer_mobile
                FROM invoices i
                LEFT JOIN customers c
                    ON i.customer_id = c.id
                ORDER BY i.id DESC
                `,
    );

    res.status(200).json({
      success: true,
      invoices,
    });
  } catch (error) {
    next(error);
  }
};

// GET SINGLE INVOICE
const getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [invoices] = await db.promise().query(
      `
                SELECT
                    i.*,
                    c.name AS customer_name,
                    c.mobile AS customer_mobile,
                    c.email AS customer_email,
                    c.address AS customer_address
                FROM invoices i
                LEFT JOIN customers c
                    ON i.customer_id = c.id
                WHERE i.id = ?
                `,
      [id],
    );

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const [items] = await db.promise().query(
      `
                SELECT *
                FROM invoice_items
                WHERE invoice_id = ?
                ORDER BY id ASC
                `,
      [id],
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
