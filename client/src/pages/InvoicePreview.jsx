import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import html2pdf from "html2pdf.js";
import API from "../api/axios";
import "./InvoicePreview.css";

function InvoicePreview() {
  const { id } = useParams();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadInvoice = async () => {
      try {
        const response = await API.get(`/invoices/${id}`);

        if (!cancelled) {
          setInvoice(response.data.invoice);
          setLoading(false);
        }
      } catch (error) {
        console.error("Invoice loading error:", error);

        alert(error.response?.data?.message || "Unable to load invoice");

        setLoading(false);
      }
    };

    loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  };

  const formatDate = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const downloadPDF = () => {
    const element = document.querySelector(".invoice-a4");

    if (!element) {
      alert("Invoice not found");
      return;
    }

    const options = {
      margin: 0,
      filename: `${invoice.invoice_no}.pdf`,

      image: {
        type: "jpeg",
        quality: 0.98,
      },

      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      },

      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      },

      pagebreak: {
        mode: ["avoid-all", "css", "legacy"],
      },
    };

    html2pdf().set(options).from(element).save();
  };

  if (loading) {
    return <div className="invoice-preview-loading">Loading invoice...</div>;
  }

  if (!invoice) {
    return <div className="invoice-preview-loading">Invoice not found.</div>;
  }

  return (
    <div className="invoice-preview-page">
      <div className="invoice-actions no-print">
        <button onClick={() => (window.location.href = "/invoices")}>
          ← Back
        </button>

        <div className="invoice-action-right">
          <button onClick={() => window.print()}>🖨️ Print Invoice</button>

          <button onClick={downloadPDF} className="download-pdf-btn">
            📥 Download PDF
          </button>
        </div>
      </div>

      <div className="invoice-a4">
        <div className="invoice-company-header">
          <div>
            <h1>Shiv Enterprises</h1>

            <p>All Brands Electronic Appliances Sales & Service</p>

            <p>Surat, Gujarat</p>

            <p>📞 +91 9876543210</p>

            <p>GST : 24ABCDE1234F1Z5</p>
          </div>

          <div className="invoice-title">
            <h2>INVOICE</h2>

            <p>
              <strong>Invoice No:</strong> {invoice.invoice_no}
            </p>

            <p>
              <strong>Date:</strong>{" "}
              {formatDate(invoice.created_at || new Date())}
            </p>
          </div>
        </div>

        <div className="invoice-customer-section">
          <div>
            <h3>Bill To</h3>

            <p>
              <strong>{invoice.customer_name}</strong>
            </p>

            <p>📞 {invoice.customer_mobile}</p>

            {invoice.customer_email && <p>✉️ {invoice.customer_email}</p>}

            {invoice.customer_address && <p>📍 {invoice.customer_address}</p>}
          </div>
        </div>

        <div className="invoice-products">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {(invoice.items || []).map((item, index) => (
                <tr key={item.id || index}>
                  <td>{index + 1}</td>

                  <td>{item.product_name}</td>

                  <td>{item.quantity}</td>

                  <td>{formatCurrency(item.price)}</td>

                  <td>{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="invoice-bottom">
          <div className="invoice-thanks">
            <h3>Thank You!</h3>

            <p>Thank you for choosing Shiv Enterprises.</p>

            <p>Goods once sold cannot be returned without valid terms.</p>
          </div>

          <div className="invoice-summary">
            <div>
              <span>Subtotal</span>

              <strong>{formatCurrency(invoice.subtotal)}</strong>
            </div>

            <div>
              <span>
                Discount ({invoice.discount_percent || 0}
                %)
              </span>

              <strong>- {formatCurrency(invoice.discount_amount)}</strong>
            </div>

            <div>
              <span>
                GST ({invoice.tax_percent || 0}
                %)
              </span>

              <strong>+ {formatCurrency(invoice.tax_amount)}</strong>
            </div>

            <div className="invoice-grand-total">
              <span>Grand Total</span>

              <strong>{formatCurrency(invoice.grand_total)}</strong>
            </div>
          </div>
        </div>

        <div className="invoice-footer">
          <p>This is a computer generated invoice.</p>

          <p>Shiv Enterprises</p>
        </div>
      </div>
    </div>
  );
}

export default InvoicePreview;
