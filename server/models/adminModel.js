const db = require("../config/db");

exports.findByEmail = (email, callback) => {
  const sql = `
    SELECT id, name, email, password
    FROM admins
    WHERE email = ?
    LIMIT 1
  `;

  db.query(sql, [email], callback);
};

exports.findById = (id, callback) => {
  const sql = `
    SELECT id, name, email
    FROM admins
    WHERE id = ?
    LIMIT 1
  `;

  db.query(sql, [id], callback);
};

exports.create = (name, email, password, callback) => {
  const sql = `
    INSERT INTO admins
    (name, email, password)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [name, email, password], callback);
};