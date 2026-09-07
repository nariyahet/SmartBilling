import { useEffect, useState } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticPurchaseBills.css";

const PAYMENT_STATUSES = ["ALL", "UNPAID", "PARTIAL", "PAID"];

function PlasticPurchaseBills() {
  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [truckInwards, setTruckInwards] = useState([]);
  const [businessSettings, setBusinessSettings] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewBill, setViewBill] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    purchase_bill_no: "",
    supplier_id: "",
    truck_inward_id: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    payment_status: "UNPAID",
    discount_amount: 0,
    tax_percent: 18,
    notes: "",
  });

  const [items, setItems] = useState([
    { raw_material_id: "", quantity: "", unit: "KG", rate: "" },
  ]);

  const fetchAuxiliaryData = async () => {
    try {
      const [supRes, matRes, inwRes, setRes] = await Promise.all([
        API.get("/suppliers?status=ACTIVE"),
        API.get("/raw-materials?status=ACTIVE"),
        API.get("/truck-inwards"),
        API.get("/business-settings"),
      ]);

      if (supRes.data?.success) setSuppliers(supRes.data.suppliers || []);
      if (matRes.data?.success) setRawMaterials(matRes.data.raw_materials || []);
      if (inwRes.data?.success) setTruckInwards(inwRes.data.truck_inwards || []);
      if (setRes.data?.settings) setBusinessSettings(setRes.data.settings);
    } catch (err) {
      console.error("Auxiliary data fetch error:", err);
    }
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      setError("");

      let url = "/purchase-bills";
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("payment_status", statusFilter);
      if (searchTerm.trim()) params.append("search", searchTerm.trim());

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await API.get(url);
      if (res.data?.success) {
        setBills(res.data.purchase_bills || []);
      }
    } catch (err) {
      console.error("Fetch purchase bills error:", err);
      setError(err.response?.data?.message || "Failed to load purchase bills.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAuxiliaryData();
    fetchBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const isTaxEnabled =
    businessSettings?.tax_enabled === true || Number(businessSettings?.tax_enabled) === 1;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBills();
  };

  const handleOpenCreateModal = () => {
    const defaultTax = isTaxEnabled
      ? (businessSettings?.default_tax_percent !== undefined ? Number(businessSettings.default_tax_percent) : 18)
      : 0;

    setFormData({
      purchase_bill_no: "",
      supplier_id: suppliers.length > 0 ? suppliers[0].id : "",
      truck_inward_id: "",
      purchase_date: new Date().toISOString().slice(0, 10),
      payment_status: "UNPAID",
      discount_amount: 0,
      tax_percent: defaultTax,
      notes: "",
    });

    setItems([
      {
        raw_material_id: rawMaterials.length > 0 ? rawMaterials[0].id : "",
        quantity: 1000,
        unit: rawMaterials.length > 0 ? rawMaterials[0].unit || "KG" : "KG",
        rate: rawMaterials.length > 0 ? rawMaterials[0].default_purchase_rate || 42 : 42,
      },
    ]);

    setIsCreateModalOpen(true);
    setError("");
  };

  const handleTruckInwardSelect = (e) => {
    const inwardId = e.target.value;
    const selected = truckInwards.find((ti) => String(ti.id) === String(inwardId));
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        truck_inward_id: inwardId,
        supplier_id: selected.supplier_id || prev.supplier_id,
        notes: `Inward Slip: ${selected.inward_no} • Truck: ${selected.truck_number}`,
      }));

      // Pre-fill item with truck inward material & net weight
      setItems([
        {
          raw_material_id: selected.material_id,
          quantity: selected.net_weight || 1000,
          unit: "KG",
          rate: selected.rate_per_unit || 40,
        },
      ]);
    } else {
      setFormData((prev) => ({ ...prev, truck_inward_id: "" }));
    }
  };

  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        raw_material_id: rawMaterials.length > 0 ? rawMaterials[0].id : "",
        quantity: "",
        unit: "KG",
        rate: "",
      },
    ]);
  };

  const handleRemoveItemRow = (index) => {
    if (items.length === 1) {
      alert("At least one item is required on the purchase bill.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === "raw_material_id") {
        const mat = rawMaterials.find((m) => String(m.id) === String(value));
        if (mat) {
          updated[index].unit = mat.unit || "KG";
          if (mat.default_purchase_rate && !updated[index].rate) {
            updated[index].rate = mat.default_purchase_rate;
          }
        }
      }
      return updated;
    });
  };

  // Calculations
  const subtotal = items.reduce((acc, itm) => {
    const q = Number(itm.quantity) || 0;
    const r = Number(itm.rate) || 0;
    return acc + (q * r);
  }, 0);

  const discount = Number(formData.discount_amount) || 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const taxRate = isTaxEnabled ? Number(formData.tax_percent) || 0 : 0;
  const taxAmount = isTaxEnabled ? taxableAmount * (taxRate / 100) : 0;
  const grandTotal = taxableAmount + taxAmount;

  const handleSubmitBill = async (e) => {
    e.preventDefault();
    if (!formData.supplier_id) {
      alert("Please select a scrap supplier.");
      return;
    }
    if (items.length === 0) {
      alert("At least one item is required.");
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].raw_material_id) {
        alert(`Please select a raw material for item #${i + 1}`);
        return;
      }
      if (!items[i].quantity || Number(items[i].quantity) <= 0) {
        alert(`Please enter a valid positive quantity for item #${i + 1}`);
        return;
      }
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        supplier_id: formData.supplier_id,
        truck_inward_id: formData.truck_inward_id || null,
        purchase_date: formData.purchase_date,
        items: items.map((itm) => ({
          raw_material_id: Number(itm.raw_material_id),
          quantity: Number(itm.quantity),
          unit: itm.unit || "KG",
          rate: Number(itm.rate) || 0,
        })),
        discount_amount: discount,
        tax_percent: isTaxEnabled ? taxRate : 0,
        payment_status: formData.payment_status,
        notes: formData.notes,
        purchase_bill_no: formData.purchase_bill_no || undefined,
      };

      await API.post("/purchase-bills", payload);
      setSuccessMsg("Purchase bill generated and stock updated successfully! ✅");
      setIsCreateModalOpen(false);
      await fetchBills();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Save purchase bill error:", err);
      alert(err.response?.data?.message || "Failed to create purchase bill.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenViewModal = async (id) => {
    try {
      const res = await API.get(`/purchase-bills/${id}`);
      if (res.data?.success && res.data?.purchase_bill) {
        setViewBill(res.data.purchase_bill);
      }
    } catch (err) {
      console.error("Fetch bill detail error:", err);
      alert(err.response?.data?.message || "Failed to load purchase bill details.");
    }
  };

  const handleUpdatePaymentStatus = async (id, newStatus) => {
    try {
      await API.put(`/purchase-bills/${id}/payment-status`, { payment_status: newStatus });
      setSuccessMsg(`Payment status updated to ${newStatus}. ✅`);
      if (viewBill && viewBill.id === id) {
        setViewBill((prev) => ({ ...prev, payment_status: newStatus }));
      }
      await fetchBills();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Update payment status error:", err);
      alert(err.response?.data?.message || "Failed to update payment status.");
    }
  };

  const handleDeleteBill = async (id, billNo) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete purchase bill "${billNo}"?\nWarning: This will atomically reverse and deduct the stock added by this bill!`
    );
    if (!confirmed) return;

    try {
      await API.delete(`/purchase-bills/${id}`);
      setSuccessMsg(`Purchase bill "${billNo}" deleted and stock reversed. ✅`);
      await fetchBills();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Delete purchase bill error:", err);
      alert(err.response?.data?.message || "Failed to delete purchase bill.");
    }
  };

  return (
    <div className="plastic-purchase-page">
      <PlasticNavbar />

      <main className="plastic-content-wrap">
        <div className="page-title-row">
          <div>
            <h1>📑 Purchase Bills (Scrap Procurement)</h1>
            <p>Vendor purchase invoices, itemized scrap materials, company GST ON/OFF calculation, and atomic inventory stock updates</p>
          </div>

          <button type="button" className="btn-add-entity" onClick={handleOpenCreateModal}>
            ➕ Create Purchase Bill
          </button>
        </div>

        {error && <div className="alert-box error">{error}</div>}
        {successMsg && <div className="alert-box success">{successMsg}</div>}

        {/* Filters */}
        <div className="filter-card">
          <form className="search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search by bill no, supplier, or truck number..."
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
                  fetchBills();
                }}
              >
                Clear
              </button>
            )}
          </form>

          <div className="status-toggle-wrap">
            <span>Payment Status:</span>
            {PAYMENT_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                className={`filter-chip ${statusFilter === st ? "active" : ""}`}
                onClick={() => setStatusFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Bills Table */}
        {loading ? (
          <LoadingScreen title="Loading Purchase Bills..." subtitle="Retrieving procurement transactions..." />
        ) : bills.length === 0 ? (
          <div className="empty-state-box">
            <span className="empty-icon">📑</span>
            <h3>No Purchase Bills Generated</h3>
            <p>Generate your first vendor purchase bill to automatically update raw material scrap stock.</p>
            <button type="button" className="btn-add-entity" onClick={handleOpenCreateModal}>
              ➕ Create Purchase Bill Now
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Inward Ref</th>
                  <th>Items</th>
                  <th>Subtotal</th>
                  <th>GST Tax</th>
                  <th>Grand Total</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((pb) => (
                  <tr key={pb.id}>
                    <td>
                      <span className="code-pill">{pb.purchase_bill_no}</span>
                    </td>
                    <td>
                      <span className="date-text">
                        {new Date(pb.purchase_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td>
                      <strong className="entity-primary-name">{pb.supplier_name}</strong>
                      <span className="entity-subtext">{pb.supplier_code}</span>
                    </td>
                    <td>
                      {pb.inward_no ? (
                        <span className="inward-ref-pill">
                          TI: {pb.inward_no} {pb.truck_number ? `(${pb.truck_number})` : ""}
                        </span>
                      ) : (
                        <span className="entity-subtext">Direct Bill</span>
                      )}
                    </td>
                    <td>
                      <span>{pb.total_items} Scrap Items</span>
                    </td>
                    <td>
                      <span>₹{Number(pb.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td>
                      {Number(pb.tax_amount) > 0 ? (
                        <span className="tax-on-badge">
                          +{Number(pb.tax_percent)}% (₹{Number(pb.tax_amount).toLocaleString("en-IN")})
                        </span>
                      ) : (
                        <span className="tax-off-badge">0% (GST OFF)</span>
                      )}
                    </td>
                    <td>
                      <strong className="grand-total-highlight">
                        ₹{Number(pb.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </strong>
                    </td>
                    <td>
                      <span className={`payment-pill ${String(pb.payment_status).toLowerCase()}`}>
                        {pb.payment_status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons-cell">
                        <button
                          type="button"
                          className="btn-view-bill"
                          onClick={() => handleOpenViewModal(pb.id)}
                          title="View Bill Details"
                        >
                          👁️ View
                        </button>
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() => handleDeleteBill(pb.id, pb.purchase_bill_no)}
                          title="Delete Bill and Reverse Stock"
                        >
                          🗑️
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

      {/* Create Purchase Bill Modal */}
      {isCreateModalOpen && (
        <div className="plastic-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div className="plastic-modal-card large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Create Raw Material Purchase Bill</h2>
              <button type="button" className="btn-close-modal" onClick={() => setIsCreateModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitBill} className="plastic-form">
              <div className="form-row-3">
                <div className="form-group">
                  <label>Bill Number (Optional / Auto)</label>
                  <input
                    type="text"
                    name="purchase_bill_no"
                    placeholder="e.g. PB-1001"
                    value={formData.purchase_bill_no}
                    onChange={(e) => setFormData({ ...formData, purchase_bill_no: e.target.value })}
                  />
                  <small className="help-text">Leave blank to auto-generate</small>
                </div>

                <div className="form-group">
                  <label>Purchase Date *</label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Payment Status</label>
                  <select
                    value={formData.payment_status}
                    onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                  >
                    <option value="UNPAID">UNPAID</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="PAID">PAID</option>
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Scrap Supplier *</label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    required
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_name} ({s.supplier_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Link Inbound Truck Scale Slip (Optional)</label>
                  <select value={formData.truck_inward_id} onChange={handleTruckInwardSelect}>
                    <option value="">-- Direct Bill (No Inward Scale Slip) --</option>
                    {truckInwards.map((ti) => (
                      <option key={ti.id} value={ti.id}>
                        {ti.inward_no} • {ti.truck_number} ({ti.net_weight} KG)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Items Rows */}
              <div className="items-section-card">
                <div className="items-header-bar">
                  <h3>📦 Raw Material Line Items</h3>
                  <button type="button" className="btn-add-item-row" onClick={handleAddItemRow}>
                    ➕ Add Material Row
                  </button>
                </div>

                <table className="items-table">
                  <thead>
                    <tr>
                      <th style={{ width: "40%" }}>Scrap Raw Material</th>
                      <th style={{ width: "20%" }}>Quantity</th>
                      <th style={{ width: "15%" }}>Unit</th>
                      <th style={{ width: "15%" }}>Rate (₹)</th>
                      <th style={{ width: "10%" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((itm, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            value={itm.raw_material_id}
                            onChange={(e) => handleItemChange(idx, "raw_material_id", e.target.value)}
                            required
                          >
                            <option value="">-- Select Material --</option>
                            {rawMaterials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.material_name} [{m.plastic_type}]
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Qty"
                            value={itm.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <select
                            value={itm.unit}
                            onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                          >
                            <option value="KG">KG</option>
                            <option value="TON">TON</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Rate"
                            value={itm.rate}
                            onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                            required
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-remove-row"
                            onClick={() => handleRemoveItemRow(idx)}
                            title="Remove row"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation Summary */}
              <div className="bill-calc-summary">
                <div className="calc-row">
                  <span>Subtotal:</span>
                  <strong>₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                </div>

                <div className="calc-row">
                  <label>Discount Amount (₹):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discount_amount}
                    onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                    style={{ width: "120px", textAlign: "right" }}
                  />
                </div>

                {isTaxEnabled ? (
                  <div className="calc-row">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <label>GST Tax Rate (%):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.tax_percent}
                        onChange={(e) => setFormData({ ...formData, tax_percent: e.target.value })}
                        style={{ width: "80px", textAlign: "right" }}
                      />
                    </div>
                    <strong>+ ₹{taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                  </div>
                ) : (
                  <div className="calc-row gst-disabled-notice">
                    <span>GST / Tax:</span>
                    <span>Company Tax Disabled (0%)</span>
                  </div>
                )}

                <div className="calc-row grand-total-row">
                  <span>Grand Total:</span>
                  <strong>₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>

              <div className="form-group">
                <label>Notes / Terms</label>
                <textarea
                  rows="2"
                  placeholder="Payment notes, truck reference, or delivery quality remarks"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                ></textarea>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? "Generating Bill..." : "Create Purchase Bill & Update Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Purchase Bill Modal */}
      {viewBill && (
        <div className="plastic-modal-backdrop" onClick={() => setViewBill(null)}>
          <div className="bill-detail-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="bill-detail-paper">
              <div className="bill-header">
                <div>
                  <h2>RAW MATERIAL PURCHASE BILL</h2>
                  <span className="bill-number-display">{viewBill.purchase_bill_no}</span>
                </div>
                <div className="bill-meta-right">
                  <span><strong>Date:</strong> {new Date(viewBill.purchase_date).toLocaleDateString("en-IN")}</span>
                  <div style={{ marginTop: "6px" }}>
                    <span className={`payment-pill ${String(viewBill.payment_status).toLowerCase()}`}>
                      {viewBill.payment_status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bill-party-grid">
                <div className="party-box">
                  <h4>Supplier Details</h4>
                  <strong>{viewBill.supplier_name}</strong>
                  {viewBill.supplier_code && <span>Code: {viewBill.supplier_code}</span>}
                  {viewBill.supplier_mobile && <span>Mobile: {viewBill.supplier_mobile}</span>}
                  {viewBill.supplier_gst && <span>GSTIN: {viewBill.supplier_gst}</span>}
                  {viewBill.supplier_address && <p>{viewBill.supplier_address}</p>}
                </div>

                <div className="party-box">
                  <h4>Delivery Logistics</h4>
                  {viewBill.inward_no ? (
                    <>
                      <span>Inward Slip: {viewBill.inward_no}</span>
                      <span>Truck Number: {viewBill.truck_number}</span>
                      <span>Net Weight: {viewBill.truck_net_weight} KG</span>
                    </>
                  ) : (
                    <span>Direct Scrap Procurement</span>
                  )}
                  {viewBill.notes && <p style={{ marginTop: "8px" }}><strong>Notes:</strong> {viewBill.notes}</p>}
                </div>
              </div>

              <table className="bill-items-table">
                <thead>
                  <tr>
                    <th>Material Code</th>
                    <th>Polymer / Scrap Material</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th>Rate</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(viewBill.items) &&
                    viewBill.items.map((itm) => (
                      <tr key={itm.id}>
                        <td><code>{itm.material_code || "—"}</code></td>
                        <td><strong>{itm.material_name}</strong> {itm.plastic_type ? `[${itm.plastic_type}]` : ""}</td>
                        <td>{Number(itm.quantity).toLocaleString("en-IN")}</td>
                        <td>{itm.unit}</td>
                        <td>₹{Number(itm.rate).toFixed(2)}</td>
                        <td><strong>₹{Number(itm.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></td>
                      </tr>
                    ))}
                </tbody>
              </table>

              <div className="bill-footer-calc">
                <div>
                  <span>Subtotal:</span>
                  <strong>₹{Number(viewBill.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                </div>
                {Number(viewBill.discount_amount) > 0 && (
                  <div>
                    <span>Discount:</span>
                    <strong>- ₹{Number(viewBill.discount_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
                <div>
                  <span>GST ({Number(viewBill.tax_percent || 0)}%):</span>
                  <strong>+ ₹{Number(viewBill.tax_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                </div>
                <div className="bill-final-row">
                  <span>Grand Total:</span>
                  <strong className="bill-final-amt">
                    ₹{Number(viewBill.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              <div className="payment-updater-bar">
                <span>Update Payment Status:</span>
                {["UNPAID", "PARTIAL", "PAID"].map((pst) => (
                  <button
                    key={pst}
                    type="button"
                    className={`btn-pay-status ${viewBill.payment_status === pst ? "active" : ""}`}
                    onClick={() => handleUpdatePaymentStatus(viewBill.id, pst)}
                  >
                    {pst}
                  </button>
                ))}
              </div>
            </div>

            <div className="slip-modal-actions">
              <button type="button" className="btn-print" onClick={() => window.print()}>
                🖨️ Print Bill
              </button>
              <button type="button" className="btn-cancel" onClick={() => setViewBill(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticPurchaseBills;
