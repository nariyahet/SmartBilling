import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Modal, Button, StatusBadge } from "../components";
import "./PlasticDebitNotes.css";

function PlasticDebitNotes() {
  const [loading, setLoading] = useState(true);
  const [debitNotes, setDebitNotes] = useState([]);
  const [customers, setCustomers] = useState([]);
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
    debit_note_date: new Date().toISOString().split("T")[0],
    reason: "PRICE_DIFFERENCE",
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
      const [dnRes, custRes, compRes] = await Promise.all([
        API.get("/plastic-erp/debit-notes"),
        API.get("/customers"),
        API.get("/company/profile").catch(() => ({ data: {} })),
      ]);

      if (dnRes.data?.success) setDebitNotes(dnRes.data.debitNotes || []);
      if (custRes.data?.customers) setCustomers(custRes.data.customers || []);
      if (compRes.data?.company) setCompanyInfo(compRes.data.company);
    } catch (err) {
      console.error("Failed to load debit notes:", err);
      alert("Failed to load debit notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddItem = () => {
    if (!newItem.description.trim() || Number(newItem.rate) <= 0) {
      alert("Please enter a valid description and positive rate.");
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

  const handleCreateDebitNote = async (e) => {
    e.preventDefault();
    if (!formData.customer_id) {
      alert("Please select a customer.");
      return;
    }
    if (formData.items.length === 0) {
      alert("Please add at least one debit note line item.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await API.post("/plastic-erp/debit-notes", formData);
      if (res.data?.success) {
        alert(res.data.message || "Debit note issued and customer ledger debited!");
        setCreateModalOpen(false);
        setFormData({
          customer_id: "",
          debit_note_date: new Date().toISOString().split("T")[0],
          reason: "PRICE_DIFFERENCE",
          notes: "",
          items: [],
        });
        fetchData();
      }
    } catch (err) {
      console.error("Create Debit Note Error:", err);
      alert(err.response?.data?.message || "Failed to create debit note");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewPreview = async (dnId) => {
    try {
      const res = await API.get(`/plastic-erp/debit-notes/${dnId}`);
      if (res.data?.success) {
        setSelectedNote(res.data.debitNote);
        setPreviewModalOpen(true);
      }
    } catch (err) {
      console.error("Fetch Note Error:", err);
      alert("Failed to load debit note details");
    }
  };

  // KPIs
  const totalNotesCount = debitNotes.length;
  const totalDebitIssued = debitNotes.reduce((sum, d) => sum + Number(d.total || 0), 0);

  const filteredNotes = debitNotes.filter((d) => {
    if (customerFilter && String(d.customer_id) !== String(customerFilter)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const numMatch = String(d.debit_note_no || "").toLowerCase().includes(q);
      const custMatch = String(d.customer_name || "").toLowerCase().includes(q);
      if (!numMatch && !custMatch) return false;
    }
    return true;
  });

  if (loading) return <LoadingScreen message="Loading Debit Notes..." />;

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <div className="plastic-container sb-page-container">
        {/* Header */}
        <PageHeader
          title="Debit Notes (DN)"
          subtitle="Issue Supplementary Debit Notes for unbilled freight, upward price revisions, or interest penalties."
          badge="SUPPLEMENTARY INVOICING"
          actions={
            <div className="pdn-header-actions">
              <Link to="/plastic-erp/finance/receivables" className="sb-link-btn">
                <Button variant="secondary" size="md">Receivables Dashboard</Button>
              </Link>
              <Link to="/plastic-erp/finance/credit-notes" className="sb-link-btn">
                <Button variant="secondary" size="md">Credit Notes</Button>
              </Link>
              <Button variant="primary" size="md" onClick={() => setCreateModalOpen(true)}>
                + Issue Debit Note
              </Button>
            </div>
          }
        />

        {/* KPIs */}
        <div className="pdn-kpis">
          <KpiCard
            title="Debit Notes Issued"
            value={totalNotesCount}
            subtitle="Registered supplementary billings"
            variant="default"
          />
          <KpiCard
            title="Total Supplementary Value"
            value={`₹${totalDebitIssued.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            subtitle="Direct customer debits"
            variant="primary"
          />
        </div>

        {/* Filters */}
        <Card className="pdn-filters-card">
          <div className="pdn-filters">
            <input
              type="text"
              className="sb-input pdn-search"
              placeholder="Search Debit Note #, Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className="sb-select pdn-select"
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
        <Card title={`Debit Notes (${filteredNotes.length})`}>
          {filteredNotes.length === 0 ? (
            <div className="pdn-empty">No debit notes found.</div>
          ) : (
            <div className="pdn-table-wrap">
              <table className="pdn-table">
                <thead>
                  <tr>
                    <th>Debit Note #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Reason</th>
                    <th>Subtotal (₹)</th>
                    <th>Tax (₹)</th>
                    <th>Total (₹)</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotes.map((dn) => (
                    <tr key={dn.id}>
                      <td className="font-bold text-primary">{dn.debit_note_no}</td>
                      <td>
                        {dn.debit_note_date
                          ? new Date(dn.debit_note_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <strong>{dn.customer_name}</strong>
                      </td>
                      <td>{dn.reason}</td>
                      <td>₹{Number(dn.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td>₹{Number(dn.tax || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="font-bold text-primary">
                        ₹{Number(dn.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <StatusBadge
                          status={dn.status || "ISSUED"}
                          variant={dn.status === "CANCELLED" ? "danger" : "info"}
                        />
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleViewPreview(dn.id)}
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
          title="Issue Debit Note"
          size="lg"
        >
          <form onSubmit={handleCreateDebitNote} className="modal-form">
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
                <label>Date *</label>
                <input
                  type="date"
                  className="sb-input"
                  value={formData.debit_note_date}
                  onChange={(e) =>
                    setFormData({ ...formData, debit_note_date: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="form-col mt-3">
              <label>Reason for Debit Note</label>
              <select
                className="sb-select"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              >
                <option value="PRICE_DIFFERENCE">Rate Revision / Price Increase</option>
                <option value="UNBILLED_FREIGHT">Unbilled Freight & Transport Charges</option>
                <option value="INTEREST_OVERDUE">Late Payment Interest Charges</option>
                <option value="OTHER">Other Supplementary Charge</option>
              </select>
            </div>

            {/* Items Section */}
            <div className="modal-section-title mt-4">Debit Line Items</div>
            <div className="item-builder">
              <div className="builder-field flex-2">
                <label>Particulars / Charge Description *</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="e.g. Freight surcharge for heavy vehicle delivery"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                />
              </div>

              <div className="builder-field">
                <label>Quantity</label>
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
                  <option value="18">18% (Standard)</option>
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
                        No charges added yet.
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
                {submitting ? "Issuing..." : "Issue Debit Note"}
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
          title={`Debit Note: ${selectedNote.debit_note_no}`}
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
                <div className="title-tag text-primary">DEBIT NOTE</div>
                <div className="title-sub">(Section 34 of CGST Act)</div>
                <div className="doc-num">DN No: <span>{selectedNote.debit_note_no}</span></div>
                <div className="doc-date">Date: <span>{selectedNote.debit_note_date ? new Date(selectedNote.debit_note_date).toLocaleDateString() : ""}</span></div>
              </div>
            </div>

            <div className="challan-meta-grid">
              <div className="meta-box">
                <div className="meta-box-title">DEBIT ISSUED TO</div>
                <div className="meta-val bold">{selectedNote.customer_name}</div>
                <div className="meta-val">{selectedNote.customer_address}</div>
                <div className="meta-val">Mobile: {selectedNote.customer_mobile || "—"}</div>
              </div>
              <div className="meta-box">
                <div className="meta-box-title">REASON / PARTICULARS</div>
                <div className="meta-row">
                  <span>Charge Type:</span>
                  <strong>{selectedNote.reason}</strong>
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
                    Grand Total Debit:
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "var(--sb-primary, #0879d1)" }}>
                    ₹{Number(selectedNote.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="challan-declaration mt-4">
              <p>
                This supplementary debit note increases taxable value and tax. The customer ledger has been debited accordingly.
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

export default PlasticDebitNotes;
