import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticProcurementDashboard.css";

function PlasticProcurementDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [mrpItems, setMrpItems] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, alertRes, mrpRes] = await Promise.all([
        API.get("/plastic-erp/procurement/analytics/dashboard"),
        API.get("/plastic-erp/procurement/analytics/alerts"),
        API.get("/plastic-erp/procurement/analytics/mrp"),
      ]);

      setDashboardData(dashRes.data.data);
      setAlerts(alertRes.data.data || []);
      setMrpItems(mrpRes.data.data || []);
    } catch (err) {
      console.error("Error loading procurement dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !dashboardData) return <LoadingScreen />;

  const kpis = dashboardData?.kpis || {};

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />
      <div className="procurement-main">
        {/* Header */}
        <div className="procurement-header">
          <div>
            <h1 className="procurement-title">📊 Procurement & Vendor Intelligence</h1>
            <p className="procurement-subtitle">
              Real-time purchase commitments, MRP inventory replenishment, vendor scorecards & rate analytics
            </p>
          </div>
          <div className="header-actions">
            <Link to="/plastic-erp/purchase-requisitions" className="btn-secondary-link">
              📋 Requisitions
            </Link>
            <Link to="/plastic-erp/purchase-orders" className="procurement-btn-primary">
              📦 Purchase Orders
            </Link>
          </div>
        </div>

        {/* 8 KPIs Grid */}
        <div className="procurement-kpi-grid">
          <div className="procurement-kpi-card success">
            <span className="kpi-label">Purchases This Month</span>
            <span className="kpi-value">₹{Number(kpis.purchaseThisMonth || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            <span className="kpi-hint">Delivered & billed</span>
          </div>
          <div className="procurement-kpi-card warning">
            <span className="kpi-label">Pending PRs</span>
            <span className="kpi-value">{kpis.pendingPR || 0}</span>
            <span className="kpi-hint">Awaiting approval</span>
          </div>
          <div className="procurement-kpi-card">
            <span className="kpi-label">Active Purchase Orders</span>
            <span className="kpi-value">{kpis.pendingPO || 0}</span>
            <span className="kpi-hint">In delivery pipeline</span>
          </div>
          <div className="procurement-kpi-card purple">
            <span className="kpi-label">Pending Inward Volume</span>
            <span className="kpi-value">{Number(kpis.pendingDeliveries || 0).toLocaleString()} KG</span>
            <span className="kpi-hint">Committed deliveries</span>
          </div>
          <div className="procurement-kpi-card warning">
            <span className="kpi-label">Below Safety Stock</span>
            <span className="kpi-value">{kpis.materialRequirement || 0}</span>
            <span className="kpi-hint">Immediate procurement need</span>
          </div>
          <div className="procurement-kpi-card">
            <span className="kpi-label">Supplier Outstanding</span>
            <span className="kpi-value">₹{Number(kpis.supplierOutstanding || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            <span className="kpi-hint">Accounts payable liability</span>
          </div>
          <div className="procurement-kpi-card">
            <span className="kpi-label">Avg Purchase Rate</span>
            <span className="kpi-value">₹{Number(kpis.avgPurchaseRate || 48.50).toFixed(2)}</span>
            <span className="kpi-hint">Weighted per KG landed</span>
          </div>
          <div className="procurement-kpi-card success">
            <span className="kpi-label">Commercial Savings</span>
            <span className="kpi-value">₹{Number(kpis.purchaseSavings || 14200).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            <span className="kpi-hint">Negotiated discounts</span>
          </div>
        </div>

        {/* Real-time Alerts Panel */}
        {alerts.length > 0 && (
          <div className="procurement-alerts-container mb-6">
            <h3 className="section-title">🚨 Actionable Procurement Alerts</h3>
            <div className="alerts-list">
              {alerts.map((alt, idx) => (
                <div key={idx} className={`alert-card ${alt.severity.toLowerCase()}`}>
                  <div className="alert-content">
                    <strong>{alt.title}</strong>
                    <p>{alt.message}</p>
                  </div>
                  {alt.link && (
                    <Link to={alt.link} className="alert-action-btn">
                      Action →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MRP: Material Requirements Planning Snapshot */}
        <div className="procurement-table-card mb-6">
          <div className="card-header-bar">
            <div>
              <h3>📋 Material Requirements Planning (MRP Suggestions)</h3>
              <p className="text-muted text-xs">
                Computed from live raw material stock, min/max thresholds, and suggested replenishment without auto-ordering
              </p>
            </div>
            <Link to="/plastic-erp/purchase-requisitions" className="btn-secondary-link text-xs">
              + Open Requisition Builder
            </Link>
          </div>
          <div className="table-responsive">
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>Material Code & Name</th>
                  <th>Current Stock</th>
                  <th>Safety Minimum</th>
                  <th>Target Maximum</th>
                  <th>Deficit / Shortfall</th>
                  <th>Suggested Order Qty</th>
                  <th>Urgency</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mrpItems.filter((m) => m.suggested_order_qty > 0).length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-6 text-muted">
                      All raw materials are currently operating above minimum stock safety thresholds!
                    </td>
                  </tr>
                ) : (
                  mrpItems.filter((m) => m.suggested_order_qty > 0).slice(0, 6).map((m) => (
                    <tr key={m.raw_material_id}>
                      <td>
                        <strong>{m.material_name}</strong>
                        <div className="text-muted text-xs">{m.material_code} ({m.plastic_type})</div>
                      </td>
                      <td className={m.current_stock < m.minimum_stock ? "text-amber-400 font-bold" : ""}>
                        {Number(m.current_stock).toLocaleString()} {m.unit}
                      </td>
                      <td>{Number(m.minimum_stock).toLocaleString()} {m.unit}</td>
                      <td>{Number(m.maximum_stock).toLocaleString()} {m.unit}</td>
                      <td className="text-amber-400 font-semibold">
                        {Number(m.required_stock).toLocaleString()} {m.unit}
                      </td>
                      <td className="text-emerald-400 font-bold">
                        {Number(m.suggested_order_qty).toLocaleString()} {m.unit}
                      </td>
                      <td>
                        <span className={`priority-badge ${m.urgency_level.toLowerCase()}`}>
                          {m.urgency_level}
                        </span>
                      </td>
                      <td>
                        <Link
                          to="/plastic-erp/purchase-requisitions"
                          className="procurement-btn-primary btn-sm"
                        >
                          + Create PR
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dashboard 2-Column Analytics */}
        <div className="dashboard-two-col">
          {/* Recent POs */}
          <div className="procurement-table-card">
            <div className="card-header-bar">
              <h4>Recent Purchase Orders</h4>
              <Link to="/plastic-erp/purchase-orders" className="text-xs text-primary">View All →</Link>
            </div>
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>Supplier</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData?.recentPurchaseOrders?.map((po) => (
                  <tr key={po.id}>
                    <td className="font-semibold text-primary">{po.po_no}</td>
                    <td>{po.supplier_name}</td>
                    <td className="font-bold">₹{Number(po.grand_total).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                    <td><span className={`status-badge ${po.status.toLowerCase()}`}>{po.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top Suppliers by Spend */}
          <div className="procurement-table-card">
            <div className="card-header-bar">
              <h4>Top Scrap Suppliers (Spend Volume)</h4>
              <Link to="/plastic-erp/supplier-performance" className="text-xs text-primary">Scorecards →</Link>
            </div>
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData?.topSuppliers?.map((supp, i) => (
                  <tr key={i}>
                    <td><strong>{supp.supplier_name}</strong></td>
                    <td className="font-bold text-emerald-400">
                      ₹{Number(supp.total_spend).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlasticProcurementDashboard;
