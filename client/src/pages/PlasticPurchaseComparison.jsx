import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
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

      setComparisons(compRes.data.data || []);
      setRawMaterials(rmRes.data.data || rmRes.data || []);
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
      alert(res.data.message || "Purchase order successfully generated!");
      navigate("/plastic-erp/purchase-orders");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to generate PO");
    } finally {
      setConvertingId(null);
    }
  };

  if (loading && comparisons.length === 0) return <LoadingScreen />;

  return (
    <div className="plastic-page-container">
      <PlasticNavbar />
      <div className="procurement-main">
        {/* Header */}
        <div className="procurement-header">
          <div>
            <h1 className="procurement-title">⚖️ Purchase Quotation Comparison</h1>
            <p className="procurement-subtitle">
              Multi-vendor quotation analytics, effective landed rate comparison & intelligent supplier selection
            </p>
          </div>
        </div>

        {/* Filter / Material Selector */}
        <div className="procurement-filters-bar">
          <div className="filter-group">
            <label>Compare By Raw Material:</label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="procurement-select"
            >
              <option value="">All Raw Materials</option>
              {rawMaterials.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  {rm.material_name} ({rm.plastic_type})
                </option>
              ))}
            </select>
          </div>
          <span className="comparison-tip">
            💡 Highlight tags display best commercial rate, fastest delivery lead time, and highest quality scores.
          </span>
        </div>

        {/* Comparison Sections by Material */}
        {comparisons.length === 0 ? (
          <div className="procurement-table-card p-8 text-center text-muted">
            <p>No competing quotations available for comparison.</p>
            <p className="text-sm mt-2">Create multiple supplier quotations for the same raw material to view side-by-side analysis.</p>
          </div>
        ) : (
          comparisons.map((group) => (
            <div key={group.raw_material_id} className="material-comparison-card mb-8">
              <div className="material-comparison-header">
                <div>
                  <h3 className="material-title">
                    {group.material_name} <span className="badge-type">{group.plastic_type}</span>
                  </h3>
                  <span className="text-muted text-sm">Code: {group.material_code} • {group.quotes.length} Competing Vendor Quote(s)</span>
                </div>
              </div>

              <div className="table-responsive">
                <table className="procurement-table comparison-table">
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
                      <th>Quality Score</th>
                      <th>Delivery Score</th>
                      <th>Commercial Highlights</th>
                      <th>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.quotes.map((q) => (
                      <tr key={q.id} className={q.is_best_commercial ? "highlight-best-row" : ""}>
                        <td>
                          <strong>{q.supplier_name}</strong>
                          <div className="text-muted text-xs">{q.supplier_code} • Quote #{q.quotation_no}</div>
                        </td>
                        <td className="font-semibold">₹{Number(q.rate).toFixed(2)}</td>
                        <td>{Number(q.discount_percent || 0)}%</td>
                        <td>{Number(q.tax_percent || 0)}%</td>
                        <td>₹{Number(q.freight_amount || 0).toFixed(0)}</td>
                        <td className="landed-rate-cell">
                          <strong>₹{Number(q.effective_landed_rate).toFixed(2)}</strong>
                        </td>
                        <td>{q.lead_time_days || 0} days</td>
                        <td>{q.payment_terms || "30 Days"}</td>
                        <td>
                          <span className={`score-badge ${q.supplier_quality_score >= 90 ? "high" : "medium"}`}>
                            {q.supplier_quality_score}%
                          </span>
                        </td>
                        <td>
                          <span className={`score-badge ${q.supplier_delivery_score >= 90 ? "high" : "medium"}`}>
                            {q.supplier_delivery_score}%
                          </span>
                        </td>
                        <td>
                          <div className="tag-badges">
                            {q.is_lowest_rate && <span className="highlight-tag rate">🏆 Lowest Landed Rate</span>}
                            {q.is_fastest_delivery && <span className="highlight-tag speed">⚡ Fastest Lead Time</span>}
                            {q.is_highest_quality && <span className="highlight-tag quality">⭐ High Quality</span>}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-select-vendor"
                            disabled={convertingId === q.quotation_id}
                            onClick={() => handleSelectAndOrder(q.quotation_id, q.supplier_name)}
                          >
                            {convertingId === q.quotation_id ? "Processing..." : "Select & Issue PO"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default PlasticPurchaseComparison;
