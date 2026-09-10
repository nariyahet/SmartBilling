import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  AlertBanner,
} from "../components";
import "./PlasticProduction.css";

function PlasticProduction() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "orders";
  const [activeTab, setActiveTab] = useState(initialTab);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [orders, setOrders] = useState([]);
  const [plans, setPlans] = useState([]);
  const [batches, setBatches] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [operators, setOperators] = useState([]);

  // Modals
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);

  // Form States
  const [orderForm, setOrderForm] = useState({
    product_name: "",
    recipe_id: "",
    planned_quantity: "",
    unit: "KG",
    production_date: new Date().toISOString().split("T")[0],
    target_date: new Date().toISOString().split("T")[0],
    priority: "NORMAL",
    machine_id: "",
    shift_id: "",
    operator_id: "",
    notes: "",
  });

  const [planForm, setPlanForm] = useState({
    plan_type: "DAILY",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    target_quantity: "",
    unit: "KG",
    machine_id: "",
    shift_id: "",
    notes: "",
  });

  const [batchForm, setBatchForm] = useState({
    production_order_id: "",
    product_name: "",
    recipe_id: "",
    machine_id: "",
    shift_id: "",
    operator_id: "",
    batch_date: new Date().toISOString().split("T")[0],
    planned_quantity: "",
    unit: "KG",
  });

  const [completeForm, setCompleteForm] = useState({
    actual_quantity: "",
    scrap_quantity: "0",
    regrind_quantity: "0",
    rejected_quantity: "0",
  });

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [ordersRes, plansRes, batchesRes, recipesRes, machinesRes, shiftsRes, opsRes] =
        await Promise.allSettled([
          API.get("/plastic-erp/production/orders"),
          API.get("/plastic-erp/production/plans"),
          API.get("/plastic-erp/production/batches"),
          API.get("/plastic-erp/recipes"),
          API.get("/plastic-erp/plant/machines"),
          API.get("/plastic-erp/plant/shifts"),
          API.get("/plastic-erp/plant/operators"),
        ]);

      if (ordersRes.status === "fulfilled") setOrders(ordersRes.value.data?.orders || []);
      if (plansRes.status === "fulfilled") setPlans(plansRes.value.data?.plans || []);
      if (batchesRes.status === "fulfilled") setBatches(batchesRes.value.data?.batches || []);
      if (recipesRes.status === "fulfilled") setRecipes(recipesRes.value.data?.recipes || []);
      if (machinesRes.status === "fulfilled") setMachines(machinesRes.value.data?.machines || []);
      if (shiftsRes.status === "fulfilled") setShifts(shiftsRes.value.data?.shifts || []);
      if (opsRes.status === "fulfilled") setOperators(opsRes.value.data?.operators || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load production data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Order Handlers
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/production/orders", orderForm);
      setSuccessMsg("Production Order created successfully!");
      setShowOrderModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create order.");
    }
  };

  // Plan Handlers
  const handleCreatePlan = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/production/plans", planForm);
      setSuccessMsg("Production Plan created successfully!");
      setShowPlanModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create plan.");
    }
  };

  // Batch Handlers
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/production/batches", batchForm);
      setSuccessMsg("Production Batch created successfully!");
      setShowBatchModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create batch.");
    }
  };

  // Shop Floor Action Handlers
  const handleStartBatch = async (batchId) => {
    try {
      await API.post(`/plastic-erp/production/batches/${batchId}/start`);
      setSuccessMsg("Batch started on shop floor!");
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start batch.");
    }
  };

  const handlePauseBatch = async (batchId) => {
    try {
      await API.post(`/plastic-erp/production/batches/${batchId}/pause`, { reason: "Operator pause" });
      setSuccessMsg("Batch paused.");
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to pause batch.");
    }
  };

  const handleResumeBatch = async (batchId) => {
    try {
      await API.post(`/plastic-erp/production/batches/${batchId}/resume`);
      setSuccessMsg("Batch resumed.");
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resume batch.");
    }
  };

  const openCompleteModal = (batch) => {
    setSelectedBatch(batch);
    setCompleteForm({
      actual_quantity: batch.planned_quantity || "",
      scrap_quantity: "0",
      regrind_quantity: "0",
      rejected_quantity: "0",
    });
    setShowCompleteModal(true);
  };

  const handleCompleteBatch = async (e) => {
    e.preventDefault();
    if (!selectedBatch) return;
    try {
      await API.post(`/plastic-erp/production/batches/${selectedBatch.id}/complete`, completeForm);
      setSuccessMsg(`Batch ${selectedBatch.batch_no} completed successfully!`);
      setShowCompleteModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to complete batch.");
    }
  };

  if (loading && orders.length === 0 && batches.length === 0) {
    return <LoadingScreen title="Loading Production..." subtitle="Fetching shop floor schedules and batches..." />;
  }

  // KPIs
  const activeBatchesCount = batches.filter((b) => ["PLANNED", "RUNNING", "PAUSED"].includes(b.status)).length;
  const completedBatchesCount = batches.filter((b) => b.status === "COMPLETED").length;
  const totalPlannedQty = orders.reduce((sum, o) => sum + Number(o.planned_quantity || 0), 0);

  const productionTabs = [
    { id: "orders", label: "Work Orders", count: orders.length, icon: "📑" },
    { id: "shopfloor", label: "Live Shop Floor", count: activeBatchesCount, icon: "⚡" },
    { id: "batches", label: "Batches", count: batches.length, icon: "🏷️" },
    { id: "plans", label: "Planning", count: plans.length, icon: "📅" },
  ];

  const orderColumns = [
    {
      key: "production_order_no",
      title: "Order No",
      render: (val) => <span className="sb-font-semibold sb-text-primary">{val}</span>,
    },
    {
      key: "product_name",
      title: "Product",
      render: (val) => <strong>{val}</strong>,
    },
    {
      key: "recipe_name",
      title: "Recipe",
      render: (val) => val || "-",
    },
    {
      key: "planned_quantity",
      title: "Planned Qty",
      render: (val, row) => `${Number(val).toLocaleString()} ${row.unit}`,
    },
    {
      key: "target_date",
      title: "Target Date",
      render: (val) => val?.split("T")[0] || "-",
    },
    {
      key: "priority",
      title: "Priority",
      render: (val) => {
        const variant = val === "URGENT" ? "danger" : val === "HIGH" ? "warning" : "neutral";
        return <StatusBadge status={val} variant={variant} />;
      },
    },
    {
      key: "machine_name",
      title: "Machine",
      render: (val) => val || "Any Machine",
    },
    {
      key: "status",
      title: "Status",
      render: (val) => <StatusBadge status={val} />,
    },
  ];

  const batchColumns = [
    {
      key: "batch_no",
      title: "Batch No",
      render: (val) => <span className="sb-font-semibold sb-text-primary">{val}</span>,
    },
    {
      key: "product_name",
      title: "Product",
      render: (val) => <strong>{val}</strong>,
    },
    {
      key: "batch_date",
      title: "Date",
      render: (val) => val?.split("T")[0] || "-",
    },
    {
      key: "planned_quantity",
      title: "Planned",
      render: (val, row) => `${Number(val).toLocaleString()} ${row.unit}`,
    },
    {
      key: "actual_quantity",
      title: "Actual Output",
      render: (val, row) => `${Number(val || 0).toLocaleString()} ${row.unit}`,
    },
    {
      key: "scrap_quantity",
      title: "Scrap",
      render: (val, row) => `${Number(val || 0).toLocaleString()} ${row.unit}`,
    },
    {
      key: "efficiency_percent",
      title: "Efficiency",
      render: (val) => <strong>{Number(val || 0).toFixed(1)}%</strong>,
    },
    {
      key: "qc_status",
      title: "QC Status",
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: "status",
      title: "Status",
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: "actions",
      title: "Trace",
      render: (_, b) => (
        <Link to={`/plastic-erp/traceability?batch=${b.batch_no}`}>
          <Button size="sm" variant="secondary" icon="🔍">
            Trace
          </Button>
        </Link>
      ),
    },
  ];

  const planColumns = [
    {
      key: "plan_code",
      title: "Plan Code",
      render: (val) => <span className="sb-font-semibold sb-text-primary">{val}</span>,
    },
    {
      key: "plan_type",
      title: "Type",
      render: (val) => <span className="sb-badge sb-badge-blue">{val}</span>,
    },
    {
      key: "start_date",
      title: "Start Date",
      render: (val) => val?.split("T")[0] || "-",
    },
    {
      key: "end_date",
      title: "End Date",
      render: (val) => val?.split("T")[0] || "-",
    },
    {
      key: "target_quantity",
      title: "Target Qty",
      render: (val, row) => `${Number(val).toLocaleString()} ${row.unit}`,
    },
    {
      key: "machine_name",
      title: "Machine",
      render: (val) => val || "All Machines",
    },
    {
      key: "shift_name",
      title: "Shift",
      render: (val) => val || "All Shifts",
    },
    {
      key: "status",
      title: "Status",
      render: (val) => <StatusBadge status={val} />,
    },
  ];

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Production Operations"
        subtitle="Work orders, batch execution, planning schedules & live shop floor controls"
        badge="MANUFACTURING PLANT"
        actions={
          <div className="sb-header-actions">
            <Button variant="secondary" size="md" onClick={fetchData} icon="🔄">
              Refresh
            </Button>
            {activeTab === "orders" && (
              <Button
                variant="primary"
                size="md"
                icon="+"
                onClick={() => setShowOrderModal(true)}
              >
                Create Work Order
              </Button>
            )}
            {activeTab === "plans" && (
              <Button
                variant="primary"
                size="md"
                icon="+"
                onClick={() => setShowPlanModal(true)}
              >
                New Production Plan
              </Button>
            )}
            {activeTab === "batches" && (
              <Button
                variant="primary"
                size="md"
                icon="+"
                onClick={() => setShowBatchModal(true)}
              >
                Create Production Batch
              </Button>
            )}
            {activeTab === "shopfloor" && (
              <Button
                variant="primary"
                size="md"
                icon="+"
                onClick={() => setShowBatchModal(true)}
              >
                Launch New Batch
              </Button>
            )}
          </div>
        }
      />

      {error && (
        <AlertBanner variant="danger" onDismiss={() => setError("")} className="mb-4">
          {error}
        </AlertBanner>
      )}

      {successMsg && (
        <AlertBanner variant="success" onDismiss={() => setSuccessMsg("")} className="mb-4">
          {successMsg}
        </AlertBanner>
      )}

      {/* KPI Cards Grid */}
      <div className="sb-kpi-grid">
        <KpiCard
          title="Total Work Orders"
          value={orders.length}
          accent="blue"
          icon="📑"
          supportingText="Active manufacturing pipeline"
        />
        <KpiCard
          title="Live Shopfloor Batches"
          value={activeBatchesCount}
          accent="teal"
          icon="⚡"
          supportingText="Currently running on machines"
        />
        <KpiCard
          title="Completed Batches"
          value={completedBatchesCount}
          accent="green"
          icon="✅"
          supportingText="Finished goods transferred"
        />
        <KpiCard
          title="Total Planned Output"
          value={`${totalPlannedQty.toLocaleString()} KG`}
          accent="navy"
          icon="📦"
          supportingText="Target volume commitment"
        />
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: "20px" }}>
        <Tabs
          tabs={productionTabs}
          activeTab={activeTab}
          onChange={switchTab}
          variant="pills"
        />
      </div>

      {/* TAB 1: WORK ORDERS */}
      {activeTab === "orders" && (
        <Card noPadding>
          <DataTable
            columns={orderColumns}
            data={orders}
            loading={loading}
            emptyMessage="No production orders found. Click 'Create Work Order' to start."
          />
        </Card>
      )}

      {/* TAB 2: LIVE SHOP FLOOR */}
      {activeTab === "shopfloor" && (
        <div className="sb-shopfloor-grid">
          {batches.filter((b) => ["PLANNED", "RUNNING", "PAUSED"].includes(b.status)).length === 0 ? (
            <Card>
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <h3 className="sb-text-navy" style={{ margin: "0 0 8px 0" }}>No active batches on the shop floor</h3>
                <p className="sb-text-muted" style={{ margin: "0 0 20px 0" }}>All batches are completed. Launch a new batch to start machinery.</p>
                <Button variant="primary" icon="+" onClick={() => setShowBatchModal(true)}>
                  Create Production Batch
                </Button>
              </div>
            </Card>
          ) : (
            batches
              .filter((b) => ["PLANNED", "RUNNING", "PAUSED"].includes(b.status))
              .map((batch) => (
                <div key={batch.id} className={`sb-shopfloor-card status-${batch.status?.toLowerCase()}`}>
                  <div className="sb-sf-header">
                    <div>
                      <span className="sb-sf-batch-tag">{batch.batch_no}</span>
                      <h3 className="sb-sf-product-title">{batch.product_name}</h3>
                    </div>
                    <StatusBadge status={batch.status} />
                  </div>

                  <div className="sb-sf-details">
                    <div className="sb-sf-row">
                      <span>Machine:</span>
                      <strong>{batch.machine_name || "Unassigned"}</strong>
                    </div>
                    <div className="sb-sf-row">
                      <span>Target Output:</span>
                      <strong>{Number(batch.planned_quantity).toLocaleString()} {batch.unit}</strong>
                    </div>
                    <div className="sb-sf-row">
                      <span>Shift / Operator:</span>
                      <strong>{batch.shift_name || "General"} • {batch.operator_name || "Plant Team"}</strong>
                    </div>
                  </div>

                  <div className="sb-sf-actions">
                    {batch.status === "PLANNED" && (
                      <Button
                        size="sm"
                        variant="success"
                        icon="▶️"
                        onClick={() => handleStartBatch(batch.id)}
                      >
                        Start Batch
                      </Button>
                    )}
                    {batch.status === "RUNNING" && (
                      <>
                        <Button
                          size="sm"
                          variant="warning"
                          icon="⏸️"
                          onClick={() => handlePauseBatch(batch.id)}
                        >
                          Pause
                        </Button>
                        <Button
                          size="sm"
                          variant="teal"
                          icon="✅"
                          onClick={() => openCompleteModal(batch)}
                        >
                          Complete Output
                        </Button>
                      </>
                    )}
                    {batch.status === "PAUSED" && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="▶️"
                        onClick={() => handleResumeBatch(batch.id)}
                      >
                        Resume
                      </Button>
                    )}
                    <Link to={`/plastic-erp/traceability?batch=${batch.batch_no}`}>
                      <Button size="sm" variant="secondary" icon="🔍">
                        Trace
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* TAB 3: BATCHES */}
      {activeTab === "batches" && (
        <Card noPadding>
          <DataTable
            columns={batchColumns}
            data={batches}
            loading={loading}
            emptyMessage="No production batches found."
          />
        </Card>
      )}

      {/* TAB 4: PLANNING */}
      {activeTab === "plans" && (
        <Card noPadding>
          <DataTable
            columns={planColumns}
            data={plans}
            loading={loading}
            emptyMessage="No production plans recorded."
          />
        </Card>
      )}

      {/* MODAL: CREATE WORK ORDER */}
      <Modal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        title="Create Work Order"
        subtitle="Schedule new production order with planned quantity, target completion date and recipe"
        size="md"
        footer={
          <div className="sb-modal-footer-actions">
            <Button variant="secondary" onClick={() => setShowOrderModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateOrder}>
              Create Work Order
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateOrder}>
          <div className="sb-form-group">
            <label>Product Name *</label>
            <input
              type="text"
              required
              value={orderForm.product_name}
              onChange={(e) => setOrderForm({ ...orderForm, product_name: e.target.value })}
              placeholder="e.g. Recycled PP Granules Grade A"
              className="sb-input"
            />
          </div>

          <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="sb-form-group">
              <label>BOM / Recipe</label>
              <select
                value={orderForm.recipe_id}
                onChange={(e) => setOrderForm({ ...orderForm, recipe_id: e.target.value })}
                className="sb-select"
              >
                <option value="">Select Recipe (Optional)</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.recipe_name} ({r.version})</option>
                ))}
              </select>
            </div>

            <div className="sb-form-group">
              <label>Planned Quantity (KG) *</label>
              <input
                type="number"
                required
                min="1"
                value={orderForm.planned_quantity}
                onChange={(e) => setOrderForm({ ...orderForm, planned_quantity: e.target.value })}
                className="sb-input"
              />
            </div>
          </div>

          <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="sb-form-group">
              <label>Target Date *</label>
              <input
                type="date"
                required
                value={orderForm.target_date}
                onChange={(e) => setOrderForm({ ...orderForm, target_date: e.target.value })}
                className="sb-input"
              />
            </div>

            <div className="sb-form-group">
              <label>Priority</label>
              <select
                value={orderForm.priority}
                onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value })}
                className="sb-select"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="sb-form-group">
              <label>Assigned Machine</label>
              <select
                value={orderForm.machine_id}
                onChange={(e) => setOrderForm({ ...orderForm, machine_id: e.target.value })}
                className="sb-select"
              >
                <option value="">Any Machine</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</option>
                ))}
              </select>
            </div>

            <div className="sb-form-group">
              <label>Assigned Shift</label>
              <select
                value={orderForm.shift_id}
                onChange={(e) => setOrderForm({ ...orderForm, shift_id: e.target.value })}
                className="sb-select"
              >
                <option value="">Any Shift</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>{s.shift_name}</option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREATE PRODUCTION PLAN */}
      <Modal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        title="New Production Plan"
        subtitle="Plan factory throughput for daily, weekly or monthly plant target"
        size="md"
        footer={
          <div className="sb-modal-footer-actions">
            <Button variant="secondary" onClick={() => setShowPlanModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreatePlan}>
              Save Plan
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreatePlan}>
          <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="sb-form-group">
              <label>Plan Type</label>
              <select
                value={planForm.plan_type}
                onChange={(e) => setPlanForm({ ...planForm, plan_type: e.target.value })}
                className="sb-select"
              >
                <option value="DAILY">Daily Plan</option>
                <option value="WEEKLY">Weekly Plan</option>
                <option value="MONTHLY">Monthly Plan</option>
              </select>
            </div>

            <div className="sb-form-group">
              <label>Target Quantity (KG) *</label>
              <input
                type="number"
                required
                min="1"
                value={planForm.target_quantity}
                onChange={(e) => setPlanForm({ ...planForm, target_quantity: e.target.value })}
                className="sb-input"
              />
            </div>
          </div>

          <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="sb-form-group">
              <label>Start Date *</label>
              <input
                type="date"
                required
                value={planForm.start_date}
                onChange={(e) => setPlanForm({ ...planForm, start_date: e.target.value })}
                className="sb-input"
              />
            </div>

            <div className="sb-form-group">
              <label>End Date *</label>
              <input
                type="date"
                required
                value={planForm.end_date}
                onChange={(e) => setPlanForm({ ...planForm, end_date: e.target.value })}
                className="sb-input"
              />
            </div>
          </div>

          <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="sb-form-group">
              <label>Machine</label>
              <select
                value={planForm.machine_id}
                onChange={(e) => setPlanForm({ ...planForm, machine_id: e.target.value })}
                className="sb-select"
              >
                <option value="">All Machines</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.machine_name}</option>
                ))}
              </select>
            </div>

            <div className="sb-form-group">
              <label>Shift</label>
              <select
                value={planForm.shift_id}
                onChange={(e) => setPlanForm({ ...planForm, shift_id: e.target.value })}
                className="sb-select"
              >
                <option value="">All Shifts</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>{s.shift_name}</option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: CREATE PRODUCTION BATCH */}
      <Modal
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title="Create Production Batch"
        subtitle="Initiate shop floor extrusion / pelleting batch with assigned operator and machine"
        size="md"
        footer={
          <div className="sb-modal-footer-actions">
            <Button variant="secondary" onClick={() => setShowBatchModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateBatch}>
              Create Batch
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateBatch}>
          <div className="sb-form-group">
            <label>Linked Work Order</label>
            <select
              value={batchForm.production_order_id}
              onChange={(e) => {
                const selOrder = orders.find((o) => String(o.id) === e.target.value);
                setBatchForm({
                  ...batchForm,
                  production_order_id: e.target.value,
                  product_name: selOrder ? selOrder.product_name : batchForm.product_name,
                  recipe_id: selOrder ? selOrder.recipe_id || "" : batchForm.recipe_id,
                  planned_quantity: selOrder ? selOrder.planned_quantity : batchForm.planned_quantity,
                });
              }}
              className="sb-select"
            >
              <option value="">None (Independent Batch)</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>{o.production_order_no} - {o.product_name}</option>
              ))}
            </select>
          </div>

          <div className="sb-form-group">
            <label>Product Name *</label>
            <input
              type="text"
              required
              value={batchForm.product_name}
              onChange={(e) => setBatchForm({ ...batchForm, product_name: e.target.value })}
              placeholder="e.g. Recycled PP Granules"
              className="sb-input"
            />
          </div>

          <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="sb-form-group">
              <label>Planned Batch Qty (KG) *</label>
              <input
                type="number"
                required
                min="1"
                value={batchForm.planned_quantity}
                onChange={(e) => setBatchForm({ ...batchForm, planned_quantity: e.target.value })}
                className="sb-input"
              />
            </div>

            <div className="sb-form-group">
              <label>Machine</label>
              <select
                value={batchForm.machine_id}
                onChange={(e) => setBatchForm({ ...batchForm, machine_id: e.target.value })}
                className="sb-select"
              >
                <option value="">Select Machine</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.machine_name} ({m.capacity} KG/HR)</option>
                ))}
              </select>
            </div>
          </div>

          <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="sb-form-group">
              <label>Shift</label>
              <select
                value={batchForm.shift_id}
                onChange={(e) => setBatchForm({ ...batchForm, shift_id: e.target.value })}
                className="sb-select"
              >
                <option value="">Select Shift</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>{s.shift_name}</option>
                ))}
              </select>
            </div>

            <div className="sb-form-group">
              <label>Operator</label>
              <select
                value={batchForm.operator_id}
                onChange={(e) => setBatchForm({ ...batchForm, operator_id: e.target.value })}
                className="sb-select"
              >
                <option value="">Select Operator</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>{op.name} ({op.skill_level})</option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: COMPLETE BATCH & RECORD OUTPUT */}
      <Modal
        isOpen={showCompleteModal && Boolean(selectedBatch)}
        onClose={() => setShowCompleteModal(false)}
        title={`Complete Output: ${selectedBatch?.batch_no || ""}`}
        subtitle="Record finished goods output, process scrap generated and regrind recovery"
        size="md"
        footer={
          <div className="sb-modal-footer-actions">
            <Button variant="secondary" onClick={() => setShowCompleteModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCompleteBatch}>
              Confirm Completion
            </Button>
          </div>
        }
      >
        {selectedBatch && (
          <form onSubmit={handleCompleteBatch}>
            <p className="sb-text-muted" style={{ marginBottom: "16px" }}>
              Recording output will complete the batch, update WIP, add to Finished Goods stock, and generate scrap records.
            </p>

            <div className="sb-form-group">
              <label>Actual Finished Goods Produced (KG) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={completeForm.actual_quantity}
                onChange={(e) => setCompleteForm({ ...completeForm, actual_quantity: e.target.value })}
                className="sb-input"
              />
            </div>

            <div className="sb-form-grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="sb-form-group">
                <label>Process Scrap Generated (KG)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={completeForm.scrap_quantity}
                  onChange={(e) => setCompleteForm({ ...completeForm, scrap_quantity: e.target.value })}
                  className="sb-input"
                />
              </div>

              <div className="sb-form-group">
                <label>Regrind Generated (KG)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={completeForm.regrind_quantity}
                  onChange={(e) => setCompleteForm({ ...completeForm, regrind_quantity: e.target.value })}
                  className="sb-input"
                />
              </div>
            </div>

            <div className="sb-form-group">
              <label>Rejected Output (KG)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={completeForm.rejected_quantity}
                onChange={(e) => setCompleteForm({ ...completeForm, rejected_quantity: e.target.value })}
                className="sb-input"
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export default PlasticProduction;
