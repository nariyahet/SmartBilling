import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import "./InvoicesHistory.css";

function InvoicesHistory() {
  const [invoices, setInvoices] = useState([]);
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
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

  const handleDashboard = () => {
    navigate("/dashboard");
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
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const viewInvoice = (id) => {
    navigate(`/invoice/${id}`);
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const search = searchTerm.toLowerCase().trim();

    const invoiceNumber = String(invoice.invoice_no || "").toLowerCase();

    const customerName = String(invoice.customer_name || "").toLowerCase();

    const customerMobile = String(invoice.customer_mobile || "").toLowerCase();

    const matchesSearch =
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

  if (loading) {
    return <LoadingScreen title="Loading Invoice History..." subtitle="Please wait..." />;
  }

  return (
    <div className="invoices-history-page">
      {/* HEADER */}

      <div className="invoices-history-header">
        <div>
          <h1>🧾 Invoice History</h1>

          <p>View and manage all generated invoices</p>
        </div>

        <div className="invoices-history-actions">
          <button
            type="button"
            className="invoice-dashboard-button"
            onClick={handleDashboard}
          >
            ← Dashboard
          </button>

          <button
            type="button"
            className="invoice-create-button"
            onClick={handleCreateInvoice}
          >
            + Create Invoice
          </button>

          <button
            type="button"
            className="invoice-refresh-button"
            onClick={loadInvoices}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="invoices-history-card">
        <div className="invoice-history-filters">
          <div className="invoice-search-box">
            <label>Search Invoice</label>

            <input
              type="text"
              placeholder="🔍 Invoice No, Customer or Mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="invoice-date-box">
            <label>Filter by Date</label>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          {(searchTerm || dateFilter) && (
            <button
              type="button"
              className="clear-invoice-filter"
              onClick={() => {
                setSearchTerm("");
                setDateFilter("");
              }}
            >
              ✖ Clear
            </button>
          )}
        </div>

        {invoices.length > 0 && (
          <div className="invoice-result-count">
            Showing <strong>{filteredInvoices.length}</strong> of{" "}
            <strong>{invoices.length}</strong> invoices
          </div>
        )}

        {invoices.length === 0 ? (
          <div className="invoices-history-empty">
            <div className="empty-icon">🧾</div>

            <h2>No Invoices Found</h2>

            <p>You haven't created any invoices yet.</p>

            <button
              type="button"
              className="invoice-create-button"
              onClick={handleCreateInvoice}
            >
              + Create Your First Invoice
            </button>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="invoices-history-empty">
            <div className="empty-icon">🔍</div>

            <h2>No Matching Invoices</h2>

            <p>Try changing your search or date filter.</p>

            <button
              type="button"
              className="invoice-dashboard-button"
              onClick={() => {
                setSearchTerm("");
                setDateFilter("");
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="invoices-history-table-wrapper">
            <table className="invoices-history-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Invoice No.</th>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Date</th>
                  <th>Subtotal</th>
                  <th>GST</th>
                  <th>Grand Total</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredInvoices.map((invoice, index) => (
                  <tr key={invoice.id}>
                    <td>{index + 1}</td>

                    <td>
                      <strong>{invoice.invoice_no}</strong>
                    </td>

                    <td>{invoice.customer_name || "-"}</td>

                    <td>{invoice.customer_mobile || "-"}</td>

                    <td>{formatDate(invoice.created_at)}</td>

                    <td>{formatCurrency(invoice.subtotal)}</td>

                    <td>{formatCurrency(invoice.tax_amount)}</td>

                    <td>
                      <strong>{formatCurrency(invoice.grand_total)}</strong>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="view-invoice-button"
                        onClick={() => viewInvoice(invoice.id)}
                      >
                        👁️ View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default InvoicesHistory;
