const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const Admin = require("../models/adminModel");

const { success, error } = require("../utils/response");

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
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "1d",
        }
      );

      return success(
        res,
        "Login successful",
        {
          token,
          admin: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
          },
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
