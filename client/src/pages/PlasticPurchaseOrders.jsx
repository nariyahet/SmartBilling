import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
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
import "./PlasticPurchaseOrders.css";

function PlasticPurchaseOrders() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [companySettings, setCompanySettings] = useState(() => {
    try {
      const saved = localStorage.getItem("company");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Filters
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    supplier_id: "",
    po_date: new Date().toISOString().slice(0, 10),
    expected_delivery_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    payment_terms: "30 Days Net",
    delivery_terms: "Ex-Plant",
    shipping_address: "Kim Industrial Area, Surat, Gujarat - 394110",
    notes: "",
    freight_amount: 0,
    items: [
      { raw_material_id: "", ordered_qty: 1000, unit: "KG", rate: 45.0, discount_amount: 0, tax_percent: 18 },
    ],
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [poRes, sRes, rmRes, bsRes] = await Promise.all([
        API.get("/plastic-erp/procurement/orders", {
          params: {
            supplier_id: supplierFilter,
            status: statusFilter,
            search: searchQuery,
          },
        }),
        API.get("/suppliers"),
        API.get("/raw-materials"),
        API.get("/business-settings").catch(() => ({ data: {} })),
      ]);

      const poList = Array.isArray(poRes.data?.data)
        ? poRes.data.data
        : Array.isArray(poRes.data?.orders)
        ? poRes.data.orders
        : Array.isArray(poRes.data)
        ? poRes.data
        : [];
      const suppList = Array.isArray(sRes.data?.suppliers)
        ? sRes.data.suppliers
        : Array.isArray(sRes.data?.data)
        ? sRes.data.data
        : Array.isArray(sRes.data)
        ? sRes.data
        : [];
      const rmList = Array.isArray(rmRes.data?.raw_materials)
        ? rmRes.data.raw_materials
        : Array.isArray(rmRes.data?.data)
        ? rmRes.data.data
        : Array.isArray(rmRes.data)
        ? rmRes.data
        : [];

      setOrders(poList);
      setSuppliers(suppList);
      setRawMaterials(rmList);
      if (bsRes.data?.settings) {
        setCompanySettings(bsRes.data.settings);
      }
    } catch (err) {
      console.error("Error loading purchase orders:", err);
      setOrders([]);
      setSuppliers([]);
      setRawMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [supplierFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { raw_material_id: "", ordered_qty: 1000, unit: "KG", rate: 45.0, discount_amount: 0, tax_percent: 18 },
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
        const mat = (Array.isArray(rawMaterials) ? rawMaterials : []).find((m) => String(m.id) === String(value));
        if (mat) {
          updated[index].rate = mat.default_purchase_rate || 45.0;
          updated[index].unit = mat.unit || "KG";
        }
      }
      return { ...prev, items: updated };
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier_id) {
      alert("Please select a supplier");
      return;
    }
    try {
      setSubmitting(true);
      await API.post("/plastic-erp/procurement/orders", formData);
      setCreateModalOpen(false);
      setFormData({
        supplier_id: "",
        po_date: new Date().toISOString().slice(0, 10),
        expected_delivery_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        payment_terms: "30 Days Net",
        delivery_terms: "Ex-Plant",
        shipping_address: "Kim Industrial Area, Surat, Gujarat - 394110",
        notes: "",
        freight_amount: 0,
        items: [{ raw_material_id: "", ordered_qty: 1000, unit: "KG", rate: 45.0, discount_amount: 0, tax_percent: 18 }],
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create purchase order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await API.put(`/plastic-erp/procurement/orders/${id}/status`, { status });
      fetchData();
      if (detailsModalOpen && selectedPO?.id === id) {
        setSelectedPO((prev) => ({ ...prev, status }));
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update PO status");
    }
  };

  const openDetails = async (po) => {
    try {
      const res = await API.get(`/plastic-erp/procurement/orders/${po.id}`);
      setSelectedPO(res.data?.data);
      setDetailsModalOpen(true);
    } catch {
      alert("Failed to load PO details");
    }
  };

  const handleDeletePO = async (po) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this Purchase Order?"
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      const res = await API.delete(`/plastic-erp/procurement/orders/${po.id}`);
      alert(res.data?.message || `Purchase Order ${po.po_no} deleted successfully! ✅`);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete Purchase Order");
    } finally {
      setLoading(false);
    }
  };

  // KPIs
  const totalPOCount = Array.isArray(orders) ? orders.length : 0;
  const pendingApprovalCount = Array.isArray(orders) ? orders.filter((o) => o.status === "PENDING_APPROVAL").length : 0;
  const openCount = Array.isArray(orders) ? orders.filter((o) => o.status === "APPROVED" || o.status === "PARTIALLY_RECEIVED").length : 0;
  const totalValue = Array.isArray(orders) ? orders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0) : 0;

  if (loading && (!Array.isArray(orders) || orders.length === 0)) {
    return <LoadingScreen title="Loading Purchase Orders..." subtitle="Fetching procurement commitments..." />;
  }

  const columns = [
    {
      key: "po_no",
      title: "PO Number",
      render: (val) => <span className="sb-font-semibold sb-text-primary">{val}</span>,
    },
    {
      key: "po_date",
      title: "Date",
      render: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : "-"),
    },
    {
      key: "supplier_name",
      title: "Supplier",
      render: (val, row) => (
        <div>
          <strong>{val}</strong>
          <div className="sb-text-muted text-xs">{row.supplier_code} • {row.supplier_city || "Kim"}</div>
        </div>
      ),
    },
    {
      key: "expected_delivery_date",
      title: "Expected Delivery",
      render: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : "-"),
    },
    {
      key: "total_ordered_qty",
      title: "Total Qty",
      render: (val) => `${Number(val || 0).toLocaleString()} KG`,
    },
    {
      key: "received_qty",
      title: "Received",
      render: (val, row) => {
        const rec = Number(val || 0);
        const tot = Number(row.total_ordered_qty || 0);
        const pct = tot > 0 ? Math.round((rec / tot) * 100) : 0;
        return (
          <div>
            <span>{rec.toLocaleString()} KG ({pct}%)</span>
            <div className="po-progress-bar">
              <div className="po-progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "grand_total",
      title: "Order Value",
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
      render: (_, po) => (
        <div className="sb-action-btn-group">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openDetails(po)}
            title="View Order Details"
          >
            View
          </Button>
          {po.status === "PENDING_APPROVAL" && (
            <Button
              size="sm"
              variant="success"
              onClick={() => handleStatusChange(po.id, "APPROVED")}
              title="Approve Order"
            >
              Approve
            </Button>
          )}
          {po.status === "APPROVED" && (
            <Button
              size="sm"
              variant="teal"
              onClick={() => handleStatusChange(po.id, "ISSUED")}
              title="Mark as Sent to Supplier"
            >
              Issue
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDeletePO(po)}
            title="Delete Purchase Order"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="sb-page-container">
      <div className="no-print">
        <PageHeader
          title="Purchase Orders"
          subtitle="Formal purchase contracts, supplier orders, pending balance monitoring & delivery fulfillment"
          badge="PROCUREMENT CONTRACTS"
          actions={
            <div className="sb-header-actions">
              <Link to="/plastic-erp/purchase-deliveries">
                <Button variant="secondary" size="md" icon="🚚">
                  Track Deliveries
                </Button>
              </Link>
              <Button
                variant="primary"
                size="md"
                icon="+"
                onClick={() => setCreateModalOpen(true)}
              >
                Create Purchase Order
              </Button>
            </div>
          }
        />
      </div>

      {/* KPI Cards Grid */}
      <div className="sb-kpi-grid no-print">
        <KpiCard
          title="Total Purchase Orders"
          value={totalPOCount}
          accent="blue"
          icon="📦"
          supportingText="All active & closed orders"
        />
        <KpiCard
          title="Pending Approval"
          value={pendingApprovalCount}
          accent="amber"
          icon="⏳"
          supportingText="Awaiting manager sign-off"
        />
        <KpiCard
          title="Open / In Delivery"
          value={openCount}
          accent="green"
          icon="🚚"
          supportingText="Actively in fulfillment"
        />
        <KpiCard
          title="Total Order Value"
          value={`₹${totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          accent="navy"
          icon="💰"
          supportingText="Total procurement pipeline"
        />
      </div>

      {/* Filters Bar */}
      <Card className="sb-filter-card no-print" noPadding>
        <div className="sb-filter-row">
          <div className="sb-filter-item search-grow">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PO #, supplier, notes..."
            />
          </div>
          <div className="sb-filter-item">
            <label className="sb-filter-label">Supplier:</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="sb-select"
            >
              <option value="ALL">All Suppliers</option>
              {(Array.isArray(suppliers) ? suppliers : []).map((s) => (
                <option key={s.id} value={s.id}>{s.supplier_name}</option>
              ))}
            </select>
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
              <option value="ISSUED">Issued</option>
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card noPadding className="no-print">
        <DataTable
          columns={columns}
          data={orders}
          loading={loading}
          emptyMessage="No purchase orders found."
        />
      </Card>

      {/* Create Purchase Order Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Purchase Order"
        subtitle="Formal contract commitment to supplier with item rates, delivery dates and freight"
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
            >
              Issue Purchase Order
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="sb-form-grid-3">
            <div className="sb-form-group">
              <label>Supplier *</label>
              <select
                required
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="sb-select"
              >
                <option value="">Select Supplier</option>
                {(Array.isArray(suppliers) ? suppliers : []).map((s) => (
                  <option key={s.id} value={s.id}>{s.supplier_name} ({s.supplier_code})</option>
                ))}
              </select>
            </div>
            <div className="sb-form-group">
              <label>PO Date</label>
              <input
                type="date"
                value={formData.po_date}
                onChange={(e) => setFormData({ ...formData, po_date: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Expected Delivery Date</label>
              <input
                type="date"
                value={formData.expected_delivery_date}
                onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Payment Terms</label>
              <input
                type="text"
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Delivery Terms</label>
              <input
                type="text"
                value={formData.delivery_terms}
                onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Estimated Freight (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.freight_amount}
                onChange={(e) => setFormData({ ...formData, freight_amount: e.target.value })}
                className="sb-input"
              />
            </div>
          </div>

          <div className="sb-form-group">
            <label>Shipping / Plant Address</label>
            <input
              type="text"
              value={formData.shipping_address}
              onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
              className="sb-input"
            />
          </div>

          {/* Line Items */}
          <div className="sb-section-header">
            <h4 className="sb-section-title">Purchase Order Items</h4>
            <Button size="sm" variant="secondary" icon="+" onClick={handleAddItem}>
              Add Line
            </Button>
          </div>

          <div className="sb-table-responsive">
            <table className="sb-table">
              <thead>
                <tr>
                  <th style={{ width: "28%" }}>Raw Material *</th>
                  <th style={{ width: "16%" }}>Qty *</th>
                  <th style={{ width: "16%" }}>Rate (₹)</th>
                  <th style={{ width: "12%" }}>Disc (₹)</th>
                  <th style={{ width: "12%" }}>GST %</th>
                  <th style={{ width: "16%" }}>Line Total</th>
                  <th style={{ width: "8%" }}></th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, idx) => {
                  const qty = Number(item.ordered_qty || 0);
                  const rate = Number(item.rate || 0);
                  const disc = Number(item.discount_amount || 0);
                  const tax = Number(item.tax_percent || 0);
                  const taxable = Math.max(0, qty * rate - disc);
                  const lineTotal = taxable * (1 + tax / 100);

                  return (
                    <tr key={idx}>
                      <td>
                        <select
                          required
                          value={item.raw_material_id}
                          onChange={(e) => handleItemChange(idx, "raw_material_id", e.target.value)}
                          className="sb-select"
                        >
                          <option value="">Select Material</option>
                          {(Array.isArray(rawMaterials) ? rawMaterials : []).map((m) => (
                            <option key={m.id} value={m.id}>{m.material_name} ({m.plastic_type})</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={item.ordered_qty}
                          onChange={(e) => handleItemChange(idx, "ordered_qty", e.target.value)}
                          className="sb-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                          className="sb-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          value={item.discount_amount}
                          onChange={(e) => handleItemChange(idx, "discount_amount", e.target.value)}
                          className="sb-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          value={item.tax_percent}
                          onChange={(e) => handleItemChange(idx, "tax_percent", e.target.value)}
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

      {/* PO Details Modal */}
      <Modal
        isOpen={detailsModalOpen && Boolean(selectedPO)}
        onClose={() => setDetailsModalOpen(false)}
        title={`Purchase Order #${selectedPO?.po_no || ""}`}
        subtitle="Formal contract commitment and receipt status"
        size="lg"
        footer={
          <div className="sb-modal-footer-actions no-print">
            <Button
              variant="secondary"
              icon="🖨️"
              onClick={() => window.print()}
            >
              Print PO
            </Button>
            {selectedPO?.status === "PENDING_APPROVAL" && (
              <Button
                variant="success"
                onClick={() => {
                  handleStatusChange(selectedPO.id, "APPROVED");
                  setDetailsModalOpen(false);
                }}
              >
                Approve PO
              </Button>
            )}
            <Button variant="secondary" onClick={() => setDetailsModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedPO && (
          <div className="po-document-wrapper">
            {/* Action Bar (hidden in print) */}
            <div className="po-preview-top-bar no-print">
              <div className="po-preview-badge-row">
                <StatusBadge status={selectedPO.status} />
                <span className="po-preview-items-count">
                  {selectedPO.items?.length || 0} Order Items
                </span>
              </div>
              <div className="po-preview-actions">
                <Button
                  variant="primary"
                  icon="🖨️"
                  onClick={() => window.print()}
                >
                  Print PO (A4)
                </Button>
              </div>
            </div>

            {/* PRINTABLE PURCHASE ORDER DOCUMENT */}
            <div className="po-print-document">
              {/* Header: Company Profile & PO Title */}
              <div className="po-doc-header">
                <div className="po-company-block">
                  <h2>{companySettings?.business_name || companySettings?.name || "PLASTIC RECYCLING & COMPOUNDING ERP"}</h2>
                  {companySettings?.tagline && <p className="po-tagline">{companySettings.tagline}</p>}
                  <p>{companySettings?.address || "Kim Industrial Estate, NH-8, Surat, Gujarat - 394110"}</p>
                  <p>
                    {companySettings?.tax_number && (
                      <span>GSTIN: <strong>{companySettings.tax_number}</strong> | </span>
                    )}
                    State: 24-Gujarat
                  </p>
                  <p>
                    {companySettings?.email && <span>Email: {companySettings.email} | </span>}
                    {companySettings?.phone && <span>Tel: {companySettings.phone}</span>}
                  </p>
                </div>
                <div className="po-title-block">
                  <div className="po-doc-badge">PURCHASE ORDER</div>
                  <div className="po-doc-meta-item">
                    <span className="po-meta-lbl">PO Number:</span>
                    <strong className="po-meta-val">{selectedPO.po_no}</strong>
                  </div>
                  <div className="po-doc-meta-item">
                    <span className="po-meta-lbl">PO Date:</span>
                    <span className="po-meta-val">
                      {selectedPO.po_date ? new Date(selectedPO.po_date).toLocaleDateString("en-IN") : "-"}
                    </span>
                  </div>
                  <div className="po-doc-meta-item">
                    <span className="po-meta-lbl">Delivery Date:</span>
                    <span className="po-meta-val">
                      {selectedPO.expected_delivery_date ? new Date(selectedPO.expected_delivery_date).toLocaleDateString("en-IN") : "-"}
                    </span>
                  </div>
                  <div className="po-doc-meta-item">
                    <span className="po-meta-lbl">Status:</span>
                    <strong className="po-meta-val">{selectedPO.status}</strong>
                  </div>
                </div>
              </div>

              {/* Vendor & Delivery Information Grid */}
              <div className="po-party-grid">
                <div className="po-party-box">
                  <div className="po-box-title">SUPPLIER / VENDOR DETAILS</div>
                  <strong className="po-party-name">{selectedPO.supplier_name}</strong>
                  {selectedPO.supplier_business_name && (
                    <div className="po-party-detail">{selectedPO.supplier_business_name}</div>
                  )}
                  {selectedPO.supplier_code && (
                    <div className="po-party-detail">Supplier Code: <strong>{selectedPO.supplier_code}</strong></div>
                  )}
                  {selectedPO.supplier_gst && (
                    <div className="po-party-detail">GSTIN: <strong>{selectedPO.supplier_gst}</strong></div>
                  )}
                  {selectedPO.supplier_address && (
                    <div className="po-party-detail">{selectedPO.supplier_address}</div>
                  )}
                  {(selectedPO.supplier_city || selectedPO.supplier_state) && (
                    <div className="po-party-detail">
                      {[selectedPO.supplier_city, selectedPO.supplier_state].filter(Boolean).join(", ")}
                    </div>
                  )}
                  {selectedPO.supplier_mobile && (
                    <div className="po-party-detail">Phone: {selectedPO.supplier_mobile}</div>
                  )}
                  {selectedPO.supplier_email && (
                    <div className="po-party-detail">Email: {selectedPO.supplier_email}</div>
                  )}
                </div>

                <div className="po-party-box">
                  <div className="po-box-title">SHIPPING & CONTRACT TERMS</div>
                  <div className="po-party-detail">
                    <span className="po-term-lbl">Shipping / Plant:</span>
                    <strong>{selectedPO.shipping_address || "Kim Industrial Area, Surat, Gujarat - 394110"}</strong>
                  </div>
                  <div className="po-party-detail">
                    <span className="po-term-lbl">Payment Terms:</span>
                    <span>{selectedPO.payment_terms || "30 Days Net"}</span>
                  </div>
                  <div className="po-party-detail">
                    <span className="po-term-lbl">Delivery Terms:</span>
                    <span>{selectedPO.delivery_terms || "Ex-Plant"}</span>
                  </div>
                  {selectedPO.approved_by_name && (
                    <div className="po-party-detail">
                      <span className="po-term-lbl">Approved By:</span>
                      <span>{selectedPO.approved_by_name}</span>
                    </div>
                  )}
                  {selectedPO.created_by_name && (
                    <div className="po-party-detail">
                      <span className="po-term-lbl">Created By:</span>
                      <span>{selectedPO.created_by_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="po-table-wrap">
                <table className="po-items-doc-table">
                  <thead>
                    <tr>
                      <th style={{ width: "5%" }}>#</th>
                      <th style={{ width: "14%" }}>Item Code</th>
                      <th style={{ width: "29%" }}>Material Description</th>
                      <th style={{ width: "13%", textAlign: "right" }}>Ordered Qty</th>
                      <th style={{ width: "12%", textAlign: "right" }}>Unit Rate</th>
                      <th style={{ width: "12%", textAlign: "right" }}>GST / Tax</th>
                      <th style={{ width: "15%", textAlign: "right" }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPO.items || []).map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td>{idx + 1}</td>
                        <td><code>{item.material_code || "—"}</code></td>
                        <td>
                          <strong>{item.material_name}</strong>
                          {item.plastic_type && (
                            <span className="po-item-tag"> [{item.plastic_type}]</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {Number(item.ordered_qty).toLocaleString("en-IN")} {item.unit || "KG"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          ₹{Number(item.rate).toFixed(2)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          ₹{Number(item.tax_amount || 0).toFixed(2)}
                          {Number(item.tax_percent) > 0 && (
                            <small className="po-tax-pct"> ({item.tax_percent}%)</small>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>
                          ₹{Number(item.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Calculation Breakdown */}
              <div className="po-totals-section">
                <div className="po-totals-left">
                  {selectedPO.notes && (
                    <div className="po-notes-box">
                      <strong>Order Notes / Delivery Instructions:</strong>
                      <p>{selectedPO.notes}</p>
                    </div>
                  )}
                </div>
                <div className="po-totals-right">
                  <div className="po-total-row">
                    <span>Subtotal:</span>
                    <strong>₹{Number(selectedPO.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                  </div>
                  {Number(selectedPO.discount_amount) > 0 && (
                    <div className="po-total-row">
                      <span>Discount:</span>
                      <strong>- ₹{Number(selectedPO.discount_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                    </div>
                  )}
                  <div className="po-total-row">
                    <span>GST / Tax:</span>
                    <strong>+ ₹{Number(selectedPO.tax_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                  </div>
                  {Number(selectedPO.freight_amount) > 0 && (
                    <div className="po-total-row">
                      <span>Freight / Transport:</span>
                      <strong>+ ₹{Number(selectedPO.freight_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                    </div>
                  )}
                  <div className="po-grand-total-row">
                    <span>Grand Total:</span>
                    <strong className="po-grand-total-val">
                      ₹{Number(selectedPO.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="po-terms-block">
                <div className="po-terms-title">TERMS & CONDITIONS:</div>
                <ol className="po-terms-list">
                  <li>Material must match quality standards and polymer specifications as approved.</li>
                  <li>Weighment conducted on our Kim plant certified weighbridge will be final and binding.</li>
                  <li>Payment will be processed according to the agreed payment terms after physical inspection.</li>
                  <li>Goods must be accompanied by delivery challan and valid E-Way Bill wherever required.</li>
                </ol>
              </div>

              {/* Signatures */}
              <div className="po-signatures-grid">
                <div className="po-sig-col">
                  <div className="po-sig-line" />
                  <span>Prepared By</span>
                  <small>{selectedPO.created_by_name || "Procurement Officer"}</small>
                </div>
                <div className="po-sig-col">
                  <div className="po-sig-line" />
                  <span>Verified & Approved By</span>
                  <small>{selectedPO.approved_by_name || "Plant Manager"}</small>
                </div>
                <div className="po-sig-col">
                  <div className="po-sig-line" />
                  <span>Authorized Signatory</span>
                  <small>For {companySettings?.business_name || companySettings?.name || "Company Name"}</small>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PlasticPurchaseOrders;
