const db = require("../config/db");

exports.getCustomers = (req, res) => {
  const sql = `
    SELECT
      id,
      name,
      mobile,
      email,
      address,
      created_at
    FROM customers
    ORDER BY id DESC
  `;

  db.query(sql, (err, results) => {
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

  const sql = `
    SELECT
      id,
      name,
      mobile,
      email,
      address,
      created_at
    FROM customers
    WHERE id = ?
  `;

  db.query(sql, [id], (err, results) => {
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

  const sql = `
    INSERT INTO customers
    (name, mobile, email, address)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      name.trim(),
      mobile.trim(),
      email?.trim() || null,
      address?.trim() || null,
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

  const sql = `
    UPDATE customers
    SET
      name = ?,
      mobile = ?,
      email = ?,
      address = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      name.trim(),
      mobile.trim(),
      email?.trim() || null,
      address?.trim() || null,
      id,
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

exports.deleteCustomer = (req, res) => {
  const { id } = req.params;

  const checkCustomerSql = `
    SELECT id, name
    FROM customers
    WHERE id = ?
  `;

  db.query(checkCustomerSql, [id], (checkErr, customerResults) => {
    if (checkErr) {
      console.error("Check Customer Error:", checkErr);

      return res.status(500).json({
        success: false,
        message: "Failed to check customer",
      });
    }

    if (customerResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const checkInvoiceSql = `
      SELECT COUNT(*) AS invoiceCount
      FROM invoices
      WHERE customer_id = ?
    `;

    db.query(checkInvoiceSql, [id], (invoiceErr, invoiceResults) => {
      if (invoiceErr) {
        console.error("Check Customer Invoices Error:", invoiceErr);

        return res.status(500).json({
          success: false,
          message: "Failed to check customer invoices",
        });
      }

      const invoiceCount = Number(invoiceResults[0]?.invoiceCount) || 0;

      if (invoiceCount > 0) {
        return res.status(409).json({
          success: false,
          message:
            "This customer cannot be deleted because invoices are linked to this customer.",
          invoiceCount,
        });
      }

      const deleteSql = `
        DELETE FROM customers
        WHERE id = ?
      `;

      db.query(deleteSql, [id], (deleteErr, result) => {
        if (deleteErr) {
          console.error("Delete Customer Error:", deleteErr);

          return res.status(500).json({
            success: false,
            message: "Failed to delete customer",
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
          message: "Customer deleted successfully",
        });
      });
    });
  });
};
