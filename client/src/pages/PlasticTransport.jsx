import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticTransport.css";

function PlasticTransport() {
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    vehicle_number: "",
    vehicle_type: "TRUCK",
    capacity_tons: "",
    transporter_name: "",
    driver_name: "",
    driver_mobile: "",
    notes: "",
    is_active: true,
  });

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const res = await API.get("/plastic-erp/transport/vehicles");
      if (res.data?.success) {
        setVehicles(res.data.vehicles || []);
      }
    } catch (err) {
      console.error("Failed to load vehicles:", err);
      alert("Failed to load vehicle fleet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVehicles();
  }, []);

  const handleOpenCreate = () => {
    setEditingVehicle(null);
    setFormData({
      vehicle_number: "",
      vehicle_type: "TRUCK",
      capacity_tons: "",
      transporter_name: "",
      driver_name: "",
      driver_mobile: "",
      notes: "",
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (v) => {
    setEditingVehicle(v);
    setFormData({
      vehicle_number: v.vehicle_number || "",
      vehicle_type: v.vehicle_type || "TRUCK",
      capacity_tons: v.capacity_tons || "",
      transporter_name: v.transporter_name || "",
      driver_name: v.driver_name || "",
      driver_mobile: v.driver_mobile || "",
      notes: v.notes || "",
      is_active: v.is_active === 1 || v.is_active === true,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vehicle_number.trim()) {
      alert("Vehicle number is required");
      return;
    }

    try {
      setSubmitting(true);
      if (editingVehicle) {
        const res = await API.put(`/plastic-erp/transport/vehicles/${editingVehicle.id}`, formData);
        if (res.data?.success) {
          alert("Vehicle updated successfully");
          setModalOpen(false);
          fetchVehicles();
        }
      } else {
        const res = await API.post("/plastic-erp/transport/vehicles", formData);
        if (res.data?.success) {
          alert("Vehicle registered successfully");
          setModalOpen(false);
          fetchVehicles();
        }
      }
    } catch (err) {
      console.error("Save Vehicle Error:", err);
      alert(err.response?.data?.message || "Failed to save vehicle");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (v) => {
    try {
      const newStatus = !v.is_active;
      const res = await API.put(`/plastic-erp/transport/vehicles/${v.id}`, {
        ...v,
        is_active: newStatus,
      });
      if (res.data?.success) {
        fetchVehicles();
      }
    } catch (err) {
      console.error("Toggle Status Error:", err);
      alert("Failed to update status");
    }
  };

  // KPIs
  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter((v) => v.is_active === 1 || v.is_active === true).length;
  const totalCapacityTons = vehicles.reduce(
    (sum, v) => sum + (Number(v.capacity_tons) || 0),
    0
  );
  const uniqueTransporters = new Set(
    vehicles.map((v) => v.transporter_name).filter(Boolean)
  ).size;

  const filteredVehicles = vehicles.filter((v) => {
    if (statusFilter === "ACTIVE" && !(v.is_active === 1 || v.is_active === true)) return false;
    if (statusFilter === "INACTIVE" && (v.is_active === 1 || v.is_active === true)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const numMatch = String(v.vehicle_number || "").toLowerCase().includes(q);
      const transMatch = String(v.transporter_name || "").toLowerCase().includes(q);
      const driverMatch = String(v.driver_name || "").toLowerCase().includes(q);
      if (!numMatch && !transMatch && !driverMatch) return false;
    }
    return true;
  });

  if (loading) return <LoadingScreen message="Loading Fleet Logistics..." />;

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <div className="plastic-container">
        {/* Header */}
        <div className="pveh-header">
          <div>
            <span className="pveh-badge">LOGISTICS & FLEET</span>
            <h1 className="pveh-title">Vehicle & Transport Master</h1>
            <p className="pveh-subtitle">
              Manage transport vehicles, dedicated trucks, drivers, and capacity for inward & outward dispatches.
            </p>
          </div>
          <div className="pveh-header-actions">
            <Link to="/plastic-erp/dispatches" className="pveh-btn pveh-btn-outline">
              Dispatches
            </Link>
            <Link to="/plastic-erp/transport/challans" className="pveh-btn pveh-btn-outline">
              Delivery Challans
            </Link>
            <button className="pveh-btn pveh-btn-primary" onClick={handleOpenCreate}>
              + Register Vehicle
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="pveh-kpis">
          <div className="pveh-kpi-card">
            <div className="pveh-kpi-val">{totalVehicles}</div>
            <div className="pveh-kpi-lbl">Total Fleet</div>
          </div>
          <div className="pveh-kpi-card active">
            <div className="pveh-kpi-val">{activeVehicles}</div>
            <div className="pveh-kpi-lbl">Active Vehicles</div>
          </div>
          <div className="pveh-kpi-card info">
            <div className="pveh-kpi-val">{totalCapacityTons.toLocaleString()} <span className="pveh-unit">Tons</span></div>
            <div className="pveh-kpi-lbl">Combined Capacity</div>
          </div>
          <div className="pveh-kpi-card transporters">
            <div className="pveh-kpi-val">{uniqueTransporters}</div>
            <div className="pveh-kpi-lbl">Dedicated Transporters</div>
          </div>
        </div>

        {/* Filters */}
        <div className="pveh-filters">
          <input
            type="text"
            className="pveh-search"
            placeholder="Search by Vehicle #, Transporter, Driver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="pveh-filter-tabs">
            <button
              className={`filter-tab ${statusFilter === "ALL" ? "active" : ""}`}
              onClick={() => setStatusFilter("ALL")}
            >
              All ({totalVehicles})
            </button>
            <button
              className={`filter-tab ${statusFilter === "ACTIVE" ? "active" : ""}`}
              onClick={() => setStatusFilter("ACTIVE")}
            >
              Active ({activeVehicles})
            </button>
            <button
              className={`filter-tab ${statusFilter === "INACTIVE" ? "active" : ""}`}
              onClick={() => setStatusFilter("INACTIVE")}
            >
              Inactive ({totalVehicles - activeVehicles})
            </button>
          </div>
        </div>

        {/* Vehicles Grid / Table */}
        <div className="pveh-card">
          <div className="pveh-card-header">
            <h3>Registered Vehicles ({filteredVehicles.length})</h3>
          </div>
          {filteredVehicles.length === 0 ? (
            <div className="pveh-empty">No vehicles found matching criteria.</div>
          ) : (
            <div className="pveh-table-wrap">
              <table className="pveh-table">
                <thead>
                  <tr>
                    <th>Vehicle Number</th>
                    <th>Type</th>
                    <th>Capacity (Tons)</th>
                    <th>Transporter</th>
                    <th>Default Driver</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((v) => (
                    <tr key={v.id}>
                      <td className="font-bold text-primary">
                        {v.vehicle_number}
                      </td>
                      <td>
                        <span className="type-badge">{v.vehicle_type || "TRUCK"}</span>
                      </td>
                      <td>
                        {v.capacity_tons ? `${v.capacity_tons} MT` : "—"}
                      </td>
                      <td>{v.transporter_name || "Self / Company"}</td>
                      <td>{v.driver_name || "—"}</td>
                      <td>{v.driver_mobile || "—"}</td>
                      <td>
                        <span
                          className={`status-dot ${v.is_active ? "active" : "inactive"}`}
                          onClick={() => handleToggleStatus(v)}
                          title="Click to toggle active status"
                        >
                          {v.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button
                            className="btn-edit"
                            onClick={() => handleOpenEdit(v)}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>{editingVehicle ? "Edit Vehicle" : "Register New Vehicle"}</h2>
              <button className="close-btn" onClick={() => setModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Vehicle Registration Number *</label>
                <input
                  type="text"
                  placeholder="e.g. MH 04 AZ 5678"
                  value={formData.vehicle_number}
                  onChange={(e) =>
                    setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })
                  }
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label>Vehicle Type</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  >
                    <option value="TRUCK">Heavy Truck (10/12 Wheeler)</option>
                    <option value="TEMPO">Tempo / LCV (407 / Canter)</option>
                    <option value="PICKUP">Pickup (Bolero / Dost)</option>
                    <option value="TRAILER">Trailer / 20ft Container</option>
                    <option value="TRACTOR">Tractor Trolley</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="form-col">
                  <label>Capacity (Tons)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 15.5"
                    value={formData.capacity_tons}
                    onChange={(e) => setFormData({ ...formData, capacity_tons: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Transporter Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Shree Ram Logistics (leave blank for self)"
                  value={formData.transporter_name}
                  onChange={(e) => setFormData({ ...formData, transporter_name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label>Primary Driver Name</label>
                  <input
                    type="text"
                    placeholder="Driver's Full Name"
                    value={formData.driver_name}
                    onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                  />
                </div>
                <div className="form-col">
                  <label>Driver Contact Number</label>
                  <input
                    type="text"
                    placeholder="10-digit mobile"
                    value={formData.driver_mobile}
                    onChange={(e) => setFormData({ ...formData, driver_mobile: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Vehicle Notes / RC / Fitness Info</label>
                <textarea
                  rows="2"
                  placeholder="e.g. PUC valid till Dec 2026, Insurance renewed."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                ></textarea>
              </div>

              <div className="checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <span>Active & Available for Dispatches</span>
                </label>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="pveh-btn pveh-btn-outline"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pveh-btn pveh-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : editingVehicle ? "Update Vehicle" : "Register Vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticTransport;
