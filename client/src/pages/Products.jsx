import { useEffect, useState } from "react";
import API from "../api/axios";
import "./Products.css";

function Products() {
  const [products, setProducts] = useState([]);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  const [editingId, setEditingId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    const fetchProducts = async () => {
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

    fetchProducts();
  }, []);

  const resetForm = () => {
    setName("");
    setPrice("");
    setStock("");
    setEditingId(null);
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

        alert("Product updated successfully ✅");
      } else {
        await API.post("/products", productData);

        alert("Product added successfully ✅");
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

  const handleEdit = (product) => {
    setEditingId(product.id);
    setName(product.name);
    setPrice(product.price);
    setStock(product.stock);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this product?",
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await API.delete(`/products/${id}`);

      alert("Product deleted successfully ✅");

      await loadProducts();
    } catch (error) {
      console.error("Product delete error:", error);

      alert(error.response?.data?.message || "Unable to delete product");
    }
  };

  const filteredProducts = products.filter((product) => {
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
      return {
        text: "Out of Stock",
        className: "stock-out",
      };
    }

    if (currentStock <= 5) {
      return {
        text: "Low Stock",
        className: "stock-low",
      };
    }

    return {
      text: "In Stock",
      className: "stock-good",
    };
  };

  if (loading) {
    return <div className="products-loading">Loading products...</div>;
  }

  return (
    <div className="products-page">
      <div className="products-header">
        <div>
          <h1>📦 Products</h1>

          <p>Manage your products and inventory</p>
        </div>

        <button
          className="products-back-button"
          onClick={() => {
            window.location.href = "/dashboard";
          }}
        >
          ← Dashboard
        </button>
      </div>

      <div className="products-card">
        <h2>{editingId ? "✏️ Edit Product" : "➕ Add Product"}</h2>

        <form className="product-form" onSubmit={handleSubmit}>
          <div className="product-form-group">
            <label>Product Name</label>

            <input
              type="text"
              placeholder="Enter product name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="product-form-group">
            <label>Price</label>

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Enter price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <div className="product-form-group">
            <label>Stock</label>

            <input
              type="number"
              min="0"
              placeholder="Enter stock"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>

          <div className="product-form-buttons">
            <button
              type="submit"
              className="save-product-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Product"
                  : "Add Product"}
            </button>

            {editingId && (
              <button
                type="button"
                className="cancel-product-button"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="products-card">
        <div className="products-list-header">
          <div>
            <h2>Product List</h2>

            <p>
              {filteredProducts.length} product
              {filteredProducts.length !== 1 ? "s" : ""} found
            </p>
          </div>

          <button className="refresh-products-button" onClick={loadProducts}>
            🔄 Refresh
          </button>
        </div>

        <div className="product-filters">
          <input
            type="text"
            placeholder="🔍 Search product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
          >
            <option value="all">All Products</option>

            <option value="in-stock">In Stock</option>

            <option value="low-stock">Low Stock</option>

            <option value="out-of-stock">Out of Stock</option>
          </select>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="products-empty">
            <div className="empty-icon">📦</div>

            <h3>No Products Found</h3>

            <p>Try changing your search or stock filter.</p>
          </div>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>#</th>

                  <th>Product</th>

                  <th>Price</th>

                  <th>Stock</th>

                  <th>Status</th>

                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product, index) => {
                  const stockStatus = getStockStatus(product.stock);

                  return (
                    <tr key={product.id}>
                      <td>{index + 1}</td>

                      <td>
                        <strong>{product.name}</strong>
                      </td>

                      <td>{formatCurrency(product.price)}</td>

                      <td>{product.stock}</td>

                      <td>
                        <span
                          className={`stock-badge ${stockStatus.className}`}
                        >
                          {stockStatus.text}
                        </span>
                      </td>

                      <td>
                        <div className="product-action-buttons">
                          <button
                            className="edit-product-button"
                            onClick={() => handleEdit(product)}
                          >
                            ✏️ Edit
                          </button>

                          <button
                            className="delete-product-button"
                            onClick={() => handleDelete(product.id)}
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
    </div>
  );
}

export default Products;
