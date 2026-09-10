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
import "./PlasticMachines.css";

function PlasticMachines() {
  const [activeTab, setActiveTab] = useState("machines");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [machines, setMachines] = useState([]);
  const [downtimes, setDowntimes] = useState([]);
  const [maintenance, setMaintenance] = useState([]);

  // Modals
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [showDowntimeModal, setShowDowntimeModal] = useState(false);
  const [showMntModal, setShowMntModal] = useState(false);

  const [machineForm, setMachineForm] = useState({
    machine_name: "",
    machine_type: "Extrusion Line",
    capacity: "350",
    unit: "KG/HR",
    location: "Plant Bay A",
    status: "ACTIVE",
    notes: "",
  });

  const [downtimeForm, setDowntimeForm] = useState({
    machine_id: "",
    category: "BREAKDOWN",
    reason: "",
    duration_minutes: "30",
    action_taken: "",
  });

  const [mntForm, setMntForm] = useState({
    machine_id: "",
    title: "",
    maintenance_type: "PREVENTIVE",
    scheduled_date: new Date().toISOString().split("T")[0],
    cost: "1500",
    technician_name: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [mchRes, dwnRes, mntRes] = await Promise.allSettled([
        API.get("/plastic-erp/plant/machines"),
        API.get("/plastic-erp/plant/downtime"),
        API.get("/plastic-erp/plant/maintenance"),
      ]);

      if (mchRes.status === "fulfilled") setMachines(mchRes.value.data.machines || []);
      if (dwnRes.status === "fulfilled") setDowntimes(dwnRes.value.data.downtimeLogs || []);
      if (mntRes.status === "fulfilled") setMaintenance(mntRes.value.data.maintenanceRecords || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load machine operations data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateMachine = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/plant/machines", machineForm);
      setSuccessMsg("Machine added successfully!");
      setShowMachineModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add machine.");
    }
  };

  const handleLogDowntime = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/plant/downtime", downtimeForm);
      setSuccessMsg("Machine downtime logged!");
      setShowDowntimeModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to log downtime.");
    }
  };

  const handleScheduleMnt = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/plant/maintenance", mntForm);
      setSuccessMsg("Maintenance record scheduled!");
      setShowMntModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to schedule maintenance.");
    }
  };

  const totalCapacityKgHr = machines.reduce((acc, m) => acc + (Number(m.capacity) || 0), 0);
  const activeCount = machines.filter((m) => m.status === "ACTIVE").length;
  const breakdownCount = machines.filter((m) => m.status === "BREAKDOWN").length;

  if (loading) return <LoadingScreen message="Loading Machine Management..." />;

  const tabs = [
    { id: "machines", label: "Machines Master", count: machines.length },
    { id: "downtime", label: "Downtime Logs", count: downtimes.length },
    { id: "maintenance", label: "Maintenance", count: maintenance.length },
  ];

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Machine & Plant Management"
        subtitle="Equipment Master, Live Status, Downtime Tracking & Preventive Maintenance"
        breadcrumbs={[
          { label: "ERP", to: "/plastic-erp" },
          { label: "Production", to: "/plastic-erp/production" },
          { label: "Machines" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/plastic-erp">
              <Button variant="secondary">ERP Dashboard</Button>
            </Link>
            {activeTab === "machines" && (
              <Button variant="primary" onClick={() => setShowMachineModal(true)}>
                + Add Machine
              </Button>
            )}
            {activeTab === "downtime" && (
              <Button variant="primary" onClick={() => setShowDowntimeModal(true)}>
                + Log Downtime
              </Button>
            )}
            {activeTab === "maintenance" && (
              <Button variant="primary" onClick={() => setShowMntModal(true)}>
                + Schedule Maintenance
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
          label="Total Machines"
          value={`${machines.length} Units`}
          subtext={`${totalCapacityKgHr.toLocaleString()} KG/HR capacity`}
          accent="blue"
        />
        <KpiCard
          label="Operating Active"
          value={activeCount}
          subtext={`${((activeCount / (machines.length || 1)) * 100).toFixed(0)}% running utilization`}
          accent="teal"
        />
        <KpiCard
          label="Under Breakdown"
          value={breakdownCount}
          subtext={`${downtimes.length} historical incidents`}
          accent={breakdownCount > 0 ? "danger" : "navy"}
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: MACHINES MASTER */}
      {activeTab === "machines" && (
        <div className="machines-grid">
          {machines.length === 0 ? (
            <Card style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px" }}>
              <h3 style={{ color: "var(--sb-navy)", marginBottom: "8px" }}>No machines registered in the plant</h3>
              <p style={{ color: "var(--sb-muted)", marginBottom: "16px" }}>Click &quot;Add Machine&quot; to configure extruders, shredders, and pelletizers.</p>
              <Button variant="primary" onClick={() => setShowMachineModal(true)}>
                + Add Machine
              </Button>
            </Card>
          ) : (
            machines.map((m) => (
              <div key={m.id} className={`sb-machine-card status-${m.status?.toLowerCase()}`}>
                <div className="mch-header">
                  <div>
                    <span className="mch-code">{m.machine_code}</span>
                    <h3 className="mch-name">{m.machine_name}</h3>
                  </div>
                  <StatusBadge status={m.status} />
                </div>

                <div className="mch-details">
                  <div className="mch-detail-row">
                    <span>Type:</span>
                    <strong>{m.machine_type}</strong>
                  </div>
                  <div className="mch-detail-row">
                    <span>Capacity:</span>
                    <strong>{Number(m.capacity).toLocaleString()} {m.unit}</strong>
                  </div>
                  <div className="mch-detail-row">
                    <span>Bay Location:</span>
                    <strong>{m.location || "Main Plant Floor"}</strong>
                  </div>
                </div>

                <div className="mch-footer">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setDowntimeForm({ ...downtimeForm, machine_id: String(m.id) });
                      setShowDowntimeModal(true);
                    }}
                  >
                    Log Downtime ⏱️
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: DOWNTIME LOGS */}
      {activeTab === "downtime" && (
        <Card noPadding>
          <DataTable
            headers={[
              "Log No",
              "Machine",
              "Category",
              "Duration",
              "Reason",
              "Action Taken",
              "Start Time",
            ]}
          >
            {downtimes.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                  No downtime incidents recorded.
                </td>
              </tr>
            ) : (
              downtimes.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.downtime_no}</strong></td>
                  <td>{d.machine_name} ({d.machine_code})</td>
                  <td><span className="downtime-cat-badge">{d.category}</span></td>
                  <td><strong>{d.duration_minutes} mins</strong></td>
                  <td>{d.reason}</td>
                  <td>{d.action_taken || "-"}</td>
                  <td>{d.start_time?.split("T")[0]}</td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>
      )}

      {/* TAB 3: MAINTENANCE RECORDS */}
      {activeTab === "maintenance" && (
        <Card noPadding>
          <DataTable
            headers={[
              "Maintenance No",
              "Machine",
              "Title",
              "Type",
              "Scheduled Date",
              "Estimated Cost",
              "Technician",
              "Status",
            ]}
          >
            {maintenance.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                  No maintenance schedules recorded.
                </td>
              </tr>
            ) : (
              maintenance.map((mnt) => (
                <tr key={mnt.id}>
                  <td><strong>{mnt.maintenance_no}</strong></td>
                  <td>{mnt.machine_name}</td>
                  <td>{mnt.title}</td>
                  <td>{mnt.maintenance_type}</td>
                  <td>{mnt.scheduled_date?.split("T")[0]}</td>
                  <td>₹{Number(mnt.cost || 0).toLocaleString()}</td>
                  <td>{mnt.technician_name || "Internal Plant Tech"}</td>
                  <td>
                    <StatusBadge status={mnt.status} />
                  </td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>
      )}

      {/* MODAL: ADD MACHINE */}
      <Modal
        isOpen={showMachineModal}
        onClose={() => setShowMachineModal(false)}
        title="Add New Machine"
      >
        <form onSubmit={handleCreateMachine} className="sb-form">
          <div className="sb-form-group">
            <label className="sb-label">Machine Name *</label>
            <input
              type="text"
              required
              className="sb-input"
              value={machineForm.machine_name}
              onChange={(e) => setMachineForm({ ...machineForm, machine_name: e.target.value })}
              placeholder="e.g. Twin Screw Extruder Line 02"
            />
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Machine Type *</label>
              <select
                className="sb-input"
                value={machineForm.machine_type}
                onChange={(e) => setMachineForm({ ...machineForm, machine_type: e.target.value })}
              >
                <option value="Extrusion Line">Extrusion Line</option>
                <option value="Crusher / Granulator">Crusher / Granulator</option>
                <option value="Friction Washer">Friction Washer</option>
                <option value="Pelletizer">Pelletizer</option>
                <option value="Agglomerator">Agglomerator</option>
              </select>
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Rated Capacity (KG/HR)</label>
              <input
                type="number"
                required
                className="sb-input"
                value={machineForm.capacity}
                onChange={(e) => setMachineForm({ ...machineForm, capacity: e.target.value })}
              />
            </div>
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Floor Location</label>
              <input
                type="text"
                className="sb-input"
                value={machineForm.location}
                onChange={(e) => setMachineForm({ ...machineForm, location: e.target.value })}
                placeholder="e.g. Plant Bay B"
              />
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Initial Status</label>
              <select
                className="sb-input"
                value={machineForm.status}
                onChange={(e) => setMachineForm({ ...machineForm, status: e.target.value })}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="IDLE">IDLE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="BREAKDOWN">BREAKDOWN</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setShowMachineModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Machine
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: LOG DOWNTIME */}
      <Modal
        isOpen={showDowntimeModal}
        onClose={() => setShowDowntimeModal(false)}
        title="Log Machine Downtime"
      >
        <form onSubmit={handleLogDowntime} className="sb-form">
          <div className="sb-form-group">
            <label className="sb-label">Machine *</label>
            <select
              required
              className="sb-input"
              value={downtimeForm.machine_id}
              onChange={(e) => setDowntimeForm({ ...downtimeForm, machine_id: e.target.value })}
            >
              <option value="">Select Machine</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</option>
              ))}
            </select>
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Downtime Category</label>
              <select
                className="sb-input"
                value={downtimeForm.category}
                onChange={(e) => setDowntimeForm({ ...downtimeForm, category: e.target.value })}
              >
                <option value="BREAKDOWN">Machine Breakdown</option>
                <option value="MAINTENANCE">Maintenance / Servicing</option>
                <option value="MATERIAL_SHORTAGE">Material Shortage</option>
                <option value="POWER_FAILURE">Power Failure / Grid Cut</option>
                <option value="CHANGEOVER">Die Changeover / Cleaning</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Duration (Minutes) *</label>
              <input
                type="number"
                required
                min="1"
                className="sb-input"
                value={downtimeForm.duration_minutes}
                onChange={(e) => setDowntimeForm({ ...downtimeForm, duration_minutes: e.target.value })}
              />
            </div>
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Reason / Root Cause *</label>
            <input
              type="text"
              required
              className="sb-input"
              value={downtimeForm.reason}
              onChange={(e) => setDowntimeForm({ ...downtimeForm, reason: e.target.value })}
              placeholder="e.g. Barrel temperature sensor fault or jammed conveyor"
            />
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Corrective Action Taken</label>
            <input
              type="text"
              className="sb-input"
              value={downtimeForm.action_taken}
              onChange={(e) => setDowntimeForm({ ...downtimeForm, action_taken: e.target.value })}
              placeholder="e.g. Replaced thermocouple sensor and restarted extruder"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setShowDowntimeModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Record Downtime
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: SCHEDULE MAINTENANCE */}
      <Modal
        isOpen={showMntModal}
        onClose={() => setShowMntModal(false)}
        title="Schedule Equipment Maintenance"
      >
        <form onSubmit={handleScheduleMnt} className="sb-form">
          <div className="sb-form-group">
            <label className="sb-label">Machine *</label>
            <select
              required
              className="sb-input"
              value={mntForm.machine_id}
              onChange={(e) => setMntForm({ ...mntForm, machine_id: e.target.value })}
            >
              <option value="">Select Machine</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</option>
              ))}
            </select>
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Maintenance Title *</label>
            <input
              type="text"
              required
              className="sb-input"
              value={mntForm.title}
              onChange={(e) => setMntForm({ ...mntForm, title: e.target.value })}
              placeholder="e.g. Monthly Gearbox Oil Change & Filter Replacement"
            />
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Type</label>
              <select
                className="sb-input"
                value={mntForm.maintenance_type}
                onChange={(e) => setMntForm({ ...mntForm, maintenance_type: e.target.value })}
              >
                <option value="PREVENTIVE">Preventive Maintenance</option>
                <option value="BREAKDOWN">Breakdown Repair</option>
                <option value="CORRECTIVE">Corrective Tuning</option>
              </select>
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Scheduled Date *</label>
              <input
                type="date"
                required
                className="sb-input"
                value={mntForm.scheduled_date}
                onChange={(e) => setMntForm({ ...mntForm, scheduled_date: e.target.value })}
              />
            </div>
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Estimated Cost (₹)</label>
              <input
                type="number"
                className="sb-input"
                value={mntForm.cost}
                onChange={(e) => setMntForm({ ...mntForm, cost: e.target.value })}
              />
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Technician Name</label>
              <input
                type="text"
                className="sb-input"
                value={mntForm.technician_name}
                onChange={(e) => setMntForm({ ...mntForm, technician_name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setShowMntModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Schedule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PlasticMachines;
