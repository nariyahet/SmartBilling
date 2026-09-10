import { useEffect, useState, useCallback } from "react";
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
  AlertBanner,
} from "../components";
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
    <div className="sb-page-container">
      <PageHeader
        title="Quality Control (QC)"
        subtitle="Inspection Workflows, Parameter Tests & Defect Tracking"
        breadcrumbs={[
          { label: "ERP", to: "/plastic-erp" },
          { label: "Production", to: "/plastic-erp/production" },
          { label: "Quality Control" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/plastic-erp">
              <Button variant="secondary">ERP Dashboard</Button>
            </Link>
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              + Record QC Inspection
            </Button>
          </div>
        }
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg("")} />}

      {/* QC KPI Cards */}
      <div className="sb-kpis-grid" style={{ marginBottom: "24px" }}>
        <KpiCard
          label="Total Inspections"
          value={inspections.length}
          subtext="Incoming, in-process, & FG"
          accent="blue"
        />
        <KpiCard
          label="Passed Tests"
          value={passedCount}
          subtext="Approved for next stage"
          accent="teal"
        />
        <KpiCard
          label="Pending Reviews"
          value={pendingCount}
          subtext="Under lab analysis"
          accent="navy"
        />
        <KpiCard
          label="Rejection Rate"
          value={`${rejectionRate}%`}
          subtext={`${rejectedCount} lots rejected`}
          accent={rejectedCount > 0 ? "danger" : "teal"}
        />
      </div>

      {/* Filter Pills */}
      <div className="qc-filter-pills">
        {["ALL", "INCOMING", "IN_PROCESS", "FINISHED_GOODS"].map((type) => (
          <button
            key={type}
            type="button"
            className={`qc-pill-btn ${typeFilter === type ? "active" : ""}`}
            onClick={() => setTypeFilter(type)}
          >
            {type.replace("_", " ")} ({type === "ALL" ? inspections.length : inspections.filter((i) => i.qc_type === type).length})
          </button>
        ))}
      </div>

      <Card noPadding>
        <DataTable
          headers={[
            "Inspection No",
            "QC Type",
            "Linked Batch / Source",
            "Sample Size",
            "Date",
            "Inspector",
            "Status",
            "Actions",
          ]}
        >
          {filteredInspections.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                No QC inspections recorded for this category.
              </td>
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
                  <StatusBadge status={qc.overall_status} />
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => viewDetails(qc.id)}
                  >
                    Parameters 📋
                  </Button>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </Card>

      {/* MODAL: VIEW QC DETAILS */}
      <Modal
        isOpen={!!selectedInspection}
        onClose={() => setSelectedInspection(null)}
        title={`QC Inspection: ${selectedInspection?.inspection_no || ""}`}
      >
        {selectedInspection && (
          <div>
            <div className="qc-summary-box">
              <div className="qc-detail-row">
                <span>Inspection Type:</span>
                <strong>{selectedInspection.qc_type}</strong>
              </div>
              <div className="qc-detail-row">
                <span>Overall Decision:</span>
                <StatusBadge status={selectedInspection.overall_status} />
              </div>
              {selectedInspection.rejection_reason && (
                <div className="qc-detail-row">
                  <span>Rejection Reason:</span>
                  <strong style={{ color: "var(--sb-danger)" }}>{selectedInspection.rejection_reason}</strong>
                </div>
              )}
            </div>

            <h4 style={{ margin: "20px 0 12px 0", color: "var(--sb-navy)", fontSize: "14px", fontWeight: 700 }}>
              Tested Quality Parameters
            </h4>
            <DataTable
              headers={["Parameter Name", "Expected Spec", "Observed Value", "Result"]}
            >
              {selectedInspection.results?.map((res) => (
                <tr key={res.id}>
                  <td><strong>{res.parameter_name}</strong></td>
                  <td>{res.expected_value || "Standard"}</td>
                  <td>{res.observed_value}</td>
                  <td>
                    <StatusBadge status={res.status === "PASS" ? "PASSED" : "REJECTED"} />
                  </td>
                </tr>
              ))}
            </DataTable>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
              <Button type="button" variant="secondary" onClick={() => setSelectedInspection(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: RECORD QC INSPECTION */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Record Quality Inspection"
      >
        <form onSubmit={handleSubmit} className="sb-form">
          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Inspection Stage / Type</label>
              <select
                className="sb-input"
                value={formData.qc_type}
                onChange={(e) => setFormData({ ...formData, qc_type: e.target.value })}
              >
                <option value="INCOMING">Incoming Raw Material QC</option>
                <option value="IN_PROCESS">In-Process Extrusion QC</option>
                <option value="FINISHED_GOODS">Finished Goods Final QC</option>
              </select>
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Linked Production Batch</label>
              <select
                className="sb-input"
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

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Inspector Name</label>
              <input
                type="text"
                className="sb-input"
                value={formData.inspector_name}
                onChange={(e) => setFormData({ ...formData, inspector_name: e.target.value })}
                placeholder="e.g. QC Tech Hitesh"
              />
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Overall Status *</label>
              <select
                className="sb-input"
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
            <div className="sb-form-group">
              <label className="sb-label">Rejection Reason *</label>
              <input
                type="text"
                required
                className="sb-input"
                value={formData.rejection_reason}
                onChange={(e) => setFormData({ ...formData, rejection_reason: e.target.value })}
                placeholder="e.g. High moisture content or black contamination specs"
              />
            </div>
          )}

          {/* Parameters Checklist */}
          <div style={{ marginTop: "16px", border: "1px solid var(--sb-border)", borderRadius: "8px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--sb-navy)", fontWeight: 700 }}>
              Evaluation Parameters
            </h4>

            {formData.parameters.map((p, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1.5fr 1fr auto", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  required
                  placeholder="Parameter Name"
                  value={p.parameter_name}
                  onChange={(e) => handleParamChange(idx, "parameter_name", e.target.value)}
                  className="sb-input"
                />

                <input
                  type="text"
                  placeholder="Expected Spec"
                  value={p.expected_value}
                  onChange={(e) => handleParamChange(idx, "expected_value", e.target.value)}
                  className="sb-input"
                />

                <input
                  type="text"
                  required
                  placeholder="Observed Value"
                  value={p.observed_value}
                  onChange={(e) => handleParamChange(idx, "observed_value", e.target.value)}
                  className="sb-input"
                />

                <select
                  value={p.status}
                  onChange={(e) => handleParamChange(idx, "status", e.target.value)}
                  className="sb-input"
                >
                  <option value="PASS">PASS</option>
                  <option value="FAIL">FAIL</option>
                </select>

                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => handleRemoveParam(idx)}
                  disabled={formData.parameters.length <= 1}
                >
                  ✕
                </Button>
              </div>
            ))}

            <Button type="button" variant="secondary" size="sm" onClick={handleAddParam} style={{ marginTop: "8px" }}>
              + Add Inspection Parameter
            </Button>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Record Inspection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PlasticQuality;
