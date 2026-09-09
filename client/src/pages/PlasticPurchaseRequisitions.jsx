import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticPurchaseRequisitions.css";

function PlasticPurchaseRequisitions() {
  const [loading, setLoading] = useState(true);
  const [requisitions, setRequisitions] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [selectedPR, setSelectedPR] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    requester_name: "",
    department: "Plant Production",
    priority: "MEDIUM",
    request_date: new Date().toISOString().slice(0, 10),
    required_date: "",
    notes: "",
    status: "PENDING_APPROVAL",
    items: [
      { raw_material_id: "", requested_qty: "", unit: "KG", estimated_rate: "", requirement_reason: "" },
    ],
  });

  // Convert to PO Form State
  const [convertForm, setConvertForm] = useState({
    supplier_id: "",
    expected_delivery_date: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [prRes, rmRes, suppRes] = await Promise.all([
        API.get("/plastic-erp/procurement/requisitions", {
          params: {
            status: statusFilter,
            priority: priorityFilter,
            search: searchQuery,
          },
        }),
        API.get("/raw-materials"),
        API.get("/suppliers"),
      ]);

      setRequisitions(prRes.data.data || []);
      setRawMaterials(rmRes.data.data || rmRes.data || []);
      setSuppliers(suppRes.data.data || suppRes.data || []);
    } catch (err) {
      console.error("Error loading requisitions:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { raw_material_id: "", requested_qty: "", unit: "KG", estimated_rate: "", requirement_reason: "" },
      ],
    }));
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index][field] = value;

      // Auto-fill rate from material
      if (field === "raw_material_id") {
        const mat = rawMaterials.find((m) => String(m.id) === String(value));
        if (mat) {
          updated[index].estimated_rate = mat.default_purchase_rate || "";
          updated[index].unit = mat.unit || "KG";
        }
      }

      return { ...prev, items: updated };
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await API.post("/plastic-erp/procurement/requisitions", formData);
      setCreateModalOpen(false);
      setFormData({
        requester_name: "",
        department: "Plant Production",
        priority: "MEDIUM",
        request_date: new Date().toISOString().slice(0, 10),
        required_date: "",
        notes: "",
        status: "PENDING_APPROVAL",
        items: [{ raw_material_id: "", requested_qty: "", unit: "KG", estimated_rate: "", requirement_reason: "" }],
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create requisition");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status, reason = null) => {
    try {
      await API.put(`/plastic-erp/procurement/requisitions/${id}/status`, {
        status,
        rejection_reason: reason,
      });
      fetchData();
      if (detailsModalOpen && selectedPR?.id === id) {
        setSelectedPR((prev) => ({ ...prev, status }));
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  const openDetails = async (pr) => {
    try {
      const res = await API.get(`/plastic-erp/procurement/requisitions/${pr.id}`);
      setSelectedPR(res.data.data);
      setDetailsModalOpen(true);
    } catch (err) {
      alert("Failed to load requisition details");
    }
  };

  const openConvertModal = (pr) => {
    setSelectedPR(pr);
    setConvertForm({
      supplier_id: "",
      expected_delivery_date: pr.required_date ? pr.required_date.slice(0, 10) : "",
      notes: `Generated from PR ${pr.pr_no}`,
    });
    setConvertModalOpen(true);
  };

  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    if (!convertForm.supplier_id) {
      alert("Please select a supplier");
      return;
    }
    try {
      setSubmitting(true);
      const res = await API.post(`/plastic-erp/procurement/requisitions/${selectedPR.id}/convert-to-po`, convertForm);
      alert(res.data.message || "Requisition converted to PO!");
      setConvertModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to convert to PO");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalPRCount = requisitions.length;
  const pendingCount = requisitions.filter((r) => r.status === "PENDING_APPROVAL").length;
  const approvedCount = requisitions.filter((r) => r.status === "APPROVED").length;
  const totalEstValue = requisitions.reduce((sum, r) => sum + Number(r.total_estimated_value || 0), 0);

  if (loading && requisitions.length === 0) return <LoadingScreen />;

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />
      <div className="procurement-main">
        {/* Header */}
        <div className="procurement-header">
          <div>
            <h1 className="procurement-title">📋 Purchase Requisitions</h1>
            <p className="procurement-subtitle">
              Internal material requisitions, departmental demand requests & multi-level approvals
            </p>
          </div>
          <button
            type="button"
            className="procurement-btn-primary"
            onClick={() => setCreateModalOpen(true)}
          >
            + New Requisition
          </button>
        </div>

        {/* KPI Cards */}
        <div className="procurement-kpi-grid">
          <div className="procurement-kpi-card">
            <span className="kpi-label">Total Requisitions</span>
            <span className="kpi-value">{totalPRCount}</span>
            <span className="kpi-hint">All time records</span>
          </div>
          <div className="procurement-kpi-card warning">
            <span className="kpi-label">Pending Approval</span>
            <span className="kpi-value">{pendingCount}</span>
            <span className="kpi-hint">Requires management action</span>
          </div>
          <div className="procurement-kpi-card success">
            <span className="kpi-label">Approved PRs</span>
            <span className="kpi-value">{approvedCount}</span>
            <span className="kpi-hint">Ready for PO conversion</span>
          </div>
          <div className="procurement-kpi-card purple">
            <span className="kpi-label">Total Est. Value</span>
            <span className="kpi-value">₹{totalEstValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            <span className="kpi-hint">Combined requisition pipeline</span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="procurement-filters-bar">
          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search by PR #, requester..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="procurement-input"
            />
          </div>
          <div className="filter-group">
            <label>Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="procurement-select"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CONVERTED_TO_PO">Converted to PO</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Priority:</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="procurement-select"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        {/* Requisitions Table */}
        <div className="procurement-table-card">
          <div className="table-responsive">
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>PR Number</th>
                  <th>Date</th>
                  <th>Requester</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Items</th>
                  <th>Est. Value</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-6 text-muted">
                      No purchase requisitions found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  requisitions.map((pr) => (
                    <tr key={pr.id}>
                      <td className="font-semibold text-primary">{pr.pr_no}</td>
                      <td>{pr.request_date ? new Date(pr.request_date).toLocaleDateString("en-IN") : "-"}</td>
                      <td>{pr.requester_name}</td>
                      <td>{pr.department}</td>
                      <td>
                        <span className={`priority-badge ${pr.priority.toLowerCase()}`}>
                          {pr.priority}
                        </span>
                      </td>
                      <td>{pr.items_count} items ({Number(pr.total_requested_qty).toLocaleString()} KG)</td>
                      <td className="font-semibold">
                        ₹{Number(pr.total_estimated_value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={`status-badge ${pr.status.toLowerCase()}`}>
                          {pr.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="btn-action view"
                            onClick={() => openDetails(pr)}
                            title="View Items"
                          >
                            👁️ View
                          </button>
                          {pr.status === "PENDING_APPROVAL" && (
                            <>
                              <button
                                type="button"
                                className="btn-action approve"
                                onClick={() => handleStatusChange(pr.id, "APPROVED")}
                                title="Approve PR"
                              >
                                ✓ Approve
                              </button>
                              <button
                                type="button"
                                className="btn-action reject"
                                onClick={() => {
                                  const reason = prompt("Enter rejection reason:");
                                  if (reason) handleStatusChange(pr.id, "REJECTED", reason);
                                }}
                                title="Reject PR"
                              >
                                ✕
                              </button>
                            </>
                          )}
                          {pr.status === "APPROVED" && (
                            <button
                              type="button"
                              className="btn-action convert"
                              onClick={() => openConvertModal(pr)}
                              title="Generate Purchase Order"
                            >
                              ➡️ Convert to PO
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Requisition Modal */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h3>Create Purchase Requisition</h3>
              <button type="button" className="close-btn" onClick={() => setCreateModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Requester Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Patel"
                      value={formData.requester_name}
                      onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="procurement-select"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Request Date</label>
                    <input
                      type="date"
                      value={formData.request_date}
                      onChange={(e) => setFormData({ ...formData, request_date: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Required Date</label>
                    <input
                      type="date"
                      value={formData.required_date}
                      onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Initial Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="procurement-select"
                    >
                      <option value="PENDING_APPROVAL">Submit for Approval</option>
                      <option value="DRAFT">Save as Draft</option>
                    </select>
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>General Notes / Justification</label>
                  <textarea
                    rows="2"
                    placeholder="Provide context for requirement..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="procurement-textarea"
                  />
                </div>

                {/* Line Items */}
                <div className="line-items-section">
                  <div className="items-header">
                    <h4>Requisition Line Items</h4>
                    <button type="button" className="btn-add-line" onClick={handleAddItem}>
                      + Add Material
                    </button>
                  </div>

                  <table className="items-entry-table">
                    <thead>
                      <tr>
                        <th>Raw Material *</th>
                        <th>Qty *</th>
                        <th>Unit</th>
                        <th>Est. Rate (₹)</th>
                        <th>Est. Total</th>
                        <th>Reason / Usage</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, idx) => {
                        const lineTotal = (Number(item.requested_qty || 0) * Number(item.estimated_rate || 0));
                        return (
                          <tr key={idx}>
                            <td>
                              <select
                                required
                                value={item.raw_material_id}
                                onChange={(e) => handleItemChange(idx, "raw_material_id", e.target.value)}
                                className="procurement-select"
                              >
                                <option value="">Select Raw Material</option>
                                {rawMaterials.map((rm) => (
                                  <option key={rm.id} value={rm.id}>
                                    {rm.material_name} ({rm.plastic_type})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                required
                                step="0.01"
                                min="0.1"
                                placeholder="1000"
                                value={item.requested_qty}
                                onChange={(e) => handleItemChange(idx, "requested_qty", e.target.value)}
                                className="procurement-input qty-input"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={item.unit}
                                readOnly
                                className="procurement-input unit-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="45.00"
                                value={item.estimated_rate}
                                onChange={(e) => handleItemChange(idx, "estimated_rate", e.target.value)}
                                className="procurement-input rate-input"
                              />
                            </td>
                            <td className="font-semibold">₹{lineTotal.toFixed(2)}</td>
                            <td>
                              <input
                                type="text"
                                placeholder="Extruder Line 1 production"
                                value={item.requirement_reason}
                                onChange={(e) => handleItemChange(idx, "requirement_reason", e.target.value)}
                                className="procurement-input"
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn-del-line"
                                onClick={() => handleRemoveItem(idx)}
                                disabled={formData.items.length <= 1}
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : "Create Requisition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PR Details View Modal */}
      {detailsModalOpen && selectedPR && (
        <div className="modal-overlay">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <div>
                <h3>Requisition #{selectedPR.pr_no}</h3>
                <span className={`status-badge ${selectedPR.status.toLowerCase()}`}>
                  {selectedPR.status.replace(/_/g, " ")}
                </span>
              </div>
              <button type="button" className="close-btn" onClick={() => setDetailsModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="details-summary-grid">
                <div><strong>Requester:</strong> {selectedPR.requester_name}</div>
                <div><strong>Department:</strong> {selectedPR.department}</div>
                <div><strong>Priority:</strong> {selectedPR.priority}</div>
                <div><strong>Request Date:</strong> {selectedPR.request_date ? selectedPR.request_date.slice(0, 10) : "-"}</div>
                <div><strong>Required Date:</strong> {selectedPR.required_date ? selectedPR.required_date.slice(0, 10) : "-"}</div>
                <div><strong>Approved By:</strong> {selectedPR.approved_by_name || "Pending"}</div>
              </div>

              {selectedPR.notes && (
                <div className="details-notes">
                  <strong>Notes:</strong> {selectedPR.notes}
                </div>
              )}

              <h4 className="mt-4 mb-2">Requested Material Items</h4>
              <table className="procurement-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Plastic Type</th>
                    <th>Requested Qty</th>
                    <th>Unit</th>
                    <th>Est. Rate</th>
                    <th>Est. Total</th>
                    <th>Usage / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPR.items?.map((itm) => (
                    <tr key={itm.id}>
                      <td className="font-semibold">{itm.material_name}</td>
                      <td>{itm.plastic_type}</td>
                      <td>{Number(itm.requested_qty).toLocaleString()}</td>
                      <td>{itm.unit}</td>
                      <td>₹{Number(itm.estimated_rate).toFixed(2)}</td>
                      <td className="font-semibold">₹{Number(itm.estimated_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td>{itm.requirement_reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              {selectedPR.status === "APPROVED" && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    openConvertModal(selectedPR);
                  }}
                >
                  ➡️ Convert to Purchase Order
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={() => setDetailsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to PO Modal */}
      {convertModalOpen && selectedPR && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Convert PR #{selectedPR.pr_no} to PO</h3>
              <button type="button" className="close-btn" onClick={() => setConvertModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleConvertSubmit}>
              <div className="modal-body">
                <p className="mb-4 text-muted">
                  Select the supplier to generate a formal Purchase Order. Items, requested quantities, and estimated rates will be copied directly into the new PO.
                </p>
                <div className="form-group">
                  <label>Assign Supplier *</label>
                  <select
                    required
                    value={convertForm.supplier_id}
                    onChange={(e) => setConvertForm({ ...convertForm, supplier_id: e.target.value })}
                    className="procurement-select"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_name} ({s.supplier_code}) - {s.city || "Kim"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Expected Delivery Date</label>
                  <input
                    type="date"
                    value={convertForm.expected_delivery_date}
                    onChange={(e) => setConvertForm({ ...convertForm, expected_delivery_date: e.target.value })}
                    className="procurement-input"
                  />
                </div>

                <div className="form-group">
                  <label>Order Notes</label>
                  <textarea
                    rows="2"
                    value={convertForm.notes}
                    onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
                    className="procurement-textarea"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setConvertModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Generating..." : "Generate Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticPurchaseRequisitions;
