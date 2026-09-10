import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  KpiCard,
  Card,
  DataTable,
  Modal,
  Button,
  StatusBadge,
} from "../components";
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
    <div className="sb-page-container">
      <PageHeader
        title="Customer Payments & Receipts"
        subtitle="Collect outstanding dues, link bank/UPI receipts to invoices, and update customer ledgers."
        breadcrumbs={[
          { label: "ERP", to: "/plastic-erp" },
          { label: "Sales & Dispatch", to: "/plastic-erp/sales-orders" },
          { label: "Payments" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/plastic-erp/finance/receivables">
              <Button variant="secondary">Aging & Receivables</Button>
            </Link>
            <Link to="/plastic-erp/finance/ledger">
              <Button variant="secondary">Customer Ledger</Button>
            </Link>
            <Button
              variant="primary"
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
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="sb-kpis-grid" style={{ marginBottom: "24px" }}>
        <KpiCard
          label="Total Realized Collections"
          value={`₹${totalCollections.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
          subtext="Net received payments"
          accent="teal"
        />
        <KpiCard
          label="Bank / NEFT / RTGS / UPI"
          value={`₹${bankCollections.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
          subtext="Digital & electronic modes"
          accent="blue"
        />
        <KpiCard
          label="Cash Receipts"
          value={`₹${cashCollections.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
          subtext="Direct cash collections"
          accent="warning"
        />
        <KpiCard
          label="Receipt Transactions"
          value={totalCount}
          subtext="Active payment entries"
          accent="navy"
        />
      </div>

      {/* Filters Bar */}
      <Card noPadding style={{ marginBottom: "24px" }}>
        <div style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <input
              type="text"
              className="sb-input"
              style={{ height: "38px" }}
              placeholder="Search Receipt #, Customer, UTR / Ref, Invoice #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
            <select
              className="sb-input"
              style={{ width: "170px", height: "38px" }}
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
              className="sb-input"
              style={{ width: "180px", height: "38px" }}
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
              className="sb-input"
              style={{ width: "140px", height: "38px" }}
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="sb-input"
              style={{ width: "140px", height: "38px" }}
            />

            {(modeFilter || customerFilter || searchQuery || fromDate || toDate) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setModeFilter("");
                  setCustomerFilter("");
                  setSearchQuery("");
                  setFromDate("");
                  setToDate("");
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Payments Table */}
        <DataTable
          headers={[
            "Receipt #",
            "Date",
            "Customer",
            "Mode",
            "Ref / UTR",
            "Invoice",
            "Amount (₹)",
            "Status",
            "Actions",
          ]}
        >
          {filteredPayments.length === 0 ? (
            <tr>
              <td colSpan="9" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                No payment receipts found.
              </td>
            </tr>
          ) : (
            filteredPayments.map((p) => (
              <tr key={p.id} className={p.status === "CANCELLED" ? "row-cancelled" : ""}>
                <td><strong style={{ color: "var(--sb-ocean)" }}>{p.payment_no}</strong></td>
                <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "—"}</td>
                <td><strong>{p.customer_name}</strong></td>
                <td><span className="pay-mode-badge">{p.payment_mode}</span></td>
                <td>
                  <div>{p.reference_number || "—"}</div>
                  {p.bank_name && <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>{p.bank_name}</div>}
                </td>
                <td>
                  {p.invoice_no ? (
                    <Link to={`/invoices/${p.invoice_id}`} style={{ color: "var(--sb-ocean)", fontWeight: 600 }}>
                      {p.invoice_no}
                    </Link>
                  ) : (
                    <span style={{ color: "var(--sb-muted)" }}>On Account</span>
                  )}
                </td>
                <td>
                  <strong style={{ color: "var(--sb-success)" }}>
                    ₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </strong>
                </td>
                <td>
                  <StatusBadge status={p.status} />
                </td>
                <td>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleViewReceipt(p)}
                      title="View Receipt"
                    >
                      Receipt
                    </Button>
                    {p.status === "RECEIVED" && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleCancelPayment(p.id)}
                        title="Cancel & Reverse Ledger"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </Card>

      {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Record Customer Collection"
      >
        <form onSubmit={handleRecordPayment} className="sb-form">
          <div className="sb-form-group">
            <label className="sb-label">Customer *</label>
            <select
              className="sb-input"
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
            <div className="sb-form-group">
              <label className="sb-label">Allocate to Specific Invoice (Optional)</label>
              <select
                className="sb-input"
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

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Collection Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                className="sb-input"
                placeholder="e.g. 50000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <div className="sb-form-group">
              <label className="sb-label">Payment Date *</label>
              <input
                type="date"
                className="sb-input"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Payment Mode *</label>
              <select
                className="sb-input"
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
            <div className="sb-form-group">
              <label className="sb-label">Reference # / UTR / Cheque #</label>
              <input
                type="text"
                className="sb-input"
                placeholder="Transaction Reference"
                value={formData.reference_number}
                onChange={(e) =>
                  setFormData({ ...formData, reference_number: e.target.value })
                }
              />
            </div>
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Bank Name (Deposited to / Drawn on)</label>
            <input
              type="text"
              className="sb-input"
              placeholder="e.g. HDFC Bank, SBI"
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
            />
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Payment Notes</label>
            <textarea
              className="sb-input"
              rows="2"
              placeholder="e.g. Cleared via RTGS, invoice #1002 balance settlement"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Recording..." : "Save Payment & Update Ledger"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* RECEIPT VIEW MODAL */}
      <Modal
        isOpen={receiptModalOpen && !!selectedPayment}
        onClose={() => setReceiptModalOpen(false)}
        title={`Receipt: ${selectedPayment?.payment_no || ""}`}
      >
        {selectedPayment && (
          <div>
            <div className="pay-receipt-box">
              <div className="pay-receipt-stamp">PAYMENT RECEIVED</div>
              <div className="pay-receipt-row">
                <span className="lbl">Received From:</span>
                <span className="val" style={{ fontWeight: 700 }}>{selectedPayment.customer_name}</span>
              </div>
              <div className="pay-receipt-row">
                <span className="lbl">Receipt Date:</span>
                <span className="val">
                  {selectedPayment.payment_date ? new Date(selectedPayment.payment_date).toLocaleDateString() : ""}
                </span>
              </div>
              <div className="pay-receipt-row">
                <span className="lbl">Amount Received:</span>
                <span className="val" style={{ fontSize: "20px", fontWeight: 800, color: "var(--sb-success)" }}>
                  ₹{Number(selectedPayment.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pay-receipt-row">
                <span className="lbl">Payment Mode:</span>
                <span className="val">{selectedPayment.payment_mode}</span>
              </div>
              <div className="pay-receipt-row">
                <span className="lbl">UTR / Ref No:</span>
                <span className="val">{selectedPayment.reference_number || "—"}</span>
              </div>
              {selectedPayment.bank_name && (
                <div className="pay-receipt-row">
                  <span className="lbl">Bank Name:</span>
                  <span className="val">{selectedPayment.bank_name}</span>
                </div>
              )}
              {selectedPayment.invoice_no && (
                <div className="pay-receipt-row">
                  <span className="lbl">Adjusted Against:</span>
                  <span className="val" style={{ fontWeight: 700, color: "var(--sb-ocean)" }}>{selectedPayment.invoice_no}</span>
                </div>
              )}
              {selectedPayment.notes && (
                <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--sb-border)", fontSize: "13px", color: "var(--sb-muted)" }}>
                  <strong>Notes:</strong> {selectedPayment.notes}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
              <Button variant="primary" onClick={() => window.print()}>
                🖨️ Print Receipt
              </Button>
              <Button variant="secondary" onClick={() => setReceiptModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PlasticPayments;
