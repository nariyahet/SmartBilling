const db = require("../config/db");

exports.getProducts = (req, res) => {
  const sql = "SELECT * FROM products ORDER BY id DESC";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Get Products Error:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch products",
      });
    }

    res.status(200).json({
      success: true,
      products: results,
    });
  });
};

// GET LOW STOCK PRODUCTS
// ==========================================
exports.getLowStockProducts = (req, res) => {
  const sql = `
    SELECT *
    FROM products
    WHERE stock <= 5
    ORDER BY stock ASC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Low Stock Products Error:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch low stock products",
      });
    }

    res.status(200).json({
      success: true,
      products: results,
    });
  });
};

exports.getProductById = (req, res) => {
  const { id } = req.params;

  const sql = "SELECT * FROM products WHERE id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Get Product Error:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch product",
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      product: results[0],
    });
  });
};

exports.createProduct = (req, res) => {
  const { name, price, stock } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Product name is required",
    });
  }

  if (
    price === undefined ||
    price === null ||
    price === "" ||
    Number.isNaN(Number(price))
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid product price is required",
    });
  }

  if (
    stock === undefined ||
    stock === null ||
    stock === "" ||
    Number.isNaN(Number(stock))
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid product stock is required",
    });
  }

  const productPrice = Number(price);
  const productStock = Number(stock);

  if (productPrice < 0) {
    return res.status(400).json({
      success: false,
      message: "Product price cannot be negative",
    });
  }

  if (productStock < 0) {
    return res.status(400).json({
      success: false,
      message: "Product stock cannot be negative",
    });
  }

  const sql = `
    INSERT INTO products
    (name, price, stock)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [name.trim(), productPrice, productStock], (err, result) => {
    if (err) {
      console.error("Create Product Error:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to create product",
      });
    }

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      productId: result.insertId,
    });
  });
};

exports.updateProduct = (req, res) => {
  const { id } = req.params;
  const { name, price, stock } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: "Product name is required",
    });
  }

  if (
    price === undefined ||
    price === null ||
    price === "" ||
    Number.isNaN(Number(price))
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid product price is required",
    });
  }

  if (
    stock === undefined ||
    stock === null ||
    stock === "" ||
    Number.isNaN(Number(stock))
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid product stock is required",
    });
  }

  const productPrice = Number(price);
  const productStock = Number(stock);

  if (productPrice < 0) {
    return res.status(400).json({
      success: false,
      message: "Product price cannot be negative",
    });
  }

  if (productStock < 0) {
    return res.status(400).json({
      success: false,
      message: "Product stock cannot be negative",
    });
  }

  const sql = `
    UPDATE products
    SET
      name = ?,
      price = ?,
      stock = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [name.trim(), productPrice, productStock, id],
    (err, result) => {
      if (err) {
        console.error("Update Product Error:", err);

        return res.status(500).json({
          success: false,
          message: "Failed to update product",
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Product updated successfully",
      });
    },
  );
};

exports.deleteProduct = (req, res) => {
  const { id } = req.params;

  const checkProductSql = `
    SELECT id, name
    FROM products
    WHERE id = ?
  `;

  db.query(checkProductSql, [id], (err, productResults) => {
    if (err) {
      console.error("Check Product Before Delete Error:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to check product",
      });
    }

    if (productResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const checkInvoiceSql = `
      SELECT id
      FROM invoice_items
      WHERE product_id = ?
      LIMIT 1
    `;

    db.query(checkInvoiceSql, [id], (invoiceErr, invoiceResults) => {
      if (invoiceErr) {
        console.error("Check Product Invoice Link Error:", invoiceErr);

        return res.status(500).json({
          success: false,
          message: "Failed to check product invoice links",
        });
      }

      if (invoiceResults.length > 0) {
        return res.status(409).json({
          success: false,
          message:
            "This product cannot be deleted because invoices are linked to this product.",
        });
      }

      const deleteSql = `
        DELETE FROM products
        WHERE id = ?
      `;

      db.query(deleteSql, [id], (deleteErr, result) => {
        if (deleteErr) {
          console.error("Delete Product Error:", deleteErr);

          return res.status(500).json({
            success: false,
            message: "Failed to delete product",
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: "Product not found",
          });
        }

        res.status(200).json({
          success: true,
          message: "Product deleted successfully",
        });
      });
    });
  });
};
