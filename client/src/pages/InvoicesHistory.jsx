import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import AppShell from "../components/AppShell";
import "./InvoicesHistory.css";

function InvoicesHistory() {
  const [invoices, setInvoices] = useState([]);
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("search") || "";
    } catch {
      return "";
    }
  });
  const [dateFilter, setDateFilter] = useState("");

  const navigate = useNavigate();

  const loadInvoices = async () => {
    try {
      setLoading(true);

      const [invRes, settingsRes] = await Promise.allSettled([
        API.get("/invoices"),
        API.get("/business-settings"),
      ]);

      if (invRes.status === "fulfilled") {
        setInvoices(invRes.value.data?.invoices || []);
      }

      if (
        settingsRes.status === "fulfilled" &&
        settingsRes.value.data?.settings
      ) {
        setCurrencyCode(settingsRes.value.data.settings.currency || "INR");
        setCurrencySymbol(settingsRes.value.data.settings.currency_symbol || "₹");
        if (settingsRes.value.data.settings.tax_enabled !== undefined) {
          setTaxEnabled(Boolean(settingsRes.value.data.settings.tax_enabled));
        }
      }
    } catch (error) {
      console.error("Invoices loading error:", error);
      alert(error.response?.data?.message || "Unable to load invoices");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInvoices();
  }, []);

  const handleCreateInvoice = () => {
    navigate("/invoices/create");
  };

  const formatCurrency = (amount) => {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currencyCode || "INR",
        maximumFractionDigits: 2,
      }).format(Number(amount) || 0);
    } catch {
      return `${currencySymbol || "₹"}${Number(amount || 0).toFixed(2)}`;
    }
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const viewInvoice = (id) => {
    navigate(`/invoice/${id}`);
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const search = searchTerm.toLowerCase().trim();
      const invoiceNumber = String(invoice.invoice_no || "").toLowerCase();
      const customerName = String(invoice.customer_name || "").toLowerCase();
      const customerMobile = String(invoice.customer_mobile || "").toLowerCase();

      const matchesSearch =
        !search ||
        invoiceNumber.includes(search) ||
        customerName.includes(search) ||
        customerMobile.includes(search);

      let matchesDate = true;
      if (dateFilter) {
        if (!invoice.created_at) {
          matchesDate = false;
        } else {
          const invoiceDate = new Date(invoice.created_at);
          const year = invoiceDate.getFullYear();
          const month = String(invoiceDate.getMonth() + 1).padStart(2, "0");
          const day = String(invoiceDate.getDate()).padStart(2, "0");
          const invoiceDateString = `${year}-${month}-${day}`;
          matchesDate = invoiceDateString === dateFilter;
        }
      }

      return matchesSearch && matchesDate;
    });
  }, [invoices, searchTerm, dateFilter]);

  // Summary Metrics from real data
  const totalInvoicesCount = invoices.length;
  const totalSalesAmount = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (Number(inv.grand_total) || 0), 0);
  }, [invoices]);

  const avgInvoiceValue = totalInvoicesCount > 0 ? totalSalesAmount / totalInvoicesCount : 0;

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return invoices.filter((inv) => {
      if (!inv.created_at) return false;
      return new Date(inv.created_at).toISOString().split("T")[0] === today;
    }).length;
  }, [invoices]);

  if (loading && invoices.length === 0) {
    return <LoadingScreen title="Loading Invoice History..." subtitle="Fetching sales records..." />;
  }

  return (
    <AppShell
      activePage="invoice-history"
      searchPlaceholder="Search invoices by number, client, or phone..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      headerActions={
        <button
          type="button"
          className="sb-btn-primary"
          onClick={handleCreateInvoice}
        >
          <span>+</span> New Invoice
        </button>
      }
    >
      {/* Header Section */}
      <div className="invh-header-bar">
        <div>
          <div className="invh-badge-tag">SALES LEDGER & RECORDS</div>
          <h1 className="invh-title">Invoice History</h1>
          <p className="invh-subtitle">
            View, track, print, and share GST sales invoices issued to customers.
          </p>
        </div>

        <div className="invh-header-actions">
          <button
            type="button"
            className="sb-btn-refresh-sm"
            onClick={loadInvoices}
          >
            🔄 Refresh
          </button>
          <button
            type="button"
            className="sb-btn-primary"
            onClick={handleCreateInvoice}
          >
            <span>+</span> Create Invoice
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="invh-kpi-grid">
        <div className="invh-kpi-card accent-blue">
          <div className="kpi-icon-box">🧾</div>
          <div className="kpi-info">
            <span className="kpi-label">Total Invoices</span>
            <strong className="kpi-val text-blue">{totalInvoicesCount}</strong>
            <span className="kpi-sub">All-time generated bills</span>
          </div>
        </div>

        <div className="invh-kpi-card accent-mint">
          <div className="kpi-icon-box">💰</div>
          <div className="kpi-info">
            <span className="kpi-label">Total Revenue</span>
            <strong className="kpi-val text-mint">{formatCurrency(totalSalesAmount)}</strong>
            <span className="kpi-sub">Cumulative gross billing</span>
          </div>
        </div>

        <div className="invh-kpi-card accent-teal">
          <div className="kpi-icon-box">📊</div>
          <div className="kpi-info">
            <span className="kpi-label">Average Bill Value</span>
            <strong className="kpi-val text-teal">{formatCurrency(avgInvoiceValue)}</strong>
            <span className="kpi-sub">Mean invoice amount</span>
          </div>
        </div>

        <div className="invh-kpi-card accent-orange">
          <div className="kpi-icon-box">⚡</div>
          <div className="kpi-info">
            <span className="kpi-label">Today's Invoices</span>
            <strong className="kpi-val text-orange">{todayCount}</strong>
            <span className="kpi-sub">Issued today</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="invh-main-card">
        {/* Filters Bar */}
        <div className="invh-card-top">
          <div className="invh-card-top-info">
            <h2 className="invh-card-title">All Invoices</h2>
            <span className="invh-count-pill">
              {filteredInvoices.length} of {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="invh-filter-group">
            <div className="invh-search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search invoice #, customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="invh-search-input"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchTerm("")}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="invh-date-input-wrap">
              <span className="date-icon">📅</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="invh-date-input"
              />
              {dateFilter && (
                <button
                  type="button"
                  className="date-clear-btn"
                  onClick={() => setDateFilter("")}
                >
                  ✕
                </button>
              )}
            </div>

            {(searchTerm || dateFilter) && (
              <button
                type="button"
                className="btn-clear-filter"
                onClick={() => {
                  setSearchTerm("");
                  setDateFilter("");
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Invoices List / Table */}
        {invoices.length === 0 ? (
          <div className="invh-empty-state">
            <span className="empty-icon">🧾</span>
            <h3>No Invoices Yet</h3>
            <p>You haven't generated any customer invoices yet. Create your first sales bill now.</p>
            <button
              type="button"
              className="sb-btn-primary"
              onClick={handleCreateInvoice}
              style={{ marginTop: "12px" }}
            >
              + Create First Invoice
            </button>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="invh-empty-state">
            <span className="empty-icon">🔍</span>
            <h3>No Matching Invoices</h3>
            <p>No invoices match your current search query or date filter.</p>
            <button
              type="button"
              className="btn-clear-filter"
              onClick={() => {
                setSearchTerm("");
                setDateFilter("");
              }}
              style={{ marginTop: "12px" }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="invh-table-responsive">
            <table className="invh-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}>#</th>
                  <th>Invoice No.</th>
                  <th>Customer Details</th>
                  <th>Issue Date</th>
                  <th style={{ textAlign: "right" }}>Subtotal</th>
                  {taxEnabled && <th style={{ textAlign: "right" }}>GST</th>}
                  <th style={{ textAlign: "right" }}>Grand Total</th>
                  <th style={{ textAlign: "center", width: "110px" }}>Status</th>
                  <th style={{ textAlign: "right", width: "110px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice, index) => (
                  <tr key={invoice.id}>
                    <td className="text-muted font-bold">{index + 1}</td>
                    <td>
                      <div className="inv-no-badge">
                        <strong>{invoice.invoice_no}</strong>
                      </div>
                    </td>
                    <td>
                      <div className="invh-cust-cell">
                        <strong className="invh-cust-name">{invoice.customer_name || "Walk-in Customer"}</strong>
                        {invoice.customer_mobile && (
                          <span className="invh-cust-sub">📱 {invoice.customer_mobile}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="invh-date-text">{formatDate(invoice.created_at)}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="invh-amount-sub">{formatCurrency(invoice.subtotal)}</span>
                    </td>
                    {taxEnabled && (
                      <td style={{ textAlign: "right" }}>
                        <span className="invh-tax-sub text-mint">
                          +{formatCurrency(invoice.tax_amount)}
                        </span>
                      </td>
                    )}
                    <td style={{ textAlign: "right" }}>
                      <strong className="invh-total-text">{formatCurrency(invoice.grand_total)}</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className="invh-status-pill status-paid">Issued</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn-view-invoice"
                        onClick={() => viewInvoice(invoice.id)}
                        title="View invoice details and share"
                      >
                        👁️ View Bill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default InvoicesHistory;
