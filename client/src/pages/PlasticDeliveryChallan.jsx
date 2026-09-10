import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import LoadingScreen from "../components/LoadingScreen";
import {
  PageHeader,
  Card,
  DataTable,
  Modal,
  Button,
  StatusBadge,
} from "../components";
import "./PlasticDeliveryChallan.css";

function PlasticDeliveryChallan() {
  const [loading, setLoading] = useState(true);
  const [challans, setChallans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // New Challan Form
  const [formData, setFormData] = useState({
    customer_id: "",
    dispatch_id: "",
    vehicle_number: "",
    driver_name: "",
    driver_mobile: "",
    transporter: "",
    eway_bill_no: "",
    challan_date: new Date().toISOString().split("T")[0],
    notes: "",
    items: [],
  });

  const [newItem, setNewItem] = useState({
    finished_good_id: "",
    description: "",
    lot_number: "",
    bags_count: "",
    quantity: 100,
    unit: "KG",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [chalRes, custRes, dispRes, vehRes, fgRes, compRes] = await Promise.all([
        API.get("/plastic-erp/transport/challans"),
        API.get("/customers"),
        API.get("/plastic-erp/dispatches"),
        API.get("/plastic-erp/transport/vehicles"),
        API.get("/plastic-erp/inventory/finished-goods"),
        API.get("/company/profile").catch(() => ({ data: {} })),
      ]);

      if (chalRes.data?.success) setChallans(chalRes.data.challans || []);
      if (custRes.data?.customers) setCustomers(custRes.data.customers || []);
      if (dispRes.data?.dispatches) setDispatches(dispRes.data.dispatches || []);
      if (vehRes.data?.vehicles) setVehicles(vehRes.data.vehicles || []);
      if (fgRes.data?.finishedGoods) setFinishedGoods(fgRes.data.finishedGoods || []);
      if (compRes.data?.company) setCompanyInfo(compRes.data.company);
    } catch (err) {
      console.error("Failed to load delivery challan data:", err);
      alert("Failed to load delivery challans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddItem = () => {
    if (!newItem.description && !newItem.finished_good_id) {
      alert("Please select a product or enter description");
      return;
    }
    const fg = finishedGoods.find((f) => String(f.id) === String(newItem.finished_good_id));

    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...newItem,
          description: fg ? `${fg.fg_name} (${fg.fg_code || ""})` : newItem.description,
          quantity: Number(newItem.quantity) || 0,
          bags_count: Number(newItem.bags_count) || null,
        },
      ],
    }));

    setNewItem({
      finished_good_id: "",
      description: "",
      lot_number: "",
      bags_count: "",
      quantity: 100,
      unit: "KG",
    });
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleCreateChallan = async (e) => {
    e.preventDefault();
    if (!formData.customer_id) {
      alert("Please select a customer.");
      return;
    }
    if (formData.items.length === 0) {
      alert("Please add at least one item to the delivery challan.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await API.post("/plastic-erp/transport/challans", formData);
      if (res.data?.success) {
        alert(res.data.message || "Delivery challan created successfully!");
        setCreateModalOpen(false);
        setFormData({
          customer_id: "",
          dispatch_id: "",
          vehicle_number: "",
          driver_name: "",
          driver_mobile: "",
          transporter: "",
          eway_bill_no: "",
          challan_date: new Date().toISOString().split("T")[0],
          notes: "",
          items: [],
        });
        fetchData();
      }
    } catch (err) {
      console.error("Create Challan Error:", err);
      alert(err.response?.data?.message || "Failed to create delivery challan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewChallan = async (challanId) => {
    try {
      const res = await API.get(`/plastic-erp/transport/challans/${challanId}`);
      if (res.data?.success) {
        setSelectedChallan(res.data.challan);
        setPrintModalOpen(true);
      }
    } catch (err) {
      console.error("Fetch Challan Error:", err);
      alert("Failed to load delivery challan details");
    }
  };

  const handleStatusChange = async (challanId, newStatus) => {
    try {
      const res = await API.patch(`/plastic-erp/transport/challans/${challanId}/status`, {
        status: newStatus,
      });
      if (res.data?.success) {
        alert(`Challan marked as ${newStatus}`);
        fetchData();
        if (selectedChallan && selectedChallan.id === challanId) {
          setSelectedChallan((prev) => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      console.error("Update Status Error:", err);
      alert("Failed to update challan status");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredChallans = challans.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (customerFilter && String(c.customer_id) !== String(customerFilter)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const noMatch = String(c.challan_no || "").toLowerCase().includes(q);
      const custMatch = String(c.customer_name || "").toLowerCase().includes(q);
      const vehMatch = String(c.vehicle_number || "").toLowerCase().includes(q);
      const ewayMatch = String(c.eway_bill_no || "").toLowerCase().includes(q);
      if (!noMatch && !custMatch && !vehMatch && !ewayMatch) return false;
    }
    return true;
  });

  if (loading) return <LoadingScreen message="Loading Delivery Challans..." />;

  return (
    <div className="sb-page-container">
      <div className="no-print">
        <PageHeader
          title="Delivery Challans (DC)"
          subtitle="Issue and print official goods movement challans, E-Way bill references, and gate passes."
          breadcrumbs={[
            { label: "ERP", to: "/plastic-erp" },
            { label: "Sales & Dispatch", to: "/plastic-erp/sales-orders" },
            { label: "Delivery Challans" },
          ]}
          actions={
            <div style={{ display: "flex", gap: "10px" }}>
              <Link to="/plastic-erp/dispatches">
                <Button variant="secondary">Outward Dispatches</Button>
              </Link>
              <Link to="/plastic-erp/transport/vehicles">
                <Button variant="secondary">Vehicle Master</Button>
              </Link>
              <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                + Issue Challan
              </Button>
            </div>
          }
        />
      </div>

      {/* Filters Bar */}
      <Card noPadding style={{ marginBottom: "24px" }} className="no-print">
        <div style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <input
              type="text"
              className="sb-input"
              style={{ height: "38px" }}
              placeholder="Search by Challan #, Customer, Vehicle, E-Way Bill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="sb-input"
              style={{ width: "160px", height: "38px" }}
            >
              <option value="">All Statuses</option>
              <option value="ISSUED">Issued</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="sb-input"
              style={{ width: "180px", height: "38px" }}
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {(statusFilter || customerFilter || searchQuery) && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStatusFilter("");
                  setCustomerFilter("");
                  setSearchQuery("");
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Challans Table */}
        <DataTable
          headers={[
            "Challan #",
            "Date",
            "Customer",
            "Vehicle No",
            "Transporter",
            "E-Way Bill #",
            "Qty (KG)",
            "Status",
            "Actions",
          ]}
        >
          {filteredChallans.length === 0 ? (
            <tr>
              <td colSpan="9" style={{ textAlign: "center", padding: "32px", color: "var(--sb-muted)" }}>
                No delivery challans found.
              </td>
            </tr>
          ) : (
            filteredChallans.map((c) => (
              <tr key={c.id}>
                <td><strong style={{ color: "var(--sb-ocean)" }}>{c.challan_no}</strong></td>
                <td>{c.challan_date ? new Date(c.challan_date).toLocaleDateString() : "—"}</td>
                <td><strong>{c.customer_name}</strong></td>
                <td>{c.vehicle_number || "—"}</td>
                <td>{c.transporter || "—"}</td>
                <td>{c.eway_bill_no || "—"}</td>
                <td><strong>{Number(c.total_quantity || 0).toLocaleString()} KG</strong></td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleViewChallan(c.id)}
                    >
                      Print / View
                    </Button>
                    {c.status === "ISSUED" && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleStatusChange(c.id, "IN_TRANSIT")}
                      >
                        In Transit
                      </Button>
                    )}
                    {c.status === "IN_TRANSIT" && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleStatusChange(c.id, "DELIVERED")}
                      >
                        Delivered
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </Card>

      {/* CREATE CHALLAN MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Issue Delivery Challan"
      >
        <form onSubmit={handleCreateChallan} className="sb-form">
          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Customer *</label>
              <select
                className="sb-input"
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                required
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Challan Date *</label>
              <input
                type="date"
                className="sb-input"
                value={formData.challan_date}
                onChange={(e) => setFormData({ ...formData, challan_date: e.target.value })}
                required
              />
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Dispatch (Optional Link)</label>
              <select
                className="sb-input"
                value={formData.dispatch_id}
                onChange={(e) => setFormData({ ...formData, dispatch_id: e.target.value })}
              >
                <option value="">Direct Challan (No Dispatch)</option>
                {dispatches.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dispatch_no} — {d.customer_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Vehicle Number</label>
              <input
                type="text"
                list="challan-vehicles-list"
                className="sb-input"
                placeholder="e.g. GJ 01 XX 1234"
                value={formData.vehicle_number}
                onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
              />
              <datalist id="challan-vehicles-list">
                {vehicles.map((v) => (
                  <option key={v.id} value={v.vehicle_number}>
                    {v.vehicle_type ? `(${v.vehicle_type})` : ""} {v.driver_name ? `- ${v.driver_name}` : ""}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="sb-form-group">
              <label className="sb-label">Transporter Name</label>
              <input
                type="text"
                className="sb-input"
                placeholder="Transporter"
                value={formData.transporter}
                onChange={(e) => setFormData({ ...formData, transporter: e.target.value })}
              />
            </div>

            <div className="sb-form-group">
              <label className="sb-label">E-Way Bill Number</label>
              <input
                type="text"
                className="sb-input"
                placeholder="12-digit E-Way Bill #"
                value={formData.eway_bill_no}
                onChange={(e) => setFormData({ ...formData, eway_bill_no: e.target.value })}
              />
            </div>
          </div>

          <div className="sb-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="sb-form-group">
              <label className="sb-label">Driver Name</label>
              <input
                type="text"
                className="sb-input"
                placeholder="Driver Name"
                value={formData.driver_name}
                onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
              />
            </div>
            <div className="sb-form-group">
              <label className="sb-label">Driver Mobile</label>
              <input
                type="text"
                className="sb-input"
                placeholder="Driver Mobile"
                value={formData.driver_mobile}
                onChange={(e) => setFormData({ ...formData, driver_mobile: e.target.value })}
              />
            </div>
          </div>

          {/* Items Section */}
          <div style={{ marginTop: "16px", borderTop: "1px dashed var(--sb-border)", paddingTop: "14px" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "var(--sb-navy)", fontWeight: 700 }}>
              Challan Items
            </h4>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "10px", alignItems: "flex-end", background: "var(--sb-canvas)", padding: "14px", borderRadius: "8px", marginBottom: "14px" }}>
              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">Product / Description *</label>
                <select
                  className="sb-input"
                  value={newItem.finished_good_id}
                  onChange={(e) => {
                    const fgId = e.target.value;
                    const fg = finishedGoods.find((f) => String(f.id) === String(fgId));
                    setNewItem({
                      ...newItem,
                      finished_good_id: fgId,
                      description: fg ? `${fg.fg_name} (${fg.fg_code || ""})` : "",
                    });
                  }}
                >
                  <option value="">Select Finished Good</option>
                  {finishedGoods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fg_name} ({f.fg_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">Lot Number</label>
                <input
                  type="text"
                  className="sb-input"
                  placeholder="Lot #"
                  value={newItem.lot_number}
                  onChange={(e) => setNewItem({ ...newItem, lot_number: e.target.value })}
                />
              </div>

              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">Bags / Packages</label>
                <input
                  type="number"
                  className="sb-input"
                  placeholder="Bags"
                  value={newItem.bags_count}
                  onChange={(e) => setNewItem({ ...newItem, bags_count: e.target.value })}
                />
              </div>

              <div className="sb-form-group" style={{ margin: 0 }}>
                <label className="sb-label">Quantity (KG) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="sb-input"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                />
              </div>

              <Button type="button" variant="secondary" onClick={handleAddItem} style={{ height: "38px" }}>
                + Add
              </Button>
            </div>

            <DataTable
              headers={["Description", "Lot #", "Bags", "Quantity", "Action"]}
            >
              {formData.items.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", color: "var(--sb-muted)" }}>
                    No items added yet
                  </td>
                </tr>
              ) : (
                formData.items.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.description}</td>
                    <td>{it.lot_number || "—"}</td>
                    <td>{it.bags_count ? `${it.bags_count} Bags` : "—"}</td>
                    <td><strong>{it.quantity} {it.unit}</strong></td>
                    <td>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        ✕
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
          </div>

          <div className="sb-form-group" style={{ marginTop: "16px" }}>
            <label className="sb-label">Remarks / Gate Pass Instructions</label>
            <textarea
              className="sb-input"
              rows="2"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Creating..." : "Generate Challan"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* PRINTABLE CHALLAN PREVIEW MODAL */}
      <Modal
        isOpen={printModalOpen && !!selectedChallan}
        onClose={() => setPrintModalOpen(false)}
        title={`Delivery Challan: ${selectedChallan?.challan_no || ""}`}
      >
        {selectedChallan && (
          <div>
            <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
              <Button variant="primary" onClick={handlePrint}>
                🖨️ Print Challan
              </Button>
            </div>

            {/* PRINTABLE DOCUMENT BODY */}
            <div className="challan-print-document">
              <div className="challan-doc-header">
                <div className="company-info">
                  <h2>{companyInfo?.company_name || "PLASTIC RECYCLING & COMPOUNDING ERP"}</h2>
                  <p>{companyInfo?.address || "Industrial Area, MIDC Phase II"}</p>
                  <p>
                    GSTIN: <strong>{companyInfo?.gstin || "27AAAAA0000A1Z5"}</strong> | State: 27-Maharashtra
                  </p>
                  <p>Email: {companyInfo?.email || "sales@plasticrecycling.com"} | Phone: {companyInfo?.phone || "+91 9876543210"}</p>
                </div>
                <div className="challan-title-block">
                  <div className="title-tag">DELIVERY CHALLAN</div>
                  <div className="title-sub">(Rule 55 - Delivery Challan for Goods Transport)</div>
                  <div className="doc-num">DC No: <span>{selectedChallan.challan_no}</span></div>
                  <div className="doc-date">Date: <span>{selectedChallan.challan_date ? new Date(selectedChallan.challan_date).toLocaleDateString() : ""}</span></div>
                </div>
              </div>

              <div className="challan-meta-grid">
                <div className="meta-box">
                  <div className="meta-box-title">CONSIGNEE / DELIVER TO</div>
                  <div className="meta-val bold">{selectedChallan.customer_name}</div>
                  <div className="meta-val">{selectedChallan.customer_address || "Factory Destination"}</div>
                  <div className="meta-val">Mobile: {selectedChallan.customer_mobile || "—"}</div>
                </div>

                <div className="meta-box">
                  <div className="meta-box-title">TRANSPORT DETAILS</div>
                  <div className="meta-row">
                    <span>Vehicle No:</span>
                    <strong>{selectedChallan.vehicle_number || "Self / Ex-Factory"}</strong>
                  </div>
                  <div className="meta-row">
                    <span>Transporter:</span>
                    <span>{selectedChallan.transporter || "—"}</span>
                  </div>
                  <div className="meta-row">
                    <span>Driver / Mobile:</span>
                    <span>{selectedChallan.driver_name || "—"} ({selectedChallan.driver_mobile || "—"})</span>
                  </div>
                  <div className="meta-row">
                    <span>E-Way Bill No:</span>
                    <strong>{selectedChallan.eway_bill_no || "—"}</strong>
                  </div>
                </div>
              </div>

              <div className="challan-items-section">
                <table className="doc-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>S.N.</th>
                      <th>Description of Goods</th>
                      <th>Lot Number</th>
                      <th>Packages / Bags</th>
                      <th style={{ textAlign: "right" }}>Quantity</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedChallan.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <strong>{item.description || item.fg_name}</strong>
                          {item.fg_code && <div style={{ fontSize: "11px", color: "#64748b" }}>{item.fg_code}</div>}
                        </td>
                        <td>{item.lot_number || "—"}</td>
                        <td>{item.bags_count ? `${item.bags_count} Bags` : "—"}</td>
                        <td style={{ textAlign: "right" }}>
                          <strong>{Number(item.quantity).toLocaleString()}</strong>
                        </td>
                        <td>{item.unit || "KG"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" style={{ textAlign: "right", fontWeight: 700 }}>
                        Total Quantity:
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {(selectedChallan.items || [])
                          .reduce((sum, it) => sum + Number(it.quantity || 0), 0)
                          .toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 700 }}>KG</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedChallan.notes && (
                <div className="challan-doc-notes">
                  <strong>Remarks / Instructions:</strong> {selectedChallan.notes}
                </div>
              )}

              <div className="challan-declaration">
                <p>
                  <strong>Declaration:</strong> Certified that the particulars given above are true and correct and the goods are being transported for sales delivery / processing as per GST Act rules.
                </p>
              </div>

              <div className="challan-signatures">
                <div className="sig-box">
                  <div className="sig-line"></div>
                  <span>Receiver&apos;s Signature & Stamp</span>
                </div>
                <div className="sig-box">
                  <div className="sig-line"></div>
                  <span>Driver&apos;s Signature</span>
                </div>
                <div className="sig-box">
                  <div className="sig-line"></div>
                  <span>For {companyInfo?.company_name || "Company Name"} (Authorized Signatory)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default PlasticDeliveryChallan;
