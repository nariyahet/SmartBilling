const db = require("../config/db");

exports.findAll = (companyId, callback) => {
  const sql = "SELECT * FROM products WHERE company_id = ? ORDER BY id DESC";
  db.query(sql, [companyId], callback);
};

exports.findById = (id, companyId, callback) => {
  const sql = "SELECT * FROM products WHERE id = ? AND company_id = ? LIMIT 1";
  db.query(sql, [id, companyId], callback);
};

exports.findLowStock = (companyId, threshold = 5, callback) => {
  const sql = `
    SELECT *
    FROM products
    WHERE company_id = ? AND stock <= ?
    ORDER BY stock ASC
  `;
  db.query(sql, [companyId, threshold], callback);
};

exports.create = (productData, callback) => {
  const { name, price, stock, description, company_id } = productData;
  const sql = `
    INSERT INTO products
    (name, price, stock, description, company_id)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(sql, [name, price, stock, description || null, company_id], callback);
};

exports.update = (id, companyId, productData, callback) => {
  const { name, price, stock, description } = productData;
  const sql = `
    UPDATE products
    SET name = ?, price = ?, stock = ?, description = ?
    WHERE id = ? AND company_id = ?
  `;
  db.query(sql, [name, price, stock, description || null, id, companyId], callback);
};

exports.delete = (id, companyId, callback) => {
  const sql = "DELETE FROM products WHERE id = ? AND company_id = ?";
  db.query(sql, [id, companyId], callback);
};
