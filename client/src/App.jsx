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
import PlasticSalesOrders from "./pages/PlasticSalesOrders";
import PlasticDispatch from "./pages/PlasticDispatch";
import PlasticDeliveryChallan from "./pages/PlasticDeliveryChallan";
import PlasticTransport from "./pages/PlasticTransport";
import PlasticPayments from "./pages/PlasticPayments";
import PlasticReceivables from "./pages/PlasticReceivables";
import PlasticCustomerLedger from "./pages/PlasticCustomerLedger";
import PlasticSalesReturns from "./pages/PlasticSalesReturns";
import PlasticCreditNotes from "./pages/PlasticCreditNotes";
import PlasticDebitNotes from "./pages/PlasticDebitNotes";
import PlasticSalesReports from "./pages/PlasticSalesReports";
import PlasticEmployees from "./pages/PlasticEmployees";
import PlasticAttendance from "./pages/PlasticAttendance";
import PlasticLeaveManagement from "./pages/PlasticLeaveManagement";
import PlasticWorkforce from "./pages/PlasticWorkforce";
import PlasticPayroll from "./pages/PlasticPayroll";
import PlasticEmployeeAdvances from "./pages/PlasticEmployeeAdvances";
import PlasticExpenses from "./pages/PlasticExpenses";
import PlasticHrReports from "./pages/PlasticHrReports";
import PlasticChartOfAccounts from "./pages/PlasticChartOfAccounts";
import PlasticJournalEntries from "./pages/PlasticJournalEntries";
import PlasticCashBank from "./pages/PlasticCashBank";
import PlasticBankReconciliation from "./pages/PlasticBankReconciliation";
import PlasticGstManagement from "./pages/PlasticGstManagement";
import PlasticGstReconciliation from "./pages/PlasticGstReconciliation";
import PlasticFinancialReports from "./pages/PlasticFinancialReports";
import PlasticAccountingDashboard from "./pages/PlasticAccountingDashboard";

// Phase 6: Procurement, Vendor & Purchase Intelligence
import PlasticPurchaseRequisitions from "./pages/PlasticPurchaseRequisitions";
import PlasticSupplierQuotations from "./pages/PlasticSupplierQuotations";
import PlasticPurchaseComparison from "./pages/PlasticPurchaseComparison";
import PlasticPurchaseOrders from "./pages/PlasticPurchaseOrders";
import PlasticPurchaseDeliveries from "./pages/PlasticPurchaseDeliveries";
import PlasticSupplierPerformance from "./pages/PlasticSupplierPerformance";
import PlasticProcurementReports from "./pages/PlasticProcurementReports";
import PlasticProcurementDashboard from "./pages/PlasticProcurementDashboard";

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

        {/* Phase 3: Sales, Dispatch & Finance Routes */}
        <Route
          path="/plastic-erp/sales-orders"
          element={
            <ProtectedRoute>
              <PlasticSalesOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/sales"
          element={
            <ProtectedRoute>
              <PlasticSalesOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/dispatch"
          element={
            <ProtectedRoute>
              <PlasticDispatch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/dispatches"
          element={
            <ProtectedRoute>
              <PlasticDispatch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/delivery-challans"
          element={
            <ProtectedRoute>
              <PlasticDeliveryChallan />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/transport/challans"
          element={
            <ProtectedRoute>
              <PlasticDeliveryChallan />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/transport"
          element={
            <ProtectedRoute>
              <PlasticTransport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/transport/vehicles"
          element={
            <ProtectedRoute>
              <PlasticTransport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/sales-returns"
          element={
            <ProtectedRoute>
              <PlasticSalesReturns />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/payments"
          element={
            <ProtectedRoute>
              <PlasticPayments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/receivables"
          element={
            <ProtectedRoute>
              <PlasticReceivables />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/finance/receivables"
          element={
            <ProtectedRoute>
              <PlasticReceivables />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/customer-ledger"
          element={
            <ProtectedRoute>
              <PlasticCustomerLedger />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/finance/ledger"
          element={
            <ProtectedRoute>
              <PlasticCustomerLedger />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/credit-notes"
          element={
            <ProtectedRoute>
              <PlasticCreditNotes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/finance/credit-notes"
          element={
            <ProtectedRoute>
              <PlasticCreditNotes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/debit-notes"
          element={
            <ProtectedRoute>
              <PlasticDebitNotes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/finance/debit-notes"
          element={
            <ProtectedRoute>
              <PlasticDebitNotes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/sales-reports"
          element={
            <ProtectedRoute>
              <PlasticSalesReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/reports/sales"
          element={
            <ProtectedRoute>
              <PlasticSalesReports />
            </ProtectedRoute>
          }
        />

        {/* Phase 4: HR, Payroll & Expense Management */}
        <Route
          path="/plastic-erp/employees"
          element={
            <ProtectedRoute>
              <PlasticEmployees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/attendance"
          element={
            <ProtectedRoute>
              <PlasticAttendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/leaves"
          element={
            <ProtectedRoute>
              <PlasticLeaveManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/workforce"
          element={
            <ProtectedRoute>
              <PlasticWorkforce />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/payroll"
          element={
            <ProtectedRoute>
              <PlasticPayroll />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/advances"
          element={
            <ProtectedRoute>
              <PlasticEmployeeAdvances />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/expenses"
          element={
            <ProtectedRoute>
              <PlasticExpenses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/hr-reports"
          element={
            <ProtectedRoute>
              <PlasticHrReports />
            </ProtectedRoute>
          }
        />

        {/* Phase 5: Accounting, GST & Compliance */}
        <Route
          path="/plastic-erp/chart-of-accounts"
          element={
            <ProtectedRoute>
              <PlasticChartOfAccounts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/journal-entries"
          element={
            <ProtectedRoute>
              <PlasticJournalEntries />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/cash-bank"
          element={
            <ProtectedRoute>
              <PlasticCashBank />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/bank-reconciliation"
          element={
            <ProtectedRoute>
              <PlasticBankReconciliation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/gst-management"
          element={
            <ProtectedRoute>
              <PlasticGstManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/gst-reconciliation"
          element={
            <ProtectedRoute>
              <PlasticGstReconciliation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/financial-reports"
          element={
            <ProtectedRoute>
              <PlasticFinancialReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/accounting-dashboard"
          element={
            <ProtectedRoute>
              <PlasticAccountingDashboard />
            </ProtectedRoute>
          }
        />

        {/* Phase 6: Procurement, Vendor & Purchase Intelligence */}
        <Route
          path="/plastic-erp/purchase-requisitions"
          element={
            <ProtectedRoute>
              <PlasticPurchaseRequisitions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/supplier-quotations"
          element={
            <ProtectedRoute>
              <PlasticSupplierQuotations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/purchase-comparison"
          element={
            <ProtectedRoute>
              <PlasticPurchaseComparison />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/purchase-orders"
          element={
            <ProtectedRoute>
              <PlasticPurchaseOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/purchase-deliveries"
          element={
            <ProtectedRoute>
              <PlasticPurchaseDeliveries />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/supplier-performance"
          element={
            <ProtectedRoute>
              <PlasticSupplierPerformance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/procurement-reports"
          element={
            <ProtectedRoute>
              <PlasticProcurementReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/plastic-erp/procurement-dashboard"
          element={
            <ProtectedRoute>
              <PlasticProcurementDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
