const db = require("../config/db");

exports.findByEmail = (email, callback) => {
  const sql = `
    SELECT id, name, email, password, company_id
    FROM admins
    WHERE email = ?
    LIMIT 1
  `;

  db.query(sql, [email], callback);
};

exports.findById = (id, callback) => {
  const sql = `
    SELECT id, name, email, company_id
    FROM admins
    WHERE id = ?
    LIMIT 1
  `;

  db.query(sql, [id], callback);
};

exports.create = (name, email, password, companyIdOrCallback, maybeCallback) => {
  let companyId = null;
  let callback = companyIdOrCallback;
  if (typeof maybeCallback === "function") {
    companyId = companyIdOrCallback;
    callback = maybeCallback;
  }

  const sql = `
    INSERT INTO admins
    (name, email, password, company_id)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [name, email, password, companyId], callback);
};