import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticPayments.css";

function PlasticPayments() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerInvoices, setCustomerInvoices] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    customer_id: "",
    invoice_id: "",
    payment_date: new Date().toISOString().split("T")[0],
    amount: "",
    payment_mode: "BANK_TRANSFER",
    reference_number: "",
    bank_name: "",
    notes: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [payRes, custRes] = await Promise.all([
        API.get("/plastic-erp/payments"),
        API.get("/customers"),
      ]);

      if (payRes.data?.success) setPayments(payRes.data.payments || []);
      if (custRes.data?.customers) setCustomers(custRes.data.customers || []);
    } catch (err) {
      console.error("Failed to load payment data:", err);
      alert("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  // When customer is selected, fetch their unpaid/open invoices
  const handleCustomerSelect = async (custId) => {
    setFormData((prev) => ({ ...prev, customer_id: custId, invoice_id: "" }));
    if (!custId) {
      setCustomerInvoices([]);
      return;
    }
    try {
      const res = await API.get(`/invoices?customer_id=${custId}`);
      if (res.data?.invoices) {
        // filter unpaid or partially paid invoices
        const unpaid = res.data.invoices.filter(
          (inv) => inv.payment_status !== "PAID"
        );
        setCustomerInvoices(unpaid);
      }
    } catch (err) {
      console.error("Failed to fetch customer invoices:", err);
      setCustomerInvoices([]);
    }
  };

  const handleInvoiceSelect = (invId) => {
    const inv = customerInvoices.find((i) => String(i.id) === String(invId));
    if (inv) {
      const remaining = Math.max(0, Number(inv.grand_total) - Number(inv.paid_amount || 0));
      setFormData((prev) => ({
        ...prev,
        invoice_id: invId,
        amount: prev.amount || remaining.toString(),
      }));
    } else {
      setFormData((prev) => ({ ...prev, invoice_id: "" }));
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!formData.customer_id || Number(formData.amount) <= 0) {
      alert("Please select a customer and enter a valid positive amount.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await API.post("/plastic-erp/payments", formData);
      if (res.data?.success) {
        alert(res.data.message || "Payment recorded successfully!");
        setCreateModalOpen(false);
        setFormData({
          customer_id: "",
          invoice_id: "",
          payment_date: new Date().toISOString().split("T")[0],
          amount: "",
          payment_mode: "BANK_TRANSFER",
          reference_number: "",
          bank_name: "",
          notes: "",
        });
        setCustomerInvoices([]);
        fetchData();
      }
    } catch (err) {
      console.error("Record Payment Error:", err);
      alert(err.response?.data?.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPayment = async (paymentId) => {
    const reason = window.prompt("Enter reason for cancelling this payment receipt:");
    if (!reason) return;

    try {
      const res = await API.post(`/plastic-erp/payments/${paymentId}/cancel`, {
        reason,
      });
      if (res.data?.success) {
        alert("Payment receipt cancelled and customer ledger reversed.");
        fetchData();
      }
    } catch (err) {
      console.error("Cancel Payment Error:", err);
      alert(err.response?.data?.message || "Failed to cancel payment");
    }
  };

  const handleViewReceipt = (p) => {
    setSelectedPayment(p);
    setReceiptModalOpen(true);
  };

  // KPIs
  const activePayments = payments.filter((p) => p.status === "RECEIVED");
  const totalCollections = activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalCount = activePayments.length;
  const bankCollections = activePayments
    .filter((p) => ["BANK_TRANSFER", "NEFT", "RTGS", "UPI"].includes(p.payment_mode))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const cashCollections = activePayments
    .filter((p) => p.payment_mode === "CASH")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const filteredPayments = payments.filter((p) => {
    if (modeFilter && p.payment_mode !== modeFilter) return false;
    if (customerFilter && String(p.customer_id) !== String(customerFilter)) return false;
    if (fromDate && p.payment_date < fromDate) return false;
    if (toDate && p.payment_date > toDate) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const recMatch = String(p.payment_no || "").toLowerCase().includes(q);
      const custMatch = String(p.customer_name || "").toLowerCase().includes(q);
      const refMatch = String(p.reference_number || "").toLowerCase().includes(q);
      const invMatch = String(p.invoice_no || "").toLowerCase().includes(q);
      if (!recMatch && !custMatch && !refMatch && !invMatch) return false;
    }
    return true;
  });

  if (loading) return <LoadingScreen message="Loading Payment Collections..." />;

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <div className="plastic-container">
        {/* Header */}
        <div className="ppay-header">
          <div>
            <span className="ppay-badge">FINANCE & COLLECTIONS</span>
            <h1 className="ppay-title">Customer Payments & Receipts</h1>
            <p className="ppay-subtitle">
              Collect outstanding dues, link bank/UPI receipts to invoices, and update customer ledgers.
            </p>
          </div>
          <div className="ppay-header-actions">
            <Link to="/plastic-erp/finance/receivables" className="ppay-btn ppay-btn-outline">
              Aging & Receivables
            </Link>
            <Link to="/plastic-erp/finance/ledger" className="ppay-btn ppay-btn-outline">
              Customer Ledger
            </Link>
            <button
              className="ppay-btn ppay-btn-primary"
              onClick={() => {
                setFormData({
                  customer_id: "",
                  invoice_id: "",
                  payment_date: new Date().toISOString().split("T")[0],
                  amount: "",
                  payment_mode: "BANK_TRANSFER",
                  reference_number: "",
                  bank_name: "",
                  notes: "",
                });
                setCustomerInvoices([]);
                setCreateModalOpen(true);
              }}
            >
              + Record Payment
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="ppay-kpis">
          <div className="ppay-kpi-card success">
            <div className="ppay-kpi-val">₹{totalCollections.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <div className="ppay-kpi-lbl">Total Realized Collections</div>
          </div>
          <div className="ppay-kpi-card primary">
            <div className="ppay-kpi-val">₹{bankCollections.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <div className="ppay-kpi-lbl">Bank / NEFT / RTGS / UPI</div>
          </div>
          <div className="ppay-kpi-card warning">
            <div className="ppay-kpi-val">₹{cashCollections.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <div className="ppay-kpi-lbl">Cash Receipts</div>
          </div>
          <div className="ppay-kpi-card info">
            <div className="ppay-kpi-val">{totalCount}</div>
            <div className="ppay-kpi-lbl">Receipt Transactions</div>
          </div>
        </div>

        {/* Filters */}
        <div className="ppay-filters">
          <input
            type="text"
            className="ppay-search"
            placeholder="Search Receipt #, Customer, UTR / Ref, Invoice #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="ppay-select"
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
          >
            <option value="">All Payment Modes</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="UPI">UPI / QR</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CASH">Cash</option>
          </select>

          <select
            className="ppay-select"
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

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="ppay-date"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="ppay-date"
          />

          {(modeFilter || customerFilter || searchQuery || fromDate || toDate) && (
            <button
              className="ppay-btn-reset"
              onClick={() => {
                setModeFilter("");
                setCustomerFilter("");
                setSearchQuery("");
                setFromDate("");
                setToDate("");
              }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Payments Table */}
        <div className="ppay-card">
          <div className="ppay-card-header">
            <h3>Payment Receipts ({filteredPayments.length})</h3>
          </div>
          {filteredPayments.length === 0 ? (
            <div className="ppay-empty">No payment receipts found.</div>
          ) : (
            <div className="ppay-table-wrap">
              <table className="ppay-table">
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Mode</th>
                    <th>Ref / UTR</th>
                    <th>Invoice</th>
                    <th>Amount (₹)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className={p.status === "CANCELLED" ? "row-cancelled" : ""}>
                      <td className="font-bold text-primary">{p.payment_no}</td>
                      <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "—"}</td>
                      <td>
                        <strong>{p.customer_name}</strong>
                      </td>
                      <td>
                        <span className="mode-badge">{p.payment_mode}</span>
                      </td>
                      <td>
                        <div className="ref-cell">
                          <span>{p.reference_number || "—"}</span>
                          {p.bank_name && <small className="text-muted">{p.bank_name}</small>}
                        </div>
                      </td>
                      <td>
                        {p.invoice_no ? (
                          <Link to={`/invoices/${p.invoice_id}`} className="inv-link">
                            {p.invoice_no}
                          </Link>
                        ) : (
                          <span className="text-muted">On Account</span>
                        )}
                      </td>
                      <td className="font-bold text-success">
                        ₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={`status-tag ${String(p.status).toLowerCase()}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button
                            className="btn-action view"
                            onClick={() => handleViewReceipt(p)}
                            title="View Receipt"
                          >
                            Receipt
                          </button>
                          {p.status === "RECEIVED" && (
                            <button
                              className="btn-action cancel"
                              onClick={() => handleCancelPayment(p.id)}
                              title="Cancel & Reverse Ledger"
                            >
                              Cancel
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

      {/* RECORD PAYMENT MODAL */}
      {createModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>Record Customer Collection</h2>
              <button className="close-btn" onClick={() => setCreateModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="modal-form">
              <div className="form-group">
                <label>Customer *</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
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

              {formData.customer_id && (
                <div className="form-group">
                  <label>Allocate to Specific Invoice (Optional)</label>
                  <select
                    value={formData.invoice_id}
                    onChange={(e) => handleInvoiceSelect(e.target.value)}
                  >
                    <option value="">On Account (General Customer Balance)</option>
                    {customerInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoice_no} — Due: ₹
                        {(Number(inv.grand_total) - Number(inv.paid_amount || 0)).toFixed(2)} (Total: ₹
                        {Number(inv.grand_total).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-row">
                <div className="form-col">
                  <label>Collection Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 50000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="form-col">
                  <label>Payment Date *</label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-col">
                  <label>Payment Mode *</label>
                  <select
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                    required
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS)</option>
                    <option value="UPI">UPI / QR Payment</option>
                    <option value="CHEQUE">Cheque / Demand Draft</option>
                    <option value="CASH">Cash</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="form-col">
                  <label>Reference # / UTR / Cheque #</label>
                  <input
                    type="text"
                    placeholder="Transaction Reference"
                    value={formData.reference_number}
                    onChange={(e) =>
                      setFormData({ ...formData, reference_number: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Bank Name (Deposited to / Drawn on)</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank, SBI"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Payment Notes</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Cleared via RTGS, invoice #1002 balance settlement"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                ></textarea>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="ppay-btn ppay-btn-outline"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ppay-btn ppay-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Recording..." : "Save Payment & Update Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIPT VIEW MODAL */}
      {receiptModalOpen && selectedPayment && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>Receipt: {selectedPayment.payment_no}</h2>
              <button className="close-btn" onClick={() => setReceiptModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="receipt-box">
              <div className="receipt-stamp">PAYMENT RECEIVED</div>
              <div className="receipt-row">
                <span className="lbl">Received From:</span>
                <span className="val bold">{selectedPayment.customer_name}</span>
              </div>
              <div className="receipt-row">
                <span className="lbl">Receipt Date:</span>
                <span className="val">
                  {selectedPayment.payment_date ? new Date(selectedPayment.payment_date).toLocaleDateString() : ""}
                </span>
              </div>
              <div className="receipt-row">
                <span className="lbl">Amount Received:</span>
                <span className="val amount">
                  ₹{Number(selectedPayment.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="receipt-row">
                <span className="lbl">Payment Mode:</span>
                <span className="val">{selectedPayment.payment_mode}</span>
              </div>
              <div className="receipt-row">
                <span className="lbl">UTR / Ref No:</span>
                <span className="val">{selectedPayment.reference_number || "—"}</span>
              </div>
              {selectedPayment.bank_name && (
                <div className="receipt-row">
                  <span className="lbl">Bank Name:</span>
                  <span className="val">{selectedPayment.bank_name}</span>
                </div>
              )}
              {selectedPayment.invoice_no && (
                <div className="receipt-row">
                  <span className="lbl">Adjusted Against:</span>
                  <span className="val bold text-primary">{selectedPayment.invoice_no}</span>
                </div>
              )}
              {selectedPayment.notes && (
                <div className="receipt-notes">
                  <strong>Notes:</strong> {selectedPayment.notes}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="ppay-btn ppay-btn-primary"
                onClick={() => window.print()}
              >
                🖨️ Print Receipt
              </button>
              <button
                className="ppay-btn ppay-btn-outline"
                onClick={() => setReceiptModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticPayments;
