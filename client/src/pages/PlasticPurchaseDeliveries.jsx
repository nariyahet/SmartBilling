import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticPurchaseDeliveries.css";

function PlasticPurchaseDeliveries() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("PENDING"); // 'PENDING' | 'HISTORY'
  const [deliveries, setDeliveries] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [openPOs, setOpenPOs] = useState([]);

  // Modals
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [selectedPendingItem, setSelectedPendingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [deliveryForm, setDeliveryForm] = useState({
    purchase_order_id: "",
    purchase_order_item_id: "",
    delivered_qty: "",
    accepted_qty: "",
    rejected_qty: 0,
    delivery_date: new Date().toISOString().slice(0, 10),
    challan_no: "",
    truck_number: "",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [delRes, pendRes, poRes] = await Promise.all([
        API.get("/plastic-erp/procurement/deliveries"),
        API.get("/plastic-erp/procurement/deliveries/pending"),
        API.get("/plastic-erp/procurement/orders?status=APPROVED"),
      ]);

      setDeliveries(delRes.data.data || []);
      setPendingItems(pendRes.data.data || []);
      setOpenPOs(poRes.data.data || []);
    } catch (err) {
      console.error("Error loading deliveries:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openReceiveModal = (item) => {
    setSelectedPendingItem(item);
    setDeliveryForm({
      purchase_order_id: item.purchase_order_id,
      purchase_order_item_id: item.id,
      delivered_qty: item.pending_qty,
      accepted_qty: item.pending_qty,
      rejected_qty: 0,
      delivery_date: new Date().toISOString().slice(0, 10),
      challan_no: "",
      truck_number: "",
      notes: `Received against PO ${item.po_no}`,
    });
    setDeliveryModalOpen(true);
  };

  const handleDeliverySubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await API.post("/plastic-erp/procurement/deliveries", deliveryForm);
      alert(res.data.message || "Delivery recorded successfully!");
      setDeliveryModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to record delivery");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalDeliveriesCount = deliveries.length;
  const onTimeCount = deliveries.filter((d) => (d.delivery_delay_days || 0) <= 0).length;
  const pendingItemsCount = pendingItems.length;
  const totalDeliveredQty = deliveries.reduce((sum, d) => sum + Number(d.delivered_qty || 0), 0);

  if (loading && deliveries.length === 0 && pendingItems.length === 0) return <LoadingScreen />;

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />
      <div className="procurement-main">
        {/* Header */}
        <div className="procurement-header">
          <div>
            <h1 className="procurement-title">🚚 Purchase Delivery Tracking</h1>
            <p className="procurement-subtitle">
              Monitor incoming raw material consignments, partial shipments, delay variances & PO fulfillment
            </p>
          </div>
          <button
            type="button"
            className="procurement-btn-primary"
            onClick={() => {
              setSelectedPendingItem(null);
              setDeliveryForm({
                purchase_order_id: openPOs[0]?.id || "",
                purchase_order_item_id: "",
                delivered_qty: "",
                accepted_qty: "",
                rejected_qty: 0,
                delivery_date: new Date().toISOString().slice(0, 10),
                challan_no: "",
                truck_number: "",
                notes: "",
              });
              setDeliveryModalOpen(true);
            }}
          >
            + Record New Delivery
          </button>
        </div>

        {/* KPI Cards */}
        <div className="procurement-kpi-grid">
          <div className="procurement-kpi-card">
            <span className="kpi-label">Total Shipments Recorded</span>
            <span className="kpi-value">{totalDeliveriesCount}</span>
            <span className="kpi-hint">Physical deliveries received</span>
          </div>
          <div className="procurement-kpi-card success">
            <span className="kpi-label">On-Time Deliveries</span>
            <span className="kpi-value">{onTimeCount}</span>
            <span className="kpi-hint">
              {totalDeliveriesCount > 0 ? Math.round((onTimeCount / totalDeliveriesCount) * 100) : 100}% reliability
            </span>
          </div>
          <div className="procurement-kpi-card warning">
            <span className="kpi-label">Pending PO Line Items</span>
            <span className="kpi-value">{pendingItemsCount}</span>
            <span className="kpi-hint">Awaiting full fulfillment</span>
          </div>
          <div className="procurement-kpi-card purple">
            <span className="kpi-label">Total Material Inward</span>
            <span className="kpi-value">{totalDeliveredQty.toLocaleString()} KG</span>
            <span className="kpi-hint">Total volume received</span>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="delivery-tabs-bar">
          <button
            type="button"
            className={`tab-btn ${activeTab === "PENDING" ? "active" : ""}`}
            onClick={() => setActiveTab("PENDING")}
          >
            ⏳ Pending Items to Receive ({pendingItems.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "HISTORY" ? "active" : ""}`}
            onClick={() => setActiveTab("HISTORY")}
          >
            📜 Delivery History & Receiving Slips ({deliveries.length})
          </button>
        </div>

        {/* Tab 1: Pending Items */}
        {activeTab === "PENDING" && (
          <div className="procurement-table-card">
            <div className="table-responsive">
              <table className="procurement-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Material</th>
                    <th>Ordered Qty</th>
                    <th>Received Qty</th>
                    <th>Pending Qty</th>
                    <th>Expected Delivery</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-6 text-muted">
                        No pending purchase order items waiting for delivery. All active orders are fulfilled!
                      </td>
                    </tr>
                  ) : (
                    pendingItems.map((item) => (
                      <tr key={item.id}>
                        <td className="font-semibold text-primary">{item.po_no}</td>
                        <td>
                          <strong>{item.supplier_name}</strong>
                          <div className="text-muted text-xs">{item.supplier_code}</div>
                        </td>
                        <td>
                          <strong>{item.material_name}</strong>
                          <div className="text-muted text-xs">{item.plastic_type}</div>
                        </td>
                        <td>{Number(item.ordered_qty).toLocaleString()} {item.unit}</td>
                        <td className="text-emerald-400 font-semibold">{Number(item.received_qty).toLocaleString()} {item.unit}</td>
                        <td className="text-amber-400 font-bold">{Number(item.pending_qty).toLocaleString()} {item.unit}</td>
                        <td>{item.expected_delivery_date ? new Date(item.expected_delivery_date).toLocaleDateString("en-IN") : "-"}</td>
                        <td>
                          <span className={`status-badge ${item.status.toLowerCase()}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="procurement-btn-primary btn-sm"
                            onClick={() => openReceiveModal(item)}
                          >
                            📥 Receive Material
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Delivery History */}
        {activeTab === "HISTORY" && (
          <div className="procurement-table-card">
            <div className="table-responsive">
              <table className="procurement-table">
                <thead>
                  <tr>
                    <th>Delivery #</th>
                    <th>Delivery Date</th>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Material</th>
                    <th>Truck #</th>
                    <th>Delivered</th>
                    <th>Accepted</th>
                    <th>Delay</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center py-6 text-muted">
                        No delivery history records found.
                      </td>
                    </tr>
                  ) : (
                    deliveries.map((del) => (
                      <tr key={del.id}>
                        <td className="font-semibold text-primary">{del.delivery_no}</td>
                        <td>{del.delivery_date ? new Date(del.delivery_date).toLocaleDateString("en-IN") : "-"}</td>
                        <td><strong>{del.po_no}</strong></td>
                        <td>{del.supplier_name}</td>
                        <td>{del.material_name}</td>
                        <td>{del.truck_number || "Direct"}</td>
                        <td>{Number(del.delivered_qty).toLocaleString()} KG</td>
                        <td className="text-emerald-400 font-bold">{Number(del.accepted_qty).toLocaleString()} KG</td>
                        <td>
                          {del.delivery_delay_days > 0 ? (
                            <span className="text-amber-400 font-semibold">+{del.delivery_delay_days}d late</span>
                          ) : (
                            <span className="text-emerald-400 font-semibold">On-Time</span>
                          )}
                        </td>
                        <td>
                          <span className="status-badge approved">{del.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Record Delivery Modal */}
      {deliveryModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>
                Record Material Delivery
                {selectedPendingItem && <small> ({selectedPendingItem.po_no})</small>}
              </h3>
              <button type="button" className="close-btn" onClick={() => setDeliveryModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleDeliverySubmit}>
              <div className="modal-body">
                {selectedPendingItem ? (
                  <div className="details-summary-grid mb-4">
                    <div><strong>Supplier:</strong> {selectedPendingItem.supplier_name}</div>
                    <div><strong>Material:</strong> {selectedPendingItem.material_name}</div>
                    <div><strong>Pending to Receive:</strong> <span className="text-amber-400 font-bold">{selectedPendingItem.pending_qty} KG</span></div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Purchase Order *</label>
                    <select
                      required
                      value={deliveryForm.purchase_order_id}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, purchase_order_id: e.target.value })}
                      className="procurement-select"
                    >
                      <option value="">Select PO</option>
                      {openPOs.map((po) => (
                        <option key={po.id} value={po.id}>{po.po_no} - {po.supplier_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Delivery / Gate Date *</label>
                    <input
                      type="date"
                      required
                      value={deliveryForm.delivery_date}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_date: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Truck Number</label>
                    <input
                      type="text"
                      placeholder="GJ-05-XX-1234"
                      value={deliveryForm.truck_number}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, truck_number: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Delivered Qty (KG) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0.1"
                      value={deliveryForm.delivered_qty}
                      onChange={(e) => setDeliveryForm({
                        ...deliveryForm,
                        delivered_qty: e.target.value,
                        accepted_qty: e.target.value,
                      })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Accepted Qty (KG) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0.1"
                      value={deliveryForm.accepted_qty}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, accepted_qty: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Rejected Qty (KG)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={deliveryForm.rejected_qty}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, rejected_qty: e.target.value })}
                      className="procurement-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Supplier Delivery Challan #</label>
                  <input
                    type="text"
                    placeholder="DC-9092"
                    value={deliveryForm.challan_no}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, challan_no: e.target.value })}
                    className="procurement-input"
                  />
                </div>

                <div className="form-group">
                  <label>Gate Inward Notes / Inspection Remarks</label>
                  <textarea
                    rows="2"
                    value={deliveryForm.notes}
                    onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                    className="procurement-textarea"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setDeliveryModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Recording..." : "Confirm Delivery Inward"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticPurchaseDeliveries;
