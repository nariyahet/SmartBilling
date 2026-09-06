require("dotenv").config();

const bcrypt = require("bcrypt");
const db = require("./config/db");

const createAdmin = async () => {
  const name = "Admin";
  const email = "admin@gmail.com";
  const plainPassword = "admin123";

  try {

    db.query(
      "SELECT id, email FROM admins WHERE email = ? LIMIT 1",
      [email],
      async (checkError, result) => {
        if (checkError) {
          console.error("Admin Check Failed ❌", checkError.message);

          db.end();
          return;
        }

        if (result.length > 0) {
          console.log("Admin Already Exists ✅");
          console.log("Email:", email);
          console.log("Password:", plainPassword);

          db.end();
          return;
        }

        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        db.query(
          "SELECT id FROM companies WHERE slug = ? LIMIT 1",
          ["smartbilling-main"],
          (compError, compResult) => {
            const companyId = compResult?.[0]?.id || null;

            const sql = `
              INSERT INTO admins
              (name, email, password, company_id)
              VALUES (?, ?, ?, ?)
            `;

            db.query(sql, [name, email, hashedPassword, companyId], (insertError) => {
              if (insertError) {
                console.error("Admin Create Failed ❌", insertError.message);

                db.end();
                return;
              }

              console.log("Admin Created Successfully ✅");

              console.log("Email:", email);
              console.log("Password:", plainPassword);

              db.end();
            });
          },
        );
      },
    );
  } catch (error) {
    console.error("Create Admin Error ❌", error.message);

    db.end();
  }
};

createAdmin();
