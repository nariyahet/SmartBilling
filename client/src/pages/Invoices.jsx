import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import AppShell from "../components/AppShell";
import "./Invoices.css";

function Invoices() {
  const navigate = useNavigate();
  const location = useLocation();

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  const [customerId, setCustomerId] = useState(() => (location.state?.prefillCustomer ? String(location.state.prefillCustomer) : ""));
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [items, setItems] = useState(() => (Array.isArray(location.state?.prefillItems) ? location.state.prefillItems : []));

  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(18);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [salesOrderId] = useState(() => location.state?.prefillSalesOrderId || null);
  const [dispatchId] = useState(() => location.state?.prefillDispatchId || null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);

        const [
          customerResponse,
          productResponse,
          settingsResponse,
          newInvoiceResponse,
        ] = await Promise.allSettled([
          API.get("/customers"),
          API.get("/products"),
          API.get("/business-settings"),
          API.get("/invoices/new"),
        ]);

        if (cancelled) return;

        if (customerResponse.status === "fulfilled") {
          setCustomers(customerResponse.value.data?.customers || []);
        }

        if (productResponse.status === "fulfilled") {
          setProducts(productResponse.value.data?.products || []);
        }

        if (
          settingsResponse.status === "fulfilled" &&
          settingsResponse.value.data?.settings
        ) {
          const s = settingsResponse.value.data.settings;
          if (s.tax_enabled !== undefined) {
            setTaxEnabled(Boolean(s.tax_enabled));
          }
          if (s.default_tax_percent !== undefined) {
            setTaxPercent(Number(s.default_tax_percent));
          }
          if (s.currency) {
            setCurrencyCode(s.currency);
          }
          if (s.currency_symbol) {
            setCurrencySymbol(s.currency_symbol);
          }
        }

        if (
          newInvoiceResponse.status === "fulfilled" &&
          newInvoiceResponse.value.data?.invoiceNo
        ) {
          setInvoiceNo(newInvoiceResponse.value.data.invoiceNo);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Invoice data error:", error);
        alert(error.response?.data?.message || "Unable to load billing data");
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
  }, []);

  const selectedProduct = products.find(
    (product) => String(product.id) === String(productId),
  );

  const selectedCustomer = customers.find(
    (cust) => String(cust.id) === String(customerId),
  );

  const addItem = () => {
    if (!selectedProduct) {
      alert("Please select a product");
      return;
    }

    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty <= 0) {
      alert("Please enter a valid quantity");
      return;
    }

    if (qty > Number(selectedProduct.stock)) {
      alert(`Only ${selectedProduct.stock} items available in stock`);
      return;
    }

    const existingItem = items.find(
      (item) => String(item.product_id) === String(selectedProduct.id),
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + qty;

      if (newQuantity > Number(selectedProduct.stock)) {
        alert(`Only ${selectedProduct.stock} items available in stock`);
        return;
      }

      setItems(
        items.map((item) =>
          String(item.product_id) === String(selectedProduct.id)
            ? {
                ...item,
                quantity: newQuantity,
                total: Number(item.price) * newQuantity,
              }
            : item,
        ),
      );
    } else {
      setItems([
        ...items,
        {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          quantity: qty,
          price: Number(selectedProduct.price),
          total: Number(selectedProduct.price) * qty,
        },
      ]);
    }

    setProductId("");
    setQuantity(1);
  };

  const removeItem = (productIdToRemove) => {
    setItems(
      items.filter(
        (item) => String(item.product_id) !== String(productIdToRemove),
      ),
    );
  };

  const updateQuantity = (productIdToUpdate, newQuantity) => {
    const qty = Number(newQuantity);

    const product = products.find(
      (item) => String(item.id) === String(productIdToUpdate),
    );

    if (!product) return;

    if (!Number.isInteger(qty) || qty < 1) {
      return;
    }

    if (qty > Number(product.stock)) {
      alert(`Only ${product.stock} items available`);
      return;
    }

    setItems(
      items.map((item) =>
        String(item.product_id) === String(productIdToUpdate)
          ? {
              ...item,
              quantity: qty,
              total: Number(item.price) * qty,
            }
          : item,
      ),
    );
  };

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.total), 0);
  }, [items]);

  const discountAmount = subtotal * (Number(discountPercent) / 100);
  const afterDiscount = subtotal - discountAmount;
  const effectiveTaxPercent = taxEnabled ? Number(taxPercent) : 0;
  const taxAmount = taxEnabled ? afterDiscount * (effectiveTaxPercent / 100) : 0;
  const grandTotal = afterDiscount + taxAmount;

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

  const handleCreateInvoice = async () => {
    if (!customerId) {
      alert("Please select a customer");
      return;
    }

    if (items.length === 0) {
      alert("Please add at least one product");
      return;
    }

    if (Number(discountPercent) < 0 || Number(discountPercent) > 100) {
      alert("Discount must be between 0 and 100");
      return;
    }

    if (taxEnabled && (Number(taxPercent) < 0 || Number(taxPercent) > 100)) {
      alert("GST must be between 0 and 100");
      return;
    }

    try {
      setSaving(true);

      const response = await API.post("/invoices", {
        invoice_no: invoiceNo || undefined,
        customer_id: Number(customerId),
        items: items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
        })),
        discount_percent: Number(discountPercent),
        tax_percent: taxEnabled ? Number(taxPercent) : 0,
        sales_order_id: salesOrderId || undefined,
        dispatch_id: dispatchId || undefined,
        skip_product_stock_deduction: Boolean(dispatchId),
      });

      const invoice = response.data?.invoice;

      alert("Invoice created successfully ✅");

      if (invoice?.id) {
        navigate(`/invoice/${invoice.id}`);
      }
    } catch (error) {
      console.error("Create Invoice Error:", error);
      alert(error.response?.data?.message || "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen title="Loading Billing Terminal..." subtitle="Fetching inventory and clients..." />;
  }

  const currentDateFormatted = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <AppShell
      activePage="invoices"
      headerActions={
        <button
          type="button"
          className="sb-btn-refresh-sm"
          onClick={() => navigate("/invoices-history")}
        >
          📜 Invoice History
        </button>
      }
    >
      {/* Header Section */}
      <div className="inv-header-bar">
        <div>
          <div className="inv-badge-tag">POINT OF SALE & INVOICING</div>
          <h1 className="inv-title">Create New Invoice</h1>
          <p className="inv-subtitle">
            Generate tax-compliant bills, track discounts, and manage real-time inventory adjustments.
          </p>
        </div>

        <div className="inv-meta-badges">
          <div className="inv-meta-pill">
            <span className="meta-label">INVOICE NO</span>
            <strong className="meta-value text-blue">{invoiceNo || "AUTO"}</strong>
          </div>
          <div className="inv-meta-pill">
            <span className="meta-label">DATE</span>
            <strong className="meta-value">{currentDateFormatted}</strong>
          </div>
          <div className="inv-meta-pill">
            <span className="meta-label">TAX REGIME</span>
            <strong className={`meta-value ${taxEnabled ? "text-mint" : "text-muted"}`}>
              {taxEnabled ? `GST Active (${taxPercent}%)` : "Tax Disabled"}
            </strong>
          </div>
        </div>
      </div>

      {/* Main 2-Column POS Layout */}
      <div className="inv-pos-grid">
        {/* LEFT COLUMN: Customer Selection + Product Selector + Cart Table */}
        <div className="inv-pos-left">
          {/* Customer Selection Card */}
          <div className="inv-card">
            <div className="inv-card-header">
              <span className="inv-step-badge">1</span>
              <div>
                <h2 className="inv-card-title">Customer Details</h2>
                <span className="inv-card-sub">Select the billing client for this invoice</span>
              </div>
            </div>

            <div className="inv-customer-form">
              <div className="form-group">
                <label>Select Customer *</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="inv-select"
                >
                  <option value="">-- Choose Registered Customer --</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.mobile ? `(${customer.mobile})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer && (
                <div className="inv-customer-preview-box">
                  <div className="preview-avatar">
                    {selectedCustomer.name ? selectedCustomer.name[0].toUpperCase() : "C"}
                  </div>
                  <div className="preview-info">
                    <strong className="preview-name">{selectedCustomer.name}</strong>
                    <div className="preview-details">
                      <span>📱 {selectedCustomer.mobile || "No phone"}</span>
                      {selectedCustomer.email && <span>✉️ {selectedCustomer.email}</span>}
                      {selectedCustomer.address && <span>📍 {selectedCustomer.address}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product Selection Card */}
          <div className="inv-card">
            <div className="inv-card-header">
              <span className="inv-step-badge">2</span>
              <div>
                <h2 className="inv-card-title">Add Products to Invoice</h2>
                <span className="inv-card-sub">Choose product catalog item and specify quantity</span>
              </div>
            </div>

            <div className="inv-add-product-row">
              <div className="form-group flex-2">
                <label>Select Product</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="inv-select"
                >
                  <option value="">-- Choose in-stock product --</option>
                  {products
                    .filter((product) => Number(product.stock) > 0)
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} — {formatCurrency(product.price)} (Stock: {product.stock})
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group flex-1">
                <label>Quantity</label>
                <div className="inv-qty-input-wrap">
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => setQuantity((q) => Math.max(1, Number(q) - 1))}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="inv-qty-input"
                  />
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => setQuantity((q) => Number(q) + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="inv-add-btn-wrap">
                <button
                  type="button"
                  className="sb-btn-primary inv-btn-add"
                  onClick={addItem}
                >
                  + Add Item
                </button>
              </div>
            </div>

            {selectedProduct && (
              <div className="inv-selected-stock-hint">
                <span>Unit Price: <strong>{formatCurrency(selectedProduct.price)}</strong></span>
                <span>Available Stock: <strong className="text-mint">{selectedProduct.stock} units</strong></span>
              </div>
            )}
          </div>

          {/* Cart Items Table */}
          <div className="inv-card">
            <div className="inv-card-header justify-between">
              <div className="flex-center gap-10">
                <span className="inv-step-badge">3</span>
                <div>
                  <h2 className="inv-card-title">Invoice Items</h2>
                  <span className="inv-card-sub">Review items added to this bill</span>
                </div>
              </div>
              <span className="inv-item-count-badge">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="inv-cart-empty">
                <div className="empty-cart-icon">🛒</div>
                <h3>No Products in Invoice</h3>
                <p>Select products from the catalog above to add them to this invoice.</p>
              </div>
            ) : (
              <div className="inv-items-table-wrap">
                <table className="inv-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>#</th>
                      <th>Product</th>
                      <th style={{ textAlign: "right" }}>Price</th>
                      <th style={{ textAlign: "center", width: "130px" }}>Quantity</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      <th style={{ textAlign: "center", width: "70px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.product_id}>
                        <td className="text-muted font-bold">{idx + 1}</td>
                        <td>
                          <strong className="inv-item-name">{item.product_name}</strong>
                          <span className="inv-item-id">ID: #{item.product_id}</span>
                        </td>
                        <td style={{ textAlign: "right" }}>{formatCurrency(item.price)}</td>
                        <td>
                          <div className="inv-inline-qty">
                            <button
                              type="button"
                              className="qty-mini-btn"
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product_id, e.target.value)}
                              className="qty-mini-input"
                            />
                            <button
                              type="button"
                              className="qty-mini-btn"
                              onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <strong className="inv-item-total">{formatCurrency(item.total)}</strong>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="inv-btn-remove"
                            onClick={() => removeItem(item.product_id)}
                            title="Remove product"
                          >
                            🗑️
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

        {/* RIGHT COLUMN: Summary & Generation Card */}
        <div className="inv-pos-right">
          <div className="inv-summary-card">
            <div className="summary-header">
              <h2 className="summary-title">Billing Summary</h2>
              <span className="summary-date">{currentDateFormatted}</span>
            </div>

            <div className="summary-rows">
              <div className="summary-row">
                <span className="summary-label">Subtotal</span>
                <span className="summary-val">{formatCurrency(subtotal)}</span>
              </div>

              {/* Discount Input & Amount */}
              <div className="summary-adjustment-box">
                <div className="adj-header">
                  <span className="summary-label">Discount Rate (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="adj-input"
                  />
                </div>
                {Number(discountPercent) > 0 && (
                  <div className="adj-calculated text-orange">
                    <span>Discount Amount</span>
                    <strong>- {formatCurrency(discountAmount)}</strong>
                  </div>
                )}
              </div>

              {/* Tax Input & Amount */}
              {taxEnabled ? (
                <div className="summary-adjustment-box">
                  <div className="adj-header">
                    <span className="summary-label">GST / Tax Rate (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(e.target.value)}
                      className="adj-input"
                    />
                  </div>
                  <div className="adj-calculated text-mint">
                    <span>Tax Amount ({taxPercent}%)</span>
                    <strong>+ {formatCurrency(taxAmount)}</strong>
                  </div>
                </div>
              ) : (
                <div className="tax-disabled-notice">
                  <span>🚫 GST / Tax is currently disabled in Business Settings (0% applied)</span>
                </div>
              )}

              <div className="summary-divider" />

              {/* Grand Total */}
              <div className="grand-total-box">
                <div>
                  <span className="grand-label">Grand Total</span>
                  <span className="grand-sub">Net Payable Amount</span>
                </div>
                <strong className="grand-amount">{formatCurrency(grandTotal)}</strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="summary-actions">
              <button
                type="button"
                className="btn-generate-invoice"
                onClick={handleCreateInvoice}
                disabled={saving || items.length === 0 || !customerId}
              >
                {saving ? "Creating Invoice..." : "🧾 Generate & View Invoice"}
              </button>

              <button
                type="button"
                className="btn-cancel-invoice"
                onClick={() => {
                  if (items.length > 0 && !window.confirm("Discard current invoice items?")) return;
                  navigate("/invoices-history");
                }}
              >
                Cancel / Discard
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default Invoices;
