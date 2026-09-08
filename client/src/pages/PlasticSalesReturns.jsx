import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticSalesReturns.css";

function PlasticSalesReturns() {
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // New Return Form
  const [formData, setFormData] = useState({
    customer_id: "",
    invoice_id: "",
    return_date: new Date().toISOString().split("T")[0],
    reason: "QUALITY_REJECTION",
    notes: "",
    items: [],
  });

  const [newItem, setNewItem] = useState({
    finished_good_id: "",
    return_quantity: 50,
    rate: 0,
    unit: "KG",
    return_reason: "Color Mismatch / Off-spec",
  });

  // Completion / Disposition Form
  const [dispositionData, setDispositionData] = useState({
    items: [],
    generate_credit_note: true,
    credit_amount: 0,
    notes: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [retRes, custRes, invRes, fgRes] = await Promise.all([
        API.get("/plastic-erp/sales-returns"),
        API.get("/customers"),
        API.get("/invoices"),
        API.get("/plastic-erp/inventory/finished-goods"),
      ]);

      if (retRes.data?.success) setReturns(retRes.data.returns || []);
      if (custRes.data?.customers) setCustomers(custRes.data.customers || []);
      if (invRes.data?.invoices) setInvoices(invRes.data.invoices || []);
      if (fgRes.data?.finishedGoods) setFinishedGoods(fgRes.data.finishedGoods || []);
    } catch (err) {
      console.error("Failed to load sales returns data:", err);
      alert("Failed to load sales returns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const handleAddItem = () => {
    if (!newItem.finished_good_id || Number(newItem.return_quantity) <= 0) {
      alert("Please select a product and valid return quantity.");
      return;
    }
    const fg = finishedGoods.find((f) => String(f.id) === String(newItem.finished_good_id));

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...newItem,
          fg_name: fg ? fg.fg_name : "Product",
          fg_code: fg ? fg.fg_code : "",
          return_quantity: Number(newItem.return_quantity),
          rate: Number(newItem.rate) || 0,
        },
      ],
    }));

    setNewItem({
      finished_good_id: "",
      return_quantity: 50,
      rate: 0,
      unit: "KG",
      return_reason: "Color Mismatch / Off-spec",
    });
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleCreateReturn = async (e) => {
    e.preventDefault();
    if (!formData.customer_id) {
      alert("Please select a customer");
      return;
    }
    if (formData.items.length === 0) {
      alert("Please add at least one returned item");
      return;
    }

    try {
      setSubmitting(true);
      const res = await API.post("/plastic-erp/sales-returns", formData);
      if (res.data?.success) {
        alert(res.data.message || "Sales return logged successfully");
        setCreateModalOpen(false);
        setFormData({
          customer_id: "",
          invoice_id: "",
          return_date: new Date().toISOString().split("T")[0],
          reason: "QUALITY_REJECTION",
          notes: "",
          items: [],
        });
        fetchData();
      }
    } catch (err) {
      console.error("Create Return Error:", err);
      alert(err.response?.data?.message || "Failed to log sales return");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCompleteModal = async (ret) => {
    try {
      const res = await API.get(`/plastic-erp/sales-returns/${ret.id}`);
      if (res.data?.success) {
        const fullRet = res.data.salesReturn;
        setSelectedReturn(fullRet);

        let calculatedCredit = 0;
        const initItems = (fullRet.items || []).map((it) => {
          const qty = Number(it.return_quantity || 0);
          const rate = Number(it.rate || 0);
          calculatedCredit += qty * rate;
          return {
            return_item_id: it.id,
            fg_name: it.fg_name,
            total_qty: qty,
            accepted_quantity: qty,
            rejected_quantity: 0,
            rate: rate,
            action: "RESTOCK_FG",
          };
        });

        setDispositionData({
          items: initItems,
          generate_credit_note: true,
          credit_amount: calculatedCredit,
          notes: "Material inspected by QC. Credit note approved.",
        });

        setCompleteModalOpen(true);
      }
    } catch (err) {
      console.error("Fetch Return Details Error:", err);
      alert("Failed to load return details");
    }
  };

  const handleDispositionItemChange = (index, field, val) => {
    const updated = [...dispositionData.items];
    updated[index][field] = val;

    if (field === "accepted_quantity") {
      const acc = Number(val) || 0;
      updated[index].rejected_quantity = Math.max(0, updated[index].total_qty - acc);
    } else if (field === "rejected_quantity") {
      const rej = Number(val) || 0;
      updated[index].accepted_quantity = Math.max(0, updated[index].total_qty - rej);
    }

    // Recalculate credit
    const totalCredit = updated.reduce(
      (sum, it) => sum + (Number(it.accepted_quantity) + Number(it.rejected_quantity)) * Number(it.rate || 0),
      0
    );

    setDispositionData((prev) => ({
      ...prev,
      items: updated,
      credit_amount: totalCredit,
    }));
  };

  const handleCompleteReturn = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await API.patch(
        `/plastic-erp/sales-returns/${selectedReturn.id}/complete`,
        dispositionData
      );
      if (res.data?.success) {
        alert(res.data.message || "Return completed, inventory updated, and credit note created!");
        setCompleteModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error("Complete Return Error:", err);
      alert(err.response?.data?.message || "Failed to complete return");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalReturnsCount = returns.length;
  const pendingInspectionCount = returns.filter(
    (r) => r.status === "RECEIVED" || r.status === "INSPECTED"
  ).length;
  const completedReturnsCount = returns.filter((r) => r.status === "COMPLETED").length;
  const totalVolumeReturned = returns.reduce(
    (sum, r) => sum + (Number(r.total_return_qty) || 0),
    0
  );

  const filteredReturns = returns.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (customerFilter && String(r.customer_id) !== String(customerFilter)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const numMatch = String(r.return_no || "").toLowerCase().includes(q);
      const custMatch = String(r.customer_name || "").toLowerCase().includes(q);
      const invMatch = String(r.invoice_no || "").toLowerCase().includes(q);
      if (!numMatch && !custMatch && !invMatch) return false;
    }
    return true;
  });

  if (loading) return <LoadingScreen message="Loading Sales Returns..." />;

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <div className="plastic-container">
        {/* Header */}
        <div className="pret-header">
          <div>
            <span className="pret-badge">QUALITY & REVERSE LOGISTICS</span>
            <h1 className="pret-title">Sales Returns & QC Disposition</h1>
            <p className="pret-subtitle">
              Log customer rejections, run QC inspections, restock usable granules, and issue credit notes.
            </p>
          </div>
          <div className="pret-header-actions">
            <Link to="/plastic-erp/finance/credit-notes" className="pret-btn pret-btn-outline">
              Credit Notes
            </Link>
            <button className="pret-btn pret-btn-primary" onClick={() => setCreateModalOpen(true)}>
              + Log Sales Return
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="pret-kpis">
          <div className="pret-kpi-card">
            <div className="pret-kpi-val">{totalReturnsCount}</div>
            <div className="pret-kpi-lbl">Total Returns Logged</div>
          </div>
          <div className="pret-kpi-card warning">
            <div className="pret-kpi-val">{pendingInspectionCount}</div>
            <div className="pret-kpi-lbl">Pending QC & Disposition</div>
          </div>
          <div className="pret-kpi-card success">
            <div className="pret-kpi-val">{completedReturnsCount}</div>
            <div className="pret-kpi-lbl">Settled & Completed</div>
          </div>
          <div className="pret-kpi-card info">
            <div className="pret-kpi-val">
              {totalVolumeReturned.toLocaleString()} <span className="pret-unit">KG</span>
            </div>
            <div className="pret-kpi-lbl">Returned Volume</div>
          </div>
        </div>

        {/* Filters */}
        <div className="pret-filters">
          <input
            type="text"
            className="pret-search"
            placeholder="Search by Return #, Customer, Invoice #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="pret-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="RECEIVED">Received (Pending QC)</option>
            <option value="INSPECTED">Inspected</option>
            <option value="COMPLETED">Completed (Restocked / Credited)</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            className="pret-select"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          >
            <option value="">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {(statusFilter || customerFilter || searchQuery) && (
            <button
              className="pret-btn-reset"
              onClick={() => {
                setStatusFilter("");
                setCustomerFilter("");
                setSearchQuery("");
              }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Returns Table */}
        <div className="pret-card">
          <div className="pret-card-header">
            <h3>Sales Returns ({filteredReturns.length})</h3>
          </div>
          {filteredReturns.length === 0 ? (
            <div className="pret-empty">No sales returns found.</div>
          ) : (
            <div className="pret-table-wrap">
              <table className="pret-table">
                <thead>
                  <tr>
                    <th>Return #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Orig. Invoice</th>
                    <th>Reason</th>
                    <th>Qty (KG)</th>
                    <th>Status</th>
                    <th>Credit Note</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.map((r) => (
                    <tr key={r.id}>
                      <td className="font-bold text-primary">{r.return_no}</td>
                      <td>{r.return_date ? new Date(r.return_date).toLocaleDateString() : "—"}</td>
                      <td>
                        <strong>{r.customer_name}</strong>
                      </td>
                      <td>
                        {r.invoice_no ? (
                          <Link to={`/invoices/${r.invoice_id}`} className="inv-link">
                            {r.invoice_no}
                          </Link>
                        ) : (
                          <span className="text-muted">Unlinked</span>
                        )}
                      </td>
                      <td>{r.reason}</td>
                      <td>
                        <strong>{Number(r.total_return_qty || 0).toLocaleString()} KG</strong>
                      </td>
                      <td>
                        <span className={`status-pill ${String(r.status).toLowerCase()}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        {r.credit_note_no ? (
                          <span className="cn-badge">{r.credit_note_no}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="pret-actions">
                          {r.status !== "COMPLETED" ? (
                            <button
                              className="btn-disp"
                              onClick={() => handleOpenCompleteModal(r)}
                              title="QC Inspection & Restock"
                            >
                              QC & Restock
                            </button>
                          ) : (
                            <button
                              className="btn-disp view"
                              onClick={() => handleOpenCompleteModal(r)}
                            >
                              Details
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* LOG SALES RETURN MODAL */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container large">
            <div className="modal-header">
              <h2>Log Inward Sales Return</h2>
              <button className="close-btn" onClick={() => setCreateModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateReturn} className="modal-form">
              <div className="form-row">
                <div className="form-col">
                  <label>Customer *</label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    required
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-col">
                  <label>Original Invoice (Optional)</label>
                  <select
                    value={formData.invoice_id}
                    onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value })}
                  >
                    <option value="">Direct Return (No Invoice)</option>
                    {invoices
                      .filter(
                        (inv) =>
                          !formData.customer_id ||
                          String(inv.customer_id) === String(formData.customer_id)
                      )
                      .map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_no} (₹{inv.grand_total})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-col">
                  <label>Return Date *</label>
                  <input
                    type="date"
                    value={formData.return_date}
                    onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-col">
                <label>Primary Return Reason</label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                >
                  <option value="QUALITY_REJECTION">Quality Rejection (MFI / Density / Tensile)</option>
                  <option value="COLOR_MISMATCH">Color Mismatch / Off-spec Tint</option>
                  <option value="CONTAMINATION">Dust / Moisture / Impurity Contamination</option>
                  <option value="TRANSIT_DAMAGE">Transit Damage / Burst Bags</option>
                  <option value="EXCESS_ORDER">Excess Shipment / Customer Cancelled</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>

              {/* Items Section */}
              <div className="modal-section-title">Returned Products</div>
              <div className="item-builder">
                <div className="builder-field flex-2">
                  <label>Product (Finished Good) *</label>
                  <select
                    value={newItem.finished_good_id}
                    onChange={(e) => setNewItem({ ...newItem, finished_good_id: e.target.value })}
                  >
                    <option value="">Select Finished Good</option>
                    {finishedGoods.map((fg) => (
                      <option key={fg.id} value={fg.id}>
                        {fg.fg_name} ({fg.fg_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="builder-field">
                  <label>Return Qty (KG) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.return_quantity}
                    onChange={(e) =>
                      setNewItem({ ...newItem, return_quantity: e.target.value })
                    }
                  />
                </div>

                <div className="builder-field">
                  <label>Rate / KG (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.rate}
                    onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                  />
                </div>

                <button type="button" className="btn-add-item" onClick={handleAddItem}>
                  + Add Item
                </button>
              </div>

              <div className="item-table-wrap">
                <table className="challan-item-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Rate (₹)</th>
                      <th>Amount (₹)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted">
                          No return items added.
                        </td>
                      </tr>
                    ) : (
                      formData.items.map((it, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{it.fg_name}</strong>
                            <div className="text-muted text-sm">{it.fg_code}</div>
                          </td>
                          <td>
                            <strong>{it.return_quantity} {it.unit}</strong>
                          </td>
                          <td>₹{Number(it.rate).toFixed(2)}</td>
                          <td>₹{(Number(it.return_quantity) * Number(it.rate)).toFixed(2)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn-del"
                              onClick={() => handleRemoveItem(idx)}
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="form-col mt-3">
                <label>Customer Complaint / Notes</label>
                <textarea
                  rows="2"
                  placeholder="Customer feedback, delivery batch details, etc."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                ></textarea>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="pret-btn pret-btn-outline"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pret-btn pret-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Logging..." : "Log Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QC INSPECTION & DISPOSITION MODAL */}
      {completeModalOpen && selectedReturn && (
        <div className="modal-overlay">
          <div className="modal-container large">
            <div className="modal-header">
              <h2>QC Disposition: {selectedReturn.return_no}</h2>
              <button className="close-btn" onClick={() => setCompleteModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCompleteReturn} className="modal-form">
              <div className="qc-banner">
                <div>
                  <strong>Customer:</strong> {selectedReturn.customer_name}
                </div>
                <div>
                  <strong>Logged Date:</strong> {selectedReturn.return_date}
                </div>
                <div>
                  <strong>Reason:</strong> {selectedReturn.reason}
                </div>
              </div>

              <div className="modal-section-title">QC Inspection & Inventory Disposition</div>
              <div className="qc-table-wrap">
                <table className="qc-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Total Ret. (KG)</th>
                      <th>Accepted (KG)</th>
                      <th>Rejected (KG)</th>
                      <th>Disposition Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispositionData.items.map((it, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{it.fg_name}</strong>
                        </td>
                        <td>{it.total_qty} KG</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={it.total_qty}
                            step="0.01"
                            value={it.accepted_quantity}
                            onChange={(e) =>
                              handleDispositionItemChange(idx, "accepted_quantity", e.target.value)
                            }
                            disabled={selectedReturn.status === "COMPLETED"}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={it.total_qty}
                            step="0.01"
                            value={it.rejected_quantity}
                            onChange={(e) =>
                              handleDispositionItemChange(idx, "rejected_quantity", e.target.value)
                            }
                            disabled={selectedReturn.status === "COMPLETED"}
                          />
                        </td>
                        <td>
                          <select
                            value={it.action}
                            onChange={(e) =>
                              handleDispositionItemChange(idx, "action", e.target.value)
                            }
                            disabled={selectedReturn.status === "COMPLETED"}
                          >
                            <option value="RESTOCK_FG">Restock Accepted to FG Inventory</option>
                            <option value="CONVERT_TO_SCRAP">Send Rejected to Scrap/Regrind</option>
                            <option value="DISPOSE">Dispose / Scrapped Off-site</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedReturn.status !== "COMPLETED" && (
                <div className="credit-note-box">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={dispositionData.generate_credit_note}
                      onChange={(e) =>
                        setDispositionData({
                          ...dispositionData,
                          generate_credit_note: e.target.checked,
                        })
                      }
                    />
                    <span>
                      <strong>Generate Official Credit Note & Post Ledger Credit</strong>
                    </span>
                  </label>

                  {dispositionData.generate_credit_note && (
                    <div className="form-row mt-2">
                      <div className="form-col">
                        <label>Credit Note Amount (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={dispositionData.credit_amount}
                          onChange={(e) =>
                            setDispositionData({
                              ...dispositionData,
                              credit_amount: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="form-col mt-3">
                <label>QC Lab Notes / Final Remarks</label>
                <textarea
                  rows="2"
                  value={dispositionData.notes}
                  onChange={(e) =>
                    setDispositionData({ ...dispositionData, notes: e.target.value })
                  }
                  disabled={selectedReturn.status === "COMPLETED"}
                ></textarea>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="pret-btn pret-btn-outline"
                  onClick={() => setCompleteModalOpen(false)}
                >
                  Close
                </button>
                {selectedReturn.status !== "COMPLETED" && (
                  <button
                    type="submit"
                    className="pret-btn pret-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? "Processing..." : "Complete & Restock Inventory"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticSalesReturns;
