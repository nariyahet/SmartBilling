import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { jsPDF } from "jspdf";
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

  const loadFont = async () => {
    const response = await fetch("/fonts/NotoSans-Regular.ttf");
    const buffer = await response.arrayBuffer();

    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    return btoa(binary);
  };

  const downloadPDF = async () => {
    if (!invoice) {
      alert("Invoice not found");
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const fontBase64 = await loadFont();

      pdf.addFileToVFS("NotoSans-Regular.ttf", fontBase64);
      pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
      pdf.setFont("NotoSans", "normal");

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 18;
      const contentWidth = pageWidth - margin * 2;

      let y = 20;

      pdf.setFontSize(22);
      pdf.setFont("NotoSans", "normal");
      pdf.text("Shiv Enterprises", margin, y);

      y += 7;

      pdf.setFontSize(10);
      pdf.text("All Brands Electronic Appliances Sales & Service", margin, y);

      y += 5;
      pdf.text("Surat, Gujarat", margin, y);

      y += 5;
      pdf.text("+91 9876543210", margin, y);

      y += 5;
      pdf.text("GST : 24ABCDE1234F1Z5", margin, y);

      pdf.setFontSize(22);
      pdf.text("INVOICE", 145, 20);

      pdf.setFontSize(10);
      pdf.text(`Invoice No: ${invoice.invoice_no}`, 145, 28);
      pdf.text(
        `Date: ${formatDate(invoice.created_at || new Date())}`,
        145,
        34,
      );

      y = 52;

      pdf.setDrawColor(17, 24, 39);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);

      y += 12;

      pdf.setFontSize(13);
      pdf.text("Bill To", margin, y);

      y += 7;

      pdf.setFontSize(11);
      pdf.text(invoice.customer_name || "", margin, y);

      y += 6;

      pdf.setFontSize(10);
      pdf.text(invoice.customer_mobile || "", margin, y);

      if (invoice.customer_email) {
        y += 6;
        pdf.text(invoice.customer_email, margin, y);
      }

      if (invoice.customer_address) {
        y += 6;

        const addressLines = pdf.splitTextToSize(
          invoice.customer_address,
          contentWidth,
        );

        pdf.text(addressLines, margin, y);

        y += addressLines.length * 5;
      }

      y += 10;

      const tableX = margin;
      const tableWidth = contentWidth;

      const colWidths = [12, 76, 20, 35, 31];

      const headers = ["#", "Product", "Qty", "Price", "Total"];

      pdf.setFillColor(17, 24, 39);
      pdf.setTextColor(255, 255, 255);
      pdf.rect(tableX, y - 6, tableWidth, 9, "F");

      pdf.setFontSize(9);

      let x = tableX;

      headers.forEach((header, index) => {
        if (index === 0) {
          pdf.text(header, x + 3, y);
        } else if (index === 1) {
          pdf.text(header, x + 3, y);
        } else {
          pdf.text(header, x + colWidths[index] - 3, y, {
            align: "right",
          });
        }

        x += colWidths[index];
      });

      pdf.setTextColor(17, 24, 39);

      y += 9;

      (invoice.items || []).forEach((item, index) => {
        const productName = item.product_name || "";
        const productLines = pdf.splitTextToSize(productName, 70);
        const rowHeight = Math.max(8, productLines.length * 5);

        x = tableX;

        pdf.setFontSize(9);

        pdf.text(String(index + 1), x + 3, y);
        x += colWidths[0];

        pdf.text(productLines, x + 3, y);
        x += colWidths[1];

        pdf.text(String(item.quantity || 0), x + colWidths[2] - 3, y, {
          align: "right",
        });

        x += colWidths[2];

        pdf.text(formatCurrency(item.price), x + colWidths[3] - 3, y, {
          align: "right",
        });

        x += colWidths[3];

        pdf.text(formatCurrency(item.total), x + colWidths[4] - 3, y, {
          align: "right",
        });

        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.2);
        pdf.line(
          tableX,
          y + rowHeight - 4,
          tableX + tableWidth,
          y + rowHeight - 4,
        );

        y += rowHeight;
      });

      y += 15;

      const summaryX = 120;
      const summaryWidth = 72;

      pdf.setDrawColor(17, 24, 39);
      pdf.setLineWidth(0.5);
      pdf.line(summaryX, y, summaryX + summaryWidth, y);

      y += 8;

      pdf.setFontSize(10);

      pdf.text("Subtotal", summaryX, y);
      pdf.text(formatCurrency(invoice.subtotal), summaryX + summaryWidth, y, {
        align: "right",
      });

      y += 8;

      pdf.text(`Discount (${invoice.discount_percent || 0}%)`, summaryX, y);

      pdf.text(
        `- ${formatCurrency(invoice.discount_amount)}`,
        summaryX + summaryWidth,
        y,
        { align: "right" },
      );

      y += 8;

      pdf.text(`GST (${invoice.tax_percent || 0}%)`, summaryX, y);

      pdf.text(
        `+ ${formatCurrency(invoice.tax_amount)}`,
        summaryX + summaryWidth,
        y,
        { align: "right" },
      );

      y += 10;

      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.2);
      pdf.line(summaryX, y - 5, summaryX + summaryWidth, y - 5);

      pdf.setFontSize(14);

      pdf.text("Grand Total", summaryX, y + 3);

      pdf.text(
        formatCurrency(invoice.grand_total),
        summaryX + summaryWidth,
        y + 3,
        { align: "right" },
      );

      pdf.setFontSize(11);

      pdf.text("Thank You!", margin, y - 10);

      pdf.setFontSize(9);

      pdf.text("Thank you for choosing Shiv Enterprises.", margin, y - 3);

      pdf.text(
        "Goods once sold cannot be returned without valid terms.",
        margin,
        y + 3,
      );

      pdf.setDrawColor(209, 213, 219);
      pdf.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);

      pdf.setFontSize(8);

      pdf.text(
        "This is a computer generated invoice.",
        margin,
        pageHeight - 20,
      );

      pdf.text("Shiv Enterprises", pageWidth - margin, pageHeight - 20, {
        align: "right",
      });

      pdf.save(`${invoice.invoice_no}.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("Unable to generate PDF");
    }
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
              <span>Discount ({invoice.discount_percent || 0}%)</span>

              <strong>- {formatCurrency(invoice.discount_amount)}</strong>
            </div>

            <div>
              <span>GST ({invoice.tax_percent || 0}%)</span>

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
