import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticPurchaseOrders.css";

function PlasticPurchaseOrders() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);

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
      const [poRes, sRes, rmRes] = await Promise.all([
        API.get("/plastic-erp/procurement/orders", {
          params: {
            supplier_id: supplierFilter,
            status: statusFilter,
            search: searchQuery,
          },
        }),
        API.get("/suppliers"),
        API.get("/raw-materials"),
      ]);

      setOrders(poRes.data.data || []);
      setSuppliers(sRes.data.data || sRes.data || []);
      setRawMaterials(rmRes.data.data || rmRes.data || []);
    } catch (err) {
      console.error("Error loading purchase orders:", err);
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
        const mat = rawMaterials.find((m) => String(m.id) === String(value));
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
      setSelectedPO(res.data.data);
      setDetailsModalOpen(true);
    } catch (err) {
      alert("Failed to load PO details");
    }
  };

  // KPIs
  const totalPOCount = orders.length;
  const pendingApprovalCount = orders.filter((o) => o.status === "PENDING_APPROVAL").length;
  const openCount = orders.filter((o) => o.status === "APPROVED" || o.status === "PARTIALLY_RECEIVED").length;
  const totalValue = orders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);

  if (loading && orders.length === 0) return <LoadingScreen />;

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />
      <div className="procurement-main">
        {/* Header */}
        <div className="procurement-header">
          <div>
            <h1 className="procurement-title">📦 Purchase Orders</h1>
            <p className="procurement-subtitle">
              Formal purchase contracts, supplier orders, pending balance monitoring & delivery fulfillment
            </p>
          </div>
          <div className="header-actions">
            <Link to="/plastic-erp/purchase-deliveries" className="btn-secondary-link">
              🚚 Track Deliveries
            </Link>
            <button
              type="button"
              className="procurement-btn-primary"
              onClick={() => setCreateModalOpen(true)}
            >
              + Create Purchase Order
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="procurement-kpi-grid">
          <div className="procurement-kpi-card">
            <span className="kpi-label">Total Purchase Orders</span>
            <span className="kpi-value">{totalPOCount}</span>
            <span className="kpi-hint">All records</span>
          </div>
          <div className="procurement-kpi-card warning">
            <span className="kpi-label">Pending Approval</span>
            <span className="kpi-value">{pendingApprovalCount}</span>
            <span className="kpi-hint">Awaiting manager sign-off</span>
          </div>
          <div className="procurement-kpi-card success">
            <span className="kpi-label">Open / In Delivery</span>
            <span className="kpi-value">{openCount}</span>
            <span className="kpi-hint">Approved & arriving</span>
          </div>
          <div className="procurement-kpi-card purple">
            <span className="kpi-label">Total PO Commitment</span>
            <span className="kpi-value">₹{totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
            <span className="kpi-hint">Order liability pipeline</span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="procurement-filters-bar">
          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search PO #, supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="procurement-input"
            />
          </div>
          <div className="filter-group">
            <label>Supplier:</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="procurement-select"
            >
              <option value="ALL">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.supplier_name}</option>
              ))}
            </select>
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
              <option value="PARTIALLY_RECEIVED">Partially Received</option>
              <option value="RECEIVED">Received</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Purchase Orders Table */}
        <div className="procurement-table-card">
          <div className="table-responsive">
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Expected Delivery</th>
                  <th>Ordered</th>
                  <th>Received</th>
                  <th>Pending</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center py-6 text-muted">
                      No purchase orders found matching criteria.
                    </td>
                  </tr>
                ) : (
                  orders.map((po) => {
                    const ord = Number(po.total_ordered_qty || 0);
                    const rec = Number(po.total_received_qty || 0);
                    const pend = Number(po.total_pending_qty || 0);
                    const pct = ord > 0 ? Math.min(100, Math.round((rec / ord) * 100)) : 0;

                    return (
                      <tr key={po.id}>
                        <td className="font-semibold text-primary">{po.po_no}</td>
                        <td>{po.po_date ? new Date(po.po_date).toLocaleDateString("en-IN") : "-"}</td>
                        <td>
                          <strong>{po.supplier_name}</strong>
                          <div className="text-muted text-xs">{po.supplier_code}</div>
                        </td>
                        <td>{po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString("en-IN") : "-"}</td>
                        <td>{ord.toLocaleString()} KG</td>
                        <td className="text-emerald-400 font-semibold">{rec.toLocaleString()} KG</td>
                        <td>
                          <div className="delivery-progress-cell">
                            <span className={pend > 0 ? "text-amber-400 font-semibold" : "text-muted"}>
                              {pend.toLocaleString()} KG
                            </span>
                            <div className="mini-progress-bar">
                              <div className="mini-progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="font-bold">
                          ₹{Number(po.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span className={`status-badge ${po.status.toLowerCase()}`}>
                            {po.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="btn-action view"
                              onClick={() => openDetails(po)}
                              title="View & Print PO"
                            >
                              👁️ View / Print
                            </button>
                            {po.status === "DRAFT" && (
                              <button
                                type="button"
                                className="btn-action approve"
                                onClick={() => handleStatusChange(po.id, "PENDING_APPROVAL")}
                              >
                                Submit
                              </button>
                            )}
                            {po.status === "PENDING_APPROVAL" && (
                              <button
                                type="button"
                                className="btn-action approve"
                                onClick={() => handleStatusChange(po.id, "APPROVED")}
                              >
                                ✓ Approve
                              </button>
                            )}
                            {["APPROVED", "PARTIALLY_RECEIVED"].includes(po.status) && (
                              <button
                                type="button"
                                className="btn-action close-po"
                                onClick={() => handleStatusChange(po.id, "CLOSED")}
                              >
                                Close
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Purchase Order Modal */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h3>Create Purchase Order</h3>
              <button type="button" className="close-btn" onClick={() => setCreateModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Supplier *</label>
                    <select
                      required
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="procurement-select"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.supplier_name} ({s.supplier_code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>PO Date</label>
                    <input
                      type="date"
                      value={formData.po_date}
                      onChange={(e) => setFormData({ ...formData, po_date: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Expected Delivery Date</label>
                    <input
                      type="date"
                      value={formData.expected_delivery_date}
                      onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Payment Terms</label>
                    <input
                      type="text"
                      value={formData.payment_terms}
                      onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Delivery Terms</label>
                    <input
                      type="text"
                      value={formData.delivery_terms}
                      onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Freight / Logistics (₹)</label>
                    <input
                      type="number"
                      value={formData.freight_amount}
                      onChange={(e) => setFormData({ ...formData, freight_amount: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>Shipping / Plant Delivery Address</label>
                  <input
                    type="text"
                    value={formData.shipping_address}
                    onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                    className="procurement-input"
                  />
                </div>

                {/* Line Items */}
                <div className="line-items-section">
                  <div className="items-header">
                    <h4>Ordered Materials</h4>
                    <button type="button" className="btn-add-line" onClick={handleAddItem}>
                      + Add Item Line
                    </button>
                  </div>

                  <table className="items-entry-table">
                    <thead>
                      <tr>
                        <th>Material *</th>
                        <th>Ordered Qty *</th>
                        <th>Unit</th>
                        <th>Rate (₹) *</th>
                        <th>Discount (₹)</th>
                        <th>GST %</th>
                        <th>Line Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, idx) => {
                        const qty = Number(item.ordered_qty || 0);
                        const rate = Number(item.rate || 0);
                        const disc = Number(item.discount_amount || 0);
                        const tax = Number(item.tax_percent || 0);

                        const taxable = Math.max(0, (qty * rate) - disc);
                        const lineTotal = taxable * (1 + tax / 100);

                        return (
                          <tr key={idx}>
                            <td>
                              <select
                                required
                                value={item.raw_material_id}
                                onChange={(e) => handleItemChange(idx, "raw_material_id", e.target.value)}
                                className="procurement-select"
                              >
                                <option value="">Select Material</option>
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
                                min="1"
                                value={item.ordered_qty}
                                onChange={(e) => handleItemChange(idx, "ordered_qty", e.target.value)}
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
                                required
                                value={item.rate}
                                onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                                className="procurement-input rate-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="10"
                                value={item.discount_amount}
                                onChange={(e) => handleItemChange(idx, "discount_amount", e.target.value)}
                                className="procurement-input rate-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="1"
                                value={item.tax_percent}
                                onChange={(e) => handleItemChange(idx, "tax_percent", e.target.value)}
                                className="procurement-input unit-input"
                              />
                            </td>
                            <td className="font-semibold text-emerald-400">
                              ₹{lineTotal.toFixed(2)}
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
                  {submitting ? "Creating..." : "Save Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Printable View Modal */}
      {detailsModalOpen && selectedPO && (
        <div className="modal-overlay">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <div>
                <h3>Purchase Order #{selectedPO.po_no}</h3>
                <span className={`status-badge ${selectedPO.status.toLowerCase()}`}>
                  {selectedPO.status.replace(/_/g, " ")}
                </span>
              </div>
              <button type="button" className="close-btn" onClick={() => setDetailsModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body po-printable-area">
              <div className="po-doc-header">
                <div className="company-info">
                  <h2>SmartBilling Plastics Corp</h2>
                  <p>Plot No. 42, Kim Industrial Estate, Surat, Gujarat</p>
                  <p>GSTIN: 24AAACS1234F1Z5 • Email: purchase@smartbilling.local</p>
                </div>
                <div className="po-meta">
                  <h3>PURCHASE ORDER</h3>
                  <p><strong>PO No:</strong> {selectedPO.po_no}</p>
                  <p><strong>Date:</strong> {selectedPO.po_date ? selectedPO.po_date.slice(0, 10) : "-"}</p>
                  <p><strong>Delivery Expected:</strong> {selectedPO.expected_delivery_date ? selectedPO.expected_delivery_date.slice(0, 10) : "-"}</p>
                </div>
              </div>

              <div className="po-parties-grid">
                <div className="party-box">
                  <h4>VENDOR / SUPPLIER:</h4>
                  <strong>{selectedPO.supplier_name}</strong>
                  <p>{selectedPO.supplier_address || "Kim Scrap Market"}, {selectedPO.supplier_city || "Surat"}</p>
                  <p>GSTIN: {selectedPO.supplier_gst || "Unregistered"} • Phone: {selectedPO.supplier_mobile}</p>
                </div>
                <div className="party-box">
                  <h4>SHIP TO:</h4>
                  <strong>SmartBilling Plastic Recycling Plant</strong>
                  <p>{selectedPO.shipping_address}</p>
                  <p>Payment Terms: {selectedPO.payment_terms} • Delivery: {selectedPO.delivery_terms}</p>
                </div>
              </div>

              <table className="procurement-table mt-4">
                <thead>
                  <tr>
                    <th>Material Code & Name</th>
                    <th>Ordered Qty</th>
                    <th>Received Qty</th>
                    <th>Pending Qty</th>
                    <th>Rate</th>
                    <th>Tax</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPO.items?.map((itm) => (
                    <tr key={itm.id}>
                      <td>
                        <strong>{itm.material_name}</strong>
                        <div className="text-muted text-xs">{itm.material_code} ({itm.plastic_type})</div>
                      </td>
                      <td>{Number(itm.ordered_qty).toLocaleString()} {itm.unit}</td>
                      <td className="text-emerald-400 font-semibold">{Number(itm.received_qty).toLocaleString()} {itm.unit}</td>
                      <td className="text-amber-400 font-semibold">{Number(itm.pending_qty).toLocaleString()} {itm.unit}</td>
                      <td>₹{Number(itm.rate).toFixed(2)}</td>
                      <td>₹{Number(itm.tax_amount || 0).toFixed(2)}</td>
                      <td className="font-bold">₹{Number(itm.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="quote-totals-breakdown mt-4">
                <div><span>Subtotal:</span> <strong>₹{Number(selectedPO.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
                <div><span>Discount:</span> <strong>- ₹{Number(selectedPO.discount_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
                <div><span>GST Taxes:</span> <strong>+ ₹{Number(selectedPO.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
                <div><span>Freight / Cartage:</span> <strong>+ ₹{Number(selectedPO.freight_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
                <div className="grand-total-row"><span>Grand Total:</span> <strong>₹{Number(selectedPO.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
              </div>

              {/* Deliveries linked to this PO */}
              {selectedPO.deliveries && selectedPO.deliveries.length > 0 && (
                <div className="mt-6">
                  <h4>Recorded Deliveries Against this PO</h4>
                  <table className="procurement-table">
                    <thead>
                      <tr>
                        <th>Delivery #</th>
                        <th>Date</th>
                        <th>Truck #</th>
                        <th>Delivered</th>
                        <th>Accepted</th>
                        <th>Delay Days</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.deliveries.map((del) => (
                        <tr key={del.id}>
                          <td>{del.delivery_no}</td>
                          <td>{del.delivery_date ? del.delivery_date.slice(0, 10) : "-"}</td>
                          <td>{del.truck_number || "-"}</td>
                          <td>{Number(del.delivered_qty).toLocaleString()} KG</td>
                          <td className="text-emerald-400">{Number(del.accepted_qty).toLocaleString()} KG</td>
                          <td>{del.delivery_delay_days || 0} days</td>
                          <td><span className="status-badge approved">{del.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-action view"
                onClick={() => window.print()}
              >
                🖨️ Print Purchase Order
              </button>
              <button type="button" className="btn-secondary" onClick={() => setDetailsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticPurchaseOrders;
