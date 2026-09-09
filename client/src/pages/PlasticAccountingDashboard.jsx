import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import PlasticNavbar from "../components/PlasticNavbar";
import "./PlasticAccountingDashboard.css";

const API_BASE = "http://localhost:5000/api/plastic-erp/reports";

const PlasticAccountingDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchKPIs();
  }, []);

  const fetchKPIs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/dashboard-kpis`, { headers });
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load financial dashboard");
    } finally {
      setLoading(false);
    }
  };

  const kpis = data?.kpis || {};
  const monthlyTrends = data?.monthlyTrends || [];

  return (
    <div className="plastic-acc-dash-page">
      <PlasticNavbar />
      <div className="dash-container">
        {/* Header */}
        <div className="dash-header">
          <div>
            <span className="badge-phase">PHASE 5: ERP EXECUTIVE CONTROL</span>
            <h1 className="page-title">🏛️ Accounting & Financial Dashboard</h1>
            <p className="page-subtitle">
              Real-time cash flow, double-entry financial health, profit metrics, and GST liabilities.
            </p>
          </div>
          <div className="dash-actions">
            <button className="btn-refresh" onClick={fetchKPIs} title="Refresh KPIs">
              🔄 Refresh Analytics
            </button>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {loading ? (
          <div className="dash-loading">
            <div className="spinner"></div>
            <p>Compiling executive financial indicators...</p>
          </div>
        ) : (
          <>
            {/* Top KPIs Row: Liquidity & Profits */}
            <div className="kpi-row">
              <div className="card-kpi primary">
                <span className="card-label">Total Revenue (Invoiced)</span>
                <span className="card-val">₹{Number(kpis.totalRevenue || 0).toLocaleString()}</span>
                <span className="card-hint">All sales invoices & scrap dispatches</span>
              </div>
              <div className="card-kpi">
                <span className="card-label">Total Purchases (Direct Cost)</span>
                <span className="card-val">₹{Number(kpis.totalPurchases || 0).toLocaleString()}</span>
                <span className="card-hint">Raw scrap & production inputs</span>
              </div>
              <div className="card-kpi success">
                <span className="card-label">Gross Operating Profit</span>
                <span className="card-val text-green">₹{Number(kpis.grossProfit || 0).toLocaleString()}</span>
                <span className="card-hint">Revenue − Purchases & Factory Labor</span>
              </div>
              <div className="card-kpi highlight">
                <span className="card-label">Net Profit (EBITDA)</span>
                <span className="card-val text-blue">₹{Number(kpis.netProfit || 0).toLocaleString()}</span>
                <span className="card-hint">After all OPEX & indirect payroll</span>
              </div>
            </div>

            {/* Second Row: Working Capital & Liquid Balances */}
            <div className="kpi-row">
              <div className="card-kpi">
                <span className="card-label">Trade Receivables (Debtors)</span>
                <span className="card-val text-amber">₹{Number(kpis.receivables || 0).toLocaleString()}</span>
                <span className="card-hint">Pending collection from buyers</span>
              </div>
              <div className="card-kpi">
                <span className="card-label">Trade Payables (Creditors)</span>
                <span className="card-val text-red">₹{Number(kpis.payables || 0).toLocaleString()}</span>
                <span className="card-hint">Pending payouts to scrap suppliers</span>
              </div>
              <div className="card-kpi">
                <span className="card-label">Cash on Hand</span>
                <span className="card-val">₹{Number(kpis.cashBalance || 0).toLocaleString()}</span>
                <span className="card-hint">Petty cash & physical vault</span>
              </div>
              <div className="card-kpi">
                <span className="card-label">Bank Accounts</span>
                <span className="card-val">₹{Number(kpis.bankBalance || 0).toLocaleString()}</span>
                <span className="card-hint">Current & savings balances</span>
              </div>
            </div>

            {/* Third Row: GST Compliance Summary */}
            <div className="gst-strip">
              <div className="gst-col">
                <span className="gst-lbl">Output GST (Collected)</span>
                <span className="gst-val">₹{Number(kpis.outputGst || 0).toLocaleString()}</span>
              </div>
              <div className="gst-col">
                <span className="gst-lbl">Input Tax Credit (ITC Available)</span>
                <span className="gst-val text-green">₹{Number(kpis.inputGst || 0).toLocaleString()}</span>
              </div>
              <div className="gst-col total">
                <span className="gst-lbl">Net GST Payable (To Government)</span>
                <span className="gst-val highlight">₹{Number(kpis.netGstPayable || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Financial Trends & Quick Operations */}
            <div className="dash-split-grid">
              {/* Left: 6-Month Monthly Trends */}
              <div className="panel-card">
                <div className="panel-header">
                  <h3>📊 6-Month Financial Trajectory</h3>
                  <span className="panel-badge">Revenue vs OPEX</span>
                </div>
                <div className="trend-table-box">
                  {monthlyTrends.length === 0 ? (
                    <div className="empty-trends">No historical monthly records available yet.</div>
                  ) : (
                    <table className="trend-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Revenue (₹)</th>
                          <th>Expenses (₹)</th>
                          <th>Operating Margin (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyTrends.map((t, idx) => (
                          <tr key={idx}>
                            <td><strong>{t.month}</strong></td>
                            <td>₹{Number(t.revenue).toLocaleString()}</td>
                            <td>₹{Number(t.expenses).toLocaleString()}</td>
                            <td>
                              <span className={t.profit >= 0 ? "text-green font-bold" : "text-red font-bold"}>
                                ₹{Number(t.profit).toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Right: Quick Compliance Navigation */}
              <div className="panel-card">
                <div className="panel-header">
                  <h3>⚡ Quick Accounting & Audit Portals</h3>
                </div>
                <div className="quick-links-grid">
                  <Link to="/plastic-erp/chart-of-accounts" className="quick-btn">
                    <span className="icon">📑</span>
                    <div>
                      <strong>Chart of Accounts</strong>
                      <p>View 5-tier financial ledger hierarchy</p>
                    </div>
                  </Link>

                  <Link to="/plastic-erp/journal-entries" className="quick-btn">
                    <span className="icon">✍️</span>
                    <div>
                      <strong>Journal Entries</strong>
                      <p>Record manual double-entry vouchers</p>
                    </div>
                  </Link>

                  <Link to="/plastic-erp/cash-bank" className="quick-btn">
                    <span className="icon">💵</span>
                    <div>
                      <strong>Cash & Bank Ledgers</strong>
                      <p>Vault balance, bank contra & deposits</p>
                    </div>
                  </Link>

                  <Link to="/plastic-erp/bank-reconciliation" className="quick-btn">
                    <span className="icon">🏛️</span>
                    <div>
                      <strong>Bank Reconciliation</strong>
                      <p>Match book statements with bank slips</p>
                    </div>
                  </Link>

                  <Link to="/plastic-erp/gst-management" className="quick-btn">
                    <span className="icon">⚖️</span>
                    <div>
                      <strong>GSTR-1 & 3B Preparation</strong>
                      <p>Statutory return tables & ITC register</p>
                    </div>
                  </Link>

                  <Link to="/plastic-erp/gst-reconciliation" className="quick-btn">
                    <span className="icon">🔍</span>
                    <div>
                      <strong>GSTR-2B Reconciliation</strong>
                      <p>Verify supplier portal filings vs books</p>
                    </div>
                  </Link>

                  <Link to="/plastic-erp/financial-reports" className="quick-btn">
                    <span className="icon">📊</span>
                    <div>
                      <strong>14 Financial Reports</strong>
                      <p>Trial Balance, P&L, Balance Sheet, Aging</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PlasticAccountingDashboard;
