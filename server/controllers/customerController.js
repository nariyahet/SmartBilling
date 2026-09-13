const db = require("../config/db");

exports.getCustomers = (req, res) => {
  const companyId = req.user.company_id;

  const sql = `
    SELECT
      id,
      name,
      mobile,
      email,
      address,
      created_at
    FROM customers
    WHERE company_id = ?
    ORDER BY id DESC
  `;

  db.query(sql, [companyId], (err, results) => {
    if (err) {
      console.error("Get Customers Error:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch customers",
      });
    }

    res.status(200).json({
      success: true,
      customers: results,
    });
  });
};

exports.getCustomerById = (req, res) => {
  const { id } = req.params;
  const companyId = req.user.company_id;

  const sql = `
    SELECT
      id,
      name,
      mobile,
      email,
      address,
      created_at
    FROM customers
    WHERE id = ? AND company_id = ?
  `;

  db.query(sql, [id, companyId], (err, results) => {
    if (err) {
      console.error("Get Customer Error:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch customer",
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      customer: results[0],
    });
  });
};

exports.createCustomer = (req, res) => {
  const { name, mobile, email, address } = req.body;
  const companyId = req.user.company_id;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Customer name is required",
    });
  }

  if (!mobile || !mobile.trim()) {
    return res.status(400).json({
      success: false,
      message: "Mobile number is required",
    });
  }

  if (email && String(email).trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }
  }

  const sql = `
    INSERT INTO customers
    (name, mobile, email, address, company_id)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      name.trim(),
      mobile.trim(),
      email?.trim() || null,
      address?.trim() || null,
      companyId,
    ],
    (err, result) => {
      if (err) {
        console.error("Create Customer Error:", err);

        return res.status(500).json({
          success: false,
          message: "Failed to create customer",
        });
      }

      return res.status(201).json({
        success: true,
        message: "Customer created successfully",
        customer: {
          id: result.insertId,
          name: name.trim(),
          mobile: mobile.trim(),
          email: email?.trim() || null,
          address: address?.trim() || null,
        },
      });
    },
  );
};

exports.updateCustomer = (req, res) => {
  const { id } = req.params;
  const { name, mobile, email, address } = req.body;
  const companyId = req.user.company_id;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Customer name is required",
    });
  }

  if (!mobile || !mobile.trim()) {
    return res.status(400).json({
      success: false,
      message: "Mobile number is required",
    });
  }

  if (email && String(email).trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }
  }

  const sql = `
    UPDATE customers
    SET
      name = ?,
      mobile = ?,
      email = ?,
      address = ?
    WHERE id = ? AND company_id = ?
  `;

  db.query(
    sql,
    [
      name.trim(),
      mobile.trim(),
      email?.trim() || null,
      address?.trim() || null,
      id,
      companyId,
    ],
    (err, result) => {
      if (err) {
        console.error("Update Customer Error:", err);

        return res.status(500).json({
          success: false,
          message: "Failed to update customer",
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Customer updated successfully",
      });
    },
  );
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const [customerResults] = await db.promise().query(
      "SELECT id, name FROM customers WHERE id = ? AND company_id = ? LIMIT 1",
      [id, companyId]
    );

    if (customerResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Check linked invoices
    const [invoiceRows] = await db.promise().query(
      "SELECT COUNT(*) AS count FROM invoices WHERE customer_id = ? AND company_id = ?",
      [id, companyId]
    );
    const invoiceCount = Number(invoiceRows[0]?.count) || 0;
    if (invoiceCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete customer "${customerResults[0].name}" because ${invoiceCount} invoice(s) are linked to this customer.`,
        invoiceCount,
      });
    }

    // Check linked sales orders
    const [orderRows] = await db.promise().query(
      "SELECT COUNT(*) AS count FROM plastic_sales_orders WHERE customer_id = ? AND company_id = ?",
      [id, companyId]
    );
    const orderCount = Number(orderRows[0]?.count) || 0;
    if (orderCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete customer "${customerResults[0].name}" because ${orderCount} sales order(s) are linked to this customer.`,
        orderCount,
      });
    }

    // Check linked payments
    const [paymentRows] = await db.promise().query(
      "SELECT COUNT(*) AS count FROM plastic_payments WHERE customer_id = ? AND company_id = ?",
      [id, companyId]
    );
    const paymentCount = Number(paymentRows[0]?.count) || 0;
    if (paymentCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete customer "${customerResults[0].name}" because ${paymentCount} payment record(s) are linked to this customer.`,
        paymentCount,
      });
    }

    const [deleteResult] = await db.promise().query(
      "DELETE FROM customers WHERE id = ? AND company_id = ?",
      [id, companyId]
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error("Delete Customer Error:", error);
    if (error.errno === 1451 || error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete this customer because active transactional records (orders, dispatches, payments, or ledger entries) reference this customer.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete customer",
    });
  }
};
