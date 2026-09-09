import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

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

// Unified ERP Application Shell
import AppShell from "./components/AppShell";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Protected layout wrapping all authenticated ERP routes in the unified AppShell
function ProtectedAppLayout() {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Authentication Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/trial-expired" element={<TrialExpired />} />

        {/* Master Authenticated ERP Application Shell Layout */}
        <Route element={<ProtectedAppLayout />}>
          {/* Primary Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Core Business Modules */}
          <Route path="/products" element={<Products />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/invoices/create" element={<Invoices />} />
          <Route path="/invoices/history" element={<InvoicesHistory />} />
          <Route path="/sales-report" element={<SalesReport />} />
          <Route path="/settings" element={<BusinessSettings />} />

          {/* ---------------------------------------------------- */}
          {/* Plastic Recycling ERP Routes (Kim, Surat Operations) */}
          {/* ---------------------------------------------------- */}
          {/* Compatibility redirect from legacy /plastic-erp to primary /dashboard */}
          <Route path="/plastic-erp" element={<Navigate to="/dashboard" replace />} />

          {/* Phase 1 & 2: Inward, Inventory, Production & Recipes */}
          <Route path="/plastic-erp/suppliers" element={<PlasticSuppliers />} />
          <Route
            path="/plastic-erp/supplier-ledger"
            element={<PlasticFinancialReports defaultReport="supplier-ledger" />}
          />
          <Route path="/plastic-erp/raw-materials" element={<PlasticRawMaterials />} />
          <Route path="/plastic-erp/truck-inward" element={<PlasticTruckInward />} />
          <Route path="/plastic-erp/weighment" element={<PlasticWeighment />} />
          <Route path="/plastic-erp/purchase-bills" element={<PlasticPurchaseBills />} />
          <Route path="/plastic-erp/stock" element={<PlasticStock />} />
          <Route path="/plastic-erp/production" element={<PlasticProduction />} />
          <Route path="/plastic-erp/recipes" element={<PlasticRecipes />} />
          <Route path="/plastic-erp/wip-fg" element={<PlasticWipFg />} />
          <Route path="/plastic-erp/quality" element={<PlasticQuality />} />
          <Route path="/plastic-erp/scrap-regrind" element={<PlasticScrapRegrind />} />
          <Route path="/plastic-erp/machines" element={<PlasticMachines />} />
          <Route path="/plastic-erp/operations" element={<PlasticOperations />} />
          <Route path="/plastic-erp/traceability" element={<PlasticTraceability />} />
          <Route path="/plastic-erp/costing" element={<PlasticCosting />} />
          <Route path="/plastic-erp/reports" element={<PlasticReports />} />

          {/* Phase 3: Sales, Dispatch & Finance Routes */}
          <Route path="/plastic-erp/sales-orders" element={<PlasticSalesOrders />} />
          <Route path="/plastic-erp/sales" element={<PlasticSalesOrders />} />
          <Route path="/plastic-erp/dispatch" element={<PlasticDispatch />} />
          <Route path="/plastic-erp/dispatches" element={<PlasticDispatch />} />
          <Route path="/plastic-erp/delivery-challans" element={<PlasticDeliveryChallan />} />
          <Route path="/plastic-erp/transport/challans" element={<PlasticDeliveryChallan />} />
          <Route path="/plastic-erp/transport" element={<PlasticTransport />} />
          <Route path="/plastic-erp/transport/vehicles" element={<PlasticTransport />} />
          <Route path="/plastic-erp/sales-returns" element={<PlasticSalesReturns />} />
          <Route path="/plastic-erp/payments" element={<PlasticPayments />} />
          <Route path="/plastic-erp/receivables" element={<PlasticReceivables />} />
          <Route path="/plastic-erp/finance/receivables" element={<PlasticReceivables />} />
          <Route path="/plastic-erp/customer-ledger" element={<PlasticCustomerLedger />} />
          <Route path="/plastic-erp/finance/ledger" element={<PlasticCustomerLedger />} />
          <Route path="/plastic-erp/credit-notes" element={<PlasticCreditNotes />} />
          <Route path="/plastic-erp/finance/credit-notes" element={<PlasticCreditNotes />} />
          <Route path="/plastic-erp/debit-notes" element={<PlasticDebitNotes />} />
          <Route path="/plastic-erp/finance/debit-notes" element={<PlasticDebitNotes />} />
          <Route path="/plastic-erp/sales-reports" element={<PlasticSalesReports />} />
          <Route path="/plastic-erp/reports/sales" element={<PlasticSalesReports />} />

          {/* Phase 4: HR, Payroll & Expense Management */}
          <Route path="/plastic-erp/employees" element={<PlasticEmployees />} />
          <Route path="/plastic-erp/attendance" element={<PlasticAttendance />} />
          <Route path="/plastic-erp/leaves" element={<PlasticLeaveManagement />} />
          <Route path="/plastic-erp/workforce" element={<PlasticWorkforce />} />
          <Route path="/plastic-erp/payroll" element={<PlasticPayroll />} />
          <Route path="/plastic-erp/advances" element={<PlasticEmployeeAdvances />} />
          <Route path="/plastic-erp/expenses" element={<PlasticExpenses />} />
          <Route path="/plastic-erp/hr-reports" element={<PlasticHrReports />} />

          {/* Phase 5: Accounting, GST & Compliance */}
          <Route path="/plastic-erp/chart-of-accounts" element={<PlasticChartOfAccounts />} />
          <Route path="/plastic-erp/journal-entries" element={<PlasticJournalEntries />} />
          <Route path="/plastic-erp/cash-bank" element={<PlasticCashBank />} />
          <Route path="/plastic-erp/bank-reconciliation" element={<PlasticBankReconciliation />} />
          <Route path="/plastic-erp/gst-management" element={<PlasticGstManagement />} />
          <Route path="/plastic-erp/gst-reconciliation" element={<PlasticGstReconciliation />} />
          <Route path="/plastic-erp/financial-reports" element={<PlasticFinancialReports />} />
          <Route path="/plastic-erp/accounting-dashboard" element={<PlasticAccountingDashboard />} />

          {/* Phase 6: Procurement, Vendor & Purchase Intelligence */}
          <Route path="/plastic-erp/purchase-requisitions" element={<PlasticPurchaseRequisitions />} />
          <Route path="/plastic-erp/supplier-quotations" element={<PlasticSupplierQuotations />} />
          <Route path="/plastic-erp/purchase-comparison" element={<PlasticPurchaseComparison />} />
          <Route path="/plastic-erp/purchase-orders" element={<PlasticPurchaseOrders />} />
          <Route path="/plastic-erp/purchase-deliveries" element={<PlasticPurchaseDeliveries />} />
          <Route path="/plastic-erp/supplier-performance" element={<PlasticSupplierPerformance />} />
          <Route path="/plastic-erp/procurement-reports" element={<PlasticProcurementReports />} />
          <Route path="/plastic-erp/procurement-dashboard" element={<PlasticProcurementDashboard />} />
        </Route>

        {/* Dedicated Standalone Printable Invoice View */}
        <Route
          path="/invoice/:id"
          element={
            <ProtectedRoute>
              <InvoicePreview />
            </ProtectedRoute>
          }
        />

        {/* Fallback Catch-All Route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
