import React, { useState, useEffect } from "react";
import axios from "axios";
import PlasticNavbar from "../components/PlasticNavbar";
import "./PlasticGstManagement.css";

const API_BASE = "http://localhost:5000/api/plastic-erp/gst";

const PlasticGstManagement = () => {
  const [activeTab, setActiveTab] = useState("gstr1"); // gstr1, gstr3b, itc, all
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [searchTerm, setSearchTerm] = useState("");
  const [gstTypeFilter, setGstTypeFilter] = useState("ALL");

  // Data states
  const [gstr1Data, setGstr1Data] = useState(null);
  const [gstr3bData, setGstr3bData] = useState(null);
  const [itcRecords, setItcRecords] = useState([]);
  const [itcSummary, setItcSummary] = useState(null);
  const [allRecords, setAllRecords] = useState([]);
  const [allSummary, setAllSummary] = useState(null);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchData();
  }, [activeTab, month, year, gstTypeFilter]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "gstr1") {
        const res = await axios.get(`${API_BASE}/gstr-1`, {
          params: { month, year },
          headers,
        });
        if (res.data.success) setGstr1Data(res.data);
      } else if (activeTab === "gstr3b") {
        const res = await axios.get(`${API_BASE}/gstr-3b`, {
          params: { month, year },
          headers,
        });
        if (res.data.success) setGstr3bData(res.data);
      } else if (activeTab === "itc") {
        const res = await axios.get(`${API_BASE}/itc-register`, {
          params: { month, year },
          headers,
        });
        if (res.data.success) {
          setItcRecords(res.data.records || []);
          setItcSummary(res.data.summary || null);
        }
      } else if (activeTab === "all") {
        const res = await axios.get(`${API_BASE}/records`, {
          params: {
            gst_type: gstTypeFilter,
            search: searchTerm,
          },
          headers,
        });
        if (res.data.success) {
          setAllRecords(res.data.records || []);
          setAllSummary(res.data.summary || null);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load GST data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItcStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "ELIGIBLE" ? "INELIGIBLE" : "ELIGIBLE";
    try {
      const res = await axios.patch(
        `${API_BASE}/itc-status/${id}`,
        { itc_eligibility: nextStatus },
        { headers }
      );
      if (res.data.success) {
        setSuccessMsg(`Record #${id} ITC updated to ${nextStatus}`);
        setTimeout(() => setSuccessMsg(null), 3000);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update ITC status");
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  return (
    <div className="plastic-gst-page">
      <PlasticNavbar />
      <div className="gst-container">
        {/* Header */}
        <div className="gst-header">
          <div>
            <span className="badge-phase">PHASE 5: ACCOUNTING & COMPLIANCE</span>
            <h1 className="page-title">⚖️ GST Management & Returns Preparation</h1>
            <p className="page-subtitle">
              Comprehensive GSTR-1, GSTR-3B preparation tables, ITC register, and statutory audit tools.
            </p>
          </div>
          <div className="disclaimer-badge">
            ⚠️ Internal Preparation Tool (Verify with Tax Consultant before portal filing)
          </div>
        </div>

        {/* Global Controls & Month Picker */}
        <div className="gst-controls-bar">
          <div className="tabs-pill">
            <button
              className={`pill-btn ${activeTab === "gstr1" ? "active" : ""}`}
              onClick={() => setActiveTab("gstr1")}
            >
              📑 GSTR-1 Preparation
            </button>
            <button
              className={`pill-btn ${activeTab === "gstr3b" ? "active" : ""}`}
              onClick={() => setActiveTab("gstr3b")}
            >
              📊 GSTR-3B Summary
            </button>
            <button
              className={`pill-btn ${activeTab === "itc" ? "active" : ""}`}
              onClick={() => setActiveTab("itc")}
            >
              📥 ITC Register
            </button>
            <button
              className={`pill-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              📋 All GST Records
            </button>
          </div>

          <div className="date-filter-box">
            <label>Tax Period:</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              <option value={1}>January</option>
              <option value={2}>February</option>
              <option value={3}>March</option>
              <option value={4}>April</option>
              <option value={5}>May</option>
              <option value={6}>June</option>
              <option value={7}>July</option>
              <option value={8}>August</option>
              <option value={9}>September</option>
              <option value={10}>October</option>
              <option value={11}>November</option>
              <option value={12}>December</option>
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
            <button className="btn-refresh" onClick={fetchData} title="Refresh">
              🔄
            </button>
          </div>
        </div>

        {successMsg && <div className="alert-banner success">{successMsg}</div>}
        {error && <div className="alert-banner error">{error}</div>}

        {loading ? (
          <div className="gst-loading">
            <div className="spinner"></div>
            <p>Loading compliance records...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: GSTR-1 */}
            {activeTab === "gstr1" && gstr1Data && (
              <div className="tab-content gstr1-view">
                {/* Summary Cards */}
                <div className="kpi-grid">
                  <div className="kpi-card">
                    <span className="kpi-label">B2B Outward Supplies</span>
                    <span className="kpi-value">₹{(gstr1Data.summary?.b2bTaxable || 0).toLocaleString()}</span>
                    <span className="kpi-sub">{gstr1Data.summary?.b2bCount || 0} Invoices | Tax: ₹{(gstr1Data.summary?.b2bTax || 0).toLocaleString()}</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-label">B2C (Unregistered)</span>
                    <span className="kpi-value">₹{(gstr1Data.summary?.b2cTaxable || 0).toLocaleString()}</span>
                    <span className="kpi-sub">{gstr1Data.summary?.b2cCount || 0} Invoices | Tax: ₹{(gstr1Data.summary?.b2cTax || 0).toLocaleString()}</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-label">Credit / Debit Notes</span>
                    <span className="kpi-value">₹{(gstr1Data.summary?.cdnTaxable || 0).toLocaleString()}</span>
                    <span className="kpi-sub">{gstr1Data.summary?.cdnCount || 0} Notes | Tax: ₹{(gstr1Data.summary?.cdnTax || 0).toLocaleString()}</span>
                  </div>
                  <div className="kpi-card highlight">
                    <span className="kpi-label">Total Outward Tax Liability</span>
                    <span className="kpi-value highlight-val">₹{(gstr1Data.summary?.totalOutputTax || 0).toLocaleString()}</span>
                    <span className="kpi-sub">CGST: ₹{(gstr1Data.summary?.totalOutputCGST || 0).toLocaleString()} | SGST: ₹{(gstr1Data.summary?.totalOutputSGST || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Section: B2B Table */}
                <div className="section-card">
                  <div className="section-header">
                    <h3>Table 4: B2B Invoices (Registered Recipients)</h3>
                    <span className="tag-count">{gstr1Data.b2bSupplies?.length || 0} entries</span>
                  </div>
                  <div className="table-responsive">
                    <table className="gst-table">
                      <thead>
                        <tr>
                          <th>Invoice No</th>
                          <th>Date</th>
                          <th>Recipient Name</th>
                          <th>GSTIN</th>
                          <th>POS</th>
                          <th>Taxable Value</th>
                          <th>CGST</th>
                          <th>SGST</th>
                          <th>IGST</th>
                          <th>Total Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gstr1Data.b2bSupplies?.length === 0 ? (
                          <tr><td colSpan="10" className="empty-td">No B2B invoices found for selected tax period.</td></tr>
                        ) : (
                          gstr1Data.b2bSupplies.map((row) => (
                            <tr key={row.id}>
                              <td><strong>{row.invoice_no}</strong></td>
                              <td>{row.invoice_date?.split("T")[0]}</td>
                              <td>{row.party_name}</td>
                              <td><code className="gstin-code">{row.party_gstin}</code></td>
                              <td>{row.place_of_supply || "Home State"}</td>
                              <td>₹{Number(row.taxable_amount).toLocaleString()}</td>
                              <td>₹{Number(row.cgst_amount).toLocaleString()}</td>
                              <td>₹{Number(row.sgst_amount).toLocaleString()}</td>
                              <td>₹{Number(row.igst_amount).toLocaleString()}</td>
                              <td><strong>₹{Number(row.total_tax).toLocaleString()}</strong></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section: HSN Summary */}
                <div className="section-card">
                  <div className="section-header">
                    <h3>Table 12: HSN Summary of Outward Supplies</h3>
                  </div>
                  <div className="table-responsive">
                    <table className="gst-table">
                      <thead>
                        <tr>
                          <th>HSN Code</th>
                          <th>Description</th>
                          <th>UQC</th>
                          <th>Total Taxable Value</th>
                          <th>CGST</th>
                          <th>SGST</th>
                          <th>IGST</th>
                          <th>Total Tax Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gstr1Data.hsnSummary?.length === 0 ? (
                          <tr><td colSpan="8" className="empty-td">No HSN data available.</td></tr>
                        ) : (
                          gstr1Data.hsnSummary.map((hsn, idx) => (
                            <tr key={idx}>
                              <td><code className="hsn-badge">{hsn.hsn_code}</code></td>
                              <td>{hsn.description}</td>
                              <td>{hsn.uqc}</td>
                              <td>₹{Number(hsn.total_taxable_value).toLocaleString()}</td>
                              <td>₹{Number(hsn.cgst_amount).toLocaleString()}</td>
                              <td>₹{Number(hsn.sgst_amount).toLocaleString()}</td>
                              <td>₹{Number(hsn.igst_amount).toLocaleString()}</td>
                              <td><strong>₹{Number(hsn.total_tax_amount).toLocaleString()}</strong></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: GSTR-3B */}
            {activeTab === "gstr3b" && gstr3bData && (
              <div className="tab-content gstr3b-view">
                <div className="section-card">
                  <div className="section-header">
                    <h3>3.1 Details of Outward Supplies and inward supplies liable to reverse charge</h3>
                  </div>
                  <table className="gst-table">
                    <thead>
                      <tr>
                        <th>Nature of Supplies</th>
                        <th>Total Taxable Value</th>
                        <th>Integrated Tax (IGST)</th>
                        <th>Central Tax (CGST)</th>
                        <th>State/UT Tax (SGST)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>(a) Outward taxable supplies (other than zero rated, nil rated and exempted)</strong></td>
                        <td>₹{Number(gstr3bData.table3_1?.taxable_amount || 0).toLocaleString()}</td>
                        <td>₹{Number(gstr3bData.table3_1?.igst || 0).toLocaleString()}</td>
                        <td>₹{Number(gstr3bData.table3_1?.cgst || 0).toLocaleString()}</td>
                        <td>₹{Number(gstr3bData.table3_1?.sgst || 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="section-card">
                  <div className="section-header">
                    <h3>4. Eligible Input Tax Credit (ITC)</h3>
                  </div>
                  <table className="gst-table">
                    <thead>
                      <tr>
                        <th>Details</th>
                        <th>Integrated Tax (IGST)</th>
                        <th>Central Tax (CGST)</th>
                        <th>State/UT Tax (SGST)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>(A) ITC Available (whether in full or part) - All other ITC (Purchases/Services)</strong></td>
                        <td>₹{Number(gstr3bData.table4_itc?.itc_igst || 0).toLocaleString()}</td>
                        <td>₹{Number(gstr3bData.table4_itc?.itc_cgst || 0).toLocaleString()}</td>
                        <td>₹{Number(gstr3bData.table4_itc?.itc_sgst || 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="section-card liability-card">
                  <div className="section-header">
                    <h3>6. Net Tax Payable (Output Liability − Eligible ITC)</h3>
                  </div>
                  <div className="net-tax-grid">
                    <div className="net-box">
                      <span className="net-label">Central Tax (CGST) Payable</span>
                      <span className="net-amt">₹{Number(gstr3bData.netTaxPayable?.cgstPayable || 0).toLocaleString()}</span>
                      <span className="net-calc">Output ₹{(gstr3bData.table3_1?.cgst || 0).toLocaleString()} - ITC ₹{(gstr3bData.table4_itc?.itc_cgst || 0).toLocaleString()}</span>
                    </div>
                    <div className="net-box">
                      <span className="net-label">State Tax (SGST) Payable</span>
                      <span className="net-amt">₹{Number(gstr3bData.netTaxPayable?.sgstPayable || 0).toLocaleString()}</span>
                      <span className="net-calc">Output ₹{(gstr3bData.table3_1?.sgst || 0).toLocaleString()} - ITC ₹{(gstr3bData.table4_itc?.itc_sgst || 0).toLocaleString()}</span>
                    </div>
                    <div className="net-box">
                      <span className="net-label">Integrated Tax (IGST) Payable</span>
                      <span className="net-amt">₹{Number(gstr3bData.netTaxPayable?.igstPayable || 0).toLocaleString()}</span>
                      <span className="net-calc">Output ₹{(gstr3bData.table3_1?.igst || 0).toLocaleString()} - ITC ₹{(gstr3bData.table4_itc?.itc_igst || 0).toLocaleString()}</span>
                    </div>
                    <div className="net-box total">
                      <span className="net-label">Total Net Cash / Ledger Payable</span>
                      <span className="net-amt highlight">₹{Number(gstr3bData.netTaxPayable?.totalPayable || 0).toLocaleString()}</span>
                      <span className="net-calc">Self-assessment liability</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ITC REGISTER */}
            {activeTab === "itc" && (
              <div className="tab-content itc-view">
                {itcSummary && (
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <span className="kpi-label">Eligible ITC</span>
                      <span className="kpi-value text-green">₹{(itcSummary.eligibleITC || 0).toLocaleString()}</span>
                      <span className="kpi-sub">Ready for GSTR-3B claim</span>
                    </div>
                    <div className="kpi-card">
                      <span className="kpi-label">Ineligible / Blocked ITC</span>
                      <span className="kpi-value text-red">₹{(itcSummary.ineligibleITC || 0).toLocaleString()}</span>
                      <span className="kpi-sub">Under Sec 17(5)</span>
                    </div>
                    <div className="kpi-card">
                      <span className="kpi-label">Total Input Tax</span>
                      <span className="kpi-value">₹{(itcSummary.totalInputTax || 0).toLocaleString()}</span>
                      <span className="kpi-sub">{itcRecords.length} Purchase Bills</span>
                    </div>
                  </div>
                )}

                <div className="section-card">
                  <div className="section-header">
                    <h3>Input Tax Credit (ITC) Register</h3>
                    <p className="hint-p">Click the eligibility badge to toggle between ELIGIBLE and INELIGIBLE.</p>
                  </div>
                  <div className="table-responsive">
                    <table className="gst-table">
                      <thead>
                        <tr>
                          <th>Bill No</th>
                          <th>Date</th>
                          <th>Supplier Name</th>
                          <th>Supplier GSTIN</th>
                          <th>Taxable Amount</th>
                          <th>CGST</th>
                          <th>SGST</th>
                          <th>IGST</th>
                          <th>Total ITC</th>
                          <th>Eligibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itcRecords.length === 0 ? (
                          <tr><td colSpan="10" className="empty-td">No input tax credit records found for this period.</td></tr>
                        ) : (
                          itcRecords.map((r) => (
                            <tr key={r.id}>
                              <td><strong>{r.invoice_no}</strong></td>
                              <td>{r.invoice_date?.split("T")[0]}</td>
                              <td>{r.party_name}</td>
                              <td><code className="gstin-code">{r.party_gstin || "UNREGISTERED"}</code></td>
                              <td>₹{Number(r.taxable_amount).toLocaleString()}</td>
                              <td>₹{Number(r.cgst_amount).toLocaleString()}</td>
                              <td>₹{Number(r.sgst_amount).toLocaleString()}</td>
                              <td>₹{Number(r.igst_amount).toLocaleString()}</td>
                              <td><strong>₹{Number(r.total_tax).toLocaleString()}</strong></td>
                              <td>
                                <button
                                  className={`btn-eligibility ${r.itc_eligibility === "ELIGIBLE" ? "eligible" : "ineligible"}`}
                                  onClick={() => handleUpdateItcStatus(r.id, r.itc_eligibility)}
                                  title="Click to toggle"
                                >
                                  {r.itc_eligibility} ⇄
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: ALL RECORDS */}
            {activeTab === "all" && (
              <div className="tab-content all-view">
                <div className="filter-row">
                  <form onSubmit={handleSearchSubmit} className="search-box">
                    <input
                      type="text"
                      placeholder="Search Invoice #, Party Name, GSTIN, HSN..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button type="submit" className="btn-search">Search</button>
                  </form>
                  <div className="radio-group">
                    <label>
                      <input
                        type="radio"
                        value="ALL"
                        checked={gstTypeFilter === "ALL"}
                        onChange={() => setGstTypeFilter("ALL")}
                      /> All
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="OUTPUT"
                        checked={gstTypeFilter === "OUTPUT"}
                        onChange={() => setGstTypeFilter("OUTPUT")}
                      /> Outward (Sales)
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="INPUT"
                        checked={gstTypeFilter === "INPUT"}
                        onChange={() => setGstTypeFilter("INPUT")}
                      /> Inward (Purchases)
                    </label>
                  </div>
                </div>

                {allSummary && (
                  <div className="summary-strip">
                    <span>Records: <strong>{allSummary.totalRecords}</strong></span>
                    <span>Total Taxable: <strong>₹{allSummary.totalTaxable.toLocaleString()}</strong></span>
                    <span>CGST: <strong>₹{allSummary.totalCGST.toLocaleString()}</strong></span>
                    <span>SGST: <strong>₹{allSummary.totalSGST.toLocaleString()}</strong></span>
                    <span>IGST: <strong>₹{allSummary.totalIGST.toLocaleString()}</strong></span>
                    <span>Total Tax: <strong className="highlight">₹{allSummary.totalTax.toLocaleString()}</strong></span>
                  </div>
                )}

                <div className="section-card">
                  <div className="table-responsive">
                    <table className="gst-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Doc #</th>
                          <th>Date</th>
                          <th>Party</th>
                          <th>GSTIN</th>
                          <th>HSN</th>
                          <th>Taxable</th>
                          <th>CGST</th>
                          <th>SGST</th>
                          <th>IGST</th>
                          <th>Total Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allRecords.length === 0 ? (
                          <tr><td colSpan="11" className="empty-td">No GST transactions found matching criteria.</td></tr>
                        ) : (
                          allRecords.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <span className={`type-badge ${r.gst_type.toLowerCase()}`}>
                                  {r.gst_type}
                                </span>
                              </td>
                              <td><strong>{r.invoice_no}</strong></td>
                              <td>{r.invoice_date?.split("T")[0]}</td>
                              <td>{r.party_name}</td>
                              <td><code className="gstin-code">{r.party_gstin || "—"}</code></td>
                              <td>{r.hsn_code}</td>
                              <td>₹{Number(r.taxable_amount).toLocaleString()}</td>
                              <td>₹{Number(r.cgst_amount).toLocaleString()}</td>
                              <td>₹{Number(r.sgst_amount).toLocaleString()}</td>
                              <td>₹{Number(r.igst_amount).toLocaleString()}</td>
                              <td><strong>₹{Number(r.total_tax).toLocaleString()}</strong></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PlasticGstManagement;
