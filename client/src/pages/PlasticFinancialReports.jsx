import React, { useState, useEffect } from "react";
import axios from "axios";
import PlasticNavbar from "../components/PlasticNavbar";
import "./PlasticFinancialReports.css";

const API_BASE = "http://localhost:5000/api/plastic-erp/reports";

const REPORT_TABS = [
  { id: "trial-balance", label: "⚖️ Trial Balance", desc: "Verifies double-entry ledger balance integrity" },
  { id: "profit-loss", label: "📈 Profit & Loss", desc: "Statement of comprehensive income and operating profit" },
  { id: "balance-sheet", label: "🏛️ Balance Sheet", desc: "Financial position: Assets vs Liabilities & Equity" },
  { id: "cash-book", label: "💵 Cash Book", desc: "Real-time cash receipts, disbursements and balance" },
  { id: "bank-book", label: "🏦 Bank Book", desc: "Bank ledger movements and deposits/withdrawals" },
  { id: "general-ledger", label: "📖 General Ledger", desc: "Complete transactional audit trail by account" },
  { id: "customer-ledger", label: "👥 Customer Ledger", desc: "Receivables ledger with credit/debit trail" },
  { id: "supplier-ledger", label: "🚛 Supplier Ledger", desc: "Payables ledger with purchase/disbursement trail" },
  { id: "expense-report", label: "💸 Expense Breakdown", desc: "Operating expenditure segmented by category" },
  { id: "receivables", label: "⏳ Receivables Aging", desc: "Aged debtor analysis (0-30, 31-60, 61-90, 90+ days)" },
  { id: "payables", label: "🧾 Payables Aging", desc: "Aged creditor commitments and upcoming liabilities" },
  { id: "gst-summary", label: "📊 GST Summary", desc: "Consolidated monthly Input vs Output GST" },
  { id: "hsn-summary", label: "🏷️ HSN Summary", desc: "Harmonized commodity classification & tax summary" },
  { id: "cash-flow", label: "🌊 Cash Flow Statement", desc: "Operating, investing, and financing liquid flow" },
];

const PlasticFinancialReports = ({ defaultReport = "trial-balance" }) => {
  const [activeReport, setActiveReport] = useState(() => {
    if (typeof window !== "undefined" && window.location.pathname.includes("supplier-ledger")) {
      return "supplier-ledger";
    }
    return defaultReport;
  });
  const [period, setPeriod] = useState("month");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchReport();
  }, [activeReport, period]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { period };
      if (period === "custom" && fromDate && toDate) {
        params.from_date = fromDate;
        params.to_date = toDate;
      }
      const res = await axios.get(`${API_BASE}/${activeReport}`, {
        params,
        headers,
      });
      if (res.data.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to generate financial report");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="plastic-reports-page">
      <PlasticNavbar />
      <div className="reports-container">
        {/* Header */}
        <div className="reports-header no-print">
          <div>
            <span className="badge-phase">PHASE 5: FINANCIAL STATEMENTS & AUDIT</span>
            <h1 className="page-title">📑 Comprehensive Financial Reports</h1>
            <p className="page-subtitle">
              Auditable double-entry financial statements, tax registers, aging analysis, and books of account.
            </p>
          </div>
          <div className="header-actions">
            <button className="btn-print" onClick={handlePrint}>
              🖨️ Print / Export PDF
            </button>
          </div>
        </div>

        {/* Report Selector Pills */}
        <div className="report-pills-bar no-print">
          {REPORT_TABS.map((r) => (
            <button
              key={r.id}
              className={`pill-tab ${activeReport === r.id ? "active" : ""}`}
              onClick={() => setActiveReport(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Filter Controls Bar */}
        <div className="filter-bar no-print">
          <div className="filter-group">
            <label>Reporting Period:</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="today">Today</option>
              <option value="month">This Month</option>
              <option value="year">This Financial Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {period === "custom" && (
            <div className="filter-group custom-range">
              <label>From:</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <label>To:</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              <button className="btn-apply" onClick={fetchReport}>Apply</button>
            </div>
          )}

          <div className="report-info-pill">
            <span>{REPORT_TABS.find((r) => r.id === activeReport)?.desc}</span>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {/* Report Content Display */}
        <div className="report-sheet">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Calculating financial ledger balances...</p>
            </div>
          ) : !reportData ? (
            <div className="empty-state">Select a report to view details.</div>
          ) : (
            <div className="statement-wrapper">
              <div className="statement-header">
                <h2>{reportData.reportName || REPORT_TABS.find((r) => r.id === activeReport)?.label}</h2>
                <div className="statement-meta">
                  <span>Period: <strong>{reportData.period?.start || period} to {reportData.period?.end || "Current"}</strong></span>
                  <span>Currency: <strong>INR (₹)</strong></span>
                  <span>Basis: <strong>Accrual Double-Entry</strong></span>
                </div>
              </div>

              {/* 1. TRIAL BALANCE */}
              {activeReport === "trial-balance" && (
                <div className="report-table-box">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Account Name</th>
                        <th>Classification Group</th>
                        <th>Debit (₹)</th>
                        <th>Credit (₹)</th>
                        <th>Closing Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.rows?.map((row) => (
                        <tr key={row.account_id}>
                          <td><code>{row.account_code}</code></td>
                          <td><strong>{row.account_name}</strong></td>
                          <td><span className="group-tag">{row.group_name}</span></td>
                          <td>{Number(row.total_debit) > 0 ? Number(row.total_debit).toLocaleString() : "—"}</td>
                          <td>{Number(row.total_credit) > 0 ? Number(row.total_credit).toLocaleString() : "—"}</td>
                          <td><strong>₹{Number(row.closing_balance).toLocaleString()}</strong> ({row.balance_nature})</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="tfoot-totals">
                        <td colSpan="3"><strong>TOTAL</strong></td>
                        <td><strong>₹{Number(reportData.totals?.totalDebit || 0).toLocaleString()}</strong></td>
                        <td><strong>₹{Number(reportData.totals?.totalCredit || 0).toLocaleString()}</strong></td>
                        <td>
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
                    <h3>Revenue from Operations</h3>
                    <div className="pl-row">
                      <span>Sales & Processing Revenue</span>
                      <span className="pl-amt">₹{Number(reportData.income?.totalRevenue || 0).toLocaleString()}</span>
                    </div>
                    <div className="pl-subtotal">
                      <span>Total Revenue (A)</span>
                      <span className="pl-amt">₹{Number(reportData.income?.totalRevenue || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="pl-section">
                    <h3>Cost of Goods Sold (Direct Costs)</h3>
                    <div className="pl-row">
                      <span>Raw Material Purchases</span>
                      <span className="pl-amt">₹{Number(reportData.cogs?.purchases || 0).toLocaleString()}</span>
                    </div>
                    <div className="pl-row">
                      <span>Factory Direct Labour</span>
                      <span className="pl-amt">₹{Number(reportData.cogs?.directLabour || 0).toLocaleString()}</span>
                    </div>
                    <div className="pl-subtotal">
                      <span>Total Direct Cost (B)</span>
                      <span className="pl-amt">₹{Number(reportData.cogs?.totalCOGS || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="pl-highlight gross">
                    <span>GROSS PROFIT (A − B)</span>
                    <span className="pl-amt">₹{Number(reportData.grossProfit || 0).toLocaleString()}</span>
                  </div>

                  <div className="pl-section">
                    <h3>Operating & Administrative Expenses</h3>
                    <div className="pl-row">
                      <span>General & Administrative Expenses</span>
                      <span className="pl-amt">₹{Number(reportData.expenses?.operatingExpenses || 0).toLocaleString()}</span>
                    </div>
                    <div className="pl-row">
                      <span>Indirect Staff Payroll</span>
                      <span className="pl-amt">₹{Number(reportData.expenses?.indirectPayroll || 0).toLocaleString()}</span>
                    </div>
                    <div className="pl-subtotal">
                      <span>Total Operating Expenses (C)</span>
                      <span className="pl-amt">₹{Number(reportData.expenses?.totalExpenses || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="pl-highlight net">
                    <span>NET OPERATING PROFIT / (LOSS) (Gross Profit − Expenses)</span>
                    <span className="pl-amt text-green">₹{Number(reportData.netProfit || 0).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* 3. BALANCE SHEET */}
              {activeReport === "balance-sheet" && (
                <div className="bs-grid">
                  <div className="bs-col">
                    <h3 className="bs-col-title">ASSETS</h3>
                    <div className="bs-group">
                      <h4>Current Assets</h4>
                      <div className="pl-row">
                        <span>Trade Debtors / Accounts Receivable</span>
                        <span>₹{Number(reportData.assets?.currentAssets?.tradeDebtors || 0).toLocaleString()}</span>
                      </div>
                      <div className="pl-row">
                        <span>Cash in Hand</span>
                        <span>₹{Number(reportData.assets?.currentAssets?.cashInHand || 0).toLocaleString()}</span>
                      </div>
                      <div className="pl-row">
                        <span>Bank Accounts</span>
                        <span>₹{Number(reportData.assets?.currentAssets?.bankAccounts || 0).toLocaleString()}</span>
                      </div>
                      <div className="pl-row">
                        <span>Input Tax Credit (ITC) Asset</span>
                        <span>₹{Number(reportData.assets?.currentAssets?.gstInputCredit || 0).toLocaleString()}</span>
                      </div>
                      <div className="bs-sub">
                        <span>Subtotal Current Assets</span>
                        <span>₹{Number(reportData.assets?.currentAssets?.subtotal || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="bs-group">
                      <h4>Non-Current & Fixed Assets</h4>
                      <div className="pl-row">
                        <span>Plant, Machinery & Factory Equipment</span>
                        <span>₹{Number(reportData.assets?.fixedAssets?.subtotal || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="bs-total">
                      <span>TOTAL ASSETS</span>
                      <span>₹{Number(reportData.assets?.totalAssets || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="bs-col">
                    <h3 className="bs-col-title">LIABILITIES & EQUITY</h3>
                    <div className="bs-group">
                      <h4>Current Liabilities</h4>
                      <div className="pl-row">
                        <span>Trade Creditors / Accounts Payable</span>
                        <span>₹{Number(reportData.liabilities?.currentLiabilities?.tradeCreditors || 0).toLocaleString()}</span>
                      </div>
                      <div className="pl-row">
                        <span>GST Output Tax Liability</span>
                        <span>₹{Number(reportData.liabilities?.currentLiabilities?.gstOutputTax || 0).toLocaleString()}</span>
                      </div>
                      <div className="bs-sub">
                        <span>Subtotal Current Liabilities</span>
                        <span>₹{Number(reportData.liabilities?.currentLiabilities?.subtotal || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="bs-group">
                      <h4>Equity & Reserves</h4>
                      <div className="pl-row">
                        <span>Capital Account</span>
                        <span>₹{Number(reportData.liabilities?.equity?.capitalAccount || 0).toLocaleString()}</span>
                      </div>
                      <div className="pl-row">
                        <span>Retained Earnings / Current Period P&L</span>
                        <span>₹{Number(reportData.liabilities?.equity?.retainedEarnings || 0).toLocaleString()}</span>
                      </div>
                      <div className="bs-sub">
                        <span>Subtotal Equity</span>
                        <span>₹{Number(reportData.liabilities?.equity?.subtotal || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="bs-total">
                      <span>TOTAL LIABILITIES & EQUITY</span>
                      <span>₹{Number(reportData.liabilities?.totalLiabilitiesAndEquity || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. CASH BOOK & BANK BOOK */}
              {(activeReport === "cash-book" || activeReport === "bank-book") && (
                <div className="report-table-box">
                  <div className="book-summary-header">
                    <span>Opening Balance: <strong>₹{Number(reportData.openingBalance || 0).toLocaleString()}</strong></span>
                    <span>Total Inflow: <strong className="text-green">₹{Number(reportData.totalReceipts || reportData.totalDeposits || 0).toLocaleString()}</strong></span>
                    <span>Total Outflow: <strong className="text-red">₹{Number(reportData.totalPayments || reportData.totalWithdrawals || 0).toLocaleString()}</strong></span>
                    <span>Closing Balance: <strong className="highlight">₹{Number(reportData.closingBalance || 0).toLocaleString()}</strong></span>
                  </div>
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Doc / Ref #</th>
                        <th>Particulars / Party</th>
                        <th>Type</th>
                        <th>Receipt / Deposit (₹)</th>
                        <th>Payment / Withdrawal (₹)</th>
                        <th>Running Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.transactions?.length === 0 ? (
                        <tr><td colSpan="7" className="text-center py-3">No transactions found for this period.</td></tr>
                      ) : (
                        reportData.transactions?.map((t, idx) => (
                          <tr key={idx}>
                            <td>{t.date?.split("T")[0]}</td>
                            <td><code>{t.reference_no || "—"}</code></td>
                            <td>{t.particulars || t.party_name}</td>
                            <td><span className="mode-badge">{t.type}</span></td>
                            <td>{Number(t.receipt || t.deposit || 0) > 0 ? `₹${Number(t.receipt || t.deposit).toLocaleString()}` : "—"}</td>
                            <td>{Number(t.payment || t.withdrawal || 0) > 0 ? `₹${Number(t.payment || t.withdrawal).toLocaleString()}` : "—"}</td>
                            <td><strong>₹{Number(t.balance || 0).toLocaleString()}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 5. CUSTOMER & SUPPLIER LEDGERS */}
              {(activeReport === "customer-ledger" || activeReport === "supplier-ledger") && (
                <div className="report-table-box">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Doc / Ref #</th>
                        <th>Party Name</th>
                        <th>Description</th>
                        <th>Debit (₹)</th>
                        <th>Credit (₹)</th>
                        <th>Running Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.entries?.length === 0 ? (
                        <tr><td colSpan="7" className="text-center py-3">No ledger entries found.</td></tr>
                      ) : (
                        reportData.entries?.map((e, idx) => (
                          <tr key={idx}>
                            <td>{e.entry_date?.split("T")[0]}</td>
                            <td><code>{e.reference_no}</code></td>
                            <td><strong>{e.party_name}</strong></td>
                            <td>{e.notes || e.transaction_type}</td>
                            <td>{Number(e.debit_amount) > 0 ? `₹${Number(e.debit_amount).toLocaleString()}` : "—"}</td>
                            <td>{Number(e.credit_amount) > 0 ? `₹${Number(e.credit_amount).toLocaleString()}` : "—"}</td>
                            <td><strong>₹{Number(e.running_balance).toLocaleString()}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 6. RECEIVABLES & PAYABLES AGING */}
              {(activeReport === "receivables" || activeReport === "payables") && (
                <div className="report-table-box">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Party Name</th>
                        <th>Contact / Phone</th>
                        <th>Current (0-30 Days)</th>
                        <th>31-60 Days</th>
                        <th>61-90 Days</th>
                        <th>90+ Days (Overdue)</th>
                        <th>Total Outstanding (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.agingReport?.length === 0 ? (
                        <tr><td colSpan="7" className="text-center py-3">No outstanding commitments found.</td></tr>
                      ) : (
                        reportData.agingReport?.map((p, idx) => (
                          <tr key={idx}>
                            <td><strong>{p.party_name}</strong></td>
                            <td>{p.phone || "—"}</td>
                            <td>₹{Number(p.bucket_0_30 || 0).toLocaleString()}</td>
                            <td>₹{Number(p.bucket_31_60 || 0).toLocaleString()}</td>
                            <td>₹{Number(p.bucket_61_90 || 0).toLocaleString()}</td>
                            <td><span className="overdue-tag">₹{Number(p.bucket_90_plus || 0).toLocaleString()}</span></td>
                            <td><strong className="text-highlight">₹{Number(p.total_outstanding || 0).toLocaleString()}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="tfoot-totals">
                        <td colSpan="2"><strong>TOTAL COMMITMENTS</strong></td>
                        <td>₹{Number(reportData.totals?.bucket_0_30 || 0).toLocaleString()}</td>
                        <td>₹{Number(reportData.totals?.bucket_31_60 || 0).toLocaleString()}</td>
                        <td>₹{Number(reportData.totals?.bucket_61_90 || 0).toLocaleString()}</td>
                        <td>₹{Number(reportData.totals?.bucket_90_plus || 0).toLocaleString()}</td>
                        <td><strong>₹{Number(reportData.totals?.grandTotal || 0).toLocaleString()}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* 7. OTHER GENERIC REPORTS (Expense, GST, HSN, Cash Flow, General Ledger) */}
              {!["trial-balance", "profit-loss", "balance-sheet", "cash-book", "bank-book", "customer-ledger", "supplier-ledger", "receivables", "payables"].includes(activeReport) && (
                <div className="generic-report-view">
                  <pre className="json-display">{JSON.stringify(reportData, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlasticFinancialReports;
