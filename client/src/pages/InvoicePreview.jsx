import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { jsPDF } from "jspdf";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import "./InvoicePreview.css";

function InvoicePreview() {
  const { id } = useParams();

  const [invoice, setInvoice] = useState(null);
  const [businessSettings, setBusinessSettings] = useState({
    business_name: "Shiv Enterprises",
    tagline: "All Brands Electronic Appliances Sales & Service",
    logo: null,
    address: "Surat, Gujarat",
    phone: "+91 9876543210",
    email: "",
    tax_number: "24ABCDE1234F1Z5",
    currency: "INR",
    currency_symbol: "₹",
    terms_conditions: "Goods once sold cannot be returned without valid terms.",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);

        const [invoiceRes, settingsRes] = await Promise.allSettled([
          API.get(`/invoices/${id}`),
          API.get("/business-settings"),
        ]);

        if (cancelled) return;

        if (invoiceRes.status === "fulfilled" && invoiceRes.value.data?.invoice) {
          setInvoice(invoiceRes.value.data.invoice);
        } else if (invoiceRes.status === "rejected") {
          throw invoiceRes.reason;
        }

        if (
          settingsRes.status === "fulfilled" &&
          settingsRes.value.data?.settings
        ) {
          setBusinessSettings((prev) => ({
            ...prev,
            ...settingsRes.value.data.settings,
          }));
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Invoice loading error:", error);
        alert(error.response?.data?.message || "Unable to load invoice");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const formatCurrency = (amount) => {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: businessSettings?.currency || "INR",
        maximumFractionDigits: 2,
      }).format(Number(amount) || 0);
    } catch {
      return `${businessSettings?.currency_symbol || "₹"}${Number(amount || 0).toFixed(2)}`;
    }
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
    try {
      const response = await fetch("/fonts/NotoSans-Regular.ttf");
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();

      let binary = "";
      const bytes = new Uint8Array(buffer);
      const chunkSize = 0x8000;

      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }

      return btoa(binary);
    } catch {
      return null;
    }
  };

  const getImageDimensions = (src) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width || 1,
          height: img.naturalHeight || img.height || 1,
        });
      };
      img.onerror = () => {
        resolve({ width: 24, height: 18 });
      };
      img.src = src;
    });
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
      if (fontBase64) {
        pdf.addFileToVFS("NotoSans-Regular.ttf", fontBase64);
        pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
        pdf.setFont("NotoSans", "normal");
      }

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 18;
      const contentWidth = pageWidth - margin * 2;

      let y = 18;

      // Handle Logo if present with natural aspect ratio preserved
      let textStartX = margin;
      if (businessSettings?.logo) {
        try {
          let format = "PNG";
          if (
            businessSettings.logo.startsWith("data:image/jpeg") ||
            businessSettings.logo.startsWith("data:image/jpg")
          ) {
            format = "JPEG";
          } else if (businessSettings.logo.startsWith("data:image/webp")) {
            format = "WEBP";
          }

          const maxLogoWidth = 26;
          const maxLogoHeight = 18;

          const { width: naturalWidth, height: naturalHeight } =
            await getImageDimensions(businessSettings.logo);

          const imgRatio = naturalWidth / naturalHeight;
          let renderWidth = maxLogoWidth;
          let renderHeight = maxLogoWidth / imgRatio;

          if (renderHeight > maxLogoHeight) {
            renderHeight = maxLogoHeight;
            renderWidth = maxLogoHeight * imgRatio;
          }

          pdf.addImage(
            businessSettings.logo,
            format,
            margin,
            y,
            renderWidth,
            renderHeight,
            undefined,
            "FAST"
          );
          textStartX = margin + renderWidth + 4;
        } catch (imgError) {
          console.warn("Could not render logo in PDF:", imgError);
        }
      }

      pdf.setFontSize(20);
      pdf.text(
        businessSettings?.business_name || "Shiv Enterprises",
        textStartX,
        y + 5
      );

      let textY = y + 11;
      pdf.setFontSize(9);
      pdf.setTextColor(75, 85, 99);

      if (businessSettings?.tagline) {
        pdf.text(businessSettings.tagline, textStartX, textY);
        textY += 4.5;
      }

      if (businessSettings?.address) {
        pdf.text(businessSettings.address, textStartX, textY);
        textY += 4.5;
      }

      const contactDetails = [
        businessSettings?.phone ? `Phone: ${businessSettings.phone}` : "",
        businessSettings?.email ? `Email: ${businessSettings.email}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      if (contactDetails) {
        pdf.text(contactDetails, textStartX, textY);
        textY += 4.5;
      }

      if (businessSettings?.tax_number) {
        pdf.text(`GST / Tax ID: ${businessSettings.tax_number}`, textStartX, textY);
        textY += 4.5;
      }

      // Invoice Title & Info on Right
      pdf.setTextColor(17, 24, 39);
      pdf.setFontSize(22);
      pdf.text("INVOICE", 145, 20);

      pdf.setFontSize(10);
      pdf.setTextColor(75, 85, 99);
      pdf.text(`Invoice No: ${invoice.invoice_no}`, 145, 28);
      pdf.text(
        `Date: ${formatDate(invoice.created_at || new Date())}`,
        145,
        34
      );

      y = Math.max(textY + 4, 48);

      pdf.setDrawColor(17, 24, 39);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);

      y += 10;

      // Customer Bill To Section
      pdf.setTextColor(17, 24, 39);
      pdf.setFontSize(12);
      pdf.text("Bill To", margin, y);

      y += 6;

      pdf.setFontSize(11);
      pdf.text(invoice.customer_name || "", margin, y);

      y += 5.5;

      pdf.setFontSize(9);
      pdf.setTextColor(75, 85, 99);
      pdf.text(`Phone: ${invoice.customer_mobile || "-"}`, margin, y);

      if (invoice.customer_email) {
        y += 5;
        pdf.text(`Email: ${invoice.customer_email}`, margin, y);
      }

      if (invoice.customer_address) {
        y += 5;
        const addressLines = pdf.splitTextToSize(
          invoice.customer_address,
          contentWidth
        );
        pdf.text(addressLines, margin, y);
        y += addressLines.length * 4.5;
      }

      y += 8;

      // Products Table
      const tableX = margin;
      const tableWidth = contentWidth;
      const colWidths = [12, 76, 20, 35, 31];
      const headers = ["#", "Product", "Qty", "Price", "Total"];

      pdf.setFillColor(17, 24, 39);
      pdf.setTextColor(255, 255, 255);
      pdf.rect(tableX, y - 5, tableWidth, 8.5, "F");

      pdf.setFontSize(9);

      let x = tableX;
      headers.forEach((header, index) => {
        if (index === 0 || index === 1) {
          pdf.text(header, x + 3, y);
        } else {
          pdf.text(header, x + colWidths[index] - 3, y, {
            align: "right",
          });
        }
        x += colWidths[index];
      });

      pdf.setTextColor(17, 24, 39);
      y += 8.5;

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
        pdf.line(tableX, y + rowHeight - 4, tableX + tableWidth, y + rowHeight - 4);

        y += rowHeight;
      });

      y += 12;

      // Summary Section
      const summaryX = 120;
      const summaryWidth = 72;

      pdf.setDrawColor(17, 24, 39);
      pdf.setLineWidth(0.5);
      pdf.line(summaryX, y, summaryX + summaryWidth, y);

      y += 7;
      pdf.setFontSize(9.5);

      pdf.text("Subtotal", summaryX, y);
      pdf.text(formatCurrency(invoice.subtotal), summaryX + summaryWidth, y, {
        align: "right",
      });

      y += 7;
      pdf.text(`Discount (${invoice.discount_percent || 0}%)`, summaryX, y);
      pdf.text(
        `- ${formatCurrency(invoice.discount_amount)}`,
        summaryX + summaryWidth,
        y,
        { align: "right" }
      );

      y += 7;
      pdf.text(`GST (${invoice.tax_percent || 0}%)`, summaryX, y);
      pdf.text(
        `+ ${formatCurrency(invoice.tax_amount)}`,
        summaryX + summaryWidth,
        y,
        { align: "right" }
      );

      y += 9;
      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.2);
      pdf.line(summaryX, y - 4, summaryX + summaryWidth, y - 4);

      pdf.setFontSize(13);
      pdf.text("Grand Total", summaryX, y + 2);
      pdf.text(
        formatCurrency(invoice.grand_total),
        summaryX + summaryWidth,
        y + 2,
        { align: "right" }
      );

      // Thank You & Footer Notes
      pdf.setFontSize(11);
      pdf.text("Thank You!", margin, y - 8);

      pdf.setFontSize(8.5);
      pdf.setTextColor(107, 114, 128);

      pdf.text(
        `Thank you for choosing ${businessSettings?.business_name || "SmartBilling"}.`,
        margin,
        y - 2
      );

      if (businessSettings?.terms_conditions) {
        pdf.text(businessSettings.terms_conditions, margin, y + 4);
      }

      pdf.setDrawColor(209, 213, 219);
      pdf.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);

      pdf.setFontSize(8);
      pdf.text("This is a computer generated invoice.", margin, pageHeight - 16);
      pdf.text(
        businessSettings?.business_name || "SmartBilling",
        pageWidth - margin,
        pageHeight - 16,
        { align: "right" }
      );

      pdf.save(`${invoice.invoice_no}.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("Unable to generate PDF");
    }
  };

  if (loading) {
    return <LoadingScreen title="Loading Invoice..." subtitle="Please wait..." />;
  }

  if (!invoice) {
    return <div className="invoice-preview-loading">Invoice not found.</div>;
  }

  return (
    <div className="invoice-preview-page">
      <div className="invoice-actions no-print">
        <button onClick={() => (window.location.href = "/invoices/history")}>
          ← Back to History
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
          <div className="invoice-brand-wrapper">
            {businessSettings?.logo && (
              <img
                src={businessSettings.logo}
                alt="Company Logo"
                className="invoice-company-logo"
              />
            )}
            <div>
              <h1>{businessSettings?.business_name || "SmartBilling"}</h1>
              {businessSettings?.tagline && (
                <p className="invoice-company-tagline">
                  {businessSettings.tagline}
                </p>
              )}
              {businessSettings?.address && (
                <p>📍 {businessSettings.address}</p>
              )}
              {businessSettings?.phone && <p>📞 {businessSettings.phone}</p>}
              {businessSettings?.email && <p>✉️ {businessSettings.email}</p>}
              {businessSettings?.tax_number && (
                <p>GST / Tax ID: {businessSettings.tax_number}</p>
              )}
            </div>
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
            <p>
              Thank you for choosing{" "}
              {businessSettings?.business_name || "SmartBilling"}.
            </p>
            {businessSettings?.terms_conditions ? (
              <p>{businessSettings.terms_conditions}</p>
            ) : (
              <p>Goods once sold cannot be returned without valid terms.</p>
            )}
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
          <p>{businessSettings?.business_name || "SmartBilling"}</p>
        </div>
      </div>
    </div>
  );
}

export default InvoicePreview;
