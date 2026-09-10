import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  KpiCard,
  Card,
  Button,
  StatusBadge,
  DataTable,
  Modal,
  Tabs,
} from "../components";
import "./PlasticPurchaseDeliveries.css";

function PlasticPurchaseDeliveries() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("PENDING"); // 'PENDING' | 'HISTORY'
  const [deliveries, setDeliveries] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);

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
      const [delRes, pendRes] = await Promise.all([
        API.get("/plastic-erp/procurement/deliveries"),
        API.get("/plastic-erp/procurement/deliveries/pending"),
      ]);

      setDeliveries(delRes.data?.data || []);
      setPendingItems(pendRes.data?.data || []);
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
      alert(res.data?.message || "Delivery recorded successfully!");
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
  const onTimePercent = totalDeliveriesCount > 0 ? Math.round((onTimeCount / totalDeliveriesCount) * 100) : 100;

  if (loading && deliveries.length === 0 && pendingItems.length === 0) {
    return <LoadingScreen title="Loading Deliveries..." subtitle="Fetching delivery receipts and open PO items..." />;
  }

  const deliveryTabs = [
    { id: "PENDING", label: "Awaiting Delivery", count: pendingItemsCount, icon: "⏳" },
    { id: "HISTORY", label: "Receipt History", count: totalDeliveriesCount, icon: "📋" },
  ];

  const pendingColumns = [
    {
      key: "po_no",
      title: "PO Number",
      render: (val) => <span className="sb-font-semibold sb-text-primary">{val}</span>,
    },
    {
      key: "supplier_name",
      title: "Supplier",
      render: (val, row) => (
        <div>
          <strong>{val}</strong>
          <div className="sb-text-muted text-xs">{row.supplier_city || "Kim"}</div>
        </div>
      ),
    },
    {
      key: "material_name",
      title: "Material",
      render: (val, row) => (
        <div>
          <strong>{val}</strong>
          <div className="sb-text-muted text-xs">{row.plastic_type}</div>
        </div>
      ),
    },
    {
      key: "expected_delivery_date",
      title: "Due Date",
      render: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : "-"),
    },
    {
      key: "ordered_qty",
      title: "Ordered Qty",
      render: (val) => `${Number(val || 0).toLocaleString()} KG`,
    },
    {
      key: "received_qty",
      title: "Received Qty",
      render: (val) => `${Number(val || 0).toLocaleString()} KG`,
    },
    {
      key: "pending_qty",
      title: "Pending Balance",
      render: (val) => (
        <span className="sb-font-semibold" style={{ color: "var(--sb-warning, #F2A93B)" }}>
          {Number(val || 0).toLocaleString()} KG
        </span>
      ),
    },
    {
      key: "actions",
      title: "Actions",
      render: (_, item) => (
        <Button
          size="sm"
          variant="primary"
          icon="📥"
          onClick={() => openReceiveModal(item)}
        >
          Receive Delivery
        </Button>
      ),
    },
  ];

  const historyColumns = [
    {
      key: "delivery_no",
      title: "GRN / Receipt #",
      render: (val) => <span className="sb-font-semibold sb-text-primary">{val}</span>,
    },
    {
      key: "delivery_date",
      title: "Receipt Date",
      render: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : "-"),
    },
    {
      key: "po_no",
      title: "PO Ref",
      render: (val) => val || "-",
    },
    {
      key: "supplier_name",
      title: "Supplier",
    },
    {
      key: "material_name",
      title: "Material",
    },
    {
      key: "challan_no",
      title: "Challan #",
      render: (val) => val || "-",
    },
    {
      key: "truck_number",
      title: "Vehicle",
      render: (val) => (val ? <span className="sb-badge sb-badge-blue">{val}</span> : "-"),
    },
    {
      key: "delivered_qty",
      title: "Delivered",
      render: (val) => `${Number(val || 0).toLocaleString()} KG`,
    },
    {
      key: "accepted_qty",
      title: "Accepted",
      render: (val) => (
        <span className="sb-font-semibold" style={{ color: "var(--sb-success, #18A673)" }}>
          {Number(val || 0).toLocaleString()} KG
        </span>
      ),
    },
    {
      key: "delivery_status",
      title: "Timeliness",
      render: (val) => {
        const variant = val === "ON_TIME" ? "success" : "danger";
        return <StatusBadge status={val?.replace(/_/g, " ")} variant={variant} />;
      },
    },
  ];

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Purchase Deliveries"
        subtitle="Inward delivery receipts, gate entry verification, quantity reconciliation & on-time performance"
        badge="PROCUREMENT FULFILLMENT"
        actions={
          <div className="sb-header-actions">
            <Button variant="secondary" size="md" onClick={fetchData} icon="🔄">
              Refresh Receipts
            </Button>
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div className="sb-kpi-grid">
        <KpiCard
          title="Total Receipts"
          value={totalDeliveriesCount}
          accent="blue"
          icon="📦"
          supportingText="Logged gate deliveries"
        />
        <KpiCard
          title="On-Time Rate"
          value={`${onTimePercent}%`}
          accent="green"
          icon="⚡"
          supportingText={`${onTimeCount} deliveries on schedule`}
        />
        <KpiCard
          title="Pending PO Lines"
          value={pendingItemsCount}
          accent="amber"
          icon="⏳"
          supportingText="Awaiting warehouse delivery"
        />
        <KpiCard
          title="Total Inward Volume"
          value={`${totalDeliveredQty.toLocaleString()} KG`}
          accent="teal"
          icon="⚖️"
          supportingText="Total raw material received"
        />
      </div>

      {/* Tab Selector */}
      <div className="sb-tab-bar-wrap" style={{ marginBottom: "16px" }}>
        <Tabs
          tabs={deliveryTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="pills"
        />
      </div>

      {/* Tab Views */}
      {activeTab === "PENDING" ? (
        <Card noPadding>
          <DataTable
            columns={pendingColumns}
            data={pendingItems}
            loading={loading}
            emptyMessage="No pending purchase order deliveries awaiting receipt."
          />
        </Card>
      ) : (
        <Card noPadding>
          <DataTable
            columns={historyColumns}
            data={deliveries}
            loading={loading}
            emptyMessage="No inward delivery receipts recorded yet."
          />
        </Card>
      )}

      {/* Receive Delivery Modal */}
      <Modal
        isOpen={deliveryModalOpen && Boolean(selectedPendingItem)}
        onClose={() => setDeliveryModalOpen(false)}
        title="Record Purchase Delivery (GRN)"
        subtitle={`Receiving against PO #${selectedPendingItem?.po_no || ""}`}
        size="md"
        footer={
          <div className="sb-modal-footer-actions">
            <Button variant="secondary" onClick={() => setDeliveryModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDeliverySubmit}
              loading={submitting}
            >
              Confirm Delivery Receipt
            </Button>
          </div>
        }
      >
        {selectedPendingItem && (
          <form onSubmit={handleDeliverySubmit}>
            <div className="sb-detail-summary-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "16px" }}>
              <div><span className="sb-detail-label">Supplier:</span> <strong>{selectedPendingItem.supplier_name}</strong></div>
              <div><span className="sb-detail-label">Material:</span> <strong>{selectedPendingItem.material_name}</strong></div>
              <div><span className="sb-detail-label">Ordered Qty:</span> <strong>{Number(selectedPendingItem.ordered_qty).toLocaleString()} KG</strong></div>
              <div><span className="sb-detail-label">Pending Balance:</span> <strong>{Number(selectedPendingItem.pending_qty).toLocaleString()} KG</strong></div>
            </div>

            <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="sb-form-group">
                <label>Delivered Qty (KG) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={deliveryForm.delivered_qty}
                  onChange={(e) => {
                    const val = e.target.value;
                    const rej = Number(deliveryForm.rejected_qty || 0);
                    setDeliveryForm({
                      ...deliveryForm,
                      delivered_qty: val,
                      accepted_qty: Math.max(0, Number(val) - rej),
                    });
                  }}
                  className="sb-input"
                />
              </div>
              <div className="sb-form-group">
                <label>Rejected Qty (KG)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={deliveryForm.rejected_qty}
                  onChange={(e) => {
                    const rej = Number(e.target.value || 0);
                    const del = Number(deliveryForm.delivered_qty || 0);
                    setDeliveryForm({
                      ...deliveryForm,
                      rejected_qty: rej,
                      accepted_qty: Math.max(0, del - rej),
                    });
                  }}
                  className="sb-input"
                />
              </div>
            </div>

            <div className="sb-form-group">
              <label>Net Accepted Qty (KG)</label>
              <input
                type="number"
                readOnly
                value={deliveryForm.accepted_qty}
                className="sb-input"
                style={{ background: "var(--sb-bg)", fontWeight: 700, color: "var(--sb-success)" }}
              />
            </div>

            <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="sb-form-group">
                <label>Delivery Receipt Date</label>
                <input
                  type="date"
                  value={deliveryForm.delivery_date}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_date: e.target.value })}
                  className="sb-input"
                />
              </div>
              <div className="sb-form-group">
                <label>Supplier Challan #</label>
                <input
                  type="text"
                  placeholder="e.g. CH-9901"
                  value={deliveryForm.challan_no}
                  onChange={(e) => setDeliveryForm({ ...deliveryForm, challan_no: e.target.value })}
                  className="sb-input"
                />
              </div>
            </div>

            <div className="sb-form-group">
              <label>Truck / Vehicle Number</label>
              <input
                type="text"
                placeholder="e.g. GJ-05-BX-1234"
                value={deliveryForm.truck_number}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, truck_number: e.target.value })}
                className="sb-input"
              />
            </div>

            <div className="sb-form-group">
              <label>Inspection Notes / Gate Entry</label>
              <textarea
                rows="2"
                placeholder="Remarks on material condition, moisture, weighing slip..."
                value={deliveryForm.notes}
                onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                className="sb-textarea"
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default PlasticPurchaseDeliveries;
