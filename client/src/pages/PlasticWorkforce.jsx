import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Modal, Button, StatusBadge } from "../components";
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
      <div className="plastic-container sb-page-container">
        {/* Header */}
        <PageHeader
          title="Plant Workforce & Labour Costing"
          subtitle="Map production machine operators to official payroll records and calculate real-time shift labour expenditures."
          badge="HR & PRODUCTION WORKFORCE"
          actions={
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
          }
        />

        {/* Tab 1: Operators & Crew */}
        {activeTab === "OPERATORS" && (
          <>
            {/* KPI Cards */}
            <div className="pwork-kpis">
              <KpiCard
                title="Plant Operators"
                value={totalOperators}
                subtitle="Total machinery operators"
                variant="default"
              />
              <KpiCard
                title="HR Mapped"
                value={mappedOperators}
                subtitle="Linked to payroll records"
                variant="success"
              />
              <KpiCard
                title="Unlinked"
                value={unmappedOperators}
                subtitle="Needs employee profile link"
                variant="warning"
              />
              <KpiCard
                title="Today on Shifts"
                value={todayShiftWorkers}
                subtitle="Active in running shifts"
                variant="primary"
              />
            </div>

            {/* Today's Shift Roster Snapshot */}
            <Card title="🕒 Today's Plant Shift Attendance Snapshot" className="shift-snapshot-card">
              <div className="shift-grid">
                {shiftAttendance.length === 0 ? (
                  <div className="text-muted text-sm">No shifts active today.</div>
                ) : (
                  shiftAttendance.map((s) => (
                    <div key={s.shift_id} className="shift-stat-box">
                      <span className="shift-name">{s.shift_name}</span>
                      <div className="shift-numbers">
                        <span className="shift-present">{s.present_count} Present</span>
                        <span className="shift-ot">⚡ {s.overtime_hours} hrs OT</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Operators Table */}
            <Card title={`Plant Machinery Operators (${operators.length})`}>
              {loading ? (
                <LoadingScreen message="Loading workforce overview..." />
              ) : operators.length === 0 ? (
                <div className="pwork-empty">No machine operators configured yet.</div>
              ) : (
                <div className="pwork-table-wrap">
                  <table className="pwork-table">
                    <thead>
                      <tr>
                        <th>Operator Name</th>
                        <th>Mobile</th>
                        <th>Specialization / Role</th>
                        <th>Mapped Employee Master</th>
                        <th>Salary Structure</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operators.map((op) => (
                        <tr key={op.id}>
                          <td><strong>{op.name}</strong></td>
                          <td>📞 {op.mobile || "N/A"}</td>
                          <td>
                            <span className="pemp-chip">{op.specialization || "General Operator"}</span>
                          </td>
                          <td>
                            {op.employee_id ? (
                              <div>
                                <span className="pemp-code-badge">{op.employee_code}</span>
                                <span className="mapped-emp-name">{op.employee_name}</span>
                                <div className="text-muted text-sm">
                                  {op.department} • {op.designation}
                                </div>
                              </div>
                            ) : (
                              <span className="unlinked-tag">
                                ⚠️ Not Linked to HR Master
                              </span>
                            )}
                          </td>
                          <td>
                            {op.employee_id ? (
                              <div>
                                <strong>₹{Number(op.base_salary || 0).toLocaleString("en-IN")}</strong>
                                <span className="text-muted text-sm"> / {op.salary_type || "MONTHLY"}</span>
                              </div>
                            ) : (
                              <span className="text-muted text-sm">-</span>
                            )}
                          </td>
                          <td>
                            <StatusBadge
                              status={op.status || "ACTIVE"}
                              variant={op.status === "INACTIVE" ? "danger" : "success"}
                            />
                          </td>
                          <td className="text-right">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenMapModal(op)}
                            >
                              {op.employee_id ? "Change Link" : "🔗 Map to HR"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {/* Tab 2: Shift Labour Cost Calculator */}
        {activeTab === "LABOUR_COST" && (
          <div className="labour-cost-view">
            {/* Filter Bar */}
            <Card className="pwork-filter-card">
              <div className="attendance-controls-row">
                <div className="filter-group">
                  <label htmlFor="cost-from">From Date</label>
                  <input
                    id="cost-from"
                    type="date"
                    className="sb-input"
                    value={labourFrom}
                    onChange={(e) => setLabourFrom(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="cost-to">To Date</label>
                  <input
                    id="cost-to"
                    type="date"
                    className="sb-input"
                    value={labourTo}
                    onChange={(e) => setLabourTo(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="cost-shift">Shift</label>
                  <select
                    id="cost-shift"
                    className="sb-select"
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
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={fetchLabourCost}
                    disabled={calculating}
                  >
                    {calculating ? "Calculating..." : "⚡ Calculate Labour Cost"}
                  </Button>
                </div>
              </div>
            </Card>

            {/* KPI Cards */}
            <div className="pwork-kpis">
              <KpiCard
                title="Estimated Labour Cost"
                value={`₹${Number(labourData.summary?.totalLabourCost || 0).toLocaleString("en-IN")}`}
                subtitle="Total wage cost for selected period"
                variant="success"
              />
              <KpiCard
                title="Total Worker Hours"
                value={`${labourData.summary?.totalHours || 0} hrs`}
                subtitle="Regular + Overtime hours"
                variant="primary"
              />
              <KpiCard
                title="Shift Records"
                value={labourData.summary?.recordsCount || 0}
                subtitle="Shift log days counted"
                variant="default"
              />
            </div>

            {/* Shift Breakdown Table */}
            <Card title="Shift-by-Shift Labour Cost Breakdown">
              {calculating ? (
                <LoadingScreen message="Calculating labour expenditure..." />
              ) : labourData.records.length === 0 ? (
                <div className="pwork-empty">
                  No shift attendance data found for the selected period.
                </div>
              ) : (
                <div className="pwork-table-wrap">
                  <table className="pwork-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Shift</th>
                        <th>Workers Present</th>
                        <th>Regular Hours</th>
                        <th>Overtime Hours</th>
                        <th className="text-right">Estimated Labour Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labourData.records.map((r, i) => (
                        <tr key={i}>
                          <td><strong>{new Date(r.attendance_date).toLocaleDateString("en-IN")}</strong></td>
                          <td><span className="pemp-chip">{r.shift_name}</span></td>
                          <td>{r.workers_present} workers</td>
                          <td>{r.total_regular_hours} hrs</td>
                          <td className="text-primary font-semibold">⚡ {r.total_overtime_hours} hrs</td>
                          <td className="text-right">
                            <strong className="text-success font-bold">
                              ₹{Math.round(Number(r.estimated_labour_cost || 0)).toLocaleString("en-IN")}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Modal: Map Operator to Employee */}
        {mappingModalOpen && selectedOperator && (
          <Modal
            isOpen={mappingModalOpen}
            onClose={() => !submitting && setMappingModalOpen(false)}
            title="🔗 Link Operator to Employee Profile"
            size="md"
          >
            <form onSubmit={handleSaveMapping} className="pwork-modal-form">
              <div className="operator-profile-peek">
                <h4 className="peek-title">Operator: {selectedOperator.name}</h4>
                <p className="peek-sub">
                  Role: {selectedOperator.specialization || "Plant Operator"} • Mobile: {selectedOperator.mobile || "N/A"}
                </p>
              </div>

              <div className="form-field mt-3">
                <label>Select Official Employee Master *</label>
                <select
                  className="sb-select"
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
                <small className="text-muted text-sm mt-1">
                  Linking syncs operator contact details and ties shift production batches directly to payroll salary calculation.
                </small>
              </div>

              <div className="modal-footer-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setMappingModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Link"}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
}

export default PlasticWorkforce;
