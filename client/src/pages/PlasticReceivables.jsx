import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Modal, Button } from "../components";
import "./PlasticReceivables.css";

function PlasticReceivables() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [agingFilter, setAgingFilter] = useState("ALL");

  // Customer Invoices Modal
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [invoicesModalOpen, setInvoicesModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      let sumRes, custRes;
      try {
        [sumRes, custRes] = await Promise.all([
          API.get("/plastic-erp/receivables/summary"),
          API.get("/plastic-erp/receivables/customers"),
        ]);
      } catch (e) {
        if (e.response?.status === 404) {
          [sumRes, custRes] = await Promise.all([
            API.get("/plastic-erp/finance/receivables/summary"),
            API.get("/plastic-erp/finance/receivables/customers"),
          ]);
        } else {
          throw e;
        }
      }

      if (sumRes?.data?.success) setSummary(sumRes.data.summary);
      if (custRes?.data?.success) setCustomers(custRes.data.customers || []);
    } catch (err) {
      console.error("Failed to load receivables data:", err);
      alert("Failed to load accounts receivable data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleViewCustomerInvoices = (c) => {
    setSelectedCustomer(c);
    setInvoicesModalOpen(true);
  };

  const handleRecordPayment = (customerId) => {
    navigate("/plastic-erp/payments", { state: { customerId } });
  };

  const handleViewLedger = (customerId) => {
    navigate(`/plastic-erp/finance/ledger?customerId=${customerId}`);
  };

  const aging = summary?.aging || {
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_90_plus: 0,
  };

  const filteredCustomers = customers.filter((c) => {
    if (agingFilter === "OVERDUE_90" && (Number(c.aging?.days_90_plus) || 0) <= 0) return false;
    if (agingFilter === "OVERDUE_60" && (Number(c.aging?.days_61_90) || 0) <= 0) return false;
    if (agingFilter === "OVERDUE_30" && (Number(c.aging?.days_31_60) || 0) <= 0) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = String(c.name || "").toLowerCase().includes(q);
      const mobMatch = String(c.mobile || "").toLowerCase().includes(q);
      if (!nameMatch && !mobMatch) return false;
    }
    return true;
  });

  if (loading) return <LoadingScreen message="Loading Accounts Receivable & Aging..." />;

  return (
    <div className="plastic-page">
      <PlasticNavbar />
      <div className="plastic-container sb-page-container">
        {/* Header */}
        <PageHeader
          title="Accounts Receivable & Aging"
          subtitle="Monitor total outstanding balances, overdue customer invoices, aging buckets, and collection risk."
          badge="FINANCIAL HEALTH"
          actions={
            <div className="prec-header-actions">
              <Link to="/plastic-erp/finance/ledger" className="sb-link-btn">
                <Button variant="secondary" size="md">Customer Ledger</Button>
              </Link>
              <Link to="/plastic-erp/payments" className="sb-link-btn">
                <Button variant="primary" size="md">+ Collect Payment</Button>
              </Link>
            </div>
          }
        />

        {/* Top KPI Cards */}
        <div className="prec-kpis">
          <KpiCard
            title="Total Invoiced Volume"
            value={`₹${Number(summary?.totalInvoiced || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            subtitle="Gross billed amount"
            variant="default"
          />
          <KpiCard
            title="Total Realized Cash"
            value={`₹${Number(summary?.totalCollected || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            subtitle="Cleared receipts"
            variant="success"
          />
          <KpiCard
            title="Credit Notes Adjusted"
            value={`₹${Number(summary?.totalCreditNotes || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            subtitle="Returns & discounts"
            variant="warning"
          />
          <KpiCard
            title="Net Outstanding Dues"
            value={`₹${Number(summary?.netOutstanding || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            subtitle="Receivables balance"
            variant="danger"
          />
        </div>

        {/* Visual Aging Buckets */}
        <Card className="aging-buckets-container" title="Overdue Aging Breakdown">
          <div className="aging-buckets-grid">
            <div className="bucket-card bucket-current">
              <div className="bucket-label">Current (Not Due)</div>
              <div className="bucket-val">
                ₹{Number(aging.current || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
              <div className="bucket-sub">Within payment terms</div>
            </div>

            <div className="bucket-card bucket-30">
              <div className="bucket-label">1 - 30 Days</div>
              <div className="bucket-val">
                ₹{Number(aging.days_1_30 || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
              <div className="bucket-sub">Low Risk Overdue</div>
            </div>

            <div className="bucket-card bucket-60">
              <div className="bucket-label">31 - 60 Days</div>
              <div className="bucket-val">
                ₹{Number(aging.days_31_60 || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
              <div className="bucket-sub">Moderate Attention</div>
            </div>

            <div className="bucket-card bucket-90">
              <div className="bucket-label">61 - 90 Days</div>
              <div className="bucket-val">
                ₹{Number(aging.days_61_90 || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
              <div className="bucket-sub">High Follow-up Priority</div>
            </div>

            <div className="bucket-card bucket-90plus">
              <div className="bucket-label">90+ Days Overdue</div>
              <div className="bucket-val">
                ₹{Number(aging.days_90_plus || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
              <div className="bucket-sub">Critical / Hold Dispatches</div>
            </div>
          </div>
        </Card>

        {/* Filters */}
        <Card className="prec-filters-card">
          <div className="prec-filters">
            <input
              type="text"
              className="sb-input prec-search"
              placeholder="Search by Customer Name or Mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="prec-tabs">
              <button
                type="button"
                className={`tab-btn ${agingFilter === "ALL" ? "active" : ""}`}
                onClick={() => setAgingFilter("ALL")}
              >
                All Customers ({customers.length})
              </button>
              <button
                type="button"
                className={`tab-btn ${agingFilter === "OVERDUE_90" ? "active" : ""}`}
                onClick={() => setAgingFilter("OVERDUE_90")}
              >
                90+ Days Critical
              </button>
              <button
                type="button"
                className={`tab-btn ${agingFilter === "OVERDUE_60" ? "active" : ""}`}
                onClick={() => setAgingFilter("OVERDUE_60")}
              >
                61 - 90 Days
              </button>
              <button
                type="button"
                className={`tab-btn ${agingFilter === "OVERDUE_30" ? "active" : ""}`}
                onClick={() => setAgingFilter("OVERDUE_30")}
              >
                31 - 60 Days
              </button>
            </div>
          </div>
        </Card>

        {/* Customer Outstanding Table */}
        <Card title={`Customer Outstanding & Aging (${filteredCustomers.length})`}>
          {filteredCustomers.length === 0 ? (
            <div className="prec-empty">No customers found with outstanding dues.</div>
          ) : (
            <div className="prec-table-wrap">
              <table className="prec-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Invoices</th>
                    <th>Total Invoiced</th>
                    <th>Total Paid</th>
                    <th>Net Outstanding</th>
                    <th>Current (₹)</th>
                    <th>1-30 D (₹)</th>
                    <th>31-60 D (₹)</th>
                    <th>61-90 D (₹)</th>
                    <th>90+ D (₹)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="cust-info">
                          <strong>{c.name}</strong>
                          <span className="text-muted">{c.mobile || "No Mobile"}</span>
                        </div>
                      </td>
                      <td>
                        <span className="inv-count-pill">{c.total_invoices || 0}</span>
                      </td>
                      <td>₹{Number(c.total_invoiced || 0).toLocaleString("en-IN")}</td>
                      <td>₹{Number(c.total_paid || 0).toLocaleString("en-IN")}</td>
                      <td className="font-bold text-danger">
                        ₹{Number(c.outstanding_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td>₹{Number(c.aging?.current || 0).toLocaleString("en-IN")}</td>
                      <td>₹{Number(c.aging?.days_1_30 || 0).toLocaleString("en-IN")}</td>
                      <td className={c.aging?.days_31_60 > 0 ? "warn-cell" : ""}>
                        ₹{Number(c.aging?.days_31_60 || 0).toLocaleString("en-IN")}
                      </td>
                      <td className={c.aging?.days_61_90 > 0 ? "danger-cell" : ""}>
                        ₹{Number(c.aging?.days_61_90 || 0).toLocaleString("en-IN")}
                      </td>
                      <td className={c.aging?.days_90_plus > 0 ? "crit-cell" : ""}>
                        ₹{Number(c.aging?.days_90_plus || 0).toLocaleString("en-IN")}
                      </td>
                      <td>
                        <div className="prec-action-btns">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewLedger(c.id)}
                            title="View Financial Statement"
                          >
                            Ledger
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleRecordPayment(c.id)}
                            title="Record Payment Receipt"
                          >
                            Collect
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleViewCustomerInvoices(c)}
                            title="View Unpaid Invoices"
                          >
                            Invoices
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* UNPAID INVOICES MODAL */}
      {invoicesModalOpen && selectedCustomer && (
        <Modal
          isOpen={invoicesModalOpen}
          onClose={() => setInvoicesModalOpen(false)}
          title={`Unpaid Invoices: ${selectedCustomer.name}`}
          size="lg"
        >
          <div className="invoices-modal-summary">
            <span className="text-muted">Total Outstanding: </span>
            <strong className="text-danger">
              ₹{Number(selectedCustomer.outstanding_balance || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </strong>
          </div>

          <div className="invoices-modal-table-wrap">
            <table className="invoices-modal-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th>Total (₹)</th>
                  <th>Paid (₹)</th>
                  <th>Balance Due (₹)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(selectedCustomer.unpaid_invoices || []).length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted">
                      No outstanding invoices for this customer.
                    </td>
                  </tr>
                ) : (
                  selectedCustomer.unpaid_invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <Link to={`/invoices/${inv.id}`} className="inv-link">
                          {inv.invoice_no}
                        </Link>
                      </td>
                      <td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"}</td>
                      <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
                      <td>
                        {inv.days_overdue > 0 ? (
                          <span className={`overdue-badge ${inv.days_overdue > 60 ? "crit" : "warn"}`}>
                            {inv.days_overdue} days
                          </span>
                        ) : (
                          <span className="not-due-badge">Current</span>
                        )}
                      </td>
                      <td>₹{Number(inv.grand_total).toLocaleString("en-IN")}</td>
                      <td>₹{Number(inv.paid_amount || 0).toLocaleString("en-IN")}</td>
                      <td className="font-bold text-danger">
                        ₹{Number(inv.balance_due).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setInvoicesModalOpen(false);
                            navigate("/plastic-erp/payments", {
                              state: { customerId: selectedCustomer.id, invoiceId: inv.id },
                            });
                          }}
                        >
                          Collect ₹{Number(inv.balance_due).toFixed(0)}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="modal-footer-actions">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setInvoicesModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default PlasticReceivables;
