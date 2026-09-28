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

const formatINR = (val) => "₹" + Number(val || 0).toLocaleString("en-IN");

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

  const currentTab = REPORT_TABS.find((r) => r.id === activeReport) || REPORT_TABS[0];
  const isSupplierLedgerView = activeReport === "supplier-ledger";
  const cleanTabTitle = currentTab?.label ? currentTab.label.replace(/^[\p{Emoji}\s]+/u, "").trim() : "Financial Reports";

  return (
    <div className="sb-page-container">
      <PlasticNavbar />
      <main className="sb-main-content">
        <div className="no-print">
          <PageHeader
            title={isSupplierLedgerView ? "Supplier Ledger & Payables Register" : `${cleanTabTitle} Report`}
            subtitle={
              isSupplierLedgerView
                ? "Creditor payables ledger with purchase bills, debit notes, and payment transactions trail"
                : (currentTab?.desc || "Auditable double-entry financial statements, tax registers, aging analysis, and books of account")
            }
            breadcrumbs={[
              { label: "Plastic ERP", to: "/plastic-erp" },
              { label: "Accounting & GST", to: "/plastic-erp/accounting-dashboard" },
              { label: isSupplierLedgerView ? "Supplier Ledger" : cleanTabTitle },
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
                </>
              )}

              <Button
                variant="secondary"
                icon="🔄"
                onClick={fetchReport}
                disabled={loading}
              >
                Refresh
              </Button>

              <div className="fin-report-desc-pill">
                ℹ️ {currentTab?.desc}
              </div>
            </div>
          </Card>
        </div>

        {/* Report Content Body */}
        <Card className="fin-report-sheet">
          {loading ? (
            <LoadingScreen message={`Computing ${currentTab?.label || "Report"}...`} />
          ) : error ? (
            <div className="sb-error-state">
              <p>⚠️ {error}</p>
              <Button variant="secondary" onClick={fetchReport}>Retry</Button>
            </div>
          ) : !reportData ? (
            <div className="fin-empty-state">No report generated. Click Refresh to load.</div>
          ) : (
            <div className="statement-wrapper">
              <div className="statement-header">
                <h2 className="statement-title">{reportData.reportName || currentTab?.label}</h2>
                <div className="statement-meta">
                  {reportData.period ? (
                    <span>Period: {reportData.period.start?.split("T")[0]} to {reportData.period.end?.split("T")[0]}</span>
                  ) : reportData.asOfDate ? (
                    <span>As of Date: {reportData.asOfDate?.split("T")[0]}</span>
                  ) : null}
                  <span className="meta-sep">•</span>
                  <span>Currency: INR (₹)</span>
                  <span className="meta-sep">•</span>
                  <span>Accounting Basis: Accrual</span>
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
                            <strong>{formatINR(row.closing_balance)}</strong> ({row.balance_nature})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="tfoot-totals">
                        <td colSpan="3"><strong>TOTAL</strong></td>
                        <td className="cell-right"><strong>{formatINR(reportData.totals?.totalDebit)}</strong></td>
                        <td className="cell-right"><strong>{formatINR(reportData.totals?.totalCredit)}</strong></td>
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

              {/* 2. PROFIT & LOSS (BUG #3) */}
              {activeReport === "profit-loss" && (() => {
                const incomeRevenue = reportData.income?.totalIncome ?? reportData.income?.totalRevenue ?? reportData.income?.salesRevenue ?? 0;
                const rawMaterialPurchases = reportData.costOfGoodsSold?.rawMaterialPurchases ?? reportData.cogs?.purchases ?? 0;
                const directPlantLabour = reportData.costOfGoodsSold?.directPlantLabour ?? reportData.cogs?.directLabour ?? 0;
                const totalCogs = reportData.costOfGoodsSold?.totalCOGS ?? reportData.cogs?.totalCOGS ?? (rawMaterialPurchases + directPlantLabour);
                const grossProfit = reportData.grossProfit ?? (incomeRevenue - totalCogs);

                const plantElectricity = reportData.operatingExpenses?.plantElectricity ?? 0;
                const factoryMaintenance = reportData.operatingExpenses?.factoryMaintenance ?? 0;
                const adminLabour = reportData.operatingExpenses?.administrativeLabour ?? reportData.expenses?.indirectPayroll ?? 0;
                const totalOperatingExp = reportData.operatingExpenses?.totalOperatingExpenses ?? reportData.expenses?.totalExpenses ?? (plantElectricity + factoryMaintenance + adminLabour);
                const netProfit = reportData.netProfit ?? (grossProfit - totalOperatingExp);

                return (
                  <div className="pl-container">
                    <div className="pl-section">
                      <h3 className="pl-sec-title">Revenue from Operations</h3>
                      <div className="pl-row">
                        <span>Sales & Finished Goods Revenue</span>
                        <span className="pl-amt">{formatINR(incomeRevenue)}</span>
                      </div>
                      <div className="pl-subtotal">
                        <span>Total Revenue (A)</span>
                        <span className="pl-amt">{formatINR(incomeRevenue)}</span>
                      </div>
                    </div>

                    <div className="pl-section">
                      <h3 className="pl-sec-title">Cost of Goods Sold (Direct Costs)</h3>
                      <div className="pl-row">
                        <span>Raw Material Purchases</span>
                        <span className="pl-amt">{formatINR(rawMaterialPurchases)}</span>
                      </div>
                      <div className="pl-row">
                        <span>Factory Direct Labour</span>
                        <span className="pl-amt">{formatINR(directPlantLabour)}</span>
                      </div>
                      <div className="pl-subtotal">
                        <span>Total Direct Cost (B)</span>
                        <span className="pl-amt">{formatINR(totalCogs)}</span>
                      </div>
                    </div>

                    <div className="pl-highlight gross">
                      <span>GROSS PROFIT (A − B)</span>
                      <span className="pl-amt">{formatINR(grossProfit)}</span>
                    </div>

                    <div className="pl-section">
                      <h3 className="pl-sec-title">Operating & Administrative Expenses</h3>
                      {plantElectricity > 0 && (
                        <div className="pl-row">
                          <span>Plant Electricity & Utilities</span>
                          <span className="pl-amt">{formatINR(plantElectricity)}</span>
                        </div>
                      )}
                      {factoryMaintenance > 0 && (
                        <div className="pl-row">
                          <span>Factory & Machinery Maintenance</span>
                          <span className="pl-amt">{formatINR(factoryMaintenance)}</span>
                        </div>
                      )}
                      <div className="pl-row">
                        <span>Administrative & Indirect Labour Payroll</span>
                        <span className="pl-amt">{formatINR(adminLabour)}</span>
                      </div>
                      {plantElectricity === 0 && factoryMaintenance === 0 && (
                        <div className="pl-row">
                          <span>General Operational & Administrative Expenses</span>
                          <span className="pl-amt">{formatINR(reportData.expenses?.operatingExpenses || (totalOperatingExp - adminLabour))}</span>
                        </div>
                      )}
                      <div className="pl-subtotal">
                        <span>Total Operating Expenses (C)</span>
                        <span className="pl-amt">{formatINR(totalOperatingExp)}</span>
                      </div>
                    </div>

                    <div className="pl-highlight net">
                      <span>NET OPERATING PROFIT / (LOSS) (Gross Profit − Expenses)</span>
                      <span className={`pl-amt ${netProfit >= 0 ? "text-teal" : "text-danger"}`}>{formatINR(netProfit)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* 3. BALANCE SHEET (BUG #2) */}
              {activeReport === "balance-sheet" && (() => {
                const currentAssets = reportData.assets?.currentAssets || {};
                const nonCurrentAssets = reportData.assets?.nonCurrentAssets || reportData.assets?.fixedAssets || {};
                const totalAssets = reportData.assets?.totalAssets || 0;

                const liabEq = reportData.liabilitiesAndEquity || reportData.liabilities || {};
                const currentLiabilities = liabEq.currentLiabilities || {};
                const equity = liabEq.equity || {};
                const totalLiabEq = liabEq.totalLiabilitiesAndEquity || (Number(currentLiabilities.totalCurrentLiabilities || 0) + Number(equity.totalEquity || 0));

                const tradeDebtors = currentAssets.accountsReceivable ?? currentAssets.tradeDebtors ?? 0;
                const cashInHand = currentAssets.cashBalance ?? currentAssets.cashInHand ?? 0;
                const bankAccounts = currentAssets.bankBalance ?? currentAssets.bankAccounts ?? 0;
                const rawMaterialInv = currentAssets.rawMaterialInventory ?? 0;
                const finishedGoodsInv = currentAssets.finishedGoodsInventory ?? 0;
                const inputGst = currentAssets.inputGstBalance ?? currentAssets.gstInputCredit ?? 0;
                const subtotalCurrentAssets = currentAssets.totalCurrentAssets ?? currentAssets.subtotal ?? (tradeDebtors + cashInHand + bankAccounts + rawMaterialInv + finishedGoodsInv + inputGst);
                const plantMachinery = nonCurrentAssets.plantAndMachinery ?? nonCurrentAssets.subtotal ?? 0;

                const tradeCreditors = currentLiabilities.accountsPayable ?? currentLiabilities.tradeCreditors ?? 0;
                const outputGst = currentLiabilities.outputGstLiability ?? currentLiabilities.gstOutputTax ?? 0;
                const salaryPayable = currentLiabilities.salaryAndWagesPayable ?? 0;
                const subtotalCurrentLiabilities = currentLiabilities.totalCurrentLiabilities ?? currentLiabilities.subtotal ?? (tradeCreditors + outputGst + salaryPayable);

                const capital = equity.capitalAndReserves ?? equity.capitalAccount ?? 0;
                const retainedEarnings = equity.retainedEarnings;
                const subtotalEquity = equity.totalEquity ?? equity.subtotal ?? (capital + (retainedEarnings || 0));

                return (
                  <div className="bs-grid">
                    <div className="bs-col">
                      <h3 className="bs-col-title">ASSETS</h3>
                      <div className="bs-group">
                        <h4 className="bs-group-title">Current Assets</h4>
                        <div className="pl-row">
                          <span>Trade Debtors / Accounts Receivable</span>
                          <span>{formatINR(tradeDebtors)}</span>
                        </div>
                        <div className="pl-row">
                          <span>Cash in Hand</span>
                          <span>{formatINR(cashInHand)}</span>
                        </div>
                        <div className="pl-row">
                          <span>Bank Balances</span>
                          <span>{formatINR(bankAccounts)}</span>
                        </div>
                        <div className="pl-row">
                          <span>Raw Material Inventory Value</span>
                          <span>{formatINR(rawMaterialInv)}</span>
                        </div>
                        <div className="pl-row">
                          <span>Finished Goods Inventory Value</span>
                          <span>{formatINR(finishedGoodsInv)}</span>
                        </div>
                        <div className="pl-row">
                          <span>Input Tax Credit (ITC) Asset</span>
                          <span>{formatINR(inputGst)}</span>
                        </div>
                        <div className="bs-sub">
                          <span>Subtotal Current Assets</span>
                          <span>{formatINR(subtotalCurrentAssets)}</span>
                        </div>
                      </div>

                      <div className="bs-group">
                        <h4 className="bs-group-title">Non-Current & Fixed Assets</h4>
                        <div className="pl-row">
                          <span>Plant, Machinery & Factory Equipment</span>
                          <span>{formatINR(plantMachinery)}</span>
                        </div>
                      </div>

                      <div className="bs-total">
                        <span>TOTAL ASSETS</span>
                        <span>{formatINR(totalAssets || (subtotalCurrentAssets + plantMachinery))}</span>
                      </div>
                    </div>

                    <div className="bs-col">
                      <h3 className="bs-col-title">LIABILITIES & EQUITY</h3>
                      <div className="bs-group">
                        <h4 className="bs-group-title">Current Liabilities</h4>
                        <div className="pl-row">
                          <span>Trade Creditors / Accounts Payable</span>
                          <span>{formatINR(tradeCreditors)}</span>
                        </div>
                        <div className="pl-row">
                          <span>GST Output Tax Liability</span>
                          <span>{formatINR(outputGst)}</span>
                        </div>
                        {salaryPayable > 0 && (
                          <div className="pl-row">
                            <span>Salary & Wages Payable</span>
                            <span>{formatINR(salaryPayable)}</span>
                          </div>
                        )}
                        <div className="bs-sub">
                          <span>Subtotal Current Liabilities</span>
                          <span>{formatINR(subtotalCurrentLiabilities)}</span>
                        </div>
                      </div>

                      <div className="bs-group">
                        <h4 className="bs-group-title">Equity & Reserves</h4>
                        <div className="pl-row">
                          <span>Capital Account & Reserves</span>
                          <span>{formatINR(capital)}</span>
                        </div>
                        {retainedEarnings !== undefined && (
                          <div className="pl-row">
                            <span>Retained Earnings / Current Period P&L</span>
                            <span>{formatINR(retainedEarnings)}</span>
                          </div>
                        )}
                        <div className="bs-sub">
                          <span>Subtotal Equity</span>
                          <span>{formatINR(subtotalEquity)}</span>
                        </div>
                      </div>

                      <div className="bs-total">
                        <span>TOTAL LIABILITIES & EQUITY</span>
                        <span>{formatINR(totalLiabEq)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 4. CASH BOOK & BANK BOOK (BUGS #4 & #5) */}
              {(activeReport === "cash-book" || activeReport === "bank-book") && (() => {
                const summary = reportData.summary || reportData || {};
                const openingBal = summary.openingBalance ?? 0;
                const inflow = summary.totalReceipts ?? summary.totalDeposits ?? reportData.totalReceipts ?? reportData.totalDeposits ?? 0;
                const outflow = summary.totalPayments ?? summary.totalWithdrawals ?? reportData.totalPayments ?? reportData.totalWithdrawals ?? 0;
                const closingBal = summary.closingBalance ?? reportData.closingBalance ?? (openingBal + inflow - outflow);
                const accountTitle = summary.accountName || summary.bankName || (activeReport === "cash-book" ? "Cash Register" : "Bank Book");

                return (
                  <div className="fin-table-wrapper">
                    <div className="book-summary-header">
                      <span>Account: <strong>{accountTitle}</strong></span>
                      <span>Opening Balance: <strong>{formatINR(openingBal)}</strong></span>
                      <span>Total Inflow: <strong className="text-teal">{formatINR(inflow)}</strong></span>
                      <span>Total Outflow: <strong className="text-danger">{formatINR(outflow)}</strong></span>
                      <span>Closing Balance: <strong className="text-blue">{formatINR(closingBal)}</strong></span>
                    </div>

                    <table className="fin-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Doc / Ref #</th>
                          <th>Particulars / Description</th>
                          <th>Type</th>
                          <th className="cell-right">Receipt / Deposit (₹)</th>
                          <th className="cell-right">Payment / Withdrawal (₹)</th>
                          <th className="cell-right">Running Balance (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!reportData.transactions || reportData.transactions.length === 0 ? (
                          <tr><td colSpan="7" className="fin-table-empty">No transactions found for this period.</td></tr>
                        ) : (
                          reportData.transactions.map((t, idx) => {
                            const isInflow = ["DEPOSIT", "RECEIPT"].includes(t.transaction_type) || (t.transaction_type === "TRANSFER" && t.description?.includes("Transfer from")) || Number(t.receipt || t.deposit || 0) > 0;
                            const isOutflow = ["WITHDRAWAL", "PAYMENT"].includes(t.transaction_type) || (t.transaction_type === "TRANSFER" && t.description?.includes("Transfer to")) || Number(t.payment || t.withdrawal || 0) > 0;
                            const amtIn = isInflow ? Number(t.amount || t.receipt || t.deposit || 0) : 0;
                            const amtOut = isOutflow ? Number(t.amount || t.payment || t.withdrawal || 0) : 0;

                            return (
                              <tr key={t.id || idx}>
                                <td>{(t.transaction_date || t.date)?.split("T")[0]}</td>
                                <td><code className="fin-code-chip">{t.reference_no || (t.id ? `#${t.id}` : "—")}</code></td>
                                <td>{t.description || t.particulars || t.party_name || "—"}</td>
                                <td><span className="fin-group-chip">{t.transaction_type || t.type || "GEN"}</span></td>
                                <td className="cell-right">{amtIn > 0 ? formatINR(amtIn) : "—"}</td>
                                <td className="cell-right">{amtOut > 0 ? formatINR(amtOut) : "—"}</td>
                                <td className="cell-right"><strong>{t.running_balance !== undefined || t.balance !== undefined ? formatINR(t.running_balance ?? t.balance) : "—"}</strong></td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* 5. CUSTOMER & SUPPLIER LEDGERS (BUGS #6 & #7) */}
              {(activeReport === "customer-ledger" || activeReport === "supplier-ledger") && (
                <div className="fin-table-wrapper">
                  <table className="fin-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Doc / Ref #</th>
                        <th>Party Name</th>
                        <th>Description / Transaction</th>
                        <th className="cell-right">Debit (₹)</th>
                        <th className="cell-right">Credit (₹)</th>
                        <th className="cell-right">Running Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!reportData.entries || reportData.entries.length === 0 ? (
                        <tr><td colSpan="7" className="fin-table-empty">No ledger entries found.</td></tr>
                      ) : (
                        reportData.entries.map((e, idx) => {
                          const rowDate = (e.transaction_date || e.entry_date)?.split("T")[0];
                          const party = e.customer_name || e.supplier_name || e.party_name || "—";
                          const debit = Number(e.debit ?? e.debit_amount ?? 0);
                          const credit = Number(e.credit ?? e.credit_amount ?? 0);
                          const balance = Number(e.balance ?? e.running_balance ?? 0);

                          return (
                            <tr key={e.id || idx}>
                              <td>{rowDate}</td>
                              <td><code className="fin-code-chip">{e.reference_no || "—"}</code></td>
                              <td><strong>{party}</strong></td>
                              <td>{e.notes || e.narration || e.transaction_type || "Ledger Entry"}</td>
                              <td className="cell-right">{debit > 0 ? formatINR(debit) : "—"}</td>
                              <td className="cell-right">{credit > 0 ? formatINR(credit) : "—"}</td>
                              <td className="cell-right"><strong>{formatINR(balance)}</strong></td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 6. RECEIVABLES & PAYABLES AGING (BUGS #8 & #9) */}
              {(activeReport === "receivables" || activeReport === "payables") && (() => {
                const isRec = activeReport === "receivables";
                const aging = reportData.aging || {};
                const b0_30 = aging.bucket0_30 ?? reportData.totals?.bucket_0_30 ?? 0;
                const b31_60 = aging.bucket31_60 ?? reportData.totals?.bucket_31_60 ?? 0;
                const b61_90 = aging.bucket61_90 ?? reportData.totals?.bucket_61_90 ?? 0;
                const b90_plus = aging.bucket90Plus ?? reportData.totals?.bucket_90_plus ?? 0;
                const total = aging.totalOutstanding ?? aging.totalPayable ?? reportData.totals?.grandTotal ?? (b0_30 + b31_60 + b61_90 + b90_plus);

                const items = isRec ? reportData.invoices : reportData.bills;

                return (
                  <div className="statement-wrapper">
                    {/* Aging KPI Summary Cards */}
                    <div className="fin-kpi-grid">
                      <div className="fin-kpi-card">
                        <span className="fin-kpi-label">0 – 30 Days (Current)</span>
                        <span className="fin-kpi-value text-teal">{formatINR(b0_30)}</span>
                      </div>
                      <div className="fin-kpi-card">
                        <span className="fin-kpi-label">31 – 60 Days</span>
                        <span className="fin-kpi-value text-blue">{formatINR(b31_60)}</span>
                      </div>
                      <div className="fin-kpi-card">
                        <span className="fin-kpi-label">61 – 90 Days</span>
                        <span className="fin-kpi-value">{formatINR(b61_90)}</span>
                      </div>
                      <div className="fin-kpi-card warning">
                        <span className="fin-kpi-label">90+ Days (Overdue)</span>
                        <span className="fin-kpi-value text-danger">{formatINR(b90_plus)}</span>
                      </div>
                      <div className="fin-kpi-card highlight">
                        <span className="fin-kpi-label">{isRec ? "Total Receivables" : "Total Payables"}</span>
                        <span className="fin-kpi-value">{formatINR(total)}</span>
                      </div>
                    </div>

                    {/* Itemized Table */}
                    <div className="fin-table-wrapper">
                      <h4 className="fin-section-title">{isRec ? "Outstanding Customer Invoices" : "Outstanding Supplier Purchase Bills"}</h4>
                      <table className="fin-table">
                        <thead>
                          {isRec ? (
                            <tr>
                              <th>Invoice #</th>
                              <th>Customer Name</th>
                              <th>Contact</th>
                              <th>Date</th>
                              <th>Aged</th>
                              <th className="cell-right">Grand Total (₹)</th>
                              <th className="cell-right">Paid (₹)</th>
                              <th className="cell-right">Outstanding (₹)</th>
                            </tr>
                          ) : (
                            <tr>
                              <th>Purchase Bill #</th>
                              <th>Supplier Name</th>
                              <th>Contact</th>
                              <th>Purchase Date</th>
                              <th>Aged</th>
                              <th className="cell-right">Bill Total (₹)</th>
                            </tr>
                          )}
                        </thead>
                        <tbody>
                          {!items || items.length === 0 ? (
                            <tr><td colSpan={isRec ? 8 : 6} className="fin-table-empty">{isRec ? "No outstanding customer invoices found." : "No outstanding supplier bills found."}</td></tr>
                          ) : (
                            items.map((row, idx) => {
                              const docNo = row.invoice_no || row.purchase_bill_no || `#${row.id}`;
                              const partyName = row.customer_name || row.supplier_name || "—";
                              const phone = row.mobile || "—";
                              const date = (row.created_at || row.purchase_date)?.split("T")[0];
                              const aged = row.days_aged !== undefined ? `${row.days_aged}d` : "—";
                              const grandTotal = Number(row.grand_total || 0);
                              const paid = Number(row.paid_amount || 0);
                              const outstanding = Number(row.outstanding_amount ?? grandTotal - paid);

                              return isRec ? (
                                <tr key={row.id || idx}>
                                  <td><code className="fin-code-chip">{docNo}</code></td>
                                  <td><strong>{partyName}</strong></td>
                                  <td>{phone}</td>
                                  <td>{date}</td>
                                  <td><span className={`fin-group-chip ${Number(row.days_aged) > 60 ? "text-danger" : ""}`}>{aged}</span></td>
                                  <td className="cell-right">{formatINR(grandTotal)}</td>
                                  <td className="cell-right">{formatINR(paid)}</td>
                                  <td className="cell-right"><strong className="text-blue">{formatINR(outstanding)}</strong></td>
                                </tr>
                              ) : (
                                <tr key={row.id || idx}>
                                  <td><code className="fin-code-chip">{docNo}</code></td>
                                  <td><strong>{partyName}</strong></td>
                                  <td>{phone}</td>
                                  <td>{date}</td>
                                  <td><span className={`fin-group-chip ${Number(row.days_aged) > 60 ? "text-danger" : ""}`}>{aged}</span></td>
                                  <td className="cell-right"><strong>{formatINR(grandTotal)}</strong></td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* 7. EXPENSE REPORT (BUG #11) */}
              {activeReport === "expense-report" && (() => {
                const byCategory = reportData.byCategory || [];
                const byMode = reportData.byPaymentMode || [];
                const totalExp = reportData.totalExpenses || byCategory.reduce((acc, c) => acc + Number(c.total_amount || 0), 0);

                return (
                  <div className="statement-wrapper">
                    <div className="fin-kpi-grid">
                      <div className="fin-kpi-card highlight">
                        <span className="fin-kpi-label">Total Operational Expenses</span>
                        <span className="fin-kpi-value text-danger">{formatINR(totalExp)}</span>
                      </div>
                      <div className="fin-kpi-card">
                        <span className="fin-kpi-label">Expense Categories</span>
                        <span className="fin-kpi-value">{byCategory.length}</span>
                      </div>
                      <div className="fin-kpi-card">
                        <span className="fin-kpi-label">Payment Modes</span>
                        <span className="fin-kpi-value">{byMode.length}</span>
                      </div>
                    </div>

                    <div className="fin-grid-2col">
                      <div className="fin-table-wrapper">
                        <h4 className="fin-section-title">Expenses by Category</h4>
                        <table className="fin-table">
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th>Code</th>
                              <th className="cell-right">Vouchers</th>
                              <th className="cell-right">Total Amount (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {byCategory.length === 0 ? (
                              <tr><td colSpan="4" className="fin-table-empty">No categorized expenses recorded.</td></tr>
                            ) : (
                              byCategory.map((cat, idx) => (
                                <tr key={idx}>
                                  <td><strong>{cat.category_name}</strong></td>
                                  <td><code className="fin-code-chip">{cat.category_code || "—"}</code></td>
                                  <td className="cell-right">{cat.voucher_count}</td>
                                  <td className="cell-right"><strong>{formatINR(cat.total_amount)}</strong></td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          {byCategory.length > 0 && (
                            <tfoot>
                              <tr className="tfoot-totals">
                                <td colSpan="3"><strong>TOTAL EXPENSES</strong></td>
                                <td className="cell-right"><strong>{formatINR(totalExp)}</strong></td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>

                      <div className="fin-table-wrapper">
                        <h4 className="fin-section-title">Expenses by Payment Mode</h4>
                        <table className="fin-table">
                          <thead>
                            <tr>
                              <th>Payment Mode</th>
                              <th className="cell-right">Vouchers</th>
                              <th className="cell-right">Total Disbursed (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {byMode.length === 0 ? (
                              <tr><td colSpan="3" className="fin-table-empty">No payment mode breakdown available.</td></tr>
                            ) : (
                              byMode.map((m, idx) => (
                                <tr key={idx}>
                                  <td><span className="fin-group-chip">{m.payment_mode}</span></td>
                                  <td className="cell-right">{m.count}</td>
                                  <td className="cell-right"><strong>{formatINR(m.total_amount)}</strong></td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 8. GST SUMMARY (BUG #11) */}
              {activeReport === "gst-summary" && (() => {
                const output = reportData.outputGst || {};
                const input = reportData.inputGst || {};
                const netPayable = reportData.netTaxPayable ?? Math.max(0, Number(output.total_tax || 0) - Number(input.total_tax || 0));

                return (
                  <div className="statement-wrapper">
                    <div className="fin-kpi-grid">
                      <div className="fin-kpi-card">
                        <span className="fin-kpi-label">Output GST (Liability on Sales)</span>
                        <span className="fin-kpi-value text-danger">{formatINR(output.total_tax)}</span>
                      </div>
                      <div className="fin-kpi-card">
                        <span className="fin-kpi-label">Input GST (ITC on Purchases)</span>
                        <span className="fin-kpi-value text-teal">{formatINR(input.total_tax)}</span>
                      </div>
                      <div className={`fin-kpi-card ${netPayable > 0 ? "warning" : "highlight"}`}>
                        <span className="fin-kpi-label">Net Tax Payable / (Credit Balance)</span>
                        <span className={`fin-kpi-value ${netPayable > 0 ? "text-danger" : "text-teal"}`}>{formatINR(netPayable)}</span>
                      </div>
                    </div>

                    <div className="fin-table-wrapper">
                      <h4 className="fin-section-title">Consolidated GST Periodic Statement</h4>
                      <table className="fin-table">
                        <thead>
                          <tr>
                            <th>Tax Classification</th>
                            <th className="cell-right">Taxable Turnover (₹)</th>
                            <th className="cell-right">CGST (₹)</th>
                            <th className="cell-right">SGST (₹)</th>
                            <th className="cell-right">IGST (₹)</th>
                            <th className="cell-right">Total Tax (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><strong>Output GST (Outward Supplies / Sales)</strong></td>
                            <td className="cell-right">{formatINR(output.total_taxable)}</td>
                            <td className="cell-right">{formatINR(output.total_cgst)}</td>
                            <td className="cell-right">{formatINR(output.total_sgst)}</td>
                            <td className="cell-right">{formatINR(output.total_igst)}</td>
                            <td className="cell-right"><strong className="text-danger">{formatINR(output.total_tax)}</strong></td>
                          </tr>
                          <tr>
                            <td><strong>Input GST (Inward Supplies / Purchases ITC)</strong></td>
                            <td className="cell-right">{formatINR(input.total_taxable)}</td>
                            <td className="cell-right">{formatINR(input.total_cgst)}</td>
                            <td className="cell-right">{formatINR(input.total_sgst)}</td>
                            <td className="cell-right">{formatINR(input.total_igst)}</td>
                            <td className="cell-right"><strong className="text-teal">{formatINR(input.total_tax)}</strong></td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="tfoot-totals">
                            <td><strong>NET TAX PAYABLE TO GOVERNMENT</strong></td>
                            <td className="cell-right">—</td>
                            <td className="cell-right">{formatINR(Math.max(0, Number(output.total_cgst || 0) - Number(input.total_cgst || 0)))}</td>
                            <td className="cell-right">{formatINR(Math.max(0, Number(output.total_sgst || 0) - Number(input.total_sgst || 0)))}</td>
                            <td className="cell-right">{formatINR(Math.max(0, Number(output.total_igst || 0) - Number(input.total_igst || 0)))}</td>
                            <td className="cell-right"><strong className={netPayable > 0 ? "text-danger" : "text-teal"}>{formatINR(netPayable)}</strong></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* 9. HSN SUMMARY (BUG #11) */}
              {activeReport === "hsn-summary" && (() => {
                const rows = reportData.hsnRows || [];
                const totalTaxable = rows.reduce((acc, r) => acc + Number(r.taxable_value || 0), 0);
                const totalTax = rows.reduce((acc, r) => acc + Number(r.total_tax || 0), 0);

                return (
                  <div className="fin-table-wrapper">
                    <table className="fin-table">
                      <thead>
                        <tr>
                          <th>HSN / SAC Code</th>
                          <th>Type</th>
                          <th className="cell-right">Voucher Count</th>
                          <th className="cell-right">Taxable Value (₹)</th>
                          <th className="cell-right">CGST (₹)</th>
                          <th className="cell-right">SGST (₹)</th>
                          <th className="cell-right">IGST (₹)</th>
                          <th className="cell-right">Total Tax (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr><td colSpan="8" className="fin-table-empty">No HSN / SAC records found for this period.</td></tr>
                        ) : (
                          rows.map((r, idx) => (
                            <tr key={idx}>
                              <td><code className="fin-code-chip">{r.hsn_code}</code></td>
                              <td><span className="fin-group-chip">{r.gst_type}</span></td>
                              <td className="cell-right">{r.count}</td>
                              <td className="cell-right">{formatINR(r.taxable_value)}</td>
                              <td className="cell-right">{formatINR(r.cgst)}</td>
                              <td className="cell-right">{formatINR(r.sgst)}</td>
                              <td className="cell-right">{formatINR(r.igst)}</td>
                              <td className="cell-right"><strong>{formatINR(r.total_tax)}</strong></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {rows.length > 0 && (
                        <tfoot>
                          <tr className="tfoot-totals">
                            <td colSpan="3"><strong>TOTAL</strong></td>
                            <td className="cell-right"><strong>{formatINR(totalTaxable)}</strong></td>
                            <td colSpan="3"></td>
                            <td className="cell-right"><strong>{formatINR(totalTax)}</strong></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                );
              })()}

              {/* 10. CASH FLOW STATEMENT (BUG #11) */}
              {activeReport === "cash-flow" && (() => {
                const ops = reportData.cashFlowFromOperations || {};
                const inflows = ops.inflows || {};
                const outflows = ops.outflows || {};
                const netOps = ops.netOperatingCashFlow ?? 0;
                const investing = reportData.cashFlowFromInvesting?.netInvestingCashFlow ?? 0;
                const financing = reportData.cashFlowFromFinancing?.netFinancingCashFlow ?? 0;
                const netChange = reportData.netChangeInCash ?? (netOps + investing + financing);

                return (
                  <div className="pl-container">
                    <div className="pl-section">
                      <h3 className="pl-sec-title">1. Cash Flow from Operating Activities</h3>
                      <div className="pl-row">
                        <span>Customer Collections (Inflows)</span>
                        <span className="pl-amt text-teal">{formatINR(inflows.customerCollections ?? inflows.totalInflows)}</span>
                      </div>
                      <div className="pl-row">
                        <span>Supplier Disbursements (Outflows)</span>
                        <span className="pl-amt text-danger">({formatINR(outflows.supplierDisbursements)})</span>
                      </div>
                      <div className="pl-row">
                        <span>Operational & Factory Expenses</span>
                        <span className="pl-amt text-danger">({formatINR(outflows.expenseDisbursements)})</span>
                      </div>
                      <div className="pl-row">
                        <span>Plant Payroll & Staff Disbursements</span>
                        <span className="pl-amt text-danger">({formatINR(outflows.payrollDisbursements)})</span>
                      </div>
                      <div className="pl-subtotal">
                        <span>Net Cash from Operating Activities</span>
                        <span className={`pl-amt ${netOps >= 0 ? "text-teal" : "text-danger"}`}>{formatINR(netOps)}</span>
                      </div>
                    </div>

                    <div className="pl-section">
                      <h3 className="pl-sec-title">2. Cash Flow from Investing Activities</h3>
                      <div className="pl-row">
                        <span>Machinery & Factory Capex</span>
                        <span className="pl-amt">{formatINR(reportData.cashFlowFromInvesting?.machineryCapex ?? 0)}</span>
                      </div>
                      <div className="pl-subtotal">
                        <span>Net Cash from Investing Activities</span>
                        <span className="pl-amt">{formatINR(investing)}</span>
                      </div>
                    </div>

                    <div className="pl-section">
                      <h3 className="pl-sec-title">3. Cash Flow from Financing Activities</h3>
                      <div className="pl-row">
                        <span>Capital Introduced / Debt Financing</span>
                        <span className="pl-amt">{formatINR(reportData.cashFlowFromFinancing?.capitalIntroduced ?? 0)}</span>
                      </div>
                      <div className="pl-subtotal">
                        <span>Net Cash from Financing Activities</span>
                        <span className="pl-amt">{formatINR(financing)}</span>
                      </div>
                    </div>

                    <div className={`pl-highlight ${netChange >= 0 ? "net" : "gross"}`}>
                      <span>NET CHANGE IN LIQUID CASH & BANK FUNDS</span>
                      <span className={`pl-amt ${netChange >= 0 ? "text-teal" : "text-danger"}`}>{formatINR(netChange)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* 11. GENERAL LEDGER (BUG #11) */}
              {activeReport === "general-ledger" && (() => {
                const account = reportData.account || {};
                const summary = reportData.summary || {};
                const entries = reportData.entries || [];

                return (
                  <div className="statement-wrapper">
                    <div className="book-summary-header">
                      <span>Account: <strong>{account.account_name || "General Ledger"}</strong> {account.account_code ? `(${account.account_code})` : ""}</span>
                      <span>Opening: <strong>{formatINR(summary.openingBalance)}</strong></span>
                      <span>Total Debits: <strong className="text-teal">{formatINR(summary.totalDebits)}</strong></span>
                      <span>Total Credits: <strong className="text-danger">{formatINR(summary.totalCredits)}</strong></span>
                      <span>Closing Balance: <strong className="text-blue">{formatINR(summary.closingBalance)}</strong></span>
                    </div>

                    <div className="fin-table-wrapper">
                      <table className="fin-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Journal #</th>
                            <th>Ref #</th>
                            <th>Narration / Particulars</th>
                            <th className="cell-right">Debit (₹)</th>
                            <th className="cell-right">Credit (₹)</th>
                            <th className="cell-right">Running Balance (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.length === 0 ? (
                            <tr><td colSpan="7" className="fin-table-empty">No journal transactions recorded for this account.</td></tr>
                          ) : (
                            entries.map((e, idx) => (
                              <tr key={e.id || idx}>
                                <td>{e.entry_date?.split("T")[0]}</td>
                                <td><code className="fin-code-chip">{e.journal_no || "—"}</code></td>
                                <td>{e.reference_no || "—"}</td>
                                <td>{e.narration || "General Journal Entry"}</td>
                                <td className="cell-right">{Number(e.debit) > 0 ? formatINR(e.debit) : "—"}</td>
                                <td className="cell-right">{Number(e.credit) > 0 ? formatINR(e.credit) : "—"}</td>
                                <td className="cell-right"><strong>{formatINR(e.balance)}</strong></td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Fallback for unknown report keys */}
              {!["trial-balance", "profit-loss", "balance-sheet", "cash-book", "bank-book", "customer-ledger", "supplier-ledger", "receivables", "payables", "expense-report", "gst-summary", "hsn-summary", "cash-flow", "general-ledger"].includes(activeReport) && (
                <div className="statement-wrapper">
                  <div className="fin-kpi-card">
                    <span className="fin-kpi-label">Report Data</span>
                    <pre className="fin-json-display">{JSON.stringify(reportData, null, 2)}</pre>
                  </div>
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
