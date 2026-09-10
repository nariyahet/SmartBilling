import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  KpiCard,
  Card,
  DataTable,
  Modal,
  Button,
  StatusBadge,
} from "../components";
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
    <div className="sb-page-container">
      <PageHeader
        title="Vehicle & Transport Master"
        subtitle="Manage transport vehicles, dedicated trucks, drivers, and capacity for inward & outward dispatches."
        breadcrumbs={[
          { label: "ERP", to: "/plastic-erp" },
          { label: "Sales & Dispatch", to: "/plastic-erp/sales-orders" },
          { label: "Vehicles" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/plastic-erp/dispatches">
              <Button variant="secondary">Dispatches</Button>
            </Link>
            <Link to="/plastic-erp/transport/challans">
              <Button variant="secondary">Delivery Challans</Button>
            </Link>
            <Button variant="primary" onClick={handleOpenCreate}>
              + Register Vehicle
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="sb-kpis-grid" style={{ marginBottom: "24px" }}>
        <KpiCard
          label="Total Fleet"
          value={totalVehicles}
          subtext="Registered vehicles"
          accent="navy"
        />
        <KpiCard
          label="Active Vehicles"
          value={activeVehicles}
          subtext="Available for dispatches"
          accent="teal"
        />
        <KpiCard
          label="Combined Capacity"
          value={`${totalCapacityTons.toLocaleString()} Tons`}
          subtext="Fleet payload capacity"
          accent="blue"
        />
        <KpiCard
          label="Transporters"
          value={uniqueTransporters}
          subtext="Dedicated logistics partners"
          accent="navy"
        />
      </div>

      {/* Filters Bar */}
      <Card noPadding style={{ marginBottom: "24px" }}>
        <div style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", justifyContent: "space-between" }}>
          <input
            type="text"
            className="sb-input"
            style={{ width: "300px", height: "38px" }}
            placeholder="Search by Vehicle #, Transporter, Driver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div style={{ display: "flex", gap: "6px", background: "var(--sb-canvas)", padding: "4px", borderRadius: "8px" }}>
            <button
              type="button"
              className={`pveh-filter-tab ${statusFilter === "ALL" ? "active" : ""}`}
              onClick={() => setStatusFilter("ALL")}
            >
              All ({totalVehicles})
            </button>
            <button
              type="button"
              className={`pveh-filter-tab ${statusFilter === "ACTIVE" ? "active" : ""}`}
              onClick={() => setStatusFilter("ACTIVE")}
            >
              Active ({activeVehicles})
            </button>
            <button
              type="button"
              className={`pveh-filter-tab ${statusFilter === "INACTIVE" ? "active" : ""}`}
              onClick={() => setStatusFilter("INACTIVE")}
            >
              Inactive ({totalVehicles - activeVehicles})
            </button>
          </div>
        </div>

        {/* Vehicles Table */}
        <DataTable
          headers={[
            "Vehicle Number",
            "Type",
            "Capacity (Tons)",
            "Transporter",
            "Default Driver",
            "Contact",
            "Status",
            "Actions",
          ]}
        >
          {filteredVehicles.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                No vehicles found matching criteria.
              </td>
            </tr>
          ) : (
            filteredVehicles.map((v) => (
              <tr key={v.id}>
                <td>
                  <strong style={{ color: "var(--sb-ocean)" }}>{v.vehicle_number}</strong>
                </td>
                <td>
                  <span className="pveh-type-badge">{v.vehicle_type || "TRUCK"}</span>
                </td>
                <td>{v.capacity_tons ? `${v.capacity_tons} MT` : "—"}</td>
                <td>{v.transporter_name || "Self / Company"}</td>
                <td>{v.driver_name || "—"}</td>
                <td>{v.driver_mobile || "—"}</td>
                <td>
                  <span style={{ cursor: "pointer" }} onClick={() => handleToggleStatus(v)}>
                    <StatusBadge status={v.is_active ? "APPROVED" : "CANCELLED"} />
                  </span>
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleOpenEdit(v)}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </Card>

      {/* ADD / EDIT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingVehicle ? "Edit Vehicle" : "Register New Vehicle"}
      >
        <form onSubmit={handleSubmit} className="sb-form">
          <div className="sb-form-group">
            <label className="sb-label">Vehicle Registration Number *</label>
            <input
              type="text"
              className="sb-input"
              placeholder="e.g. MH 04 AZ 5678"
              value={formData.vehicle_number}
              onChange={(e) =>
                setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })
              }
              required
            />
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Vehicle Type</label>
              <select
                className="sb-input"
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

            <div className="sb-form-group">
              <label className="sb-label">Capacity (Tons)</label>
              <input
                type="number"
                step="0.1"
                className="sb-input"
                placeholder="e.g. 15.5"
                value={formData.capacity_tons}
                onChange={(e) => setFormData({ ...formData, capacity_tons: e.target.value })}
              />
            </div>
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Transporter Name (Optional)</label>
            <input
              type="text"
              className="sb-input"
              placeholder="e.g. Shree Ram Logistics (leave blank for self)"
              value={formData.transporter_name}
              onChange={(e) => setFormData({ ...formData, transporter_name: e.target.value })}
            />
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Primary Driver Name</label>
              <input
                type="text"
                className="sb-input"
                placeholder="Driver's Full Name"
                value={formData.driver_name}
                onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
              />
            </div>
            <div className="sb-form-group">
              <label className="sb-label">Driver Contact Number</label>
              <input
                type="text"
                className="sb-input"
                placeholder="10-digit mobile"
                value={formData.driver_mobile}
                onChange={(e) => setFormData({ ...formData, driver_mobile: e.target.value })}
              />
            </div>
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Vehicle Notes / RC / Fitness Info</label>
            <textarea
              className="sb-input"
              rows="2"
              placeholder="e.g. PUC valid till Dec 2026, Insurance renewed."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <span>Active & Available for Dispatches</span>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Saving..." : editingVehicle ? "Update Vehicle" : "Register Vehicle"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PlasticTransport;
