import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import "./PlasticCosting.css";

function PlasticCosting() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [costs, setCosts] = useState([]);
  const [summary, setSummary] = useState({
    totalBatchesCosted: 0,
    totalProductionExpense: 0,
    totalOutputKg: 0,
    avgCostPerKg: 0,
  });

  const [batches, setBatches] = useState([]);

  // Recalculate Modal State
  const [showCostModal, setShowCostModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [costParams, setCostParams] = useState({
    labour_rate_per_hour: "150",
    machine_rate_per_hour: "350",
    overhead_percent: "10",
    standard_cost_per_kg: "45",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [costRes, batchRes] = await Promise.allSettled([
        API.get("/plastic-erp/costing"),
        API.get("/plastic-erp/production/batches"),
      ]);

      if (costRes.status === "fulfilled") {
        setCosts(costRes.value.data.costs || []);
        if (costRes.value.data.summary) {
          setSummary(costRes.value.data.summary);
        }
      }

      if (batchRes.status === "fulfilled") {
        setBatches(batchRes.value.data.batches || []);
        if (batchRes.value.data.batches?.length > 0 && !selectedBatchId) {
          setSelectedBatchId(batchRes.value.data.batches[0].id);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load costing analysis.");
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleCalculateCost = async (e) => {
    e.preventDefault();
    if (!selectedBatchId) {
      setError("Please select a batch to cost.");
      return;
    }
    try {
      await API.post(`/plastic-erp/costing/batch/${selectedBatchId}`, {
        labour_rate_per_hour: Number(costParams.labour_rate_per_hour),
        machine_rate_per_hour: Number(costParams.machine_rate_per_hour),
        overhead_percent: Number(costParams.overhead_percent),
        standard_cost_per_kg: Number(costParams.standard_cost_per_kg),
      });

      setSuccessMsg("Batch cost analysis computed successfully!");
      setShowCostModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to calculate cost.");
    }
  };

  if (loading) {
    return (
      <div className="plastic-cost-page">
        <PlasticNavbar />
        <LoadingScreen message="Loading costing metrics..." />
      </div>
    );
  }

  return (
    <div className="plastic-cost-page">
      <PlasticNavbar />

      <main className="plastic-cost-container">
        {/* Header */}
        <div className="plastic-cost-header">
          <div>
            <span className="plastic-cost-badge">FINANCIAL & MARGIN CONTROL</span>
            <h1 className="plastic-cost-title">Production Costing & Variance</h1>
            <p className="plastic-cost-subtitle">
              Detailed cost analysis: Raw material, regrind credit, machine runtime, labour, and overhead per KG/ton.
            </p>
          </div>
          <div className="plastic-cost-header-actions">
            <Link to="/plastic-erp" className="btn-secondary-link">
              ← ERP Dashboard
            </Link>
            <button
              className="btn-primary-cost"
              onClick={() => setShowCostModal(true)}
            >
              + Calculate Batch Cost
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="cost-alert cost-alert-danger">
            <span>{error}</span>
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {successMsg && (
          <div className="cost-alert cost-alert-success">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg("")}>×</button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="plastic-cost-stats-grid">
          <div className="cost-stat-card">
            <span className="cost-stat-label">Total Batches Costed</span>
            <span className="cost-stat-val">{summary.totalBatchesCosted}</span>
            <span className="cost-stat-sub">Tracked in plant operations</span>
          </div>
          <div className="cost-stat-card">
            <span className="cost-stat-label">Total Production Expense</span>
            <span className="cost-stat-val text-blue">
              ₹{Number(summary.totalProductionExpense).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
            <span className="cost-stat-sub">Direct & Indirect Costs</span>
          </div>
          <div className="cost-stat-card">
            <span className="cost-stat-label">Total Plant Output</span>
            <span className="cost-stat-val text-green">
              {Number(summary.totalOutputKg).toLocaleString("en-IN")} KG
            </span>
            <span className="cost-stat-sub">
              {(Number(summary.totalOutputKg) / 1000).toFixed(2)} Metric Tons
            </span>
          </div>
          <div className="cost-stat-card">
            <span className="cost-stat-label">Avg Production Cost</span>
            <span className="cost-stat-val text-purple">
              ₹{summary.avgCostPerKg} <span className="val-unit">/ KG</span>
            </span>
            <span className="cost-stat-sub">
              ₹{(summary.avgCostPerKg * 1000).toLocaleString("en-IN")} / Ton
            </span>
          </div>
        </div>

        {/* Main Costing Table Card */}
        <div className="plastic-cost-card">
          <div className="card-top-bar">
            <div>
              <h3>Batch Cost Breakdown & Standard Variance</h3>
              <p className="card-desc">Comprehensive breakdown of actual input costs vs standard benchmarks.</p>
            </div>
            <button
              className="btn-outline-sm"
              onClick={() => setShowCostModal(true)}
            >
              + Compute New Batch
            </button>
          </div>

          <div className="cost-table-responsive">
            <table className="cost-table">
              <thead>
                <tr>
                  <th>Batch No</th>
                  <th>Product</th>
                  <th>Output (KG)</th>
                  <th>Raw Material</th>
                  <th>Regrind Credit</th>
                  <th>Labour</th>
                  <th>Machine / Power</th>
                  <th>Overhead</th>
                  <th>Total Cost</th>
                  <th>Cost / KG</th>
                  <th>Std / KG</th>
                  <th>Variance</th>
                  <th>Calculated</th>
                </tr>
              </thead>
              <tbody>
                {costs.length === 0 ? (
                  <tr>
                    <td colSpan="13" className="text-center py-5 text-muted">
                      No batch costing analyses found. Click &quot;+ Calculate Batch Cost&quot; to compute costs for a batch.
                    </td>
                  </tr>
                ) : (
                  costs.map((c) => {
                    const isFavorable = Number(c.variance_amount) <= 0;
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link
                            to={`/plastic-erp/traceability?batch=${encodeURIComponent(c.batch_no)}`}
                            className="batch-link"
                          >
                            <code>{c.batch_no}</code>
                          </Link>
                        </td>
                        <td><strong>{c.product_name}</strong></td>
                        <td>{c.output_quantity} KG</td>
                        <td>₹{Number(c.raw_material_cost).toFixed(2)}</td>
                        <td>
                          {Number(c.regrind_cost) > 0 ? (
                            <span className="text-green">-₹{Number(c.regrind_cost).toFixed(2)}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>₹{Number(c.labour_cost).toFixed(2)}</td>
                        <td>₹{Number(c.machine_cost).toFixed(2)}</td>
                        <td>₹{Number(c.overhead_cost).toFixed(2)}</td>
                        <td><strong>₹{Number(c.total_cost).toFixed(2)}</strong></td>
                        <td>
                          <span className="cost-per-kg-badge">
                            ₹{Number(c.cost_per_kg).toFixed(2)}
                          </span>
                        </td>
                        <td className="text-muted">₹{Number(c.standard_cost_per_kg).toFixed(2)}</td>
                        <td>
                          <span
                            className={`variance-pill ${
                              isFavorable ? "variance-favorable" : "variance-adverse"
                            }`}
                          >
                            {isFavorable ? "▼" : "▲"} ₹{Math.abs(Number(c.variance_amount)).toFixed(2)} ({c.variance_percent}%)
                          </span>
                        </td>
                        <td className="text-muted font-sm">
                          {new Date(c.calculated_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* CALCULATE BATCH COST MODAL */}
      {showCostModal && (
        <div className="cost-modal-backdrop">
          <div className="cost-modal-box">
            <div className="cost-modal-header">
              <h2>Calculate Batch Production Cost</h2>
              <button onClick={() => setShowCostModal(false)}>×</button>
            </div>
            <form onSubmit={handleCalculateCost} className="cost-modal-form">
              <div className="form-group">
                <label>Select Production Batch *</label>
                <select
                  required
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                >
                  <option value="">-- Choose Batch --</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_no} — {b.product_name} ({b.status}, {b.actual_quantity || b.planned_quantity} KG)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Labour Rate (₹/Hour)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={costParams.labour_rate_per_hour}
                    onChange={(e) =>
                      setCostParams({
                        ...costParams,
                        labour_rate_per_hour: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Machine & Power Rate (₹/Hour)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={costParams.machine_rate_per_hour}
                    onChange={(e) =>
                      setCostParams({
                        ...costParams,
                        machine_rate_per_hour: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Overhead Allocation (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={costParams.overhead_percent}
                    onChange={(e) =>
                      setCostParams({
                        ...costParams,
                        overhead_percent: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Standard Benchmark (₹/KG)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={costParams.standard_cost_per_kg}
                    onChange={(e) =>
                      setCostParams({
                        ...costParams,
                        standard_cost_per_kg: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="modal-info-note">
                💡 Raw material consumptions and regrind usage are automatically fetched from this batch&apos;s shop floor logs.
              </div>

              <div className="cost-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowCostModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Run Cost Calculation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlasticCosting;
