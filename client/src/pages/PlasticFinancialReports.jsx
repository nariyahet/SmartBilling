import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, Button } from "../components";
import "./PlasticFinancialReports.css";

const REPORT_TABS = [
  { id: "trial-balance", label: "⚖️ Trial Balance", desc: "Verifies double-entry ledger balance integrity across all accounts" },
  { id: "profit-loss", label: "📈 Profit & Loss", desc: "Statement of comprehensive income and operating profit/loss" },
  { id: "balance-sheet", label: "🏛️ Balance Sheet", desc: "Financial position: Current & Fixed Assets vs Liabilities & Equity" },
  { id: "cash-book", label: "💵 Cash Book", desc: "Real-time cash receipts, disbursements and running cash balance" },
  { id: "bank-book", label: "🏦 Bank Book", desc: "Bank ledger movements, cleared deposits and cheques issued" },
  { id: "general-ledger", label: "📖 General Ledger", desc: "Complete transactional audit trail grouped by general ledger account" },
  { id: "customer-ledger", label: "👥 Customer Ledger", desc: "Debtor receivables ledger with invoices and collections trail" },
  { id: "supplier-ledger", label: "🚛 Supplier Ledger", desc: "Creditor payables ledger with purchase bills and payments trail" },
  { id: "expense-report", label: "💸 Expense Breakdown", desc: "Plant operational expenditure segmented by category" },
  { id: "receivables", label: "⏳ Receivables Aging", desc: "Aged debtor analysis: 0-30, 31-60, 61-90, 90+ days" },
  { id: "payables", label: "🧾 Payables Aging", desc: "Aged creditor commitments and upcoming vendor liabilities" },
  { id: "gst-summary", label: "📊 GST Summary", desc: "Consolidated monthly Input vs Output GST balances" },
  { id: "hsn-summary", label: "🏷️ HSN Summary", desc: "Harmonized commodity classification & tax summary" },
  { id: "cash-flow", label: "🌊 Cash Flow Statement", desc: "Operating, investing, and financing liquid funds movements" },
];

function PlasticFinancialReports({ defaultReport = "trial-balance" }) {
  const location = useLocation();
  const [activeReport, setActiveReport] = useState(() => {
    if (typeof window !== "undefined" && window.location.pathname.includes("supplier-ledger")) {
      return "supplier-ledger";
    }
    return defaultReport;
  });

  useEffect(() => {
    if (location.pathname.includes("supplier-ledger")) {
      setActiveReport("supplier-ledger");
    }
  }, [location.pathname]);

  const [period, setPeriod] = useState("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { period };
      if (period === "custom" && fromDate && toDate) {
        params.from_date = fromDate;
        params.to_date = toDate;
      }
      const res = await API.get(`/plastic-erp/accounting/financial-reports/${activeReport}`, { params });
      if (res.data?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to generate financial report");
    } finally {
      setLoading(false);
    }
  }, [activeReport, period, fromDate, toDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrint = () => {
    window.print();
  };

  const currentTab = REPORT_TABS.find((r) => r.id === activeReport);
  const isSupplierLedgerView = location.pathname.includes("supplier-ledger") || activeReport === "supplier-ledger";

  return (
    <div className="sb-page-container">
      <PlasticNavbar />
      <main className="sb-main-content">
        <div className="no-print">
          <PageHeader
            title={isSupplierLedgerView ? "Supplier Ledger & Payables Register" : "Comprehensive Financial Reports"}
            subtitle={
              isSupplierLedgerView
                ? "Creditor payables ledger with purchase bills, debit notes, and payment transactions trail"
                : "Auditable double-entry financial statements, tax registers, aging analysis, and books of account"
            }
            breadcrumbs={[
              { label: "Plastic ERP", to: "/plastic-erp" },
              { label: "Accounting & GST", to: "/plastic-erp/accounting-dashboard" },
              { label: isSupplierLedgerView ? "Supplier Ledger" : "Financial Reports" },
            ]}
            actions={
              <Button
                variant="primary"
                icon="🖨️"
                onClick={handlePrint}
              >
                Print / Export PDF
              </Button>
            }
          />

          {/* Report Pills Selector */}
          <div className="fin-reports-selector-wrap">
            <div className="fin-pills-scroll">
              {REPORT_TABS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`fin-tab-pill ${activeReport === r.id ? "active" : ""}`}
                  onClick={() => setActiveReport(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Bar */}
          <Card className="fin-filter-card">
            <div className="fin-filter-grid">
              <div className="filter-item">
                <label>Reporting Period</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="sb-select"
                >
                  <option value="today">Today</option>
                  <option value="month">This Month</option>
                  <option value="year">This Financial Year</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {period === "custom" && (
                <>
                  <div className="filter-item">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="sb-input"
                    />
                  </div>
                  <div className="filter-item">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="sb-input"
                    />
                  </div>
                  <div className="filter-item filter-btn-end">
                    <Button variant="primary" size="sm" onClick={fetchReport}>
                      Apply Range
                    </Button>
                  </div>
                </>
              )}

              <div className="fin-report-desc-pill">
                <span>{currentTab?.desc}</span>
              </div>
            </div>
          </Card>
        </div>

        {error && <div className="sb-alert-danger">{error}</div>}

        {/* Report Content Card */}
        <Card className="fin-report-sheet">
          {loading ? (
            <LoadingScreen message="Calculating financial ledger balances..." />
          ) : !reportData ? (
            <div className="fin-empty-state">Select a report to view details.</div>
          ) : (
            <div className="statement-wrapper">
              <div className="statement-header">
                <div>
                  <h2 className="statement-title">{reportData.reportName || currentTab?.label}</h2>
                  <div className="statement-meta">
                    <span>Period: <strong>{reportData.period?.start || period} to {reportData.period?.end || "Current"}</strong></span>
                    <span className="meta-sep">•</span>
                    <span>Currency: <strong>INR (₹)</strong></span>
                    <span className="meta-sep">•</span>
                    <span>Basis: <strong>Accrual Double-Entry</strong></span>
                  </div>
                </div>
              </div>

              {/* 1. TRIAL BALANCE */}
              {activeReport === "trial-balance" && (
                <div className="fin-table-wrapper">
                  <table className="fin-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Account Name</th>
                        <th>Classification Group</th>
                        <th className="cell-right">Debit (₹)</th>
                        <th className="cell-right">Credit (₹)</th>
                        <th className="cell-right">Closing Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows?.map((row) => (
                        <tr key={row.account_id}>
                          <td><code className="fin-code-chip">{row.account_code}</code></td>
                          <td><strong>{row.account_name}</strong></td>
                          <td><span className="fin-group-chip">{row.group_name}</span></td>
                          <td className="cell-right">{Number(row.total_debit) > 0 ? Number(row.total_debit).toLocaleString("en-IN") : "—"}</td>
                          <td className="cell-right">{Number(row.total_credit) > 0 ? Number(row.total_credit).toLocaleString("en-IN") : "—"}</td>
                          <td className="cell-right">
                            <strong>₹{Number(row.closing_balance).toLocaleString("en-IN")}</strong> ({row.balance_nature})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="tfoot-totals">
                        <td colSpan="3"><strong>TOTAL</strong></td>
                        <td className="cell-right"><strong>₹{Number(reportData.totals?.totalDebit || 0).toLocaleString("en-IN")}</strong></td>
                        <td className="cell-right"><strong>₹{Number(reportData.totals?.totalCredit || 0).toLocaleString("en-IN")}</strong></td>
                        <td className="cell-right">
                          <span className={`badge-integrity ${reportData.totals?.isBalanced ? "balanced" : "unbalanced"}`}>
                            {reportData.totals?.isBalanced ? "✓ BALANCED" : "⚠️ OUT OF BALANCE"}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* 2. PROFIT & LOSS */}
              {activeReport === "profit-loss" && (
                <div className="pl-container">
                  <div className="pl-section">
                    <h3 className="pl-sec-title">Revenue from Operations</h3>
                    <div className="pl-row">
                      <span>Sales & Finished Goods Revenue</span>
                      <span className="pl-amt">₹{Number(reportData.income?.totalRevenue || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="pl-subtotal">
                      <span>Total Revenue (A)</span>
                      <span className="pl-amt">₹{Number(reportData.income?.totalRevenue || 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="pl-section">
                    <h3 className="pl-sec-title">Cost of Goods Sold (Direct Costs)</h3>
                    <div className="pl-row">
                      <span>Raw Material Purchases</span>
                      <span className="pl-amt">₹{Number(reportData.cogs?.purchases || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="pl-row">
                      <span>Factory Direct Labour</span>
                      <span className="pl-amt">₹{Number(reportData.cogs?.directLabour || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="pl-subtotal">
                      <span>Total Direct Cost (B)</span>
                      <span className="pl-amt">₹{Number(reportData.cogs?.totalCOGS || 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="pl-highlight gross">
                    <span>GROSS PROFIT (A − B)</span>
                    <span className="pl-amt">₹{Number(reportData.grossProfit || 0).toLocaleString("en-IN")}</span>
                  </div>

                  <div className="pl-section">
                    <h3 className="pl-sec-title">Operating & Administrative Expenses</h3>
                    <div className="pl-row">
                      <span>General & Administrative Expenses</span>
                      <span className="pl-amt">₹{Number(reportData.expenses?.operatingExpenses || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="pl-row">
                      <span>Indirect Staff Payroll</span>
                      <span className="pl-amt">₹{Number(reportData.expenses?.indirectPayroll || 0).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="pl-subtotal">
                      <span>Total Operating Expenses (C)</span>
                      <span className="pl-amt">₹{Number(reportData.expenses?.totalExpenses || 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="pl-highlight net">
                    <span>NET OPERATING PROFIT / (LOSS) (Gross Profit − Expenses)</span>
                    <span className="pl-amt text-teal">₹{Number(reportData.netProfit || 0).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}

              {/* 3. BALANCE SHEET */}
              {activeReport === "balance-sheet" && (
                <div className="bs-grid">
                  <div className="bs-col">
                    <h3 className="bs-col-title">ASSETS</h3>
                    <div className="bs-group">
                      <h4 className="bs-group-title">Current Assets</h4>
                      <div className="pl-row">
                        <span>Trade Debtors / Accounts Receivable</span>
                        <span>₹{Number(reportData.assets?.currentAssets?.tradeDebtors || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="pl-row">
                        <span>Cash in Hand</span>
                        <span>₹{Number(reportData.assets?.currentAssets?.cashInHand || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="pl-row">
                        <span>Bank Accounts</span>
                        <span>₹{Number(reportData.assets?.currentAssets?.bankAccounts || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="pl-row">
                        <span>Input Tax Credit (ITC) Asset</span>
                        <span>₹{Number(reportData.assets?.currentAssets?.gstInputCredit || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="bs-sub">
                        <span>Subtotal Current Assets</span>
                        <span>₹{Number(reportData.assets?.currentAssets?.subtotal || 0).toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    <div className="bs-group">
                      <h4 className="bs-group-title">Non-Current & Fixed Assets</h4>
                      <div className="pl-row">
                        <span>Plant, Machinery & Factory Equipment</span>
                        <span>₹{Number(reportData.assets?.fixedAssets?.subtotal || 0).toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    <div className="bs-total">
                      <span>TOTAL ASSETS</span>
                      <span>₹{Number(reportData.assets?.totalAssets || 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  <div className="bs-col">
                    <h3 className="bs-col-title">LIABILITIES & EQUITY</h3>
                    <div className="bs-group">
                      <h4 className="bs-group-title">Current Liabilities</h4>
                      <div className="pl-row">
                        <span>Trade Creditors / Accounts Payable</span>
                        <span>₹{Number(reportData.liabilities?.currentLiabilities?.tradeCreditors || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="pl-row">
                        <span>GST Output Tax Liability</span>
                        <span>₹{Number(reportData.liabilities?.currentLiabilities?.gstOutputTax || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="bs-sub">
                        <span>Subtotal Current Liabilities</span>
                        <span>₹{Number(reportData.liabilities?.currentLiabilities?.subtotal || 0).toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    <div className="bs-group">
                      <h4 className="bs-group-title">Equity & Reserves</h4>
                      <div className="pl-row">
                        <span>Capital Account</span>
                        <span>₹{Number(reportData.liabilities?.equity?.capitalAccount || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="pl-row">
                        <span>Retained Earnings / Current Period P&L</span>
                        <span>₹{Number(reportData.liabilities?.equity?.retainedEarnings || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="bs-sub">
                        <span>Subtotal Equity</span>
                        <span>₹{Number(reportData.liabilities?.equity?.subtotal || 0).toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    <div className="bs-total">
                      <span>TOTAL LIABILITIES & EQUITY</span>
                      <span>₹{Number(reportData.liabilities?.totalLiabilitiesAndEquity || 0).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. CASH BOOK & BANK BOOK */}
              {(activeReport === "cash-book" || activeReport === "bank-book") && (
                <div className="fin-table-wrapper">
                  <div className="book-summary-header">
                    <span>Opening Balance: <strong>₹{Number(reportData.openingBalance || 0).toLocaleString("en-IN")}</strong></span>
                    <span>Total Inflow: <strong className="text-teal">₹{Number(reportData.totalReceipts || reportData.totalDeposits || 0).toLocaleString("en-IN")}</strong></span>
                    <span>Total Outflow: <strong className="text-danger">₹{Number(reportData.totalPayments || reportData.totalWithdrawals || 0).toLocaleString("en-IN")}</strong></span>
                    <span>Closing Balance: <strong className="text-blue">₹{Number(reportData.closingBalance || 0).toLocaleString("en-IN")}</strong></span>
                  </div>

                  <table className="fin-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Doc / Ref #</th>
                        <th>Particulars / Party</th>
                        <th>Type</th>
                        <th className="cell-right">Receipt / Deposit (₹)</th>
                        <th className="cell-right">Payment / Withdrawal (₹)</th>
                        <th className="cell-right">Running Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.transactions?.length === 0 ? (
                        <tr><td colSpan="7" className="fin-table-empty">No transactions found for this period.</td></tr>
                      ) : (
                        reportData.transactions?.map((t, idx) => (
                          <tr key={idx}>
                            <td>{t.date?.split("T")[0]}</td>
                            <td><code className="fin-code-chip">{t.reference_no || "—"}</code></td>
                            <td>{t.particulars || t.party_name}</td>
                            <td><span className="fin-group-chip">{t.type}</span></td>
                            <td className="cell-right">{Number(t.receipt || t.deposit || 0) > 0 ? `₹${Number(t.receipt || t.deposit).toLocaleString("en-IN")}` : "—"}</td>
                            <td className="cell-right">{Number(t.payment || t.withdrawal || 0) > 0 ? `₹${Number(t.payment || t.withdrawal).toLocaleString("en-IN")}` : "—"}</td>
                            <td className="cell-right"><strong>₹{Number(t.balance || 0).toLocaleString("en-IN")}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 5. CUSTOMER & SUPPLIER LEDGERS */}
              {(activeReport === "customer-ledger" || activeReport === "supplier-ledger") && (
                <div className="fin-table-wrapper">
                  <table className="fin-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Doc / Ref #</th>
                        <th>Party Name</th>
                        <th>Description</th>
                        <th className="cell-right">Debit (₹)</th>
                        <th className="cell-right">Credit (₹)</th>
                        <th className="cell-right">Running Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.entries?.length === 0 ? (
                        <tr><td colSpan="7" className="fin-table-empty">No ledger entries found.</td></tr>
                      ) : (
                        reportData.entries?.map((e, idx) => (
                          <tr key={idx}>
                            <td>{e.entry_date?.split("T")[0]}</td>
                            <td><code className="fin-code-chip">{e.reference_no}</code></td>
                            <td><strong>{e.party_name}</strong></td>
                            <td>{e.notes || e.transaction_type}</td>
                            <td className="cell-right">{Number(e.debit_amount) > 0 ? `₹${Number(e.debit_amount).toLocaleString("en-IN")}` : "—"}</td>
                            <td className="cell-right">{Number(e.credit_amount) > 0 ? `₹${Number(e.credit_amount).toLocaleString("en-IN")}` : "—"}</td>
                            <td className="cell-right"><strong>₹{Number(e.running_balance).toLocaleString("en-IN")}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 6. RECEIVABLES & PAYABLES AGING */}
              {(activeReport === "receivables" || activeReport === "payables") && (
                <div className="fin-table-wrapper">
                  <table className="fin-table">
                    <thead>
                      <tr>
                        <th>Party Name</th>
                        <th>Contact</th>
                        <th className="cell-right">0-30 Days</th>
                        <th className="cell-right">31-60 Days</th>
                        <th className="cell-right">61-90 Days</th>
                        <th className="cell-right">90+ Days (Overdue)</th>
                        <th className="cell-right">Total Outstanding (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.agingReport?.length === 0 ? (
                        <tr><td colSpan="7" className="fin-table-empty">No outstanding commitments found.</td></tr>
                      ) : (
                        reportData.agingReport?.map((p, idx) => (
                          <tr key={idx}>
                            <td><strong>{p.party_name}</strong></td>
                            <td>{p.phone || "—"}</td>
                            <td className="cell-right">₹{Number(p.bucket_0_30 || 0).toLocaleString("en-IN")}</td>
                            <td className="cell-right">₹{Number(p.bucket_31_60 || 0).toLocaleString("en-IN")}</td>
                            <td className="cell-right">₹{Number(p.bucket_61_90 || 0).toLocaleString("en-IN")}</td>
                            <td className="cell-right"><span className="text-danger font-semibold">₹{Number(p.bucket_90_plus || 0).toLocaleString("en-IN")}</span></td>
                            <td className="cell-right"><strong className="text-blue">₹{Number(p.total_outstanding || 0).toLocaleString("en-IN")}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="tfoot-totals">
                        <td colSpan="2"><strong>TOTAL COMMITMENTS</strong></td>
                        <td className="cell-right">₹{Number(reportData.totals?.bucket_0_30 || 0).toLocaleString("en-IN")}</td>
                        <td className="cell-right">₹{Number(reportData.totals?.bucket_31_60 || 0).toLocaleString("en-IN")}</td>
                        <td className="cell-right">₹{Number(reportData.totals?.bucket_61_90 || 0).toLocaleString("en-IN")}</td>
                        <td className="cell-right">₹{Number(reportData.totals?.bucket_90_plus || 0).toLocaleString("en-IN")}</td>
                        <td className="cell-right"><strong>₹{Number(reportData.totals?.grandTotal || 0).toLocaleString("en-IN")}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* 7. OTHER GENERIC REPORTS (Expense, GST, HSN, Cash Flow, General Ledger) */}
              {!["trial-balance", "profit-loss", "balance-sheet", "cash-book", "bank-book", "customer-ledger", "supplier-ledger", "receivables", "payables"].includes(activeReport) && (
                <div className="generic-report-view">
                  <pre className="fin-json-display">{JSON.stringify(reportData, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

export default PlasticFinancialReports;
