import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
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
      alert("Failed to load dispatches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  // Handle passed SO from location.state if navigated from Sales Orders page
  useEffect(() => {
    if (location.state?.fromSO && location.state.order) {
      const so = location.state.order;
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      alert("Please select a product and enter a valid quantity.");
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
      alert("Please select a customer.");
      return;
    }
    if (formData.items.length === 0) {
      alert("Please add at least one dispatch item.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await API.post("/plastic-erp/dispatches", formData);
      if (res.data?.success) {
        alert(res.data.message || "Dispatch created successfully!");
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
      alert(err.response?.data?.message || "Failed to create dispatch");
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
      alert("Failed to load dispatch details");
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
        alert(res.data.message || `Dispatch status updated to ${newStatus}`);
        fetchData();
        if (selectedDispatch && selectedDispatch.id === dispatchId) {
          handleViewDetails(dispatchId);
        }
      }
    } catch (err) {
      console.error("Update Status Error:", err);
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleGenerateInvoice = async (dispatchId) => {
    if (!window.confirm("Generate official Sales Tax Invoice for this dispatch?")) return;
    try {
      const res = await API.post(`/plastic-erp/dispatches/${dispatchId}/create-invoice`);
      if (res.data?.success) {
        alert(`Invoice ${res.data.invoice_no} generated successfully!`);
        fetchData();
        navigate(`/invoices/${res.data.invoice_id}`);
      }
    } catch (err) {
      console.error("Generate Invoice Error:", err);
      alert(err.response?.data?.message || "Failed to generate invoice");
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
    <div className="plastic-page">
      <PlasticNavbar />
      <div className="plastic-container">
        {/* Header */}
        <div className="pdispatch-header">
          <div>
            <span className="pdispatch-badge">OUTWARD LOGISTICS</span>
            <h1 className="pdispatch-title">Dispatch & Outward Delivery</h1>
            <p className="pdispatch-subtitle">
              Manage product dispatches, truck loading, stock deductions, and one-click billing.
            </p>
          </div>
          <div className="pdispatch-header-actions">
            <Link to="/plastic-erp/transport/challans" className="pdispatch-btn pdispatch-btn-outline">
              Delivery Challans
            </Link>
            <button
              className="pdispatch-btn pdispatch-btn-primary"
              onClick={() => setCreateModalOpen(true)}
            >
              + New Dispatch
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="pdispatch-kpis">
          <div className="pdispatch-kpi-card">
            <div className="pdispatch-kpi-val">{totalDispatchesCount}</div>
            <div className="pdispatch-kpi-lbl">Total Dispatches</div>
          </div>
          <div className="pdispatch-kpi-card warning">
            <div className="pdispatch-kpi-val">{pendingCount}</div>
            <div className="pdispatch-kpi-lbl">Pending Loading</div>
          </div>
          <div className="pdispatch-kpi-card info">
            <div className="pdispatch-kpi-val">{dispatchedCount}</div>
            <div className="pdispatch-kpi-lbl">In Transit</div>
          </div>
          <div className="pdispatch-kpi-card success">
            <div className="pdispatch-kpi-val">{deliveredCount}</div>
            <div className="pdispatch-kpi-lbl">Delivered</div>
          </div>
          <div className="pdispatch-kpi-card primary">
            <div className="pdispatch-kpi-val">{totalQtyDispatched.toLocaleString()} <span className="pdispatch-unit">KG</span></div>
            <div className="pdispatch-kpi-lbl">Total Shipped Volume</div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="pdispatch-filters-card">
          <div className="pdispatch-search-box">
            <input
              type="text"
              placeholder="Search by Dispatch #, Customer, Vehicle, SO #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="pdispatch-filter-group">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pdispatch-select"
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
              className="pdispatch-select"
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
              className="pdispatch-date-input"
              placeholder="From Date"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="pdispatch-date-input"
              placeholder="To Date"
            />

            {(statusFilter || customerFilter || searchQuery || fromDate || toDate) && (
              <button
                className="pdispatch-btn-reset"
                onClick={() => {
                  setStatusFilter("");
                  setCustomerFilter("");
                  setSearchQuery("");
                  setFromDate("");
                  setToDate("");
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Dispatches Table */}
        <div className="pdispatch-table-card">
          <div className="pdispatch-table-header">
            <h3>Dispatches ({filteredDispatches.length})</h3>
          </div>
          {filteredDispatches.length === 0 ? (
            <div className="pdispatch-empty">
              <p>No dispatches found matching criteria.</p>
            </div>
          ) : (
            <div className="pdispatch-table-responsive">
              <table className="pdispatch-table">
                <thead>
                  <tr>
                    <th>Dispatch #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Vehicle / Transporter</th>
                    <th>Sales Order</th>
                    <th>Items / Qty</th>
                    <th>Status</th>
                    <th>Billing</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDispatches.map((d) => (
                    <tr key={d.id}>
                      <td className="font-semibold text-primary">
                        {d.dispatch_no}
                      </td>
                      <td>
                        {d.dispatch_date ? new Date(d.dispatch_date).toLocaleDateString() : "—"}
                      </td>
                      <td>
                        <div className="cust-cell">
                          <span className="cust-name">{d.customer_name}</span>
                          <span className="cust-sub">{d.customer_mobile || d.destination || ""}</span>
                        </div>
                      </td>
                      <td>
                        <div className="veh-cell">
                          <span className="veh-no">{d.vehicle_number || "Self / Ex-Factory"}</span>
                          <span className="veh-sub">{d.transporter || d.driver_name || ""}</span>
                        </div>
                      </td>
                      <td>
                        {d.sales_order_no ? (
                          <span className="so-pill">{d.sales_order_no}</span>
                        ) : (
                          <span className="text-muted">Direct</span>
                        )}
                      </td>
                      <td>
                        <div className="qty-cell">
                          <strong>{Number(d.total_dispatched_qty || 0).toLocaleString()} KG</strong>
                          <span className="items-count">({d.total_items || 1} items)</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${String(d.status).toLowerCase()}`}>
                          {d.status}
                        </span>
                      </td>
                      <td>
                        {d.invoice_id ? (
                          <Link to={`/invoices/${d.invoice_id}`} className="inv-badge billed">
                            {d.invoice_no}
                          </Link>
                        ) : (
                          <span className="inv-badge unbilled">Unbilled</span>
                        )}
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button
                            className="btn-action view"
                            onClick={() => handleViewDetails(d.id)}
                            title="View Dispatch Details"
                          >
                            Details
                          </button>

                          {d.status === "PENDING" && (
                            <button
                              className="btn-action dispatch"
                              onClick={() => handleUpdateStatus(d.id, "DISPATCHED")}
                              title="Confirm Dispatch & Deduct Stock"
                            >
                              Dispatch
                            </button>
                          )}

                          {d.status === "DISPATCHED" && (
                            <button
                              className="btn-action deliver"
                              onClick={() => handleUpdateStatus(d.id, "DELIVERED")}
                              title="Mark Delivered"
                            >
                              Delivered
                            </button>
                          )}

                          {!d.invoice_id && (d.status === "DISPATCHED" || d.status === "DELIVERED") && (
                            <button
                              className="btn-action invoice"
                              onClick={() => handleGenerateInvoice(d.id)}
                              title="Create Official Invoice"
                            >
                              Bill
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE DISPATCH MODAL */}
      {createModalOpen && (
        <div className="pdispatch-modal-overlay">
          <div className="pdispatch-modal-content large">
            <div className="pdispatch-modal-header">
              <h2>Create New Dispatch</h2>
              <button className="close-btn" onClick={() => setCreateModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateDispatch} className="pdispatch-form">
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Customer *</label>
                  <select
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

                <div className="form-group">
                  <label>Sales Order (Optional)</label>
                  <select
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

                <div className="form-group">
                  <label>Dispatch Date *</label>
                  <input
                    type="date"
                    value={formData.dispatch_date}
                    onChange={(e) => setFormData({ ...formData, dispatch_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Vehicle & Logistics */}
              <div className="section-title">Transport & Driver Information</div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Select Registered Vehicle</label>
                  <select
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

                <div className="form-group">
                  <label>Vehicle Number</label>
                  <input
                    type="text"
                    placeholder="e.g. MH 12 AB 1234"
                    value={formData.vehicle_number}
                    onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Transporter Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Shree Logistics"
                    value={formData.transporter}
                    onChange={(e) => setFormData({ ...formData, transporter: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Driver Name</label>
                  <input
                    type="text"
                    placeholder="Driver's Full Name"
                    value={formData.driver_name}
                    onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Driver Mobile</label>
                  <input
                    type="text"
                    placeholder="10-digit mobile"
                    value={formData.driver_mobile}
                    onChange={(e) => setFormData({ ...formData, driver_mobile: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Destination / Delivery Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Pune Factory Warehouse"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="section-title">Dispatch Items</div>
              <div className="item-input-bar">
                <div className="item-input-field flex-2">
                  <label>Finished Good (Product) *</label>
                  <select
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

                <div className="item-input-field flex-1">
                  <label>Specific Lot (Optional)</label>
                  <select
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

                <div className="item-input-field">
                  <label>Quantity (KG) *</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.01"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  />
                </div>

                <div className="item-input-field">
                  <label>Rate / KG (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.rate}
                    onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                  />
                </div>

                <button
                  type="button"
                  className="pdispatch-btn pdispatch-btn-add"
                  onClick={handleAddItem}
                >
                  + Add Item
                </button>
              </div>

              {/* Items List */}
              <div className="items-list-table">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Lot #</th>
                      <th>Quantity</th>
                      <th>Rate (₹)</th>
                      <th>Amount (₹)</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted">
                          No items added yet. Please add products to dispatch.
                        </td>
                      </tr>
                    ) : (
                      formData.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{item.fg_name}</strong>
                            <div className="text-muted text-sm">{item.fg_code}</div>
                          </td>
                          <td>{item.lot_number || "Auto"}</td>
                          <td>
                            <strong>{item.quantity} {item.unit}</strong>
                          </td>
                          <td>₹{Number(item.rate).toFixed(2)}</td>
                          <td>₹{(Number(item.quantity) * Number(item.rate)).toFixed(2)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn-remove"
                              onClick={() => handleRemoveItem(idx)}
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="form-group mt-3">
                <label>Internal Notes / Dispatch Remarks</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Weighbridge gross/tare recorded, seals checked."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                ></textarea>
              </div>

              <div className="checkbox-row mt-3">
                <label className="checkbox-label">
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

              <div className="modal-footer">
                <button
                  type="button"
                  className="pdispatch-btn pdispatch-btn-outline"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pdispatch-btn pdispatch-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Processing..." : "Confirm & Save Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {detailsModalOpen && selectedDispatch && (
        <div className="pdispatch-modal-overlay">
          <div className="pdispatch-modal-content large">
            <div className="pdispatch-modal-header">
              <div>
                <h2>Dispatch: {selectedDispatch.dispatch_no}</h2>
                <span className={`status-badge ${String(selectedDispatch.status).toLowerCase()}`}>
                  {selectedDispatch.status}
                </span>
              </div>
              <button className="close-btn" onClick={() => setDetailsModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="details-body">
              <div className="details-grid-3">
                <div className="info-block">
                  <div className="info-label">Customer</div>
                  <div className="info-val bold">{selectedDispatch.customer_name}</div>
                  <div className="info-sub">{selectedDispatch.customer_mobile}</div>
                  <div className="info-sub">{selectedDispatch.customer_address}</div>
                </div>

                <div className="info-block">
                  <div className="info-label">Logistics & Vehicle</div>
                  <div className="info-val bold">{selectedDispatch.vehicle_number || "Self Transport"}</div>
                  <div className="info-sub">Transporter: {selectedDispatch.transporter || "—"}</div>
                  <div className="info-sub">Driver: {selectedDispatch.driver_name || "—"} ({selectedDispatch.driver_mobile || "—"})</div>
                  <div className="info-sub">Destination: {selectedDispatch.destination || "—"}</div>
                </div>

                <div className="info-block">
                  <div className="info-label">References & Billing</div>
                  <div className="info-sub">
                    Date: {selectedDispatch.dispatch_date ? new Date(selectedDispatch.dispatch_date).toLocaleDateString() : "—"}
                  </div>
                  <div className="info-sub">
                    Sales Order: {selectedDispatch.sales_order_no || "Direct"}
                  </div>
                  <div className="info-sub">
                    Challan: {selectedDispatch.challan_no ? (
                      <span className="text-primary bold">{selectedDispatch.challan_no}</span>
                    ) : "Not Generated"}
                  </div>
                  <div className="info-sub">
                    Invoice: {selectedDispatch.invoice_no ? (
                      <span className="text-success bold">{selectedDispatch.invoice_no} ({selectedDispatch.invoice_payment_status || "UNPAID"})</span>
                    ) : "Unbilled"}
                  </div>
                </div>
              </div>

              <div className="details-items-section mt-4">
                <h4>Dispatched Products</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Lot Number</th>
                      <th>Quantity</th>
                      <th>Rate (₹)</th>
                      <th>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedDispatch.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{it.fg_name}</strong>
                          <div className="text-muted text-sm">{it.fg_code}</div>
                        </td>
                        <td>{it.lot_number || "Lot Assigned"}</td>
                        <td>
                          <strong>{Number(it.quantity).toLocaleString()} {it.unit || "KG"}</strong>
                        </td>
                        <td>₹{Number(it.rate || 0).toFixed(2)}</td>
                        <td>₹{(Number(it.quantity) * Number(it.rate || 0)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedDispatch.notes && (
                <div className="details-notes mt-3">
                  <strong>Notes:</strong> {selectedDispatch.notes}
                </div>
              )}
            </div>

            <div className="modal-footer">
              {selectedDispatch.status === "PENDING" && (
                <button
                  className="pdispatch-btn pdispatch-btn-primary"
                  onClick={() => handleUpdateStatus(selectedDispatch.id, "DISPATCHED")}
                >
                  Confirm Dispatch & Deduct Stock
                </button>
              )}
              {selectedDispatch.status === "DISPATCHED" && (
                <button
                  className="pdispatch-btn pdispatch-btn-success"
                  onClick={() => handleUpdateStatus(selectedDispatch.id, "DELIVERED")}
                >
                  Mark Delivered
                </button>
              )}
              {!selectedDispatch.invoice_id && (selectedDispatch.status === "DISPATCHED" || selectedDispatch.status === "DELIVERED") && (
                <button
                  className="pdispatch-btn pdispatch-btn-invoice"
                  onClick={() => handleGenerateInvoice(selectedDispatch.id)}
                >
                  Generate Tax Invoice
                </button>
              )}
              <button
                className="pdispatch-btn pdispatch-btn-outline"
                onClick={() => setDetailsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticDispatch;
