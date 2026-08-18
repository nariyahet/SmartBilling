import { useEffect, useState } from "react";
import API from "../api/axios";
import "./InvoicesHistory.css";
import { useNavigate } from "react-router-dom";

function InvoicesHistory() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadInvoices = async () => {
    try {
      setLoading(true);

      const response = await API.get("/invoices");

      setInvoices(response.data.invoices || []);
    } catch (error) {
      console.error("Invoices loading error:", error);

      alert(error.response?.data?.message || "Unable to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadInvoices = async () => {
      try {
        const response = await API.get("/invoices");

        setInvoices(response.data.invoices || []);
      } catch (error) {
        console.error("Invoices loading error:", error);

        alert(error.response?.data?.message || "Unable to load invoices");
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  };

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const navigate = useNavigate();

  const viewInvoice = (id) => {
    navigate(`/invoice/${id}`);
  };

  if (loading) {
    return <div className="invoices-history-loading">Loading invoices...</div>;
  }

  return (
    <div className="invoices-history-page">
      {/* Header */}

      <div className="invoices-history-header">
        <div>
          <h1>🧾 Invoice History</h1>

          <p>View and manage all generated invoices</p>
        </div>

        <div className="invoices-history-actions">
          <button onClick={() => (window.location.href = "/dashboard")}>
            ← Dashboard
          </button>

          <button onClick={() => (window.location.href = "/invoices/create")}>
            + Create Invoice
          </button>

          <button onClick={loadInvoices}>🔄 Refresh</button>
        </div>
      </div>

      {/* Invoice Table */}

      <div className="invoices-history-card">
        {invoices.length === 0 ? (
          <div className="invoices-history-empty">
            <div className="empty-icon">🧾</div>

            <h2>No Invoices Found</h2>

            <p>You haven't created any invoices yet.</p>

            <button onClick={() => (window.location.href = "/invoices/create")}>
              + Create Your First Invoice
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
                {invoices.map((invoice, index) => (
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
