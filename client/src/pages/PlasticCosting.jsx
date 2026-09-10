import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  KpiCard,
  Card,
  DataTable,
  Modal,
  Button,
  AlertBanner,
} from "../components";
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

  if (loading) return <LoadingScreen message="Loading costing metrics..." />;

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Production Costing & Variance"
        subtitle="Detailed cost analysis: Raw material, regrind credit, machine runtime, labour, and overhead per KG/ton."
        breadcrumbs={[
          { label: "ERP", to: "/plastic-erp" },
          { label: "Production", to: "/plastic-erp/production" },
          { label: "Costing" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/plastic-erp">
              <Button variant="secondary">ERP Dashboard</Button>
            </Link>
            <Button variant="primary" onClick={() => setShowCostModal(true)}>
              + Calculate Batch Cost
            </Button>
          </div>
        }
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg("")} />}

      {/* KPI Cards */}
      <div className="sb-kpis-grid" style={{ marginBottom: "24px" }}>
        <KpiCard
          label="Total Batches Costed"
          value={summary.totalBatchesCosted}
          subtext="Tracked in plant operations"
          accent="navy"
        />
        <KpiCard
          label="Total Production Expense"
          value={`₹${Number(summary.totalProductionExpense).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
          subtext="Direct & Indirect Costs"
          accent="blue"
        />
        <KpiCard
          label="Total Plant Output"
          value={`${Number(summary.totalOutputKg).toLocaleString("en-IN")} KG`}
          subtext={`${(Number(summary.totalOutputKg) / 1000).toFixed(2)} Metric Tons`}
          accent="teal"
        />
        <KpiCard
          label="Avg Production Cost"
          value={`₹${summary.avgCostPerKg} / KG`}
          subtext={`₹${(summary.avgCostPerKg * 1000).toLocaleString("en-IN")} / Ton`}
          accent="navy"
        />
      </div>

      {/* Main Costing Table Card */}
      <Card noPadding>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--sb-border)" }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700, color: "var(--sb-navy)" }}>
              Batch Cost Breakdown & Standard Variance
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--sb-muted)" }}>
              Comprehensive breakdown of actual input costs vs standard benchmarks.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowCostModal(true)}>
            + Compute New Batch
          </Button>
        </div>

        <DataTable
          headers={[
            "Batch No",
            "Product",
            "Output (KG)",
            "Raw Material",
            "Regrind Credit",
            "Labour",
            "Machine / Power",
            "Overhead",
            "Total Cost",
            "Cost / KG",
            "Std / KG",
            "Variance",
            "Calculated",
          ]}
        >
          {costs.length === 0 ? (
            <tr>
              <td colSpan="13" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
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
                      style={{ color: "var(--sb-ocean)", fontWeight: 600 }}
                    >
                      <code>{c.batch_no}</code>
                    </Link>
                  </td>
                  <td><strong>{c.product_name}</strong></td>
                  <td>{c.output_quantity} KG</td>
                  <td>₹{Number(c.raw_material_cost).toFixed(2)}</td>
                  <td>
                    {Number(c.regrind_cost) > 0 ? (
                      <span style={{ color: "var(--sb-success)", fontWeight: 600 }}>-₹{Number(c.regrind_cost).toFixed(2)}</span>
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
                  <td style={{ color: "var(--sb-muted)" }}>₹{Number(c.standard_cost_per_kg).toFixed(2)}</td>
                  <td>
                    <span
                      className={`variance-pill ${
                        isFavorable ? "variance-favorable" : "variance-adverse"
                      }`}
                    >
                      {isFavorable ? "▼" : "▲"} ₹{Math.abs(Number(c.variance_amount)).toFixed(2)} ({c.variance_percent}%)
                    </span>
                  </td>
                  <td style={{ color: "var(--sb-muted)", fontSize: "12px" }}>
                    {new Date(c.calculated_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })
          )}
        </DataTable>
      </Card>

      {/* CALCULATE BATCH COST MODAL */}
      <Modal
        isOpen={showCostModal}
        onClose={() => setShowCostModal(false)}
        title="Calculate Batch Production Cost"
      >
        <form onSubmit={handleCalculateCost} className="sb-form">
          <div className="sb-form-group">
            <label className="sb-label">Select Production Batch *</label>
            <select
              required
              className="sb-input"
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

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Labour Rate (₹/Hour)</label>
              <input
                type="number"
                step="0.01"
                required
                className="sb-input"
                value={costParams.labour_rate_per_hour}
                onChange={(e) =>
                  setCostParams({
                    ...costParams,
                    labour_rate_per_hour: e.target.value,
                  })
                }
              />
            </div>
            <div className="sb-form-group">
              <label className="sb-label">Machine & Power Rate (₹/Hour)</label>
              <input
                type="number"
                step="0.01"
                required
                className="sb-input"
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

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Overhead Allocation (%)</label>
              <input
                type="number"
                step="0.1"
                required
                className="sb-input"
                value={costParams.overhead_percent}
                onChange={(e) =>
                  setCostParams({
                    ...costParams,
                    overhead_percent: e.target.value,
                  })
                }
              />
            </div>
            <div className="sb-form-group">
              <label className="sb-label">Standard Benchmark (₹/KG)</label>
              <input
                type="number"
                step="0.01"
                required
                className="sb-input"
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

          <div style={{ background: "var(--sb-canvas)", border: "1px dashed var(--sb-border)", padding: "10px 14px", borderRadius: "6px", fontSize: "12.5px", color: "var(--sb-muted)" }}>
            💡 Raw material consumptions and regrind usage are automatically fetched from this batch&apos;s shop floor logs.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setShowCostModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Run Cost Calculation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PlasticCosting;
