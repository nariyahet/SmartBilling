import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import TrialExpired from "./pages/TrialExpired";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Invoices from "./pages/Invoices";
import InvoicePreview from "./pages/InvoicePreview";
import InvoicesHistory from "./pages/InvoicesHistory";
import SalesReport from "./pages/SalesReport";
import BusinessSettings from "./pages/BusinessSettings";
import PlasticDashboard from "./pages/PlasticDashboard";
import PlasticSuppliers from "./pages/PlasticSuppliers";
import PlasticRawMaterials from "./pages/PlasticRawMaterials";
import PlasticTruckInward from "./pages/PlasticTruckInward";
import PlasticWeighment from "./pages/PlasticWeighment";
import PlasticPurchaseBills from "./pages/PlasticPurchaseBills";
import PlasticStock from "./pages/PlasticStock";
import PlasticProduction from "./pages/PlasticProduction";
import PlasticRecipes from "./pages/PlasticRecipes";
import PlasticWipFg from "./pages/PlasticWipFg";
import PlasticQuality from "./pages/PlasticQuality";
import PlasticScrapRegrind from "./pages/PlasticScrapRegrind";
import PlasticMachines from "./pages/PlasticMachines";
import PlasticOperations from "./pages/PlasticOperations";
import PlasticTraceability from "./pages/PlasticTraceability";
import PlasticCosting from "./pages/PlasticCosting";
import PlasticReports from "./pages/PlasticReports";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/trial-expired" element={<TrialExpired />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <Products />
            </ProtectedRoute>
          }
        />

        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <Customers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/invoices/create"
          element={
            <ProtectedRoute>
              <Invoices />
            </ProtectedRoute>
          }
        />

        <Route
          path="/invoices/history"
          element={
            <ProtectedRoute>
              <InvoicesHistory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/invoice/:id"
          element={
            <ProtectedRoute>
              <InvoicePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/sales-report"
          element={
            <ProtectedRoute>
              <SalesReport />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <BusinessSettings />
            </ProtectedRoute>
          }
        />

        {/* ---------------------------------------------------- */}
        {/* Plastic Recycling ERP Routes (Kim, Surat Operations) */}
        {/* ---------------------------------------------------- */}
        <Route
          path="/plastic-erp"
          element={
            <ProtectedRoute>
              <PlasticDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/suppliers"
          element={
            <ProtectedRoute>
              <PlasticSuppliers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/raw-materials"
          element={
            <ProtectedRoute>
              <PlasticRawMaterials />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/truck-inward"
          element={
            <ProtectedRoute>
              <PlasticTruckInward />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/weighment"
          element={
            <ProtectedRoute>
              <PlasticWeighment />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/purchase-bills"
          element={
            <ProtectedRoute>
              <PlasticPurchaseBills />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/stock"
          element={
            <ProtectedRoute>
              <PlasticStock />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/production"
          element={
            <ProtectedRoute>
              <PlasticProduction />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/recipes"
          element={
            <ProtectedRoute>
              <PlasticRecipes />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/wip-fg"
          element={
            <ProtectedRoute>
              <PlasticWipFg />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/quality"
          element={
            <ProtectedRoute>
              <PlasticQuality />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/scrap-regrind"
          element={
            <ProtectedRoute>
              <PlasticScrapRegrind />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/machines"
          element={
            <ProtectedRoute>
              <PlasticMachines />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/operations"
          element={
            <ProtectedRoute>
              <PlasticOperations />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/traceability"
          element={
            <ProtectedRoute>
              <PlasticTraceability />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/costing"
          element={
            <ProtectedRoute>
              <PlasticCosting />
            </ProtectedRoute>
          }
        />

        <Route
          path="/plastic-erp/reports"
          element={
            <ProtectedRoute>
              <PlasticReports />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
