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
import "./PlasticWipFg.css";

function PlasticWipFg() {
  const [activeTab, setActiveTab] = useState("wip");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [wipItems, setWipItems] = useState([]);
  const [wipSummary, setWipSummary] = useState({ totalBatchesInWip: 0, totalWipKg: 0 });

  const [finishedGoods, setFinishedGoods] = useState([]);
  const [fgSummary, setFgSummary] = useState({ totalProducts: 0, totalFgStockKg: 0 });

  const [fgLots, setFgLots] = useState([]);

  // Modals
  const [showWipModal, setShowWipModal] = useState(false);
  const [selectedWip, setSelectedWip] = useState(null);
  const [wipForm, setWipForm] = useState({ stage: "EXTRUSION", location: "Shop Floor 1", status: "PROCESSING" });

  const [showFgModal, setShowFgModal] = useState(false);
  const [fgForm, setFgForm] = useState({
    fg_name: "",
    plastic_type: "PP",
    grade: "Grade A",
    color: "Natural",
    minimum_stock: "1000",
    standard_cost: "42.00",
    selling_price: "55.00",
    warehouse_location: "Main Warehouse Bay 1",
    packing_type: "25 KG Bags",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [wipRes, fgRes, lotsRes] = await Promise.allSettled([
        API.get("/plastic-erp/inventory/wip"),
        API.get("/plastic-erp/inventory/finished-goods"),
        API.get("/plastic-erp/inventory/finished-goods/lots"),
      ]);

      if (wipRes.status === "fulfilled") {
        setWipItems(wipRes.value.data.wipStock || []);
        setWipSummary(wipRes.value.data.summary || { totalBatchesInWip: 0, totalWipKg: 0 });
      }
      if (fgRes.status === "fulfilled") {
        setFinishedGoods(fgRes.value.data.finishedGoods || []);
        setFgSummary(fgRes.value.data.summary || { totalProducts: 0, totalFgStockKg: 0 });
      }
      if (lotsRes.status === "fulfilled") {
        setFgLots(lotsRes.value.data.lots || []);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openUpdateWip = (wip) => {
    setSelectedWip(wip);
    setWipForm({
      stage: wip.stage,
      location: wip.location,
      status: wip.status,
    });
    setShowWipModal(true);
  };

  const handleUpdateWip = async (e) => {
    e.preventDefault();
    if (!selectedWip) return;
    try {
      await API.put(`/plastic-erp/inventory/wip/${selectedWip.id}`, wipForm);
      setSuccessMsg("WIP stage updated successfully!");
      setShowWipModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update WIP.");
    }
  };

  const handleCreateFg = async (e) => {
    e.preventDefault();
    try {
      await API.post("/plastic-erp/inventory/finished-goods", fgForm);
      setSuccessMsg("Finished Good catalog item created!");
      setShowFgModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create FG item.");
    }
  };

  if (loading) return <LoadingScreen message="Loading WIP & Finished Goods..." />;

  const tabs = [
    { id: "wip", label: "Work-in-Progress", count: wipItems.length },
    { id: "fg", label: "Finished Goods Stock", count: finishedGoods.length },
    { id: "lots", label: "Production Lots", count: fgLots.length },
  ];

  return (
    <div className="sb-page-container">
      <PageHeader
        title="WIP & Finished Goods Inventory"
        subtitle="Shop Floor Work-in-Progress Stages & Warehouse Finished Stock"
        breadcrumbs={[
          { label: "ERP", to: "/plastic-erp" },
          { label: "Production", to: "/plastic-erp/production" },
          { label: "WIP & FG" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "10px" }}>
            <Link to="/plastic-erp">
              <Button variant="secondary">ERP Dashboard</Button>
            </Link>
            {activeTab === "fg" && (
              <Button variant="primary" onClick={() => setShowFgModal(true)}>
                + Add Finished Good Item
              </Button>
            )}
          </div>
        }
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg("")} />}

      {/* KPI Cards */}
      <div className="sb-kpis-grid" style={{ marginBottom: "24px" }}>
        <KpiCard
          label="Current WIP Volume"
          value={`${Number(wipSummary.totalWipKg || 0).toLocaleString()} KG`}
          subtext={`${wipSummary.totalBatchesInWip} batches processing`}
          accent="blue"
        />
        <KpiCard
          label="Finished Goods in Stock"
          value={`${Number(fgSummary.totalFgStockKg || 0).toLocaleString()} KG`}
          subtext={`${fgSummary.totalProducts} catalog products`}
          accent="teal"
        />
        <KpiCard
          label="Production Lots Ready"
          value={fgLots.length}
          subtext="Batch-traceable output lots"
          accent="navy"
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: WIP TRACKING */}
      {activeTab === "wip" && (
        <Card noPadding>
          <DataTable
            headers={[
              "Batch",
              "Product",
              "Current Stage",
              "Location",
              "Machine",
              "WIP Quantity",
              "Status",
              "Actions",
            ]}
          >
            {wipItems.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                  No active WIP items found on shop floor.
                </td>
              </tr>
            ) : (
              wipItems.map((w) => (
                <tr key={w.id}>
                  <td><strong>{w.batch_no}</strong></td>
                  <td>{w.product_name}</td>
                  <td>
                    <span className={`wip-stage-pill stage-${w.stage?.toLowerCase()}`}>{w.stage}</span>
                  </td>
                  <td>{w.location}</td>
                  <td>{w.machine_name || "General Floor"}</td>
                  <td>
                    <strong>{Number(w.wip_quantity).toLocaleString()} {w.unit}</strong>
                  </td>
                  <td>
                    <StatusBadge status={w.status} />
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openUpdateWip(w)}
                    >
                      Update Stage 🔄
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>
      )}

      {/* TAB 2: FINISHED GOODS CATALOG & STOCK */}
      {activeTab === "fg" && (
        <Card noPadding>
          <DataTable
            headers={[
              "FG Code",
              "Product Name",
              "Polymer",
              "Grade / Color",
              "Current Stock",
              "Min Stock",
              "Std Cost",
              "Selling Price",
              "Warehouse Location",
            ]}
          >
            {finishedGoods.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                  No finished goods found in warehouse. Click &quot;Add Finished Good Item&quot;.
                </td>
              </tr>
            ) : (
              finishedGoods.map((fg) => (
                <tr key={fg.id}>
                  <td><strong>{fg.fg_code}</strong></td>
                  <td><strong>{fg.fg_name}</strong></td>
                  <td><span className="wip-polymer-pill">{fg.plastic_type}</span></td>
                  <td>{fg.grade || "-"} • {fg.color || "-"}</td>
                  <td>
                    <strong style={{ color: "var(--sb-success)" }}>
                      {Number(fg.current_stock).toLocaleString()} {fg.unit}
                    </strong>
                  </td>
                  <td>{Number(fg.minimum_stock).toLocaleString()} {fg.unit}</td>
                  <td>₹{Number(fg.standard_cost).toFixed(2)}</td>
                  <td>₹{Number(fg.selling_price).toFixed(2)}</td>
                  <td>{fg.warehouse_location}</td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>
      )}

      {/* TAB 3: FG PRODUCTION LOTS */}
      {activeTab === "lots" && (
        <Card noPadding>
          <DataTable
            headers={[
              "Lot Number",
              "Product",
              "Origin Batch",
              "Quantity Produced",
              "Production Date",
              "QC Status",
              "Dispatch Status",
            ]}
          >
            {fgLots.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                  No finished production lots generated yet.
                </td>
              </tr>
            ) : (
              fgLots.map((lot) => (
                <tr key={lot.id}>
                  <td><strong>{lot.lot_number}</strong></td>
                  <td>{lot.fg_name} ({lot.fg_code})</td>
                  <td>
                    <Link to={`/plastic-erp/traceability?batch=${lot.batch_no}`} style={{ color: "var(--sb-ocean)", fontWeight: 600 }}>
                      {lot.batch_no} 🔍
                    </Link>
                  </td>
                  <td><strong>{Number(lot.quantity).toLocaleString()} {lot.unit}</strong></td>
                  <td>{lot.production_date?.split("T")[0]}</td>
                  <td>
                    <StatusBadge status={lot.qc_status} />
                  </td>
                  <td>
                    <StatusBadge status={lot.dispatch_status} />
                  </td>
                </tr>
              ))
            )}
          </DataTable>
        </Card>
      )}

      {/* MODAL: UPDATE WIP STAGE */}
      <Modal
        isOpen={showWipModal && !!selectedWip}
        onClose={() => setShowWipModal(false)}
        title={`Update WIP Stage: ${selectedWip?.batch_no || ""}`}
      >
        <form onSubmit={handleUpdateWip} className="sb-form">
          <div className="sb-form-group">
            <label className="sb-label">Current Stage</label>
            <select
              className="sb-input"
              value={wipForm.stage}
              onChange={(e) => setWipForm({ ...wipForm, stage: e.target.value })}
            >
              <option value="SORTING">Sorting & Segregation</option>
              <option value="CRUSHING">Crushing & Shredding</option>
              <option value="WASHING">Washing & Friction Washer</option>
              <option value="EXTRUSION">Extrusion & Die Face Cutting</option>
              <option value="PELLETIZING">Pelletizing & Cooling</option>
              <option value="PACKING">Packing & Bagging</option>
            </select>
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Floor Location</label>
            <input
              type="text"
              className="sb-input"
              value={wipForm.location}
              onChange={(e) => setWipForm({ ...wipForm, location: e.target.value })}
            />
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Status</label>
            <select
              className="sb-input"
              value={wipForm.status}
              onChange={(e) => setWipForm({ ...wipForm, status: e.target.value })}
            >
              <option value="PROCESSING">Processing</option>
              <option value="HOLD">Hold</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setShowWipModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Update WIP
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ADD FINISHED GOOD ITEM */}
      <Modal
        isOpen={showFgModal}
        onClose={() => setShowFgModal(false)}
        title="Add Finished Good Product"
      >
        <form onSubmit={handleCreateFg} className="sb-form">
          <div className="sb-form-group">
            <label className="sb-label">Product Name *</label>
            <input
              type="text"
              required
              className="sb-input"
              value={fgForm.fg_name}
              onChange={(e) => setFgForm({ ...fgForm, fg_name: e.target.value })}
              placeholder="e.g. Recycled PP Granules Grade A"
            />
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Polymer Type</label>
              <select
                className="sb-input"
                value={fgForm.plastic_type}
                onChange={(e) => setFgForm({ ...fgForm, plastic_type: e.target.value })}
              >
                <option value="PP">PP (Polypropylene)</option>
                <option value="HDPE">HDPE</option>
                <option value="LDPE">LDPE</option>
                <option value="PET">PET</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Grade / Color</label>
              <input
                type="text"
                className="sb-input"
                value={fgForm.grade}
                onChange={(e) => setFgForm({ ...fgForm, grade: e.target.value })}
                placeholder="Grade A / Natural"
              />
            </div>
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Standard Cost / KG (₹)</label>
              <input
                type="number"
                step="0.01"
                className="sb-input"
                value={fgForm.standard_cost}
                onChange={(e) => setFgForm({ ...fgForm, standard_cost: e.target.value })}
              />
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Selling Price / KG (₹)</label>
              <input
                type="number"
                step="0.01"
                className="sb-input"
                value={fgForm.selling_price}
                onChange={(e) => setFgForm({ ...fgForm, selling_price: e.target.value })}
              />
            </div>
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Packing Information</label>
            <input
              type="text"
              className="sb-input"
              value={fgForm.packing_type}
              onChange={(e) => setFgForm({ ...fgForm, packing_type: e.target.value })}
              placeholder="e.g. 25 KG Bags with Liners"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setShowFgModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Product
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PlasticWipFg;
