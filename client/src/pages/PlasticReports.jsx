import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    return (
      <div className="plastic-rep-page">
        <PlasticNavbar />
        <LoadingScreen message="Aggregating operational reports & plant alerts..." />
      </div>
    );
  }

  const highAlertsCount = alerts.filter((a) => a.severity === "HIGH").length;

  return (
    <div className="plastic-rep-page">
      <PlasticNavbar />

      <main className="plastic-rep-container">
        {/* Header */}
        <div className="plastic-rep-header">
          <div>
            <span className="plastic-rep-badge">PLANT INTELLIGENCE & AUDIT</span>
            <h1 className="plastic-rep-title">Operational Reports & Live Alerts</h1>
            <p className="plastic-rep-subtitle">
              Comprehensive analytics on daily production, material yields, equipment downtime, and critical plant alerts.
            </p>
          </div>
          <div className="plastic-rep-header-actions no-print">
            <Link to="/plastic-erp" className="btn-secondary-link">
              ← ERP Dashboard
            </Link>
            <button className="btn-print-rep" onClick={handlePrintReport}>
              🖨️ Print / Export PDF
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rep-alert rep-alert-danger no-print">
            <span>{error}</span>
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {/* Critical Alerts Banner if high alerts exist */}
        {highAlertsCount > 0 && (
          <div
            className="critical-banner no-print"
            onClick={() => setActiveTab("alerts")}
          >
            <div className="banner-icon">⚠️</div>
            <div className="banner-content">
              <strong>{highAlertsCount} High Priority Plant Alert(s) Detected!</strong>
              <span> Requires attention: low stocks, overdue maintenance, or high scrap variance. Click to inspect.</span>
            </div>
            <button className="btn-banner-action">View Alerts →</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="plastic-rep-tabs no-print">
          <button
            className={`rep-tab-btn ${activeTab === "reports" ? "active" : ""}`}
            onClick={() => setActiveTab("reports")}
          >
            📊 Operational Reports
          </button>
          <button
            className={`rep-tab-btn ${activeTab === "alerts" ? "active" : ""}`}
            onClick={() => setActiveTab("alerts")}
          >
            🚨 Live Plant Alerts ({alerts.length})
          </button>
        </div>

        {/* TAB 1: OPERATIONAL REPORTS */}
        {activeTab === "reports" && (
          <div className="rep-reports-section">
            {/* Filter Bar */}
            <div className="rep-filter-bar no-print">
              <form onSubmit={handleFilterSubmit} className="filter-form">
                <div className="filter-group">
                  <label>From Date</label>
                  <input
                    type="date"
                    value={dateRange.from_date}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, from_date: e.target.value })
                    }
                  />
                </div>
                <div className="filter-group">
                  <label>To Date</label>
                  <input
                    type="date"
                    value={dateRange.to_date}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, to_date: e.target.value })
                    }
                  />
                </div>
                <div className="filter-actions">
                  <button type="submit" className="btn-filter-apply">
                    Filter Period
                  </button>
                  {(dateRange.from_date || dateRange.to_date) && (
                    <button
                      type="button"
                      className="btn-filter-reset"
                      onClick={handleResetFilter}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* 1. Production Summary KPI Cards */}
            <div className="rep-kpi-grid">
              <div className="rep-kpi-card">
                <span className="rep-kpi-label">Total Batches Executed</span>
                <span className="rep-kpi-val">{reports.production?.total_batches || 0}</span>
                <span className="rep-kpi-sub">Planned & executed</span>
              </div>
              <div className="rep-kpi-card">
                <span className="rep-kpi-label">Actual Plant Output</span>
                <span className="rep-kpi-val text-green">
                  {Number(reports.production?.total_actual_kg || 0).toLocaleString("en-IN")} KG
                </span>
                <span className="rep-kpi-sub">
                  {(Number(reports.production?.total_actual_kg || 0) / 1000).toFixed(2)} Metric Tons
                </span>
              </div>
              <div className="rep-kpi-card">
                <span className="rep-kpi-label">Total Scrap Generated</span>
                <span className="rep-kpi-val text-red">
                  {Number(reports.production?.total_scrap_kg || 0).toLocaleString("en-IN")} KG
                </span>
                <span className="rep-kpi-sub">Plant floor waste</span>
              </div>
              <div className="rep-kpi-card">
                <span className="rep-kpi-label">Average Efficiency</span>
                <span className="rep-kpi-val text-blue">
                  {Number(reports.production?.avg_efficiency_percent || 0).toFixed(1)}%
                </span>
                <span className="rep-kpi-sub">Target: &gt; 90%</span>
              </div>
            </div>

            {/* 2-Column: Material Consumption & Machine Downtime */}
            <div className="rep-grid-2">
              {/* Material Consumption Report */}
              <div className="rep-card">
                <div className="rep-card-header">
                  <h3>📦 Raw Material Consumption & Yield</h3>
                  <span className="rep-badge-tag">Stock Outflow</span>
                </div>
                {reports.materialConsumption?.length === 0 ? (
                  <p className="empty-text">No material consumption recorded in this period.</p>
                ) : (
                  <div className="rep-table-wrap">
                    <table className="rep-table">
                      <thead>
                        <tr>
                          <th>Material Name</th>
                          <th>Total Consumed</th>
                          <th>Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.materialConsumption.map((m, idx) => (
                          <tr key={idx}>
                            <td><strong>{m.material_name}</strong></td>
                            <td>{Number(m.total_consumed).toLocaleString("en-IN")} {m.unit}</td>
                            <td>₹{Number(m.total_cost).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Machine Downtime Analysis */}
              <div className="rep-card">
                <div className="rep-card-header">
                  <h3>⚙️ Machine Downtime & Reliability</h3>
                  <span className="rep-badge-tag tag-orange">OEE Analysis</span>
                </div>
                {reports.downtimeSummary?.length === 0 ? (
                  <p className="empty-text">Zero downtime recorded for plant machines.</p>
                ) : (
                  <div className="rep-table-wrap">
                    <table className="rep-table">
                      <thead>
                        <tr>
                          <th>Machine</th>
                          <th>Incidents</th>
                          <th>Total Downtime</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.downtimeSummary.map((d, idx) => (
                          <tr key={idx}>
                            <td>
                              <strong>{d.machine_name}</strong>
                              <div className="meta-sub"><code>{d.machine_code}</code></div>
                            </td>
                            <td>{d.incident_count} events</td>
                            <td>
                              <strong>{d.total_downtime_minutes} mins</strong>
                              <span className="meta-sub"> ({(d.total_downtime_minutes / 60).toFixed(1)} hrs)</span>
                            </td>
                            <td>
                              <span
                                className={`badge-pill ${
                                  d.total_downtime_minutes > 120 ? "status-danger" : "status-completed"
                                }`}
                              >
                                {d.total_downtime_minutes > 120 ? "HIGH DOWNTIME" : "NORMAL"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Quality Summary */}
            <div className="rep-card mt-4">
              <div className="rep-card-header">
                <h3>🔬 Quality Control Results Summary</h3>
                <span className="rep-badge-tag tag-purple">Compliance</span>
              </div>
              {reports.qcSummary?.length === 0 ? (
                <p className="empty-text">No QC inspections logged yet.</p>
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
            </div>
          </div>
        )}

        {/* TAB 2: OPERATIONAL ALERTS CENTER */}
        {activeTab === "alerts" && (
          <div className="rep-alerts-section">
            <div className="alerts-top-info">
              <h3>Real-Time Operational Alerts ({alerts.length})</h3>
              <p>Automated triggers for low stock thresholds, overdue machine maintenance, and high scrap batches.</p>
            </div>

            {alerts.length === 0 ? (
              <div className="alerts-empty-card">
                <div className="empty-icon">✅</div>
                <h4>All Systems Operational</h4>
                <p>No active alerts detected. Stocks, machines, and batch scrap rates are within healthy limits.</p>
              </div>
            ) : (
              <div className="alerts-list">
                {alerts.map((al, idx) => (
                  <div
                    key={idx}
                    className={`alert-card alert-severity-${al.severity?.toLowerCase()}`}
                  >
                    <div className="alert-card-left">
                      <div className="alert-badge-icon">
                        {al.severity === "HIGH" ? "🚨" : al.severity === "MEDIUM" ? "⚠️" : "ℹ️"}
                      </div>
                      <div className="alert-card-text">
                        <div className="alert-header-row">
                          <span className="alert-type-tag">{al.type}</span>
                          <span className={`alert-severity-badge severity-${al.severity?.toLowerCase()}`}>
                            {al.severity} PRIORITY
                          </span>
                          <span className="alert-time-tag">{new Date(al.date).toLocaleString()}</span>
                        </div>
                        <h4 className="alert-title">{al.title}</h4>
                        <p className="alert-msg">{al.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default PlasticReports;
