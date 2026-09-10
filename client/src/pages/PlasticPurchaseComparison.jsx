import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  Card,
  Button,
  StatusBadge,
  EmptyState,
} from "../components";
import "./PlasticPurchaseComparison.css";

function PlasticPurchaseComparison() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [comparisons, setComparisons] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [convertingId, setConvertingId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [compRes, rmRes] = await Promise.all([
        API.get("/plastic-erp/procurement/quotations/compare", {
          params: { raw_material_id: selectedMaterial || undefined },
        }),
        API.get("/raw-materials"),
      ]);

      setComparisons(compRes.data?.data || []);
      setRawMaterials(rmRes.data?.data || rmRes.data || []);
    } catch (err) {
      console.error("Error loading quotation comparison:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedMaterial]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectAndOrder = async (quoteId, supplierName) => {
    if (!window.confirm(`Select ${supplierName} and generate Purchase Order? This will convert the quote into a formal PO.`)) return;
    try {
      setConvertingId(quoteId);
      const res = await API.post(`/plastic-erp/procurement/quotations/${quoteId}/convert-to-po`, {
        expected_delivery_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      });
      alert(res.data?.message || "Purchase order successfully generated!");
      navigate("/plastic-erp/purchase-orders");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to generate PO");
    } finally {
      setConvertingId(null);
    }
  };

  if (loading && comparisons.length === 0) {
    return <LoadingScreen title="Comparing Quotations..." subtitle="Computing vendor landed rates..." />;
  }

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Purchase Quotation Comparison"
        subtitle="Multi-vendor quotation analytics, effective landed rate comparison & intelligent supplier selection"
        badge="PROCUREMENT INTELLIGENCE"
        actions={
          <div className="sb-header-actions">
            <Button variant="secondary" size="md" onClick={fetchData} icon="🔄">
              Refresh Analysis
            </Button>
          </div>
        }
      />

      {/* Filter / Material Selector Card */}
      <Card className="sb-filter-card" noPadding>
        <div className="sb-filter-row">
          <div className="sb-filter-item">
            <label className="sb-filter-label">Filter By Raw Material:</label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="sb-select"
              style={{ minWidth: "260px" }}
            >
              <option value="">All Raw Materials</option>
              {rawMaterials.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  {rm.material_name} ({rm.plastic_type})
                </option>
              ))}
            </select>
          </div>
          <div className="sb-filter-tip">
            💡 Highlight tags display best commercial landed rate, fastest delivery lead time, and highest quality scores.
          </div>
        </div>
      </Card>

      {/* Comparison Sections by Material */}
      {comparisons.length === 0 ? (
        <Card>
          <EmptyState
            icon="⚖️"
            title="No competing quotations available"
            description="Create multiple supplier quotations for the same raw material to view side-by-side landed rate comparison and vendor scorecards."
            action={
              <Button
                variant="primary"
                onClick={() => navigate("/plastic-erp/supplier-quotations")}
              >
                Go to Supplier Quotations
              </Button>
            }
          />
        </Card>
      ) : (
        comparisons.map((group) => (
          <Card
            key={group.raw_material_id}
            className="comparison-material-card"
            title={
              <div className="comparison-card-title">
                <span>{group.material_name}</span>
                <span className="sb-badge sb-badge-teal">{group.plastic_type}</span>
              </div>
            }
            subtitle={`Code: ${group.material_code} • ${group.quotes.length} Competing Vendor Quote(s)`}
            noPadding
          >
            <div className="sb-table-responsive">
              <table className="sb-table comparison-table">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Quoted Rate</th>
                    <th>Disc %</th>
                    <th>GST %</th>
                    <th>Freight</th>
                    <th>Effective Landed / KG</th>
                    <th>Lead Time</th>
                    <th>Payment Terms</th>
                    <th>Quality</th>
                    <th>Delivery</th>
                    <th>Highlights</th>
                    <th>Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {group.quotes.map((q) => (
                    <tr key={q.id} className={q.is_best_commercial ? "highlight-best-row" : ""}>
                      <td>
                        <strong>{q.supplier_name}</strong>
                        <div className="sb-text-muted text-xs">{q.supplier_code} • Quote #{q.quotation_no}</div>
                      </td>
                      <td className="sb-font-semibold">₹{Number(q.rate).toFixed(2)}</td>
                      <td>{Number(q.discount_percent || 0)}%</td>
                      <td>{Number(q.tax_percent || 0)}%</td>
                      <td>₹{Number(q.freight_amount || 0).toFixed(0)}</td>
                      <td className="landed-rate-cell">
                        <strong>₹{Number(q.effective_landed_rate).toFixed(2)}</strong>
                      </td>
                      <td>{q.lead_time_days || 0} days</td>
                      <td>{q.payment_terms || "30 Days"}</td>
                      <td>
                        <StatusBadge
                          status={q.supplier_quality_score >= 90 ? "high" : "medium"}
                          variant={q.supplier_quality_score >= 90 ? "success" : "warning"}
                        >
                          {q.supplier_quality_score}%
                        </StatusBadge>
                      </td>
                      <td>
                        <StatusBadge
                          status={q.supplier_delivery_score >= 90 ? "high" : "medium"}
                          variant={q.supplier_delivery_score >= 90 ? "success" : "warning"}
                        >
                          {q.supplier_delivery_score}%
                        </StatusBadge>
                      </td>
                      <td>
                        <div className="tag-badges">
                          {q.is_lowest_rate && <span className="highlight-tag rate">🏆 Lowest Landed Rate</span>}
                          {q.is_fastest_delivery && <span className="highlight-tag speed">⚡ Fastest Delivery</span>}
                          {q.is_highest_quality && <span className="highlight-tag quality">⭐ High Quality</span>}
                        </div>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant={q.is_best_commercial ? "primary" : "secondary"}
                          disabled={convertingId === q.quotation_id}
                          loading={convertingId === q.quotation_id}
                          onClick={() => handleSelectAndOrder(q.quotation_id, q.supplier_name)}
                        >
                          Select & Order
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

export default PlasticPurchaseComparison;
