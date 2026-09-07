import { useEffect, useState } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticWeighment.css";

function PlasticWeighment() {
  const [weighments, setWeighments] = useState([]);
  const [inwards, setInwards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [viewSlip, setViewSlip] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    weighment_no: "",
    truck_inward_id: "",
    truck_number: "",
    first_weight: "",
    second_weight: "",
    weighing_date: new Date().toISOString().slice(0, 16),
    operator_name: "",
    remarks: "",
  });

  const fetchInwards = async () => {
    try {
      const res = await API.get("/truck-inwards");
      if (res.data?.success) {
        setInwards(res.data.truck_inwards || []);
      }
    } catch (err) {
      console.error("Fetch inwards error:", err);
    }
  };

  const fetchWeighments = async () => {
    try {
      setLoading(true);
      setError("");

      let url = "/weighments";
      if (searchTerm.trim()) {
        url += `?search=${encodeURIComponent(searchTerm.trim())}`;
      }

      const res = await API.get(url);
      if (res.data?.success) {
        setWeighments(res.data.weighments || []);
      }
    } catch (err) {
      console.error("Fetch weighments error:", err);
      setError(err.response?.data?.message || "Failed to load weighment records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInwards();
    fetchWeighments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchWeighments();
  };

  const handleOpenRecordModal = () => {
    setFormData({
      weighment_no: "",
      truck_inward_id: inwards.length > 0 ? inwards[0].id : "",
      truck_number: inwards.length > 0 ? inwards[0].truck_number : "",
      first_weight: inwards.length > 0 ? inwards[0].gross_weight || "" : "",
      second_weight: inwards.length > 0 ? inwards[0].tare_weight || "" : "",
      weighing_date: new Date().toISOString().slice(0, 16),
      operator_name: "Scale Operator",
      remarks: "",
    });
    setIsRecordModalOpen(true);
    setError("");
  };

  const handleInwardSelectionChange = (e) => {
    const inwardId = e.target.value;
    const selected = inwards.find((i) => String(i.id) === String(inwardId));
    setFormData((prev) => ({
      ...prev,
      truck_inward_id: inwardId,
      truck_number: selected ? selected.truck_number : "",
      first_weight: selected ? selected.gross_weight || "" : "",
      second_weight: selected ? selected.tare_weight || "" : "",
    }));
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const w1 = Number(formData.first_weight) || 0;
  const w2 = Number(formData.second_weight) || 0;
  const netWeightPreview = Math.abs(w1 - w2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.truck_inward_id) {
      alert("Please select a linked truck inward record.");
      return;
    }
    if (w1 <= 0) {
      alert("1st Weight (Gross) must be a positive number.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...formData,
        first_weight: w1,
        second_weight: w2,
      };

      await API.post("/weighments", payload);
      setSuccessMsg("Weighbridge slip generated successfully! ✅");
      setIsRecordModalOpen(false);
      await fetchWeighments();
      await fetchInwards();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Save weighment error:", err);
      alert(err.response?.data?.message || "Failed to record weighment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="plastic-weighment-page">
      <PlasticNavbar />

      <main className="plastic-content-wrap">
        <div className="page-title-row">
          <div>
            <h1>⚖️ Weighment Scale House Slips</h1>
            <p>Dual-slip manual gross & tare weighbridge records for Kim scrap recycling operations</p>
          </div>

          <button type="button" className="btn-add-entity" onClick={handleOpenRecordModal}>
            ➕ Record Weighment Slip
          </button>
        </div>

        {error && <div className="alert-box error">{error}</div>}
        {successMsg && <div className="alert-box success">{successMsg}</div>}

        {/* Search */}
        <div className="filter-card">
          <form className="search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search by weighment no, truck no, operator, or inward slip..."
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
                  fetchWeighments();
                }}
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Weighments Table */}
        {loading ? (
          <LoadingScreen title="Loading Weighbridge Slips..." subtitle="Retrieving scale records..." />
        ) : weighments.length === 0 ? (
          <div className="empty-state-box">
            <span className="empty-icon">⚖️</span>
            <h3>No Weighment Slips Recorded</h3>
            <p>Generate a gross/tare dual weighment ticket for an incoming scrap truck.</p>
            <button type="button" className="btn-add-entity" onClick={handleOpenRecordModal}>
              ➕ Record Weighment Now
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Slip No</th>
                  <th>Date & Time</th>
                  <th>Inward Ref</th>
                  <th>Truck Number</th>
                  <th>1st Weight (Gross)</th>
                  <th>2nd Weight (Tare)</th>
                  <th>Net Weight</th>
                  <th>Operator</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {weighments.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <span className="code-pill">{w.weighment_no}</span>
                    </td>
                    <td>
                      <span className="date-text">
                        {new Date(w.weighing_date || w.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <small className="time-subtext">
                        {new Date(w.weighing_date || w.created_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </td>
                    <td>
                      <span className="inward-ref-pill">TI: {w.inward_no}</span>
                    </td>
                    <td>
                      <strong className="truck-number-badge">🚛 {w.truck_number}</strong>
                    </td>
                    <td>
                      <span>{Number(w.first_weight || 0).toLocaleString("en-IN")} KG</span>
                    </td>
                    <td>
                      <span>{Number(w.second_weight || 0).toLocaleString("en-IN")} KG</span>
                    </td>
                    <td>
                      <strong className="net-weight-highlight">
                        {Number(w.net_weight || 0).toLocaleString("en-IN")} KG
                      </strong>
                    </td>
                    <td>
                      <span className="operator-tag">👤 {w.operator_name || "Scale Operator"}</span>
                    </td>
                    <td>
                      <div className="action-buttons-cell">
                        <button
                          type="button"
                          className="btn-view-slip"
                          onClick={() => setViewSlip(w)}
                          title="View / Print Weighment Ticket"
                        >
                          📄 View Slip
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

      {/* Record Weighment Modal */}
      {isRecordModalOpen && (
        <div className="plastic-modal-backdrop" onClick={() => setIsRecordModalOpen(false)}>
          <div className="plastic-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Record Weighbridge Dual Weighment</h2>
              <button type="button" className="btn-close-modal" onClick={() => setIsRecordModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="plastic-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Weighment Slip No (Optional / Auto)</label>
                  <input
                    type="text"
                    name="weighment_no"
                    placeholder="e.g. WT-1001"
                    value={formData.weighment_no}
                    onChange={handleFormChange}
                  />
                  <small className="help-text">Leave blank to auto-generate</small>
                </div>

                <div className="form-group">
                  <label>Weighing Date & Time</label>
                  <input
                    type="datetime-local"
                    name="weighing_date"
                    value={formData.weighing_date}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Link Inward Truck Record *</label>
                  <select
                    name="truck_inward_id"
                    value={formData.truck_inward_id}
                    onChange={handleInwardSelectionChange}
                    required
                  >
                    <option value="">-- Select Inbound Truck --</option>
                    {inwards.map((ti) => (
                      <option key={ti.id} value={ti.id}>
                        {ti.inward_no} • {ti.truck_number} ({ti.supplier_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Truck Number</label>
                  <input
                    type="text"
                    name="truck_number"
                    value={formData.truck_number}
                    onChange={handleFormChange}
                    required
                  />
                </div>
              </div>

              {/* Scale Weights Entry */}
              <div className="calc-summary-card">
                <h3>⚖️ Scale Readings (Weighbridge Scale 1)</h3>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>1st Weight - Loaded Gross (KG) *</label>
                    <input
                      type="number"
                      step="0.01"
                      name="first_weight"
                      placeholder="e.g. 18250"
                      value={formData.first_weight}
                      onChange={handleFormChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>2nd Weight - Empty Tare (KG)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="second_weight"
                      placeholder="e.g. 6250"
                      value={formData.second_weight}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>

                <div className="live-weight-preview-bar">
                  <span>Calculated Net Scrap Weight:</span>
                  <strong className="highlight-green">{netWeightPreview.toLocaleString("en-IN")} KG</strong>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Scale Operator Name</label>
                  <input
                    type="text"
                    name="operator_name"
                    placeholder="Operator name"
                    value={formData.operator_name}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group">
                  <label>Remarks / Scale Condition</label>
                  <input
                    type="text"
                    name="remarks"
                    placeholder="Weighbridge calibration normal"
                    value={formData.remarks}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsRecordModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? "Recording..." : "Generate Weighment Slip"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View / Print Weighment Slip Modal */}
      {viewSlip && (
        <div className="plastic-modal-backdrop" onClick={() => setViewSlip(null)}>
          <div className="slip-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="slip-paper">
              <div className="slip-header">
                <h2>SMARTBILLING PLASTIC RECYCLING</h2>
                <p>KIM INDUSTRIAL AREA, SURAT, GUJARAT</p>
                <div className="slip-badge">WEIGHBRIDGE RECEIPT SLIP</div>
              </div>

              <div className="slip-grid">
                <div>
                  <span className="slip-label">Slip Number:</span>
                  <strong>{viewSlip.weighment_no}</strong>
                </div>
                <div>
                  <span className="slip-label">Date & Time:</span>
                  <strong>{new Date(viewSlip.weighing_date || viewSlip.created_at).toLocaleString("en-IN")}</strong>
                </div>
                <div>
                  <span className="slip-label">Truck Number:</span>
                  <strong>{viewSlip.truck_number}</strong>
                </div>
                <div>
                  <span className="slip-label">Inward Slip Ref:</span>
                  <strong>{viewSlip.inward_no}</strong>
                </div>
              </div>

              <div className="slip-weights-table">
                <div className="slip-weight-row">
                  <span>Gross Weight (Loaded):</span>
                  <strong>{Number(viewSlip.first_weight || 0).toLocaleString("en-IN")} KG</strong>
                </div>
                <div className="slip-weight-row">
                  <span>Tare Weight (Empty):</span>
                  <strong>{Number(viewSlip.second_weight || 0).toLocaleString("en-IN")} KG</strong>
                </div>
                <div className="slip-weight-row net-row">
                  <span>NET SCRAP WEIGHT:</span>
                  <strong className="slip-net-val">{Number(viewSlip.net_weight || 0).toLocaleString("en-IN")} KG</strong>
                </div>
              </div>

              <div className="slip-footer">
                <div>
                  <span className="slip-label">Weighed By:</span>
                  <span>{viewSlip.operator_name || "Scale Operator"}</span>
                </div>
                <div className="signature-line">
                  <span>Authorized Signature</span>
                </div>
              </div>
            </div>

            <div className="slip-modal-actions">
              <button type="button" className="btn-print" onClick={() => window.print()}>
                🖨️ Print Slip
              </button>
              <button type="button" className="btn-cancel" onClick={() => setViewSlip(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticWeighment;
