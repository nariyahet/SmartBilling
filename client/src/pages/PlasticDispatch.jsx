import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
import "./PlasticDispatch.css";

function PlasticDispatch() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [dispatches, setDispatches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [alertInfo, setAlertInfo] = useState({ type: "", message: "" });

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    customer_id: "",
    sales_order_id: "",
    vehicle_id: "",
    vehicle_number: "",
    driver_name: "",
    driver_mobile: "",
    transporter: "",
    destination: "",
    dispatch_date: new Date().toISOString().split("T")[0],
    notes: "",
    auto_dispatch: true,
    items: [],
  });

  const [newItem, setNewItem] = useState({
    finished_good_id: "",
    lot_id: "",
    quantity: 100,
    rate: 0,
    unit: "KG",
  });

  const [availableLots, setAvailableLots] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dispRes, custRes, soRes, vehRes, fgRes] = await Promise.all([
        API.get("/plastic-erp/dispatches"),
        API.get("/customers"),
        API.get("/plastic-erp/sales"),
        API.get("/plastic-erp/transport/vehicles"),
        API.get("/plastic-erp/inventory/finished-goods"),
      ]);

      if (dispRes.data?.success) setDispatches(dispRes.data.dispatches || []);
      if (custRes.data?.customers) setCustomers(custRes.data.customers || []);
      if (soRes.data?.orders) setSalesOrders(soRes.data.orders || []);
      if (vehRes.data?.vehicles) setVehicles(vehRes.data.vehicles || []);
      if (fgRes.data?.finishedGoods) setFinishedGoods(fgRes.data.finishedGoods || []);
    } catch (err) {
      console.error("Failed to load dispatch data:", err);
      setAlertInfo({ type: "error", message: "Failed to load dispatches" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle passed SO from location.state if navigated from Sales Orders page
  useEffect(() => {
    if (location.state?.fromSO && location.state.order) {
      const so = location.state.order;
      setFormData((prev) => ({
        ...prev,
        customer_id: so.customer_id || "",
        sales_order_id: so.id || "",
        items: (so.items || []).map((item) => ({
          finished_good_id: item.finished_good_id,
          fg_name: item.fg_name,
          fg_code: item.fg_code,
          quantity: Math.max(0, Number(item.quantity) - Number(item.dispatched_quantity || 0)),
          rate: Number(item.rate) || 0,
          unit: item.unit || "KG",
          lot_id: "",
        })).filter((i) => i.quantity > 0),
      }));
      setCreateModalOpen(true);
    }
  }, [location.state]);

  // When FG changes in newItem, fetch lots
  const handleFgChange = async (fgId) => {
    setNewItem((prev) => ({ ...prev, finished_good_id: fgId, lot_id: "" }));
    if (!fgId) {
      setAvailableLots([]);
      return;
    }
    try {
      const res = await API.get(`/plastic-erp/inventory/finished-goods/${fgId}/lots`);
      if (res.data?.success) {
        setAvailableLots(res.data.lots || []);
      }
    } catch (err) {
      console.error("Failed to fetch lots for FG:", err);
      setAvailableLots([]);
    }
  };

  // When vehicle selected from master
  const handleVehicleSelect = (vId) => {
    if (!vId) {
      setFormData((prev) => ({ ...prev, vehicle_id: "" }));
      return;
    }
    const veh = vehicles.find((v) => String(v.id) === String(vId));
    if (veh) {
      setFormData((prev) => ({
        ...prev,
        vehicle_id: veh.id,
        vehicle_number: veh.vehicle_number || "",
        transporter: veh.transporter_name || "",
        driver_name: veh.driver_name || "",
        driver_mobile: veh.driver_mobile || "",
      }));
    }
  };

  const handleAddItem = () => {
    if (!newItem.finished_good_id || Number(newItem.quantity) <= 0) {
      setAlertInfo({ type: "warning", message: "Please select a product and enter a valid quantity." });
      return;
    }
    const fg = finishedGoods.find((f) => String(f.id) === String(newItem.finished_good_id));
    const lot = availableLots.find((l) => String(l.id) === String(newItem.lot_id));

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...newItem,
          quantity: Number(newItem.quantity),
          rate: Number(newItem.rate) || 0,
          fg_name: fg ? fg.fg_name : "Finished Good",
          fg_code: fg ? fg.fg_code : "",
          lot_number: lot ? lot.lot_number : "",
        },
      ],
    }));

    setNewItem({
      finished_good_id: "",
      lot_id: "",
      quantity: 100,
      rate: 0,
      unit: "KG",
    });
    setAvailableLots([]);
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleCreateDispatch = async (e) => {
    e.preventDefault();
    if (!formData.customer_id) {
      setAlertInfo({ type: "warning", message: "Please select a customer." });
      return;
    }
    if (formData.items.length === 0) {
      setAlertInfo({ type: "warning", message: "Please add at least one dispatch item." });
      return;
    }

    try {
      setSubmitting(true);
      const res = await API.post("/plastic-erp/dispatches", formData);
      if (res.data?.success) {
        setAlertInfo({ type: "success", message: res.data.message || "Dispatch created successfully!" });
        setCreateModalOpen(false);
        setFormData({
          customer_id: "",
          sales_order_id: "",
          vehicle_id: "",
          vehicle_number: "",
          driver_name: "",
          driver_mobile: "",
          transporter: "",
          destination: "",
          dispatch_date: new Date().toISOString().split("T")[0],
          notes: "",
          auto_dispatch: true,
          items: [],
        });
        fetchData();
      }
    } catch (err) {
      console.error("Create Dispatch Error:", err);
      setAlertInfo({ type: "error", message: err.response?.data?.message || "Failed to create dispatch" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = async (dispatchId) => {
    try {
      const res = await API.get(`/plastic-erp/dispatches/${dispatchId}`);
      if (res.data?.success) {
        setSelectedDispatch(res.data.dispatch);
        setDetailsModalOpen(true);
      }
    } catch (err) {
      console.error("Fetch Dispatch Details Error:", err);
      setAlertInfo({ type: "error", message: "Failed to load dispatch details" });
    }
  };

  const handleUpdateStatus = async (dispatchId, newStatus) => {
    const confirmMsg =
      newStatus === "DISPATCHED"
        ? "Confirm dispatch? Finished Goods stock will be deducted and a Delivery Challan will be generated."
        : newStatus === "DELIVERED"
        ? "Mark this dispatch as DELIVERED?"
        : "Are you sure you want to cancel this dispatch?";

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await API.patch(`/plastic-erp/dispatches/${dispatchId}/status`, {
        status: newStatus,
        generate_challan: true,
      });
      if (res.data?.success) {
        setAlertInfo({ type: "success", message: res.data.message || `Dispatch status updated to ${newStatus}` });
        fetchData();
        if (selectedDispatch && selectedDispatch.id === dispatchId) {
          handleViewDetails(dispatchId);
        }
      }
    } catch (err) {
      console.error("Update Status Error:", err);
      setAlertInfo({ type: "error", message: err.response?.data?.message || "Failed to update status" });
    }
  };

  const handleGenerateInvoice = async (dispatchId) => {
    if (!window.confirm("Generate official Sales Tax Invoice for this dispatch?")) return;
    try {
      const res = await API.post(`/plastic-erp/dispatches/${dispatchId}/create-invoice`);
      if (res.data?.success) {
        setAlertInfo({ type: "success", message: `Invoice ${res.data.invoice_no} generated successfully!` });
        fetchData();
        navigate(`/invoices/${res.data.invoice_id}`);
      }
    } catch (err) {
      console.error("Generate Invoice Error:", err);
      setAlertInfo({ type: "error", message: err.response?.data?.message || "Failed to generate invoice" });
    }
  };

  // KPIs
  const totalDispatchesCount = dispatches.length;
  const pendingCount = dispatches.filter((d) => d.status === "PENDING").length;
  const dispatchedCount = dispatches.filter((d) => d.status === "DISPATCHED").length;
  const deliveredCount = dispatches.filter((d) => d.status === "DELIVERED").length;
  const totalQtyDispatched = dispatches
    .filter((d) => d.status === "DISPATCHED" || d.status === "DELIVERED")
    .reduce((sum, d) => sum + (Number(d.total_dispatched_qty) || 0), 0);

  // Filtered List
  const filteredDispatches = dispatches.filter((d) => {
    if (statusFilter && d.status !== statusFilter) return false;
    if (customerFilter && String(d.customer_id) !== String(customerFilter)) return false;
    if (fromDate && d.dispatch_date < fromDate) return false;
    if (toDate && d.dispatch_date > toDate) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const noMatch = String(d.dispatch_no || "").toLowerCase().includes(q);
      const custMatch = String(d.customer_name || "").toLowerCase().includes(q);
      const vehMatch = String(d.vehicle_number || "").toLowerCase().includes(q);
      const soMatch = String(d.sales_order_no || "").toLowerCase().includes(q);
      if (!noMatch && !custMatch && !vehMatch && !soMatch) return false;
    }
    return true;
  });

  if (loading) return <LoadingScreen message="Loading Plastic Dispatches..." />;

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Dispatch & Outward Delivery"
        subtitle="Manage product dispatches, truck loading, stock deductions, and one-click billing."
        breadcrumbs={[
          { label: "ERP", to: "/plastic-erp" },
          { label: "Sales & Dispatch", to: "/plastic-erp/sales-orders" },
          { label: "Dispatches" },
        ]}
        actions={
          <div className="dsp-header-actions">
            <Link to="/plastic-erp/transport/challans">
              <Button variant="secondary">Delivery Challans</Button>
            </Link>
            <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
              + New Dispatch
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

      {/* KPI Cards */}
      <div className="sb-kpis-grid" style={{ marginBottom: "24px" }}>
        <KpiCard
          label="Total Dispatches"
          value={totalDispatchesCount}
          subtext="All outbound shipments"
          accent="navy"
        />
        <KpiCard
          label="Pending Loading"
          value={pendingCount}
          subtext="Awaiting verification & loading"
          accent="warning"
        />
        <KpiCard
          label="In Transit"
          value={dispatchedCount}
          subtext="Vehicles en-route to customers"
          accent="blue"
        />
        <KpiCard
          label="Delivered"
          value={deliveredCount}
          subtext="Successfully delivered"
          accent="teal"
        />
        <KpiCard
          label="Shipped Volume"
          value={`${totalQtyDispatched.toLocaleString()} KG`}
          subtext="Gross dispatched volume"
          accent="navy"
        />
      </div>

      {/* Filters Bar */}
      <Card noPadding style={{ marginBottom: "24px" }}>
        <div className="dsp-filter-bar">
          <div className="dsp-filter-search">
            <input
              type="text"
              className="sb-input"
              style={{ height: "38px" }}
              placeholder="Search by Dispatch #, Customer, Vehicle, SO #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="dsp-filter-controls">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="sb-input"
              style={{ width: "160px", height: "38px" }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="DISPATCHED">Dispatched (In Transit)</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="sb-input"
              style={{ width: "180px", height: "38px" }}
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="sb-input"
              style={{ width: "140px", height: "38px" }}
              placeholder="From Date"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="sb-input"
              style={{ width: "140px", height: "38px" }}
              placeholder="To Date"
            />

            {(statusFilter || customerFilter || searchQuery || fromDate || toDate) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStatusFilter("");
                  setCustomerFilter("");
                  setSearchQuery("");
                  setFromDate("");
                  setToDate("");
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Dispatches Table */}
        <DataTable
          headers={[
            "Dispatch #",
            "Date",
            "Customer",
            "Vehicle / Transporter",
            "Sales Order",
            "Items / Qty",
            "Status",
            "Billing",
            "Actions",
          ]}
        >
          {filteredDispatches.length === 0 ? (
            <tr>
              <td colSpan="9" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                No dispatches found matching criteria.
              </td>
            </tr>
          ) : (
            filteredDispatches.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong style={{ color: "var(--sb-ocean)" }}>{d.dispatch_no}</strong>
                </td>
                <td>{d.dispatch_date ? new Date(d.dispatch_date).toLocaleDateString() : "—"}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{d.customer_name}</div>
                  <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>{d.customer_mobile || d.destination || ""}</div>
                </td>
                <td>
                  <div>{d.vehicle_number || "Self / Ex-Factory"}</div>
                  <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>{d.transporter || d.driver_name || ""}</div>
                </td>
                <td>
                  {d.sales_order_no ? (
                    <span className="dispatch-so-pill">{d.sales_order_no}</span>
                  ) : (
                    <span style={{ color: "var(--sb-muted)" }}>Direct</span>
                  )}
                </td>
                <td>
                  <div>
                    <strong>{Number(d.total_dispatched_qty || 0).toLocaleString()} KG</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>({d.total_items || 1} items)</div>
                </td>
                <td>
                  <StatusBadge status={d.status} />
                </td>
                <td>
                  {d.invoice_id ? (
                    <Link to={`/invoices/${d.invoice_id}`} className="dispatch-inv-badge billed">
                      {d.invoice_no}
                    </Link>
                  ) : (
                    <span className="dispatch-inv-badge unbilled">Unbilled</span>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleViewDetails(d.id)}
                      title="View Dispatch Details"
                    >
                      Details
                    </Button>

                    {d.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleUpdateStatus(d.id, "DISPATCHED")}
                        title="Confirm Dispatch & Deduct Stock"
                      >
                        Dispatch
                      </Button>
                    )}

                    {d.status === "DISPATCHED" && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleUpdateStatus(d.id, "DELIVERED")}
                        title="Mark Delivered"
                      >
                        Delivered
                      </Button>
                    )}

                    {!d.invoice_id && (d.status === "DISPATCHED" || d.status === "DELIVERED") && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleGenerateInvoice(d.id)}
                        title="Create Official Invoice"
                      >
                        Bill
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </Card>

      {/* CREATE DISPATCH MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Dispatch"
      >
        <form onSubmit={handleCreateDispatch} className="sb-form">
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
                    {c.name} ({c.mobile || "No Mobile"})
                  </option>
                ))}
              </select>
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Sales Order (Optional)</label>
              <select
                className="sb-input"
                value={formData.sales_order_id}
                onChange={(e) => {
                  const soId = e.target.value;
                  const so = salesOrders.find((s) => String(s.id) === String(soId));
                  if (so) {
                    setFormData((prev) => ({
                      ...prev,
                      sales_order_id: soId,
                      customer_id: so.customer_id,
                    }));
                  } else {
                    setFormData((prev) => ({ ...prev, sales_order_id: "" }));
                  }
                }}
              >
                <option value="">Direct Dispatch (No SO)</option>
                {salesOrders
                  .filter(
                    (so) =>
                      (!formData.customer_id || String(so.customer_id) === String(formData.customer_id)) &&
                      (so.status === "CONFIRMED" || so.status === "PARTIALLY_DISPATCHED")
                  )
                  .map((so) => (
                    <option key={so.id} value={so.id}>
                      {so.sales_order_no} — {so.customer_name} ({so.status})
                    </option>
                  ))}
              </select>
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Dispatch Date *</label>
              <input
                type="date"
                className="sb-input"
                value={formData.dispatch_date}
                onChange={(e) => setFormData({ ...formData, dispatch_date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Transport & Driver Info */}
          <div style={{ marginTop: "16px", borderTop: "1px dashed var(--sb-border)", paddingTop: "14px" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--sb-navy)", fontWeight: 700 }}>
              Transport & Driver Information
            </h4>
            <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div className="sb-form-group">
                <label className="sb-label">Select Registered Vehicle</label>
                <select
                  className="sb-input"
                  value={formData.vehicle_id}
                  onChange={(e) => handleVehicleSelect(e.target.value)}
                >
                  <option value="">Custom / Unregistered Vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} — {v.transporter_name || "Self"} ({v.vehicle_type || "Truck"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sb-form-group">
                <label className="sb-label">Vehicle Number</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="e.g. MH 12 AB 1234"
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                />
              </div>

              <div className="sb-form-group">
                <label className="sb-label">Transporter Name</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="e.g. Shree Logistics"
                  value={formData.transporter}
                  onChange={(e) => setFormData({ ...formData, transporter: e.target.value })}
                />
              </div>

              <div className="sb-form-group">
                <label className="sb-label">Driver Name</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="Driver's Full Name"
                  value={formData.driver_name}
                  onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                />
              </div>

              <div className="sb-form-group">
                <label className="sb-label">Driver Mobile</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="10-digit mobile"
                  value={formData.driver_mobile}
                  onChange={(e) => setFormData({ ...formData, driver_mobile: e.target.value })}
                />
              </div>

              <div className="sb-form-group">
                <label className="sb-label">Destination / Delivery Location</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="e.g. Pune Factory Warehouse"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div style={{ marginTop: "16px", borderTop: "1px dashed var(--sb-border)", paddingTop: "14px" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--sb-navy)", fontWeight: 700 }}>
              Dispatch Items
            </h4>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr auto", gap: "10px", alignItems: "flex-end", background: "var(--sb-canvas)", padding: "14px", borderRadius: "8px", marginBottom: "16px" }}>
              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">Finished Good *</label>
                <select
                  className="sb-input"
                  value={newItem.finished_good_id}
                  onChange={(e) => handleFgChange(e.target.value)}
                >
                  <option value="">Select Finished Good</option>
                  {finishedGoods.map((fg) => (
                    <option key={fg.id} value={fg.id}>
                      {fg.fg_name} ({fg.fg_code || "FG"}) — Stock: {fg.current_stock || 0} KG
                    </option>
                  ))}
                </select>
              </div>

              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">Specific Lot (Optional)</label>
                <select
                  className="sb-input"
                  value={newItem.lot_id}
                  onChange={(e) => setNewItem({ ...newItem, lot_id: e.target.value })}
                >
                  <option value="">Auto / Any Lot</option>
                  {availableLots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lot_number} (Avail: {l.current_quantity || 0} KG)
                    </option>
                  ))}
                </select>
              </div>

              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">Qty (KG) *</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.01"
                  className="sb-input"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                />
              </div>

              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">Rate / KG (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="sb-input"
                  value={newItem.rate}
                  onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                />
              </div>

              <Button type="button" variant="secondary" onClick={handleAddItem} style={{ height: "38px" }}>
                + Add Item
              </Button>
            </div>

            <DataTable
              headers={["Product", "Lot #", "Quantity", "Rate (₹)", "Amount (₹)", "Action"]}
            >
              {formData.items.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", color: "var(--sb-muted)" }}>
                    No items added yet. Please add products to dispatch.
                  </td>
                </tr>
              ) : (
                formData.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{item.fg_name}</strong>
                      <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>{item.fg_code}</div>
                    </td>
                    <td>{item.lot_number || "Auto"}</td>
                    <td><strong>{item.quantity} {item.unit}</strong></td>
                    <td>₹{Number(item.rate).toFixed(2)}</td>
                    <td>₹{(Number(item.quantity) * Number(item.rate)).toFixed(2)}</td>
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
          </div>

          <div className="sb-form-group" style={{ marginTop: "16px" }}>
            <label className="sb-label">Internal Notes / Dispatch Remarks</label>
            <textarea
              className="sb-input"
              rows="2"
              placeholder="e.g. Weighbridge gross/tare recorded, seals checked."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={formData.auto_dispatch}
                onChange={(e) => setFormData({ ...formData, auto_dispatch: e.target.checked })}
              />
              <span>
                <strong>Dispatch Immediately</strong> (Deducts stock from Finished Goods inventory and generates Delivery Challan now)
              </span>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Processing..." : "Confirm & Save Dispatch"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DETAILS MODAL */}
      <Modal
        isOpen={detailsModalOpen && !!selectedDispatch}
        onClose={() => setDetailsModalOpen(false)}
        title={`Dispatch: ${selectedDispatch?.dispatch_no || ""}`}
      >
        {selectedDispatch && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", background: "var(--sb-canvas)", padding: "16px", borderRadius: "8px", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--sb-muted)", marginBottom: "4px" }}>Customer</div>
                <div style={{ fontWeight: 700, color: "var(--sb-navy)" }}>{selectedDispatch.customer_name}</div>
                <div style={{ fontSize: "12px", color: "var(--sb-text)" }}>{selectedDispatch.customer_mobile}</div>
                <div style={{ fontSize: "12px", color: "var(--sb-muted)" }}>{selectedDispatch.customer_address}</div>
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--sb-muted)", marginBottom: "4px" }}>Logistics & Vehicle</div>
                <div style={{ fontWeight: 700, color: "var(--sb-navy)" }}>{selectedDispatch.vehicle_number || "Self Transport"}</div>
                <div style={{ fontSize: "12px", color: "var(--sb-text)" }}>Transporter: {selectedDispatch.transporter || "—"}</div>
                <div style={{ fontSize: "12px", color: "var(--sb-text)" }}>Driver: {selectedDispatch.driver_name || "—"} ({selectedDispatch.driver_mobile || "—"})</div>
                <div style={{ fontSize: "12px", color: "var(--sb-muted)" }}>Destination: {selectedDispatch.destination || "—"}</div>
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--sb-muted)", marginBottom: "4px" }}>References & Billing</div>
                <div style={{ fontSize: "12px" }}>
                  Date: {selectedDispatch.dispatch_date ? new Date(selectedDispatch.dispatch_date).toLocaleDateString() : "—"}
                </div>
                <div style={{ fontSize: "12px" }}>
                  Sales Order: {selectedDispatch.sales_order_no || "Direct"}
                </div>
                <div style={{ fontSize: "12px" }}>
                  Challan: {selectedDispatch.challan_no ? (
                    <span style={{ color: "var(--sb-ocean)", fontWeight: 700 }}>{selectedDispatch.challan_no}</span>
                  ) : "Not Generated"}
                </div>
                <div style={{ fontSize: "12px" }}>
                  Invoice: {selectedDispatch.invoice_no ? (
                    <span style={{ color: "var(--sb-success)", fontWeight: 700 }}>{selectedDispatch.invoice_no} ({selectedDispatch.invoice_payment_status || "UNPAID"})</span>
                  ) : "Unbilled"}
                </div>
              </div>
            </div>

            <h4 style={{ margin: "16px 0 8px 0", fontSize: "14px", color: "var(--sb-navy)", fontWeight: 700 }}>Dispatched Products</h4>
            <DataTable
              headers={["Product", "Lot Number", "Quantity", "Rate (₹)", "Total (₹)"]}
            >
              {(selectedDispatch.items || []).map((it, idx) => (
                <tr key={idx}>
                  <td>
                    <strong>{it.fg_name}</strong>
                    <div style={{ fontSize: "11px", color: "var(--sb-muted)" }}>{it.fg_code}</div>
                  </td>
                  <td>{it.lot_number || "Lot Assigned"}</td>
                  <td><strong>{Number(it.quantity).toLocaleString()} {it.unit || "KG"}</strong></td>
                  <td>₹{Number(it.rate || 0).toFixed(2)}</td>
                  <td>₹{(Number(it.quantity) * Number(it.rate || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </DataTable>

            {selectedDispatch.notes && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", color: "#92400e", marginTop: "16px" }}>
                <strong>Notes:</strong> {selectedDispatch.notes}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
              {selectedDispatch.status === "PENDING" && (
                <Button
                  variant="primary"
                  onClick={() => handleUpdateStatus(selectedDispatch.id, "DISPATCHED")}
                >
                  Confirm Dispatch & Deduct Stock
                </Button>
              )}
              {selectedDispatch.status === "DISPATCHED" && (
                <Button
                  variant="primary"
                  onClick={() => handleUpdateStatus(selectedDispatch.id, "DELIVERED")}
                >
                  Mark Delivered
                </Button>
              )}
              {!selectedDispatch.invoice_id && (selectedDispatch.status === "DISPATCHED" || selectedDispatch.status === "DELIVERED") && (
                <Button
                  variant="secondary"
                  onClick={() => handleGenerateInvoice(selectedDispatch.id)}
                >
                  Generate Tax Invoice
                </Button>
              )}
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

export default PlasticDispatch;
