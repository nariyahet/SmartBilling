import { useState, useEffect, useCallback } from "react";
import API from "../api/axios";
import PlasticNavbar from "../components/PlasticNavbar";
import LoadingScreen from "../components/LoadingScreen";
import { PageHeader, Card, KpiCard, Button, StatusBadge, Modal } from "../components";
import "./PlasticGstReconciliation.css";

function PlasticGstReconciliation() {
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

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get("/plastic-erp/gst-reconciliation/items", {
        params: {
          return_period: returnPeriod,
          status: statusFilter,
        },
      });
      if (res.data?.success) {
        setItems(res.data.items || []);
        setSummary(res.data.summary || null);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load reconciliation items");
    } finally {
      setLoading(false);
    }
  }, [returnPeriod, statusFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleRunAutoMatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.post("/plastic-erp/gst-reconciliation/auto-match", {
        return_period: returnPeriod,
      });
      if (res.data?.success) {
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

      const res = await API.post("/plastic-erp/gst-reconciliation/items", payload);
      if (res.data?.success) {
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

  const filterStatuses = [
    "ALL",
    "MATCHED",
    "PARTIAL",
    "MISMATCH",
    "MISSING_IN_BOOKS",
    "MISSING_IN_PORTAL"
  ];

  return (
    <div className="sb-page-container">
      <PlasticNavbar />
      <main className="sb-main-content">
        <PageHeader
          title="GSTR-2B vs Books Reconciliation"
          subtitle="Cross-verify purchase bills against government portal returns to prevent ITC leakage and audit queries"
          breadcrumbs={[
            { label: "Plastic ERP", to: "/plastic-erp" },
            { label: "Accounting & GST", to: "/plastic-erp/accounting" },
            { label: "GST Reconciliation" },
          ]}
          actions={
            <div className="gstr2b-actions-row">
              <Button
                variant="outline"
                icon="➕"
                onClick={() => setShowAddModal(true)}
              >
                Add GSTR-2B Item
              </Button>
              <Button
                variant="primary"
                icon="⚡"
                onClick={handleRunAutoMatch}
                disabled={loading}
              >
                Run Auto-Match Engine
              </Button>
            </div>
          }
        />

        {/* Feedback alerts */}
        {successMsg && <div className="sb-alert-success">{successMsg}</div>}
        {error && <div className="sb-alert-danger">{error}</div>}

        {/* Summary KPIs */}
        {summary && (
          <div className="gstr2b-kpis-grid">
            <KpiCard
              title="Total Records"
              value={summary.totalRecords}
              subtitle="Reconciled purchase entries"
              icon="📑"
              color="navy"
            />
            <KpiCard
              title="Matched Exactly"
              value={summary.matched}
              subtitle="Portal and books in sync"
              icon="✅"
              color="teal"
            />
            <KpiCard
              title="Partial / Review"
              value={summary.partial}
              subtitle="Minor rounding / date differences"
              icon="⚠️"
              color="amber"
            />
            <KpiCard
              title="Mismatched"
              value={summary.mismatch}
              subtitle="Tax rate or amount variance"
              icon="🚫"
              color="blue"
            />
            <KpiCard
              title="Missing in Books"
              value={summary.missingInBooks}
              subtitle="On portal, not entered in ERP"
              icon="📥"
              color="amber"
            />
            <KpiCard
              title="Missing in Portal"
              value={summary.missingInPortal}
              subtitle="Entered in ERP, supplier not filed"
              icon="📤"
              color="blue"
            />
          </div>
        )}

        {/* Filter Toolbar Card */}
        <Card className="gstr2b-toolbar-card">
          <div className="gstr2b-toolbar-inner">
            <div className="gstr2b-status-pills">
              {filterStatuses.map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`status-pill-btn ${statusFilter === st ? "active" : ""}`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            <div className="gstr2b-period-control">
              <label htmlFor="ret-period" className="period-label">Period:</label>
              <input
                id="ret-period"
                type="text"
                value={returnPeriod}
                placeholder="YYYY-MM"
                onChange={(e) => setReturnPeriod(e.target.value)}
                className="sb-input period-input"
              />
              <Button variant="ghost" size="sm" icon="🔄" onClick={fetchItems} title="Reload" />
            </div>
          </div>
        </Card>

        {/* Data Table */}
        <Card
          title="Reconciliation Audit Register"
          subtitle={`Displaying ${items.length} items for tax period ${returnPeriod}`}
        >
          {loading ? (
            <LoadingScreen message="Reconciling portal and general ledger..." />
          ) : (
            <div className="gstr2b-table-wrapper">
              <table className="gstr2b-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Supplier GSTIN & Name</th>
                    <th>Invoice No & Date</th>
                    <th className="cell-right">Portal Taxable</th>
                    <th className="cell-right">Books Taxable</th>
                    <th className="cell-right">Portal Tax</th>
                    <th className="cell-right">Books Tax</th>
                    <th className="cell-right">Difference</th>
                    <th>Discrepancy Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="gstr2b-table-empty">
                        <div className="empty-state">
                          <span className="empty-icon">🔍</span>
                          <p>No reconciliation items found for return period {returnPeriod}.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => {
                      const statusStr = (row.status || row.reconciliation_status || "MISMATCH").toUpperCase();
                      const diff = Number(row.difference_amount ?? row.tax_diff ?? 0);
                      return (
                        <tr key={row.id}>
                          <td>
                            <StatusBadge status={statusStr} />
                          </td>
                          <td>
                            <strong>{row.books_supplier_name || row.portal_supplier_name || row.supplier_name || "Supplier"}</strong>
                            <div className="sub-text font-mono">{row.supplier_gstin || row.portal_supplier_gstin || "—"}</div>
                          </td>
                          <td>
                            <strong>{row.invoice_number || row.portal_invoice_no || row.bill_number || "—"}</strong>
                            <div className="sub-text">{(row.invoice_date || row.portal_invoice_date || row.bill_date)?.split("T")[0]}</div>
                          </td>
                          <td className="cell-right">₹{Number(row.portal_taxable_value || 0).toLocaleString("en-IN")}</td>
                          <td className="cell-right">₹{Number(row.books_taxable_value || 0).toLocaleString("en-IN")}</td>
                          <td className="cell-right">₹{Number(row.portal_tax_amount || row.portal_total_tax || 0).toLocaleString("en-IN")}</td>
                          <td className="cell-right">₹{Number(row.books_tax_amount || row.books_total_tax || 0).toLocaleString("en-IN")}</td>
                          <td className="cell-right">
                            <strong className={diff === 0 ? "text-teal" : diff > 0 ? "text-amber" : "text-danger"}>
                              {diff === 0 ? "₹0.00" : `₹${diff.toFixed(2)}`}
                            </strong>
                          </td>
                          <td>
                            <span className="sub-text">
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
          )}
        </Card>

        {/* Modal: Add Portal Item */}
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add GSTR-2B Portal Entry"
          subtitle="Record an entry directly from GST portal GSTR-2B statement"
          size="md"
        >
          <form onSubmit={handleAddPortalItem} className="gstr2b-modal-form">
            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">Return Period (YYYY-MM)*</label>
                <input
                  type="text"
                  name="return_period"
                  value={formData.return_period}
                  onChange={handleInputChange}
                  className="sb-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Supplier GSTIN*</label>
                <input
                  type="text"
                  name="supplier_gstin"
                  placeholder="e.g. 24ABCDE1234F1Z5"
                  value={formData.supplier_gstin}
                  onChange={handleInputChange}
                  className="sb-input"
                  required
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">Supplier Legal Name*</label>
                <input
                  type="text"
                  name="supplier_name"
                  placeholder="e.g. Reliance Petrochemicals"
                  value={formData.supplier_name}
                  onChange={handleInputChange}
                  className="sb-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Invoice Number*</label>
                <input
                  type="text"
                  name="invoice_no"
                  placeholder="e.g. INV-9901"
                  value={formData.invoice_no}
                  onChange={handleInputChange}
                  className="sb-input"
                  required
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">Invoice Date*</label>
                <input
                  type="date"
                  name="invoice_date"
                  value={formData.invoice_date}
                  onChange={handleInputChange}
                  className="sb-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="sb-label">Invoice Total Value (₹)*</label>
                <input
                  type="number"
                  step="0.01"
                  name="invoice_value"
                  value={formData.invoice_value}
                  onChange={handleInputChange}
                  className="sb-input"
                  required
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">Taxable Amount (₹)*</label>
                <input
                  type="number"
                  step="0.01"
                  name="taxable_value"
                  value={formData.taxable_value}
                  onChange={handleInputChange}
                  className="sb-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="sb-label">CGST (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  name="cgst"
                  value={formData.cgst}
                  onChange={handleInputChange}
                  className="sb-input"
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="sb-label">SGST (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  name="sgst"
                  value={formData.sgst}
                  onChange={handleInputChange}
                  className="sb-input"
                />
              </div>
              <div className="form-group">
                <label className="sb-label">IGST (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  name="igst"
                  value={formData.igst}
                  onChange={handleInputChange}
                  className="sb-input"
                />
              </div>
            </div>

            <div className="modal-actions-bar">
              <Button
                variant="outline"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
              >
                Save Entry
              </Button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}

export default PlasticGstReconciliation;
