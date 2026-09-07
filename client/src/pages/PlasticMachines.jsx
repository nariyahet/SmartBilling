import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />

      <div className="plastic-content-wrap">
        <div className="plastic-page-header">
          <div>
            <h1 className="plastic-page-title">⚙️ Machine & Plant Management</h1>
            <p className="plastic-page-subtitle">Equipment Master, Live Status, Downtime Tracking & Preventive Maintenance</p>
          </div>

          <div className="plastic-page-actions">
            <Link to="/plastic-erp" className="btn-dashboard-nav">
              📊 ERP Dashboard
            </Link>
            {activeTab === "machines" && (
              <button type="button" className="btn-primary" onClick={() => setShowMachineModal(true)}>
                ➕ Add Machine
              </button>
            )}
            {activeTab === "downtime" && (
              <button type="button" className="btn-primary" onClick={() => setShowDowntimeModal(true)}>
                ➕ Log Downtime
              </button>
            )}
            {activeTab === "maintenance" && (
              <button type="button" className="btn-primary" onClick={() => setShowMntModal(true)}>
                ➕ Schedule Maintenance
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="plastic-alert error">
            <span>⚠️ {error}</span>
            <button type="button" onClick={() => setError("")}>✕</button>
          </div>
        )}

        {successMsg && (
          <div className="plastic-alert success">
            <span>✅ {successMsg}</span>
            <button type="button" onClick={() => setSuccessMsg("")}>✕</button>
          </div>
        )}

        {/* Machine Stats Banner */}
        <div className="wip-summary-cards">
          <div className="summary-stat-card">
            <span className="stat-label">Total Machines</span>
            <strong className="stat-value text-blue">{machines.length} Units</strong>
            <span className="stat-sub">{totalCapacityKgHr.toLocaleString()} KG/HR total rated capacity</span>
          </div>

          <div className="summary-stat-card">
            <span className="stat-label">Operating Active</span>
            <strong className="stat-value text-green">{activeCount}</strong>
            <span className="stat-sub">{((activeCount / (machines.length || 1)) * 100).toFixed(0)}% running utilization</span>
          </div>

          <div className="summary-stat-card">
            <span className="stat-label">Under Breakdown / Repair</span>
            <strong className="stat-value text-red">{breakdownCount}</strong>
            <span className="stat-sub">{downtimes.length} historical downtime incidents</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="plastic-tabs-nav">
          <button
            type="button"
            className={`tab-btn ${activeTab === "machines" ? "active" : ""}`}
            onClick={() => setActiveTab("machines")}
          >
            ⚙️ Machines ({machines.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "downtime" ? "active" : ""}`}
            onClick={() => setActiveTab("downtime")}
          >
            ⏱️ Downtime Logs ({downtimes.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "maintenance" ? "active" : ""}`}
            onClick={() => setActiveTab("maintenance")}
          >
            🔧 Maintenance ({maintenance.length})
          </button>
        </div>

        {/* TAB 1: MACHINES MASTER */}
        {activeTab === "machines" && (
          <div className="machines-grid">
            {machines.length === 0 ? (
              <div className="plastic-card full-width empty-card">
                <h3>No machines registered in the plant</h3>
                <p>Click "Add Machine" to configure extruders, shredders, and pelletizers.</p>
              </div>
            ) : (
              machines.map((m) => (
                <div key={m.id} className={`machine-card status-${m.status?.toLowerCase()}`}>
                  <div className="mch-header">
                    <div>
                      <span className="mch-code">{m.machine_code}</span>
                      <h3 className="mch-name">{m.machine_name}</h3>
                    </div>
                    <span className={`badge mch-${m.status?.toLowerCase()}`}>{m.status}</span>
                  </div>

                  <div className="mch-details">
                    <div className="detail-row">
                      <span>Type:</span>
                      <strong>{m.machine_type}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Capacity:</span>
                      <strong>{Number(m.capacity).toLocaleString()} {m.unit}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Bay Location:</span>
                      <strong>{m.location || "Main Plant Floor"}</strong>
                    </div>
                  </div>

                  <div className="mch-footer">
                    <button
                      type="button"
                      className="btn-log-dwn"
                      onClick={() => {
                        setDowntimeForm({ ...downtimeForm, machine_id: String(m.id) });
                        setShowDowntimeModal(true);
                      }}
                    >
                      Log Downtime ⏱️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: DOWNTIME LOGS */}
        {activeTab === "downtime" && (
          <div className="plastic-card">
            <div className="table-responsive">
              <table className="plastic-table">
                <thead>
                  <tr>
                    <th>Log No</th>
                    <th>Machine</th>
                    <th>Category</th>
                    <th>Duration</th>
                    <th>Reason</th>
                    <th>Action Taken</th>
                    <th>Start Time</th>
                  </tr>
                </thead>
                <tbody>
                  {downtimes.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-cell">No downtime incidents recorded.</td>
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
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: MAINTENANCE RECORDS */}
        {activeTab === "maintenance" && (
          <div className="plastic-card">
            <div className="table-responsive">
              <table className="plastic-table">
                <thead>
                  <tr>
                    <th>Maintenance No</th>
                    <th>Machine</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Scheduled Date</th>
                    <th>Estimated Cost</th>
                    <th>Technician</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenance.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="empty-cell">No maintenance schedules recorded.</td>
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
                          <span className={`badge status-${mnt.status?.toLowerCase()}`}>{mnt.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: ADD MACHINE */}
        {showMachineModal && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal">
              <div className="modal-header">
                <h3>Add New Machine</h3>
                <button type="button" onClick={() => setShowMachineModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCreateMachine} className="modal-form">
                <div className="form-group">
                  <label>Machine Name *</label>
                  <input
                    type="text"
                    required
                    value={machineForm.machine_name}
                    onChange={(e) => setMachineForm({ ...machineForm, machine_name: e.target.value })}
                    placeholder="e.g. Twin Screw Extruder Line 02"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Machine Type *</label>
                    <select
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

                  <div className="form-group">
                    <label>Rated Capacity (KG/HR)</label>
                    <input
                      type="number"
                      required
                      value={machineForm.capacity}
                      onChange={(e) => setMachineForm({ ...machineForm, capacity: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Floor Location</label>
                    <input
                      type="text"
                      value={machineForm.location}
                      onChange={(e) => setMachineForm({ ...machineForm, location: e.target.value })}
                      placeholder="e.g. Plant Bay B"
                    />
                  </div>

                  <div className="form-group">
                    <label>Initial Status</label>
                    <select
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

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowMachineModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Machine
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: LOG DOWNTIME */}
        {showDowntimeModal && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal">
              <div className="modal-header">
                <h3>Log Machine Downtime</h3>
                <button type="button" onClick={() => setShowDowntimeModal(false)}>✕</button>
              </div>
              <form onSubmit={handleLogDowntime} className="modal-form">
                <div className="form-group">
                  <label>Machine *</label>
                  <select
                    required
                    value={downtimeForm.machine_id}
                    onChange={(e) => setDowntimeForm({ ...downtimeForm, machine_id: e.target.value })}
                  >
                    <option value="">Select Machine</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Downtime Category</label>
                    <select
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

                  <div className="form-group">
                    <label>Duration (Minutes) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={downtimeForm.duration_minutes}
                      onChange={(e) => setDowntimeForm({ ...downtimeForm, duration_minutes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Reason / Root Cause *</label>
                  <input
                    type="text"
                    required
                    value={downtimeForm.reason}
                    onChange={(e) => setDowntimeForm({ ...downtimeForm, reason: e.target.value })}
                    placeholder="e.g. Barrel temperature sensor fault or jammed conveyor"
                  />
                </div>

                <div className="form-group">
                  <label>Corrective Action Taken</label>
                  <input
                    type="text"
                    value={downtimeForm.action_taken}
                    onChange={(e) => setDowntimeForm({ ...downtimeForm, action_taken: e.target.value })}
                    placeholder="e.g. Replaced thermocouple sensor and restarted extruder"
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowDowntimeModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Record Downtime
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: SCHEDULE MAINTENANCE */}
        {showMntModal && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal">
              <div className="modal-header">
                <h3>Schedule Equipment Maintenance</h3>
                <button type="button" onClick={() => setShowMntModal(false)}>✕</button>
              </div>
              <form onSubmit={handleScheduleMnt} className="modal-form">
                <div className="form-group">
                  <label>Machine *</label>
                  <select
                    required
                    value={mntForm.machine_id}
                    onChange={(e) => setMntForm({ ...mntForm, machine_id: e.target.value })}
                  >
                    <option value="">Select Machine</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Maintenance Title *</label>
                  <input
                    type="text"
                    required
                    value={mntForm.title}
                    onChange={(e) => setMntForm({ ...mntForm, title: e.target.value })}
                    placeholder="e.g. Monthly Gearbox Oil Change & Filter Replacement"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      value={mntForm.maintenance_type}
                      onChange={(e) => setMntForm({ ...mntForm, maintenance_type: e.target.value })}
                    >
                      <option value="PREVENTIVE">Preventive Maintenance</option>
                      <option value="BREAKDOWN">Breakdown Repair</option>
                      <option value="CORRECTIVE">Corrective Tuning</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Scheduled Date *</label>
                    <input
                      type="date"
                      required
                      value={mntForm.scheduled_date}
                      onChange={(e) => setMntForm({ ...mntForm, scheduled_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Estimated Cost (₹)</label>
                    <input
                      type="number"
                      value={mntForm.cost}
                      onChange={(e) => setMntForm({ ...mntForm, cost: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Technician Name</label>
                    <input
                      type="text"
                      value={mntForm.technician_name}
                      onChange={(e) => setMntForm({ ...mntForm, technician_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowMntModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Schedule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlasticMachines;
