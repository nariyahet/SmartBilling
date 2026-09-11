import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  KpiCard,
  Card,
  Tabs,
  DataTable,
  Modal,
  Button,
  StatusBadge,
  AlertBanner,
} from "../components";
import "./PlasticScrapRegrind.css";

function PlasticScrapRegrind() {
  const [activeTab, setActiveTab] = useState("scrap");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [scrapRecords, setScrapRecords] = useState([]);
  const [scrapSummary, setScrapSummary] = useState({ totalScrapKg: 0, reusableScrapKg: 0, nonReusableScrapKg: 0 });

  const [regrindTx, setRegrindTx] = useState([]);
  const [regrindSummary, setRegrindSummary] = useState({ totalGeneratedKg: 0, totalConsumedKg: 0, currentRegrindStockKg: 0 });

  const [batches, setBatches] = useState([]);
  const [machines, setMachines] = useState([]);

  // Modals
  const [showScrapModal, setShowScrapModal] = useState(false);
  const [showRegrindModal, setShowRegrindModal] = useState(false);

  const [scrapForm, setScrapForm] = useState({
    scrap_type: "PROCESS_SCRAP",
    batch_id: "",
    machine_id: "",
    material_name: "PP Process Waste",
    quantity: "",
    unit: "KG",
    reason: "Startup purge and trimming",
    is_reusable: 1,
  });

  const [regrindForm, setRegrindForm] = useState({
    source_batch_id: "",
    material_name: "PP Regrind Granules",
    quantity: "",
    unit: "KG",
    recovery_rate_percent: "95.0",
    notes: "Crushed and granulated in-house",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [scrapRes, regrindRes, batchesRes, machinesRes] = await Promise.allSettled([
        API.get("/plastic-erp/inventory/scrap"),
        API.get("/plastic-erp/inventory/regrind"),
        API.get("/plastic-erp/production/batches"),
        API.get("/plastic-erp/plant/machines"),
      ]);

      if (scrapRes.status === "fulfilled") {
        setScrapRecords(scrapRes.value.data.scrapRecords || []);
        setScrapSummary(scrapRes.value.data.summary || { totalScrapKg: 0, reusableScrapKg: 0, nonReusableScrapKg: 0 });
      }
      if (regrindRes.status === "fulfilled") {
        setRegrindTx(regrindRes.value.data.transactions || []);
        setRegrindSummary(regrindRes.value.data.summary || { totalGeneratedKg: 0, totalConsumedKg: 0, currentRegrindStockKg: 0 });
      }
      if (batchesRes.status === "fulfilled") setBatches(batchesRes.value.data.batches || []);
      if (machinesRes.status === "fulfilled") setMachines(machinesRes.value.data.machines || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load scrap and regrind records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRecordScrap = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/inventory/scrap", scrapForm);
      setSuccessMsg("Scrap record logged successfully!");
      setShowScrapModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to log scrap.");
    }
  };

  const handleRecordRegrind = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/inventory/regrind/generate", regrindForm);
      setSuccessMsg("Regrind generation logged successfully!");
      setShowRegrindModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to log regrind.");
    }
  };

  if (loading) return <LoadingScreen message="Loading Scrap & Regrind..." />;

  const tabs = [
    { id: "scrap", label: "Process Scrap & Waste", count: scrapRecords.length },
    { id: "regrind", label: "Regrind Transactions", count: regrindTx.length },
  ];

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Scrap & Regrind Operations"
        subtitle="Process Waste Tracking, In-House Regrind Recycling & Recovery %"
        breadcrumbs={[
          { label: "ERP", to: "/plastic-erp" },
          { label: "Production", to: "/plastic-erp/production" },
          { label: "Scrap & Regrind" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/plastic-erp">
              <Button variant="secondary">ERP Dashboard</Button>
            </Link>
            {activeTab === "scrap" ? (
              <Button variant="primary" onClick={() => setShowScrapModal(true)}>
                + Record Process Scrap
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setShowRegrindModal(true)}>
                + Generate Regrind Stock
              </Button>
            )}
          </div>
        }
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg("")} />}

      {/* KPI Cards */}
      <div className="regrind-kpis-grid sb-kpis-grid sb-kpi-grid" style={{ marginBottom: "24px" }}>
        <KpiCard
          title="Total Process Scrap"
          label="Total Process Scrap"
          value={`${Number(scrapSummary.totalScrapKg || 0).toLocaleString()} KG`}
          supportingText={`${Number(scrapSummary.reusableScrapKg || 0).toLocaleString()} KG reusable`}
          subtext={`${Number(scrapSummary.reusableScrapKg || 0).toLocaleString()} KG reusable`}
          icon="♻️"
          accent="danger"
        />
        <KpiCard
          title="Current Regrind Stock"
          label="Current Regrind Stock"
          value={`${Number(regrindSummary.currentRegrindStockKg || 0).toLocaleString()} KG`}
          supportingText="Available for extrusion batches"
          subtext="Available for extrusion batches"
          icon="📦"
          accent="teal"
        />
        <KpiCard
          title="Regrind Generated"
          label="Regrind Generated"
          value={`${Number(regrindSummary.totalGeneratedKg || 0).toLocaleString()} KG`}
          supportingText={`${Number(regrindSummary.totalConsumedKg || 0).toLocaleString()} KG consumed`}
          subtext={`${Number(regrindSummary.totalConsumedKg || 0).toLocaleString()} KG consumed`}
          icon="⚙️"
          accent="blue"
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: SCRAP RECORDS */}
      {activeTab === "scrap" && (
        <Card noPadding>
          <DataTable
            headers={[
              "Scrap No",
              "Type",
              "Material",
              "Quantity",
              "Origin Batch",
              "Machine",
              "Reusable",
              "Reason",
              "Date",
            ]}
          >
            {scrapRecords.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                  No scrap records logged.
                </td>
              </tr>
            ) : (
              scrapRecords.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.scrap_no}</strong></td>
                  <td><span className="scrap-tag-regrind">{s.scrap_type}</span></td>
                  <td>{s.material_name}</td>
                  <td><strong>{Number(s.quantity).toLocaleString()} {s.unit}</strong></td>
                  <td>{s.batch_no || "-"}</td>
                  <td>{s.machine_name || "General"}</td>
                  <td>
                    <StatusBadge status={s.is_reusable ? "APPROVED" : "CANCELLED"} />
                  </td>
                  <td>{s.reason || "-"}</td>
                  <td>{s.recorded_at?.split("T")[0]}</td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>
      )}

      {/* TAB 2: REGRIND TRANSACTIONS */}
      {activeTab === "regrind" && (
        <Card noPadding>
          <DataTable
            headers={[
              "Tx No",
              "Type",
              "Material Name",
              "Quantity",
              "Recovery Rate",
              "Date",
              "Notes",
            ]}
          >
            {regrindTx.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                  No regrind transactions recorded. Click &quot;Generate Regrind Stock&quot;.
                </td>
              </tr>
            ) : (
              regrindTx.map((tx) => (
                <tr key={tx.id}>
                  <td><strong>{tx.transaction_no}</strong></td>
                  <td>
                    <StatusBadge status={tx.transaction_type === "GENERATION" ? "COMPLETED" : "IN_PROGRESS"} />
                  </td>
                  <td>{tx.material_name}</td>
                  <td><strong>{Number(tx.quantity).toLocaleString()} {tx.unit}</strong></td>
                  <td>{Number(tx.recovery_rate_percent || 100).toFixed(1)}%</td>
                  <td>{tx.transaction_date?.split("T")[0]}</td>
                  <td>{tx.notes || "-"}</td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>
      )}

      {/* MODAL: RECORD SCRAP */}
      <Modal
        isOpen={showScrapModal}
        onClose={() => setShowScrapModal(false)}
        title="Record Process Scrap / Waste"
      >
        <form onSubmit={handleRecordScrap} className="sb-form">
          <div className="sb-form-group">
            <label className="sb-label">Material Name *</label>
            <input
              type="text"
              required
              className="sb-input"
              value={scrapForm.material_name}
              onChange={(e) => setScrapForm({ ...scrapForm, material_name: e.target.value })}
            />
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Scrap Type</label>
              <select
                className="sb-input"
                value={scrapForm.scrap_type}
                onChange={(e) => setScrapForm({ ...scrapForm, scrap_type: e.target.value })}
              >
                <option value="PROCESS_SCRAP">Process Scrap</option>
                <option value="PRODUCTION_WASTE">Production Waste</option>
                <option value="REJECTION">Rejected Parts</option>
                <option value="REWORK">Rework Purge</option>
              </select>
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Quantity (KG) *</label>
              <input
                type="number"
                required
                min="0.1"
                step="0.01"
                className="sb-input"
                value={scrapForm.quantity}
                onChange={(e) => setScrapForm({ ...scrapForm, quantity: e.target.value })}
              />
            </div>
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Origin Batch</label>
              <select
                className="sb-input"
                value={scrapForm.batch_id}
                onChange={(e) => setScrapForm({ ...scrapForm, batch_id: e.target.value })}
              >
                <option value="">None (Floor Purge)</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.batch_no} - {b.product_name}</option>
                ))}
              </select>
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Machine</label>
              <select
                className="sb-input"
                value={scrapForm.machine_id}
                onChange={(e) => setScrapForm({ ...scrapForm, machine_id: e.target.value })}
              >
                <option value="">Select Machine</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>{m.machine_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Reason / Defect</label>
            <input
              type="text"
              className="sb-input"
              value={scrapForm.reason}
              onChange={(e) => setScrapForm({ ...scrapForm, reason: e.target.value })}
              placeholder="e.g. Purge lump, die head pressure buildup, contaminated trims"
            />
          </div>

          <div className="sb-form-group">
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={scrapForm.is_reusable === 1}
                onChange={(e) => setScrapForm({ ...scrapForm, is_reusable: e.target.checked ? 1 : 0 })}
              />
              Reusable in Regrind Granulator
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setShowScrapModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Record Scrap
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: RECORD REGRIND GENERATION */}
      <Modal
        isOpen={showRegrindModal}
        onClose={() => setShowRegrindModal(false)}
        title="Generate Regrind Stock"
      >
        <form onSubmit={handleRecordRegrind} className="sb-form">
          <div className="sb-form-group">
            <label className="sb-label">Regrind Material Name *</label>
            <input
              type="text"
              required
              className="sb-input"
              value={regrindForm.material_name}
              onChange={(e) => setRegrindForm({ ...regrindForm, material_name: e.target.value })}
            />
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Quantity Generated (KG) *</label>
              <input
                type="number"
                required
                min="0.1"
                step="0.01"
                className="sb-input"
                value={regrindForm.quantity}
                onChange={(e) => setRegrindForm({ ...regrindForm, quantity: e.target.value })}
              />
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Recovery Rate %</label>
              <input
                type="number"
                min="1"
                max="100"
                step="0.1"
                className="sb-input"
                value={regrindForm.recovery_rate_percent}
                onChange={(e) => setRegrindForm({ ...regrindForm, recovery_rate_percent: e.target.value })}
              />
            </div>
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Source Batch (Optional)</label>
            <select
              className="sb-input"
              value={regrindForm.source_batch_id}
              onChange={(e) => setRegrindForm({ ...regrindForm, source_batch_id: e.target.value })}
            >
              <option value="">General Reusable Scrap</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.batch_no} - {b.product_name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setShowRegrindModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Regrind Stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PlasticScrapRegrind;
