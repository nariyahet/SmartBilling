import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticSupplierQuotations.css";

function PlasticSupplierQuotations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [requisitions, setRequisitions] = useState([]);

  // Filters
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    supplier_id: "",
    requisition_id: "",
    quotation_date: new Date().toISOString().slice(0, 10),
    validity_date: "",
    reference_no: "",
    payment_terms: "30 Days Net",
    delivery_terms: "Ex-Plant",
    lead_time_days: 3,
    notes: "",
    items: [
      { raw_material_id: "", quantity: 1000, unit: "KG", rate: 45.0, discount_percent: 0, tax_percent: 18, freight_amount: 0 },
    ],
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [qRes, sRes, rmRes, prRes] = await Promise.all([
        API.get("/plastic-erp/procurement/quotations", {
          params: {
            supplier_id: supplierFilter,
            status: statusFilter,
            search: searchQuery,
          },
        }),
        API.get("/suppliers"),
        API.get("/raw-materials"),
        API.get("/plastic-erp/procurement/requisitions?status=APPROVED"),
      ]);

      setQuotations(qRes.data.data || []);
      setSuppliers(sRes.data.data || sRes.data || []);
      setRawMaterials(rmRes.data.data || rmRes.data || []);
      setRequisitions(prRes.data.data || []);
    } catch (err) {
      console.error("Error loading quotations:", err);
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
        { raw_material_id: "", quantity: 1000, unit: "KG", rate: 45.0, discount_percent: 0, tax_percent: 18, freight_amount: 0 },
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
      await API.post("/plastic-erp/procurement/quotations", formData);
      setCreateModalOpen(false);
      setFormData({
        supplier_id: "",
        requisition_id: "",
        quotation_date: new Date().toISOString().slice(0, 10),
        validity_date: "",
        reference_no: "",
        payment_terms: "30 Days Net",
        delivery_terms: "Ex-Plant",
        lead_time_days: 3,
        notes: "",
        items: [{ raw_material_id: "", quantity: 1000, unit: "KG", rate: 45.0, discount_percent: 0, tax_percent: 18, freight_amount: 0 }],
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create quotation");
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = async (quote) => {
    try {
      const res = await API.get(`/plastic-erp/procurement/quotations/${quote.id}`);
      setSelectedQuote(res.data.data);
      setDetailsModalOpen(true);
    } catch (err) {
      alert("Failed to load quotation details");
    }
  };

  const handleConvertToPO = async (quoteId) => {
    if (!window.confirm("Convert this quotation into a Purchase Order? This will mark other quotes for this request as rejected.")) return;
    try {
      const res = await API.post(`/plastic-erp/procurement/quotations/${quoteId}/convert-to-po`, {
        expected_delivery_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      });
      alert(res.data.message || "Purchase order generated!");
      fetchData();
      navigate("/plastic-erp/purchase-orders");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to convert quotation");
    }
  };

  // KPIs
  const totalCount = quotations.length;
  const activeCount = quotations.filter((q) => q.status === "PENDING" || q.status === "ACCEPTED").length;
  const acceptedCount = quotations.filter((q) => q.status === "ACCEPTED").length;

  if (loading && quotations.length === 0) return <LoadingScreen />;

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />
      <div className="procurement-main">
        {/* Header */}
        <div className="procurement-header">
          <div>
            <h1 className="procurement-title">🏷️ Supplier Quotations</h1>
            <p className="procurement-subtitle">
              Manage vendor price quotes, commercial terms, landed rate calculations & order generation
            </p>
          </div>
          <div className="header-actions">
            <Link to="/plastic-erp/purchase-comparison" className="btn-secondary-link">
              ⚖️ Compare Quotations
            </Link>
            <button
              type="button"
              className="procurement-btn-primary"
              onClick={() => setCreateModalOpen(true)}
            >
              + New Quotation
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="procurement-kpi-grid">
          <div className="procurement-kpi-card">
            <span className="kpi-label">Total Quotations</span>
            <span className="kpi-value">{totalCount}</span>
            <span className="kpi-hint">Vendor submissions</span>
          </div>
          <div className="procurement-kpi-card warning">
            <span className="kpi-label">Active / Under Review</span>
            <span className="kpi-value">{activeCount}</span>
            <span className="kpi-hint">Available for comparison</span>
          </div>
          <div className="procurement-kpi-card success">
            <span className="kpi-label">Accepted Quotes</span>
            <span className="kpi-value">{acceptedCount}</span>
            <span className="kpi-hint">Converted to Purchase Orders</span>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="procurement-filters-bar">
          <div className="filter-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search quote #, supplier..."
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
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        {/* Quotations Table */}
        <div className="procurement-table-card">
          <div className="table-responsive">
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Validity</th>
                  <th>Lead Time</th>
                  <th>Payment Terms</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotations.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-6 text-muted">
                      No supplier quotations found.
                    </td>
                  </tr>
                ) : (
                  quotations.map((q) => (
                    <tr key={q.id}>
                      <td className="font-semibold text-primary">{q.quotation_no}</td>
                      <td>{q.quotation_date ? new Date(q.quotation_date).toLocaleDateString("en-IN") : "-"}</td>
                      <td>
                        <strong>{q.supplier_name}</strong>
                        <div className="text-muted text-xs">{q.supplier_code} • {q.supplier_mobile}</div>
                      </td>
                      <td>{q.validity_date ? new Date(q.validity_date).toLocaleDateString("en-IN") : "Open"}</td>
                      <td>{q.lead_time_days || 0} days</td>
                      <td>{q.payment_terms || "Standard"}</td>
                      <td className="font-semibold">
                        ₹{Number(q.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={`status-badge ${q.status.toLowerCase()}`}>
                          {q.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="btn-action view"
                            onClick={() => openDetails(q)}
                            title="View Quote Details"
                          >
                            👁️ View
                          </button>
                          {q.status === "PENDING" && (
                            <button
                              type="button"
                              className="btn-action convert"
                              onClick={() => handleConvertToPO(q.id)}
                              title="Accept & Convert to PO"
                            >
                              ✓ Accept & Order
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

      {/* Create Quotation Modal */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <h3>Record Supplier Quotation</h3>
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
                        <option key={s.id} value={s.id}>{s.supplier_name} ({s.supplier_code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Link to PR (Optional)</label>
                    <select
                      value={formData.requisition_id}
                      onChange={(e) => setFormData({ ...formData, requisition_id: e.target.value })}
                      className="procurement-select"
                    >
                      <option value="">None (Standalone Quote)</option>
                      {requisitions.map((pr) => (
                        <option key={pr.id} value={pr.id}>{pr.pr_no} - {pr.requester_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Quotation Date</label>
                    <input
                      type="date"
                      value={formData.quotation_date}
                      onChange={(e) => setFormData({ ...formData, quotation_date: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Validity Date</label>
                    <input
                      type="date"
                      value={formData.validity_date}
                      onChange={(e) => setFormData({ ...formData, validity_date: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Supplier Reference #</label>
                    <input
                      type="text"
                      placeholder="e.g. VEN-QT-889"
                      value={formData.reference_no}
                      onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Lead Time (Days)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.lead_time_days}
                      onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
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
                </div>

                {/* Items */}
                <div className="line-items-section">
                  <div className="items-header">
                    <h4>Quotation Material Rates</h4>
                    <button type="button" className="btn-add-line" onClick={handleAddItem}>
                      + Add Material Line
                    </button>
                  </div>

                  <table className="items-entry-table">
                    <thead>
                      <tr>
                        <th>Material *</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Rate (₹)</th>
                        <th>Disc %</th>
                        <th>GST %</th>
                        <th>Freight (₹)</th>
                        <th>Landed / KG</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, idx) => {
                        const qty = Number(item.quantity || 0);
                        const rate = Number(item.rate || 0);
                        const disc = Number(item.discount_percent || 0);
                        const tax = Number(item.tax_percent || 0);
                        const freight = Number(item.freight_amount || 0);

                        const taxable = (qty * rate) * (1 - disc / 100);
                        const total = taxable * (1 + tax / 100) + freight;
                        const landed = qty > 0 ? (total / qty) : rate;

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
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
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
                                step="0.5"
                                min="0"
                                max="100"
                                value={item.discount_percent}
                                onChange={(e) => handleItemChange(idx, "discount_percent", e.target.value)}
                                className="procurement-input unit-input"
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
                            <td>
                              <input
                                type="number"
                                step="100"
                                value={item.freight_amount}
                                onChange={(e) => handleItemChange(idx, "freight_amount", e.target.value)}
                                className="procurement-input rate-input"
                              />
                            </td>
                            <td className="font-semibold text-emerald-400">
                              ₹{landed.toFixed(2)}
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
                  {submitting ? "Saving..." : "Save Quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {detailsModalOpen && selectedQuote && (
        <div className="modal-overlay">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <div>
                <h3>Quotation #{selectedQuote.quotation_no}</h3>
                <span className={`status-badge ${selectedQuote.status.toLowerCase()}`}>
                  {selectedQuote.status}
                </span>
              </div>
              <button type="button" className="close-btn" onClick={() => setDetailsModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="details-summary-grid">
                <div><strong>Supplier:</strong> {selectedQuote.supplier_name}</div>
                <div><strong>Contact:</strong> {selectedQuote.supplier_mobile}</div>
                <div><strong>GSTIN:</strong> {selectedQuote.supplier_gst || "Unregistered"}</div>
                <div><strong>Lead Time:</strong> {selectedQuote.lead_time_days || 0} Days</div>
                <div><strong>Payment Terms:</strong> {selectedQuote.payment_terms}</div>
                <div><strong>Delivery Terms:</strong> {selectedQuote.delivery_terms}</div>
              </div>

              <h4 className="mt-4 mb-2">Quoted Line Items & Landed Costs</h4>
              <table className="procurement-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Quoted Rate</th>
                    <th>Disc %</th>
                    <th>GST %</th>
                    <th>Freight</th>
                    <th>Effective Landed / KG</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedQuote.items?.map((itm) => (
                    <tr key={itm.id}>
                      <td className="font-semibold">{itm.material_name}</td>
                      <td>{Number(itm.quantity).toLocaleString()} {itm.unit}</td>
                      <td>₹{Number(itm.rate).toFixed(2)}</td>
                      <td>{Number(itm.discount_percent || 0)}%</td>
                      <td>{Number(itm.tax_percent || 0)}%</td>
                      <td>₹{Number(itm.freight_amount || 0).toFixed(2)}</td>
                      <td className="font-bold text-emerald-400">₹{Number(itm.effective_landed_rate).toFixed(2)}</td>
                      <td className="font-bold">₹{Number(itm.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="quote-totals-breakdown mt-4">
                <div><span>Subtotal:</span> <strong>₹{Number(selectedQuote.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
                <div><span>Discount:</span> <strong>- ₹{Number(selectedQuote.discount_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
                <div><span>Taxes:</span> <strong>+ ₹{Number(selectedQuote.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
                <div><span>Freight:</span> <strong>+ ₹{Number(selectedQuote.freight_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
                <div className="grand-total-row"><span>Grand Total:</span> <strong>₹{Number(selectedQuote.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
              </div>
            </div>
            <div className="modal-footer">
              {selectedQuote.status === "PENDING" && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setDetailsModalOpen(false);
                    handleConvertToPO(selectedQuote.id);
                  }}
                >
                  ✓ Accept & Generate PO
                </button>
              )}
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

export default PlasticSupplierQuotations;
