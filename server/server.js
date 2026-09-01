require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const db = require("./config/db");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "https://smartbilling-sigma.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const customerRoutes = require("./routes/customerRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const businessSettingsRoutes = require("./routes/businessSettingsRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/business-settings", businessSettingsRoutes);

app.get("/api/debug/admin", (req, res) => {
  db.query(
    "SELECT id, name, email FROM admins WHERE email = ? LIMIT 1",
    ["admin@gmail.com"],
    (err, result) => {
      if (err) {
        console.error("Debug DB Error:", err);

        return res.status(500).json({
          success: false,
          message: "Database error",
        });
      }

      return res.status(200).json({
        success: true,
        count: result.length,
        admin: result[0] || null,
      });
    },
  );
});

app.get("/api/debug/db", (req, res) => {
  res.status(200).json({
    success: true,
    connection: {
      database_name: process.env.DB_NAME,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
    },
  });
});

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Smart Billing API Running",
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route Not Found",
    path: req.originalUrl,
  });
});

app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Smart Billing API Running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});