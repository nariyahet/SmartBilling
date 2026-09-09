import React, { useState, useEffect } from "react";
import axios from "axios";
import PlasticNavbar from "../components/PlasticNavbar";
import "./PlasticGstReconciliation.css";

const API_BASE = "http://localhost:5000/api/plastic-erp/gst-reconciliation";

const PlasticGstReconciliation = () => {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [returnPeriod, setReturnPeriod] = useState("2026-09");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form for portal item
  const [formData, setFormData] = useState({
    return_period: "2026-09",
    supplier_gstin: "",
    supplier_name: "",
    invoice_no: "",
    invoice_date: new Date().toISOString().split("T")[0],
    invoice_value: "",
    taxable_value: "",
    igst: "0",
    cgst: "0",
    sgst: "0",
    itc_available: "YES",
  });

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchItems();
  }, [statusFilter, returnPeriod]);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/items`, {
        params: {
          return_period: returnPeriod,
          status: statusFilter,
        },
        headers,
      });
      if (res.data.success) {
        setItems(res.data.items || []);
        setSummary(res.data.summary || null);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load reconciliation items");
    } finally {
      setLoading(false);
    }
  };

  const handleRunAutoMatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(
        `${API_BASE}/auto-match`,
        { return_period: returnPeriod },
        { headers }
      );
      if (res.data.success) {
        setSuccessMsg(res.data.message || "Auto-reconciliation finished successfully!");
        setTimeout(() => setSuccessMsg(null), 4000);
        fetchItems();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to run auto-match");
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddPortalItem = async (e) => {
    e.preventDefault();
    try {
      const totalTax = Number(formData.cgst || 0) + Number(formData.sgst || 0) + Number(formData.igst || 0);
      const payload = {
        supplier_gstin: formData.supplier_gstin,
        invoice_number: formData.invoice_no,
        invoice_date: formData.invoice_date,
        portal_taxable_value: Number(formData.taxable_value || 0),
        portal_tax_amount: totalTax,
        notes: formData.supplier_name ? `Supplier: ${formData.supplier_name}` : "Portal GSTR-2B entry",
      };

      const res = await axios.post(`${API_BASE}/items`, payload, { headers });
      if (res.data.success) {
        setSuccessMsg("GSTR-2B entry added successfully!");
        setShowAddModal(false);
        setFormData({
          return_period: returnPeriod,
          supplier_gstin: "",
          supplier_name: "",
          invoice_no: "",
          invoice_date: new Date().toISOString().split("T")[0],
          invoice_value: "",
          taxable_value: "",
          igst: "0",
          cgst: "0",
          sgst: "0",
          itc_available: "YES",
        });
        setTimeout(() => setSuccessMsg(null), 3000);
        fetchItems();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add portal item");
    }
  };

  return (
    <div className="plastic-gst-recon-page">
      <PlasticNavbar />
      <div className="recon-container">
        {/* Header */}
        <div className="recon-header">
          <div>
            <span className="badge-phase">PHASE 5: STATUTORY COMPLIANCE</span>
            <h1 className="page-title">🔍 GSTR-2B vs Books Reconciliation</h1>
            <p className="page-subtitle">
              Verify purchase bills against government portal data to prevent input credit leakage and audit mismatches.
            </p>
          </div>
          <div className="recon-actions">
            <button className="btn-secondary" onClick={() => setShowAddModal(true)}>
              ➕ Add GSTR-2B Item
            </button>
            <button className="btn-primary" onClick={handleRunAutoMatch} disabled={loading}>
              ⚡ Run Auto-Match Engine
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="recon-toolbar">
          <div className="status-filters">
            {["ALL", "MATCHED", "PARTIAL", "MISMATCH", "MISSING_IN_BOOKS", "MISSING_IN_PORTAL"].map((st) => (
              <button
                key={st}
                className={`filter-btn ${statusFilter === st ? "active" : ""}`}
                onClick={() => setStatusFilter(st)}
              >
                {st.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="period-box">
            <label>Return Period:</label>
            <input
              type="text"
              value={returnPeriod}
              placeholder="YYYY-MM"
              onChange={(e) => setReturnPeriod(e.target.value)}
              className="period-input"
            />
            <button className="btn-icon" onClick={fetchItems} title="Reload">🔄</button>
          </div>
        </div>

        {/* Feedback alerts */}
        {successMsg && <div className="alert success">{successMsg}</div>}
        {error && <div className="alert error">{error}</div>}

        {/* KPIs */}
        {summary && (
          <div className="summary-grid">
            <div className="sum-card">
              <span className="sum-title">Total Records</span>
              <span className="sum-val">{summary.totalRecords}</span>
            </div>
            <div className="sum-card green">
              <span className="sum-title">Matched</span>
              <span className="sum-val text-green">{summary.matched}</span>
            </div>
            <div className="sum-card yellow">
              <span className="sum-title">Partial / Under Review</span>
              <span className="sum-val text-yellow">{summary.partial}</span>
            </div>
            <div className="sum-card red">
              <span className="sum-title">Mismatched</span>
              <span className="sum-val text-red">{summary.mismatch}</span>
            </div>
            <div className="sum-card">
              <span className="sum-title">Missing in Books</span>
              <span className="sum-val">{summary.missingInBooks}</span>
            </div>
            <div className="sum-card">
              <span className="sum-title">Missing in Portal</span>
              <span className="sum-val">{summary.missingInPortal}</span>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="recon-card">
          <div className="table-wrapper">
            <table className="recon-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Supplier GSTIN / Name</th>
                  <th>Invoice No & Date</th>
                  <th>Portal Taxable</th>
                  <th>Books Taxable</th>
                  <th>Portal Tax</th>
                  <th>Books Tax</th>
                  <th>Difference</th>
                  <th>Discrepancy / Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" className="text-center py-4">Reconciling records...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan="9" className="text-center py-4 text-muted">No reconciliation items found for this period.</td></tr>
                ) : (
                  items.map((row) => {
                    const statusStr = (row.status || row.reconciliation_status || "MISMATCH").toUpperCase();
                    const diff = Number(row.difference_amount ?? row.tax_diff ?? 0);
                    return (
                      <tr key={row.id}>
                        <td>
                          <span className={`recon-badge status-${statusStr.toLowerCase()}`}>
                            {statusStr}
                          </span>
                        </td>
                        <td>
                          <div><strong>{row.books_supplier_name || row.portal_supplier_name || row.supplier_name || "Supplier"}</strong></div>
                          <code className="gstin-tag">{row.supplier_gstin || row.portal_supplier_gstin || "—"}</code>
                        </td>
                        <td>
                          <div><strong>{row.invoice_number || row.portal_invoice_no || row.bill_number || "—"}</strong></div>
                          <div className="date-sub">{(row.invoice_date || row.portal_invoice_date || row.bill_date)?.split("T")[0]}</div>
                        </td>
                        <td>₹{Number(row.portal_taxable_value || 0).toLocaleString()}</td>
                        <td>₹{Number(row.books_taxable_value || 0).toLocaleString()}</td>
                        <td>₹{Number(row.portal_tax_amount || row.portal_total_tax || 0).toLocaleString()}</td>
                        <td>₹{Number(row.books_tax_amount || row.books_total_tax || 0).toLocaleString()}</td>
                        <td>
                          <span className={diff === 0 ? "diff-zero" : diff > 0 ? "diff-pos" : "diff-neg"}>
                            {diff === 0 ? "₹0.00" : `₹${diff.toFixed(2)}`}
                          </span>
                        </td>
                        <td>
                          <span className="discrepancy-text">
                            {row.notes || row.discrepancy_reason || (statusStr === "MATCHED" ? "Matched with books" : "Mismatch under review")}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Add Portal Item */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-box">
              <div className="modal-header">
                <h3>Add GSTR-2B Portal Entry</h3>
                <button className="btn-close" onClick={() => setShowAddModal(false)}>✕</button>
              </div>
              <form onSubmit={handleAddPortalItem} className="modal-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Return Period (YYYY-MM)*</label>
                    <input
                      type="text"
                      name="return_period"
                      value={formData.return_period}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Supplier GSTIN*</label>
                    <input
                      type="text"
                      name="supplier_gstin"
                      placeholder="e.g. 27ABCDE1234F1Z5"
                      value={formData.supplier_gstin}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Supplier Legal Name*</label>
                    <input
                      type="text"
                      name="supplier_name"
                      placeholder="e.g. Reliance Industries Ltd"
                      value={formData.supplier_name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Invoice Number*</label>
                    <input
                      type="text"
                      name="invoice_no"
                      placeholder="e.g. INV-9901"
                      value={formData.invoice_no}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Invoice Date*</label>
                    <input
                      type="date"
                      name="invoice_date"
                      value={formData.invoice_date}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Invoice Total Value (₹)*</label>
                    <input
                      type="number"
                      step="0.01"
                      name="invoice_value"
                      value={formData.invoice_value}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Taxable Amount (₹)*</label>
                    <input
                      type="number"
                      step="0.01"
                      name="taxable_value"
                      value={formData.taxable_value}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>CGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="cgst"
                      value={formData.cgst}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>SGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="sgst"
                      value={formData.sgst}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>IGST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="igst"
                      value={formData.igst}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Entry
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlasticGstReconciliation;
