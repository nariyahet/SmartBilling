import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticOperations.css";

function PlasticOperations() {
  const [activeTab, setActiveTab] = useState("shifts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [shifts, setShifts] = useState([]);
  const [operators, setOperators] = useState([]);

  // Modals
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showOperatorModal, setShowOperatorModal] = useState(false);

  // Forms
  const [shiftForm, setShiftForm] = useState({
    shift_name: "",
    start_time: "08:00:00",
    end_time: "16:00:00",
    break_duration_minutes: "60",
    status: "ACTIVE",
  });

  const [operatorForm, setOperatorForm] = useState({
    operator_code: "",
    name: "",
    mobile: "",
    skill_level: "Senior Operator",
    status: "ACTIVE",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sRes, oRes] = await Promise.allSettled([
        API.get("/plastic-erp/plant/shifts"),
        API.get("/plastic-erp/plant/operators"),
      ]);

      if (sRes.status === "fulfilled") setShifts(sRes.value.data.shifts || []);
      if (oRes.status === "fulfilled") setOperators(oRes.value.data.operators || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load operations data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleCreateShift = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/plant/shifts", shiftForm);
      setSuccessMsg("Shift created successfully!");
      setShowShiftModal(false);
      setShiftForm({
        shift_name: "",
        start_time: "08:00:00",
        end_time: "16:00:00",
        break_duration_minutes: "60",
        status: "ACTIVE",
      });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create shift.");
    }
  };

  const handleCreateOperator = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/plant/operators", operatorForm);
      setSuccessMsg("Operator created successfully!");
      setShowOperatorModal(false);
      setOperatorForm({
        operator_code: "",
        name: "",
        mobile: "",
        skill_level: "Senior Operator",
        status: "ACTIVE",
      });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create operator.");
    }
  };

  if (loading) {
    return (
      <div className="plastic-ops-page">
        <PlasticNavbar />
        <LoadingScreen message="Loading plant operations..." />
      </div>
    );
  }

  const activeShiftsCount = shifts.filter((s) => s.status === "ACTIVE").length;
  const activeOpsCount = operators.filter((o) => o.status === "ACTIVE").length;

  return (
    <div className="plastic-ops-page">
      <PlasticNavbar />

      <main className="plastic-ops-container">
        {/* Header */}
        <div className="plastic-ops-header">
          <div>
            <span className="plastic-ops-badge">PLANT OPERATIONS</span>
            <h1 className="plastic-ops-title">Shifts & Operator Management</h1>
            <p className="plastic-ops-subtitle">
              Manage work shifts, plant timings, machine operators, and skill proficiencies.
            </p>
          </div>
          <div className="plastic-ops-header-actions">
            <Link to="/plastic-erp" className="btn-secondary-link">
              ← ERP Dashboard
            </Link>
            {activeTab === "shifts" ? (
              <button
                className="btn-primary-ops"
                onClick={() => setShowShiftModal(true)}
              >
                + Add Shift
              </button>
            ) : (
              <button
                className="btn-primary-ops"
                onClick={() => setShowOperatorModal(true)}
              >
                + Add Operator
              </button>
            )}
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="ops-alert ops-alert-danger">
            <span>{error}</span>
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {successMsg && (
          <div className="ops-alert ops-alert-success">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg("")}>×</button>
          </div>
        )}

        {/* Quick KPI Stats */}
        <div className="plastic-ops-stats-grid">
          <div className="ops-stat-card">
            <span className="ops-stat-label">Total Shifts</span>
            <span className="ops-stat-val">{shifts.length}</span>
            <span className="ops-stat-sub">{activeShiftsCount} Active in Rotation</span>
          </div>
          <div className="ops-stat-card">
            <span className="ops-stat-label">Active Operators</span>
            <span className="ops-stat-val text-green">{activeOpsCount}</span>
            <span className="ops-stat-sub">Across all plant bays</span>
          </div>
          <div className="ops-stat-card">
            <span className="ops-stat-label">Total Workforce</span>
            <span className="ops-stat-val">{operators.length}</span>
            <span className="ops-stat-sub">Registered Staff</span>
          </div>
          <div className="ops-stat-card">
            <span className="ops-stat-label">Plant Operating Hours</span>
            <span className="ops-stat-val text-blue">24 / 7</span>
            <span className="ops-stat-sub">Multi-shift coverage</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="plastic-ops-tabs">
          <button
            className={`ops-tab-btn ${activeTab === "shifts" ? "active" : ""}`}
            onClick={() => setActiveTab("shifts")}
          >
            ⏰ Shifts ({shifts.length})
          </button>
          <button
            className={`ops-tab-btn ${activeTab === "operators" ? "active" : ""}`}
            onClick={() => setActiveTab("operators")}
          >
            👷 Operators ({operators.length})
          </button>
        </div>

        {/* TAB 1: SHIFTS */}
        {activeTab === "shifts" && (
          <div className="plastic-ops-card">
            <div className="card-top-bar">
              <h3>Configured Shifts</h3>
              <button
                className="btn-outline-sm"
                onClick={() => setShowShiftModal(true)}
              >
                + New Shift
              </button>
            </div>
            <div className="ops-table-responsive">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Shift Name</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Break Duration</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-4 text-muted">
                        No shifts configured yet. Click &quot;+ Add Shift&quot; to create your first shift.
                      </td>
                    </tr>
                  ) : (
                    shifts.map((s) => (
                      <tr key={s.id}>
                        <td><strong>{s.shift_name}</strong></td>
                        <td><span className="time-badge">{s.start_time}</span></td>
                        <td><span className="time-badge">{s.end_time}</span></td>
                        <td>{s.break_duration_minutes} mins</td>
                        <td>
                          <span
                            className={`badge ${
                              s.status === "ACTIVE" ? "badge-success" : "badge-neutral"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="text-muted">
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: OPERATORS */}
        {activeTab === "operators" && (
          <div className="plastic-ops-card">
            <div className="card-top-bar">
              <h3>Shop Floor Operators</h3>
              <button
                className="btn-outline-sm"
                onClick={() => setShowOperatorModal(true)}
              >
                + New Operator
              </button>
            </div>
            <div className="ops-table-responsive">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Full Name</th>
                    <th>Skill Level</th>
                    <th>Contact Mobile</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-4 text-muted">
                        No operators recorded yet. Click &quot;+ Add Operator&quot; to register personnel.
                      </td>
                    </tr>
                  ) : (
                    operators.map((op) => (
                      <tr key={op.id}>
                        <td><code>{op.operator_code}</code></td>
                        <td><strong>{op.name}</strong></td>
                        <td>
                          <span className="skill-badge">{op.skill_level}</span>
                        </td>
                        <td>{op.mobile || "—"}</td>
                        <td>
                          <span
                            className={`badge ${
                              op.status === "ACTIVE" ? "badge-success" : "badge-neutral"
                            }`}
                          >
                            {op.status}
                          </span>
                        </td>
                        <td className="text-muted">
                          {new Date(op.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* CREATE SHIFT MODAL */}
      {showShiftModal && (
        <div className="ops-modal-backdrop">
          <div className="ops-modal-box">
            <div className="ops-modal-header">
              <h2>Add Plant Shift</h2>
              <button onClick={() => setShowShiftModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateShift} className="ops-modal-form">
              <div className="form-group">
                <label>Shift Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Shift A, Night Shift"
                  value={shiftForm.shift_name}
                  onChange={(e) =>
                    setShiftForm({ ...shiftForm, shift_name: e.target.value })
                  }
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Start Time (HH:MM:SS) *</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={shiftForm.start_time}
                    onChange={(e) =>
                      setShiftForm({ ...shiftForm, start_time: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>End Time (HH:MM:SS) *</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={shiftForm.end_time}
                    onChange={(e) =>
                      setShiftForm({ ...shiftForm, end_time: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Break Duration (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    value={shiftForm.break_duration_minutes}
                    onChange={(e) =>
                      setShiftForm({
                        ...shiftForm,
                        break_duration_minutes: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={shiftForm.status}
                    onChange={(e) =>
                      setShiftForm({ ...shiftForm, status: e.target.value })
                    }
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="ops-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowShiftModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE OPERATOR MODAL */}
      {showOperatorModal && (
        <div className="ops-modal-backdrop">
          <div className="ops-modal-box">
            <div className="ops-modal-header">
              <h2>Add Operator / Technician</h2>
              <button onClick={() => setShowOperatorModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateOperator} className="ops-modal-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Operator Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="Leave blank for auto OP-100X"
                    value={operatorForm.operator_code}
                    onChange={(e) =>
                      setOperatorForm({
                        ...operatorForm,
                        operator_code: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={operatorForm.name}
                    onChange={(e) =>
                      setOperatorForm({ ...operatorForm, name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={operatorForm.mobile}
                    onChange={(e) =>
                      setOperatorForm({
                        ...operatorForm,
                        mobile: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Skill Level</label>
                  <select
                    value={operatorForm.skill_level}
                    onChange={(e) =>
                      setOperatorForm({
                        ...operatorForm,
                        skill_level: e.target.value,
                      })
                    }
                  >
                    <option value="Lead Operator">Lead Operator</option>
                    <option value="Senior Operator">Senior Operator</option>
                    <option value="Operator">Operator</option>
                    <option value="Junior Operator">Junior Operator</option>
                    <option value="Maintenance Technician">Maintenance Technician</option>
                    <option value="QC Inspector">QC Inspector</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={operatorForm.status}
                  onChange={(e) =>
                    setOperatorForm({ ...operatorForm, status: e.target.value })
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="ops-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowOperatorModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Register Operator
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticOperations;
