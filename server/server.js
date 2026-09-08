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

// Plastic Recycling ERP Routes (Phase 1)
const supplierRoutes = require("./routes/supplierRoutes");
const rawMaterialRoutes = require("./routes/rawMaterialRoutes");
const truckInwardRoutes = require("./routes/truckInwardRoutes");
const weighmentRoutes = require("./routes/weighmentRoutes");
const purchaseBillRoutes = require("./routes/purchaseBillRoutes");
const rawMaterialStockRoutes = require("./routes/rawMaterialStockRoutes");

// Plastic Recycling ERP Routes (Phase 2 Operations)
const plantOperationsRoutes = require("./routes/plantOperationsRoutes");
const recipeRoutes = require("./routes/recipeRoutes");
const productionRoutes = require("./routes/productionRoutes");
const productionInventoryRoutes = require("./routes/productionInventoryRoutes");
const qualityRoutes = require("./routes/qualityRoutes");
const traceabilityRoutes = require("./routes/traceabilityRoutes");
const productionCostingRoutes = require("./routes/productionCostingRoutes");
const plasticReportsRoutes = require("./routes/plasticReportsRoutes");

// Plastic Recycling ERP Routes (Phase 3 Sales, Dispatch & Finance)
const salesOrderRoutes = require("./routes/salesOrderRoutes");
const dispatchRoutes = require("./routes/dispatchRoutes");
const transportRoutes = require("./routes/transportRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const receivablesRoutes = require("./routes/receivablesRoutes");
const customerLedgerRoutes = require("./routes/customerLedgerRoutes");
const salesReturnRoutes = require("./routes/salesReturnRoutes");
const creditNoteRoutes = require("./routes/creditNoteRoutes");
const debitNoteRoutes = require("./routes/debitNoteRoutes");
const phase3ReportsRoutes = require("./routes/phase3ReportsRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/business-settings", businessSettingsRoutes);

// Plastic Recycling ERP Endpoints (Phase 1)
app.use("/api/suppliers", supplierRoutes);
app.use("/api/raw-materials", rawMaterialRoutes);
app.use("/api/truck-inwards", truckInwardRoutes);
app.use("/api/weighments", weighmentRoutes);
app.use("/api/purchase-bills", purchaseBillRoutes);
app.use("/api/raw-material-stock", rawMaterialStockRoutes);

// Plastic Recycling ERP Endpoints (Phase 2 Operations)
app.use("/api/plastic-erp/plant", plantOperationsRoutes);
app.use("/api/plastic-erp/recipes", recipeRoutes);
app.use("/api/plastic-erp/production", productionRoutes);
app.use("/api/plastic-erp/inventory", productionInventoryRoutes);
app.use("/api/plastic-erp/quality", qualityRoutes);
app.use("/api/plastic-erp/traceability", traceabilityRoutes);
app.use("/api/plastic-erp/costing", productionCostingRoutes);
app.use("/api/plastic-erp/reports", plasticReportsRoutes);

// Plastic Recycling ERP Endpoints (Phase 3 Sales, Dispatch & Finance)
app.use("/api/plastic-erp/sales", salesOrderRoutes);
app.use("/api/plastic-erp/dispatch", dispatchRoutes);
app.use("/api/plastic-erp/transport", transportRoutes);
app.use("/api/plastic-erp/payments", paymentRoutes);
app.use("/api/plastic-erp/receivables", receivablesRoutes);
app.use("/api/plastic-erp/ledger", customerLedgerRoutes);
app.use("/api/plastic-erp/returns", salesReturnRoutes);
app.use("/api/plastic-erp/credit-notes", creditNoteRoutes);
app.use("/api/plastic-erp/debit-notes", debitNoteRoutes);
app.use("/api/plastic-erp/phase3-reports", phase3ReportsRoutes);



// Debug endpoints enabled only in development/testing environments
if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug/admin", (req, res) => {
    db.query(
      "SELECT id, name, email, company_id FROM admins WHERE email = ? LIMIT 1",
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
}

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