import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
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

      if (ordersRes.status === "fulfilled") setOrders(ordersRes.value.data.orders || []);
      if (plansRes.status === "fulfilled") setPlans(plansRes.value.data.plans || []);
      if (batchesRes.status === "fulfilled") setBatches(batchesRes.value.data.batches || []);
      if (recipesRes.status === "fulfilled") setRecipes(recipesRes.value.data.recipes || []);
      if (machinesRes.status === "fulfilled") setMachines(machinesRes.value.data.machines || []);
      if (shiftsRes.status === "fulfilled") setShifts(shiftsRes.value.data.shifts || []);
      if (opsRes.status === "fulfilled") setOperators(opsRes.value.data.operators || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load production data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  if (loading) return <LoadingScreen message="Loading Production Management..." />;

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />

      <div className="plastic-content-wrap">
        <div className="plastic-page-header">
          <div>
            <h1 className="plastic-page-title">🏭 Production Operations</h1>
            <p className="plastic-page-subtitle">Work Orders, Batch Execution, Planning & Shop Floor Controls</p>
          </div>

          <div className="plastic-page-actions">
            <Link to="/plastic-erp" className="btn-dashboard-nav">
              📊 ERP Dashboard
            </Link>
            {activeTab === "orders" && (
              <button type="button" className="btn-primary" onClick={() => setShowOrderModal(true)}>
                ➕ Create Work Order
              </button>
            )}
            {activeTab === "plans" && (
              <button type="button" className="btn-primary" onClick={() => setShowPlanModal(true)}>
                ➕ New Production Plan
              </button>
            )}
            {activeTab === "batches" && (
              <button type="button" className="btn-primary" onClick={() => setShowBatchModal(true)}>
                ➕ Create Production Batch
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="plastic-alert error">
            <span>⚠️ {error}</span>
            <button type="button" onClick={() => setError("")}>✕</button>
          </div>
        )}

        {successMsg && (
          <div className="plastic-alert success">
            <span>✅ {successMsg}</span>
            <button type="button" onClick={() => setSuccessMsg("")}>✕</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="plastic-tabs-nav">
          <button
            type="button"
            className={`tab-btn ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => switchTab("orders")}
          >
            📑 Work Orders ({orders.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "shopfloor" ? "active" : ""}`}
            onClick={() => switchTab("shopfloor")}
          >
            ⚡ Live Shop Floor
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "batches" ? "active" : ""}`}
            onClick={() => switchTab("batches")}
          >
            🏷️ Batches ({batches.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "plans" ? "active" : ""}`}
            onClick={() => switchTab("plans")}
          >
            📅 Planning ({plans.length})
          </button>
        </div>

        {/* TAB 1: WORK ORDERS */}
        {activeTab === "orders" && (
          <div className="plastic-card">
            <div className="table-responsive">
              <table className="plastic-table">
                <thead>
                  <tr>
                    <th>Order No</th>
                    <th>Product</th>
                    <th>Recipe</th>
                    <th>Planned Qty</th>
                    <th>Target Date</th>
                    <th>Priority</th>
                    <th>Machine</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="empty-cell">No production orders found. Click "Create Work Order" to start.</td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id}>
                        <td><strong>{order.production_order_no}</strong></td>
                        <td>{order.product_name}</td>
                        <td>{order.recipe_name || "-"}</td>
                        <td>{Number(order.planned_quantity).toLocaleString()} {order.unit}</td>
                        <td>{order.target_date?.split("T")[0]}</td>
                        <td>
                          <span className={`badge priority-${order.priority?.toLowerCase()}`}>
                            {order.priority}
                          </span>
                        </td>
                        <td>{order.machine_name || "Any"}</td>
                        <td>
                          <span className={`badge status-${order.status?.toLowerCase()}`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE SHOP FLOOR */}
        {activeTab === "shopfloor" && (
          <div className="shopfloor-grid">
            {batches.filter((b) => ["PLANNED", "RUNNING", "PAUSED"].includes(b.status)).length === 0 ? (
              <div className="plastic-card full-width empty-card">
                <h3>No active batches on the shop floor</h3>
                <p>All batches are completed or create a new batch to launch production.</p>
                <button type="button" className="btn-primary" onClick={() => setShowBatchModal(true)}>
                  ➕ Create Production Batch
                </button>
              </div>
            ) : (
              batches
                .filter((b) => ["PLANNED", "RUNNING", "PAUSED"].includes(b.status))
                .map((batch) => (
                  <div key={batch.id} className={`shopfloor-card status-${batch.status?.toLowerCase()}`}>
                    <div className="sf-card-header">
                      <div>
                        <span className="sf-batch-tag">{batch.batch_no}</span>
                        <h3 className="sf-product-title">{batch.product_name}</h3>
                      </div>
                      <span className={`badge status-${batch.status?.toLowerCase()}`}>{batch.status}</span>
                    </div>

                    <div className="sf-card-details">
                      <div className="detail-row">
                        <span>Machine:</span>
                        <strong>{batch.machine_name || "Unassigned"}</strong>
                      </div>
                      <div className="detail-row">
                        <span>Target Output:</span>
                        <strong>{Number(batch.planned_quantity).toLocaleString()} {batch.unit}</strong>
                      </div>
                      <div className="detail-row">
                        <span>Shift / Operator:</span>
                        <strong>{batch.shift_name || "General"} • {batch.operator_name || "Team"}</strong>
                      </div>
                    </div>

                    <div className="sf-card-actions">
                      {batch.status === "PLANNED" && (
                        <button
                          type="button"
                          className="btn-start"
                          onClick={() => handleStartBatch(batch.id)}
                        >
                          ▶️ Start Batch
                        </button>
                      )}
                      {batch.status === "RUNNING" && (
                        <>
                          <button
                            type="button"
                            className="btn-pause"
                            onClick={() => handlePauseBatch(batch.id)}
                          >
                            ⏸️ Pause
                          </button>
                          <button
                            type="button"
                            className="btn-complete"
                            onClick={() => openCompleteModal(batch)}
                          >
                            ✅ Complete Output
                          </button>
                        </>
                      )}
                      {batch.status === "PAUSED" && (
                        <button
                          type="button"
                          className="btn-resume"
                          onClick={() => handleResumeBatch(batch.id)}
                        >
                          ▶️ Resume
                        </button>
                      )}
                      <Link to={`/plastic-erp/traceability?batch=${batch.batch_no}`} className="btn-trace">
                        🔍 Trace
                      </Link>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}

        {/* TAB 3: BATCHES */}
        {activeTab === "batches" && (
          <div className="plastic-card">
            <div className="table-responsive">
              <table className="plastic-table">
                <thead>
                  <tr>
                    <th>Batch No</th>
                    <th>Product</th>
                    <th>Date</th>
                    <th>Planned</th>
                    <th>Actual Output</th>
                    <th>Scrap</th>
                    <th>Efficiency</th>
                    <th>QC Status</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="empty-cell">No batches found.</td>
                    </tr>
                  ) : (
                    batches.map((b) => (
                      <tr key={b.id}>
                        <td><strong>{b.batch_no}</strong></td>
                        <td>{b.product_name}</td>
                        <td>{b.batch_date?.split("T")[0]}</td>
                        <td>{Number(b.planned_quantity).toLocaleString()} {b.unit}</td>
                        <td>{Number(b.actual_quantity || 0).toLocaleString()} {b.unit}</td>
                        <td>{Number(b.scrap_quantity || 0).toLocaleString()} {b.unit}</td>
                        <td>
                          <strong>{Number(b.efficiency_percent || 0).toFixed(1)}%</strong>
                        </td>
                        <td>
                          <span className={`badge qc-${b.qc_status?.toLowerCase()}`}>{b.qc_status}</span>
                        </td>
                        <td>
                          <span className={`badge status-${b.status?.toLowerCase()}`}>{b.status}</span>
                        </td>
                        <td>
                          <Link to={`/plastic-erp/traceability?batch=${b.batch_no}`} className="action-link">
                            Trace 🔍
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: PLANNING */}
        {activeTab === "plans" && (
          <div className="plastic-card">
            <div className="table-responsive">
              <table className="plastic-table">
                <thead>
                  <tr>
                    <th>Plan Code</th>
                    <th>Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Target Qty</th>
                    <th>Machine</th>
                    <th>Shift</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="empty-cell">No production plans recorded.</td>
                    </tr>
                  ) : (
                    plans.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.plan_code}</strong></td>
                        <td>{p.plan_type}</td>
                        <td>{p.start_date?.split("T")[0]}</td>
                        <td>{p.end_date?.split("T")[0]}</td>
                        <td>{Number(p.target_quantity).toLocaleString()} {p.unit}</td>
                        <td>{p.machine_name || "All"}</td>
                        <td>{p.shift_name || "All"}</td>
                        <td>
                          <span className={`badge status-${p.status?.toLowerCase()}`}>{p.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: CREATE WORK ORDER */}
        {showOrderModal && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal">
              <div className="modal-header">
                <h3>Create New Work Order</h3>
                <button type="button" onClick={() => setShowOrderModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCreateOrder} className="modal-form">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    required
                    value={orderForm.product_name}
                    onChange={(e) => setOrderForm({ ...orderForm, product_name: e.target.value })}
                    placeholder="e.g. Recycled PP Granules Grade A"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>BOM / Recipe</label>
                    <select
                      value={orderForm.recipe_id}
                      onChange={(e) => setOrderForm({ ...orderForm, recipe_id: e.target.value })}
                    >
                      <option value="">Select Recipe (Optional)</option>
                      {recipes.map((r) => (
                        <option key={r.id} value={r.id}>{r.recipe_name} ({r.version})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Planned Quantity (KG) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={orderForm.planned_quantity}
                      onChange={(e) => setOrderForm({ ...orderForm, planned_quantity: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Target Date *</label>
                    <input
                      type="date"
                      required
                      value={orderForm.target_date}
                      onChange={(e) => setOrderForm({ ...orderForm, target_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      value={orderForm.priority}
                      onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value })}
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Assigned Machine</label>
                    <select
                      value={orderForm.machine_id}
                      onChange={(e) => setOrderForm({ ...orderForm, machine_id: e.target.value })}
                    >
                      <option value="">Any Machine</option>
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>{m.machine_name} ({m.machine_code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Assigned Shift</label>
                    <select
                      value={orderForm.shift_id}
                      onChange={(e) => setOrderForm({ ...orderForm, shift_id: e.target.value })}
                    >
                      <option value="">Any Shift</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>{s.shift_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowOrderModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Create Work Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE PRODUCTION PLAN */}
        {showPlanModal && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal">
              <div className="modal-header">
                <h3>New Production Plan</h3>
                <button type="button" onClick={() => setShowPlanModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCreatePlan} className="modal-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Plan Type</label>
                    <select
                      value={planForm.plan_type}
                      onChange={(e) => setPlanForm({ ...planForm, plan_type: e.target.value })}
                    >
                      <option value="DAILY">Daily Plan</option>
                      <option value="WEEKLY">Weekly Plan</option>
                      <option value="MONTHLY">Monthly Plan</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Target Quantity (KG) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={planForm.target_quantity}
                      onChange={(e) => setPlanForm({ ...planForm, target_quantity: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input
                      type="date"
                      required
                      value={planForm.start_date}
                      onChange={(e) => setPlanForm({ ...planForm, start_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>End Date *</label>
                    <input
                      type="date"
                      required
                      value={planForm.end_date}
                      onChange={(e) => setPlanForm({ ...planForm, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowPlanModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Plan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE PRODUCTION BATCH */}
        {showBatchModal && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal">
              <div className="modal-header">
                <h3>Create Production Batch</h3>
                <button type="button" onClick={() => setShowBatchModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCreateBatch} className="modal-form">
                <div className="form-group">
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
                  >
                    <option value="">None (Independent Batch)</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>{o.production_order_no} - {o.product_name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    required
                    value={batchForm.product_name}
                    onChange={(e) => setBatchForm({ ...batchForm, product_name: e.target.value })}
                    placeholder="e.g. Recycled PP Granules"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Planned Batch Qty (KG) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={batchForm.planned_quantity}
                      onChange={(e) => setBatchForm({ ...batchForm, planned_quantity: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Machine</label>
                    <select
                      value={batchForm.machine_id}
                      onChange={(e) => setBatchForm({ ...batchForm, machine_id: e.target.value })}
                    >
                      <option value="">Select Machine</option>
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>{m.machine_name} ({m.capacity} KG/HR)</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Shift</label>
                    <select
                      value={batchForm.shift_id}
                      onChange={(e) => setBatchForm({ ...batchForm, shift_id: e.target.value })}
                    >
                      <option value="">Select Shift</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>{s.shift_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Operator</label>
                    <select
                      value={batchForm.operator_id}
                      onChange={(e) => setBatchForm({ ...batchForm, operator_id: e.target.value })}
                    >
                      <option value="">Select Operator</option>
                      {operators.map((op) => (
                        <option key={op.id} value={op.id}>{op.name} ({op.skill_level})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowBatchModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Create Batch
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: COMPLETE BATCH & RECORD OUTPUT */}
        {showCompleteModal && selectedBatch && (
          <div className="plastic-modal-backdrop">
            <div className="plastic-modal">
              <div className="modal-header">
                <h3>Complete Output: {selectedBatch.batch_no}</h3>
                <button type="button" onClick={() => setShowCompleteModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCompleteBatch} className="modal-form">
                <p className="modal-notice">
                  Recording output will complete the batch, update WIP, add to Finished Goods stock, and generate scrap records.
                </p>

                <div className="form-group">
                  <label>Actual Finished Goods Produced (KG) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={completeForm.actual_quantity}
                    onChange={(e) => setCompleteForm({ ...completeForm, actual_quantity: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Process Scrap Generated (KG)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={completeForm.scrap_quantity}
                      onChange={(e) => setCompleteForm({ ...completeForm, scrap_quantity: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Regrind Generated (KG)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={completeForm.regrind_quantity}
                      onChange={(e) => setCompleteForm({ ...completeForm, regrind_quantity: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Rejected Output (KG)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={completeForm.rejected_quantity}
                    onChange={(e) => setCompleteForm({ ...completeForm, rejected_quantity: e.target.value })}
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowCompleteModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Confirm Completion
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlasticProduction;
