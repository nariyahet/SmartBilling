const db = require("../config/db");

const trialMiddleware = (req, res, next) => {
  if (!req.user || !req.user.company_id) {
    return res.status(403).json({
      success: false,
      message: "No company associated with this account",
      code: "NO_COMPANY",
    });
  }

  const companyId = req.user.company_id;

  const sql = `
    SELECT id, name, slug, status, is_demo, subscription_status, trial_start_at, trial_end_at
    FROM companies
    WHERE id = ?
    LIMIT 1
  `;

  db.query(sql, [companyId], (err, rows) => {
    if (err) {
      console.error("Trial Middleware Database Error:", err);
      return res.status(500).json({
        success: false,
        message: "Database error during subscription verification",
      });
    }

    if (!rows || rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Company account not found",
        code: "COMPANY_NOT_FOUND",
      });
    }

    const company = rows[0];

    // Rule: Demo Company should continue working without trial expiration
    if (company.is_demo === 1 || company.id === 1) {
      req.company = company;
      return next();
    }

    // Check account status
    if (company.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Company account is suspended or inactive",
        code: "ACCOUNT_INACTIVE",
      });
    }

    // Rule: Active/paid subscriptions continue working
    if (
      company.subscription_status === "active" ||
      company.subscription_status === "lifetime"
    ) {
      req.company = company;
      return next();
    }

    // Rule: Trial accounts
    if (company.subscription_status === "trial") {
      if (!company.trial_end_at) {
        req.company = company;
        return next();
      }

      const now = new Date();
      const trialEnd = new Date(company.trial_end_at);

      if (now > trialEnd) {
        return res.status(403).json({
          success: false,
          message: "Your 3-day trial has expired.",
          code: "TRIAL_EXPIRED",
          trial_end_at: company.trial_end_at,
          company_name: company.name,
        });
      }

      req.company = company;
      return next();
    }

    // Any other subscription status (e.g. expired, cancelled)
    return res.status(403).json({
      success: false,
      message: "Subscription is not active",
      code: "SUBSCRIPTION_INACTIVE",
      subscription_status: company.subscription_status,
    });
  });
};

module.exports = trialMiddleware;
