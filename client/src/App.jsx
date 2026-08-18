import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Invoices from "./pages/Invoices";
import InvoicePreview from "./pages/InvoicePreview";
import InvoicesHistory from "./pages/InvoicesHistory";
import SalesReport from "./pages/SalesReport";

// ===============================
// PROTECTED ROUTE
// ===============================

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// ===============================
// APP
// ===============================

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ================= LOGIN ================= */}

        <Route
          path="/"
          element={<Login />}
        />

        {/* ================= DASHBOARD ================= */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* ================= PRODUCTS ================= */}

        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <Products />
            </ProtectedRoute>
          }
        />

        {/* ================= CUSTOMERS ================= */}

        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <Customers />
            </ProtectedRoute>
          }
        />

        {/* ================= CREATE INVOICE ================= */}

        <Route
          path="/invoices/create"
          element={
            <ProtectedRoute>
              <Invoices />
            </ProtectedRoute>
          }
        />

        {/* ================= INVOICE HISTORY ================= */}

        <Route
          path="/invoices/history"
          element={
            <ProtectedRoute>
              <InvoicesHistory />
            </ProtectedRoute>
          }
        />

        {/* ================= INVOICE PREVIEW ================= */}

        <Route
          path="/invoice/:id"
          element={
            <ProtectedRoute>
              <InvoicePreview />
            </ProtectedRoute>
          }
        />

        {/* ================= SALES REPORT ================= */}

        <Route
          path="/sales-report"
          element={
            <ProtectedRoute>
              <SalesReport />
            </ProtectedRoute>
          }
        />

        {/* ================= UNKNOWN ROUTE ================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;