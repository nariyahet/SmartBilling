const db = require("../config/db");

const DEFAULT_SETTINGS = {
  business_name: "Shiv Enterprises",
  tagline: "All Brands Electronic Appliances Sales & Service",
  logo: null,
  address: "Surat, Gujarat",
  phone: "+91 9876543210",
  email: "contact@smartbilling.com",
  tax_number: "24ABCDE1234F1Z5",
  default_tax_percent: 18.0,
  currency: "INR",
  currency_symbol: "₹",
  terms_conditions: "Goods once sold cannot be returned without valid terms.",
};

const ensureTableExists = (callback) => {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS business_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      business_name VARCHAR(255) NOT NULL DEFAULT 'Shiv Enterprises',
      tagline VARCHAR(255) DEFAULT 'All Brands Electronic Appliances Sales & Service',
      logo LONGTEXT,
      address TEXT,
      phone VARCHAR(50) DEFAULT '+91 9876543210',
      email VARCHAR(100) DEFAULT 'contact@smartbilling.com',
      tax_number VARCHAR(100) DEFAULT '24ABCDE1234F1Z5',
      default_tax_percent DECIMAL(5,2) NOT NULL DEFAULT 18.00,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      currency_symbol VARCHAR(10) NOT NULL DEFAULT '₹',
      terms_conditions TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  db.query(createTableSql, (tableErr) => {
    if (tableErr) {
      return callback(tableErr);
    }

    // Check if at least one row exists
    db.query("SELECT * FROM business_settings LIMIT 1", (selectErr, rows) => {
      if (selectErr) {
        return callback(selectErr);
      }

      if (rows.length === 0) {
        const insertSql = `
          INSERT INTO business_settings (
            business_name, tagline, logo, address, phone, email,
            tax_number, default_tax_percent, currency, currency_symbol, terms_conditions
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.query(
          insertSql,
          [
            DEFAULT_SETTINGS.business_name,
            DEFAULT_SETTINGS.tagline,
            DEFAULT_SETTINGS.logo,
            DEFAULT_SETTINGS.address,
            DEFAULT_SETTINGS.phone,
            DEFAULT_SETTINGS.email,
            DEFAULT_SETTINGS.tax_number,
            DEFAULT_SETTINGS.default_tax_percent,
            DEFAULT_SETTINGS.currency,
            DEFAULT_SETTINGS.currency_symbol,
            DEFAULT_SETTINGS.terms_conditions,
          ],
          (insertErr, insertResult) => {
            if (insertErr) {
              return callback(insertErr);
            }
            return callback(null, [{ id: insertResult.insertId, ...DEFAULT_SETTINGS }]);
          }
        );
      } else {
        return callback(null, rows);
      }
    });
  });
};

exports.getSettings = (callback) => {
  ensureTableExists((err, rows) => {
    if (err) {
      return callback(err);
    }
    return callback(null, rows[0] || DEFAULT_SETTINGS);
  });
};

exports.updateSettings = (data, callback) => {
  ensureTableExists((err, existingRows) => {
    if (err) {
      return callback(err);
    }

    const currentId = existingRows[0]?.id;

    const updatedData = {
      business_name: data.business_name !== undefined ? String(data.business_name).trim() : existingRows[0].business_name,
      tagline: data.tagline !== undefined ? String(data.tagline).trim() : (existingRows[0].tagline || ""),
      logo: data.logo !== undefined ? data.logo : existingRows[0].logo,
      address: data.address !== undefined ? String(data.address).trim() : (existingRows[0].address || ""),
      phone: data.phone !== undefined ? String(data.phone).trim() : (existingRows[0].phone || ""),
      email: data.email !== undefined ? String(data.email).trim() : (existingRows[0].email || ""),
      tax_number: data.tax_number !== undefined ? String(data.tax_number).trim() : (existingRows[0].tax_number || ""),
      default_tax_percent: data.default_tax_percent !== undefined ? Number(data.default_tax_percent) : Number(existingRows[0].default_tax_percent || 18),
      currency: data.currency !== undefined ? String(data.currency).trim().toUpperCase() : (existingRows[0].currency || "INR"),
      currency_symbol: data.currency_symbol !== undefined ? String(data.currency_symbol).trim() : (existingRows[0].currency_symbol || "₹"),
      terms_conditions: data.terms_conditions !== undefined ? String(data.terms_conditions).trim() : (existingRows[0].terms_conditions || ""),
    };

    if (currentId) {
      const updateSql = `
        UPDATE business_settings SET
          business_name = ?,
          tagline = ?,
          logo = ?,
          address = ?,
          phone = ?,
          email = ?,
          tax_number = ?,
          default_tax_percent = ?,
          currency = ?,
          currency_symbol = ?,
          terms_conditions = ?
        WHERE id = ?
      `;

      db.query(
        updateSql,
        [
          updatedData.business_name,
          updatedData.tagline,
          updatedData.logo,
          updatedData.address,
          updatedData.phone,
          updatedData.email,
          updatedData.tax_number,
          updatedData.default_tax_percent,
          updatedData.currency,
          updatedData.currency_symbol,
          updatedData.terms_conditions,
          currentId,
        ],
        (updateErr) => {
          if (updateErr) {
            return callback(updateErr);
          }
          return callback(null, { id: currentId, ...updatedData });
        }
      );
    } else {
      const insertSql = `
        INSERT INTO business_settings (
          business_name, tagline, logo, address, phone, email,
          tax_number, default_tax_percent, currency, currency_symbol, terms_conditions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(
        insertSql,
        [
          updatedData.business_name,
          updatedData.tagline,
          updatedData.logo,
          updatedData.address,
          updatedData.phone,
          updatedData.email,
          updatedData.tax_number,
          updatedData.default_tax_percent,
          updatedData.currency,
          updatedData.currency_symbol,
          updatedData.terms_conditions,
        ],
        (insertErr, insertResult) => {
          if (insertErr) {
            return callback(insertErr);
          }
          return callback(null, { id: insertResult.insertId, ...updatedData });
        }
      );
    }
  });
};
