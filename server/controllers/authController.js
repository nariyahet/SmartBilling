const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const db = require("../config/db");
const Admin = require("../models/adminModel");
const { success, error } = require("../utils/response");

// Helper to generate a unique slug for a company
const generateUniqueSlug = async (companyName, conn) => {
  let baseSlug = companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!baseSlug) {
    baseSlug = "company";
  }

  const reservedSlugs = ["demo-company", "smartbilling-main", "admin", "system", "api"];
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    if (reservedSlugs.includes(slug)) {
      counter++;
      slug = `${baseSlug}-${counter}`;
      continue;
    }

    const [existing] = await conn.query(
      "SELECT id FROM companies WHERE slug = ? LIMIT 1",
      [slug]
    );
    if (!existing || existing.length === 0) {
      return slug;
    }
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
};

exports.register = async (req, res) => {
  const companyName = req.body.company_name?.trim();
  const ownerName = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;
  const confirmPassword = req.body.confirm_password;

  // Validation: Required fields
  if (!companyName || !ownerName || !email || !password || !confirmPassword) {
    return error(
      res,
      "All fields are required: company name, owner name, email, password, and confirm password",
      400
    );
  }

  // Validation: Email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return error(res, "Please provide a valid email address", 400);
  }

  // Validation: Password length
  if (password.length < 8) {
    return error(
      res,
      "Password must be at least 8 characters long",
      400
    );
  }

  // Validation: Password confirmation
  if (password !== confirmPassword) {
    return error(
      res,
      "Password confirmation does not match",
      400
    );
  }

  const conn = db.promise();

  try {
    // Check if email already exists
    const [existingAdmins] = await conn.query(
      "SELECT id FROM admins WHERE email = ? LIMIT 1",
      [email]
    );

    if (existingAdmins && existingAdmins.length > 0) {
      return error(
        res,
        "An account with this email address already exists",
        409
      );
    }

    // Begin atomic transaction
    await conn.beginTransaction();

    // 1. Generate unique slug
    const slug = await generateUniqueSlug(companyName, conn);

    // 2. Insert new company with 3-day trial
    const trialStartAt = new Date();
    const trialEndAt = new Date(trialStartAt.getTime() + 3 * 24 * 60 * 60 * 1000);

    const [companyResult] = await conn.query(
      `INSERT INTO companies
       (name, slug, status, is_demo, subscription_status, trial_start_at, trial_end_at)
       VALUES (?, ?, 'active', 0, 'trial', ?, ?)`,
      [companyName, slug, trialStartAt, trialEndAt]
    );

    const companyId = companyResult.insertId;

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Insert new admin for the company
    const [adminResult] = await conn.query(
      `INSERT INTO admins (name, email, password, company_id)
       VALUES (?, ?, ?, ?)`,
      [ownerName, email, hashedPassword, companyId]
    );

    const adminId = adminResult.insertId;

    // 5. Update company owner_admin_id
    await conn.query(
      "UPDATE companies SET owner_admin_id = ? WHERE id = ?",
      [adminId, companyId]
    );

    // 6. Seed initial business_settings
    await conn.query(
      `INSERT INTO business_settings
       (company_id, business_name, email, currency, currency_symbol, default_tax_percent)
       VALUES (?, ?, ?, 'INR', '₹', 18.00)`,
      [companyId, companyName, email]
    );

    // 7. Commit transaction
    await conn.commit();

    // 8. Fetch the newly created company data with exact timestamps
    const [companyRows] = await conn.query(
      `SELECT id, name, slug, status, is_demo, subscription_status, trial_start_at, trial_end_at
       FROM companies
       WHERE id = ? LIMIT 1`,
      [companyId]
    );

    const createdCompany = companyRows[0];

    // 9. Generate JWT
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing");
      return error(res, "Server configuration error", 500);
    }

    const token = jwt.sign(
      {
        id: adminId,
        email: email,
        company_id: companyId,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful. Welcome to your 3-day free trial!",
      data: {
        token,
        admin: {
          id: adminId,
          name: ownerName,
          email: email,
          company_id: companyId,
        },
        company: createdCompany,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error("Registration Transaction Error:", err);
    return error(res, "Registration failed due to a server error", 500);
  }
};

exports.login = (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password;

  if (!email || !password) {
    return error(
      res,
      "Email and password are required",
      400
    );
  }

  Admin.findByEmail(email, async (err, result) => {
    if (err) {
      console.error("Login Database Error:", err);

      return error(
        res,
        "Database error",
        500
      );
    }

    if (result.length === 0) {
      return error(
        res,
        "Invalid email or password",
        401
      );
    }

    const admin = result[0];

    try {
      const passwordMatch = await bcrypt.compare(
        password,
        admin.password
      );

      if (!passwordMatch) {
        return error(
          res,
          "Invalid email or password",
          401
        );
      }

      if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is missing");

        return error(
          res,
          "Server configuration error",
          500
        );
      }

      const token = jwt.sign(
        {
          id: admin.id,
          email: admin.email,
          company_id: admin.company_id,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "1d",
        }
      );

      // Fetch company details to return with login response
      let company = null;
      if (admin.company_id) {
        const [companyRows] = await db.promise().query(
          `SELECT id, name, slug, status, is_demo, subscription_status, trial_start_at, trial_end_at
           FROM companies
           WHERE id = ? LIMIT 1`,
          [admin.company_id]
        );
        company = companyRows[0] || null;
      }

      return success(
        res,
        "Login successful",
        {
          token,
          admin: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            company_id: admin.company_id,
          },
          company,
        }
      );
    } catch (err) {
      console.error("Password/JWT Error:", err);

      return error(
        res,
        "Authentication failed",
        500
      );
    }
  });
};

exports.getMe = async (req, res) => {
  try {
    const [admins] = await db.promise().query(
      "SELECT id, name, email, company_id FROM admins WHERE id = ? LIMIT 1",
      [req.user.id]
    );

    if (!admins || admins.length === 0) {
      return error(res, "User not found", 404);
    }

    const admin = admins[0];

    let company = null;
    if (admin.company_id) {
      const [companyRows] = await db.promise().query(
        `SELECT id, name, slug, status, is_demo, subscription_status, trial_start_at, trial_end_at
         FROM companies
         WHERE id = ? LIMIT 1`,
        [admin.company_id]
      );
      company = companyRows[0] || null;
    }

    return success(res, "Authenticated user details", {
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        company_id: admin.company_id,
      },
      company,
    });
  } catch (err) {
    console.error("getMe Error:", err);
    return error(res, "Failed to retrieve user details", 500);
  }
};
