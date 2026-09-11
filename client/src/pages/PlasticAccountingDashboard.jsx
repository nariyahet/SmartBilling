import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Button } from "../components";
import "./PlasticAccountingDashboard.css";

function PlasticAccountingDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get("/plastic-erp/accounting/financial-reports/dashboard-kpis");
      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load financial dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  const kpis = data?.kpis || {};
  const monthlyTrends = data?.monthlyTrends || [];

  return (
    <div className="sb-page-container">
      <PlasticNavbar />
      <main className="sb-main-content">
        <PageHeader
          title="Accounting & Financial Dashboard"
          subtitle="Real-time cash flow, double-entry financial health, operating margin analysis, and statutory GST liabilities"
          breadcrumbs={[
            { label: "Plastic ERP", to: "/plastic-erp" },
            { label: "Accounting & GST", to: "/plastic-erp/accounting-dashboard" },
            { label: "Executive Dashboard" },
          ]}
          actions={
            <Button
              variant="outline"
              icon="🔄"
              onClick={fetchKPIs}
            >
              Refresh Analytics
            </Button>
          }
        />

        {error && <div className="sb-alert-danger">{error}</div>}

        {loading ? (
          <LoadingScreen message="Compiling executive financial indicators..." />
        ) : (
          <>
            {/* Top KPIs Row: Liquidity & Profits */}
            <div className="acc-kpis-grid">
              <KpiCard
                title="Total Revenue (Invoiced)"
                value={`₹${Number(kpis.totalRevenue || 0).toLocaleString("en-IN")}`}
                subtitle="All sales invoices & scrap dispatches"
                icon="📈"
                color="blue"
              />
              <KpiCard
                title="Total Purchases (Direct Cost)"
                value={`₹${Number(kpis.totalPurchases || 0).toLocaleString("en-IN")}`}
                subtitle="Raw scrap & production inputs"
                icon="📦"
                color="navy"
              />
              <KpiCard
                title="Gross Operating Profit"
                value={`₹${Number(kpis.grossProfit || 0).toLocaleString("en-IN")}`}
                subtitle="Revenue − Purchases & Direct Labor"
                icon="💰"
                color="teal"
              />
              <KpiCard
                title="Net Profit (EBITDA)"
                value={`₹${Number(kpis.netProfit || 0).toLocaleString("en-IN")}`}
                subtitle="After all OPEX & indirect payroll"
                icon="💎"
                color="teal"
              />
            </div>

            {/* Second Row: Working Capital & Liquid Balances */}
            <div className="acc-kpis-grid">
              <KpiCard
                title="Trade Receivables (Debtors)"
                value={`₹${Number(kpis.receivables || 0).toLocaleString("en-IN")}`}
                subtitle="Pending collection from buyers"
                icon="⏳"
                color="amber"
              />
              <KpiCard
                title="Trade Payables (Creditors)"
                value={`₹${Number(kpis.payables || 0).toLocaleString("en-IN")}`}
                subtitle="Pending payouts to scrap suppliers"
                icon="🧾"
                color="amber"
              />
              <KpiCard
                title="Cash on Hand"
                value={`₹${Number(kpis.cashBalance || 0).toLocaleString("en-IN")}`}
                subtitle="Petty cash & physical vault"
                icon="💵"
                color="blue"
              />
              <KpiCard
                title="Bank Accounts"
                value={`₹${Number(kpis.bankBalance || 0).toLocaleString("en-IN")}`}
                subtitle="Current & operative balances"
                icon="🏛️"
                color="navy"
              />
            </div>

            {/* GST Summary Bar */}
            <div className="acc-gst-strip">
              <div className="gst-stat">
                <span className="gst-stat-lbl">Output GST (Collected)</span>
                <span className="gst-stat-val">₹{Number(kpis.outputGst || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="gst-stat-sep" />
              <div className="gst-stat">
                <span className="gst-stat-lbl">Input Tax Credit (ITC Available)</span>
                <span className="gst-stat-val text-teal">₹{Number(kpis.inputGst || 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="gst-stat-sep" />
              <div className="gst-stat gst-stat-total">
                <span className="gst-stat-lbl">Net GST Payable (To Govt)</span>
                <span className="gst-stat-val text-navy">₹{Number(kpis.netGstPayable || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Financial Trends & Quick Portals Grid */}
            <div className="acc-split-grid">
              {/* Left: 6-Month Monthly Trends */}
              <Card
                title="6-Month Financial Trajectory"
                subtitle="Monthly revenue, direct & indirect expenses, and operating margins"
              >
                <div className="acc-table-wrapper">
                  {monthlyTrends.length === 0 ? (
                    <div className="acc-empty-trends">No historical monthly records available yet.</div>
                  ) : (
                    <table className="acc-trend-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th className="cell-right">Revenue (₹)</th>
                          <th className="cell-right">Expenses (₹)</th>
                          <th className="cell-right">Operating Margin (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyTrends.map((t, idx) => (
                          <tr key={idx}>
                            <td><strong>{t.month}</strong></td>
                            <td className="cell-right">₹{Number(t.revenue).toLocaleString("en-IN")}</td>
                            <td className="cell-right">₹{Number(t.expenses).toLocaleString("en-IN")}</td>
                            <td className="cell-right">
                              <strong className={t.profit >= 0 ? "text-teal" : "text-danger"}>
                                ₹{Number(t.profit).toLocaleString("en-IN")}
                              </strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </Card>

              {/* Right: Quick Accounting & Audit Portals */}
              <Card
                title="Quick Accounting & Audit Portals"
                subtitle="Direct shortcuts to general ledger operations and statutory tax filings"
              >
                <div className="acc-quick-links-grid">
                  <Link to="/plastic-erp/chart-of-accounts" className="acc-quick-btn">
                    <span className="quick-icon">📑</span>
                    <div className="quick-meta">
                      <strong>Chart of Accounts</strong>
                      <p>View hierarchical financial ledger</p>
                    </div>
                  </Link>

                  <Link to="/plastic-erp/journal-entries" className="acc-quick-btn">
                    <span className="quick-icon">✍️</span>
                    <div className="quick-meta">
                      <strong>Journal Entries</strong>
                      <p>Record manual double-entry vouchers</p>
                    </div>
                  </Link>

                  <Link to="/plastic-erp/cash-bank" className="acc-quick-btn">
                    <span className="quick-icon">💵</span>
                    <div className="quick-meta">
                      <strong>Cash & Bank Ledgers</strong>
                      <p>Vault balance, contra & deposits</p>
                    </div>
                  </Link>

                  <Link to="/plastic-erp/bank-reconciliation" className="acc-quick-btn">
                    <span className="quick-icon">🏛️</span>
                    <div className="quick-meta">
                      <strong>Bank Reconciliation</strong>
                      <p>Match book records with bank slips</p>
                    </div>
                  </Link>

                  <Link to="/plastic-erp/gst-management" className="acc-quick-btn">
                    <span className="quick-icon">⚖️</span>
                    <div className="quick-meta">
                      <strong>GSTR-1 & 3B Preparation</strong>
                      <p>Statutory return tables & ITC register</p>
                    </div>
                  </Link>

                  <Link to="/plastic-erp/gst-reconciliation" className="acc-quick-btn">
                    <span className="quick-icon">🔍</span>
                    <div className="quick-meta">
                      <strong>GSTR-2B Reconciliation</strong>
                      <p>Verify supplier portal filings vs books</p>
                    </div>
                  </Link>

                  <Link to="/plastic-erp/financial-reports" className="acc-quick-btn">
                    <span className="quick-icon">📊</span>
                    <div className="quick-meta">
                      <strong>14 Financial Reports</strong>
                      <p>Trial Balance, P&L, Balance Sheet, Aging</p>
                    </div>
                  </Link>
                </div>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default PlasticAccountingDashboard;
