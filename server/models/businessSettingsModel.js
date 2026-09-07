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
  tax_enabled: true,
  currency: "INR",
  currency_symbol: "₹",
  terms_conditions: "Goods once sold cannot be returned without valid terms.",
};

const ensureCompanySettings = (companyId, callback) => {
  const selectSql = "SELECT * FROM business_settings WHERE company_id = ? LIMIT 1";

  db.query(selectSql, [companyId], (selectErr, rows) => {
    if (selectErr) {
      return callback(selectErr);
    }

    if (rows.length === 0) {
      const insertSql = `
        INSERT INTO business_settings (
          company_id, business_name, tagline, logo, address, phone, email,
          tax_number, default_tax_percent, tax_enabled, currency, currency_symbol, terms_conditions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(
        insertSql,
        [
          companyId,
          DEFAULT_SETTINGS.business_name,
          DEFAULT_SETTINGS.tagline,
          DEFAULT_SETTINGS.logo,
          DEFAULT_SETTINGS.address,
          DEFAULT_SETTINGS.phone,
          DEFAULT_SETTINGS.email,
          DEFAULT_SETTINGS.tax_number,
          DEFAULT_SETTINGS.default_tax_percent,
          DEFAULT_SETTINGS.tax_enabled,
          DEFAULT_SETTINGS.currency,
          DEFAULT_SETTINGS.currency_symbol,
          DEFAULT_SETTINGS.terms_conditions,
        ],
        (insertErr, insertResult) => {
          if (insertErr) {
            return callback(insertErr);
          }
          return callback(null, [
            { id: insertResult.insertId, company_id: companyId, ...DEFAULT_SETTINGS },
          ]);
        }
      );
    } else {
      return callback(null, rows);
    }
  });
};

exports.getSettings = (companyId, callback) => {
  ensureCompanySettings(companyId, (err, rows) => {
    if (err) {
      return callback(err);
    }
    const settings = rows[0] || { company_id: companyId, ...DEFAULT_SETTINGS };
    return callback(null, {
      ...settings,
      tax_enabled: settings.tax_enabled !== undefined ? Boolean(settings.tax_enabled) : true,
    });
  });
};

exports.updateSettings = (companyId, data, callback) => {
  ensureCompanySettings(companyId, (err, existingRows) => {
    if (err) {
      return callback(err);
    }

    const existing = existingRows[0] || DEFAULT_SETTINGS;

    const updatedData = {
      business_name:
        data.business_name !== undefined
          ? String(data.business_name).trim()
          : existing.business_name,
      tagline:
        data.tagline !== undefined
          ? String(data.tagline).trim()
          : (existing.tagline || ""),
      logo: data.logo !== undefined ? data.logo : existing.logo,
      address:
        data.address !== undefined
          ? String(data.address).trim()
          : (existing.address || ""),
      phone:
        data.phone !== undefined
          ? String(data.phone).trim()
          : (existing.phone || ""),
      email:
        data.email !== undefined
          ? String(data.email).trim()
          : (existing.email || ""),
      tax_number:
        data.tax_number !== undefined
          ? String(data.tax_number).trim()
          : (existing.tax_number || ""),
      default_tax_percent:
        data.default_tax_percent !== undefined
          ? Number(data.default_tax_percent)
          : Number(existing.default_tax_percent || 18),
      tax_enabled:
        data.tax_enabled !== undefined
          ? Boolean(data.tax_enabled)
          : (existing.tax_enabled !== undefined ? Boolean(existing.tax_enabled) : true),
      currency:
        data.currency !== undefined
          ? String(data.currency).trim().toUpperCase()
          : (existing.currency || "INR"),
      currency_symbol:
        data.currency_symbol !== undefined
          ? String(data.currency_symbol).trim()
          : (existing.currency_symbol || "₹"),
      terms_conditions:
        data.terms_conditions !== undefined
          ? String(data.terms_conditions).trim()
          : (existing.terms_conditions || ""),
    };

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
        tax_enabled = ?,
        currency = ?,
        currency_symbol = ?,
        terms_conditions = ?
      WHERE company_id = ?
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
        updatedData.tax_enabled,
        updatedData.currency,
        updatedData.currency_symbol,
        updatedData.terms_conditions,
        companyId,
      ],
      (updateErr) => {
        if (updateErr) {
          return callback(updateErr);
        }
        return callback(null, {
          id: existing.id,
          company_id: companyId,
          ...updatedData,
        });
      }
    );
  });
};
