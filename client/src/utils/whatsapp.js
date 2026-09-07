/**
 * WhatsApp Click-to-Chat utilities for SmartBilling
 * Reference: https://faq.whatsapp.com/5913398998672934/
 */

/**
 * Normalizes and validates a phone number for WhatsApp wa.me links.
 * - Strips non-digit characters (+, -, spaces, parentheses, etc.)
 * - Handles leading zeros on 11-digit numbers (e.g. 09876543210 -> 9876543210)
 * - Prepends country code 91 for 10-digit Indian numbers
 * - Accepts 11-15 digit international numbers as-is
 * - Rejects numbers that are too short, too long, or invalid
 *
 * @param {string|number} phone
 * @returns {string|null} Validated international phone number string or null if invalid
 */
export function formatWhatsAppPhone(phone) {
  if (phone === undefined || phone === null) return null;
  const raw = String(phone).trim();
  if (!raw) return null;

  // Remove all non-digit characters
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Reject numbers of all identical digits if they are all zeros
  if (/^0+$/.test(digits)) return null;

  // Handle standard India leading zero prefix: 09876543210 -> 9876543210
  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  // 10-digit domestic Indian mobile numbers
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // International numbers (E.164 supports 11 to 15 digits)
  if (digits.length >= 11 && digits.length <= 15) {
    return digits;
  }

  return null;
}

/**
 * Generates a professional pre-filled WhatsApp message for an invoice.
 * Strictly respects the business's GST/Tax setting:
 * - tax_enabled = 1 / true → GST included
 * - tax_enabled = 0 / false → GST omitted
 *
 * @param {Object} params
 * @param {Object} params.invoice
 * @param {Object} params.businessSettings
 * @param {Function} params.formatCurrency
 * @param {Function} params.formatDate
 * @returns {string} Formatted WhatsApp message with UTF-8 emojis
 */
export function generateInvoiceWhatsAppMessage({
  invoice,
  businessSettings,
  formatCurrency,
  formatDate,
}) {
  const customerName = invoice?.customer_name ? String(invoice.customer_name).trim() : "Valued Customer";
  const businessName = businessSettings?.business_name ? String(businessSettings.business_name).trim() : "SmartBilling";
  const invoiceNo = invoice?.invoice_no || "";
  const invoiceDate = formatDate
    ? formatDate(invoice?.created_at || new Date())
    : new Date().toLocaleDateString("en-IN");

  // Strict numeric and boolean safe check for database TINYINT(1) (0 vs 1) and boolean values
  const isTaxEnabled =
    businessSettings?.tax_enabled === true ||
    Number(businessSettings?.tax_enabled) === 1;

  const lines = [
    `Hello ${customerName} 👋`,
    "",
    `Thank you for choosing ${businessName}.`,
    "",
    "Your invoice is ready.",
    "",
    `📄 Invoice No: ${invoiceNo}`,
    `📅 Date: ${invoiceDate}`,
  ];

  if (formatCurrency && invoice?.subtotal !== undefined) {
    lines.push(`💵 Subtotal: ${formatCurrency(invoice.subtotal)}`);
  }

  if (Number(invoice?.discount_amount) > 0 && formatCurrency) {
    lines.push(`🏷️ Discount (${invoice.discount_percent || 0}%): - ${formatCurrency(invoice.discount_amount)}`);
  }

  // Strictly respect GST ON/OFF: only include GST when isTaxEnabled is true
  if (isTaxEnabled && formatCurrency) {
    lines.push(`📊 GST (${invoice?.tax_percent || 0}%): + ${formatCurrency(invoice?.tax_amount || 0)}`);
  }

  if (formatCurrency && invoice?.grand_total !== undefined) {
    lines.push(`💰 Grand Total: ${formatCurrency(invoice.grand_total)}`);
  }

  lines.push("");
  lines.push("Please find your invoice details above.");
  lines.push("");
  lines.push("Thank you!");
  lines.push(businessName);

  return lines.join("\n");
}

/**
 * Builds the complete WhatsApp Click-to-Chat URL.
 * Reference: https://wa.me/<number>?text=<encoded_message>
 *
 * @param {string|number} phone
 * @param {string} message
 * @returns {string|null} Complete wa.me URL or null if phone is invalid
 */
export function buildWhatsAppUrl(phone, message) {
  const formattedPhone = formatWhatsAppPhone(phone);
  if (!formattedPhone) return null;

  const encodedMessage = encodeURIComponent(message || "");
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}
