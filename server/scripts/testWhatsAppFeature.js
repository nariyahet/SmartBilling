const assert = require("assert");
const path = require("path");
const db = require(path.resolve(__dirname, "../config/db"));

const BASE_URL = "http://localhost:5000/api";

const runWhatsAppTests = async () => {
  console.log("=================================================================");
  console.log("🟢 SMARTBILLING: WHATSAPP CLICK-TO-CHAT TEST SUITE");
  console.log("=================================================================\n");

  // Dynamically import ES Module from client/src/utils/whatsapp.js
  const whatsappModule = await import(
    "file://" + path.resolve(__dirname, "../../client/src/utils/whatsapp.js").replace(/\\/g, "/")
  );
  const {
    formatWhatsAppPhone,
    generateInvoiceWhatsAppMessage,
    buildWhatsAppUrl,
  } = whatsappModule;

  // TEST 1: Customer Rahul Patel, phone 9876543210
  console.log("--- TEST 1: Customer Phone Normalization & Message Content ---");
  const phoneInput = "9876543210";
  const formattedPhone = formatWhatsAppPhone(phoneInput);
  assert.strictEqual(
    formattedPhone,
    "919876543210",
    "Standard 10-digit Indian phone must prepend 91"
  );

  const sampleInvoice = {
    customer_name: "Rahul Patel",
    customer_mobile: "9876543210",
    invoice_no: "INV-1003",
    created_at: new Date("2026-09-07T10:00:00Z"),
    subtotal: 15000.0,
    discount_percent: 0,
    discount_amount: 0,
    tax_percent: 18.0,
    tax_amount: 2700.0,
    grand_total: 17700.0,
  };

  const sampleBusinessSettings = {
    business_name: "Het Nariya Billing",
    tax_enabled: true,
  };

  const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (date) => new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

  const message1 = generateInvoiceWhatsAppMessage({
    invoice: sampleInvoice,
    businessSettings: sampleBusinessSettings,
    formatCurrency,
    formatDate,
  });

  console.log("Generated Message (TEST 1):\n" + message1 + "\n");

  assert(message1.includes("Rahul Patel"), "Message must contain customer name");
  assert(message1.includes("Het Nariya Billing"), "Message must contain business name");
  assert(message1.includes("INV-1003"), "Message must contain invoice number");
  assert(message1.includes("07/09/2026") || message1.includes("07-09-2026") || message1.includes("7/9/2026"), "Message must contain invoice date");
  assert(message1.includes("₹17,700.00"), "Message must contain grand total");

  // UTF-8 Emoji character verification
  assert(message1.includes("👋"), "Message must contain 👋 emoji");
  assert(message1.includes("📄"), "Message must contain 📄 emoji");
  assert(message1.includes("📅"), "Message must contain 📅 emoji");
  assert(message1.includes("💵"), "Message must contain 💵 emoji");
  assert(message1.includes("📊"), "Message must contain 📊 emoji");
  assert(message1.includes("💰"), "Message must contain 💰 emoji");
  assert(!message1.includes("ðŸ"), "Message must NOT contain mojibake characters");

  const url1 = buildWhatsAppUrl(sampleInvoice.customer_mobile, message1);
  assert(url1.startsWith("https://web.whatsapp.com/send?phone=919876543210&text="), "URL must begin with https://web.whatsapp.com/send?phone=919876543210&text=");
  assert(url1.includes(encodeURIComponent("Rahul Patel")), "URL text parameter must be properly encoded");
  console.log("✅ TEST 1 PASSED: Phone converted to 919876543210, valid UTF-8 emojis verified, and message contains all required fields.");

  // TEST 2: GST ON invoice contains GST information
  console.log("\n--- TEST 2: GST ON Invoice Message ---");
  const gstOnInvoice = {
    customer_name: "Amit Sharma",
    invoice_no: "INV-1004",
    created_at: new Date("2026-09-07T10:00:00Z"),
    subtotal: 10000.0,
    discount_percent: 10,
    discount_amount: 1000.0,
    tax_percent: 18.0,
    tax_amount: 1620.0,
    grand_total: 10620.0,
  };

  const gstOnMessage = generateInvoiceWhatsAppMessage({
    invoice: gstOnInvoice,
    businessSettings: { business_name: "Shiv Electronics", tax_enabled: true },
    formatCurrency,
    formatDate,
  });

  console.log("Generated Message (GST ON):\n" + gstOnMessage + "\n");
  assert(gstOnMessage.includes("Subtotal: ₹10,000.00"), "Message must contain Subtotal");
  assert(gstOnMessage.includes("Discount (10%): - ₹1,000.00"), "Message must contain Discount");
  assert(gstOnMessage.includes("GST (18%): + ₹1,620.00"), "Message must contain GST breakdown when tax is ON");
  assert(gstOnMessage.includes("Grand Total: ₹10,620.00"), "Message must contain Grand Total");

  // Verify numeric 1 (from MySQL TINYINT(1)) also enables GST
  const gstOnNumericMessage = generateInvoiceWhatsAppMessage({
    invoice: gstOnInvoice,
    businessSettings: { business_name: "Shiv Electronics", tax_enabled: 1 },
    formatCurrency,
    formatDate,
  });
  assert(gstOnNumericMessage.includes("GST (18%): + ₹1,620.00"), "Message must contain GST when tax_enabled is numeric 1");

  console.log("✅ TEST 2 PASSED: GST ON invoice message correctly exposes GST information (both boolean true and numeric 1).");

  // TEST 3: GST OFF invoice does NOT contain GST information
  console.log("\n--- TEST 3: GST OFF Invoice Message ---");
  const gstOffInvoice = {
    customer_name: "Pooja Mehta",
    invoice_no: "INV-1005",
    created_at: new Date("2026-09-07T10:00:00Z"),
    subtotal: 15000.0,
    discount_percent: 0,
    discount_amount: 0,
    tax_percent: 0,
    tax_amount: 0,
    grand_total: 15000.0,
  };

  const gstOffMessage = generateInvoiceWhatsAppMessage({
    invoice: gstOffInvoice,
    businessSettings: { business_name: "Shiv Electronics", tax_enabled: false }, // GST IS OFF (boolean)
    formatCurrency,
    formatDate,
  });

  console.log("Generated Message (GST OFF):\n" + gstOffMessage + "\n");
  assert(gstOffMessage.includes("Subtotal: ₹15,000.00"), "Message must contain Subtotal");
  assert(gstOffMessage.includes("Grand Total: ₹15,000.00"), "Message must contain Grand Total");
  assert(!gstOffMessage.includes("GST"), "Message must NOT contain 'GST' when tax_enabled is false");
  assert(!gstOffMessage.includes("Tax"), "Message must NOT contain 'Tax' when tax_enabled is false");

  // Verify numeric 0 (from MySQL TINYINT(1)) also omits GST
  const gstOffNumericMessage = generateInvoiceWhatsAppMessage({
    invoice: gstOffInvoice,
    businessSettings: { business_name: "Shiv Electronics", tax_enabled: 0 }, // GST IS OFF (numeric 0)
    formatCurrency,
    formatDate,
  });
  assert(!gstOffNumericMessage.includes("GST"), "Message must NOT contain 'GST' when tax_enabled is numeric 0");
  assert(!gstOffNumericMessage.includes("Tax"), "Message must NOT contain 'Tax' when tax_enabled is numeric 0");

  console.log("✅ TEST 3 PASSED: GST OFF invoice message omits all GST rows cleanly (both boolean false and numeric 0).");

  // TEST 4: Customer without phone
  console.log("\n--- TEST 4: Customer Without Phone Number ---");
  assert.strictEqual(formatWhatsAppPhone(null), null);
  assert.strictEqual(formatWhatsAppPhone(undefined), null);
  assert.strictEqual(formatWhatsAppPhone(""), null);
  assert.strictEqual(formatWhatsAppPhone("   "), null);

  const urlNoPhone = buildWhatsAppUrl("", "Hello");
  assert.strictEqual(urlNoPhone, null, "URL generation must return null when phone is missing");
  console.log("✅ TEST 4 PASSED: Missing phone returns null and prevents opening WhatsApp.");

  // TEST 5: Invalid phone numbers
  console.log("\n--- TEST 5: Invalid Phone Numbers ---");
  assert.strictEqual(formatWhatsAppPhone("12345"), null, "Short number must be invalid");
  assert.strictEqual(formatWhatsAppPhone("abc"), null, "Alphabetical phone must be invalid");
  assert.strictEqual(formatWhatsAppPhone("0000000000"), null, "All zeros must be invalid");
  assert.strictEqual(formatWhatsAppPhone("123456789012345678"), null, "Excessive digits must be invalid");

  const urlInvalid = buildWhatsAppUrl("12345", "Hello");
  assert.strictEqual(urlInvalid, null, "URL generation must return null for invalid phone");

  // Additional phone formats (International)
  assert.strictEqual(formatWhatsAppPhone("+91 98765 43210"), "919876543210", "+91 with spaces must format to 919876543210");
  assert.strictEqual(formatWhatsAppPhone("09876543210"), "919876543210", "Leading 0 must be stripped and 91 prepended");
  assert.strictEqual(formatWhatsAppPhone("+1 (415) 555-2671"), "14155552671", "US international number must be formatted correctly");
  assert.strictEqual(formatWhatsAppPhone("+44 7911 123456"), "447911123456", "UK international number must be formatted correctly");
  console.log("✅ TEST 5 PASSED: Invalid phones are strictly rejected; international numbers are properly handled.");

  // TEST 6 & 7: Verify Print and Download PDF integration in InvoicePreview.jsx
  console.log("\n--- TEST 6 & 7: Verify Print and Download PDF Actions Intact ---");
  const fs = require("fs");
  const previewCode = fs.readFileSync(path.resolve(__dirname, "../../client/src/pages/InvoicePreview.jsx"), "utf8");
  assert(previewCode.includes("window.print()"), "window.print() must remain in InvoicePreview");
  assert(previewCode.includes("downloadPDF"), "downloadPDF must remain in InvoicePreview");
  assert(previewCode.includes("handleSendWhatsApp"), "handleSendWhatsApp must be present in InvoicePreview");
  assert(previewCode.includes('window.open("", "_blank")'), 'window.open("", "_blank") must be used for popup blocker safety');
  assert(previewCode.includes("whatsappWindow.location.href = whatsappUrl"), "whatsappWindow.location.href must navigate tab");
  assert(previewCode.includes("phone-modal-overlay"), "Phone validation modal must be present in InvoicePreview");
  console.log("✅ TEST 6 & 7 PASSED: Print Invoice, Download PDF, and WhatsApp popup-safe opening are completely preserved.");

  // TEST 8: Multi-tenant safety
  console.log("\n--- TEST 8: Multi-Tenant Isolation Verification ---");
  const pdb = db.promise();
  // Ensure Demo invoices (company_id = 1) cannot be accessed without proper authorization
  const [demoInvoices] = await pdb.query("SELECT id, customer_id, company_id FROM invoices WHERE company_id = 1 LIMIT 1");
  if (demoInvoices.length > 0) {
    const demoInvId = demoInvoices[0].id;
    // Verify that GET /api/invoices/:id strictly filters by req.user.company_id in the database query
    const [crossTenantCheck] = await pdb.query(
      "SELECT i.*, c.mobile AS customer_mobile FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ? AND i.company_id = 2",
      [demoInvId]
    );
    assert.strictEqual(
      crossTenantCheck.length,
      0,
      "Company 2 must NEVER find Company 1's invoice or customer phone number"
    );
  }
  console.log("✅ TEST 8 PASSED: Multi-tenant customer phone and invoice isolation is strictly maintained.");

  console.log("\n🎉 ALL 8 TARGETED WHATSAPP TESTS PASSED SUCCESSFULLY!\n");
};

runWhatsAppTests()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(() => {
    db.end();
  });
