import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticWorkforce.css";

function PlasticWorkforce() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("OPERATORS"); // 'OPERATORS' or 'LABOUR_COST'

  // Overview data
  const [operators, setOperators] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [unlinkedEmployees, setUnlinkedEmployees] = useState([]);
  const [shiftAttendance, setShiftAttendance] = useState([]);

  // Labour cost calculator state
  const [labourFrom, setLabourFrom] = useState(() =>
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [labourTo, setLabourTo] = useState(new Date().toISOString().slice(0, 10));
  const [labourShift, setLabourShift] = useState("ALL");
  const [labourData, setLabourData] = useState({ summary: {}, records: [] });
  const [calculating, setCalculating] = useState(false);

  // Mapping Modal
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/plastic-erp/workforce/overview");
      if (res.data?.success) {
        setOperators(res.data.operators || []);
        setShifts(res.data.shifts || []);
        setUnlinkedEmployees(res.data.unlinkedEmployees || []);
        setShiftAttendance(res.data.shiftAttendance || []);
      }
    } catch (err) {
      console.error("Failed to load workforce overview:", err);
      alert("Failed to load workforce data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLabourCost = useCallback(async () => {
    try {
      setCalculating(true);
      const res = await API.get("/plastic-erp/workforce/shift-labour-cost", {
        params: {
          from_date: labourFrom,
          to_date: labourTo,
          shift_id: labourShift !== "ALL" ? labourShift : undefined,
        },
      });
      if (res.data?.success) {
        setLabourData({
          summary: res.data.summary || {},
          records: res.data.records || [],
        });
      }
    } catch (err) {
      console.error("Failed to calculate shift labour cost:", err);
    } finally {
      setCalculating(false);
    }
  }, [labourFrom, labourTo, labourShift]);

  const loadWorkforceData = useCallback(() => {
    if (activeTab === "OPERATORS") {
      fetchOverview();
    } else {
      fetchLabourCost();
    }
  }, [activeTab, fetchOverview, fetchLabourCost]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWorkforceData();
  }, [loadWorkforceData]);



  const handleOpenMapModal = (op) => {
    setSelectedOperator(op);
    setSelectedEmployeeId(op.employee_id ? String(op.employee_id) : "");
    setMappingModalOpen(true);
  };

  const handleSaveMapping = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await API.post("/plastic-erp/workforce/map-operator", {
        operator_id: selectedOperator.id,
        employee_id: selectedEmployeeId ? Number(selectedEmployeeId) : null,
      });
      alert("Operator employee mapping updated successfully");
      setMappingModalOpen(false);
      fetchOverview();
    } catch (err) {
      console.error("Failed to map operator:", err);
      alert(err.response?.data?.message || "Failed to update mapping");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalOperators = operators.length;
  const mappedOperators = operators.filter((o) => o.employee_id).length;
  const unmappedOperators = totalOperators - mappedOperators;
  const todayShiftWorkers = shiftAttendance.reduce((s, a) => s + Number(a.present_count || 0), 0);

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <main className="plastic-container">
        {/* Header */}
        <div className="plastic-header-row">
          <div>
            <span className="plastic-breadcrumb">Plastic ERP / HR & Payroll</span>
            <h1 className="plastic-title">🏭 Plant Workforce & Labour Costing</h1>
            <p className="plastic-subtitle">
              Map production machine operators to official payroll records and calculate real-time shift labour expenditures.
            </p>
          </div>
          <div className="tab-pills">
            <button
              type="button"
              className={`pill-btn ${activeTab === "OPERATORS" ? "active" : ""}`}
              onClick={() => setActiveTab("OPERATORS")}
            >
              👥 Operators & Machine Crew
            </button>
            <button
              type="button"
              className={`pill-btn ${activeTab === "LABOUR_COST" ? "active" : ""}`}
              onClick={() => setActiveTab("LABOUR_COST")}
            >
              💰 Shift Labour Costing
            </button>
          </div>
        </div>

        {/* Tab 1: Operators & Crew */}
        {activeTab === "OPERATORS" && (
          <>
            {/* KPI Cards */}
            <div className="plastic-kpi-grid">
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon">⚙️</span>
                <div>
                  <span className="plastic-kpi-label">Plant Operators</span>
                  <h3 className="plastic-kpi-val">{totalOperators}</h3>
                  <small className="plastic-kpi-sub">Total machinery operators</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>🔗</span>
                <div>
                  <span className="plastic-kpi-label">HR Mapped</span>
                  <h3 className="plastic-kpi-val">{mappedOperators}</h3>
                  <small className="plastic-kpi-sub">Linked to payroll records</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#fef3c7", color: "#b45309" }}>⚠️</span>
                <div>
                  <span className="plastic-kpi-label">Unlinked</span>
                  <h3 className="plastic-kpi-val">{unmappedOperators}</h3>
                  <small className="plastic-kpi-sub">Needs employee profile link</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>🕒</span>
                <div>
                  <span className="plastic-kpi-label">Today on Shifts</span>
                  <h3 className="plastic-kpi-val">{todayShiftWorkers}</h3>
                  <small className="plastic-kpi-sub">Active in running shifts</small>
                </div>
              </div>
            </div>

            {/* Today's Shift Roster Snapshot */}
            <div className="shift-snapshot-card">
              <h4 style={{ margin: "0 0 12px 0", fontSize: "1rem", color: "#0f172a" }}>
                🕒 Today&apos;s Plant Shift Attendance Snapshot
              </h4>
              <div className="shift-grid">
                {shiftAttendance.map((s) => (
                  <div key={s.shift_id} className="shift-stat-box">
                    <span className="shift-name">{s.shift_name}</span>
                    <div className="shift-numbers">
                      <span className="shift-present">{s.present_count} Present</span>
                      <span className="shift-ot">⚡ {s.overtime_hours} hrs OT</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Operators Table */}
            {loading ? (
              <LoadingScreen />
            ) : (
              <div className="plastic-table-container">
                <table className="plastic-table">
                  <thead>
                    <tr>
                      <th>Operator Name</th>
                      <th>Mobile</th>
                      <th>Specialization / Role</th>
                      <th>Mapped Employee Master</th>
                      <th>Salary Structure</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operators.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "2.5rem" }}>
                          No machine operators configured yet.
                        </td>
                      </tr>
                    ) : (
                      operators.map((op) => (
                        <tr key={op.id}>
                          <td><strong>{op.name}</strong></td>
                          <td>📞 {op.mobile || "N/A"}</td>
                          <td>
                            <span className="plastic-chip">{op.specialization || "General Operator"}</span>
                          </td>
                          <td>
                            {op.employee_id ? (
                              <div>
                                <span className="plastic-code-badge">{op.employee_code}</span>
                                <span style={{ marginLeft: "8px", fontWeight: "600" }}>{op.employee_name}</span>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                  {op.department} • {op.designation}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "#d97706", fontSize: "0.85rem", fontWeight: "600" }}>
                                ⚠️ Not Linked to HR Master
                              </span>
                            )}
                          </td>
                          <td>
                            {op.employee_id ? (
                              <div>
                                <strong>₹{Number(op.base_salary || 0).toLocaleString("en-IN")}</strong>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}> / {op.salary_type || "MONTHLY"}</span>
                              </div>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>-</span>
                            )}
                          </td>
                          <td>
                            <span className={`plastic-status-tag tag-${(op.status || "ACTIVE").toLowerCase()}`}>
                              {op.status || "ACTIVE"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="plastic-btn plastic-btn-secondary"
                              style={{ padding: "5px 12px", fontSize: "0.8rem" }}
                              onClick={() => handleOpenMapModal(op)}
                            >
                              {op.employee_id ? "Change Link" : "🔗 Map to HR"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Tab 2: Shift Labour Cost Calculator */}
        {activeTab === "LABOUR_COST" && (
          <div className="labour-cost-view">
            {/* Filter Bar */}
            <div className="plastic-filter-card">
              <div className="attendance-controls-row">
                <div className="filter-group">
                  <label htmlFor="cost-from">From Date</label>
                  <input
                    id="cost-from"
                    type="date"
                    className="plastic-input"
                    value={labourFrom}
                    onChange={(e) => setLabourFrom(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="cost-to">To Date</label>
                  <input
                    id="cost-to"
                    type="date"
                    className="plastic-input"
                    value={labourTo}
                    onChange={(e) => setLabourTo(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="cost-shift">Shift</label>
                  <select
                    id="cost-shift"
                    className="plastic-select"
                    value={labourShift}
                    onChange={(e) => setLabourShift(e.target.value)}
                  >
                    <option value="ALL">All Shifts</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.shift_name}</option>
                    ))}
                  </select>
                </div>
                <div className="attendance-actions-right">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-primary"
                    onClick={fetchLabourCost}
                    disabled={calculating}
                  >
                    {calculating ? "Calculating..." : "⚡ Calculate Labour Cost"}
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="plastic-kpi-grid">
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#ecfdf5", color: "#059669" }}>💰</span>
                <div>
                  <span className="plastic-kpi-label">Estimated Labour Cost</span>
                  <h3 className="plastic-kpi-val">₹{Number(labourData.summary?.totalLabourCost || 0).toLocaleString("en-IN")}</h3>
                  <small className="plastic-kpi-sub">Total wage cost for selected period</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>⏱️</span>
                <div>
                  <span className="plastic-kpi-label">Total Worker Hours</span>
                  <h3 className="plastic-kpi-val">{labourData.summary?.totalHours || 0} hrs</h3>
                  <small className="plastic-kpi-sub">Regular + Overtime hours</small>
                </div>
              </div>
              <div className="plastic-kpi-card">
                <span className="plastic-kpi-icon">📋</span>
                <div>
                  <span className="plastic-kpi-label">Shift Records</span>
                  <h3 className="plastic-kpi-val">{labourData.summary?.recordsCount || 0}</h3>
                  <small className="plastic-kpi-sub">Shift log days counted</small>
                </div>
              </div>
            </div>

            {/* Shift Breakdown Table */}
            {calculating ? (
              <LoadingScreen />
            ) : (
              <div className="plastic-table-container">
                <table className="plastic-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Shift</th>
                      <th>Workers Present</th>
                      <th>Regular Hours</th>
                      <th>Overtime Hours</th>
                      <th style={{ textAlign: "right" }}>Estimated Labour Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labourData.records.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: "center", padding: "2.5rem" }}>
                          No shift attendance data found for the selected period.
                        </td>
                      </tr>
                    ) : (
                      labourData.records.map((r, i) => (
                        <tr key={i}>
                          <td><strong>{new Date(r.attendance_date).toLocaleDateString("en-IN")}</strong></td>
                          <td><span className="plastic-chip">{r.shift_name}</span></td>
                          <td>{r.workers_present} workers</td>
                          <td>{r.total_regular_hours} hrs</td>
                          <td style={{ color: "#2563eb" }}>⚡ {r.total_overtime_hours} hrs</td>
                          <td style={{ textAlign: "right" }}>
                            <strong style={{ color: "#047857", fontSize: "1.05rem" }}>
                              ₹{Math.round(Number(r.estimated_labour_cost || 0)).toLocaleString("en-IN")}
                            </strong>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: Map Operator to Employee */}
        {mappingModalOpen && selectedOperator && (
          <div className="plastic-modal-backdrop" onClick={() => !submitting && setMappingModalOpen(false)}>
            <div className="plastic-modal" style={{ maxWidth: "550px" }} onClick={(e) => e.stopPropagation()}>
              <div className="plastic-modal-header">
                <h3>🔗 Link Operator to Employee Profile</h3>
                <button type="button" className="btn-close" onClick={() => setMappingModalOpen(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveMapping}>
                <div className="plastic-modal-body">
                  <div className="operator-profile-peek">
                    <h4 style={{ margin: "0 0 4px 0" }}>Operator: {selectedOperator.name}</h4>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      Role: {selectedOperator.specialization || "Plant Operator"} • Mobile: {selectedOperator.mobile || "N/A"}
                    </p>
                  </div>

                  <div className="form-field" style={{ marginTop: "16px" }}>
                    <label>Select Official Employee Master *</label>
                    <select
                      className="plastic-select"
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    >
                      <option value="">-- No Employee Link (Unlink) --</option>
                      {unlinkedEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.employee_code} - {emp.designation})
                        </option>
                      ))}
                    </select>
                    <small style={{ color: "var(--text-muted)", marginTop: "4px" }}>
                      Linking syncs operator contact details and ties shift production batches directly to payroll salary calculation.
                    </small>
                  </div>
                </div>

                <div className="plastic-modal-footer">
                  <button
                    type="button"
                    className="plastic-btn plastic-btn-ghost"
                    onClick={() => setMappingModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="plastic-btn plastic-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : "Save Link"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default PlasticWorkforce;
