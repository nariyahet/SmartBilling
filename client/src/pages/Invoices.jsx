import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import "./Invoices.css";

function Invoices() {
  const navigate = useNavigate();

  // ==========================================
  // STATES
  // ==========================================

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [items, setItems] = useState([]);

  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(18);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ==========================================
  // LOAD CUSTOMERS + PRODUCTS
  // ==========================================

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);

        const [customerResponse, productResponse] =
          await Promise.all([
            API.get("/customers"),
            API.get("/products"),
          ]);

        if (cancelled) return;

        setCustomers(
          customerResponse.data?.customers || []
        );

        setProducts(
          productResponse.data?.products || []
        );
      } catch (error) {
        if (cancelled) return;

        console.error(
          "Invoice data error:",
          error
        );

        alert(
          error.response?.data?.message ||
            "Unable to load customers/products"
        );
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

  // ==========================================
  // SELECTED PRODUCT
  // ==========================================

  const selectedProduct = products.find(
    (product) =>
      String(product.id) === String(productId)
  );

  // ==========================================
  // ADD PRODUCT
  // ==========================================

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
      alert(
        `Only ${selectedProduct.stock} items available in stock`
      );
      return;
    }

    const existingItem = items.find(
      (item) =>
        String(item.product_id) ===
        String(selectedProduct.id)
    );

    if (existingItem) {
      const newQuantity =
        existingItem.quantity + qty;

      if (
        newQuantity >
        Number(selectedProduct.stock)
      ) {
        alert(
          `Only ${selectedProduct.stock} items available in stock`
        );
        return;
      }

      setItems(
        items.map((item) =>
          String(item.product_id) ===
          String(selectedProduct.id)
            ? {
                ...item,
                quantity: newQuantity,
                total:
                  Number(item.price) *
                  newQuantity,
              }
            : item
        )
      );
    } else {
      setItems([
        ...items,
        {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          quantity: qty,
          price: Number(
            selectedProduct.price
          ),
          total:
            Number(selectedProduct.price) *
            qty,
        },
      ]);
    }

    setProductId("");
    setQuantity(1);
  };

  // ==========================================
  // REMOVE PRODUCT
  // ==========================================

  const removeItem = (productIdToRemove) => {
    setItems(
      items.filter(
        (item) =>
          String(item.product_id) !==
          String(productIdToRemove)
      )
    );
  };

  // ==========================================
  // UPDATE QUANTITY
  // ==========================================

  const updateQuantity = (
    productIdToUpdate,
    newQuantity
  ) => {
    const qty = Number(newQuantity);

    const product = products.find(
      (item) =>
        String(item.id) ===
        String(productIdToUpdate)
    );

    if (!product) return;

    if (!Number.isInteger(qty) || qty < 1) {
      return;
    }

    if (qty > Number(product.stock)) {
      alert(
        `Only ${product.stock} items available`
      );
      return;
    }

    setItems(
      items.map((item) =>
        String(item.product_id) ===
        String(productIdToUpdate)
          ? {
              ...item,
              quantity: qty,
              total:
                Number(item.price) * qty,
            }
          : item
      )
    );
  };

  // ==========================================
  // SUBTOTAL
  // ==========================================

  const subtotal = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum + Number(item.total),
      0
    );
  }, [items]);

  // ==========================================
  // DISCOUNT
  // ==========================================

  const discountAmount =
    subtotal *
    (Number(discountPercent) / 100);

  const afterDiscount =
    subtotal - discountAmount;

  // ==========================================
  // GST
  // ==========================================

  const taxAmount =
    afterDiscount *
    (Number(taxPercent) / 100);

  // ==========================================
  // GRAND TOTAL
  // ==========================================

  const grandTotal =
    afterDiscount + taxAmount;

  // ==========================================
  // CURRENCY
  // ==========================================

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }
    ).format(Number(amount) || 0);
  };

  // ==========================================
  // CREATE INVOICE
  // ==========================================

  const handleCreateInvoice = async () => {
    if (!customerId) {
      alert("Please select a customer");
      return;
    }

    if (items.length === 0) {
      alert(
        "Please add at least one product"
      );
      return;
    }

    if (
      Number(discountPercent) < 0 ||
      Number(discountPercent) > 100
    ) {
      alert(
        "Discount must be between 0 and 100"
      );
      return;
    }

    if (
      Number(taxPercent) < 0 ||
      Number(taxPercent) > 100
    ) {
      alert(
        "GST must be between 0 and 100"
      );
      return;
    }

    try {
      setSaving(true);

      const response = await API.post(
        "/invoices",
        {
          customer_id: Number(customerId),

          items: items.map((item) => ({
            product_id: Number(
              item.product_id
            ),
            quantity: Number(item.quantity),
          })),

          discount_percent:
            Number(discountPercent),

          tax_percent:
            Number(taxPercent),
        }
      );

      const invoice =
        response.data?.invoice;

      alert(
        "Invoice created successfully ✅"
      );

      if (invoice?.id) {
        navigate(
          `/invoice/${invoice.id}`
        );
      }
    } catch (error) {
      console.error(
        "Create Invoice Error:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to create invoice"
      );
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // LOADING
  // ==========================================

  if (loading) {
    return (
      <div className="invoice-loading">
        Loading billing data...
      </div>
    );
  }

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="invoices-page">

      {/* HEADER */}

      <div className="invoice-page-header">
        <div>
          <h1>
            🧾 Create Invoice
          </h1>

          <p>
            Create professional bills for
            your customers
          </p>
        </div>

        <button
          type="button"
          className="invoice-back-button"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          ← Dashboard
        </button>
      </div>

      {/* CUSTOMER DETAILS */}

      <div className="invoice-card">
        <h2>
          👤 Customer Details
        </h2>

        <div className="invoice-form-grid">
          <div className="invoice-form-group">
            <label>
              Select Customer *
            </label>

            <select
              value={customerId}
              onChange={(e) =>
                setCustomerId(
                  e.target.value
                )
              }
            >
              <option value="">
                Select Customer
              </option>

              {customers.map(
                (customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name} -{" "}
                    {customer.mobile}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      {/* ADD PRODUCTS */}

      <div className="invoice-card">
        <h2>
          📦 Add Products
        </h2>

        <div className="add-product-grid">

          <div className="invoice-form-group">
            <label>
              Product
            </label>

            <select
              value={productId}
              onChange={(e) =>
                setProductId(
                  e.target.value
                )
              }
            >
              <option value="">
                Select Product
              </option>

              {products
                .filter(
                  (product) =>
                    Number(product.stock) >
                    0
                )
                .map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name} —{" "}
                    {formatCurrency(
                      product.price
                    )}{" "}
                    — Stock:{" "}
                    {product.stock}
                  </option>
                ))}
            </select>
          </div>

          <div className="invoice-form-group">
            <label>
              Quantity
            </label>

            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  e.target.value
                )
              }
            />
          </div>

          <button
            type="button"
            className="add-product-button"
            onClick={addItem}
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* INVOICE ITEMS */}

      <div className="invoice-card">
        <h2>
          🛒 Invoice Items
        </h2>

        {items.length === 0 ? (
          <div className="invoice-empty">
            <div>🛒</div>

            <h3>
              No products added
            </h3>

            <p>
              Select a product above to
              add it to the invoice.
            </p>
          </div>
        ) : (
          <div className="invoice-items-table">
            <table>
              <thead>
                <tr>
                  <th>
                    Product
                  </th>

                  <th>
                    Price
                  </th>

                  <th>
                    Quantity
                  </th>

                  <th>
                    Total
                  </th>

                  <th>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map(
                  (item) => (
                    <tr
                      key={
                        item.product_id
                      }
                    >
                      <td>
                        <strong>
                          {
                            item.product_name
                          }
                        </strong>
                      </td>

                      <td>
                        {formatCurrency(
                          item.price
                        )}
                      </td>

                      <td>
                        <input
                          className="quantity-input"
                          type="number"
                          min="1"
                          value={
                            item.quantity
                          }
                          onChange={(e) =>
                            updateQuantity(
                              item.product_id,
                              e.target
                                .value
                            )
                          }
                        />
                      </td>

                      <td>
                        <strong>
                          {formatCurrency(
                            item.total
                          )}
                        </strong>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="remove-item-button"
                          onClick={() =>
                            removeItem(
                              item.product_id
                            )
                          }
                        >
                          🗑️ Remove
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TAX & DISCOUNT */}

      <div className="invoice-summary-card">

        <div className="invoice-summary-left">

          <h2>
            💰 Tax & Discount
          </h2>

          <div className="summary-input">
            <label>
              Discount (%)
            </label>

            <input
              type="number"
              min="0"
              max="100"
              value={
                discountPercent
              }
              onChange={(e) =>
                setDiscountPercent(
                  e.target.value
                )
              }
            />
          </div>

          <div className="summary-input">
            <label>
              GST / Tax (%)
            </label>

            <input
              type="number"
              min="0"
              max="100"
              value={taxPercent}
              onChange={(e) =>
                setTaxPercent(
                  e.target.value
                )
              }
            />
          </div>

        </div>

        {/* TOTAL */}

        <div className="invoice-total-box">

          <div className="total-row">
            <span>
              Subtotal
            </span>

            <strong>
              {formatCurrency(
                subtotal
              )}
            </strong>
          </div>

          <div className="total-row">
            <span>
              Discount (
              {discountPercent}
              %)
            </span>

            <strong>
              -{" "}
              {formatCurrency(
                discountAmount
              )}
            </strong>
          </div>

          <div className="total-row">
            <span>
              GST (
              {taxPercent}
              %)
            </span>

            <strong>
              +{" "}
              {formatCurrency(
                taxAmount
              )}
            </strong>
          </div>

          <div className="grand-total-row">
            <span>
              Grand Total
            </span>

            <strong>
              {formatCurrency(
                grandTotal
              )}
            </strong>
          </div>

        </div>
      </div>

      {/* CREATE INVOICE */}

      <div className="invoice-create-section">

        <button
          type="button"
          className="create-invoice-button"
          onClick={
            handleCreateInvoice
          }
          disabled={saving}
        >
          {saving
            ? "Creating Invoice..."
            : "🧾 Generate Invoice"}
        </button>

      </div>

    </div>
  );
}

export default Invoices;