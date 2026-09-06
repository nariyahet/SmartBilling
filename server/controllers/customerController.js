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

exports.deleteCustomer = (req, res) => {
  const { id } = req.params;
  const companyId = req.user.company_id;

  const checkCustomerSql = `
    SELECT id, name
    FROM customers
    WHERE id = ? AND company_id = ?
  `;

  db.query(checkCustomerSql, [id, companyId], (checkErr, customerResults) => {
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
      WHERE customer_id = ? AND company_id = ?
    `;

    db.query(checkInvoiceSql, [id, companyId], (invoiceErr, invoiceResults) => {
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
        WHERE id = ? AND company_id = ?
      `;

      db.query(deleteSql, [id, companyId], (deleteErr, result) => {
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
