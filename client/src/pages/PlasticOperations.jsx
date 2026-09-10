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
  Modal,
  Button,
  StatusBadge,
  AlertBanner,
} from "../components";
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

  if (loading) return <LoadingScreen message="Loading plant operations..." />;

  const activeShiftsCount = shifts.filter((s) => s.status === "ACTIVE").length;
  const activeOpsCount = operators.filter((o) => o.status === "ACTIVE").length;

  const tabs = [
    { id: "shifts", label: "⏰ Plant Shifts", count: shifts.length },
    { id: "operators", label: "👷 Machine Operators", count: operators.length },
  ];

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Plant Operations & Workforce"
        subtitle="Manage work shifts, plant timings, machine operators, and skill proficiencies."
        breadcrumbs={[
          { label: "ERP", to: "/plastic-erp" },
          { label: "Production", to: "/plastic-erp/production" },
          { label: "Plant Operations" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/plastic-erp">
              <Button variant="secondary">ERP Dashboard</Button>
            </Link>
            {activeTab === "shifts" ? (
              <Button variant="primary" onClick={() => setShowShiftModal(true)}>
                + Add Shift
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setShowOperatorModal(true)}>
                + Add Operator
              </Button>
            )}
          </div>
        }
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg("")} />}

      {/* KPI Cards */}
      <div className="sb-kpis-grid" style={{ marginBottom: "24px" }}>
        <KpiCard
          label="Total Shifts"
          value={shifts.length}
          subtext={`${activeShiftsCount} Active in Rotation`}
          accent="blue"
        />
        <KpiCard
          label="Active Operators"
          value={activeOpsCount}
          subtext="Across all plant bays"
          accent="teal"
        />
        <KpiCard
          label="Total Workforce"
          value={operators.length}
          subtext="Registered Staff"
          accent="navy"
        />
        <KpiCard
          label="Plant Coverage"
          value="24 / 7"
          subtext="Multi-shift operations"
          accent="blue"
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: SHIFTS */}
      {activeTab === "shifts" && (
        <Card noPadding>
          <DataTable
            headers={[
              "Shift Name",
              "Start Time",
              "End Time",
              "Break Duration",
              "Status",
              "Created",
            ]}
          >
            {shifts.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                  No shifts configured yet. Click &quot;+ Add Shift&quot; to create your first shift.
                </td>
              </tr>
            ) : (
              shifts.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.shift_name}</strong></td>
                  <td><span className="ops-time-badge">{s.start_time}</span></td>
                  <td><span className="ops-time-badge">{s.end_time}</span></td>
                  <td>{s.break_duration_minutes} mins</td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ color: "var(--sb-muted)" }}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>
      )}

      {/* TAB 2: OPERATORS */}
      {activeTab === "operators" && (
        <Card noPadding>
          <DataTable
            headers={[
              "Code",
              "Full Name",
              "Skill Level",
              "Contact Mobile",
              "Status",
              "Created",
            ]}
          >
            {operators.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                  No operators recorded yet. Click &quot;+ Add Operator&quot; to register personnel.
                </td>
              </tr>
            ) : (
              operators.map((op) => (
                <tr key={op.id}>
                  <td><code>{op.operator_code}</code></td>
                  <td><strong>{op.name}</strong></td>
                  <td>
                    <span className="ops-skill-badge">{op.skill_level}</span>
                  </td>
                  <td>{op.mobile || "—"}</td>
                  <td>
                    <StatusBadge status={op.status} />
                  </td>
                  <td style={{ color: "var(--sb-muted)" }}>
                    {new Date(op.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>
      )}

      {/* CREATE SHIFT MODAL */}
      <Modal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        title="Add Plant Shift"
      >
        <form onSubmit={handleCreateShift} className="sb-form">
          <div className="sb-form-group">
            <label className="sb-label">Shift Name *</label>
            <input
              type="text"
              required
              className="sb-input"
              placeholder="e.g. Morning Shift A, Night Shift"
              value={shiftForm.shift_name}
              onChange={(e) => setShiftForm({ ...shiftForm, shift_name: e.target.value })}
            />
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Start Time (HH:MM:SS) *</label>
              <input
                type="time"
                step="1"
                required
                className="sb-input"
                value={shiftForm.start_time}
                onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
              />
            </div>
            <div className="sb-form-group">
              <label className="sb-label">End Time (HH:MM:SS) *</label>
              <input
                type="time"
                step="1"
                required
                className="sb-input"
                value={shiftForm.end_time}
                onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
              />
            </div>
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Break Duration (minutes)</label>
              <input
                type="number"
                min="0"
                className="sb-input"
                value={shiftForm.break_duration_minutes}
                onChange={(e) => setShiftForm({ ...shiftForm, break_duration_minutes: e.target.value })}
              />
            </div>
            <div className="sb-form-group">
              <label className="sb-label">Status</label>
              <select
                className="sb-input"
                value={shiftForm.status}
                onChange={(e) => setShiftForm({ ...shiftForm, status: e.target.value })}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setShowShiftModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Shift
            </Button>
          </div>
        </form>
      </Modal>

      {/* CREATE OPERATOR MODAL */}
      <Modal
        isOpen={showOperatorModal}
        onClose={() => setShowOperatorModal(false)}
        title="Add Operator / Technician"
      >
        <form onSubmit={handleCreateOperator} className="sb-form">
          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Operator Code (Optional)</label>
              <input
                type="text"
                className="sb-input"
                placeholder="Leave blank for auto OP-100X"
                value={operatorForm.operator_code}
                onChange={(e) => setOperatorForm({ ...operatorForm, operator_code: e.target.value })}
              />
            </div>
            <div className="sb-form-group">
              <label className="sb-label">Full Name *</label>
              <input
                type="text"
                required
                className="sb-input"
                placeholder="e.g. Ramesh Patel"
                value={operatorForm.name}
                onChange={(e) => setOperatorForm({ ...operatorForm, name: e.target.value })}
              />
            </div>
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Mobile Number</label>
              <input
                type="tel"
                className="sb-input"
                placeholder="e.g. 9876543210"
                value={operatorForm.mobile}
                onChange={(e) => setOperatorForm({ ...operatorForm, mobile: e.target.value })}
              />
            </div>
            <div className="sb-form-group">
              <label className="sb-label">Skill Level</label>
              <select
                className="sb-input"
                value={operatorForm.skill_level}
                onChange={(e) => setOperatorForm({ ...operatorForm, skill_level: e.target.value })}
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

          <div className="sb-form-group">
            <label className="sb-label">Status</label>
            <select
              className="sb-input"
              value={operatorForm.status}
              onChange={(e) => setOperatorForm({ ...operatorForm, status: e.target.value })}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setShowOperatorModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Register Operator
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PlasticOperations;
