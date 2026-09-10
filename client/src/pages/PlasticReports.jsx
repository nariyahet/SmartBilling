import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  KpiCard,
  Card,
  Tabs,
  DataTable,
  Button,
  StatusBadge,
  AlertBanner,
} from "../components";
import "./PlasticReports.css";

function PlasticReports() {
  const [activeTab, setActiveTab] = useState("reports");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateRange, setDateRange] = useState({
    from_date: "",
    to_date: "",
  });

  const [reports, setReports] = useState({
    production: {},
    materialConsumption: [],
    downtimeSummary: [],
    qcSummary: [],
  });

  const [alerts, setAlerts] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {};
      if (dateRange.from_date && dateRange.to_date) {
        params.from_date = dateRange.from_date;
        params.to_date = dateRange.to_date;
      }

      const [repRes, altRes] = await Promise.allSettled([
        API.get("/plastic-erp/reports/operational", { params }),
        API.get("/plastic-erp/reports/alerts"),
      ]);

      if (repRes.status === "fulfilled" && repRes.value.data?.reports) {
        setReports(repRes.value.data.reports);
      }
      if (altRes.status === "fulfilled" && altRes.value.data?.alerts) {
        setAlerts(altRes.value.data.alerts);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load reports and operational alerts.");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const handleResetFilter = () => {
    setDateRange({ from_date: "", to_date: "" });
  };

  const handlePrintReport = () => {
    window.print();
  };

  if (loading && !reports.production?.total_batches) {
    return <LoadingScreen message="Aggregating operational reports & plant alerts..." />;
  }

  const highAlertsCount = alerts.filter((a) => a.severity === "HIGH").length;

  const tabs = [
    { id: "reports", label: "📊 Operational Reports" },
    { id: "alerts", label: "🚨 Live Plant Alerts", count: alerts.length },
  ];

  return (
    <div className="sb-page-container">
      <div className="no-print">
        <PageHeader
          title="Operational Reports & Live Alerts"
          subtitle="Comprehensive analytics on daily production, material yields, equipment downtime, and critical plant alerts."
          breadcrumbs={[
            { label: "ERP", to: "/plastic-erp" },
            { label: "Production", to: "/plastic-erp/production" },
            { label: "Reports & Alerts" },
          ]}
          actions={
            <div style={{ display: "flex", gap: "10px" }}>
              <Link to="/plastic-erp">
                <Button variant="secondary">ERP Dashboard</Button>
              </Link>
              <Button variant="primary" onClick={handlePrintReport}>
                🖨️ Print / Export PDF
              </Button>
            </div>
          }
        />
      </div>

      {/* Error Alert */}
      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}

      {/* Critical Alerts Banner if high alerts exist */}
      {highAlertsCount > 0 && (
        <div
          className="critical-banner no-print"
          onClick={() => setActiveTab("alerts")}
          style={{ marginBottom: "20px" }}
        >
          <div className="banner-icon">⚠️</div>
          <div className="banner-content">
            <strong>{highAlertsCount} High Priority Plant Alert(s) Detected!</strong>
            <span> Requires attention: low stocks, overdue maintenance, or high scrap variance. Click to inspect.</span>
          </div>
          <Button variant="danger" size="sm">View Alerts →</Button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="no-print">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* TAB 1: OPERATIONAL REPORTS */}
      {activeTab === "reports" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Filter Bar */}
          <Card className="no-print">
            <form onSubmit={handleFilterSubmit} style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">From Date</label>
                <input
                  type="date"
                  className="sb-input"
                  value={dateRange.from_date}
                  onChange={(e) => setDateRange({ ...dateRange, from_date: e.target.value })}
                />
              </div>
              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">To Date</label>
                <input
                  type="date"
                  className="sb-input"
                  value={dateRange.to_date}
                  onChange={(e) => setDateRange({ ...dateRange, to_date: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button type="submit" variant="primary">
                  Filter Period
                </Button>
                {(dateRange.from_date || dateRange.to_date) && (
                  <Button type="button" variant="secondary" onClick={handleResetFilter}>
                    Clear
                  </Button>
                )}
              </div>
            </form>
          </Card>

          {/* 1. Production Summary KPI Cards */}
          <div className="sb-kpis-grid">
            <KpiCard
              label="Total Batches Executed"
              value={reports.production?.total_batches || 0}
              subtext="Planned & executed"
              accent="navy"
            />
            <KpiCard
              label="Actual Plant Output"
              value={`${Number(reports.production?.total_actual_kg || 0).toLocaleString("en-IN")} KG`}
              subtext={`${(Number(reports.production?.total_actual_kg || 0) / 1000).toFixed(2)} Metric Tons`}
              accent="teal"
            />
            <KpiCard
              label="Total Scrap Generated"
              value={`${Number(reports.production?.total_scrap_kg || 0).toLocaleString("en-IN")} KG`}
              subtext="Plant floor waste"
              accent="danger"
            />
            <KpiCard
              label="Average Efficiency"
              value={`${Number(reports.production?.avg_efficiency_percent || 0).toFixed(1)}%`}
              subtext="Target: > 90%"
              accent="blue"
            />
          </div>

          {/* 2-Column: Material Consumption & Machine Downtime */}
          <div className="rep-grid-2">
            {/* Material Consumption Report */}
            <Card noPadding>
              <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--sb-border)" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--sb-navy)" }}>
                  📦 Raw Material Consumption & Yield
                </h3>
                <span className="rep-badge-tag">Stock Outflow</span>
              </div>
              {reports.materialConsumption?.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--sb-muted)" }}>
                  No material consumption recorded in this period.
                </div>
              ) : (
                <DataTable
                  headers={["Material Name", "Total Consumed", "Total Cost"]}
                >
                  {reports.materialConsumption.map((m, idx) => (
                    <tr key={idx}>
                      <td><strong>{m.material_name}</strong></td>
                      <td>{Number(m.total_consumed).toLocaleString("en-IN")} {m.unit}</td>
                      <td>₹{Number(m.total_cost).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </Card>

            {/* Machine Downtime Analysis */}
            <Card noPadding>
              <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--sb-border)" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--sb-navy)" }}>
                  ⚙️ Machine Downtime & Reliability
                </h3>
                <span className="rep-badge-tag tag-orange">OEE Analysis</span>
              </div>
              {reports.downtimeSummary?.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--sb-muted)" }}>
                  Zero downtime recorded for plant machines.
                </div>
              ) : (
                <DataTable
                  headers={["Machine", "Incidents", "Total Downtime", "Status"]}
                >
                  {reports.downtimeSummary.map((d, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{d.machine_name}</strong>
                        <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}><code>{d.machine_code}</code></div>
                      </td>
                      <td>{d.incident_count} events</td>
                      <td>
                        <strong>{d.total_downtime_minutes} mins</strong>
                        <span style={{ fontSize: "11px", color: "var(--sb-muted)" }}> ({(d.total_downtime_minutes / 60).toFixed(1)} hrs)</span>
                      </td>
                      <td>
                        <StatusBadge status={d.total_downtime_minutes > 120 ? "REJECTED" : "COMPLETED"} />
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </Card>
          </div>

          {/* Quality Summary */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--sb-border)" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--sb-navy)" }}>
                🔬 Quality Control Results Summary
              </h3>
              <span className="rep-badge-tag tag-teal">Compliance</span>
            </div>
            {reports.qcSummary?.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--sb-muted)" }}>
                No QC inspections logged yet.
              </div>
            ) : (
              <div className="qc-summary-grid">
                {reports.qcSummary.map((qc, idx) => (
                  <div key={idx} className="qc-kpi-box">
                    <span className="qc-status-name">{qc.overall_status}</span>
                    <span className="qc-status-count">{qc.count}</span>
                    <span className="qc-status-label">Inspections</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: OPERATIONAL ALERTS CENTER */}
      {activeTab === "alerts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ marginBottom: "8px" }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: 700, color: "var(--sb-navy)" }}>
              Real-Time Operational Alerts ({alerts.length})
            </h3>
            <p style={{ margin: 0, fontSize: "13.5px", color: "var(--sb-muted)" }}>
              Automated triggers for low stock thresholds, overdue machine maintenance, and high scrap batches.
            </p>
          </div>

          {alerts.length === 0 ? (
            <Card style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>✅</div>
              <h4 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: 700, color: "var(--sb-navy)" }}>
                All Systems Operational
              </h4>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--sb-muted)" }}>
                No active alerts detected. Stocks, machines, and batch scrap rates are within healthy limits.
              </p>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {alerts.map((al, idx) => (
                <div
                  key={idx}
                  className={`sb-alert-card severity-${al.severity?.toLowerCase()}`}
                >
                  <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <div style={{ fontSize: "24px" }}>
                      {al.severity === "HIGH" ? "🚨" : al.severity === "MEDIUM" ? "⚠️" : "ℹ️"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px", flexWrap: "wrap" }}>
                        <span className="alert-type-tag">{al.type}</span>
                        <StatusBadge status={al.severity === "HIGH" ? "REJECTED" : al.severity === "MEDIUM" ? "HOLD" : "PENDING"} />
                        <span style={{ fontSize: "11.5px", color: "var(--sb-muted)", marginLeft: "auto" }}>
                          {new Date(al.date).toLocaleString()}
                        </span>
                      </div>
                      <h4 style={{ margin: "4px 0", fontSize: "15px", fontWeight: 700, color: "var(--sb-navy)" }}>
                        {al.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--sb-text)", lineHeight: 1.5 }}>
                        {al.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlasticReports;
