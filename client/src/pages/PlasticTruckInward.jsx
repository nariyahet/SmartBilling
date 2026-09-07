import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticTruckInward.css";

const QUALITY_STATUSES = ["ALL", "PENDING", "ACCEPTED", "REJECTED", "PARTIAL"];

function PlasticTruckInward() {
  const [inwards, setInwards] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuality, setSelectedQuality] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    inward_no: "",
    supplier_id: "",
    material_id: "",
    truck_number: "",
    driver_name: "",
    driver_mobile: "",
    gross_weight: "",
    tare_weight: "",
    rate_per_unit: "",
    inward_date: new Date().toISOString().slice(0, 16),
    quality_status: "PENDING",
    remarks: "",
  });

  const fetchDropdownData = async () => {
    try {
      const [supRes, matRes] = await Promise.all([
        API.get("/suppliers?status=ACTIVE"),
        API.get("/raw-materials?status=ACTIVE"),
      ]);
      if (supRes.data?.success) setSuppliers(supRes.data.suppliers || []);
      if (matRes.data?.success) setRawMaterials(matRes.data.raw_materials || []);
    } catch (err) {
      console.error("Fetch dropdowns error:", err);
    }
  };

  const fetchInwards = async () => {
    try {
      setLoading(true);
      setError("");

      let url = "/truck-inwards";
      const params = new URLSearchParams();
      if (selectedQuality !== "ALL") params.append("quality_status", selectedQuality);
      if (searchTerm.trim()) params.append("search", searchTerm.trim());

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await API.get(url);
      if (res.data?.success) {
        setInwards(res.data.truck_inwards || []);
      }
    } catch (err) {
      console.error("Fetch truck inwards error:", err);
      setError(err.response?.data?.message || "Failed to load truck inwards.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDropdownData();
    fetchInwards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuality]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInwards();
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      inward_no: "",
      supplier_id: suppliers.length > 0 ? suppliers[0].id : "",
      material_id: rawMaterials.length > 0 ? rawMaterials[0].id : "",
      truck_number: "",
      driver_name: "",
      driver_mobile: "",
      gross_weight: "",
      tare_weight: "",
      rate_per_unit: rawMaterials.length > 0 ? rawMaterials[0].default_purchase_rate || 40 : 40,
      inward_date: new Date().toISOString().slice(0, 16),
      quality_status: "PENDING",
      remarks: "",
    });
    setIsModalOpen(true);
    setError("");
  };

  const handleOpenEditModal = (ti) => {
    setEditingId(ti.id);
    setFormData({
      inward_no: ti.inward_no || "",
      supplier_id: ti.supplier_id || "",
      material_id: ti.material_id || "",
      truck_number: ti.truck_number || "",
      driver_name: ti.driver_name || "",
      driver_mobile: ti.driver_mobile || "",
      gross_weight: ti.gross_weight || "",
      tare_weight: ti.tare_weight || "",
      rate_per_unit: ti.rate_per_unit || "",
      inward_date: ti.inward_date ? new Date(ti.inward_date).toISOString().slice(0, 16) : "",
      quality_status: ti.quality_status || "PENDING",
      remarks: ti.remarks || "",
    });
    setIsModalOpen(true);
    setError("");
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // If user changes raw material, auto-fill default purchase rate
    if (name === "material_id") {
      const selected = rawMaterials.find((m) => String(m.id) === String(value));
      if (selected && selected.default_purchase_rate) {
        setFormData((prev) => ({ ...prev, rate_per_unit: selected.default_purchase_rate }));
      }
    }
  };

  // Live client-side calculated helpers
  const gross = Number(formData.gross_weight) || 0;
  const tare = Number(formData.tare_weight) || 0;
  const net = gross >= tare ? gross - tare : 0;
  const rate = Number(formData.rate_per_unit) || 0;
  const totalAmount = net * rate;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier_id) {
      alert("Please select a scrap supplier.");
      return;
    }
    if (!formData.material_id) {
      alert("Please select a raw material.");
      return;
    }
    if (!formData.truck_number.trim()) {
      alert("Truck number is required.");
      return;
    }
    if (gross < tare) {
      alert("Gross weight must be greater than or equal to tare weight.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...formData,
        gross_weight: gross,
        tare_weight: tare,
        rate_per_unit: rate,
      };

      if (editingId) {
        await API.put(`/truck-inwards/${editingId}`, payload);
        setSuccessMsg("Truck inward updated successfully! ✅");
      } else {
        await API.post("/truck-inwards", payload);
        setSuccessMsg("Truck inward logged successfully! ✅");
      }

      setIsModalOpen(false);
      await fetchInwards();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Save inward error:", err);
      alert(err.response?.data?.message || "Failed to save truck inward.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="plastic-inward-page">
      <PlasticNavbar />

      <main className="plastic-content-wrap">
        <div className="page-title-row">
          <div>
            <h1>🚚 Truck Inward Registry</h1>
            <p>Log incoming scrap delivery vehicles, assign suppliers & polymers, and capture initial weighment scale data</p>
          </div>

          <div className="title-actions">
            <Link to="/plastic-erp" className="btn-dashboard-nav">
              📊 ERP Dashboard
            </Link>
            <button type="button" className="btn-add-entity" onClick={handleOpenAddModal}>
              ➕ Log New Truck Inward
            </button>
          </div>
        </div>

        {error && <div className="alert-box error">{error}</div>}
        {successMsg && <div className="alert-box success">{successMsg}</div>}

        {/* Filter Controls */}
        <div className="filter-card">
          <form className="search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search by inward slip, truck no, supplier, or material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="btn-search">
              🔍 Search
            </button>
            {searchTerm && (
              <button
                type="button"
                className="btn-clear"
                onClick={() => {
                  setSearchTerm("");
                  fetchInwards();
                }}
              >
                Clear
              </button>
            )}
          </form>

          <div className="status-toggle-wrap">
            <span>Quality Status:</span>
            {QUALITY_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                className={`filter-chip ${selectedQuality === st ? "active" : ""}`}
                onClick={() => setSelectedQuality(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Inward List Table */}
        {loading ? (
          <LoadingScreen title="Loading Truck Inwards..." subtitle="Retrieving inbound logistics..." />
        ) : inwards.length === 0 ? (
          <div className="empty-state-box">
            <span className="empty-icon">🚚</span>
            <h3>No Truck Inwards Logged</h3>
            <p>Record your first scrap vehicle arrival at the Kim plant gate.</p>
            <button type="button" className="btn-add-entity" onClick={handleOpenAddModal}>
              ➕ Log Truck Inward Now
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Inward No</th>
                  <th>Date & Time</th>
                  <th>Truck & Driver</th>
                  <th>Supplier</th>
                  <th>Material / Polymer</th>
                  <th>Weight (Gross / Tare / Net)</th>
                  <th>Rate & Valuation</th>
                  <th>Quality</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inwards.map((ti) => (
                  <tr key={ti.id}>
                    <td>
                      <span className="code-pill">{ti.inward_no}</span>
                    </td>
                    <td>
                      <span className="date-text">
                        {new Date(ti.inward_date || ti.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <small className="time-subtext">
                        {new Date(ti.inward_date || ti.created_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </td>
                    <td>
                      <strong className="truck-number-badge">🚛 {ti.truck_number}</strong>
                      {ti.driver_name && (
                        <span className="driver-subtext">
                          Driver: {ti.driver_name} {ti.driver_mobile ? `(${ti.driver_mobile})` : ""}
                        </span>
                      )}
                    </td>
                    <td>
                      <strong className="entity-primary-name">{ti.supplier_name}</strong>
                      <span className="entity-subtext">{ti.supplier_code}</span>
                    </td>
                    <td>
                      <span className="entity-primary-name">{ti.material_name}</span>
                      <span className={`polymer-badge ${String(ti.plastic_type).toLowerCase()}`}>
                        {ti.plastic_type}
                      </span>
                    </td>
                    <td>
                      <div className="weight-stack">
                        <span>Gross: {Number(ti.gross_weight || 0).toLocaleString("en-IN")} KG</span>
                        <span>Tare: {Number(ti.tare_weight || 0).toLocaleString("en-IN")} KG</span>
                        <strong className="net-weight-highlight">
                          Net: {Number(ti.net_weight || 0).toLocaleString("en-IN")} KG
                        </strong>
                      </div>
                    </td>
                    <td>
                      <div className="rate-col">
                        <span>₹{Number(ti.rate_per_unit || 0).toFixed(2)}/KG</span>
                        <strong>₹{Number(ti.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                      </div>
                    </td>
                    <td>
                      <span className={`quality-badge ${String(ti.quality_status).toLowerCase()}`}>
                        {ti.quality_status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons-cell">
                        <button
                          type="button"
                          className="btn-edit"
                          onClick={() => handleOpenEditModal(ti)}
                          title="Edit Inward Details"
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Log / Edit Truck Inward Modal */}
      {isModalOpen && (
        <div className="plastic-modal-backdrop" onClick={handleCloseModal}>
          <div className="plastic-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? "✏️ Edit Truck Inward" : "➕ Log Inbound Scrap Truck"}</h2>
              <button type="button" className="btn-close-modal" onClick={handleCloseModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="plastic-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Inward Slip No (Optional / Auto)</label>
                  <input
                    type="text"
                    name="inward_no"
                    placeholder="e.g. TI-1001"
                    value={formData.inward_no}
                    onChange={handleFormChange}
                    disabled={!!editingId}
                  />
                  <small className="help-text">Leave blank to auto-generate sequentially</small>
                </div>

                <div className="form-group">
                  <label>Arrival Date & Time</label>
                  <input
                    type="datetime-local"
                    name="inward_date"
                    value={formData.inward_date}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Scrap Supplier *</label>
                  <select name="supplier_id" value={formData.supplier_id} onChange={handleFormChange} required>
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_name} ({s.supplier_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Raw Material Scrap Grade *</label>
                  <select name="material_id" value={formData.material_id} onChange={handleFormChange} required>
                    <option value="">-- Select Raw Material --</option>
                    {rawMaterials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.material_name} [{m.plastic_type}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label>Truck Number *</label>
                  <input
                    type="text"
                    name="truck_number"
                    placeholder="e.g. GJ-05-BX-1024"
                    value={formData.truck_number}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Driver Name</label>
                  <input
                    type="text"
                    name="driver_name"
                    placeholder="e.g. Rameshbhai"
                    value={formData.driver_name}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group">
                  <label>Driver Mobile</label>
                  <input
                    type="tel"
                    name="driver_mobile"
                    placeholder="e.g. 9825012345"
                    value={formData.driver_mobile}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              {/* Weight & Valuation Section */}
              <div className="calc-summary-card">
                <h3>⚖️ Scale Weighment & Rate Preview</h3>
                <div className="form-row-3">
                  <div className="form-group">
                    <label>Gross Weight (KG)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="gross_weight"
                      placeholder="e.g. 15400"
                      value={formData.gross_weight}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Tare Weight (KG)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="tare_weight"
                      placeholder="e.g. 5400"
                      value={formData.tare_weight}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Agreed Rate (₹/KG)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="rate_per_unit"
                      placeholder="e.g. 42.50"
                      value={formData.rate_per_unit}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>

                <div className="live-weight-preview-bar">
                  <div>
                    <span>Calculated Net Weight:</span>
                    <strong className="highlight-green">{net.toLocaleString("en-IN")} KG</strong>
                  </div>
                  <div>
                    <span>Estimated Valuation:</span>
                    <strong className="highlight-blue">
                      ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Initial Quality Status</label>
                  <select name="quality_status" value={formData.quality_status} onChange={handleFormChange}>
                    <option value="PENDING">PENDING (Awaiting inspection)</option>
                    <option value="ACCEPTED">ACCEPTED (Verified scrap grade)</option>
                    <option value="PARTIAL">PARTIAL (Partial deduction/moisture)</option>
                    <option value="REJECTED">REJECTED (Contaminated)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Quality & Scale Remarks</label>
                  <input
                    type="text"
                    name="remarks"
                    placeholder="Moisture %, dust deduction, or gate notes"
                    value={formData.remarks}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Log Truck Inward"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticTruckInward;
