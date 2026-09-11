import { useEffect, useState, useMemo } from "react";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import AppShell from "../components/AppShell";
import "./Products.css";

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("search") || "";
    } catch {
      return "";
    }
  });
  const [stockFilter, setStockFilter] = useState("all");

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await API.get("/products");
      if (response.data.success) {
        setProducts(response.data.products || []);
      }
    } catch (error) {
      console.error("Products loading error:", error);
      alert(error.response?.data?.message || "Unable to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProducts();
  }, []);

  const resetForm = () => {
    setName("");
    setPrice("");
    setStock("");
    setEditingId(null);
    setShowModal(false);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (product) => {
    setEditingId(product.id);
    setName(product.name);
    setPrice(product.price);
    setStock(product.stock);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter product name");
      return;
    }

    if (price === "" || Number(price) < 0) {
      alert("Please enter a valid price");
      return;
    }

    if (stock === "" || Number(stock) < 0) {
      alert("Please enter a valid stock");
      return;
    }

    try {
      setSaving(true);
      const productData = {
        name: name.trim(),
        price: Number(price),
        stock: Number(stock),
      };

      if (editingId) {
        await API.put(`/products/${editingId}`, productData);
      } else {
        await API.post("/products", productData);
      }

      resetForm();
      await loadProducts();
    } catch (error) {
      console.error("Product save error:", error);
      alert(error.response?.data?.message || "Unable to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this product?");
    if (!confirmDelete) return;

    try {
      await API.delete(`/products/${id}`);
      await loadProducts();
    } catch (error) {
      console.error("Product delete error:", error);
      if (error.response?.status === 409) {
        alert(error.response?.data?.message || "This product cannot be deleted because invoices are linked to this product.");
        return;
      }
      alert(error.response?.data?.message || "Unable to delete product");
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const productName = String(product.name || "").toLowerCase();
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = productName.includes(search);

      const productStock = Number(product.stock);
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "in-stock" && productStock > 5) ||
        (stockFilter === "low-stock" && productStock > 0 && productStock <= 5) ||
        (stockFilter === "out-of-stock" && productStock === 0);

      return matchesSearch && matchesStock;
    });
  }, [products, searchTerm, stockFilter]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  };

  const getStockStatus = (stockValue) => {
    const currentStock = Number(stockValue);
    if (currentStock === 0) {
      return { text: "Out of Stock", className: "status-out" };
    }
    if (currentStock <= 5) {
      return { text: "Low Stock", className: "status-low" };
    }
    return { text: "In Stock", className: "status-good" };
  };

  // KPI calculations
  const totalProducts = products.length;
  const inStockCount = products.filter((p) => Number(p.stock) > 5).length;
  const lowStockCount = products.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= 5).length;
  const outOfStockCount = products.filter((p) => Number(p.stock) === 0).length;

  if (loading && products.length === 0) {
    return <LoadingScreen title="Loading Products..." subtitle="Fetching inventory catalog..." />;
  }

  return (
    <AppShell
      activePage="products"
      searchPlaceholder="Search products by name..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      headerActions={
        <button
          type="button"
          className="sb-btn-primary"
          onClick={handleOpenAddModal}
        >
          <span>+</span> Add Product
        </button>
      }
    >
      {/* Header Section */}
      <div className="prod-header-bar">
        <div>
          <div className="prod-badge-tag">INVENTORY CATALOG</div>
          <h1 className="prod-title">Products Management</h1>
          <p className="prod-subtitle">
            Manage your product catalog, prices, and warehouse inventory stock levels.
          </p>
        </div>

        <div className="prod-header-actions">
          <button
            type="button"
            className="sb-btn-refresh-sm"
            onClick={loadProducts}
          >
            🔄 Refresh
          </button>
          <button
            type="button"
            className="sb-btn-primary"
            onClick={handleOpenAddModal}
          >
            <span>+</span> Add Product
          </button>
        </div>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <div className="prod-kpi-grid">
        <div className="prod-kpi-card accent-blue">
          <div className="kpi-icon-box">📦</div>
          <div className="kpi-info">
            <span className="kpi-label">Total Products</span>
            <strong className="kpi-val">{totalProducts}</strong>
            <span className="kpi-sub">In active catalog</span>
          </div>
        </div>

        <div className="prod-kpi-card accent-mint">
          <div className="kpi-icon-box">✅</div>
          <div className="kpi-info">
            <span className="kpi-label">In Stock</span>
            <strong className="kpi-val text-mint">{inStockCount}</strong>
            <span className="kpi-sub">Healthy inventory levels</span>
          </div>
        </div>

        <div className="prod-kpi-card accent-orange">
          <div className="kpi-icon-box">⚠️</div>
          <div className="kpi-info">
            <span className="kpi-label">Low Stock</span>
            <strong className="kpi-val text-orange">{lowStockCount}</strong>
            <span className="kpi-sub">5 or fewer items left</span>
          </div>
        </div>

        <div className="prod-kpi-card accent-red">
          <div className="kpi-icon-box">❌</div>
          <div className="kpi-info">
            <span className="kpi-label">Out of Stock</span>
            <strong className="kpi-val text-red">{outOfStockCount}</strong>
            <span className="kpi-sub">Zero stock remaining</span>
          </div>
        </div>
      </div>

      {/* Products Table Card */}
      <div className="prod-main-card">
        <div className="prod-card-top">
          <div className="prod-card-top-info">
            <h2 className="prod-card-title">Products Catalog</h2>
            <span className="prod-count-pill">
              {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="prod-filter-group">
            <div className="prod-search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Filter by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="prod-search-input"
              />
            </div>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="prod-filter-select"
            >
              <option value="all">All Inventory</option>
              <option value="in-stock">In Stock (&gt; 5)</option>
              <option value="low-stock">Low Stock (1 - 5)</option>
              <option value="out-of-stock">Out of Stock (0)</option>
            </select>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="prod-empty-state">
            <span className="empty-icon">📦</span>
            <h3>No Products Found</h3>
            <p>No products match your search query or selected inventory filter.</p>
            {(searchTerm || stockFilter !== "all") && (
              <button
                type="button"
                className="btn-clear-filter"
                onClick={() => {
                  setSearchTerm("");
                  setStockFilter("all");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="prod-table-responsive">
            <table className="prod-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>#</th>
                  <th>Product Details</th>
                  <th>Unit Price</th>
                  <th>Current Stock</th>
                  <th>Inventory Status</th>
                  <th style={{ textAlign: "right", width: "160px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, index) => {
                  const stockStatus = getStockStatus(product.stock);
                  return (
                    <tr key={product.id}>
                      <td className="text-muted font-bold">{index + 1}</td>
                      <td>
                        <div className="prod-cell-main">
                          <div className="prod-avatar-icon">📦</div>
                          <div>
                            <strong className="prod-name-text">{product.name}</strong>
                            <span className="prod-code-sub">SKU: PROD-{product.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong className="prod-price-text">{formatCurrency(product.price)}</strong>
                      </td>
                      <td>
                        <span className="prod-stock-num">{product.stock} units</span>
                      </td>
                      <td>
                        <span className={`prod-status-pill ${stockStatus.className}`}>
                          {stockStatus.text}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="prod-actions-wrap">
                          <button
                            type="button"
                            className="btn-action-edit"
                            onClick={() => handleEdit(product)}
                            title="Edit Product"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => handleDelete(product.id)}
                            title="Delete Product"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="prod-modal-backdrop" onClick={() => resetForm()}>
          <div className="prod-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="prod-modal-header">
              <div>
                <h3 className="modal-title">{editingId ? "✏️ Edit Product" : "➕ Add New Product"}</h3>
                <span className="modal-subtitle">
                  {editingId ? "Update pricing and stock numbers" : "Enter item details to register into catalog"}
                </span>
              </div>
              <button type="button" className="btn-modal-close" onClick={resetForm}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="prod-modal-form">
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Premium Cotton Shirt, Plastic Pellets"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Initial Stock *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 50"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>
              </div>

              <div className="prod-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-save"
                  disabled={saving}
                >
                  {saving ? "Saving..." : editingId ? "Update Product" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default Products;
