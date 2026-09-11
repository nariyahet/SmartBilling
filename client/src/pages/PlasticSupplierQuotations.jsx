import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  SearchInput,
} from "../components";
import "./PlasticSupplierQuotations.css";

function PlasticSupplierQuotations() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [requisitions, setRequisitions] = useState([]);

  // Filters
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    supplier_id: "",
    requisition_id: "",
    quotation_date: new Date().toISOString().slice(0, 10),
    validity_date: "",
    reference_no: "",
    payment_terms: "30 Days Net",
    delivery_terms: "Ex-Plant",
    lead_time_days: 3,
    notes: "",
    items: [
      { raw_material_id: "", quantity: 1000, unit: "KG", rate: 45.0, discount_percent: 0, tax_percent: 18, freight_amount: 0 },
    ],
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [qRes, sRes, rmRes, prRes] = await Promise.all([
        API.get("/plastic-erp/procurement/quotations", {
          params: {
            supplier_id: supplierFilter,
            status: statusFilter,
            search: searchQuery,
          },
        }),
        API.get("/suppliers"),
        API.get("/raw-materials"),
        API.get("/plastic-erp/procurement/requisitions?status=APPROVED"),
      ]);

      const quoteList = Array.isArray(qRes.data?.data)
        ? qRes.data.data
        : Array.isArray(qRes.data?.quotations)
        ? qRes.data.quotations
        : Array.isArray(qRes.data)
        ? qRes.data
        : [];
      const suppList = Array.isArray(sRes.data?.suppliers)
        ? sRes.data.suppliers
        : Array.isArray(sRes.data?.data)
        ? sRes.data.data
        : Array.isArray(sRes.data)
        ? sRes.data
        : [];
      const rmList = Array.isArray(rmRes.data?.raw_materials)
        ? rmRes.data.raw_materials
        : Array.isArray(rmRes.data?.data)
        ? rmRes.data.data
        : Array.isArray(rmRes.data)
        ? rmRes.data
        : [];
      const prList = Array.isArray(prRes.data?.data)
        ? prRes.data.data
        : Array.isArray(prRes.data?.requisitions)
        ? prRes.data.requisitions
        : Array.isArray(prRes.data)
        ? prRes.data
        : [];

      setQuotations(quoteList);
      setSuppliers(suppList);
      setRawMaterials(rmList);
      setRequisitions(prList);
    } catch (err) {
      console.error("Error loading quotations:", err);
      setQuotations([]);
      setSuppliers([]);
      setRawMaterials([]);
      setRequisitions([]);
    } finally {
      setLoading(false);
    }
  }, [supplierFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { raw_material_id: "", quantity: 1000, unit: "KG", rate: 45.0, discount_percent: 0, tax_percent: 18, freight_amount: 0 },
      ],
    }));
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index][field] = value;
      return { ...prev, items: updated };
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplier_id) {
      alert("Please select a supplier");
      return;
    }
    try {
      setSubmitting(true);
      await API.post("/plastic-erp/procurement/quotations", formData);
      setCreateModalOpen(false);
      setFormData({
        supplier_id: "",
        requisition_id: "",
        quotation_date: new Date().toISOString().slice(0, 10),
        validity_date: "",
        reference_no: "",
        payment_terms: "30 Days Net",
        delivery_terms: "Ex-Plant",
        lead_time_days: 3,
        notes: "",
        items: [{ raw_material_id: "", quantity: 1000, unit: "KG", rate: 45.0, discount_percent: 0, tax_percent: 18, freight_amount: 0 }],
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create quotation");
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = async (quote) => {
    try {
      const res = await API.get(`/plastic-erp/procurement/quotations/${quote.id}`);
      setSelectedQuote(res.data?.data);
      setDetailsModalOpen(true);
    } catch (err) {
      alert("Failed to load quotation details");
    }
  };

  const handleConvertToPO = async (quoteId) => {
    if (!window.confirm("Convert this quotation into a Purchase Order? This will mark other quotes for this request as rejected.")) return;
    try {
      const res = await API.post(`/plastic-erp/procurement/quotations/${quoteId}/convert-to-po`, {
        expected_delivery_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      });
      alert(res.data?.message || "Purchase order generated!");
      fetchData();
      navigate("/plastic-erp/purchase-orders");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to convert quotation");
    }
  };

  // KPIs
  const totalCount = Array.isArray(quotations) ? quotations.length : 0;
  const activeCount = Array.isArray(quotations) ? quotations.filter((q) => q.status === "PENDING" || q.status === "ACCEPTED").length : 0;
  const acceptedCount = Array.isArray(quotations) ? quotations.filter((q) => q.status === "ACCEPTED").length : 0;

  if (loading && (!Array.isArray(quotations) || quotations.length === 0)) {
    return <LoadingScreen title="Loading Quotations..." subtitle="Fetching supplier quotes..." />;
  }

  const columns = [
    {
      key: "quotation_no",
      title: "Quote #",
      render: (val) => <span className="sb-font-semibold sb-text-primary">{val}</span>,
    },
    {
      key: "quotation_date",
      title: "Date",
      render: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : "-"),
    },
    {
      key: "supplier_name",
      title: "Supplier",
      render: (val, row) => (
        <div>
          <strong>{val}</strong>
          <div className="sb-text-muted text-xs">{row.supplier_code} • {row.supplier_mobile || "Kim"}</div>
        </div>
      ),
    },
    {
      key: "validity_date",
      title: "Validity",
      render: (val) => (val ? new Date(val).toLocaleDateString("en-IN") : "Open"),
    },
    {
      key: "lead_time_days",
      title: "Lead Time",
      render: (val) => `${val || 0} days`,
    },
    {
      key: "payment_terms",
      title: "Payment Terms",
      render: (val) => val || "Standard",
    },
    {
      key: "grand_total",
      title: "Grand Total",
      render: (val) => (
        <span className="sb-font-semibold">
          ₹{Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: "actions",
      title: "Actions",
      render: (_, q) => (
        <div className="sb-action-btn-group">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openDetails(q)}
            title="View Quote Details"
          >
            View
          </Button>
          {q.status === "PENDING" && (
            <Button
              size="sm"
              variant="teal"
              onClick={() => handleConvertToPO(q.id)}
              title="Accept & Convert to PO"
            >
              Accept & Order
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="sb-page-container">
      <PageHeader
        title="Supplier Quotations"
        subtitle="Manage vendor price quotes, commercial terms, landed rate calculations & order generation"
        badge="PROCUREMENT & SOURCING"
        actions={
          <div className="sb-header-actions">
            <Link to="/plastic-erp/purchase-comparison">
              <Button variant="secondary" size="md" icon="⚖️">
                Compare Quotations
              </Button>
            </Link>
            <Button
              variant="primary"
              size="md"
              icon="+"
              onClick={() => setCreateModalOpen(true)}
            >
              New Quotation
            </Button>
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div className="sb-kpi-grid">
        <KpiCard
          title="Total Quotations"
          value={totalCount}
          accent="blue"
          icon="🏷️"
          supportingText="Vendor submissions"
        />
        <KpiCard
          title="Active / Under Review"
          value={activeCount}
          accent="amber"
          icon="⏳"
          supportingText="Available for comparison"
        />
        <KpiCard
          title="Accepted Quotes"
          value={acceptedCount}
          accent="green"
          icon="✅"
          supportingText="Converted to Purchase Orders"
        />
      </div>

      {/* Filter Bar */}
      <Card className="sb-filter-card" noPadding>
        <div className="sb-filter-row">
          <div className="sb-filter-item search-grow">
            <SearchInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quote #, supplier, reference..."
            />
          </div>
          <div className="sb-filter-item">
            <label className="sb-filter-label">Supplier:</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="sb-select"
            >
              <option value="ALL">All Suppliers</option>
              {(Array.isArray(suppliers) ? suppliers : []).map((s) => (
                <option key={s.id} value={s.id}>{s.supplier_name}</option>
              ))}
            </select>
          </div>
          <div className="sb-filter-item">
            <label className="sb-filter-label">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="sb-select"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Quotations Table */}
      <Card noPadding>
        <DataTable
          columns={columns}
          data={quotations}
          loading={loading}
          emptyMessage="No supplier quotations found."
        />
      </Card>

      {/* Create Quotation Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Record Supplier Quotation"
        subtitle="Log vendor quotation with commercial terms, taxes, freight and landed rates"
        size="lg"
        footer={
          <div className="sb-modal-footer-actions">
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateSubmit}
              loading={submitting}
            >
              Save Quotation
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="sb-form-grid-3">
            <div className="sb-form-group">
              <label>Supplier *</label>
              <select
                required
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="sb-select"
              >
                <option value="">Select Supplier</option>
                {(Array.isArray(suppliers) ? suppliers : []).map((s) => (
                  <option key={s.id} value={s.id}>{s.supplier_name} ({s.supplier_code})</option>
                ))}
              </select>
            </div>
            <div className="sb-form-group">
              <label>Link to PR (Optional)</label>
              <select
                value={formData.requisition_id}
                onChange={(e) => setFormData({ ...formData, requisition_id: e.target.value })}
                className="sb-select"
              >
                <option value="">None (Standalone Quote)</option>
                {(Array.isArray(requisitions) ? requisitions : []).map((pr) => (
                  <option key={pr.id} value={pr.id}>{pr.pr_no} - {pr.requester_name}</option>
                ))}
              </select>
            </div>
            <div className="sb-form-group">
              <label>Quotation Date</label>
              <input
                type="date"
                value={formData.quotation_date}
                onChange={(e) => setFormData({ ...formData, quotation_date: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Validity Date</label>
              <input
                type="date"
                value={formData.validity_date}
                onChange={(e) => setFormData({ ...formData, validity_date: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Supplier Reference #</label>
              <input
                type="text"
                placeholder="e.g. VEN-QT-889"
                value={formData.reference_no}
                onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Lead Time (Days)</label>
              <input
                type="number"
                min="0"
                value={formData.lead_time_days}
                onChange={(e) => setFormData({ ...formData, lead_time_days: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Payment Terms</label>
              <input
                type="text"
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                className="sb-input"
              />
            </div>
            <div className="sb-form-group">
              <label>Delivery Terms</label>
              <input
                type="text"
                value={formData.delivery_terms}
                onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
                className="sb-input"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="sb-section-header">
            <h4 className="sb-section-title">Quotation Material Rates</h4>
            <Button size="sm" variant="secondary" icon="+" onClick={handleAddItem}>
              Add Material Line
            </Button>
          </div>

          <div className="sb-table-responsive">
            <table className="sb-table">
              <thead>
                <tr>
                  <th style={{ width: "24%" }}>Material *</th>
                  <th style={{ width: "12%" }}>Qty</th>
                  <th style={{ width: "12%" }}>Rate (₹)</th>
                  <th style={{ width: "10%" }}>Disc %</th>
                  <th style={{ width: "10%" }}>GST %</th>
                  <th style={{ width: "12%" }}>Freight (₹)</th>
                  <th style={{ width: "12%" }}>Landed / KG</th>
                  <th style={{ width: "8%" }}></th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, idx) => {
                  const qty = Number(item.quantity || 0);
                  const rate = Number(item.rate || 0);
                  const disc = Number(item.discount_percent || 0);
                  const tax = Number(item.tax_percent || 0);
                  const freight = Number(item.freight_amount || 0);

                  const taxable = (qty * rate) * (1 - disc / 100);
                  const total = taxable * (1 + tax / 100) + freight;
                  const landedPerKg = qty > 0 ? total / qty : 0;

                  return (
                    <tr key={idx}>
                      <td>
                        <select
                          required
                          value={item.raw_material_id}
                          onChange={(e) => handleItemChange(idx, "raw_material_id", e.target.value)}
                          className="sb-select"
                        >
                          <option value="">Select Material</option>
                          {(Array.isArray(rawMaterials) ? rawMaterials : []).map((m) => (
                            <option key={m.id} value={m.id}>{m.material_name} ({m.plastic_type})</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          className="sb-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                          className="sb-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          value={item.discount_percent}
                          onChange={(e) => handleItemChange(idx, "discount_percent", e.target.value)}
                          className="sb-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          value={item.tax_percent}
                          onChange={(e) => handleItemChange(idx, "tax_percent", e.target.value)}
                          className="sb-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="1"
                          value={item.freight_amount}
                          onChange={(e) => handleItemChange(idx, "freight_amount", e.target.value)}
                          className="sb-input"
                        />
                      </td>
                      <td className="sb-font-semibold sb-text-primary">
                        ₹{landedPerKg.toFixed(2)}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={formData.items.length <= 1}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>
      </Modal>

      {/* Quote Details View Modal */}
      <Modal
        isOpen={detailsModalOpen && Boolean(selectedQuote)}
        onClose={() => setDetailsModalOpen(false)}
        title={`Quotation #${selectedQuote?.quotation_no || ""}`}
        subtitle="Detailed rate structure and landed cost computation"
        size="lg"
        footer={
          <div className="sb-modal-footer-actions">
            {selectedQuote?.status === "PENDING" && (
              <Button
                variant="teal"
                onClick={() => {
                  setDetailsModalOpen(false);
                  handleConvertToPO(selectedQuote.id);
                }}
              >
                Accept & Order
              </Button>
            )}
            <Button variant="secondary" onClick={() => setDetailsModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedQuote && (
          <div>
            <div className="sb-detail-summary-grid">
              <div><span className="sb-detail-label">Supplier:</span> <strong>{selectedQuote.supplier_name}</strong></div>
              <div><span className="sb-detail-label">Date:</span> <strong>{selectedQuote.quotation_date ? selectedQuote.quotation_date.slice(0, 10) : "-"}</strong></div>
              <div><span className="sb-detail-label">Validity:</span> <strong>{selectedQuote.validity_date ? selectedQuote.validity_date.slice(0, 10) : "Open"}</strong></div>
              <div><span className="sb-detail-label">Lead Time:</span> <strong>{selectedQuote.lead_time_days} days</strong></div>
              <div><span className="sb-detail-label">Payment Terms:</span> <strong>{selectedQuote.payment_terms}</strong></div>
              <div><span className="sb-detail-label">Status:</span> <StatusBadge status={selectedQuote.status} /></div>
            </div>

            <h4 className="sb-section-title">Itemized Materials & Landed Rates</h4>
            <div className="sb-table-responsive">
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Base Rate</th>
                    <th>Discount</th>
                    <th>Tax</th>
                    <th>Freight</th>
                    <th>Total</th>
                    <th>Landed / KG</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedQuote.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="sb-font-semibold">{item.material_name}</td>
                      <td>{Number(item.quantity).toLocaleString()} {item.unit}</td>
                      <td>₹{Number(item.rate).toFixed(2)}</td>
                      <td>{item.discount_percent}%</td>
                      <td>{item.tax_percent}%</td>
                      <td>₹{Number(item.freight_amount || 0).toFixed(2)}</td>
                      <td className="sb-font-semibold">₹{Number(item.total_amount).toFixed(2)}</td>
                      <td className="sb-font-semibold sb-text-primary">₹{Number(item.landed_rate_per_unit).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="quote-totals-breakdown">
              <div><span>Subtotal:</span> <strong>₹{Number(selectedQuote.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
              <div><span>Tax Amount:</span> <strong>₹{Number(selectedQuote.tax_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
              <div><span>Freight Amount:</span> <strong>₹{Number(selectedQuote.freight_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
              <div className="quote-grand-total"><span>Grand Total:</span> <strong>₹{Number(selectedQuote.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PlasticSupplierQuotations;
