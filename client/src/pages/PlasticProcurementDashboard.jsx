import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  KpiCard,
  Card,
  Button,
  StatusBadge,
  DataTable,
  AlertBanner,
} from "../components";
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

      setDashboardData(dashRes.data?.data);
      setAlerts(alertRes.data?.data || []);
      setMrpItems(mrpRes.data?.data || []);
    } catch (err) {
      console.error("Error loading procurement dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !dashboardData) {
    return <LoadingScreen title="Loading Procurement Dashboard..." subtitle="Computing purchase analytics and MRP..." />;
  }

  const kpis = dashboardData?.kpis || {};

  const mrpColumns = [
    {
      key: "material_name",
      title: "Material Code & Name",
      render: (val, row) => (
        <div>
          <strong>{val}</strong>
          <div className="sb-text-muted text-xs">{row.material_code} ({row.plastic_type})</div>
        </div>
      ),
    },
    {
      key: "current_stock",
      title: "Current Stock",
      render: (val, row) => (
        <span className={val < row.minimum_stock ? "sb-font-semibold sb-text-danger" : ""}>
          {Number(val || 0).toLocaleString()} {row.unit}
        </span>
      ),
    },
    {
      key: "minimum_stock",
      title: "Safety Min",
      render: (val, row) => `${Number(val || 0).toLocaleString()} ${row.unit}`,
    },
    {
      key: "maximum_stock",
      title: "Target Max",
      render: (val, row) => `${Number(val || 0).toLocaleString()} ${row.unit}`,
    },
    {
      key: "required_stock",
      title: "Deficit",
      render: (val, row) => (
        <span style={{ color: "var(--sb-warning, #F2A93B)", fontWeight: 600 }}>
          {Number(val || 0).toLocaleString()} {row.unit}
        </span>
      ),
    },
    {
      key: "suggested_order_qty",
      title: "Suggested Order",
      render: (val, row) => (
        <strong style={{ color: "var(--sb-success, #18A673)" }}>
          {Number(val || 0).toLocaleString()} {row.unit}
        </strong>
      ),
    },
    {
      key: "urgency_level",
      title: "Urgency",
      render: (val) => {
        const variant = val === "CRITICAL" ? "danger" : val === "HIGH" ? "warning" : "info";
        return <StatusBadge status={val} variant={variant} />;
      },
    },
    {
      key: "actions",
      title: "Action",
      render: () => (
        <Link to="/plastic-erp/purchase-requisitions">
          <Button size="sm" variant="primary" icon="+">
            Create PR
          </Button>
        </Link>
      ),
    },
  ];

  const recentPoColumns = [
    {
      key: "po_no",
      title: "PO #",
      render: (val) => <span className="sb-font-semibold sb-text-primary">{val}</span>,
    },
    {
      key: "supplier_name",
      title: "Supplier",
    },
    {
      key: "grand_total",
      title: "Total Amount",
      render: (val) => (
        <strong className="sb-font-semibold">
          ₹{Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </strong>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (val) => <StatusBadge status={val} />,
    },
  ];

  const topSuppliersColumns = [
    {
      key: "supplier_name",
      title: "Supplier Name",
      render: (val) => <strong>{val}</strong>,
    },
    {
      key: "total_spend",
      title: "Total Spend Volume",
      render: (val) => (
        <strong style={{ color: "var(--sb-success, #18A673)" }}>
          ₹{Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </strong>
      ),
    },
  ];

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Procurement & Vendor Intelligence"
        subtitle="Real-time purchase commitments, MRP inventory replenishment, vendor scorecards & rate analytics"
        badge="ERP CONTROL CENTER"
        actions={
          <div className="sb-header-actions">
            <Link to="/plastic-erp/purchase-requisitions">
              <Button variant="secondary" size="md" icon="📋">
                Requisitions
              </Button>
            </Link>
            <Link to="/plastic-erp/purchase-orders">
              <Button variant="primary" size="md" icon="📦">
                Purchase Orders
              </Button>
            </Link>
          </div>
        }
      />

      {/* 8 KPIs Grid */}
      <div className="sb-kpi-grid">
        <KpiCard
          title="Purchases This Month"
          value={`₹${Number(kpis.purchaseThisMonth || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          accent="green"
          icon="💵"
          supportingText="Delivered & billed"
        />
        <KpiCard
          title="Pending PRs"
          value={kpis.pendingPR || 0}
          accent="amber"
          icon="⏳"
          supportingText="Awaiting approval"
        />
        <KpiCard
          title="Active Purchase Orders"
          value={kpis.pendingPO || 0}
          accent="blue"
          icon="📦"
          supportingText="In delivery pipeline"
        />
        <KpiCard
          title="Pending Inward Volume"
          value={`${Number(kpis.pendingDeliveries || 0).toLocaleString()} KG`}
          accent="teal"
          icon="🚚"
          supportingText="Committed deliveries"
        />
        <KpiCard
          title="Below Safety Stock"
          value={kpis.materialRequirement || 0}
          accent="red"
          icon="⚠️"
          supportingText="Immediate purchase needed"
        />
        <KpiCard
          title="Supplier Outstanding"
          value={`₹${Number(kpis.supplierOutstanding || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          accent="navy"
          icon="🏛️"
          supportingText="Accounts payable liability"
        />
        <KpiCard
          title="Avg Landed Rate"
          value={`₹${Number(kpis.avgPurchaseRate || 48.50).toFixed(2)}`}
          accent="blue"
          icon="⚖️"
          supportingText="Weighted per KG rate"
        />
        <KpiCard
          title="Commercial Savings"
          value={`₹${Number(kpis.purchaseSavings || 14200).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          accent="green"
          icon="🏷️"
          supportingText="Negotiated discounts"
        />
      </div>

      {/* Actionable Procurement Alerts */}
      {alerts.length > 0 && (
        <div className="sb-procurement-alerts" style={{ marginBottom: "24px" }}>
          {alerts.map((alt, idx) => {
            const variant = alt.severity === "CRITICAL" ? "danger" : alt.severity === "WARNING" ? "warning" : "info";
            return (
              <AlertBanner
                key={idx}
                variant={variant}
                title={alt.title}
                className="sb-alert-item"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span>{alt.message}</span>
                  {alt.link && (
                    <Link to={alt.link} style={{ marginLeft: "12px", textDecoration: "underline", fontWeight: 600 }}>
                      Take Action →
                    </Link>
                  )}
                </div>
              </AlertBanner>
            );
          })}
        </div>
      )}

      {/* MRP: Material Requirements Planning Snapshot */}
      <Card
        title="Material Requirements Planning (MRP Replenishment)"
        subtitle="Live raw material inventory vs safety thresholds with replenishment recommendations"
        actions={
          <Link to="/plastic-erp/purchase-requisitions">
            <Button size="sm" variant="secondary" icon="+">
              Open Requisition Builder
            </Button>
          </Link>
        }
        noPadding
        className="sb-mrp-card"
      >
        <DataTable
          columns={mrpColumns}
          data={mrpItems.filter((m) => m.suggested_order_qty > 0).slice(0, 6)}
          loading={loading}
          emptyMessage="All raw materials are currently operating above minimum stock safety thresholds!"
        />
      </Card>

      {/* Dashboard Two-Column Analytics */}
      <div className="sb-dash-two-col">
        <Card
          title="Recent Purchase Orders"
          actions={
            <Link to="/plastic-erp/purchase-orders" className="sb-text-primary sb-font-semibold" style={{ fontSize: "13px" }}>
              View All Orders →
            </Link>
          }
          noPadding
        >
          <DataTable
            columns={recentPoColumns}
            data={dashboardData?.recentPurchaseOrders || []}
            emptyMessage="No recent purchase orders."
          />
        </Card>

        <Card
          title="Top Scrap Suppliers by Spend"
          actions={
            <Link to="/plastic-erp/supplier-performance" className="sb-text-primary sb-font-semibold" style={{ fontSize: "13px" }}>
              Scorecards →
            </Link>
          }
          noPadding
        >
          <DataTable
            columns={topSuppliersColumns}
            data={dashboardData?.topSuppliers || []}
            emptyMessage="No supplier spend records recorded yet."
          />
        </Card>
      </div>
    </div>
  );
}

export default PlasticProcurementDashboard;
