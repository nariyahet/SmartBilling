import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  KpiCard,
  Card,
  DataTable,
  Modal,
  Button,
  StatusBadge,
  AlertBanner,
} from "../components";
import "./PlasticSalesOrders.css";

function PlasticSalesOrders() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [salesOrders, setSalesOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });

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
      setAlertInfo({ type: "error", message: "Failed to load sales orders" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
      setAlertInfo({ type: "warning", message: "Select a finished good product" });
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
      setAlertInfo({ type: "warning", message: "Please select a customer" });
      return;
    }
    if (formData.items.length === 0) {
      setAlertInfo({ type: "warning", message: "Please add at least one line item" });
      return;
    }

    try {
      const res = await API.post("/plastic-erp/sales", formData);
      if (res.data?.success) {
        setAlertInfo({ type: "success", message: "Sales order created successfully!" });
        setCreateModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error("Create Sales Order error:", err);
      setAlertInfo({ type: "error", message: err.response?.data?.message || "Failed to create sales order" });
    }
  };

  const handleConfirmOrder = async (orderId) => {
    if (!window.confirm("Confirm this order and reserve available Finished Goods stock?")) return;
    try {
      const res = await API.patch(`/plastic-erp/sales/${orderId}/confirm`);
      if (res.data?.success) {
        setAlertInfo({ type: "success", message: "Sales order confirmed and stock reserved successfully!" });
        fetchData();
      }
    } catch (err) {
      console.error("Confirm SO error:", err);
      setAlertInfo({ type: "error", message: err.response?.data?.message || "Failed to confirm sales order" });
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Cancel this sales order and release any active stock reservations?")) return;
    try {
      const res = await API.patch(`/plastic-erp/sales/${orderId}/cancel`);
      if (res.data?.success) {
        setAlertInfo({ type: "success", message: "Sales order cancelled and reserved stock released!" });
        fetchData();
      }
    } catch (err) {
      console.error("Cancel SO error:", err);
      setAlertInfo({ type: "error", message: err.response?.data?.message || "Failed to cancel sales order" });
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
      setAlertInfo({ type: "error", message: "Failed to fetch order details" });
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

  if (loading) return <LoadingScreen message="Loading Sales Orders..." />;

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Sales Order Management"
        subtitle="Manage customer orders, reserve finished goods stock, and pipeline dispatches"
        breadcrumbs={[
          { label: "ERP", to: "/plastic-erp" },
          { label: "Sales & Dispatch", to: "/plastic-erp/sales-orders" },
          { label: "Sales Orders" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/plastic-erp">
              <Button variant="secondary">ERP Dashboard</Button>
            </Link>
            <Button variant="primary" onClick={handleOpenCreateModal}>
              + New Sales Order
            </Button>
          </div>
        }
      />

      {alertInfo.message && (
        <AlertBanner
          type={alertInfo.type}
          message={alertInfo.message}
          onClose={() => setAlertInfo({ type: "", message: "" })}
        />
      )}

      {/* 4 KPI Cards */}
      <div className="sb-kpis-grid" style={{ marginBottom: "24px" }}>
        <KpiCard
          label="Total Orders"
          value={totalOrdersCount}
          subtext="Total customer orders"
          accent="navy"
        />
        <KpiCard
          label="Reserved Orders"
          value={reservedOrdersCount}
          subtext="Active stock reservations"
          accent="teal"
        />
        <KpiCard
          label="Dispatched / Done"
          value={completedOrdersCount}
          subtext="Shipped to customers"
          accent="blue"
        />
        <KpiCard
          label="Total Pipeline Value"
          value={`₹${totalValueSum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          subtext="Gross sales order pipeline"
          accent="navy"
        />
      </div>

      {/* Orders Table Card */}
      <Card noPadding>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--sb-border)", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              className="sb-input"
              style={{ width: "240px", height: "36px" }}
              placeholder="Search by SO# or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="sb-input"
              style={{ width: "160px", height: "36px" }}
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
              className="sb-input"
              style={{ width: "180px", height: "36px" }}
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
          <span style={{ fontSize: "13px", color: "var(--sb-muted)" }}>
            Showing {filteredOrders.length} of {salesOrders.length} orders
          </span>
        </div>

        <DataTable
          headers={[
            "SO Number",
            "Customer",
            "Order Date",
            "Delivery Date",
            "Ordered Qty",
            "Reserved Qty",
            "Dispatched",
            "Grand Total",
            "Status",
            "Actions",
          ]}
        >
          {filteredOrders.length === 0 ? (
            <tr>
              <td colSpan="10" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                No sales orders found matching filters.
              </td>
            </tr>
          ) : (
            filteredOrders.map((so) => (
              <tr key={so.id}>
                <td><strong>{so.sales_order_no}</strong></td>
                <td>
                  <div style={{ fontWeight: 600 }}>{so.customer_name}</div>
                  <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>{so.customer_mobile}</div>
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
                  <StatusBadge status={so.status} />
                </td>
                <td>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleViewDetails(so.id)}
                      title="View order items & timeline"
                    >
                      👁️ View
                    </Button>

                    {so.status === "DRAFT" && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleConfirmOrder(so.id)}
                        title="Confirm and reserve FG stock"
                      >
                        🔒 Reserve
                      </Button>
                    )}

                    {["RESERVED", "PARTIALLY_DISPATCHED"].includes(so.status) && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleCreateDispatchFromSO(so)}
                        title="Create Dispatch for this order"
                      >
                        🚚 Dispatch
                      </Button>
                    )}

                    {["DRAFT", "CONFIRMED", "RESERVED"].includes(so.status) && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleCancelOrder(so.id)}
                        title="Cancel order and release reservations"
                      >
                        ✕ Cancel
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCreateInvoiceFromSO(so)}
                      title="Open in SmartBilling Invoices"
                    >
                      📄 Invoice
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </Card>

      {/* CREATE SALES ORDER MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Sales Order"
      >
        <form onSubmit={handleSubmitOrder} className="sb-form">
          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Customer *</label>
              <select
                className="sb-input"
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

            <div className="sb-form-group">
              <label className="sb-label">Order Date *</label>
              <input
                type="date"
                className="sb-input"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                required
              />
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Expected Delivery Date</label>
              <input
                type="date"
                className="sb-input"
                value={formData.expected_delivery_date}
                onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginTop: "16px", border: "1px solid var(--sb-border)", borderRadius: "8px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--sb-navy)", fontWeight: 700 }}>
              Order Line Items
            </h4>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "10px", alignItems: "flex-end", marginBottom: "12px" }}>
              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">Finished Good Material</label>
                <select
                  className="sb-input"
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

              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">Quantity ({newItem.unit})</label>
                <input
                  type="number"
                  className="sb-input"
                  min="1"
                  step="any"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                />
              </div>

              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">Rate (₹)</label>
                <input
                  type="number"
                  className="sb-input"
                  min="0"
                  step="any"
                  value={newItem.rate}
                  onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={handleAddItem}
                style={{ height: "38px" }}
              >
                + Add
              </Button>
            </div>

            <DataTable
              headers={["Material", "Qty", "Rate (₹)", "Total (₹)", "Action"]}
            >
              {formData.items.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", color: "var(--sb-muted)" }}>
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
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        ✕
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </DataTable>

            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--sb-navy)" }}>
                Grand Total: ₹{calculateSubtotal().toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="sb-form-group" style={{ marginTop: "16px" }}>
            <label className="sb-label">Notes & Instructions</label>
            <textarea
              className="sb-input"
              rows="2"
              placeholder="Dispatch instructions, payment terms, or transport details..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Sales Order (Draft)
            </Button>
          </div>
        </form>
      </Modal>

      {/* VIEW DETAILS MODAL */}
      <Modal
        isOpen={detailsModalOpen && !!selectedOrder}
        onClose={() => setDetailsModalOpen(false)}
        title={`Sales Order: ${selectedOrder?.sales_order_no || ""}`}
      >
        {selectedOrder && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "var(--sb-canvas)", padding: "14px", borderRadius: "8px", marginBottom: "16px" }}>
              <div>
                <strong>Customer:</strong> {selectedOrder.customer_name} ({selectedOrder.customer_mobile})
              </div>
              <div>
                <strong>Order Date:</strong> {new Date(selectedOrder.order_date).toLocaleDateString("en-IN")}
              </div>
              <div>
                <strong>Status:</strong> <StatusBadge status={selectedOrder.status} />
              </div>
              <div>
                <strong>Grand Total:</strong> ₹{Number(selectedOrder.grand_total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <h4 style={{ margin: "16px 0 8px 0", color: "var(--sb-navy)", fontSize: "14px", fontWeight: 700 }}>Order Items</h4>
            <DataTable
              headers={["Product", "Ordered Qty", "Reserved Qty", "Dispatched Qty", "Rate", "Total"]}
            >
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
            </DataTable>

            {selectedOrder.reservations?.length > 0 && (
              <>
                <h4 style={{ margin: "20px 0 8px 0", color: "var(--sb-navy)", fontSize: "14px", fontWeight: 700 }}>Stock Reservations</h4>
                <DataTable
                  headers={["Material", "Reserved Quantity", "Status", "Reserved At"]}
                >
                  {selectedOrder.reservations.map((r) => (
                    <tr key={r.id}>
                      <td>{r.fg_name}</td>
                      <td>{r.reserved_quantity} KG</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>{new Date(r.reserved_at).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </DataTable>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
              <Button variant="secondary" onClick={() => setDetailsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PlasticSalesOrders;
