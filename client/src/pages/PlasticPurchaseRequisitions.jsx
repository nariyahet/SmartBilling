import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  KpiCard,
  Card,
  Button,
  StatusBadge,
  DataTable,
  Modal,
  SearchInput,
} from "../components";
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

      setRequisitions(prRes.data?.data || []);
      setRawMaterials(rmRes.data?.data || rmRes.data || []);
      setSuppliers(suppRes.data?.data || suppRes.data || []);
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
      alert(res.data?.message || "Requisition converted to PO!");
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

  if (loading && requisitions.length === 0) {
    return <LoadingScreen title="Loading Requisitions..." subtitle="Fetching purchase requests..." />;
  }

  const columns = [
    {
      key: "pr_no",
      title: "PR Number",
      render: (val) => <span className="sb-font-semibold sb-text-primary">{val}</span>,
    },
    {
      key: "request_date",
      title: "Date",
      render: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : "-"),
    },
    {
      key: "requester_name",
      title: "Requester",
    },
    {
      key: "department",
      title: "Department",
    },
    {
      key: "priority",
      title: "Priority",
      render: (val) => {
        const variant = val === "URGENT" ? "danger" : val === "HIGH" ? "warning" : "neutral";
        return <StatusBadge status={val} variant={variant} />;
      },
    },
    {
      key: "items_count",
      title: "Items",
      render: (val, row) => (
        <span>{val} items ({Number(row.total_requested_qty || 0).toLocaleString()} KG)</span>
      ),
    },
    {
      key: "total_estimated_value",
      title: "Est. Value",
      render: (val) => (
        <span className="sb-font-semibold">
          ₹{Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: "actions",
      title: "Actions",
      render: (_, pr) => (
        <div className="sb-action-btn-group">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openDetails(pr)}
            title="View Items"
          >
            View
          </Button>
          {pr.status === "PENDING_APPROVAL" && (
            <>
              <Button
                size="sm"
                variant="success"
                onClick={() => handleStatusChange(pr.id, "APPROVED")}
                title="Approve PR"
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  const reason = prompt("Enter rejection reason:");
                  if (reason) handleStatusChange(pr.id, "REJECTED", reason);
                }}
                title="Reject PR"
              >
                Reject
              </Button>
            </>
          )}
          {pr.status === "APPROVED" && (
            <Button
              size="sm"
              variant="teal"
              onClick={() => openConvertModal(pr)}
              title="Generate Purchase Order"
            >
              Convert to PO
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Purchase Requisitions"
        subtitle="Internal material requisitions, departmental demand requests & multi-level approvals"
        badge="PROCUREMENT & SOURCING"
        actions={
          <div className="sb-header-actions">
            <Button variant="secondary" size="md" onClick={fetchData} icon="🔄">
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              icon="+"
              onClick={() => setCreateModalOpen(true)}
            >
              New Requisition
            </Button>
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div className="sb-kpi-grid">
        <KpiCard
          title="Total Requisitions"
          value={totalPRCount}
          accent="blue"
          icon="📋"
          supportingText="All recorded PRs"
        />
        <KpiCard
          title="Pending Approval"
          value={pendingCount}
          accent="amber"
          icon="⏳"
          supportingText="Awaiting manager signoff"
        />
        <KpiCard
          title="Approved PRs"
          value={approvedCount}
          accent="green"
          icon="✅"
          supportingText="Ready for PO conversion"
        />
        <KpiCard
          title="Total Est. Value"
          value={`₹${totalEstValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          accent="navy"
          icon="💰"
          supportingText="Combined PR pipeline"
        />
      </div>

      {/* Filter Bar */}
      <Card className="sb-filter-card" noPadding>
        <div className="sb-filter-row">
          <div className="sb-filter-item search-grow">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by PR #, requester, department..."
            />
          </div>
          <div className="sb-filter-item">
            <label className="sb-filter-label">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="sb-select"
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
          <div className="sb-filter-item">
            <label className="sb-filter-label">Priority:</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="sb-select"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Data Table */}
      <Card noPadding>
        <DataTable
          columns={columns}
          data={requisitions}
          loading={loading}
          emptyMessage="No purchase requisitions found matching criteria."
        />
      </Card>

      {/* Create Requisition Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Purchase Requisition"
        subtitle="Specify required materials, quantities, department, and estimated budget"
        size="lg"
        footer={
          <div className="sb-modal-footer-actions">
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateSubmit}
              loading={submitting}
              type="submit"
            >
              Create Requisition
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="sb-form-grid-3">
            <div className="sb-form-group">
              <label>Requester Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Patel"
                value={formData.requester_name}
                onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Department</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="sb-select"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="sb-form-group">
              <label>Request Date</label>
              <input
                type="date"
                value={formData.request_date}
                onChange={(e) => setFormData({ ...formData, request_date: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Required Date</label>
              <input
                type="date"
                value={formData.required_date}
                onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Initial Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="sb-select"
              >
                <option value="PENDING_APPROVAL">Submit for Approval</option>
                <option value="DRAFT">Save as Draft</option>
              </select>
            </div>
          </div>

          <div className="sb-form-group">
            <label>General Notes / Justification</label>
            <textarea
              rows="2"
              placeholder="Provide context or machine line for requirement..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="sb-textarea"
            />
          </div>

          {/* Line Items */}
          <div className="sb-section-header">
            <h4 className="sb-section-title">Requisition Line Items</h4>
            <Button size="sm" variant="secondary" icon="+" onClick={handleAddItem}>
              Add Material
            </Button>
          </div>

          <div className="sb-table-responsive">
            <table className="sb-table items-table">
              <thead>
                <tr>
                  <th style={{ width: "32%" }}>Raw Material *</th>
                  <th style={{ width: "16%" }}>Qty *</th>
                  <th style={{ width: "10%" }}>Unit</th>
                  <th style={{ width: "16%" }}>Est. Rate (₹)</th>
                  <th style={{ width: "14%" }}>Est. Total</th>
                  <th style={{ width: "12%" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, idx) => {
                  const lineTotal = Number(item.requested_qty || 0) * Number(item.estimated_rate || 0);
                  return (
                    <tr key={idx}>
                      <td>
                        <select
                          required
                          value={item.raw_material_id}
                          onChange={(e) => handleItemChange(idx, "raw_material_id", e.target.value)}
                          className="sb-select"
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
                          className="sb-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.unit}
                          readOnly
                          className="sb-input"
                          style={{ background: "var(--sb-bg)" }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="45.00"
                          value={item.estimated_rate}
                          onChange={(e) => handleItemChange(idx, "estimated_rate", e.target.value)}
                          className="sb-input"
                        />
                      </td>
                      <td className="sb-font-semibold">₹{lineTotal.toFixed(2)}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={formData.items.length <= 1}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>
      </Modal>

      {/* PR Details View Modal */}
      <Modal
        isOpen={detailsModalOpen && Boolean(selectedPR)}
        onClose={() => setDetailsModalOpen(false)}
        title={`Requisition #${selectedPR?.pr_no || ""}`}
        subtitle="Departmental request details and raw material item breakdown"
        size="lg"
        footer={
          <div className="sb-modal-footer-actions">
            {selectedPR?.status === "APPROVED" && (
              <Button
                variant="teal"
                onClick={() => {
                  setDetailsModalOpen(false);
                  openConvertModal(selectedPR);
                }}
              >
                Convert to Purchase Order
              </Button>
            )}
            <Button variant="secondary" onClick={() => setDetailsModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedPR && (
          <div>
            <div className="sb-detail-summary-grid">
              <div><span className="sb-detail-label">Requester:</span> <strong>{selectedPR.requester_name}</strong></div>
              <div><span className="sb-detail-label">Department:</span> <strong>{selectedPR.department}</strong></div>
              <div><span className="sb-detail-label">Priority:</span> <StatusBadge status={selectedPR.priority} /></div>
              <div><span className="sb-detail-label">Request Date:</span> <strong>{selectedPR.request_date ? selectedPR.request_date.slice(0, 10) : "-"}</strong></div>
              <div><span className="sb-detail-label">Required Date:</span> <strong>{selectedPR.required_date ? selectedPR.required_date.slice(0, 10) : "-"}</strong></div>
              <div><span className="sb-detail-label">Status:</span> <StatusBadge status={selectedPR.status} /></div>
            </div>

            {selectedPR.notes && (
              <div className="sb-detail-note">
                <span className="sb-detail-label">Notes:</span> {selectedPR.notes}
              </div>
            )}

            <h4 className="sb-section-title" style={{ marginTop: "16px" }}>Requested Material Items</h4>
            <div className="sb-table-responsive">
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Plastic Type</th>
                    <th>Requested Qty</th>
                    <th>Unit</th>
                    <th>Est. Rate</th>
                    <th>Est. Total</th>
                    <th>Usage Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPR.items?.map((itm) => (
                    <tr key={itm.id}>
                      <td className="sb-font-semibold">{itm.material_name}</td>
                      <td>{itm.plastic_type}</td>
                      <td>{Number(itm.requested_qty).toLocaleString()}</td>
                      <td>{itm.unit}</td>
                      <td>₹{Number(itm.estimated_rate).toFixed(2)}</td>
                      <td className="sb-font-semibold">₹{Number(itm.estimated_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td>{itm.requirement_reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Convert to PO Modal */}
      <Modal
        isOpen={convertModalOpen && Boolean(selectedPR)}
        onClose={() => setConvertModalOpen(false)}
        title={`Convert PR #${selectedPR?.pr_no || ""} to Purchase Order`}
        subtitle="Select supplier to automatically generate formal purchase order"
        size="md"
        footer={
          <div className="sb-modal-footer-actions">
            <Button variant="secondary" onClick={() => setConvertModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConvertSubmit}
              loading={submitting}
            >
              Generate Purchase Order
            </Button>
          </div>
        }
      >
        {selectedPR && (
          <form onSubmit={handleConvertSubmit}>
            <p className="sb-text-muted" style={{ marginBottom: "16px" }}>
              Select the supplier to generate a formal Purchase Order. Items, requested quantities, and estimated rates will be copied directly into the new PO.
            </p>
            <div className="sb-form-group">
              <label>Assign Supplier *</label>
              <select
                required
                value={convertForm.supplier_id}
                onChange={(e) => setConvertForm({ ...convertForm, supplier_id: e.target.value })}
                className="sb-select"
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.supplier_name} ({s.supplier_code}) - {s.city || "Kim"}
                  </option>
                ))}
              </select>
            </div>

            <div className="sb-form-group">
              <label>Expected Delivery Date</label>
              <input
                type="date"
                value={convertForm.expected_delivery_date}
                onChange={(e) => setConvertForm({ ...convertForm, expected_delivery_date: e.target.value })}
                className="sb-input"
              />
            </div>

            <div className="sb-form-group">
              <label>Order Notes</label>
              <textarea
                rows="2"
                value={convertForm.notes}
                onChange={(e) => setConvertForm({ ...convertForm, notes: e.target.value })}
                className="sb-textarea"
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default PlasticPurchaseRequisitions;
