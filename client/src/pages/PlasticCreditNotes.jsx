import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Modal, Button, StatusBadge } from "../components";
import "./PlasticCreditNotes.css";

function PlasticCreditNotes() {
  const [loading, setLoading] = useState(true);
  const [creditNotes, setCreditNotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    customer_id: "",
    original_invoice_id: "",
    credit_note_date: new Date().toISOString().split("T")[0],
    reason: "SALES_RETURN",
    notes: "",
    items: [],
  });

  const [newItem, setNewItem] = useState({
    description: "",
    quantity: 1,
    rate: 0,
    tax_rate: 18,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cnRes, custRes, invRes, compRes] = await Promise.all([
        API.get("/plastic-erp/credit-notes"),
        API.get("/customers"),
        API.get("/invoices"),
        API.get("/company/profile").catch(() => ({ data: {} })),
      ]);

      if (cnRes.data?.success) setCreditNotes(cnRes.data.creditNotes || []);
      if (custRes.data?.customers) setCustomers(custRes.data.customers || []);
      if (invRes.data?.invoices) setInvoices(invRes.data.invoices || []);
      if (compRes.data?.company) setCompanyInfo(compRes.data.company);
    } catch (err) {
      console.error("Failed to load credit notes:", err);
      alert("Failed to load credit notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddItem = () => {
    if (!newItem.description.trim() || Number(newItem.rate) <= 0) {
      alert("Please enter a description and valid rate.");
      return;
    }
    const qty = Number(newItem.quantity) || 1;
    const rate = Number(newItem.rate) || 0;
    const taxRate = Number(newItem.tax_rate) || 0;
    const subtotal = qty * rate;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...newItem,
          quantity: qty,
          rate: rate,
          tax_rate: taxRate,
          subtotal: subtotal,
          tax_amount: taxAmount,
          amount: total,
        },
      ],
    }));

    setNewItem({
      description: "",
      quantity: 1,
      rate: 0,
      tax_rate: 18,
    });
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleCreateCreditNote = async (e) => {
    e.preventDefault();
    if (!formData.customer_id) {
      alert("Please select a customer.");
      return;
    }
    if (formData.items.length === 0) {
      alert("Please add at least one credit note line item.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await API.post("/plastic-erp/credit-notes", formData);
      if (res.data?.success) {
        alert(res.data.message || "Credit note issued and customer ledger updated!");
        setCreateModalOpen(false);
        setFormData({
          customer_id: "",
          original_invoice_id: "",
          credit_note_date: new Date().toISOString().split("T")[0],
          reason: "SALES_RETURN",
          notes: "",
          items: [],
        });
        fetchData();
      }
    } catch (err) {
      console.error("Create Credit Note Error:", err);
      alert(err.response?.data?.message || "Failed to create credit note");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewPreview = async (cnId) => {
    try {
      const res = await API.get(`/plastic-erp/credit-notes/${cnId}`);
      if (res.data?.success) {
        setSelectedNote(res.data.creditNote);
        setPreviewModalOpen(true);
      }
    } catch (err) {
      console.error("Fetch Note Error:", err);
      alert("Failed to load credit note details");
    }
  };

  // KPIs
  const totalNotesCount = creditNotes.length;
  const totalCreditIssued = creditNotes.reduce((sum, c) => sum + Number(c.total || 0), 0);

  const filteredNotes = creditNotes.filter((c) => {
    if (customerFilter && String(c.customer_id) !== String(customerFilter)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const numMatch = String(c.credit_note_no || "").toLowerCase().includes(q);
      const custMatch = String(c.customer_name || "").toLowerCase().includes(q);
      const invMatch = String(c.original_invoice_no || "").toLowerCase().includes(q);
      if (!numMatch && !custMatch && !invMatch) return false;
    }
    return true;
  });

  if (loading) return <LoadingScreen message="Loading Credit Notes..." />;

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <div className="plastic-container sb-page-container">
        {/* Header */}
        <PageHeader
          title="Credit Notes (CN)"
          subtitle="Issue GST Credit Notes for sales returns, rate differences, discounts, or damaged material."
          badge="ADJUSTMENT NOTE"
          actions={
            <div className="pcn-header-actions">
              <Link to="/plastic-erp/finance/receivables" className="sb-link-btn">
                <Button variant="secondary" size="md">Receivables Dashboard</Button>
              </Link>
              <Link to="/plastic-erp/finance/debit-notes" className="sb-link-btn">
                <Button variant="secondary" size="md">Debit Notes</Button>
              </Link>
              <Button variant="primary" size="md" onClick={() => setCreateModalOpen(true)}>
                + Issue Credit Note
              </Button>
            </div>
          }
        />

        {/* KPIs */}
        <div className="pcn-kpis">
          <KpiCard
            title="Credit Notes Issued"
            value={totalNotesCount}
            subtitle="Total registered documents"
            variant="default"
          />
          <KpiCard
            title="Total Credit Value"
            value={`₹${totalCreditIssued.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            subtitle="Ledger adjustment sum"
            variant="warning"
          />
        </div>

        {/* Filters */}
        <Card className="pcn-filters-card">
          <div className="pcn-filters">
            <input
              type="text"
              className="sb-input pcn-search"
              placeholder="Search Credit Note #, Customer, Invoice #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className="sb-select pcn-select"
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
          </div>
        </Card>

        {/* Notes Table */}
        <Card title={`Credit Notes (${filteredNotes.length})`}>
          {filteredNotes.length === 0 ? (
            <div className="pcn-empty">No credit notes found.</div>
          ) : (
            <div className="pcn-table-wrap">
              <table className="pcn-table">
                <thead>
                  <tr>
                    <th>Credit Note #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Orig. Invoice</th>
                    <th>Reason</th>
                    <th>Subtotal (₹)</th>
                    <th>Tax (₹)</th>
                    <th>Total (₹)</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotes.map((cn) => (
                    <tr key={cn.id}>
                      <td className="font-bold text-primary">{cn.credit_note_no}</td>
                      <td>
                        {cn.credit_note_date
                          ? new Date(cn.credit_note_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <strong>{cn.customer_name}</strong>
                      </td>
                      <td>{cn.original_invoice_no || "—"}</td>
                      <td>{cn.reason}</td>
                      <td>₹{Number(cn.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td>₹{Number(cn.tax || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="font-bold text-danger">
                        ₹{Number(cn.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <StatusBadge
                          status={cn.status || "ISSUED"}
                          variant={cn.status === "CANCELLED" ? "danger" : "success"}
                        />
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleViewPreview(cn.id)}
                        >
                          Print / View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* CREATE MODAL */}
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Issue Credit Note"
          size="lg"
        >
          <form onSubmit={handleCreateCreditNote} className="modal-form">
            <div className="form-row">
              <div className="form-col">
                <label>Customer *</label>
                <select
                  className="sb-select"
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
                  className="sb-select"
                  value={formData.original_invoice_id}
                  onChange={(e) =>
                    setFormData({ ...formData, original_invoice_id: e.target.value })
                  }
                >
                  <option value="">No Invoice Linked</option>
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
                <label>Date *</label>
                <input
                  type="date"
                  className="sb-input"
                  value={formData.credit_note_date}
                  onChange={(e) =>
                    setFormData({ ...formData, credit_note_date: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="form-col mt-3">
              <label>Reason for Credit Note</label>
              <select
                className="sb-select"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              >
                <option value="SALES_RETURN">Sales Return / Rejection</option>
                <option value="RATE_DIFFERENCE">Rate Difference / Price Correction</option>
                <option value="DISCOUNT">Post-Sale Volume Discount</option>
                <option value="DAMAGED_GOODS">Damaged in Transit / Quality Deduction</option>
                <option value="OTHER">Other Reason</option>
              </select>
            </div>

            {/* Items Section */}
            <div className="modal-section-title mt-4">Credit Line Items</div>
            <div className="item-builder">
              <div className="builder-field flex-2">
                <label>Particulars / Item Description *</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="e.g. PP Granules Milky White Price Difference"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                />
              </div>

              <div className="builder-field">
                <label>Qty (KG/Nos)</label>
                <input
                  type="number"
                  step="0.01"
                  className="sb-input"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                />
              </div>

              <div className="builder-field">
                <label>Rate (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="sb-input"
                  value={newItem.rate}
                  onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                />
              </div>

              <div className="builder-field">
                <label>GST Rate (%)</label>
                <select
                  className="sb-select"
                  value={newItem.tax_rate}
                  onChange={(e) => setNewItem({ ...newItem, tax_rate: e.target.value })}
                >
                  <option value="0">0% (Nil)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18% (Standard Plastic)</option>
                  <option value="28">28%</option>
                </select>
              </div>

              <Button type="button" variant="secondary" size="md" onClick={handleAddItem} className="btn-add-item-align">
                + Add Line
              </Button>
            </div>

            <div className="item-table-wrap">
              <table className="challan-item-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Rate (₹)</th>
                    <th>Tax (%)</th>
                    <th>Total (₹)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center text-muted">
                        No lines added yet.
                      </td>
                    </tr>
                  ) : (
                    formData.items.map((it, idx) => (
                      <tr key={idx}>
                        <td>{it.description}</td>
                        <td>{it.quantity}</td>
                        <td>₹{Number(it.rate).toFixed(2)}</td>
                        <td>{it.tax_rate}%</td>
                        <td>
                          <strong>₹{Number(it.amount).toFixed(2)}</strong>
                        </td>
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
              <label>Remarks</label>
              <textarea
                rows="2"
                className="sb-textarea"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              ></textarea>
            </div>

            <div className="modal-footer-actions">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={submitting}
              >
                {submitting ? "Issuing..." : "Issue Credit Note"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* PREVIEW & PRINT MODAL */}
      {previewModalOpen && selectedNote && (
        <Modal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          title={`Credit Note: ${selectedNote.credit_note_no}`}
          size="lg"
        >
          <div className="preview-action-row no-print">
            <Button variant="primary" size="md" onClick={() => window.print()}>
              🖨️ Print Note
            </Button>
          </div>

          <div className="challan-print-document">
            <div className="challan-doc-header">
              <div className="company-info">
                <h2>{companyInfo?.company_name || "PLASTIC RECYCLING & COMPOUNDING ERP"}</h2>
                <p>{companyInfo?.address || "Industrial Area, MIDC Phase II"}</p>
                <p>
                  GSTIN: <strong>{companyInfo?.gstin || "27AAAAA0000A1Z5"}</strong>
                </p>
              </div>
              <div className="challan-title-block">
                <div className="title-tag text-danger">CREDIT NOTE</div>
                <div className="title-sub">(Section 34 of CGST Act)</div>
                <div className="doc-num">CN No: <span>{selectedNote.credit_note_no}</span></div>
                <div className="doc-date">Date: <span>{selectedNote.credit_note_date ? new Date(selectedNote.credit_note_date).toLocaleDateString() : ""}</span></div>
              </div>
            </div>

            <div className="challan-meta-grid">
              <div className="meta-box">
                <div className="meta-box-title">CREDIT ISSUED TO</div>
                <div className="meta-val bold">{selectedNote.customer_name}</div>
                <div className="meta-val">{selectedNote.customer_address}</div>
                <div className="meta-val">Mobile: {selectedNote.customer_mobile || "—"}</div>
              </div>
              <div className="meta-box">
                <div className="meta-box-title">REFERENCE DETAILS</div>
                <div className="meta-row">
                  <span>Original Invoice:</span>
                  <strong>{selectedNote.original_invoice_no || "—"}</strong>
                </div>
                <div className="meta-row">
                  <span>Reason:</span>
                  <span>{selectedNote.reason}</span>
                </div>
              </div>
            </div>

            <table className="doc-items-table">
              <thead>
                <tr>
                  <th>S.N.</th>
                  <th>Particulars</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Rate (₹)</th>
                  <th style={{ textAlign: "right" }}>Subtotal (₹)</th>
                  <th style={{ textAlign: "right" }}>GST Rate</th>
                  <th style={{ textAlign: "right" }}>Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(selectedNote.items || []).map((it, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{it.description}</td>
                    <td style={{ textAlign: "right" }}>{it.quantity}</td>
                    <td style={{ textAlign: "right" }}>₹{Number(it.rate).toFixed(2)}</td>
                    <td style={{ textAlign: "right" }}>₹{Number(it.subtotal || it.quantity * it.rate).toFixed(2)}</td>
                    <td style={{ textAlign: "right" }}>{it.tax_rate}%</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>₹{Number(it.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="6" style={{ textAlign: "right", fontWeight: 700 }}>
                    Grand Total Credit:
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "var(--sb-danger, #e05252)" }}>
                    ₹{Number(selectedNote.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="challan-declaration mt-4">
              <p>
                This credit note adjusts the taxable value and tax on the goods/services supplied. The customer ledger has been credited accordingly.
              </p>
            </div>

            <div className="challan-signatures">
              <div></div>
              <div></div>
              <div className="sig-box">
                <div className="sig-line"></div>
                <span>Authorized Signatory</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default PlasticCreditNotes;
