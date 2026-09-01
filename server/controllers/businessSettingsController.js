const BusinessSettings = require("../models/businessSettingsModel");
const { success, error } = require("../utils/response");

exports.getSettings = (req, res, next) => {
  BusinessSettings.getSettings((err, settings) => {
    if (err) {
      console.error("Get Business Settings Error:", err);
      return error(res, "Failed to retrieve business settings", 500);
    }

    return res.status(200).json({
      success: true,
      settings,
    });
  });
};

exports.updateSettings = (req, res, next) => {
  const {
    business_name,
    tagline,
    logo,
    address,
    phone,
    email,
    tax_number,
    default_tax_percent,
    currency,
    currency_symbol,
    terms_conditions,
  } = req.body;

  if (business_name !== undefined && !String(business_name).trim()) {
    return error(res, "Business name cannot be empty", 400);
  }

  if (default_tax_percent !== undefined) {
    const tax = Number(default_tax_percent);
    if (isNaN(tax) || tax < 0 || tax > 100) {
      return error(res, "Default tax percentage must be between 0 and 100", 400);
    }
  }

  if (email && String(email).trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return error(res, "Please provide a valid email address", 400);
    }
  }

  BusinessSettings.updateSettings(
    {
      business_name,
      tagline,
      logo,
      address,
      phone,
      email,
      tax_number,
      default_tax_percent,
      currency,
      currency_symbol,
      terms_conditions,
    },
    (err, updatedSettings) => {
      if (err) {
        console.error("Update Business Settings Error:", err);
        return error(res, "Failed to update business settings", 500);
      }

      return res.status(200).json({
        success: true,
        message: "Business settings updated successfully",
        settings: updatedSettings,
      });
    }
  );
};
