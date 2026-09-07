const db = require("../config/db");

const generateNextSupplierCode = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT supplier_code FROM suppliers WHERE company_id = ? ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    const match = String(row.supplier_code || "").trim().match(/^SUP-(\d+)$/i);
    if (match) {
      const num = Number(match[1]);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `SUP-${maxNum + 1}`;
};

exports.getSuppliers = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, search } = req.query;

    let sql = `
      SELECT
        id,
        company_id,
        supplier_code,
        supplier_name,
        company_name,
        mobile,
        email,
        gst_number,
        address,
        city,
        state,
        payment_terms,
        opening_balance,
        status,
        notes,
        created_at,
        updated_at
      FROM suppliers
      WHERE company_id = ?
    `;
    const params = [companyId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status.toUpperCase());
    }

    if (search && search.trim()) {
      sql += ` AND (supplier_name LIKE ? OR supplier_code LIKE ? OR mobile LIKE ? OR company_name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY id DESC`;

    const [suppliers] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      suppliers,
    });
  } catch (error) {
    console.error("Get Suppliers Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch suppliers",
    });
  }
};

exports.getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const [rows] = await db.promise().query(
      `SELECT * FROM suppliers WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    res.status(200).json({
      success: true,
      supplier: rows[0],
    });
  } catch (error) {
    console.error("Get Supplier Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch supplier details",
    });
  }
};

exports.createSupplier = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const {
      supplier_name,
      company_name,
      mobile,
      email,
      gst_number,
      address,
      city,
      state,
      payment_terms,
      opening_balance = 0,
      status = "ACTIVE",
      notes,
    } = req.body;

    if (!supplier_name || !supplier_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Supplier name is required",
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

    let supplierCode = req.body.supplier_code ? String(req.body.supplier_code).trim() : "";
    if (!supplierCode) {
      supplierCode = await generateNextSupplierCode(companyId);
    } else {
      // Check uniqueness within company
      const [existing] = await db.promise().query(
        `SELECT id FROM suppliers WHERE company_id = ? AND supplier_code = ? LIMIT 1`,
        [companyId, supplierCode]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Supplier code already exists for this company",
        });
      }
    }

    const validatedStatus = status && status.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    const [result] = await db.promise().query(
      `INSERT INTO suppliers
        (
          company_id,
          supplier_code,
          supplier_name,
          company_name,
          mobile,
          email,
          gst_number,
          address,
          city,
          state,
          payment_terms,
          opening_balance,
          status,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        supplierCode,
        supplier_name.trim(),
        company_name ? company_name.trim() : null,
        mobile.trim(),
        email && email.trim() ? email.trim() : null,
        gst_number ? gst_number.trim() : null,
        address ? address.trim() : null,
        city ? city.trim() : null,
        state ? state.trim() : null,
        payment_terms ? payment_terms.trim() : null,
        Number(opening_balance) || 0,
        validatedStatus,
        notes ? notes.trim() : null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      supplier: {
        id: result.insertId,
        company_id: companyId,
        supplier_code: supplierCode,
        supplier_name: supplier_name.trim(),
        status: validatedStatus,
      },
    });
  } catch (error) {
    console.error("Create Supplier Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create supplier",
    });
  }
};

exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const [existing] = await db.promise().query(
      `SELECT * FROM suppliers WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    const {
      supplier_name,
      company_name,
      mobile,
      email,
      gst_number,
      address,
      city,
      state,
      payment_terms,
      opening_balance,
      status,
      notes,
    } = req.body;

    if (supplier_name !== undefined && !supplier_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Supplier name cannot be empty",
      });
    }

    if (mobile !== undefined && !mobile.trim()) {
      return res.status(400).json({
        success: false,
        message: "Mobile number cannot be empty",
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

    const current = existing[0];
    const updatedStatus = status ? status.toUpperCase() : current.status;

    await db.promise().query(
      `UPDATE suppliers
       SET
         supplier_name = ?,
         company_name = ?,
         mobile = ?,
         email = ?,
         gst_number = ?,
         address = ?,
         city = ?,
         state = ?,
         payment_terms = ?,
         opening_balance = ?,
         status = ?,
         notes = ?
       WHERE id = ? AND company_id = ?`,
      [
        supplier_name !== undefined ? supplier_name.trim() : current.supplier_name,
        company_name !== undefined ? company_name.trim() : current.company_name,
        mobile !== undefined ? mobile.trim() : current.mobile,
        email !== undefined ? (email ? email.trim() : null) : current.email,
        gst_number !== undefined ? (gst_number ? gst_number.trim() : null) : current.gst_number,
        address !== undefined ? (address ? address.trim() : null) : current.address,
        city !== undefined ? (city ? city.trim() : null) : current.city,
        state !== undefined ? (state ? state.trim() : null) : current.state,
        payment_terms !== undefined ? (payment_terms ? payment_terms.trim() : null) : current.payment_terms,
        opening_balance !== undefined ? Number(opening_balance) || 0 : current.opening_balance,
        updatedStatus,
        notes !== undefined ? (notes ? notes.trim() : null) : current.notes,
        id,
        companyId,
      ]
    );

    res.status(200).json({
      success: true,
      message: "Supplier updated successfully",
    });
  } catch (error) {
    console.error("Update Supplier Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update supplier",
    });
  }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    // Check if supplier has linked truck inwards or purchase bills
    const [inwards] = await db.promise().query(
      `SELECT id FROM truck_inwards WHERE supplier_id = ? AND company_id = ? LIMIT 1`,
      [id, companyId]
    );
    if (inwards.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete supplier: supplier has linked truck inwards.",
      });
    }

    const [bills] = await db.promise().query(
      `SELECT id FROM purchase_bills WHERE supplier_id = ? AND company_id = ? LIMIT 1`,
      [id, companyId]
    );
    if (bills.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete supplier: supplier has linked purchase bills.",
      });
    }

    const [result] = await db.promise().query(
      `DELETE FROM suppliers WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Supplier deleted successfully",
    });
  } catch (error) {
    console.error("Delete Supplier Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete supplier",
    });
  }
};
