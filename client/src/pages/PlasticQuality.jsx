import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticQuality.css";

function PlasticQuality() {
  const [inspections, setInspections] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState({
    qc_type: "IN_PROCESS",
    batch_id: "",
    sample_size: "1.0",
    unit: "KG",
    inspector_name: "",
    overall_status: "PASSED",
    rejection_reason: "",
    remarks: "",
    parameters: [
      { parameter_name: "Color Uniformity", expected_value: "Natural White", observed_value: "Natural White", status: "PASS" },
      { parameter_name: "Moisture Content", expected_value: "< 0.05%", observed_value: "0.02%", status: "PASS" },
      { parameter_name: "Melt Flow Index (MFI)", expected_value: "10-12 g/10min", observed_value: "11.5 g/10min", status: "PASS" },
      { parameter_name: "Foreign Contamination", expected_value: "0%", observed_value: "0%", status: "PASS" },
    ],
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [qcRes, batchesRes] = await Promise.allSettled([
        API.get("/plastic-erp/quality/inspections"),
        API.get("/plastic-erp/production/batches"),
      ]);

      if (qcRes.status === "fulfilled") setInspections(qcRes.value.data.inspections || []);
      if (batchesRes.status === "fulfilled") setBatches(batchesRes.value.data.batches || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load QC inspections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const viewDetails = async (id) => {
    try {
      const res = await API.get(`/plastic-erp/quality/inspections/${id}`);
      setSelectedInspection(res.data.inspection);
    } catch {
      setError("Failed to fetch inspection details.");
    }
  };

  const handleParamChange = (index, field, value) => {
    const updated = [...formData.parameters];
    updated[index][field] = value;
    setFormData({ ...formData, parameters: updated });
  };

  const handleAddParam = () => {
    setFormData({
      ...formData,
      parameters: [
        ...formData.parameters,
        { parameter_name: "", expected_value: "", observed_value: "", status: "PASS" },
      ],
    });
  };

  const handleRemoveParam = (index) => {
    const updated = formData.parameters.filter((_, i) => i !== index);
    setFormData({ ...formData, parameters: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/quality/inspections", formData);
      setSuccessMsg("Quality inspection recorded successfully!");
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to record QC inspection.");
    }
  };

  const filteredInspections = inspections.filter((i) => {
    if (typeFilter === "ALL") return true;
    return i.qc_type === typeFilter;
  });

  const passedCount = inspections.filter((i) => i.overall_status === "PASSED").length;
  const pendingCount = inspections.filter((i) => i.overall_status === "PENDING").length;
  const rejectedCount = inspections.filter((i) => i.overall_status === "REJECTED").length;
  const rejectionRate = inspections.length > 0 ? ((rejectedCount / inspections.length) * 100).toFixed(1) : "0.0";

  if (loading) return <LoadingScreen message="Loading Quality Control..." />;

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />

      <div className="plastic-content-wrap">
        <div className="plastic-page-header">
          <div>
            <h1 className="plastic-page-title">🔬 Quality Control (QC)</h1>
            <p className="plastic-page-subtitle">Inspection Workflows, Parameter Tests & Defect Tracking</p>
          </div>

          <div className="plastic-page-actions">
            <Link to="/plastic-erp" className="btn-dashboard-nav">
              📊 ERP Dashboard
            </Link>
            <button type="button" className="btn-primary" onClick={() => setShowCreateModal(true)}>
              ➕ Record QC Inspection
            </button>
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

        {/* QC KPI Cards */}
        <div className="qc-kpi-grid">
          <div className="qc-card">
            <span className="qc-label">Total Inspections</span>
            <strong className="qc-val">{inspections.length}</strong>
            <span className="qc-sub">Incoming, in-process, & FG</span>
          </div>
          <div className="qc-card">
            <span className="qc-label">Passed Tests</span>
            <strong className="qc-val text-green">{passedCount}</strong>
            <span className="qc-sub">Approved for next stage</span>
          </div>
          <div className="qc-card">
            <span className="qc-label">Pending Reviews</span>
            <strong className="qc-val text-yellow">{pendingCount}</strong>
            <span className="qc-sub">Under lab analysis</span>
          </div>
          <div className="qc-card">
            <span className="qc-label">Rejection Rate</span>
            <strong className="qc-val text-red">{rejectionRate}%</strong>
            <span className="qc-sub">{rejectedCount} lots rejected</span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="qc-filter-pills">
          {["ALL", "INCOMING", "IN_PROCESS", "FINISHED_GOODS"].map((type) => (
            <button
              key={type}
              type="button"
              className={`pill-btn ${typeFilter === type ? "active" : ""}`}
              onClick={() => setTypeFilter(type)}
            >
              {type.replace("_", " ")} ({type === "ALL" ? inspections.length : inspections.filter((i) => i.qc_type === type).length})
            </button>
          ))}
        </div>

        <div className="plastic-card">
          <div className="table-responsive">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Inspection No</th>
                  <th>QC Type</th>
                  <th>Linked Batch / Source</th>
                  <th>Sample Size</th>
                  <th>Date</th>
                  <th>Inspector</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInspections.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-cell">No QC inspections recorded for this category.</td>
                  </tr>
                ) : (
                  filteredInspections.map((qc) => (
                    <tr key={qc.id}>
                      <td><strong>{qc.inspection_no}</strong></td>
                      <td>
                        <span className="qc-type-badge">{qc.qc_type}</span>
                      </td>
                      <td>{qc.batch_no ? `Batch ${qc.batch_no}` : qc.supplier_name ? `Supplier ${qc.supplier_name}` : "General"}</td>
                      <td>{qc.sample_size} {qc.unit}</td>
                      <td>{qc.inspection_date?.split("T")[0]}</td>
                      <td>{qc.inspector_name || "Quality Lab"}</td>
                      <td>
                        <span className={`badge qc-${qc.overall_status?.toLowerCase()}`}>
                          {qc.overall_status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-view-details"
                          onClick={() => viewDetails(qc.id)}
                        >
                          Parameters 📋
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL: VIEW QC DETAILS */}
        {selectedInspection && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal large">
              <div className="modal-header">
                <h3>QC Inspection: {selectedInspection.inspection_no}</h3>
                <button type="button" onClick={() => setSelectedInspection(null)}>✕</button>
              </div>
              <div className="modal-body-padding">
                <div className="recipe-summary-box">
                  <div className="detail-row">
                    <span>Inspection Type:</span>
                    <strong>{selectedInspection.qc_type}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Overall Decision:</span>
                    <strong className={`badge qc-${selectedInspection.overall_status?.toLowerCase()}`}>
                      {selectedInspection.overall_status}
                    </strong>
                  </div>
                  {selectedInspection.rejection_reason && (
                    <div className="detail-row">
                      <span>Rejection Reason:</span>
                      <strong className="text-red">{selectedInspection.rejection_reason}</strong>
                    </div>
                  )}
                </div>

                <h4>Tested Quality Parameters</h4>
                <table className="plastic-table">
                  <thead>
                    <tr>
                      <th>Parameter Name</th>
                      <th>Expected Spec</th>
                      <th>Observed Value</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInspection.results?.map((res) => (
                      <tr key={res.id}>
                        <td><strong>{res.parameter_name}</strong></td>
                        <td>{res.expected_value || "Standard"}</td>
                        <td>{res.observed_value}</td>
                        <td>
                          <span className={`badge ${res.status === "PASS" ? "qc-passed" : "qc-rejected"}`}>
                            {res.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setSelectedInspection(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: RECORD QC INSPECTION */}
        {showCreateModal && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal large">
              <div className="modal-header">
                <h3>Record Quality Inspection</h3>
                <button type="button" onClick={() => setShowCreateModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSubmit} className="modal-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Inspection Stage / Type</label>
                    <select
                      value={formData.qc_type}
                      onChange={(e) => setFormData({ ...formData, qc_type: e.target.value })}
                    >
                      <option value="INCOMING">Incoming Raw Material QC</option>
                      <option value="IN_PROCESS">In-Process Extrusion QC</option>
                      <option value="FINISHED_GOODS">Finished Goods Final QC</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Linked Production Batch</label>
                    <select
                      value={formData.batch_id}
                      onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                    >
                      <option value="">Select Batch (Optional)</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>{b.batch_no} - {b.product_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Inspector Name</label>
                    <input
                      type="text"
                      value={formData.inspector_name}
                      onChange={(e) => setFormData({ ...formData, inspector_name: e.target.value })}
                      placeholder="e.g. QC Tech Hitesh"
                    />
                  </div>

                  <div className="form-group">
                    <label>Overall Status *</label>
                    <select
                      value={formData.overall_status}
                      onChange={(e) => setFormData({ ...formData, overall_status: e.target.value })}
                    >
                      <option value="PASSED">Passed (Approved)</option>
                      <option value="HOLD">Hold (Further Testing)</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="REWORK">Needs Rework</option>
                    </select>
                  </div>
                </div>

                {formData.overall_status === "REJECTED" && (
                  <div className="form-group">
                    <label>Rejection Reason *</label>
                    <input
                      type="text"
                      required
                      value={formData.rejection_reason}
                      onChange={(e) => setFormData({ ...formData, rejection_reason: e.target.value })}
                      placeholder="e.g. High moisture content or black contamination specs"
                    />
                  </div>
                )}

                {/* Parameters Checklist */}
                <div className="bom-builder-section">
                  <div className="bom-header-row">
                    <h4>Evaluation Parameters</h4>
                  </div>

                  {formData.parameters.map((p, idx) => (
                    <div key={idx} className="bom-item-row">
                      <input
                        type="text"
                        required
                        placeholder="Parameter Name"
                        value={p.parameter_name}
                        onChange={(e) => handleParamChange(idx, "parameter_name", e.target.value)}
                        className="material-select"
                      />

                      <input
                        type="text"
                        placeholder="Expected Spec"
                        value={p.expected_value}
                        onChange={(e) => handleParamChange(idx, "expected_value", e.target.value)}
                        className="material-name-input"
                      />

                      <input
                        type="text"
                        required
                        placeholder="Observed Value"
                        value={p.observed_value}
                        onChange={(e) => handleParamChange(idx, "observed_value", e.target.value)}
                        className="material-name-input"
                      />

                      <select
                        value={p.status}
                        onChange={(e) => handleParamChange(idx, "status", e.target.value)}
                        style={{ width: "90px" }}
                      >
                        <option value="PASS">PASS</option>
                        <option value="FAIL">FAIL</option>
                      </select>

                      <button
                        type="button"
                        className="btn-remove-row"
                        onClick={() => handleRemoveParam(idx)}
                        disabled={formData.parameters.length <= 1}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button type="button" className="btn-add-row" onClick={handleAddParam}>
                    ➕ Add Inspection Parameter
                  </button>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Record Inspection
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

export default PlasticQuality;
