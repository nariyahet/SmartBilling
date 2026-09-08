import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticSalesOrders.css";

function PlasticSalesOrders() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [salesOrders, setSalesOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // New SO Form State
  const [formData, setFormData] = useState({
    customer_id: "",
    order_date: new Date().toISOString().split("T")[0],
    expected_delivery_date: "",
    notes: "",
    items: [],
  });

  const [newItem, setNewItem] = useState({
    finished_good_id: "",
    quantity: 100,
    rate: 0,
    unit: "KG",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [soRes, custRes, fgRes] = await Promise.all([
        API.get("/plastic-erp/sales"),
        API.get("/customers"),
        API.get("/plastic-erp/inventory/finished-goods"),
      ]);

      if (soRes.data?.success) setSalesOrders(soRes.data.orders || []);
      if (custRes.data?.customers) setCustomers(custRes.data.customers || []);
      if (fgRes.data?.finishedGoods) setFinishedGoods(fgRes.data.finishedGoods || []);
    } catch (err) {
      console.error("Failed to load sales orders data:", err);
      alert("Failed to load sales orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const handleOpenCreateModal = async () => {
    setFormData({
      customer_id: customers[0]?.id ? String(customers[0].id) : "",
      order_date: new Date().toISOString().split("T")[0],
      expected_delivery_date: "",
      notes: "",
      items: [],
    });
    setCreateModalOpen(true);
  };

  const handleAddItem = () => {
    if (!newItem.finished_good_id) {
      alert("Select a finished good product");
      return;
    }
    const fg = finishedGoods.find((f) => String(f.id) === String(newItem.finished_good_id));
    if (!fg) return;

    const qty = Number(newItem.quantity) || 0;
    const rate = Number(newItem.rate) || Number(fg.selling_price) || 0;
    const lineTotal = qty * rate;

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          finished_good_id: fg.id,
          fg_name: fg.fg_name,
          fg_code: fg.fg_code,
          quantity: qty,
          rate,
          unit: newItem.unit || fg.unit || "KG",
          line_total: lineTotal,
        },
      ],
    }));

    setNewItem({
      finished_good_id: "",
      quantity: 100,
      rate: 0,
      unit: "KG",
    });
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, itm) => sum + (Number(itm.line_total) || 0), 0);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!formData.customer_id) {
      alert("Please select a customer");
      return;
    }
    if (formData.items.length === 0) {
      alert("Please add at least one line item");
      return;
    }

    try {
      const res = await API.post("/plastic-erp/sales", formData);
      if (res.data?.success) {
        alert("Sales order created successfully!");
        setCreateModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error("Create Sales Order error:", err);
      alert(err.response?.data?.message || "Failed to create sales order");
    }
  };

  const handleConfirmOrder = async (orderId) => {
    if (!window.confirm("Confirm this order and reserve available Finished Goods stock?")) return;
    try {
      const res = await API.patch(`/plastic-erp/sales/${orderId}/confirm`);
      if (res.data?.success) {
        alert("Sales order confirmed and stock reserved successfully!");
        fetchData();
      }
    } catch (err) {
      console.error("Confirm SO error:", err);
      alert(err.response?.data?.message || "Failed to confirm sales order");
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Cancel this sales order and release any active stock reservations?")) return;
    try {
      const res = await API.patch(`/plastic-erp/sales/${orderId}/cancel`);
      if (res.data?.success) {
        alert("Sales order cancelled and reserved stock released!");
        fetchData();
      }
    } catch (err) {
      console.error("Cancel SO error:", err);
      alert(err.response?.data?.message || "Failed to cancel sales order");
    }
  };

  const handleViewDetails = async (orderId) => {
    try {
      const res = await API.get(`/plastic-erp/sales/${orderId}`);
      if (res.data?.success) {
        setSelectedOrder(res.data.order);
        setDetailsModalOpen(true);
      }
    } catch (err) {
      console.error("Fetch SO details error:", err);
      alert("Failed to fetch order details");
    }
  };

  const handleCreateDispatchFromSO = (order) => {
    navigate("/plastic-erp/dispatch", {
      state: {
        prefillSalesOrderId: order.id,
        prefillCustomerId: order.customer_id,
      },
    });
  };

  const handleCreateInvoiceFromSO = (order) => {
    navigate("/invoices/create", {
      state: {
        prefillCustomer: order.customer_id,
        prefillSalesOrderId: order.id,
        prefillItems: (order.items || []).map((itm) => ({
          product_id: itm.finished_good_id,
          product_name: itm.fg_name,
          quantity: Number(itm.quantity),
          price: Number(itm.rate),
          total: Number(itm.line_total),
        })),
      },
    });
  };

  const filteredOrders = salesOrders.filter((order) => {
    const matchesStatus = !statusFilter || order.status === statusFilter;
    const matchesCustomer = !customerFilter || String(order.customer_id) === String(customerFilter);
    const matchesSearch =
      !searchQuery ||
      order.sales_order_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCustomer && matchesSearch;
  });

  const totalOrdersCount = salesOrders.length;
  const reservedOrdersCount = salesOrders.filter((o) => ["CONFIRMED", "RESERVED", "PARTIALLY_RESERVED"].includes(o.status)).length;
  const completedOrdersCount = salesOrders.filter((o) => ["DISPATCHED", "COMPLETED"].includes(o.status)).length;
  const totalValueSum = salesOrders.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0);

  if (loading) return <LoadingScreen />;

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />

      <main className="plastic-content-wrap">
        <header className="plastic-page-header">
          <div>
            <h1 className="plastic-page-title">📋 Sales Order Management</h1>
            <p className="plastic-page-subtitle">
              Manage customer orders, reserve finished goods stock, and pipeline dispatches
            </p>
          </div>
          <div className="plastic-page-actions">
            <Link to="/plastic-erp" className="btn-dashboard-nav">
              ← Dashboard
            </Link>
            <button className="btn-primary" onClick={handleOpenCreateModal}>
              + New Sales Order
            </button>
          </div>
        </header>

        {/* 4 KPI Cards */}
        <section className="so-kpi-grid">
          <div className="so-kpi-card">
            <div className="so-kpi-icon">📑</div>
            <div className="so-kpi-info">
              <span className="so-kpi-label">Total Orders</span>
              <strong className="so-kpi-value">{totalOrdersCount}</strong>
            </div>
          </div>
          <div className="so-kpi-card">
            <div className="so-kpi-icon">🔒</div>
            <div className="so-kpi-info">
              <span className="so-kpi-label">Reserved Orders</span>
              <strong className="so-kpi-value">{reservedOrdersCount}</strong>
            </div>
          </div>
          <div className="so-kpi-card">
            <div className="so-kpi-icon">🚚</div>
            <div className="so-kpi-info">
              <span className="so-kpi-label">Dispatched / Done</span>
              <strong className="so-kpi-value">{completedOrdersCount}</strong>
            </div>
          </div>
          <div className="so-kpi-card">
            <div className="so-kpi-icon">💰</div>
            <div className="so-kpi-info">
              <span className="so-kpi-label">Total Pipeline Value</span>
              <strong className="so-kpi-value">₹{totalValueSum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </section>

        {/* Orders Table Card */}
        <section className="plastic-card">
          <div className="plastic-card-header">
            <div className="filter-row">
              <input
                type="text"
                className="filter-input"
                placeholder="Search by SO# or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="RESERVED">RESERVED</option>
                <option value="PARTIALLY_DISPATCHED">PARTIALLY_DISPATCHED</option>
                <option value="DISPATCHED">DISPATCHED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
              <select
                className="filter-select"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: "13px", color: "#64748b" }}>
              Showing {filteredOrders.length} of {salesOrders.length} orders
            </span>
          </div>

          <div className="table-responsive">
            <table className="plastic-table">
              <thead>
                <tr>
                  <th>SO Number</th>
                  <th>Customer</th>
                  <th>Order Date</th>
                  <th>Delivery Date</th>
                  <th>Ordered Qty</th>
                  <th>Reserved Qty</th>
                  <th>Dispatched</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                      No sales orders found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((so) => (
                    <tr key={so.id}>
                      <td>
                        <strong>{so.sales_order_no}</strong>
                      </td>
                      <td>
                        <div>{so.customer_name}</div>
                        <small style={{ color: "#64748b" }}>{so.customer_mobile}</small>
                      </td>
                      <td>{so.order_date ? new Date(so.order_date).toLocaleDateString("en-IN") : "-"}</td>
                      <td>{so.expected_delivery_date ? new Date(so.expected_delivery_date).toLocaleDateString("en-IN") : "-"}</td>
                      <td>{Number(so.total_ordered_qty || 0).toLocaleString("en-IN")} KG</td>
                      <td>{Number(so.total_reserved_qty || 0).toLocaleString("en-IN")} KG</td>
                      <td>{Number(so.total_dispatched_qty || 0).toLocaleString("en-IN")} KG</td>
                      <td>
                        <strong>₹{Number(so.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                      </td>
                      <td>
                        <span className={`status-badge ${so.status?.toLowerCase()}`}>{so.status}</span>
                      </td>
                      <td>
                        <div className="action-btn-group">
                          <button
                            className="btn-table-action"
                            onClick={() => handleViewDetails(so.id)}
                            title="View order items & timeline"
                          >
                            👁️ View
                          </button>

                          {so.status === "DRAFT" && (
                            <button
                              className="btn-table-action confirm"
                              onClick={() => handleConfirmOrder(so.id)}
                              title="Confirm and reserve FG stock"
                            >
                              🔒 Reserve
                            </button>
                          )}

                          {["RESERVED", "PARTIALLY_DISPATCHED"].includes(so.status) && (
                            <button
                              className="btn-table-action confirm"
                              onClick={() => handleCreateDispatchFromSO(so)}
                              title="Create Dispatch for this order"
                            >
                              🚚 Dispatch
                            </button>
                          )}

                          {["DRAFT", "CONFIRMED", "RESERVED"].includes(so.status) && (
                            <button
                              className="btn-table-action cancel"
                              onClick={() => handleCancelOrder(so.id)}
                              title="Cancel order and release reservations"
                            >
                              ✕ Cancel
                            </button>
                          )}

                          <button
                            className="btn-table-action invoice"
                            onClick={() => handleCreateInvoiceFromSO(so)}
                            title="Open in SmartBilling Invoices"
                          >
                            📄 Invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* CREATE SALES ORDER MODAL */}
      {createModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Sales Order</h3>
              <button className="modal-close" onClick={() => setCreateModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitOrder}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Customer *</label>
                    <select
                      className="form-select"
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      required
                    >
                      <option value="">Select Customer</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.mobile})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Order Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.order_date}
                      onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Expected Delivery Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.expected_delivery_date}
                      onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="items-section">
                  <div className="items-header">
                    <strong>Order Line Items</strong>
                  </div>

                  <div className="form-grid" style={{ marginBottom: "12px", alignItems: "flex-end" }}>
                    <div className="form-group" style={{ gridColumn: "span 2" }}>
                      <label>Finished Good Material</label>
                      <select
                        className="form-select"
                        value={newItem.finished_good_id}
                        onChange={(e) => {
                          const fg = finishedGoods.find((f) => String(f.id) === e.target.value);
                          setNewItem({
                            ...newItem,
                            finished_good_id: e.target.value,
                            rate: fg ? Number(fg.selling_price) || 0 : 0,
                            unit: fg ? fg.unit : "KG",
                          });
                        }}
                      >
                        <option value="">Select Finished Good</option>
                        {finishedGoods.map((fg) => (
                          <option key={fg.id} value={fg.id}>
                            {fg.fg_name} ({fg.fg_code}) — Stock: {fg.current_stock} {fg.unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Quantity ({newItem.unit})</label>
                      <input
                        type="number"
                        className="form-input"
                        min="1"
                        step="any"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Rate (₹)</label>
                      <input
                        type="number"
                        className="form-input"
                        min="0"
                        step="any"
                        value={newItem.rate}
                        onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleAddItem}
                      style={{ height: "40px" }}
                    >
                      + Add Item
                    </button>
                  </div>

                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th>Qty</th>
                        <th>Rate (₹)</th>
                        <th>Total (₹)</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: "center", color: "#64748b" }}>
                            No items added yet. Select a finished good and click Add Item.
                          </td>
                        </tr>
                      ) : (
                        formData.items.map((itm, idx) => (
                          <tr key={idx}>
                            <td>{itm.fg_name}</td>
                            <td>{itm.quantity} {itm.unit}</td>
                            <td>₹{itm.rate}</td>
                            <td>₹{itm.line_total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td>
                              <button
                                type="button"
                                className="btn-table-action cancel"
                                onClick={() => handleRemoveItem(idx)}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  <div className="order-totals">
                    <div className="total-row grand">
                      <span>Grand Total:</span>
                      <span>₹{calculateSubtotal().toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: "16px" }}>
                  <label>Notes & Instructions</label>
                  <textarea
                    className="form-textarea"
                    rows="2"
                    placeholder="Dispatch instructions, payment terms, or transport details..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Sales Order (Draft)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {detailsModalOpen && selectedOrder && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Sales Order: {selectedOrder.sales_order_no}</h3>
              <button className="modal-close" onClick={() => setDetailsModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ marginBottom: "16px" }}>
                <div>
                  <strong>Customer:</strong> {selectedOrder.customer_name} ({selectedOrder.customer_mobile})
                </div>
                <div>
                  <strong>Order Date:</strong> {new Date(selectedOrder.order_date).toLocaleDateString("en-IN")}
                </div>
                <div>
                  <strong>Status:</strong>{" "}
                  <span className={`status-badge ${selectedOrder.status?.toLowerCase()}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <div>
                  <strong>Grand Total:</strong> ₹{Number(selectedOrder.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>

              <h4 style={{ margin: "16px 0 8px 0" }}>Order Items</h4>
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Ordered Qty</th>
                    <th>Reserved Qty</th>
                    <th>Dispatched Qty</th>
                    <th>Rate</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder.items || []).map((itm) => (
                    <tr key={itm.id}>
                      <td>{itm.fg_name} ({itm.plastic_type})</td>
                      <td>{itm.quantity} {itm.unit}</td>
                      <td>{itm.reserved_quantity} {itm.unit}</td>
                      <td>{itm.dispatched_quantity} {itm.unit}</td>
                      <td>₹{itm.rate}</td>
                      <td>₹{Number(itm.line_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedOrder.reservations?.length > 0 && (
                <>
                  <h4 style={{ margin: "20px 0 8px 0" }}>Stock Reservations</h4>
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th>Reserved Quantity</th>
                        <th>Status</th>
                        <th>Reserved At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.reservations.map((r) => (
                        <tr key={r.id}>
                          <td>{r.fg_name}</td>
                          <td>{r.reserved_quantity} KG</td>
                          <td><span className={`status-badge ${r.status?.toLowerCase()}`}>{r.status}</span></td>
                          <td>{new Date(r.reserved_at).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDetailsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticSalesOrders;
